export class SkillHotbarHUD {
  constructor({ gameState }) {
    this.gameState = gameState;
    
    // HUD positioning (base values)
    this.basePadding = 10;
    this.baseButtonSize = 60;
    this.baseGap = 8;
    this.baseBottomMargin = 15;
    
    // Skill display order — keyboard skills left to right, then mouse-hold skills (Fire Crew, Fire Truck) after a gap
    this.skillKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    this.mouseSkillStart = 7;   // index in skillKeys where mouse-hold pair begins
    this.baseMouseGroupGap = 28; // extra separation before mouse-hold group

    // Cooldown durations map
    this.cooldownDurations = {
      1: { duration: 8,  key: 'waterBomberCooldown' },
      2: { duration: 4,  key: 'heliDropCooldown' },
      3: { duration: 0,  key: null }, // Bulldozer uses energy system
      4: { duration: 12, key: 'workerCrewCooldown' },
      5: { duration: 10, key: 'watchTowerCooldown' },
      6: { duration: 10, key: 'droneReconCooldown' },
      7: { duration: 20, key: 'reconPlaneCooldown' },
      8: { duration: 0,  key: null }, // Fire Crew uses energy system, no cooldown timer
      9: { duration: 0,  key: null }, // Fire Truck uses durability wear, no cooldown
    };
  }

  handlePointerDown(x, y) {
    // Check if click is on any skill button
    const canvasWidth = this.gameState.viewport.width || 1280;
    const canvasHeight = this.gameState.viewport.height || 720;
    const scale = Math.min(canvasWidth / 1280, canvasHeight / 720, 2);

    const buttonSize = Math.max(40, Math.round(this.baseButtonSize * scale));
    const gap = Math.max(6, Math.round(this.baseGap * scale));
    const bottomMargin = Math.max(10, Math.round(this.baseBottomMargin * scale));
    const mouseGroupGap = Math.max(18, Math.round(this.baseMouseGroupGap * scale));
    const mouseStart = this.mouseSkillStart;
    const skillCount = this.skillKeys.length;
    const totalWidth = (buttonSize * skillCount) + (gap * (skillCount - 1)) + mouseGroupGap;

    // Calculate HUD position (centered at bottom)
    const hudX = (canvasWidth - totalWidth) / 2;
    const hudY = canvasHeight - buttonSize - bottomMargin;
    
    for (let i = 0; i < this.skillKeys.length; i++) {
      const skillKey = this.skillKeys[i];
      const extraOffset = i >= mouseStart ? mouseGroupGap : 0;
      const buttonX = hudX + (i * (buttonSize + gap)) + extraOffset;
      const buttonY = hudY;
      
      if (x >= buttonX && x < buttonX + buttonSize &&
          y >= buttonY && y < buttonY + buttonSize) {
        // Activate the skill
        this.activateSkill(skillKey);
        return true;
      }
    }
    return false;
  }

