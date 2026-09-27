/**
 * BaseScreen — The firefighting base hub.
 * Shows buildings (facilities), resource summary, and the path to missions.
 * Flow: Main Menu → Base → Mission Select
 */
export class BaseScreen {
  constructor({ backgroundImage, economyState, onNavigate, onBack, missions = [], onSelectMission }) {
    this.backgroundImage = backgroundImage;
    this.economy = economyState;
    this.onNavigate = onNavigate; // "missions" → region map
    this.onBack = onBack;         // back → main menu
    this.missions = missions;
    this.onSelectMission = onSelectMission;

    // Interaction state
    this.hoveredBuilding = null;
    this.selectedBuilding = null;
    this.isMissionsHover = false;
    this.isBackHover = false;
    this.isUpgradeHover = false;

    // Resource shop button hover states
    this.shopHover = {};
    this._shopBtns = {};

    // Repair button hover states
    this.repairHover = {};
    this._repairBtns = {};

    // Panel close button
    this.isCloseHover = false;
    this._closeBtn = null;

    // Upgrades button + tab state
    this.isUpgradesHover = false;
    this._upgradesBtnRect = null;
    this._upgradesPanelOpen = false;
    this._tabRects = {};
    this._tabHover = null;

    // Panel rect (for absorbing clicks inside the panel area)
    this._panelRect = null;

    // Feed crew button
    this.feedCrewHover = false;
    this._feedCrewBtn = null;

    // Individual upgrade item hover + button rects
    this.upgradeItemHover = null;
    this._upgradeBtns = {};

    // Skill unlock button hover + rects
    this.skillUnlockHover = null;
    this._skillUnlockBtns = {};
    this._skillRowRects   = {};

    // Maintenance panel state
    this._maintenanceBtn       = null;
    this._maintenancePanelOpen = false;
    this._maintenancePanelRect = null;
    this._maintenanceCloseBtn  = null;
    this.isMaintenanceHover      = false;
    this.isMaintenanceCloseHover = false;

    // Storage panel state
    this._storageBtn             = null;
    this._storagePanelOpen       = false;
    this._storagePanelRect       = null;
    this._storageCloseBtn        = null;
    this.isStorageHover          = false;
    this.isStorageCloseHover     = false;

    // Missions panel state
    this._missionsPanelOpen        = true;
    this._missionsPanelRect        = null;
    this._missionsPanelCloseBtn    = null;
    this._missionScrollOffset      = 0;
    this._missionsPanelScrollAreaY = 0;
    this._missionsPanelScrollAreaH = 0;
    this.isMissionsCloseHover      = false;
    this._missionsHoveredId        = null;
    this._missionBtns              = {};

    // Panel scroll state
    this._panelScrollOffset           = 0;
    this._panelScrollAreaY            = 0;
    this._panelScrollAreaH            = 0;
    this._maintenanceScrollOffset     = 0;
    this._maintenancePanelScrollAreaY = 0;
    this._maintenancePanelScrollAreaH = 0;
    this._storageScrollOffset         = 0;
    this._storagePanelScrollAreaY     = 0;
    this._storagePanelScrollAreaH     = 0;

    // Tooltip state
    this._tooltipText = null;
    this._tooltipX = 0;
    this._tooltipY = 0;
    this.resourceHover = null;



    // Tree layout — positions as fractions of canvas (set at render time)
    this.buildingKeys = [
      "commandCenter",
      "crewFacilities",
      "vehicleBay",
      "helipad",
    ];

    // ── Layout config ──
    // All positions are fractions of canvas width (x) and height (y).
    // Adjust these to position elements relative to the background image.
    this.layout = {
      // Money card
      moneyCard: { x: 0.525, y: 0.62, w: 0.191, h: 0.052 },

      // All buttons — left side, vertically centered
      missionsButton:    { x: 0.12, y: 0.30 },

      maintenanceButton: { x: 0.12, y: 0.40 },
      storageButton:     { x: 0.12, y: 0.50 },
      upgradesButton:    { x: 0.12, y: 0.60 },
      backButton:        { x: 0.12, y: 0.70 },

      // Resource bar
      resourceBar: { x: 0.5, y: 0.04 },

      // Selected facility panel
      facilityPanel: { x: 0.5, y: 0.14 },  // x = center, y = top
    };
  }

  onEnter(payload) {
    this.selectedBuilding = null;
    this.hoveredBuilding = null;
    this._upgradesPanelOpen = false;
    if (payload?.openMissions) {
      this._missionsPanelOpen  = true;
      this._maintenancePanelOpen = false;
      this._storagePanelOpen   = false;
    }
  }

  update() {}

  // ── Rendering ──

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // Background
    if (this.backgroundImage?.complete && this.backgroundImage.naturalWidth) {
      ctx.drawImage(this.backgroundImage, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#1a2a1a";
      ctx.fillRect(0, 0, w, h);
    }

    // Dim overlay so UI is readable
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w / 1280, h / 720, 2);

    this._drawResourceBar(ctx, w, h, scale);
    this._drawUpgradesButton(ctx, w, h, scale);
    this._drawStorageButton(ctx, w, h, scale);
    this._drawMissionsButton(ctx, w, h, scale);
    this._drawBackButton(ctx, w, h, scale);

