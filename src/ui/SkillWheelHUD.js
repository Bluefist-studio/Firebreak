import { SKILL_CONFIG as SC } from '../data/skillConfig.js';

/**
 * SkillWheelHUD — radial skill selector opened with middle-mouse button.
 * Shows skills 1–7 only (skills 8/9 are always-on mouse-button tools).
 *
 * Skills 1 (Water Bomber) and 2 (Heli Drop) have sub-pies that extend
 * outward when hovered, letting the player choose Water or Retardant.
 *
 * confirmAndClose() → { skillKey, retardant: bool } | null
 */
export class SkillWheelHUD {
  constructor({ gameState, icons = {} }) {
    this.gameState = gameState;
    this.icons = icons;  // { 1: Image, 2: Image, ... 7: Image }
    this.isOpen = false;
    this.centerX = 0;
    this.centerY = 0;
    this.hoveredSkill = null;
    /** 'water' | 'retardant' | null — only meaningful for skills 1 and 2 */
    this.hoveredSubOption = null;

    // Skills 1–7; 8 = Fire Crew (LMB hold), 9 = Fire Truck (RMB hold)
    this.wheelSkills = [1, 2, 3, 4, 5, 6, 7];
    // Skills that expose a water / retardant secondary choice
    this._subSkills = new Set([1, 2]);

    this._cooldownDurations = { 1: 8, 2: 4, 3: 8, 4: 12, 5: 10, 6: 10, 7: 20 };
    this._cooldownKeys = {
      1: 'waterBomberCooldown',
      2: 'heliDropCooldown',
      3: 'bulldozerCooldown',
      4: 'workerCrewCooldown',
      5: 'watchTowerCooldown',
      6: 'droneReconCooldown',
      7: 'reconPlaneCooldown',
    };

    // Cached radii — kept in sync by render() so hit-testing is always current
    this._innerR    = 48;
    this._outerR    = 145;
    this._subExtend = 72;
  }

  open(x, y) {
    this.isOpen = true;
    this.centerX = x;
    this.centerY = y;
    this.hoveredSkill = null;
    this.hoveredSubOption = null;
  }

  close() {
    this.isOpen = false;
    this.hoveredSkill = null;
    this.hoveredSubOption = null;
  }

  /** Update the highlighted slice (and sub-option) based on current cursor position. */
  handlePointerMove(x, y) {
    if (!this.isOpen) return;
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this._innerR) {
      this.hoveredSkill = null;
      this.hoveredSubOption = null;
      return;
    }

    const count = this.wheelSkills.length;
    const sliceAngle = (2 * Math.PI) / count;
    const startOffset = -Math.PI / 2;
    let angle = Math.atan2(dy, dx) - startOffset;
    if (angle < 0) angle += 2 * Math.PI;
    const idx = Math.floor(angle / sliceAngle) % count;
    this.hoveredSkill = this.wheelSkills[idx];