  activateSkill(skillKey) {
    // Cancel all other active skills first
    if (skillKey !== 1) {
      this.gameState.waterBomberMode = null;
      this.gameState.waterBomberStart = null;
      this.gameState.waterBomberPreview = null;
    }
    if (skillKey !== 2) {
      this.gameState.heliDropMode = false;
    }
    if (skillKey !== 3) {
      this.gameState.bulldozerActive = false;
    }
    if (skillKey !== 4) {
      this.gameState.workerCrewMode = false;
    }
    if (skillKey !== 5) {
      this.gameState.watchTowerMode = false;
    }
    if (skillKey !== 6) {
      this.gameState.droneReconMode = false;
      this.gameState.droneReconMoving = false;
    }
    if (skillKey !== 7) {
      this.gameState.reconPlaneMode = false;
    }
    // Fire crew (key 8) is always active via LMB — no mode flag to cancel
    if (skillKey !== 9) {
      this.gameState.engineTruckMode = false;
    }

    // Water Bomber (key 1): activate targeting directly
    if (skillKey === 1) {
      if (this.gameState.waterBomberCooldown > 0) {
        this.gameState.skillMessage = `Water Bomber cooldown: ${this.gameState.waterBomberCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const bomberCost = this.gameState.getSkillCost(this.gameState.skills[1]);
      if (this.gameState.money < bomberCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.waterBomberMode = "selectStart";
      this.gameState.skillMessage = "Click start point for strafe";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Heli Drop (key 2): activate targeting mode
    if (skillKey === 2) {
      if (this.gameState.heliDropCooldown > 0) {
        this.gameState.skillMessage = `Heli Drop cooldown: ${this.gameState.heliDropCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const heliCost = this.gameState.getSkillCost(this.gameState.skills[2]);
      if (this.gameState.money < heliCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.heliDropMode = !this.gameState.heliDropMode;
      this.gameState.skillMessage = this.gameState.heliDropMode ? "Click to drop" : "Heli Drop canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Bulldozer (key 3): toggle active mode (fuel-based)
    if (skillKey === 3) {
      if (this.gameState.economyState && !this.gameState.isSkillFree() && this.gameState.economyState.fuel <= 0) {
        this.gameState.skillMessage = "Bulldozer out of fuel";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.bulldozerActive = !this.gameState.bulldozerActive;
      this.gameState.skillMessage = this.gameState.bulldozerActive ? "Bulldozer ACTIVE" : "Bulldozer deactivated";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Sprinkler Trailer (key 4): activate targeting mode
    if (skillKey === 4) {
      if (this.gameState.workerCrewCooldown > 0) {
        this.gameState.skillMessage = `Sprinkler Trailer cooldown: ${this.gameState.workerCrewCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const sprinklerCost = this.gameState.getSkillCost(this.gameState.skills[4]);
      if (this.gameState.money < sprinklerCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.workerCrewMode = !this.gameState.workerCrewMode;
      this.gameState.skillMessage = this.gameState.workerCrewMode ? "Click to deploy" : "Sprinkler Trailer canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Fire Watch (key 5): activate targeting mode
    if (skillKey === 5) {
      if (this.gameState.watchTowerCooldown > 0) {
        this.gameState.skillMessage = `Fire Watch cooldown: ${this.gameState.watchTowerCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const watchCost = this.gameState.getSkillCost(this.gameState.skills[5]);
      if (this.gameState.money < watchCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.watchTowerMode = !this.gameState.watchTowerMode;
      this.gameState.skillMessage = this.gameState.watchTowerMode ? "Click to place Fire Watch" : "Fire Watch canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Drone Recon (key 6): deploy drone
    if (skillKey === 6) {
      if (this.gameState.droneReconCooldown > 0) {
        this.gameState.skillMessage = `Drone Recon cooldown: ${this.gameState.droneReconCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      if (this.gameState.droneReconMode) {
        this.gameState.droneReconMode = false;
        this.gameState.skillMessage = "Drone Recon canceled";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.droneReconMode = true;
      this.gameState.skillMessage = "Click to deploy Drone Recon";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Recon Plane (key 7): reveal large area on minimap
    if (skillKey === 7) {
      if (this.gameState.reconPlaneCooldown > 0) {
        this.gameState.skillMessage = `Recon Plane cooldown: ${this.gameState.reconPlaneCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      if (this.gameState.reconPlaneMode) {
        this.gameState.reconPlaneMode = false;
        this.gameState.skillMessage = "Recon Plane canceled";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.reconPlaneMode = true;
      this.gameState.skillMessage = "Click to deploy Recon Plane";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Fire Crew (key 8): show status info (always-on left click tool)
    if (skillKey === 8) {
      const pct = this.gameState.getFireCrewEnergyPercent?.() ?? 1;
      this.gameState.skillMessage = pct > 0
        ? `Fire Crew: ${Math.round(pct * 100)}% stamina — hold left click to cut`
        : "Fire Crew exhausted — rest to recover";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Fire Truck (key 9): show status (right-click hold IS the truck)
    if (skillKey === 9) {
      const dur = Math.round(this.gameState.economyState?.assetDurability?.engineTruck ?? 100);
      if (dur <= 0) {
        this.gameState.skillMessage = "Fire Truck: BROKEN — repair at base";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.skillMessage = `Fire Truck: ${dur}% durability — hold right-click to suppress`;
      this.gameState.skillMessageTimer = 2;
      return;
    }
  }

  getCooldownRemaining(skillKey) {
    const cooldownData = this.cooldownDurations[skillKey];
    if (!cooldownData || !cooldownData.key) return 0;
    
    const cooldown = this.gameState[cooldownData.key] || 0;
    return cooldown;
  }

  getCooldownProgress(skillKey) {
    const remaining = this.getCooldownRemaining(skillKey);
    const duration = this.cooldownDurations[skillKey].duration;
    
    if (duration === 0) return 0; // No cooldown
    return Math.max(0, 1 - (remaining / duration));
  }

  render(ctx) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const scale = Math.min(canvasWidth / 1280, canvasHeight / 720, 2);

    const buttonSize = Math.max(40, Math.round(this.baseButtonSize * scale));
    const gap = Math.max(6, Math.round(this.baseGap * scale));
    const bottomMargin = Math.max(10, Math.round(this.baseBottomMargin * scale));
    const mouseGroupGap = Math.max(18, Math.round(this.baseMouseGroupGap * scale));
    const mouseStart = this.mouseSkillStart;
    const skillCount = this.skillKeys.length;
    const totalWidth = (buttonSize * skillCount) + (gap * (skillCount - 1)) + mouseGroupGap;

    // Calculate HUD position (centered at bottom)
    const hudX = (canvasWidth - totalWidth) / 2;
    const hudY = canvasHeight - buttonSize - bottomMargin;
    
    // Draw each skill button
    for (let i = 0; i < this.skillKeys.length; i++) {
      const skillKey = this.skillKeys[i];
      const extraOffset = i >= mouseStart ? mouseGroupGap : 0;
      const buttonX = hudX + (i * (buttonSize + gap)) + extraOffset;
      const buttonY = hudY;
      
      this._drawButton(ctx, buttonX, buttonY, skillKey, buttonSize, scale);
    }
  }

  _drawButton(ctx, x, y, skillKey, buttonSize, scale) {
    const skill = this.gameState.skills[skillKey];
    if (!skill) return;
    
    const isSelected = this.gameState.selectedSkillKey === skillKey;
    const cooldownRemaining = this.getCooldownRemaining(skillKey);
    const onCooldown = cooldownRemaining > 0.01;

    // Check economy lock state (asset not unlocked, 0 durability, or crew unavailable)
    const isLocked = !this.gameState.isSkillFree() && this.gameState.economyState &&
      !this.gameState._isAssetUnlocked(this._skillKeyToAssetId(skillKey));
    const isCrewSkill = skillKey === 5 || skillKey === 6 || skillKey === 8; // Fire Watch, Drone Recon, Fire Crew
    const hasDurability = [1, 2, 3, 4, 7, 9].includes(skillKey); // Assets with durability tracking
    const isDisabled = !isLocked && !this.gameState.isSkillFree() && this.gameState.economyState && (
      isCrewSkill
        ? !this.gameState.economyState.isCrewAvailable()
        : hasDurability && !this.gameState.economyState.isAssetAvailable(this._skillKeyToDurabilityId(skillKey))
    );
    
    // Check retardant mode for skills 1 (Water Bomber) and 2 (Heli Drop)
    const isRetardant = (skillKey === 1 && this.gameState.waterBomberUseRetardant && this.gameState.waterBomberMode) ||
      (skillKey === 2 && this.gameState.heliDropUseRetardant && this.gameState.heliDropMode);

    // Check resource availability for warning indicator
    const lowResources = !isLocked && !isDisabled && this._hasInsufficientResources(skillKey);
    
    // Background
    ctx.fillStyle = isRetardant ? '#4a1800' : isSelected ? '#00ff00' : '#333333';
    ctx.strokeStyle = isRetardant ? '#ff6600' : isSelected ? '#00ff00' : '#666666';
    ctx.lineWidth = Math.max(1, Math.round((isSelected || isRetardant ? 3 : 2) * scale));
    ctx.fillRect(x, y, buttonSize, buttonSize);
    ctx.strokeRect(x, y, buttonSize, buttonSize);
    
    // Handle bulldozer active indicator (skill 3)
    if (skillKey === 3 && this.gameState.bulldozerActive) {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.2)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
    }
    // Fire crew is always the left-click tool — highlight when holding left
    if (skillKey === 8 && this.gameState.player?.left) {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.2)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
    }
    // Fire Truck is the right-click tool — highlight when holding right
    if (skillKey === 9 && this.gameState.player?.right) {
      ctx.fillStyle = 'rgba(255, 120, 60, 0.25)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
    }

    // Fire crew energy bar (skill 8) — drawn above the feed bar
    if (skillKey === 8) {
      const energyPct = this.gameState.getFireCrewEnergyPercent?.() ?? 1;
      if (energyPct < 1) {
        const barW = buttonSize - 6;
        const barH = Math.max(4, Math.round(5 * scale));
        const barX = x + 3;
        const barY = y + buttonSize - 2 * barH - 4; // above feed bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        const eColor = energyPct > 0.5 ? '#ffcc00' : energyPct > 0.25 ? '#ff8800' : '#ff2200';
        ctx.fillStyle = eColor;
        ctx.fillRect(barX, barY, barW * energyPct, barH);
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    }

    // Bulldozer energy bar (skill 3) — drawn above the durability bar
    if (skillKey === 3) {
      const energyPct = this.gameState.getBulldozerEnergyPercent?.() ?? 1;
      if (energyPct < 1) {
        const barW = buttonSize - 6;
        const barH = Math.max(4, Math.round(5 * scale));
        const barX = x + 3;
        const barY = y + buttonSize - 2 * barH - 4; // above durability bar
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        // Fill
        const eColor = energyPct > 0.5 ? '#ffcc00' : energyPct > 0.25 ? '#ff8800' : '#ff2200';
        ctx.fillStyle = eColor;
        ctx.fillRect(barX, barY, barW * energyPct, barH);
        // Border
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    }

    // Durability bar for all vehicle/aircraft skills (keys 1, 2, 3, 4, 7, 9)
    if ([1, 2, 3, 4, 7, 9].includes(skillKey) && this.gameState.economyState) {
      const assetId = this._skillKeyToDurabilityId(skillKey);
      const durPct = Math.min(1, Math.max(0, (this.gameState.economyState.assetDurability?.[assetId] ?? 100) / 100));
      if (durPct < 1) {
        const barW = buttonSize - 6;
        const barH = Math.max(4, Math.round(5 * scale));
        const barX = x + 3;
        const barY = y + buttonSize - barH - 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        const dColor = durPct > 0.5 ? '#44aaff' : durPct > 0.25 ? '#ff8800' : '#ff2200';
        ctx.fillStyle = dColor;
        ctx.fillRect(barX, barY, barW * durPct, barH);
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    }

    // Feed (crewFedStatus) bar for crew skills (keys 5, 6, 8) — always at bottom
    if ([5, 6, 8].includes(skillKey) && this.gameState.economyState) {
      const fed = (this.gameState.economyState.crewFedStatus ?? 100) / 100;
      if (fed < 1) {
        const barW = buttonSize - 6;
        const barH = Math.max(4, Math.round(5 * scale));
        const barX = x + 3;
        const barY = y + buttonSize - barH - 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        const fColor = fed > 0.5 ? '#88dd44' : fed > 0.25 ? '#ffcc00' : '#ff3300';
        ctx.fillStyle = fColor;
        ctx.fillRect(barX, barY, barW * fed, barH);
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    }
    
    {
      // Cooldown overlay for skills (recedes from bottom to top)
      if (onCooldown) {
        const progress = this.getCooldownProgress(skillKey);
        const overlayHeight = buttonSize * (1 - progress);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        // Draw from bottom of button upward
        ctx.fillRect(x, y + buttonSize - overlayHeight, buttonSize, overlayHeight);
      }
      
      // Cooldown radial indicator (circular progress)
      if (onCooldown) {
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = Math.max(1, Math.round(3 * scale));
        ctx.beginPath();
        const centerX = x + buttonSize / 2;
        const centerY = y + buttonSize / 2;
        const radius = buttonSize / 2 - 5 * scale;
        const startAngle = -Math.PI / 2;
        const progress = this.getCooldownProgress(skillKey);
        const endAngle = startAngle + (Math.PI * 2 * progress);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();
      }
      
      // Only show name and cost when NOT on cooldown
      if (!onCooldown) {
        // Skill icon/name area
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Get short name (first letter or abbreviation)
        let shortName = skill.name === "Fire Watch" ? "FIW" : skill.name === "Fire Truck" ? "FTR" : skill.name.substring(0, 3).toUpperCase();
        ctx.fillText(shortName, x + buttonSize / 2, y + buttonSize / 2 - 10 * scale);
        
        // Cost — show actual resource cost in economy mode, money cost otherwise
        ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const costLabel = this._getCostLabel(skillKey);
        ctx.fillStyle = costLabel.color;
        ctx.fillText(costLabel.text, x + buttonSize / 2, y + buttonSize / 2 + 10 * scale);
      } else {
        // Cooldown timer text centered and large (when on cooldown)
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${Math.max(12, Math.round(16 * scale))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cooldownText = cooldownRemaining.toFixed(1);
        ctx.fillText(cooldownText, x + buttonSize / 2, y + buttonSize / 2);
      }

      // Crew skill charge display (top of card)
      if (isCrewSkill) {
        const chargeData = this._getCrewCharges(skillKey);
        if (chargeData) {
          const { charges, maxCharges, rechargeTimer } = chargeData;
          const isDeferred = skillKey === 8 && this.gameState.fireCrewDeferredCount > 0;
          const deferredCount = skillKey === 8 ? (this.gameState.fireCrewDeferredCount || 0) : 0;
          // Draw charge pips at top of card
          const pipSize = Math.max(6, Math.round(8 * scale));
          const pipGap = Math.max(2, Math.round(3 * scale));
          const pipsStartX = x + 3 * scale;
          const pipsY = y + 3 * scale;
          for (let p = 0; p < maxCharges; p++) {
            const px = pipsStartX + p * (pipSize + pipGap);
            if (p < charges) {
              ctx.fillStyle = '#00ff88';
            } else if (isDeferred && p >= maxCharges - deferredCount) {
              // Pulsing orange pip for deferred charges (crew still working)
              const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
              ctx.fillStyle = `rgba(255, 160, 40, ${pulse})`;
            } else if (p < maxCharges - deferredCount) {
              // Grey pip with timer tint for slots actively recharging
              ctx.fillStyle = 'rgba(136, 255, 170, 0.4)';
            } else {
              ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
            }
            ctx.fillRect(px, pipsY, pipSize, pipSize);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(px, pipsY, pipSize, pipSize);
          }
          // Show recharge timer below pips (left-aligned, top area)
          if (charges < maxCharges) {
            ctx.font = `${Math.max(7, Math.round(9 * scale))}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const emptySlots = maxCharges - charges - deferredCount;
            if (emptySlots > 0 && rechargeTimer > 0) {
              ctx.fillStyle = '#88ffaa';
              ctx.fillText(`${rechargeTimer.toFixed(1)}s`, x + 3 * scale, y + pipSize + 5 * scale);
            } else if (isDeferred) {
              const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 500);
              ctx.fillStyle = `rgba(255, 160, 40, ${pulse})`;
              ctx.fillText('work', x + 3 * scale, y + pipSize + 5 * scale);
            }
          }
        }
      }
    }
    
    // Lock / disabled overlay
    if (isLocked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
      ctx.fillStyle = '#ff4444';
      ctx.font = `bold ${Math.max(10, Math.round(14 * scale))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOCKED', x + buttonSize / 2, y + buttonSize / 2);
    } else if (isDisabled) {
      ctx.fillStyle = 'rgba(80, 0, 0, 0.5)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
      ctx.fillStyle = '#ff6600';
      ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCrewSkill ? 'HUNGRY' : 'BROKEN', x + buttonSize / 2, y + buttonSize / 2);
    } else if (lowResources) {
      // Resource warning — pulsing orange border + "LOW" badge
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.strokeStyle = `rgba(255, 136, 0, ${pulse})`;
      ctx.lineWidth = Math.max(3, Math.round(4 * scale));
      ctx.strokeRect(x + 1, y + 1, buttonSize - 2, buttonSize - 2);
      // "LOW" background pill
      const lowW = Math.max(26, Math.round(34 * scale));
      const lowH = Math.max(12, Math.round(14 * scale));
      const lowX = x + (buttonSize - lowW) / 2;
      const lowY = y + buttonSize - lowH - 2 * scale;
      ctx.fillStyle = `rgba(255, 68, 0, ${0.7 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.roundRect(lowX, lowY, lowW, lowH, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOW', x + buttonSize / 2, lowY + lowH / 2);
    }

    // Hotkey label (top-right corner) - always on top
    // Mouse-hold skills show their mouse button instead of a number
    const hotkeyLabel = skillKey === 8 ? 'LMB' : skillKey === 9 ? 'RMB' : String(skillKey);
    ctx.fillStyle = skillKey === 8 || skillKey === 9 ? '#88ddff' : '#ffff00';
    ctx.font = skillKey === 8 || skillKey === 9
      ? `bold ${Math.max(8, Math.round(10 * scale))}px Arial`
      : `bold ${Math.max(10, Math.round(14 * scale))}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(hotkeyLabel, x + buttonSize - 4 * scale, y + 3 * scale);

    // Retardant badge (top-left corner) when retardant is active
    if (isRetardant) {
      const badgeSize = Math.max(14, Math.round(18 * scale));
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(x + 1, y + 1, badgeSize, badgeSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.round(12 * scale))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', x + 1 + badgeSize / 2, y + 1 + badgeSize / 2);
    }
  }

  // Get the cost label text and color for a skill button
  _getCostLabel(skillKey) {
    const gs = this.gameState;
    const e = gs.economyState;
    const isFree = gs.isSkillFree();

    // Free/training mode — no costs
    if (isFree) return { text: 'FREE', color: '#88ff88' };

    // Economy mode — show actual resource costs
    if (e) {
      switch (skillKey) {
        case 1: { // Water Bomber — fuel
          const fuel = gs._hasUpgrade?.("bomberFuelEff") ? 6 : 8;
          return { text: `${fuel} Fuel`, color: '#ffaa44' };
        }
        case 2: { // Heli Drop — fuel
          const fuel = gs._hasUpgrade?.("heliFuelEff") ? 4 : 5;
          return { text: `${fuel} Fuel`, color: '#ffaa44' };
        }
        case 3: { // Bulldozer — fuel/tick
          return { text: 'Fuel/s', color: '#ffaa44' };
        }
        case 4: { // Sprinkler Trailer — durability wear
          const wear = gs._hasUpgrade?.("vehicleWear1") ? 1 : 2;
          return { text: `${wear} Wear`, color: '#ff8888' };
        }
        case 5: // Fire Watch — feed
        case 6: // Drone Recon — feed
        case 8: // Fire Crew — feed
          return { text: '5% Feed', color: '#88ddff' };
        case 7: // Recon Plane — money
          return { text: '$2,000', color: '#ffff00' };
        case 9: // Fire Truck — durability/sec
          return { text: 'Dur/s', color: '#ff8844' };
      }
    }

    // Fallback: no economy, show money cost
    const cost = gs.getSkillCost(gs.skills[skillKey]);
    if (cost <= 0) return { text: 'FREE', color: '#88ff88' };
    return { text: `$${cost}`, color: '#ffff00' };
  }

  // Map skill key to asset ID used by _isAssetUnlocked
  _skillKeyToAssetId(skillKey) {
    const map = { 1: "waterBomber", 2: "heliDrop", 3: "bulldozer", 4: "sprinklerTrailer", 5: "fireWatch", 6: "droneRecon", 7: "reconPlane", 8: "fireCrew", 9: "engineTruck" };
    return map[skillKey] ?? "";
  }

  // Get crew charges info for a skill key
  _getCrewCharges(skillKey) {
    const gs = this.gameState;
    if (skillKey === 5) return { charges: gs.watchTowerCharges, maxCharges: gs.watchTowerMaxCharges, rechargeTimer: gs.watchTowerRechargeTimer };
    if (skillKey === 6) return { charges: gs.droneReconCharges, maxCharges: gs.droneReconMaxCharges, rechargeTimer: gs.droneReconRechargeTimer };
    if (skillKey === 8) return { charges: gs.fireCrewCharges, maxCharges: gs.fireCrewMaxCharges, rechargeTimer: gs.fireCrewRechargeTimer };
    return null;
  }

  // Map skill key to durability ID used by EconomyState.isAssetAvailable
  // Skills 5, 6, 7 (Fire Watch, Fire Crew, Drone Recon) are crew-type and use crewFedStatus instead
  _skillKeyToDurabilityId(skillKey) {
    const map = { 1: "waterBomber", 2: "helicopter", 3: "bulldozer", 4: "sprinklerTrailer", 7: "reconPlane", 9: "engineTruck" };
    return map[skillKey] ?? "";
  }

  // Check if a skill cannot be used due to insufficient resources
  _hasInsufficientResources(skillKey) {
    const gs = this.gameState;
    const e = gs.economyState;
    if (!e || gs.isSkillFree()) return false;

    if (skillKey === 1) {
      // Water Bomber: fuel + optional retardant
      const fuelCost = gs._hasUpgrade?.("bomberFuelEff") ? 6 : 8;
      if (e.fuel < fuelCost) return true;
      if (gs.waterBomberUseRetardant) {
        const retCost = gs._hasUpgrade?.("bomberRetEff") ? 3 : 4;
        if (e.retardant < retCost) return true;
      }
    }
    if (skillKey === 2) {
      // Heli Drop: fuel + optional retardant
      const fuelCost = gs._hasUpgrade?.("heliFuelEff") ? 4 : 5;
      if (e.fuel < fuelCost) return true;
      if (gs.heliDropUseRetardant && e.retardant < 2) return true;
    }
    if (skillKey === 3) {
      // Bulldozer: fuel (needs at least 1)
      if (e.fuel < 1) return true;
    }
    if (skillKey === 7) {
      // Recon Plane: money
      if (e.money < 2000) return true;
    }
    if (skillKey === 9) {
      // Fire Truck: warn when durability is getting low
      if ((e.assetDurability?.engineTruck ?? 100) < 20) return true;
    }
    return false;
  }
}