    this._drawMaintenanceButton(ctx, w, h, scale);
    if (this._upgradesPanelOpen) this._drawUpgradesPanel(ctx, w, h, scale);
    if (this._maintenancePanelOpen) this._drawMaintenancePanel(ctx, w, h, scale);
    if (this._storagePanelOpen)     this._drawStoragePanel(ctx, w, h, scale);
    if (this._missionsPanelOpen)    this._drawMissionsPanel(ctx, w, h, scale);
    this._drawTooltip(ctx, w, h, scale);
  }

  // ── Money card ──

  _drawMoneyCard(ctx, w, h, scale) {
    const L = this.layout.moneyCard;
    const cx = Math.round(L.x * w);
    const cy = Math.round(L.y * h);
    const cw = Math.round(L.w * w);
    const ch = Math.round(L.h * h);
    const x = cx - cw / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.strokeStyle = "rgba(255, 200, 50, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, cy, cw, ch, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fc4";
    ctx.font = `bold ${Math.max(14, Math.round(18 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`$ ${Math.floor(this.economy.money).toLocaleString()}`, cx, cy + ch / 2);
  }

  // ── Resource bar ──

  _drawResourceBar(ctx, w, h, scale) {
    const e     = this.economy;
    const items = [
      { label: "$",         value: Math.floor(e.money),      cap: 0,              color: "#fc4",  isMoney: true },
      { label: "Fuel",      value: Math.floor(e.fuel),       cap: e.fuelCap,      color: "#f90" },
      { label: "Retardant", value: Math.floor(e.retardant),  cap: e.retardantCap, color: "#f44" },
      { label: "Food",      value: Math.floor(e.food),       cap: e.foodCap,      color: "#4c4" },
      { label: "Parts",     value: Math.floor(e.parts),      cap: e.partsCap,     color: "#88f" },
    ];

    const barH   = Math.max(28, Math.round(36 * scale));
    const barW   = Math.max(600, Math.round(820 * scale));
    const barX   = Math.round(this.layout.resourceBar.x * w) - barW / 2;
    const barY   = Math.round(this.layout.resourceBar.y * h) - barH / 2;
    const pad    = Math.max(6, Math.round(10 * scale));
    const cellW  = Math.floor((barW - pad * (items.length + 1)) / items.length);
    const radius = 8;

    // Fill-bar inner padding so bars sit inside the container
    const fbPad = Math.max(4, Math.round(5 * scale));
    const fbH   = barH - fbPad * 2;
    const fbY   = barY + fbPad;

    // Container
    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, radius + 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle   = "rgba(10,10,10,0.75)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, radius + 2); ctx.fill(); ctx.stroke();

    for (let i = 0; i < items.length; i++) {
      const r   = items[i];
      const cx  = barX + pad + i * (cellW + pad);
      const fill = (!r.isMoney && r.cap > 0) ? Math.min(1, r.value / r.cap) : 0;

      // Cell bg
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.roundRect(cx, fbY, cellW, fbH, radius - 2); ctx.fill();

      // Fill bar
      if (fill > 0) {
        ctx.fillStyle = r.color + "44";
        ctx.beginPath(); ctx.roundRect(cx, fbY, Math.round(cellW * fill), fbH, radius - 2); ctx.fill();
      }

      // Label
      ctx.fillStyle    = r.color;
      ctx.font         = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(r.label, cx + 8, barY + barH / 2);

      // Value
      ctx.fillStyle    = r.isMoney ? "#fc4" : r.value >= r.cap ? "#8f8" : "#ddd";
      ctx.font         = r.isMoney
        ? `bold ${Math.max(10, Math.round(13 * scale))}px Arial`
        : `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        r.isMoney ? r.value.toLocaleString() : `${r.value}/${r.cap}`,
        cx + cellW - 6, barY + barH / 2
      );
    }
  }

  // ── Tree cards ──

  _getBuildingRect(key, w, h, scale) {
    const bL  = this.layout.buildings;
    const pos = bL?.[key];
    if (!pos) {
      // Building buttons removed — fall back to Upgrades button rect for tutorial highlights
      return this._upgradesBtnRect ?? { x: 0, y: 0, w: 0, h: 0 };
    }
    const cardW = Math.max(140, Math.round(200 * scale));
    const cardH = Math.max(36,  Math.round(48  * scale));
    const x = Math.round(pos.x * w) - cardW / 2;
    const y = Math.round(pos.y * h) - cardH / 2;
    return { x, y, w: cardW, h: cardH };
  }

  _drawBuildings(ctx, w, h, scale) {
    for (const key of this.buildingKeys) {
      const rect = this._getBuildingRect(key, w, h, scale);
      const info = this.economy.buildingInfo[key];
      const available = this.economy.isBuildingAvailable(key);
      const isHovered = this.hoveredBuilding === key;
      const isSelected = this.selectedBuilding === key;

      // Accent colour — amber for selected, green for hovered, dim for idle
      const accentSel  = "rgba(255, 200, 50, 0.5)";
      const accentHov  = available ? "rgba(0, 255, 64, 0.5)"  : "rgba(120, 120, 120, 0.35)";
      const accentNorm = available ? "rgba(0, 255, 64, 0.25)"  : "rgba(80,  80,  80,  0.2)";
      const glowColor  = isSelected ? accentSel : isHovered ? accentHov : accentNorm;

      // Glow
      ctx.save();
      ctx.filter    = "blur(6px)";
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
      ctx.fill();
      ctx.restore();

      // Body fill
      ctx.fillStyle = isSelected
        ? "rgba(40, 20, 0, 0.9)"
        : isHovered
          ? "rgba(0, 0, 0, 0.55)"
          : "rgba(0, 0, 0, 0.4)";
      ctx.strokeStyle = isSelected
        ? "rgba(0, 255, 64, 0.9)"
        : available
          ? "rgba(16, 16, 16, 0.95)"
          : "rgba(60, 60, 60, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
      ctx.fill();
      ctx.stroke();

      // Building name — centered, bold
      const cx = rect.x + rect.w / 2;
      ctx.fillStyle    = isSelected ? "#6f6" : available ? "white" : "#666";
      ctx.font         = `bold ${Math.max(13, Math.round(17 * scale))}px Arial`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      const nameLines  = this._wrapText(ctx, info.name, rect.w - 20);
      const lineH      = Math.max(16, Math.round(19 * scale));
      const totalTxtH  = nameLines.length * lineH;
      let textY        = rect.y + rect.h / 2 - totalTxtH / 2 + lineH / 2;
      for (const line of nameLines) {
        ctx.fillText(line, cx, textY);
        textY += lineH;
      }
    }
  }

  _wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  _getAssetsForBuilding(key) {
    const assets = [];
    const e = this.economy;
    if (key === "crewFacilities") {
      if (e.hasFireCrew) assets.push("Fire Crew");
      if (e.hasFireWatch) assets.push("Fire Watch");
      if (e.hasDroneRecon) assets.push("Drone Recon");
    } else if (key === "vehicleBay") {
      if (e.hasEngineTruck) assets.push("Fire Truck");
      if (e.hasSprinklerTrailer) assets.push("Sprinkler");
      if (e.hasBulldozer) assets.push("Bulldozer");
    } else if (key === "helipad") {
      if (e.hasHelicopter) assets.push("Helicopter");
      if (e.hasWaterBomber) assets.push("Water Bomber");
      if (e.hasReconPlane) assets.push("Recon Plane");
    }
    return assets;
  }


  _drawStorageButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36, Math.round(48 * scale));
    const btnX = Math.round(this.layout.storageButton.x * w) - btnW / 2;
    const btnY = Math.round(this.layout.storageButton.y * h) - btnH / 2;
    this._storageBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    const isOpen = this._storagePanelOpen;
    const isHov  = this.isStorageHover;

    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = isHov ? "rgba(100, 200, 255, 0.4)" : "rgba(60, 140, 200, 0.25)";
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 12); ctx.fill();
    ctx.restore();

    ctx.fillStyle   = isOpen ? "rgba(10, 30, 50, 0.9)" : isHov ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.4)";
    ctx.strokeStyle = isOpen ? "rgba(100, 200, 255, 0.8)" : "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 12); ctx.fill(); ctx.stroke();

    ctx.fillStyle    = isOpen ? "#9ef" : "white";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Storage", btnX + btnW / 2, btnY + btnH / 2);
  }

  _drawUpgradesButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36, Math.round(48 * scale));
    const btnX = Math.round(this.layout.upgradesButton.x * w) - btnW / 2;
    const btnY = Math.round(this.layout.upgradesButton.y * h) - btnH / 2;
    this._upgradesBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    const isOpen = this._upgradesPanelOpen;
    const isHov  = this.isUpgradesHover;

    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = isHov ? "rgba(100, 255, 150, 0.4)" : "rgba(40, 160, 80, 0.25)";
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 12); ctx.fill();
    ctx.restore();

    ctx.fillStyle   = isOpen ? "rgba(10, 40, 20, 0.9)" : isHov ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.4)";
    ctx.strokeStyle = isOpen ? "rgba(100, 255, 150, 0.8)" : "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 12); ctx.fill(); ctx.stroke();

    ctx.fillStyle    = isOpen ? "#afa" : "white";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upgrades", btnX + btnW / 2, btnY + btnH / 2);
  }

  _drawStoragePanel(ctx, w, h, scale) {
    const e = this.economy;
    const resources = [
      { key: "fuel",      label: "Fuel",      current: Math.floor(e.fuel),      cap: e.fuelCap,      price: e.prices.fuel,      color: "#f90" },
      { key: "retardant", label: "Retardant", current: Math.floor(e.retardant), cap: e.retardantCap, price: e.prices.retardant, color: "#f44" },
      { key: "food",      label: "Food",      current: Math.floor(e.food),      cap: e.foodCap,      price: e.prices.food,      color: "#4c4" },
      { key: "parts",     label: "Parts",     current: Math.floor(e.parts),     cap: e.partsCap,     price: e.prices.parts,     color: "#88f" },
    ];

    const durabilityNeeded = Object.values(e.assetDurability || {}).reduce((sum, val) => {
      return val >= 100 ? sum : sum + (100 - Math.max(0, val));
    }, 0);
    const partsNeededForRepair = Math.ceil(durabilityNeeded / 100);

    this._resourceActionMap = {
      fuel_buy1:        () => e.buyResource("fuel", 1),
      fuel_refuel:      () => e.refuelAllVehicles(),
      fuel_buy10:       () => e.buyResource("fuel", 10),
      retardant_buy1:   () => e.buyResource("retardant", 1),
      retardant_buyMax: () => e.buyMaxResource("retardant"),
      retardant_buy5:   () => e.buyResource("retardant", 5),
      food_buy1:        () => e.buyResource("food", 1),
      food_feed:        () => e.feedCrewFully(),
      food_buy5:        () => e.buyResource("food", 5),
      parts_buy1:       () => e.buyResource("parts", 1),
      parts_repair:     () => e.repairAllVehicles(),
      parts_buy5:       () => e.buyResource("parts", 5),
    };

    const headerH    = 62;
    const resLabelH  = Math.max(24, Math.round(28 * scale));
    const btnRowH    = Math.max(32, Math.round(36 * scale));
    const sectionGap = Math.max(10, Math.round(14 * scale));
    const totalContentH = resources.length * (resLabelH + 4 + btnRowH + sectionGap) + 8;

    const panelW      = Math.max(340, Math.round(540 * scale));
    const maxPanelH   = Math.min(Math.round(h * 0.76), Math.max(320, Math.round(560 * scale)));
    const panelH      = Math.min(headerH + totalContentH, maxPanelH);
    const scrollAreaH = panelH - headerH;
    const panelX      = Math.round(this.layout.facilityPanel.x * w) - panelW / 2;
    const panelY      = Math.min(
      Math.round(this.layout.facilityPanel.y * h),
      h - panelH - 12
    );

    this._storagePanelRect        = { x: panelX, y: panelY, w: panelW, h: panelH };
    this._storagePanelScrollAreaY = panelY + headerH;
    this._storagePanelScrollAreaH = scrollAreaH;

    const maxScroll = Math.max(0, totalContentH - scrollAreaH);
    this._storageScrollOffset = Math.min(Math.max(0, this._storageScrollOffset), maxScroll);

    // ── Panel background ──
    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = "rgba(10, 10, 10, 0.85)";
    ctx.strokeStyle = "rgba(100, 200, 255, 0.55)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // ── Title ──
    ctx.fillStyle    = "#9ef";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Storage", panelX + 18, panelY + 14);

    // Divider
    ctx.strokeStyle = "rgba(100, 200, 255, 0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + headerH);
    ctx.lineTo(panelX + panelW - 10, panelY + headerH);
    ctx.stroke();

    // ── Scrollable content — clipped ──
    const scrollTop = panelY + headerH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, scrollTop, panelW - 12, scrollAreaH);
    ctx.clip();

    const scroll  = this._storageScrollOffset;
    const entryW  = panelW - 36;
    const btnGap  = Math.max(4, Math.round(6 * scale));
    const btnW3   = Math.floor((entryW - btnGap * 2) / 3);
    let   infoY   = Math.max(6, Math.round(8 * scale));

    this._shopBtns = {};

    for (const r of resources) {
      const gap       = r.cap - r.current;
      const buyable   = Math.min(gap, Math.floor(e.money / r.price));
      const bigQty    = r.key === "fuel" ? 10 : 5;
      const bigKey    = r.key === "fuel" ? "fuel_buy10" : `${r.key}_buy5`;
      const foodOk    = e.money >= e.prices.food && e.crewFedStatus < 100;

      const verbMap = {
        fuel:      { id: "fuel_refuel",      label: "Refuel all",  enabled: gap > 0 && buyable > 0 },
        retardant: { id: "retardant_buyMax", label: "Buy max",     enabled: gap > 0 && buyable > 0 },
        food:      { id: "food_feed",        label: "Feed Crew",   enabled: foodOk },
        parts:     { id: "parts_repair",     label: "Repair all",  enabled: partsNeededForRepair > 0 && e.money >= e.prices.parts },
      };

      const verb    = verbMap[r.key];
      const buttons = [
        { id: `${r.key}_buy1`, label: `Buy 1  ($${r.price})`,           enabled: e.money >= r.price && r.current < r.cap },
        { id: bigKey,           label: `Buy ${bigQty}  ($${r.price * bigQty})`, enabled: e.money >= r.price * bigQty && r.current < r.cap },
        { id: verb.id,          label: verb.label,                       enabled: verb.enabled },
      ];

      // Resource header row
      const labelY  = scrollTop + infoY - scroll;
      const fillPct = r.cap > 0 ? Math.min(1, r.current / r.cap) : 0;
      this._shopBtns[`${r.key}_total`] = { x: panelX + 18, y: labelY, w: entryW, h: resLabelH };

      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.roundRect(panelX + 18, labelY, entryW, resLabelH, 6); ctx.fill();

      if (fillPct > 0) {
        ctx.fillStyle = r.color + "33";
        ctx.beginPath(); ctx.roundRect(panelX + 18, labelY, Math.round(entryW * fillPct), resLabelH, 6); ctx.fill();
      }

      ctx.fillStyle    = r.color;
      ctx.font         = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(r.label, panelX + 26, labelY + resLabelH / 2);

      ctx.fillStyle = r.current >= r.cap ? "#8f8" : "#ddd";
      ctx.font      = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign = "right";
      ctx.fillText(`${r.current} / ${r.cap}`, panelX + 18 + entryW - 8, labelY + resLabelH / 2);

      infoY += resLabelH + 4;

      // Action buttons
      for (let i = 0; i < buttons.length; i++) {
        const btn    = buttons[i];
        const bx     = panelX + 18 + i * (btnW3 + btnGap);
        const by     = scrollTop + infoY - scroll;
        const hov    = this.shopHover[btn.id];
        this._shopBtns[btn.id] = { x: bx, y: by, w: btnW3, h: btnRowH };

        ctx.save();
        if (hov && btn.enabled) {
          ctx.filter    = "blur(6px)";
          ctx.fillStyle = "rgba(255, 200, 80, 0.3)";
          ctx.beginPath(); ctx.roundRect(bx, by, btnW3, btnRowH, 7); ctx.fill();
          ctx.restore(); ctx.save();
        }
        ctx.fillStyle   = btn.enabled ? "rgba(25, 35, 45, 0.95)" : "rgba(35,35,35,0.85)";
        ctx.strokeStyle = btn.enabled ? r.color : "rgba(80,80,80,0.5)";
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.roundRect(bx, by, btnW3, btnRowH, 7); ctx.fill(); ctx.stroke();
        ctx.restore();

        ctx.fillStyle    = btn.enabled ? "#fff" : "#666";
        ctx.font         = `${Math.max(9, Math.round(10 * scale))}px Arial`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.label, bx + btnW3 / 2, by + btnRowH / 2);
      }

      infoY += btnRowH + sectionGap;
    }

    ctx.restore(); // end clip

    // ── Scrollbar ──
    if (totalContentH > scrollAreaH) {
      const trackX = panelX + panelW - 10;
      const trackY = scrollTop + 4;
      const trackH = scrollAreaH - 8;
      const thumbH = Math.max(30, trackH * scrollAreaH / totalContentH);
      const thumbT = trackH - thumbH;
      const thumbY = trackY + (maxScroll > 0 ? (scroll / maxScroll) * thumbT : 0);

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath(); ctx.roundRect(trackX, trackY, 4, trackH, 2); ctx.fill();

      ctx.fillStyle = "rgba(100, 200, 255, 0.5)";
      ctx.beginPath(); ctx.roundRect(trackX, thumbY, 4, thumbH, 2); ctx.fill();
    }
  }

  // ── Selected tree detail panel ──

  _drawUpgradesPanel(ctx, w, h, scale) {
    this._repairBtns  = {};
    this._feedCrewBtn = null;

    if (!this.selectedBuilding) {
      this.selectedBuilding = this.buildingKeys[0];
    }

    if (!this.selectedBuilding) {
      this._upgradeBtn      = null;
      this._upgradeBtns     = {};
      this._skillUnlockBtns = {};
      this._skillRowRects   = {};
      return;
    }

    const building = this.economy.buildings[this.selectedBuilding];
    const info     = this.economy.buildingInfo[this.selectedBuilding];
    const available = this.economy.isBuildingAvailable(this.selectedBuilding);

    const skills         = this.economy.getSkillsForBuilding(this.selectedBuilding);
    const hasSkills      = skills.length > 0;
    const directUpgrades = this.economy.getDirectUpgradesForBuilding(this.selectedBuilding);

    const skillRowH      = Math.max(34, Math.round(40 * scale));
    const upgradeCardH   = Math.max(32, Math.round(38 * scale));
    const upgradeCardGap = 4;
    const headerH        = Math.max(62, Math.round(72 * scale));

    // ── Measure total scrollable content height ──
    let totalContentH = 0;
    if (available && building.tier < building.maxTier) {
      totalContentH += Math.max(28, Math.round(34 * scale)) + 26;
    } else {
      totalContentH += 12;
    }
    if (hasSkills) {
      for (const skill of skills) {
        totalContentH += skillRowH + 6;
        if (skill.unlocked) {
          const all = this.economy.getUpgradesForSkill(skill.skillId);
          totalContentH += all.length * (upgradeCardH + upgradeCardGap);
        }
      }
    }
    if (directUpgrades.length > 0) {
      totalContentH += directUpgrades.length * (upgradeCardH + upgradeCardGap);
    }
    totalContentH += 8;

    // ── Panel dimensions: grow with content, cap at max ──
    const panelW      = Math.max(340, Math.round(540 * scale));
    const maxPanelH   = Math.min(Math.round(h * 0.76), Math.max(320, Math.round(560 * scale)));
    const panelH      = Math.min(headerH + totalContentH, maxPanelH);
    const scrollAreaH = panelH - headerH;
    const panelX      = Math.round(this.layout.facilityPanel.x * w) - panelW / 2;
    const panelY      = Math.min(
      Math.round(this.layout.facilityPanel.y * h),
      h - panelH - 12
    );

    this._panelRect        = { x: panelX, y: panelY, w: panelW, h: panelH };
    this._panelScrollAreaY = panelY + headerH;
    this._panelScrollAreaH = scrollAreaH;

    const maxScroll = Math.max(0, totalContentH - scrollAreaH);
    this._panelScrollOffset = Math.min(Math.max(0, this._panelScrollOffset), maxScroll);

    // ── Panel background ──
    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = "rgba(10, 10, 10, 0.85)";
    ctx.strokeStyle = "rgba(100, 255, 150, 0.5)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // ── Fixed header: tab strip ──
    const TAB_LABELS = {
      commandCenter:  "Logistics",
      crewFacilities: "Crew",
      vehicleBay:     "Ground",
      helipad:        "Air",
    };
    const tabCount  = this.buildingKeys.length;
    const tabMargin = Math.max(12, Math.round(14 * scale));
    const tabGap    = Math.max(3, Math.round(4 * scale));
    const tabAreaW  = panelW - tabMargin * 2;
    const tabW      = Math.floor((tabAreaW - tabGap * (tabCount - 1)) / tabCount);
    const tabH      = Math.max(30, Math.round(36 * scale));
    const tabTop    = panelY + Math.max(14, Math.round(16 * scale));
    this._tabRects  = {};

    for (let i = 0; i < tabCount; i++) {
      const key    = this.buildingKeys[i];
      const tabX   = panelX + tabMargin + i * (tabW + tabGap);
      const isActive = this.selectedBuilding === key;
      const isHov    = this._tabHover === key;
      this._tabRects[key] = { x: tabX, y: tabTop, w: tabW, h: tabH };

      if (isActive || isHov) {
        ctx.save();
        ctx.filter    = "blur(5px)";
        ctx.fillStyle = isActive ? "rgba(100, 255, 150, 0.35)" : "rgba(100, 200, 80, 0.22)";
        ctx.beginPath(); ctx.roundRect(tabX, tabTop, tabW, tabH, 6); ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle   = isActive ? "rgba(10, 40, 20, 0.9)" : isHov ? "rgba(20, 30, 20, 0.8)" : "rgba(15, 15, 15, 0.7)";
      ctx.strokeStyle = isActive ? "rgba(100, 255, 150, 0.85)" : isHov ? "rgba(100, 200, 80, 0.5)" : "rgba(80, 80, 80, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(tabX, tabTop, tabW, tabH, 6); ctx.fill(); ctx.stroke();

      ctx.fillStyle    = isActive ? "#afa" : isHov ? "#dfd" : "#888";
      ctx.font         = `${isActive ? "bold " : ""}${Math.max(9, Math.round(11 * scale))}px Arial`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TAB_LABELS[key] ?? key, tabX + tabW / 2, tabTop + tabH / 2);
    }

    // Divider
    ctx.strokeStyle = "rgba(100, 255, 150, 0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + headerH);
    ctx.lineTo(panelX + panelW - 10, panelY + headerH);
    ctx.stroke();

    // ── Scrollable content — clipped ──
    const scrollTop = panelY + headerH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, scrollTop, panelW - 12, scrollAreaH);
    ctx.clip();

    const scroll = this._panelScrollOffset;
    let infoY    = 0;

    // Upgrade tier button
    this._upgradeBtn = null;
    if (available && building.tier < building.maxTier) {
      const canUpgrade = this.economy.canUpgradeTier(this.selectedBuilding);
      const cost       = this.economy.getTierUpgradeCost(this.selectedBuilding);
      const btnW       = Math.max(140, Math.round(200 * scale));
      const btnH       = Math.max(28, Math.round(34 * scale));
      const btnX       = panelX + 18;
      const btnY       = scrollTop + infoY + 6 - scroll;
      this._upgradeBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.save();
      if (this.isUpgradeHover && canUpgrade) {
        ctx.filter    = "blur(6px)";
        ctx.fillStyle = "rgba(255, 180, 50, 0.4)";
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 10);
        ctx.fill();
        ctx.restore();
        ctx.save();
      }

      ctx.fillStyle = canUpgrade ? "rgba(40, 80, 40, 0.9)" : "rgba(50, 50, 50, 0.9)";
      ctx.strokeStyle = canUpgrade ? "rgba(100, 200, 100, 0.8)" : "rgba(80, 80, 80, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const label = building.tier === 0
        ? `Build` + (cost > 0 ? ` ($${cost.toLocaleString()})` : "")
        : `Upgrade to Tier ${building.tier + 1}` + (cost > 0 ? ` ($${cost.toLocaleString()})` : "");
      ctx.fillStyle = canUpgrade ? "white" : "#666";
      ctx.font = `${Math.max(12, Math.round(14 * scale))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, btnX + btnW / 2, btnY + btnH / 2);
      infoY += btnH + 26;
    } else {
      infoY += 12;
    }

    // ── Skill-grouped upgrade tree ──
    this._skillUnlockBtns = {};
    this._skillRowRects   = {};
    this._upgradeBtns = {};
    const entryW    = panelW - 36;
    const indent    = 20;
    const indentW   = entryW - indent;

    if (hasSkills) {
      for (const skill of skills) {
        const sy       = scrollTop + infoY - scroll;
        const unlocked = skill.unlocked;

        // Skill card background
        ctx.fillStyle   = unlocked ? "rgba(30, 70, 30, 0.75)" : "rgba(40, 40, 40, 0.75)";
        ctx.strokeStyle = unlocked ? "rgba(100, 200, 100, 0.7)" : "rgba(110, 110, 110, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(panelX + 18, sy, entryW, skillRowH, 8);
        ctx.fill();
        ctx.stroke();
        this._skillRowRects[skill.skillId] = { x: panelX + 18, y: sy, w: entryW, h: skillRowH };

        // Skill name
        ctx.fillStyle    = unlocked ? "#e8ffe8" : "#888";
        ctx.font         = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(skill.name, panelX + 28, sy + skillRowH / 2);

        if (unlocked) {
          // Purchased count badge on right
          const skillUpgs       = this.economy.getUpgradesForSkill(skill.skillId);
          const owned           = skillUpgs.filter(u => u.purchased).length;
          ctx.fillStyle         = owned > 0 ? "#8f8" : "#6a6";
          ctx.font              = `${Math.max(9, Math.round(11 * scale))}px Arial`;
          ctx.textAlign         = "right";
          ctx.fillText(
            owned > 0 ? `✓ ${owned} owned` : `✓ Unlocked`,
            panelX + 18 + entryW - 10, sy + skillRowH / 2
          );
          infoY += skillRowH + 6;

          // Upgrades indented under this skill (all shown; purchased marked as owned)
          for (const upg of skillUpgs) {
            const ey          = scrollTop + infoY - scroll;
            const isPurchased = upg.purchased;
            const canBuy      = !isPurchased && this.economy.canBuyUpgrade(upg.id);
            const isHov       = !isPurchased && this.upgradeItemHover === upg.id;
            const prereq      = this.economy._getUpgradePrerequisite(upg.id);
            const needsPrereq = !isPurchased && prereq && !this.economy.upgrades.has(prereq);
            this._upgradeBtns[upg.id] = isPurchased ? null : { x: panelX + 18 + indent, y: ey, w: indentW, h: upgradeCardH };

            if (isHov && canBuy) {
              ctx.fillStyle = "rgba(255, 200, 80, 0.18)";
              ctx.beginPath();
              ctx.roundRect(panelX + 18 + indent - 2, ey - 2, indentW + 4, upgradeCardH + 4, 9);
              ctx.fill();
            }

            ctx.fillStyle   = isPurchased ? "rgba(10,40,10,0.7)"  : needsPrereq ? "rgba(30,30,30,0.8)" : canBuy ? "rgba(25,50,25,0.8)" : "rgba(35,40,35,0.8)";
            ctx.strokeStyle = isPurchased ? "rgba(60,140,60,0.5)" : needsPrereq ? "rgba(80,80,80,0.4)"  : canBuy ? "rgba(80,160,80,0.7)" : "rgba(70,100,70,0.5)";
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.roundRect(panelX + 18 + indent, ey, indentW, upgradeCardH, 7);
            ctx.fill();
            ctx.stroke();

            const textY = needsPrereq ? ey + upgradeCardH * 0.33 : ey + upgradeCardH / 2;
            ctx.fillStyle    = isPurchased ? "#8f8" : needsPrereq ? "#666" : canBuy ? "#fff" : "#bbb";
            ctx.font         = `${Math.max(10, Math.round(12 * scale))}px Arial`;
            ctx.textAlign    = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(upg.label, panelX + 18 + indent + 8, textY);

            if (needsPrereq) {
              const prereqDef = this.economy.upgradeCatalog[prereq];
              ctx.fillStyle = "#665";
              ctx.font      = `${Math.max(9, Math.round(10 * scale))}px Arial`;
              ctx.fillText(`\u21b3 needs: ${prereqDef?.label || prereq}`, panelX + 18 + indent + 8, ey + upgradeCardH * 0.72);
            }

            ctx.font         = `${Math.max(10, Math.round(12 * scale))}px Arial`;
            ctx.textAlign    = "right";
            ctx.textBaseline = "middle";
            if (isPurchased) {
              ctx.fillStyle = "#6c6";
              ctx.fillText("\u2713 Owned", panelX + 18 + entryW - 8, textY);
            } else {
              ctx.fillStyle = needsPrereq ? "#443" : canBuy ? "#fc4" : "#a93";
              ctx.fillText(`$${upg.cost.toLocaleString()}`, panelX + 18 + entryW - 8, textY);
            }
            infoY += upgradeCardH + upgradeCardGap;
          }
        } else {
          // Unlock button on the right side of the skill row
          const btnW      = Math.max(110, Math.round(135 * scale));
          const btnH      = skillRowH - 10;
          const btnX      = panelX + 18 + entryW - btnW - 6;
          const btnY      = sy + 5;
          const canUnlock = this.economy.canUnlockSkill(skill.skillId);
          const isHov     = this.skillUnlockHover === skill.skillId;
          this._skillUnlockBtns[skill.skillId] = { x: btnX, y: btnY, w: btnW, h: btnH };

          if (isHov && canUnlock) {
            ctx.fillStyle = "rgba(255, 180, 50, 0.25)";
            ctx.beginPath();
            ctx.roundRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4, 8);
            ctx.fill();
          }

          ctx.fillStyle   = canUnlock ? "rgba(70, 50, 10, 0.95)" : "rgba(30, 30, 30, 0.9)";
          ctx.strokeStyle = canUnlock ? "rgba(220, 160, 50, 0.85)" : "rgba(80, 80, 80, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnW, btnH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle    = canUnlock ? "#fc4" : "#665";
          ctx.font         = `bold ${Math.max(9, Math.round(11 * scale))}px Arial`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`Unlock  $${skill.cost.toLocaleString()}`, btnX + btnW / 2, btnY + btnH / 2);
          infoY += skillRowH + 6;
        }
      }
    }

    // ── Direct upgrades (no skill requirement) — shown after skills for all buildings ──
    if (directUpgrades.length > 0) {
      for (const upg of directUpgrades) {
        const ey          = scrollTop + infoY - scroll;
        const isPurchased = upg.purchased;
        const canBuy      = !isPurchased && this.economy.canBuyUpgrade(upg.id);
        const isHov       = !isPurchased && this.upgradeItemHover === upg.id;
        const prereq      = this.economy._getUpgradePrerequisite(upg.id);
        const needsPrereq = !isPurchased && prereq && !this.economy.upgrades.has(prereq);
        this._upgradeBtns[upg.id] = isPurchased ? null : { x: panelX + 18, y: ey, w: entryW, h: upgradeCardH };

        if (isHov && canBuy) {
          ctx.fillStyle = "rgba(255, 200, 80, 0.18)";
          ctx.beginPath();
          ctx.roundRect(panelX + 16, ey - 2, entryW + 4, upgradeCardH + 4, 9);
          ctx.fill();
        }

        ctx.fillStyle   = isPurchased ? "rgba(10,40,10,0.7)"  : needsPrereq ? "rgba(30,30,30,0.8)" : canBuy ? "rgba(25,50,25,0.8)" : "rgba(35,40,35,0.8)";
        ctx.strokeStyle = isPurchased ? "rgba(60,140,60,0.5)" : needsPrereq ? "rgba(80,80,80,0.4)"  : canBuy ? "rgba(80,160,80,0.7)" : "rgba(70,100,70,0.5)";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(panelX + 18, ey, entryW, upgradeCardH, 7);
        ctx.fill();
        ctx.stroke();

        const textY = needsPrereq ? ey + upgradeCardH * 0.33 : ey + upgradeCardH / 2;
        ctx.fillStyle    = isPurchased ? "#8f8" : needsPrereq ? "#666" : canBuy ? "#fff" : "#bbb";
        ctx.font         = `${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(upg.label, panelX + 26, textY);

        if (needsPrereq) {
          const prereqDef = this.economy.upgradeCatalog[prereq];
          ctx.fillStyle = "#665";
          ctx.font      = `${Math.max(9, Math.round(10 * scale))}px Arial`;
          ctx.fillText(`\u21b3 needs: ${prereqDef?.label || prereq}`, panelX + 26, ey + upgradeCardH * 0.72);
        }

        ctx.font         = `${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign    = "right";
        ctx.textBaseline = "middle";
        if (isPurchased) {
          ctx.fillStyle = "#6c6";
          ctx.fillText("\u2713 Owned", panelX + 18 + entryW - 8, textY);
        } else {
          ctx.fillStyle = needsPrereq ? "#443" : canBuy ? "#fc4" : "#a93";
          ctx.fillText(`$${upg.cost.toLocaleString()}`, panelX + 18 + entryW - 8, textY);
        }
        infoY += upgradeCardH + upgradeCardGap;
      }
    }

    ctx.restore(); // end clip

    // ── Scrollbar ──
    if (totalContentH > scrollAreaH) {
      const trackX = panelX + panelW - 10;
      const trackY = scrollTop + 4;
      const trackH = scrollAreaH - 8;
      const thumbH = Math.max(30, trackH * scrollAreaH / totalContentH);
      const thumbT = trackH - thumbH;
      const thumbY = trackY + (maxScroll > 0 ? (scroll / maxScroll) * thumbT : 0);

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, 4, trackH, 2);
      ctx.fill();

      ctx.fillStyle = "rgba(100, 255, 150, 0.5)";
      ctx.beginPath();
      ctx.roundRect(trackX, thumbY, 4, thumbH, 2);
      ctx.fill();
    }
  }

  _getDurabilityAssetsForBuilding(key) {
    const list = [];
    if (key === "vehicleBay") {
      if (this.economy.hasEngineTruck) list.push({ name: "Fire Truck", id: "engineTruck" });
      if (this.economy.hasSprinklerTrailer) list.push({ name: "Sprinkler Trailer", id: "sprinklerTrailer" });
      if (this.economy.hasBulldozer) list.push({ name: "Bulldozer", id: "bulldozer" });
    } else if (key === "helipad") {
      if (this.economy.hasHelicopter) list.push({ name: "Helicopter", id: "helicopter" });
      if (this.economy.hasWaterBomber) list.push({ name: "Water Bomber", id: "waterBomber" });
      if (this.economy.hasReconPlane) list.push({ name: "Recon Plane", id: "reconPlane" });
    }
    return list;
  }

  _getAssetStatsForBuilding(key) {
    const stats = [];
    if (key === "crewFacilities") {
      stats.push({ name: "Fire Crew", lines: [
        "Cuts firebreak lines through forest",
        "Cost: 1 Food wear | Cooldown: 8s (deferred)",
        "No durability — uses crew readiness",
      ]});
      stats.push({ name: "Fire Watch", lines: [
        "Static observation post — reveals area permanently",
        "Cost: 1 Food wear | Cooldown: 10s",
        "No durability — uses crew readiness",
      ]});
      stats.push({ name: "Drone Crew", lines: [
        "Temporary movable recon — reveals area for 45s",
        "Cost: 1 Food wear | Cooldown: 10s",
        "Can be repositioned while active",
      ]});
    } else if (key === "vehicleBay") {
      stats.push({ name: "Fire Truck", lines: [
        "Small area fire suppression zone",
        "Cost: 1 Fuel/use | 1 wear/4s",
        "Durability: 100",
      ]});
      stats.push({ name: "Sprinkler Trailer", lines: [
        "Placed water sprinkler — wets area over time",
        "Cost: none | 1 wear/activation",
        "Durability: 100",
      ]});
      stats.push({ name: "Bulldozer", lines: [
        "Clears firebreak lines — uses energy bar",
        "Cost: 1 Fuel/s active | 1 wear/4s",
        "Durability: 100 | Energy: recharges when idle",
      ]});
    } else if (key === "helipad") {
      stats.push({ name: "Helicopter", lines: [
        "Aerial water/retardant drop",
        "Water: 5 Fuel | Retardant: 5 Fuel + 2 Ret",
        "Durability: 100 | 2 wear/deployment",
      ]});
      stats.push({ name: "Water Bomber", lines: [
        "Heavy aerial suppression sortie",
        "Water: 8 Fuel | Retardant: 8 Fuel + 4 Ret",
        "Durability: 100 | 3 wear/sortie",
      ]});
      stats.push({ name: "Recon Plane", lines: [
        "Large-scale strategic recon sweep",
        "Cost: $2,000 per deployment | 1 wear",
        "Durability: 100 | Reveals wide area",
      ]});
    }
    return stats;
  }

  _getUpgradeTooltip(upgradeId) {
    const tooltips = {
      // Logistics
      betterForecast:    "Shows more weather detail in the pre-mission briefing.",
      moreChoices1:      "Adds an extra mission choice when selecting missions.",
      moreChoices2:      "Adds another mission choice (stacks with I).",
      // Crew
      fasterCutting:     "Fire Crew cuts firebreaks 40% faster (cutTime ×0.6).",
      reducedUnderfed1:  "Reduces all hunger penalties: drain speed, regen, and max stamina.",
      reducedUnderfed2:  "Further reduces all hunger penalties (stacks with I).",
      crewStamina1:      "Fire Crew stamina drains 10% slower (drain ×0.9).",
      crewStamina2:      "Fire Crew stamina drains 10% slower again (stacks with I).",
      crewRadius1:       "Fire Crew cutting radius +2 (12 → 14).",
      crewRadius2:       "Fire Crew cutting radius +2 more (14 → 16).",
      foodStorage2:      "Increases food storage to 18.",
      foodStorage3:      "Increases food storage to 28.",
      crewAvail1:        "Fire Watch and Drone Recon get +1 charge each.",
      crewAvail2:        "Fire Watch and Drone Recon get +1 more charge each (stacks with I).",
      fireWatchSight1:   "Fire Watch reveal radius +60 (220 → 280).",
      fireWatchSight2:   "Fire Watch reveal radius +60 more (280 → 340).",
      crewRecovery:      "Fire Watch and Drone Recon charge cooldowns reduced by 25% (×0.75).",
      lowerFoodCons1:    "Crew skill food wear reduced by 25% (drain ×0.75).",
      lowerFoodCons2:    "Crew skill food wear reduced by 25% again (stacks with I).",
      // Intel Facility
      weatherForecast:   "Enables weather forecast display during missions.",
      droneRadius1:      "Drone Recon reveal radius +50 (200 → 250).",
      droneRadius2:      "Drone Recon reveal radius +50 more (250 → 300).",
      droneDuration1:    "Drone Recon stays active 15s longer (45 → 60s).",
      droneDuration2:    "Drone Recon stays active 15s longer again (60 → 75s).",
      droneControl:      "Drone repositions 50% faster (speed ×1.5).",
      reconScanRadius:   "Recon Plane reveals a larger area.",
      reconDuration:     "Recon Plane reveal lasts longer.",
      perfectForecast:   "Shows exact wind and weather for the whole mission.",
      // Ground Support
      engineRadius:      "Fire Truck spray radius +35% (×1.35).",
      engineSuppression: "Fire Truck wets trees 35% faster (sprayTime ×0.65).",
      engineMobility:    "Fire Truck durability wear 50% slower (wear interval ×1.5).",
      engineRecharge:    "Fire Truck durability wear 25% slower again (×1.25, stacks with I).",
      sprinklerRadius:   "Sprinkler Trailer zone +30% wider (×1.3).",
      sprinklerDur:      "Sprinkler Trailer active 4s longer (10 → 14s).",
      sprinklerCooldown: "Sprinkler Trailer cooldown 30% shorter (×0.7).",
      vehicleWear1:      "Bulldozer durability drain 25% slower while running (1 → 0.75 %/s).",
      vehicleWear2:      "Bulldozer durability drain 33% slower again (0.75 → 0.5 %/s, stacks with I).",
      vehicleFuelEff1:   "Bulldozer fuel drain halved while running (0.3 → 0.15 fuel/s).",
      vehicleFuelEff2:   "Bulldozer fuel drain halved again (stacks with I).",
      fuelStorage2:      "Increases fuel storage to 35.",
      fuelStorage3:      "Increases fuel storage to 50.",
      fuelStorage4:      "Increases fuel storage to 70.",
      partsStorage2:     "Increases parts storage to 18.",
      partsStorage3:     "Increases parts storage to 28.",
      dozerSpeed:        "Bulldozer cuts each tree 40% faster while travelling (cutTime ×0.6).",
      dozerLineWidth:    "Bulldozer cuts a wider swath (24 → 32 px).",
      dozerRecharge:     "Bulldozer cooldown 25% shorter between runs (×0.75).",
      // Air Support
      heliFuelEff:       "Helicopter fuel cost per deployment halved (2 → 1).",
      heliDurability:    "Helicopter wear per deployment halved (4 → 2).",
      heliSuppression:   "Helicopter suppression radius +30% (×1.3).",
      heliTurnaround1:   "Helicopter cooldown 20% shorter (×0.8).",
      heliTurnaround2:   "Helicopter cooldown 20% shorter again (stacks with I).",
      // Air Support (continued)     "Water Bomber fuel cost per sortie reduced (3 → 2).",
      bomberRetEff:      "Water Bomber retardant cost per sortie halved (2 → 1).",
      bomberDurability:  "Water Bomber wear per sortie reduced (5 → 3).",
      bomberTurnaround:  "Water Bomber cooldown 30% shorter (×0.7).",
      retStorage2:       "Increases retardant storage to 14.",
      retStorage3:       "Increases retardant storage to 20.",
      retStorage4:       "Increases retardant storage to 28.",
      bomberDrop1:       "Water Bomber drop radius +25% (×1.25).",
      bomberDrop2:       "Water Bomber drop radius +25% more (stacks with I).",
    };
    return tooltips[upgradeId] || null;
  }

  _getUpgradeTooltipLines(upgradeId) {
    const desc = this._getUpgradeTooltip(upgradeId);
    if (!desc) return null;
    const def = this.economy.upgradeCatalog[upgradeId];
    if (!def) return [desc];
    const lines = [desc];
    const prereqId = this.economy._getUpgradePrerequisite(upgradeId);
    if (prereqId) {
      const prereqDef = this.economy.upgradeCatalog[prereqId];
      lines.push(`Requires: ${prereqDef?.label || prereqId}`);
    }
    lines.push(`Cost: $${def.cost.toLocaleString()}`);
    return lines;
  }

  _getResourceTooltipLines(key) {
    const lines = {
      fuel: [
        "Fuel — Powers the Bulldozer and aircraft.",
        "Bulldozer: 0.3/s while running (0.15/s w/ Fuel Eff. I).",
        "Helicopter: 2/deployment.",
        "Water Bomber: 3/sortie.",
        "Runs out = vehicle/aircraft disabled until resupplied.",
        "Storage upgrades available at Logistics.",
      ],
      retardant: [
        "Retardant — Special chemical for air-drop suppression.",
        "Helicopter (retardant mode): 2/drop.",
        "Water Bomber (retardant mode): 4/sortie.",
        "Retardant-treated trees stay wet longer than water alone.",
        "Air units can also drop water at no retardant cost.",
        "Storage upgrades available at Logistics.",
      ],
      food: [
        "Food — Keeps your crew fed and effective.",
        "Fire Crew drains fed status every 3s of active cutting.",
        "Fire Watch and Drone Recon drain fed status each activation.",
        "When fed status drops low, 1 food auto-replenishes it.",
        "Underfed crew: higher stamina drain, slower regen,",
        "  lower max stamina, and longer Watch/Drone cooldowns.",
        "Storage upgrades available at Logistics.",
      ],
      parts: [
        "Parts — Used to repair damaged vehicles and aircraft.",
        "Repair costs $2 per durability point to restore.",
        "Repair at the asset's facility between missions.",
        "Destroyed assets cannot be used until repaired.",
        "Storage upgrades available at Logistics.",
      ],
    };
    return lines[key] || null;
  }

  _getResourceActionTooltip(btnKey) {
    const e = this.economy;
    const parts = btnKey.split("_");
    if (parts.length < 2) return null;
    const resource = parts[0];
    const action = parts[1];

    if (action === "total") {
      return [`${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${Math.floor(e[resource] ?? 0)}/${e.getCap?.(resource) ?? 0}`];
    }

    if (action === "buy1") {
      return [`Buy 1 ${resource} for $${e.prices[resource]}`];
    }
    if (action === "buy5") {
      return [`Buy 5 ${resource} for $${e.prices[resource] * 5}`];
    }
    if (action === "buy10") {
      return [`Buy 10 ${resource} for $${e.prices[resource] * 10}`];
    }

    if (btnKey === "fuel_refuel") {
      const needed = Math.max(0, (e.fuelCap ?? 0) - Math.floor(e.fuel ?? 0));
      const cost = needed * e.prices.fuel;
      return [`Refuel all vehicles: ${needed} fuel needed`, `Estimated cost: $${cost}`];
    }

    if (btnKey === "retardant_buyMax") {
      const needed = Math.max(0, (e.retardantCap ?? 0) - Math.floor(e.retardant ?? 0));
      const cost = needed * e.prices.retardant;
      return [`Buy max retardant: ${needed} needed`, `Estimated cost: $${cost}`];
    }

    if (btnKey === "food_feed") {
      const stepsNeeded = Math.ceil(Math.max(0, 100 - e.crewFedStatus) / 10);
      const cost = stepsNeeded * e.prices.food;
      return [`Feed crew to full: ${stepsNeeded} feeds`, `Total cost: $${cost}`];
    }

    if (btnKey === "parts_repair") {
      const cost = Math.floor(Object.values(e.assetDurability || {}).reduce((sum, val) => {
        return val >= 100 ? sum : sum + (100 - Math.max(0, val)) * 2;
      }, 0));
      return [`Repair all vehicles`, `Total cost: $${cost}`];
    }

    return null;
  }

  _drawTooltip(ctx, w, h, scale) {
    if (!this._tooltipText || (!this.upgradeItemHover && !this.isUpgradeHover && !this.resourceHover && !this.skillUnlockHover)) return;

    const mx = this._tooltipX;
    const my = this._tooltipY;

    ctx.save();
    const fontSize = Math.max(10, Math.round(12 * scale));
    ctx.font = `${fontSize}px Arial`;
    const padX = 10;
    const padY = 6;
    const lineH = fontSize + 4;

    const lines = this._tooltipLines || [this._tooltipText];
    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const tipW = maxLineW + padX * 2;
    const tipH = padY * 2 + lines.length * lineH;

    // Position tooltip below and to the right of cursor, keep on screen
    let tx = mx + 16;
    let ty = my + 20;
    if (tx + tipW > w) tx = mx - tipW - 8;
    if (ty + tipH > h) ty = my - tipH - 4;

    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    ctx.strokeStyle = "rgba(255, 200, 80, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tipW, tipH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx + padX, ty + padY + i * lineH);
    }
    ctx.restore();
  }

  // ── Back button ──

  _drawBackButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36,  Math.round(48  * scale));
    const btnX = Math.round(this.layout.backButton.x * w) - btnW / 2;
    const btnY = Math.round(this.layout.backButton.y * h) - btnH / 2;
    this._backBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = this.isBackHover ? "rgba(255, 180, 50, 0.5)" : "rgba(255, 140, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = this.isBackHover ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle    = "white";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Back", btnX + btnW / 2, btnY + btnH / 2);
  }

  // ── Missions button ──

  _drawMissionsButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36, Math.round(48 * scale));
    const btnX = Math.round(this.layout.missionsButton.x * w) - btnW / 2;
    const btnY = Math.round(this.layout.missionsButton.y * h) - btnH / 2;
    this._missionsBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    const isOpen = this._missionsPanelOpen;
    const isHov  = this.isMissionsHover;

    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = isHov ? "rgba(255, 180, 50, 0.5)" : "rgba(255, 140, 0, 0.3)";
    ctx.strokeStyle = "rgba(16, 16, 16, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle   = isOpen ? "rgba(30, 20, 0, 0.9)" : isHov ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = isOpen ? "rgba(255, 180, 50, 0.8)" : "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = isOpen ? "#fc8" : "white";
    ctx.font = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Missions", btnX + btnW / 2, btnY + btnH / 2);
  }

  _drawMaintenanceButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36, Math.round(48 * scale));
    const btnX = Math.round(this.layout.maintenanceButton.x * w) - btnW / 2;
    const btnY = Math.round(this.layout.maintenanceButton.y * h) - btnH / 2;
    this._maintenanceBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    const isOpen = this._maintenancePanelOpen;
    const isHov  = this.isMaintenanceHover;

    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = isHov ? "rgba(100, 200, 255, 0.4)" : "rgba(60, 140, 200, 0.25)";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = isOpen ? "rgba(10, 30, 50, 0.9)" : isHov ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.4)";
    ctx.strokeStyle = isOpen ? "rgba(100, 200, 255, 0.8)" : "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isOpen ? "#9ef" : "white";
    ctx.font = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Maintenance", btnX + btnW / 2, btnY + btnH / 2);
  }

  _drawMaintenancePanel(ctx, w, h, scale) {
    const e          = this.economy;
    const repairRowH = Math.max(32, Math.round(38 * scale));
    const headerH    = 62;

    const allAssets = [];
    if (e.hasEngineTruck)      allAssets.push({ name: "Fire Truck",        id: "engineTruck" });
    if (e.hasSprinklerTrailer) allAssets.push({ name: "Sprinkler Trailer", id: "sprinklerTrailer" });
    if (e.hasBulldozer)        allAssets.push({ name: "Bulldozer",         id: "bulldozer" });
    if (e.hasHelicopter)       allAssets.push({ name: "Helicopter",        id: "helicopter" });
    if (e.hasWaterBomber)      allAssets.push({ name: "Water Bomber",      id: "waterBomber" });
    if (e.hasReconPlane)       allAssets.push({ name: "Recon Plane",       id: "reconPlane" });

    const fed = e.crewFedStatus;

    // ── Measure total content height ──
    const initY = Math.max(6, Math.round(8 * scale));
    let totalContentH = initY + Math.round(22 * scale) + repairRowH + 14;
    if (allAssets.length > 0) {
      totalContentH += Math.round(28 * scale) + allAssets.length * (repairRowH + 4);
    }
    totalContentH += 12;

    // ── Panel dimensions: grow with content, cap at max ──
    const panelW      = Math.max(340, Math.round(540 * scale));
    const maxPanelH   = Math.min(Math.round(h * 0.76), Math.max(320, Math.round(560 * scale)));
    const panelH      = Math.min(headerH + totalContentH, maxPanelH);
    const scrollAreaH = panelH - headerH;
    const panelX      = Math.round(this.layout.facilityPanel.x * w) - panelW / 2;
    const panelY      = Math.min(
      Math.round(this.layout.facilityPanel.y * h),
      h - panelH - 12
    );

    this._maintenancePanelRect        = { x: panelX, y: panelY, w: panelW, h: panelH };
    this._maintenancePanelScrollAreaY = panelY + headerH;
    this._maintenancePanelScrollAreaH = scrollAreaH;

    const maxScroll = Math.max(0, totalContentH - scrollAreaH);
    this._maintenanceScrollOffset = Math.min(Math.max(0, this._maintenanceScrollOffset), maxScroll);

    // ── Panel background ──
    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = "rgba(10, 10, 10, 0.85)";
    ctx.strokeStyle = "rgba(100, 200, 255, 0.55)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // ── Title ──
    ctx.fillStyle    = "#9ef";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Maintenance", panelX + 18, panelY + 14);

    // Divider
    ctx.strokeStyle = "rgba(100, 200, 255, 0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + headerH);
    ctx.lineTo(panelX + panelW - 10, panelY + headerH);
    ctx.stroke();

    // ── Scrollable content — clipped ──
    const scrollTop = panelY + headerH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, scrollTop, panelW - 12, scrollAreaH);
    ctx.clip();

    const scroll = this._maintenanceScrollOffset;
    let infoY    = initY;

    // Feed Crew
    const canFeed  = e.money >= e.prices.food && fed < 100;
    const feedBtnW = panelW - 36;
    ctx.fillStyle    = "#ddd";
    ctx.font         = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Feed Crew ($${e.prices.food} = 10 fed)`, panelX + 18, scrollTop + infoY - scroll);
    infoY += Math.round(22 * scale);

    const fy = scrollTop + infoY - scroll;
    this._feedCrewBtn = { x: panelX + 18, y: fy, w: feedBtnW, h: repairRowH };

    if (this.feedCrewHover && canFeed) {
      ctx.fillStyle = "rgba(100, 200, 100, 0.15)";
      ctx.beginPath();
      ctx.roundRect(panelX + 14, fy - 1, feedBtnW + 8, repairRowH, 6);
      ctx.fill();
    }
    ctx.fillStyle   = canFeed ? "rgba(20,25,20,0.85)" : "rgba(30,30,30,0.85)";
    ctx.strokeStyle = fed >= 76 ? "#8f8" : fed >= 51 ? "#ff8" : fed >= 1 ? "#f88" : "#f44";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(panelX + 18, fy, feedBtnW, repairRowH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle    = canFeed ? "#fff" : "#888";
    ctx.font         = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Crew", panelX + 26, fy + repairRowH / 2);
    ctx.textAlign    = "right";
    ctx.fillStyle    = fed >= 100 ? "#8f8" : canFeed ? "#ccc" : "#666";
    ctx.font         = `${Math.max(9, Math.round(11 * scale))}px Arial`;
    ctx.fillText(
      canFeed ? `${fed} \u2014 Feed` : fed >= 100 ? "Full (100)" : `${fed} (No Money)`,
      panelX + 18 + feedBtnW - 8, fy + repairRowH / 2
    );
    infoY += repairRowH + 14;

    // Repair
    this._repairBtns = {};
    if (allAssets.length > 0) {
      ctx.fillStyle    = "#ddd";
      ctx.font         = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Repair ($2 per Durability)", panelX + 18, scrollTop + infoY - scroll);
      infoY += Math.round(28 * scale);

      const rBtnW = panelW - 36;
      for (const asset of allAssets) {
        const ry        = scrollTop + infoY - scroll;
        const dur       = Math.round(e.assetDurability[asset.id] ?? 0);
        const repairCost = (100 - dur) * 2;
        const canRepair = dur < 100 && e.money >= repairCost;
        const hovered   = this.repairHover[asset.id];
        this._repairBtns[asset.id] = { x: panelX + 18, y: ry, w: rBtnW, h: repairRowH };

        if (hovered && canRepair) {
          ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
          ctx.beginPath();
          ctx.roundRect(panelX + 14, ry - 1, rBtnW + 8, repairRowH, 6);
          ctx.fill();
        }
        ctx.fillStyle   = canRepair ? "rgba(20,25,40,0.85)" : "rgba(30,30,30,0.85)";
        ctx.strokeStyle = dur > 50 ? "#8f8" : dur > 25 ? "#ff8" : "#f88";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(panelX + 18, ry, rBtnW, repairRowH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle    = canRepair ? "#fff" : "#888";
        ctx.font         = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(asset.name, panelX + 26, ry + repairRowH / 2);
        ctx.textAlign    = "right";
        ctx.fillStyle    = dur >= 100 ? "#8f8" : canRepair ? "#ccc" : "#666";
        ctx.font         = `${Math.max(9, Math.round(11 * scale))}px Arial`;
        ctx.fillText(
          dur >= 100 ? "Full (100)" : canRepair ? `${dur}/100 \u2014 $${repairCost}` : `${dur}/100 (No Money)`,
          panelX + 18 + rBtnW - 8, ry + repairRowH / 2
        );
        infoY += repairRowH + 4;
      }
    }

    ctx.restore(); // end clip

    // ── Scrollbar ──
    if (totalContentH > scrollAreaH) {
      const trackX = panelX + panelW - 10;
      const trackY = scrollTop + 4;
      const trackH = scrollAreaH - 8;
      const thumbH = Math.max(30, trackH * scrollAreaH / totalContentH);
      const thumbT = trackH - thumbH;
      const thumbY = trackY + (maxScroll > 0 ? (scroll / maxScroll) * thumbT : 0);

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, 4, trackH, 2);
      ctx.fill();

      ctx.fillStyle = "rgba(100, 200, 255, 0.5)";
      ctx.beginPath();
      ctx.roundRect(trackX, thumbY, 4, thumbH, 2);
      ctx.fill();
    }
  }

  // ── Missions panel ──

  _drawMissionsPanel(ctx, w, h, scale) {
    const DIFFICULTY_RANK = {
      "none":                  0,
      "increasing difficulty": 1,
      "very easy":             2,
      "easy":                  3,
      "moderate":              4,
      "challenging":           5,
      "hard":                  6,
      "very hard":             7,
      "extreme":               8,
    };

    const DIFFICULTY_COLORS = {
      "very easy":             "#66BB6A",
      "easy":                  "#4CAF50",
      "moderate":              "#FFC107",
      "challenging":           "#FF9800",
      "hard":                  "#EF5350",
      "very hard":             "#f44336",
      "extreme":               "#B71C1C",
      "increasing difficulty": "#CE93D8",
      "none":                  "#888",
    };

    const sorted = [...this.missions].sort((a, b) => {
      const ra = DIFFICULTY_RANK[(a.difficulty ?? "").toLowerCase()] ?? 99;
      const rb = DIFFICULTY_RANK[(b.difficulty ?? "").toLowerCase()] ?? 99;
      return ra - rb;
    });

    const headerH  = 62;
    const nameFont  = Math.max(13, Math.round(16 * scale));
    const descFont  = Math.max(10, Math.round(12 * scale));
    const lineH     = Math.round(descFont * 1.4);
    const padTop    = Math.max(8, Math.round(10 * scale));
    const rowH      = padTop * 2 + nameFont + Math.max(3, Math.round(4 * scale)) + lineH * 2;
    const padV      = Math.max(6, Math.round(8 * scale));
    const totalContentH = sorted.length * (rowH + padV) + padV;

    const panelW    = Math.max(340, Math.round(540 * scale));
    const maxPanelH = Math.min(Math.round(h * 0.76), Math.max(320, Math.round(560 * scale)));
    const panelH    = Math.min(headerH + totalContentH, maxPanelH);
    const scrollAreaH = panelH - headerH;
    const panelX = Math.round(this.layout.facilityPanel.x * w) - panelW / 2;
    const panelY = Math.min(
      Math.round(this.layout.facilityPanel.y * h),
      h - panelH - 12
    );

    this._missionsPanelRect        = { x: panelX, y: panelY, w: panelW, h: panelH };
    this._missionsPanelScrollAreaY = panelY + headerH;
    this._missionsPanelScrollAreaH = scrollAreaH;

    const maxScroll = Math.max(0, totalContentH - scrollAreaH);
    this._missionScrollOffset = Math.min(Math.max(0, this._missionScrollOffset), maxScroll);

    // ── Panel background ──
    ctx.save();
    ctx.filter    = "blur(6px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle   = "rgba(10, 10, 10, 0.88)";
    ctx.strokeStyle = "rgba(255, 200, 50, 0.6)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // ── Title ──
    ctx.fillStyle    = "#fc8";
    ctx.font         = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Missions", panelX + 18, panelY + 14);

    // ── Divider ──
    ctx.strokeStyle = "rgba(255, 200, 50, 0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + headerH);
    ctx.lineTo(panelX + panelW - 10, panelY + headerH);
    ctx.stroke();

    // ── Scrollable content ──
    const scrollTop = panelY + headerH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, scrollTop, panelW - 12, scrollAreaH);
    ctx.clip();

    const scroll = this._missionScrollOffset;
    this._missionBtns = {};
    let rowY = scrollTop + padV - scroll;

    for (const mission of sorted) {
      const diffKey = (mission.difficulty ?? "").toLowerCase();
      const diffColor = DIFFICULTY_COLORS[diffKey] ?? "#888";
      const isCompleted = this.economy.completedMissions.has(mission.id);
      const isHov = this._missionsHoveredId === mission.id;

      const rowRect = { x: panelX + 8, y: rowY, w: panelW - 20, h: rowH };
      this._missionBtns[mission.id] = rowRect;

      // Row background
      ctx.fillStyle = isHov
        ? "rgba(255, 200, 50, 0.12)"
        : isCompleted
          ? "rgba(100, 200, 100, 0.06)"
          : "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.roundRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h, 8);
      ctx.fill();

      if (isHov) {
        ctx.strokeStyle = "rgba(255, 200, 50, 0.35)";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h, 8);
        ctx.stroke();
      }

      const textX  = panelX + 20;
      const nameY  = rowY + padTop;
      const descY0 = nameY + nameFont + Math.max(3, Math.round(4 * scale));

      // Difficulty badge (top right)
      const badgeText = mission.difficulty ?? "—";
      ctx.font         = `bold ${descFont}px Arial`;
      ctx.textAlign    = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle    = diffColor;
      const badgeX     = panelX + panelW - (isCompleted ? 46 : 22);
      ctx.fillText(badgeText, badgeX, nameY);

      // Completed checkmark
      if (isCompleted) {
        ctx.fillStyle    = "#6f6";
        ctx.font         = `bold ${Math.max(14, Math.round(18 * scale))}px Arial`;
        ctx.textAlign    = "right";
        ctx.textBaseline = "top";
        ctx.fillText("✓", panelX + panelW - 22, nameY);
      }

      // Mission name
      ctx.fillStyle    = isHov ? "#ffe" : "white";
      ctx.font         = `bold ${nameFont}px Arial`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";
      ctx.fillText(mission.name, textX, nameY);

      // Description — 2-line word wrap
      if (mission.description) {
        ctx.font         = `${descFont}px Arial`;
        ctx.fillStyle    = "#999";
        ctx.textAlign    = "left";
        ctx.textBaseline = "top";
        const maxDescW  = panelW - 44;
        const dWords    = mission.description.split(" ");
        const descLines = [];
        let dCur = "";
        let di   = 0;

        // Line 1: as many words as fit
        for (; di < dWords.length; di++) {
          const t = dCur ? dCur + " " + dWords[di] : dWords[di];
          if (ctx.measureText(t).width > maxDescW && dCur) break;
          dCur = t;
        }
        if (dCur) descLines.push(dCur);
        dCur = "";

        // Line 2: as many remaining words as fit, append "…" when truncated
        for (; di < dWords.length; di++) {
          const t       = dCur ? dCur + " " + dWords[di] : dWords[di];
          const hasMore = di < dWords.length - 1;
          if (ctx.measureText(t + (hasMore ? "…" : "")).width <= maxDescW) {
            dCur = t;
          } else {
            if (dCur) dCur += "…";
            break;
          }
        }
        if (dCur) descLines.push(dCur);

        for (let li = 0; li < descLines.length; li++) {
          ctx.fillText(descLines[li], textX, descY0 + li * lineH);
        }
      }

      rowY += rowH + padV;
    }

    ctx.restore();

    // ── Scrollbar ──
    if (totalContentH > scrollAreaH) {
      const trackX  = panelX + panelW - 10;
      const trackY  = scrollTop + 4;
      const trackH  = scrollAreaH - 8;
      const thumbH  = Math.max(24, trackH * (scrollAreaH / totalContentH));
      const thumbY  = trackY + (trackH - thumbH) * (scroll / maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, 4, trackH, 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 200, 50, 0.5)";
      ctx.beginPath();
      ctx.roundRect(trackX, thumbY, 4, thumbH, 2);
      ctx.fill();
    }
  }

  // ── Input handling ──

  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  _inPanelScroll(y) {
    return this._panelScrollAreaH > 0
      && y >= this._panelScrollAreaY
      && y <= this._panelScrollAreaY + this._panelScrollAreaH;
  }

  _inMaintenanceScroll(y) {
    return this._maintenancePanelScrollAreaH > 0
      && y >= this._maintenancePanelScrollAreaY
      && y <= this._maintenancePanelScrollAreaY + this._maintenancePanelScrollAreaH;
  }

  _inStorageScroll(y) {
    return this._storagePanelScrollAreaH > 0
      && y >= this._storagePanelScrollAreaY
      && y <= this._storagePanelScrollAreaY + this._storagePanelScrollAreaH;
  }

  _inMissionsScroll(y) {
    return this._missionsPanelScrollAreaH > 0
      && y >= this._missionsPanelScrollAreaY
      && y <= this._missionsPanelScrollAreaY + this._missionsPanelScrollAreaH;
  }

  handlePointerDown(x, y, evt) {
    if (evt?.button === 1) return;

    const canvas = evt?.target;
    const w = canvas?.width ?? 1280;
    const h = canvas?.height ?? 720;
    const scale = Math.min(w / 1280, h / 720, 2);

    // Back button
    if (this._hitTest(x, y, this._backBtn)) {
      this.onBack?.();
      return;
    }

    // Missions button — open missions panel
    if (this._hitTest(x, y, this._missionsBtn)) {
      this._missionsPanelOpen = true;
      this._upgradesPanelOpen = false;
      this._maintenancePanelOpen = false;
      this._storagePanelOpen = false;
      this._missionScrollOffset = 0;
      return;
    }

    // Maintenance button
    if (this._hitTest(x, y, this._maintenanceBtn)) {
      this._maintenancePanelOpen = true;
      this._upgradesPanelOpen = false;
      this._storagePanelOpen = false;
      this._missionsPanelOpen = false;
      return;
    }

    // Maintenance close button

    // Storage button
    if (this._hitTest(x, y, this._storageBtn)) {
      this._storagePanelOpen = true;
      this._upgradesPanelOpen = false;
      this._maintenancePanelOpen = false;
      this._missionsPanelOpen = false;
      return;
    }

    // Upgrades button — open upgrades panel
    if (this._hitTest(x, y, this._upgradesBtnRect)) {
      this._upgradesPanelOpen = true;
      if (!this.selectedBuilding) this.selectedBuilding = this.buildingKeys[0];
      this._panelScrollOffset = 0;
      this._maintenancePanelOpen = false;
      this._storagePanelOpen = false;
      this._missionsPanelOpen = false;
      return;
    }

    // Storage close button

    // Missions close button

    // Missions row buttons
    if (this._missionsPanelOpen) {
      for (const [missionId, rect] of Object.entries(this._missionBtns)) {
        if (this._hitTest(x, y, rect) && this._inMissionsScroll(y)) {
          const mission = this.missions.find(m => m.id === missionId);
          if (mission) {
            this.onSelectMission?.(mission);
            this._missionsPanelOpen = false;
          }
          return;
        }
      }
    }

    // Tab clicks — switch active tree
    if (this._upgradesPanelOpen) {
      for (const [key, rect] of Object.entries(this._tabRects)) {
        if (this._hitTest(x, y, rect)) {
          this.selectedBuilding = key;
          this._panelScrollOffset = 0;
          return;
        }
      }
    }

    // Upgrade button in panel
    if (this._upgradesPanelOpen && this._hitTest(x, y, this._upgradeBtn) && this._inPanelScroll(y)) {
      this.economy.upgradeTier(this.selectedBuilding);
      this.economy.save();
      return;
    }

    // Individual upgrade purchase buttons
    for (const [upgradeId, rect] of Object.entries(this._upgradeBtns)) {
      if (this._hitTest(x, y, rect) && this._inPanelScroll(y)) {
        this.economy.buyUpgrade(upgradeId);
        this.economy.save();
        return;
      }
    }

    // Skill unlock buttons
    for (const [skillId, rect] of Object.entries(this._skillUnlockBtns)) {
      if (this._hitTest(x, y, rect) && this._inPanelScroll(y)) {
        this.economy.unlockSkill(skillId);
        this.economy.save();
        return;
      }
    }

    // Resource shop buttons (only when Storage panel is open and cursor is in scroll area)
    if (this._storagePanelOpen) {
      for (const [btnKey, rect] of Object.entries(this._shopBtns)) {
        if (this._hitTest(x, y, rect) && this._inStorageScroll(y)) {
          const action = this._resourceActionMap?.[btnKey];
          if (action) action();
          this.economy.save();
          return;
        }
      }
    }

    // Repair buttons
    for (const [assetId, rect] of Object.entries(this._repairBtns)) {
      if (this._hitTest(x, y, rect) && this._inMaintenanceScroll(y)) {
        this.economy.repairAsset(assetId);
        this.economy.save();
        return;
      }
    }

    // Feed crew button
    if (this._feedCrewBtn && this._hitTest(x, y, this._feedCrewBtn) && this._inMaintenanceScroll(y)) {
      this.economy.feedCrew();
      this.economy.save();
      return;
    }

    // Click inside tree panel — absorb without deselecting
    if (this._upgradesPanelOpen && this._hitTest(x, y, this._panelRect)) {
      return;
    }

    // Click inside maintenance panel — absorb
    if (this._maintenancePanelOpen && this._hitTest(x, y, this._maintenancePanelRect)) {
      return;
    }

    // Click inside storage panel — absorb
    if (this._storagePanelOpen && this._hitTest(x, y, this._storagePanelRect)) {
      return;
    }

    // Click inside missions panel — absorb
    if (this._missionsPanelOpen && this._hitTest(x, y, this._missionsPanelRect)) {
      return;
    }

  }

  handlePointerMove(x, y, evt) {
    const canvas = evt?.target;
    const w = canvas?.width ?? 1280;
    const h = canvas?.height ?? 720;
    const scale = Math.min(w / 1280, h / 720, 2);

    this.isBackHover = this._hitTest(x, y, this._backBtn);
    this.isMissionsHover = this._hitTest(x, y, this._missionsBtn);
    this.isUpgradeHover = this._upgradesPanelOpen && this._hitTest(x, y, this._upgradeBtn) && this._inPanelScroll(y);
    this.isUpgradesHover = this._hitTest(x, y, this._upgradesBtnRect);
    this.isCloseHover = false;
    this.isMaintenanceHover = this._hitTest(x, y, this._maintenanceBtn);
    this.isMaintenanceCloseHover = false;
    this.isStorageHover = this._hitTest(x, y, this._storageBtn);
    this.isStorageCloseHover = false;
    this.isMissionsCloseHover = false;
    this._missionsHoveredId = null;
    if (this._missionsPanelOpen) {
      for (const [missionId, rect] of Object.entries(this._missionBtns)) {
        if (this._hitTest(x, y, rect) && this._inMissionsScroll(y)) {
          this._missionsHoveredId = missionId;
          break;
        }
      }
    }

    // Tier upgrade button tooltip — show what upgrades unlock at next tier
    if (this.isUpgradeHover && this.selectedBuilding && this._upgradesPanelOpen) {
      const building = this.economy.buildings[this.selectedBuilding];
      if (building && building.tier < building.maxTier) {
        const nextTier = building.tier + 1;
        const newUpgrades = [];
        for (const [id, def] of Object.entries(this.economy.upgradeCatalog)) {
          if (def.building === this.selectedBuilding && def.tier === nextTier) {
            newUpgrades.push(def.label);
          }
        }
        if (newUpgrades.length > 0) {
          this._tooltipLines = ["Available upon upgrade:", ...newUpgrades.map(u => "• " + u)];
          this._tooltipText = this._tooltipLines.join("\n");
          this._tooltipX = x;
          this._tooltipY = y;
        }
      }
    }

    // Shop hover + resource/action tooltips (only when Storage panel is open)
    this.resourceHover = null;
    let anyShopHover = false;
    for (const btnKey of Object.keys(this._shopBtns)) {
      const hit = this._storagePanelOpen && this._hitTest(x, y, this._shopBtns[btnKey]) && this._inStorageScroll(y);
      this.shopHover[btnKey] = hit;
      if (hit) {
        anyShopHover = true;
        const resourceKey = btnKey.split("_")[0];
        this.resourceHover = resourceKey;

        if (btnKey.endsWith("_total")) {
          const lines = this._getResourceTooltipLines(resourceKey);
          this._tooltipLines = lines;
        } else {
          this._tooltipLines = this._getResourceActionTooltip(btnKey);
        }

        this._tooltipText = this._tooltipLines ? this._tooltipLines.join("\n") : null;
        this._tooltipX = x;
        this._tooltipY = y;
      }
    }

    if (!anyShopHover && !this.isUpgradeHover) {
      this._tooltipText = null;
      this._tooltipLines = null;
    }

    // Repair hover
    for (const assetId of Object.keys(this._repairBtns)) {
      this.repairHover[assetId] = this._hitTest(x, y, this._repairBtns[assetId]) && this._inMaintenanceScroll(y);
    }

    // Skill unlock hover — show asset stats tooltip on whole skill row
    this.skillUnlockHover = null;
    if (this._upgradesPanelOpen) {
      for (const [skillId, rect] of Object.entries(this._skillRowRects ?? {})) {
        if (this._hitTest(x, y, rect) && this._inPanelScroll(y)) {
          this.skillUnlockHover = skillId;
          const skillInfo = this.economy.skillDisplayInfo?.[skillId];
          if (skillInfo?.tooltip?.length) {
            this._tooltipLines = [skillInfo.name + ":", ...skillInfo.tooltip.map(l => "  " + l)];
            this._tooltipText = this._tooltipLines.join("\n");
            this._tooltipX = x;
            this._tooltipY = y;
          }
          break;
        }
      }
    }

    // Feed crew hover
    this.feedCrewHover = this._feedCrewBtn
      ? (this._hitTest(x, y, this._feedCrewBtn) && this._inMaintenanceScroll(y))
      : false;

    // Individual upgrade hover
    this.upgradeItemHover = null;
    if (!this.isUpgradeHover && !this.resourceHover && !this.skillUnlockHover) { this._tooltipText = null; this._tooltipLines = null; }
    if (this._upgradesPanelOpen) {
      for (const [upgradeId, rect] of Object.entries(this._upgradeBtns)) {
        if (this._hitTest(x, y, rect) && this._inPanelScroll(y)) {
          this.upgradeItemHover = upgradeId;
          this._tooltipLines = this._getUpgradeTooltipLines(upgradeId);
          this._tooltipText = this._tooltipLines ? this._tooltipLines.join("\n") : this._getUpgradeTooltip(upgradeId);
          this._tooltipX = x;
          this._tooltipY = y;
          break;
        }
      }
    }

    // Tab hover
    this._tabHover = null;
    if (this._upgradesPanelOpen) {
      for (const [key, rect] of Object.entries(this._tabRects)) {
        if (this._hitTest(x, y, rect)) {
          this._tabHover = key;
          break;
        }
      }
    }

    // Tree hover — no longer shown (building buttons removed)
    this.hoveredBuilding = null;
  }

  handleKeyDown(evt) {
    if (evt.key === "Escape") {
      if (this._upgradesPanelOpen) {
        this._upgradesPanelOpen = false;
      } else {
        this.onBack?.();
      }
    }
    if (evt.key === "Enter") {
      this.onNavigate?.("missions");
    }
  }

  handleWheel(evt) {
    const delta = (evt.deltaY ?? 0) * 0.5;
    if (this._upgradesPanelOpen) {
      this._panelScrollOffset = Math.max(0, (this._panelScrollOffset ?? 0) + delta);
    } else if (this._maintenancePanelOpen) {
      this._maintenanceScrollOffset = Math.max(0, (this._maintenanceScrollOffset ?? 0) + delta);
    } else if (this._storagePanelOpen) {
      this._storageScrollOffset = Math.max(0, (this._storageScrollOffset ?? 0) + delta);
    } else if (this._missionsPanelOpen) {
      this._missionScrollOffset = Math.max(0, (this._missionScrollOffset ?? 0) + delta);
    }
  }

}