    // Sub-option hit test for dual-mode skills:
    //   inner zone (innerR → outerR) = Water
    //   outer zone (outerR →  ...)   = Retardant
    this.hoveredSubOption = null;
    if (this._subSkills.has(this.hoveredSkill)) {
      this.hoveredSubOption = dist < this._outerR ? 'water' : 'retardant';
    }
  }

  /**
   * Returns { skillKey, retardant: bool } or null (no selection), then closes.
   * If a sub-option was selected it's honoured; otherwise the current gameState
   * flag is preserved so activating without a sub-choice keeps existing mode.
   */
  confirmAndClose() {
    const skillKey = this.hoveredSkill;
    const sub      = this.hoveredSubOption;
    this.close();
    if (!skillKey) return null;

    let retardant = false;
    if (this._subSkills.has(skillKey)) {
      if (sub === 'retardant') {
        retardant = true;
      } else if (sub === 'water') {
        retardant = false;
      } else {
        // No sub selected — keep whatever mode was already set
        retardant = skillKey === 1
          ? !!this.gameState.waterBomberUseRetardant
          : !!this.gameState.heliDropUseRetardant;
      }
    }
    return { skillKey, retardant };
  }

  // ─────────────────────────────────────────────────────────────────────────
  render(ctx) {
    if (!this.isOpen) return;

    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const scale = Math.min(cw / 1280, ch / 720, 2);

    const outerR = Math.round(190 * scale);
    const innerR = Math.round(80 * scale);
    // Keep in sync for hit-testing
    this._innerR = innerR;
    this._outerR = outerR;

    const cx = this.centerX;
    const cy = this.centerY;
    const count       = this.wheelSkills.length;
    const sliceAngle  = (2 * Math.PI) / count;
    const startOffset = -Math.PI / 2;

    // Pulse factor for can't-afford warning: oscillates 0→1→0 at ~2 Hz
    const _pulse = 0.55 + 0.45 * Math.sin(performance.now() / 250);

    ctx.save();

    // ── 1. Main slices ────────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const skillKey    = this.wheelSkills[i];
      const skill       = this.gameState.skills[skillKey];
      if (!skill) continue;

      const startAngle  = startOffset + i * sliceAngle;
      const endAngle    = startAngle + sliceAngle;
      const midAngle    = startAngle + sliceAngle / 2;
      const isHovered   = this.hoveredSkill === skillKey;
      const cdRemaining = this._getCooldownRemaining(skillKey);
      const onCooldown  = cdRemaining > 0.01;
      const isLocked    = !this.gameState.isSkillFree() && this.gameState.economyState &&
        !this.gameState._isAssetUnlocked?.(this._skillKeyToAssetId(skillKey));

      const isDual       = this._subSkills.has(skillKey);
      const isWaterSel    = isHovered && isDual && this.hoveredSubOption === 'water';
      const isRetSel      = isHovered && isDual && this.hoveredSubOption === 'retardant';

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();

      const canAfford    = this._canAffordSkill(skillKey, isHovered ? this.hoveredSubOption : null);
      const cantAffordHov = isHovered && !canAfford;

      if (isLocked) {
        ctx.fillStyle = 'rgba(20, 20, 20, 0.78)';
      } else if (isWaterSel) {
        ctx.fillStyle = canAfford ? 'rgba(30, 120, 255, 0.92)' : 'rgba(160, 30, 30, 0.92)';  // blue = water, red = no resources
      } else if (isRetSel) {
        ctx.fillStyle = 'rgba(60, 70, 90, 0.78)';    // dimmed while retardant petal is active
      } else if (cantAffordHov) {
        const r = Math.round(140 + 80 * _pulse);
        ctx.fillStyle = `rgba(${r}, 20, 20, 0.92)`;  // pulsing red = can't afford
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(255, 200, 65, 0.92)';  // yellow for non-dual or no-sub
      } else if (onCooldown) {
        ctx.fillStyle = 'rgba(40, 25, 25, 0.84)';
      } else {
        ctx.fillStyle = 'rgba(16, 26, 44, 0.87)';
      }
      ctx.fill();

      const _borderAlpha = cantAffordHov ? (0.7 + 0.3 * _pulse).toFixed(2) : null;
      const sliceBorderColor = cantAffordHov ? `rgba(255,${Math.round(30+40*_pulse)},20,${_borderAlpha})` : isWaterSel ? '#55aaff' : isHovered ? '#ffcc33' : 'rgba(80, 110, 170, 0.60)';
      ctx.strokeStyle = sliceBorderColor;
      ctx.lineWidth   = isHovered ? Math.round(3 * scale) : Math.round(1.5 * scale);
      ctx.stroke();

      // Cooldown shadow
      if (onCooldown && !isLocked) {
        const dur      = this._cooldownDurations[skillKey] || 1;
        const progress = Math.max(0, 1 - cdRemaining / dur);
        const darkEnd  = startAngle + sliceAngle * (1 - progress);
        if (darkEnd > startAngle) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, outerR, startAngle, darkEnd);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
          ctx.fill();
        }
      }

      // ── Icon + overlay ───────────────────────────────────────────────
      const labelDist = (innerR + outerR) * 0.52;
      const lx = cx + Math.cos(midAngle) * labelDist;
      const ly = cy + Math.sin(midAngle) * labelDist;
      const iconSize = Math.round(72 * scale);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // Draw icon (circular clip)
      const iconImg = this.icons[skillKey];
      if (iconImg?.complete && iconImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly, iconSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = (isLocked || onCooldown) ? 0.30 : 1.0;
        ctx.drawImage(iconImg, lx - iconSize / 2, ly - iconSize / 2, iconSize, iconSize);
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        // Fallback text when icon not loaded
        const nameColor = (isHovered && !isWaterSel && !isRetSel) ? '#1a1000' : '#e8eeff';
        const name  = skill.name || '';
        const words = name.split(' ');
        const fs    = Math.round(13 * scale);
        const lineH = fs * 1.3;
        ctx.font      = `bold ${fs}px Arial`;
        ctx.fillStyle = nameColor;
        if (words.length === 1) {
          ctx.fillText(words[0], lx, ly);
        } else if (words.length === 2) {
          ctx.fillText(words[0], lx, ly - lineH * 0.5);
          ctx.fillText(words[1], lx, ly + lineH * 0.5);
        } else {
          ctx.fillText(words[0], lx, ly - lineH);
          ctx.fillText(words.slice(1, 3).join(' '), lx, ly);
        }
      }

      // Overlay: LOCKED, cooldown timer, or can't-afford warning
      if (isLocked) {
        ctx.font      = `bold ${Math.round(13 * scale)}px Arial`;
        ctx.fillStyle = '#8899aa';
        ctx.fillText('LOCKED', lx, ly);
      } else if (onCooldown) {
        ctx.font      = `bold ${Math.round(17 * scale)}px Arial`;
        ctx.fillStyle = '#ff6655';
        ctx.fillText(cdRemaining.toFixed(1) + 's', lx, ly);
      } else if (cantAffordHov) {
        ctx.font         = `bold ${Math.round(22 * scale)}px Arial`;
        ctx.globalAlpha  = 0.6 + 0.4 * _pulse;
        ctx.fillStyle    = '#ff3311';
        ctx.fillText('⚠', lx, ly - iconSize * 0.55);
        ctx.globalAlpha  = 1;
      }

      // ── Durability / crew-food bar ─────────────────────────────────
      {
        const usesFood = skillKey === 5 || skillKey === 6;
        const assetId  = this._skillKeyToAssetId(skillKey);
        const eco      = this.gameState.economyState;
        const rawPct   = usesFood
          ? Math.max(0, Math.min(1, (eco?.crewFedStatus ?? 100) / 100))
          : Math.max(0, Math.min(1, (eco?.assetDurability?.[assetId] ?? 100) / 100));

        if (eco || !usesFood) {
          // Resolve cost depletion for this skill
          const subOpt   = isWaterSel ? 'water' : isRetSel ? 'retardant' : null;
          const costs    = this._getSkillCosts(skillKey, subOpt);
          const costKey  = usesFood ? 'food' : 'dur';
          const costEntry = costs.find(c => c.key === costKey);
          let costPct = 0;
          if (costEntry) {
            const raw = costEntry.val;
            if (raw.endsWith('%'))      costPct = parseFloat(raw) / 100;
            else if (!raw.includes('/')) costPct = parseFloat(raw) / 100; // e.g. food 5 → 0.05
          }

          const afterPct = Math.max(0, rawPct - costPct);
          const bw = Math.round(40 * scale);
          const bh = Math.round(5  * scale);
          const bx = lx - bw / 2;
          const by = ly + iconSize * 0.30;

          // Track background
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(bx, by, bw, bh);

          // When not hovered, show bar using raw value; when hovered show after-cost split
          const displayAfter = isHovered ? afterPct : rawPct;
          const barColor = displayAfter > 0.60 ? '#55ee66' : displayAfter > 0.30 ? '#ffbb33' : '#ff4422';
          ctx.fillStyle  = barColor;
          ctx.fillRect(bx, by, Math.round(bw * displayAfter), bh);

          // Cost notch — only when hovered
          if (isHovered && costPct > 0 && rawPct > 0) {
            const notchX = bx + Math.round(bw * afterPct);
            const notchW = Math.round(bw * Math.min(costPct, rawPct));
            ctx.fillStyle = 'rgba(255, 90, 30, 0.88)';
            ctx.fillRect(notchX, by, notchW, bh);
            // Tick mark at the boundary
            ctx.fillStyle = 'rgba(255,255,255,0.70)';
            ctx.fillRect(notchX, by, Math.max(1, Math.round(scale)), bh);
          }

          // Thin border
          ctx.strokeStyle = 'rgba(0,0,0,0.40)';
          ctx.lineWidth   = 1;
          ctx.strokeRect(bx, by, bw, bh);

          // Label: always show current%, only append cost when hovered
          ctx.font         = `${Math.round(9 * scale)}px Arial`;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          const icon       = usesFood ? '\uD83C\uDF5E' : '\uD83D\uDD27';
          const valStr     = `${Math.round(rawPct * 100)}%`;
          const costStr    = (isHovered && costPct > 0 && !costEntry?.val.includes('/')) ? ` -${Math.round(costPct * 100)}%` : '';
          ctx.fillStyle    = rawPct > 0.50 ? '#aaffbb' : rawPct > 0.30 ? '#ffddaa' : '#ffaaaa';
          ctx.fillText(`${icon}${valStr}${costStr}`, lx, by + bh + Math.round(2 * scale));
          ctx.textBaseline = 'middle';
        }
      }

      // Water mode indicator below icon
      if (isWaterSel && !isLocked && !onCooldown) {
        ctx.font      = `bold ${Math.round(11 * scale)}px Arial`;
        ctx.fillStyle = '#aaddff';
        ctx.fillText('\u{1F4A7}', lx, ly + iconSize * 0.95);
      }

      // Key-number badge at outer corner of slice
      ctx.font      = `bold ${Math.round(20 * scale)}px Arial`;
      ctx.fillStyle = (isHovered && !isWaterSel) ? '#ffdd44' : isWaterSel ? '#aaddff' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(skillKey), cx + Math.cos(midAngle) * outerR, cy + Math.sin(midAngle) * outerR);
    }

    // ── 2. Retardant petal for hovered dual-mode skill ─────────────────
    // Single short, wide annular sector centered on the slice mid-angle.
    if (this.hoveredSkill !== null && this._subSkills.has(this.hoveredSkill)) {
      const skillKey      = this.hoveredSkill;
      const idx           = this.wheelSkills.indexOf(skillKey);
      const midAngle      = startOffset + idx * sliceAngle + sliceAngle / 2;
      const retPetalHalf  = sliceAngle * 0.72;   // wide: 1.44× the slice angle
      const retInnerR     = outerR;
      const retOuterR     = outerR + Math.round(40 * scale); // short radial depth
      const isRetHov      = this.hoveredSubOption === 'retardant';
      const isLocked      = !this.gameState.isSkillFree() && this.gameState.economyState &&
        !this.gameState._isAssetUnlocked?.(this._skillKeyToAssetId(skillKey));

      // Annular sector: outer arc forward, inner arc reversed
      ctx.beginPath();
      ctx.arc(cx, cy, retOuterR, midAngle - retPetalHalf, midAngle + retPetalHalf);
      ctx.arc(cx, cy, retInnerR, midAngle + retPetalHalf, midAngle - retPetalHalf, true);
      ctx.closePath();

      if (isLocked) {
        ctx.fillStyle = 'rgba(20, 20, 20, 0.78)';
      } else if (isRetHov) {
        ctx.fillStyle = 'rgba(255, 110, 25, 0.97)';
      } else {
        ctx.fillStyle = 'rgba(110, 38, 4, 0.88)';
      }
      ctx.fill();
      ctx.strokeStyle = isRetHov ? '#ffcc88' : '#992200';
      ctx.lineWidth   = isRetHov ? Math.round(2.5 * scale) : Math.round(1.5 * scale);
      ctx.stroke();

      // Label inside petal
      const lDist = retInnerR + (retOuterR - retInnerR) * 0.52;
      const lx    = cx + Math.cos(midAngle) * lDist;
      const ly    = cy + Math.sin(midAngle) * lDist;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = `bold ${Math.round(12 * scale)}px Arial`;
      ctx.fillStyle    = isLocked ? '#334455' : isRetHov ? '#ffffff' : '#ffaa55';
      ctx.fillText(isLocked ? '—' : '🧯 Retardant', lx, ly);
    }

    // ── 3. Inner circle — resource panel ────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(8, 14, 24, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 100, 180, 0.85)';
    ctx.lineWidth   = Math.round(2 * scale);
    ctx.stroke();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const eco    = this.gameState.economyState;
    const lh     = Math.round(15 * scale);
    const hasEco = !!eco;

    // Cost map for hovered skill
    const hCosts   = this.hoveredSkill ? this._getSkillCosts(this.hoveredSkill, this.hoveredSubOption) : [];
    const costOf   = (key) => { const e = hCosts.find(c => c.key === key); return e ? e.val : null; };
    const hasHover = hCosts.length > 0;

    // Heading
    ctx.font      = `bold ${Math.round(10 * scale)}px Arial`;
    ctx.fillStyle = '#445577';
    ctx.fillText('RESOURCES', cx, cy - lh * (hasEco ? 3.4 : 1.2));

    // Money row
    const moneyCost    = costOf('money');
    const displayMoney = eco ? Math.floor(eco.money) : Math.floor(this.gameState.money ?? 0);
    ctx.font = `bold ${Math.round(14 * scale)}px Arial`;
    if (moneyCost) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`$${displayMoney.toLocaleString()}`, cx - Math.round(16 * scale), cy - lh * (hasEco ? 2.1 : 0));
      ctx.font      = `bold ${Math.round(11 * scale)}px Arial`;
      ctx.fillStyle = '#ff6644';
      ctx.fillText(`-$${moneyCost}`, cx + Math.round(24 * scale), cy - lh * (hasEco ? 2.1 : 0));
    } else {
      ctx.globalAlpha = (hasHover && hasEco) ? 0.55 : 1.0;
      ctx.fillStyle   = '#aadd66';
      ctx.fillText(`$${displayMoney.toLocaleString()}`, cx, cy - lh * (hasEco ? 2.1 : 0));
      ctx.globalAlpha = 1.0;
    }

    if (hasEco) {
      const rfs = Math.round(12 * scale);

      const drawResRow = (y, icon, value, maxVal, baseColor, costKey, overrideDisplay = null) => {
        const cval = overrideDisplay !== null ? overrideDisplay : costOf(costKey);
        const hit  = cval !== null;

        // Low-resource warning
        const numMax  = typeof maxVal === 'number' ? maxVal : null;
        const isEmpty = value <= 0;
        const isLow   = !isEmpty && numMax !== null && (value / numMax) <= 0.20;
        const isWarn  = isEmpty || isLow;

        ctx.globalAlpha = (hasHover && !hit && !isWarn) ? 0.32 : 1.0;
        ctx.font        = `${rfs}px Arial`;

        let displayColor = hit ? '#ffffff' : baseColor;
        if (isEmpty)     displayColor = '#ff4422';
        else if (isLow)  displayColor = '#ffaa22';

        const prefix = isWarn ? '\u26A0 ' : '';
        ctx.fillStyle = displayColor;
        ctx.fillText(`${prefix}${icon} ${Math.floor(value)} / ${maxVal}`, cx - (hit ? Math.round(14 * scale) : 0), y);
        if (hit) {
          ctx.font      = `bold ${Math.round(11 * scale)}px Arial`;
          ctx.fillStyle = '#ff6644';
          ctx.fillText(`-${cval}`, cx + Math.round(24 * scale), y);
        }
        ctx.globalAlpha = 1.0;
      };

      // Fuel
      const maxFuel = eco.storageTiers?.fuel?.[eco.storageLevel?.fuel ?? 0] ?? '?';
      drawResRow(cy - lh * 0.85, '⛽', eco.fuel, maxFuel, '#ffaa33', 'fuel');

      // Retardant
      const maxRet = eco.storageTiers?.retardant?.[eco.storageLevel?.retardant ?? 0] ?? '?';
      drawResRow(cy + lh * 0.35, '🧯', eco.retardant, maxRet, '#ff8877', 'retardant');

      // Food — show "-1" only when the skill use will trigger auto-feed (fed drops to ≤75)
      const maxFood = eco.storageTiers?.food?.[eco.storageLevel?.food ?? 0] ?? '?';
      const foodSkillHovered = costOf('food') !== null;
      const willAutoFeed = foodSkillHovered && eco.food > 0 && (eco.crewFedStatus - 5) <= 75;
      drawResRow(cy + lh * 1.55, '🍞', eco.food, maxFood, '#88ddaa', null, willAutoFeed ? '1' : null);

      // Parts — show "-1" only when the skill use would drop durability to ≤0, triggering auto-repair
      const maxParts = eco.storageTiers?.parts?.[eco.storageLevel?.parts ?? 0] ?? '?';
      const durCostEntry = hCosts.find(c => c.key === 'dur' && !c.val.includes('/'));
      let willAutoRepair = false;
      if (durCostEntry && eco.parts > 0) {
        const assetId    = this.hoveredSkill ? this._skillKeyToAssetId(this.hoveredSkill) : '';
        const currentDur = eco.assetDurability?.[assetId] ?? 100;
        const durCostPts = parseFloat(durCostEntry.val); // e.g. '25%' → 25
        willAutoRepair   = (currentDur - durCostPts) <= 0;
      }
      drawResRow(cy + lh * 2.75, '🔧', eco.parts, maxParts, '#aabbdd', null, willAutoRepair ? '1' : null);
    }

    // Dismiss hint
    ctx.font      = `${Math.round(9 * scale)}px Arial`;
    ctx.fillStyle = '#2a3a55';
    ctx.fillText('ESC · MMB', cx, cy + lh * (hasEco ? 3.9 : 1.4));

    ctx.restore();
  }

  _getCooldownRemaining(skillKey) {
    const key = this._cooldownKeys[skillKey];
    return key ? (this.gameState[key] || 0) : 0;
  }

  _getSkillCosts(skillKey, subOpt = null) {
    const gs = this.gameState;
    const isDual = this._subSkills.has(skillKey);
    let useRet = false;
    if (isDual) {
      if (subOpt === 'retardant')  useRet = true;
      else if (subOpt === 'water') useRet = false;
      else useRet = skillKey === 1 ? !!gs.waterBomberUseRetardant
                                   : !!gs.heliDropUseRetardant;
    }
    switch (skillKey) {
      case 1: {
        const fuel = String(gs._hasUpgrade?.('bomberFuelEff') ? SC.waterBomber.fuelCostUpgraded : SC.waterBomber.fuelCostBase);
        const ret  = String(gs._hasUpgrade?.('bomberRetEff')  ? SC.waterBomber.retardantCostUpg  : SC.waterBomber.retardantCostBase);
        const dur  = `${gs._hasUpgrade?.('bomberDurability') ? SC.waterBomber.durabilityWearUpg : SC.waterBomber.durabilityWear}%`;
        return useRet
          ? [{ key:'fuel', icon:'⛽', val:fuel }, { key:'retardant', icon:'🧯', val:ret }, { key:'dur', icon:'🔧', val:dur }]
          : [{ key:'fuel', icon:'⛽', val:fuel }, { key:'dur', icon:'🔧', val:dur }];
      }
      case 2: {
        const fuel = String(gs._hasUpgrade?.('heliFuelEff') ? SC.heliDrop.fuelCostUpgraded : SC.heliDrop.fuelCostBase);
        const dur  = `${gs._hasUpgrade?.('heliDurability') ? SC.heliDrop.durabilityWearUpg : SC.heliDrop.durabilityWear}%`;
        const ret  = String(SC.heliDrop.retardantCost);
        return useRet
          ? [{ key:'fuel', icon:'⛽', val:fuel }, { key:'retardant', icon:'🧯', val:ret }, { key:'dur', icon:'🔧', val:dur }]
          : [{ key:'fuel', icon:'⛽', val:fuel }, { key:'dur', icon:'🔧', val:dur }];
      }
      case 3: return [{ key:'fuel', icon:'⛽', val:'/s' }, { key:'dur', icon:'🔧', val:'/s' }];
      case 4: return [{ key:'dur', icon:'🔧', val:`${SC.sprinklerTrailer.durabilityWear}%` }];
      case 5: return [{ key:'food', icon:'🍞', val:String(SC.fireWatch.foodWear) }];
      case 6: return [{ key:'food', icon:'🍞', val:String(SC.droneRecon.foodWear) }];
      case 7: return [{ key:'money', icon:'$', val:String(SC.reconPlane.moneyCost) }, { key:'dur', icon:'🔧', val:`${SC.reconPlane.durabilityWear}%` }];
      default: return [];
    }
  }

  _canAffordSkill(skillKey, subOpt = null) {
    const eco = this.gameState.economyState;
    if (!eco || this.gameState.isSkillFree?.()) return true;
    const gs = this.gameState;

    // Resolve retardant sub-option for dual skills (1 = bomber, 2 = heli)
    let useRet = false;
    if (this._subSkills?.has(skillKey)) {
      if      (subOpt === 'retardant') useRet = true;
      else if (subOpt === 'water')     useRet = false;
      else useRet = skillKey === 1 ? !!gs.waterBomberUseRetardant : !!gs.heliDropUseRetardant;
    }

    switch (skillKey) {
      case 1: {
        const fuelCost = gs._hasUpgrade?.('bomberFuelEff') ? SC.waterBomber.fuelCostUpgraded : SC.waterBomber.fuelCostBase;
        if (eco.fuel < fuelCost) return false;
        if (useRet) {
          const retCost = gs._hasUpgrade?.('bomberRetEff') ? SC.waterBomber.retardantCostUpg : SC.waterBomber.retardantCostBase;
          if (eco.retardant < retCost) return false;
        }
        return true;
      }
      case 2: {
        const fuelCost = gs._hasUpgrade?.('heliFuelEff') ? SC.heliDrop.fuelCostUpgraded : SC.heliDrop.fuelCostBase;
        if (eco.fuel < fuelCost) return false;
        if (useRet && eco.retardant < SC.heliDrop.retardantCost) return false;
        return true;
      }
      case 3: return eco.fuel > 0;  // bulldozer — per-second drain; blocked when completely out of fuel
      case 4: return true;  // sprinkler — no hard resource gate
      case 5:
      case 6: return !(eco.crewFedStatus <= 0 && eco.food <= 0);
      case 7: return eco.money >= SC.reconPlane.moneyCost;
      default: return true;
    }
  }

  _skillKeyToAssetId(skillKey) {
    const map = {
      1: 'waterBomber', 2: 'helicopter', 3: 'bulldozer',
      4: 'sprinklerTrailer', 5: 'watchTower', 6: 'droneRecon',
      7: 'reconPlane',
    };
    return map[skillKey] ?? '';
  }
}
