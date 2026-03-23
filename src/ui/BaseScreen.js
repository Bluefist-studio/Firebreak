/**
 * BaseScreen — The firefighting base hub.
 * Shows buildings (facilities), resource summary, and the path to missions.
 * Flow: Main Menu → Base → Mission Select
 */
export class BaseScreen {
  constructor({ backgroundImage, economyState, onNavigate, onBack }) {
    this.backgroundImage = backgroundImage;
    this.economy = economyState;
    this.onNavigate = onNavigate; // "missions" → region map
    this.onBack = onBack;         // back → main menu

    // Interaction state
    this.hoveredBuilding = null;
    this.selectedBuilding = null;
    this.isMissionsHover = false;
    this.isBackHover = false;
    this.isUpgradeHover = false;

    // Resource shop button hover states
    this.shopHover = { fuel: false, retardant: false, food: false, parts: false };
    this._shopBtns = {};

    // Repair button hover states
    this.repairHover = {};
    this._repairBtns = {};

    // Panel close button
    this.isCloseHover = false;
    this._closeBtn = null;

    // Panel rect (for absorbing clicks inside the panel area)
    this._panelRect = null;

    // Feed crew button
    this.feedCrewHover = false;
    this._feedCrewBtn = null;

    // Individual upgrade item hover + button rects
    this.upgradeItemHover = null;
    this._upgradeBtns = {};

    // Tooltip state
    this._tooltipText = null;
    this._tooltipX = 0;
    this._tooltipY = 0;

    // ── Tutorial state ──
    this._tutorialStep = 0;  // 0 = not started / complete
    this._tutorialNextBtn = null;
    this._tutorialSteps = [
      {
        id: "welcome",
        title: "Welcome to Firebreak!",
        lines: [
          "You've been appointed to lead a wildfire suppression base.",
          "Your job: build facilities, equip your team, and protect the region.",
          "",
          "Let's walk through the basics.",
        ],
        nextLabel: "Next",
      },
      {
        id: "buildings",
        title: "Your Facilities",
        lines: [
          "Your base has several facilities, each with a role:",
          "",
          "Command Center — Strategic upgrades, logistics, and funding.",
          "Crew Facilities — Hire and manage fire crews.",
          "Intel Facility — Forecasting and recon capabilities.",
          "Vehicle Bay — Ground vehicles for suppression.",
          "Helipad — Helicopter operations.",
          "Airfield — Water Bomber sorties.",
          "",
          "Click a facility card to open its panel and upgrade it.",
        ],
        nextLabel: "Next",
      },
      {
        id: "resources",
        title: "Resources",
        lines: [
          "You'll manage four key resources:",
          "",
          "Fuel — Powers trucks, helicopters, and bombers.",
          "Retardant — Slows fire spread (used by air units).",
          "Food — Feeds your crew for readiness bonuses.",
          "Parts — Repairs damaged vehicles and aircraft.",
          "",
          "Buy resources from the shop at the bottom of the screen.",
        ],
        nextLabel: "Next",
      },
      {
        id: "buildVehicleBay",
        title: "Build the Vehicle Bay",
        lines: [
          "Time to get your first ground vehicle!",
          "",
          "Click the Vehicle Bay card, then press Build",
          "in the panel that opens.",
        ],
        highlight: "vehicleBay",
        waitFor: "vehicleBayBuilt",
      },
      {
        id: "upgradeCC",
        title: "Upgrade the Command Center",
        lines: [
          "Building a facility unlocks Command Center upgrades.",
          "",
          "Click the Command Center card, then press",
          "Upgrade to Tier 2.",
        ],
        highlight: "commandCenter",
        waitFor: "ccTier2",
      },
      {
        id: "done",
        title: "You're Ready!",
        lines: [
          "Great work! Your base is taking shape.",
          "",
          "Continue building, upgrading and buying resources.",
          "When you're ready, open the Missions menu",
          "to deploy and learn to fight your first fire.",
          "",
          "Good luck out there, Commander.",
        ],
        nextLabel: "Begin",
      },
    ];

    // Building layout — positions as fractions of canvas (set at render time)
    this.buildingKeys = [
      "commandCenter",
      "crewFacilities",
      "intelFacility",
      "vehicleBay",
      "helipad",
      "airfield",
    ];

    // ── Layout config ──
    // All positions are fractions of canvas width (x) and height (y).
    // Adjust these to position elements relative to the background image.
    this.layout = {
      // Money card
      moneyCard: { x: 0.525, y: 0.62, w: 0.191, h: 0.052 },

      // Building cards — each positioned individually (fraction of canvas)
      buildings: {
        cardW: 0.13,  // fraction of canvas width
        cardH: 0.11,  // fraction of canvas height
        commandCenter:  { x: 0.39,  y: 0.26 },
        crewFacilities: { x: 0.06,  y: 0.40 },
        intelFacility:  { x: 0.18,  y: 0.28 },
        vehicleBay:     { x: 0.65,  y: 0.26 },
        helipad:        { x: 0.71,  y: 0.45 },
        airfield:       { x: 0.32,  y: 0.11 },
      },

      // Resource shop — each button individually positioned
      resourceShop: {
        label:     { x: 0.5, y: 0.72 },  // "Resource Shop" label
        btnW: 0.180,  // button width (fraction of canvas)
        btnH: 0.043,  // button height (fraction of canvas)
        fuel:      { x: 0.116, y: 0.884 },
        retardant: { x: 0.309, y: 0.884 },
        food:      { x: 0.506, y: 0.884 },
        parts:     { x: 0.703, y: 0.884 },
      },



      // Selected facility panel
      facilityPanel: { x: 0.5, y: 0.14 },  // x = center, y = top

      // Back button
      backButton: { x: 0.02, y: 0.95 },  // fraction from top-left

      // Missions button
      missionsButton: { x: 0.55, y: 0.47 },  // fraction from top-right anchor
    };
  }

  onEnter() {
    this.selectedBuilding = null;
    this.hoveredBuilding = null;
    // Start tutorial on first visit
    if (!this.economy.tutorialComplete && this._tutorialStep === 0) {
      this._tutorialStep = 1;
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

    this._drawMoneyCard(ctx, w, h, scale);
    this._drawBuildings(ctx, w, h, scale);
    this._drawResourceShop(ctx, w, h, scale);
    this._drawMissionsButton(ctx, w, h, scale);
    this._drawBackButton(ctx, w, h, scale);

    // Tutorial overlay (drawn before panel so panel appears on top)
    if (this._tutorialStep > 0) {
      this._drawTutorial(ctx, w, h, scale);
    }

    this._drawSelectedPanel(ctx, w, h, scale);
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
    ctx.fillText(`$ ${this.economy.money.toLocaleString()}`, cx, cy + ch / 2);
  }

  // ── Building cards ──

  _getBuildingRect(key, w, h, scale) {
    const bL = this.layout.buildings;
    const pos = bL[key];
    if (!pos) return { x: 0, y: 0, w: 0, h: 0 };
    const cardW = Math.round(bL.cardW * w);
    const cardH = Math.round(bL.cardH * h);
    const x = Math.round(pos.x * w);
    const y = Math.round(pos.y * h);
    return { x, y, w: cardW, h: cardH };
  }

  _drawBuildings(ctx, w, h, scale) {
    for (const key of this.buildingKeys) {
      const rect = this._getBuildingRect(key, w, h, scale);
      const building = this.economy.buildings[key];
      const info = this.economy.buildingInfo[key];
      const available = this.economy.isBuildingAvailable(key);
      const isHovered = this.hoveredBuilding === key;
      const isSelected = this.selectedBuilding === key;

      // Card background
      let bgAlpha = 0.35;
      let glowColor = "rgba(255, 140, 0, 0.25)";
      if (!available) {
        bgAlpha = 0.5;
        glowColor = "rgba(80, 80, 80, 0.3)";
      } else if (isSelected) {
        bgAlpha = 0.6;
        glowColor = "rgba(255, 180, 50, 0.5)";
      } else if (isHovered) {
        bgAlpha = 0.5;
        glowColor = "rgba(255, 140, 0, 0.45)";
      }

      // Glow
      ctx.save();
      ctx.filter = "blur(8px)";
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.restore();

      // Card body
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? "rgba(255, 200, 50, 0.9)" : "rgba(16, 16, 16, 0.9)";
      ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Building name (wrapped)
      ctx.fillStyle = available ? "white" : "#666";
      const nameFont = `bold ${Math.max(13, Math.round(17 * scale))}px Arial`;
      ctx.font = nameFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const nameLines = this._wrapText(ctx, info.name, rect.w - 28);
      let textY = rect.y + 10;
      for (const line of nameLines) {
        ctx.fillText(line, rect.x + 14, textY);
        textY += Math.round(18 * scale);
      }

      // Tier display
      const tierText = building.tier === 0
        ? "Not Built"
        : (key === "commandCenter" ? `CC Tier ${building.tier}` : `Tier ${building.tier} / ${building.maxTier}`);
      ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.fillStyle = building.tier === 0 ? "#fc4" : "#ffa";
      ctx.fillText(tierText, rect.x + 14, textY + 2);
      textY += Math.round(16 * scale);

      // Role subtitle (wrapped)
      ctx.fillStyle = available ? "#aaa" : "#555";
      const roleFont = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.font = roleFont;
      const roleLines = this._wrapText(ctx, info.role, rect.w - 28);
      for (const line of roleLines) {
        ctx.fillText(line, rect.x + 14, textY);
        textY += Math.round(14 * scale);
      }

      // Unlocked assets indicator (wrapped)
      if (available && building.tier >= 1) {
        const assets = this._getAssetsForBuilding(key);
        if (assets.length > 0) {
          ctx.fillStyle = "#8f8";
          const assetFont = `${Math.max(9, Math.round(11 * scale))}px Arial`;
          ctx.font = assetFont;
          const assetText = assets.join(", ");
          const assetLines = this._wrapText(ctx, assetText, rect.w - 28);
          let ay = rect.y + rect.h - 8 - assetLines.length * Math.round(13 * scale);
          for (const line of assetLines) {
            ctx.fillText(line, rect.x + 14, ay);
            ay += Math.round(13 * scale);
          }
        }
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
    } else if (key === "intelFacility") {
      if (e.hasDroneRecon) assets.push("Drone Recon");
      if (e.hasReconPlane) assets.push("Recon Plane");
    } else if (key === "vehicleBay") {
      if (e.hasEngineTruck) assets.push("Fire Truck");
      if (e.hasSprinklerTrailer) assets.push("Sprinkler");
      if (e.hasBulldozer) assets.push("Bulldozer");
    } else if (key === "helipad") {
      if (e.hasHelicopter) assets.push("Helicopter");
    } else if (key === "airfield") {
      if (e.hasWaterBomber) assets.push("Water Bomber");
    }
    return assets;
  }

  // ── Resource shop (buy fuel/retardant/food/parts) ──

  _drawResourceShop(ctx, w, h, scale) {
    const e = this.economy;
    const resources = [
      { key: "fuel",      label: "Fuel",      current: e.fuel,      cap: e.fuelCap,      price: e.prices.fuel,      color: "#f90" },
      { key: "retardant", label: "Retardant", current: e.retardant, cap: e.retardantCap, price: e.prices.retardant, color: "#f44" },
      { key: "food",      label: "Food",      current: e.food,      cap: e.foodCap,      price: e.prices.food,      color: "#4c4" },
      { key: "parts",     label: "Parts",     current: e.parts,     cap: e.partsCap,     price: e.prices.parts,     color: "#88f" },
    ];

    const shopL = this.layout.resourceShop;
    const btnW = Math.round(shopL.btnW * w);
    const btnH = Math.round(shopL.btnH * h);

    // Section label
    ctx.fillStyle = "#ddd";
    ctx.font = `bold ${Math.max(12, Math.round(14 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Resource Shop", Math.round(shopL.label.x * w), Math.round(shopL.label.y * h));

    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      const pos = shopL[r.key];
      if (!pos) continue;
      const bx = Math.round(pos.x * w);
      const by = Math.round(pos.y * h);
      const hovered = this.shopHover[r.key];
      const canBuy = e.money >= r.price && r.current < r.cap;

      this._shopBtns[r.key] = { x: bx, y: by, w: btnW, h: btnH };

      // Button background
      ctx.save();
      if (hovered && canBuy) {
        ctx.filter = "blur(6px)";
        ctx.fillStyle = "rgba(255, 200, 80, 0.3)";
        ctx.beginPath();
        ctx.roundRect(bx, by, btnW, btnH, 10);
        ctx.fill();
        ctx.restore();
        ctx.save();
      }
      ctx.fillStyle = canBuy ? "rgba(20, 30, 20, 0.85)" : "rgba(30, 30, 30, 0.85)";
      ctx.strokeStyle = canBuy ? r.color : "rgba(80, 80, 80, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Label + count
      ctx.fillStyle = canBuy ? "#fff" : "#666";
      ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${r.label}: ${r.current}/${r.cap}`, bx + btnW / 2, by + 6);

      // Price
      ctx.fillStyle = canBuy ? "#ccc" : "#555";
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.fillText(`Buy +1  ($${r.price})`, bx + btnW / 2, by + 26);
    }

  }

  // ── Selected building detail panel ──

  _drawSelectedPanel(ctx, w, h, scale) {
    if (!this.selectedBuilding) {
      this._upgradeBtn = null;
      this._upgradeBtns = {};
      this._repairBtns = {};
      this._feedCrewBtn = null;
      return;
    }

    const building = this.economy.buildings[this.selectedBuilding];
    const info = this.economy.buildingInfo[this.selectedBuilding];
    const available = this.economy.isBuildingAvailable(this.selectedBuilding);

    // Get upgrades for this building
    const upgrades = available ? this.economy.getUpgradesForBuilding(this.selectedBuilding) : [];
    const unpurchased = upgrades.filter(u => !u.purchased);
    const purchasedCount = upgrades.filter(u => u.purchased).length;

    // Dynamic panel height based on upgrade count and asset info
    const upgradeRowH = Math.max(22, Math.round(26 * scale));
    // Estimate extra height for CC info + asset stats
    let extraInfoH = 0;
    if (this.selectedBuilding === "commandCenter") extraInfoH += 54;
    const assetStatsPreview = this._getAssetStatsForBuilding(this.selectedBuilding);
    if (assetStatsPreview.length > 0) {
      extraInfoH += 16; // "Asset Info:" header
      for (const stat of assetStatsPreview) {
        extraInfoH += 14 + stat.lines.length * 13 + 2;
      }
    }
    const baseH = Math.max(160, Math.round(180 * scale)) + extraInfoH;
    const upgradeListH = unpurchased.length > 0
      ? Math.round(28 * scale) + unpurchased.length * upgradeRowH
      : 0;
    // Extra height for feed crew (crewFacilities) and repair buttons
    const feedCrewSectionH = this.selectedBuilding === "crewFacilities" ? Math.round(56 * scale) : 0;
    const repairableAssets = this._getDurabilityAssetsForBuilding(this.selectedBuilding);
    const repairRowH = Math.max(32, Math.round(38 * scale));
    const repairSectionH = repairableAssets.length > 0
      ? Math.round(28 * scale) + repairableAssets.length * (repairRowH + 4)
      : 0;
    const panelH = baseH + upgradeListH + feedCrewSectionH + repairSectionH;
    const panelW = Math.max(340, Math.round(540 * scale));
    const panelX = Math.round(this.layout.facilityPanel.x * w) - panelW / 2;
    const panelY = Math.round(this.layout.facilityPanel.y * h);

    this._panelRect = { x: panelX, y: panelY, w: panelW, h: panelH };

    // Panel background
    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
    ctx.strokeStyle = "rgba(255, 200, 50, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // Close (X) button — top-right of panel
    const closeBtnSize = Math.max(22, Math.round(28 * scale));
    const closeBtnX = panelX + panelW - closeBtnSize - 8;
    const closeBtnY = panelY + 8;
    this._closeBtn = { x: closeBtnX, y: closeBtnY, w: closeBtnSize, h: closeBtnSize };

    ctx.save();
    ctx.fillStyle = this.isCloseHover ? "rgba(255, 80, 80, 0.5)" : "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 6);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = this.isCloseHover ? "#fff" : "#aaa";
    ctx.font = `bold ${Math.max(14, Math.round(18 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u00D7", closeBtnX + closeBtnSize / 2, closeBtnY + closeBtnSize / 2);

    // Title
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(info.name, panelX + 18, panelY + 14);

    // Tier
    ctx.font = `${Math.max(12, Math.round(15 * scale))}px Arial`;
    ctx.fillStyle = "#ffa";
    const tierLabel = building.tier === 0
      ? "Not Built"
      : (this.selectedBuilding === "commandCenter" ? `CC Tier ${building.tier} (auto-upgrades)` : `Tier ${building.tier} / ${building.maxTier}`);
    ctx.fillText(tierLabel, panelX + 18, panelY + 42);

    // Role
    ctx.fillStyle = "#aaa";
    ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
    ctx.fillText(info.role, panelX + 18, panelY + 66);

    // Assets unlocked
    const assets = this._getAssetsForBuilding(this.selectedBuilding);
    if (assets.length > 0) {
      ctx.fillStyle = "#8f8";
      ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText("Assets: " + assets.join(", "), panelX + 18, panelY + 90);
    }

    // Command Center specific info (building slots + fallback funding)
    let infoY = 110;
    if (this.selectedBuilding === "commandCenter") {
      const builtCount = ["intelFacility", "vehicleBay", "helipad", "airfield"]
        .filter(id => this.economy.buildings[id].tier >= 1).length;
      ctx.fillStyle = "#cdf";
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText(`Facilities Built: ${builtCount}/4 — build more to unlock CC tiers`, panelX + 18, panelY + infoY);
      infoY += 24;
      ctx.fillStyle = "#FFD54F";
      ctx.fillText(`Fallback Funding: $${this.economy.getFallbackFunding().toLocaleString()}`, panelX + 18, panelY + infoY);
      infoY += 24;
      ctx.fillStyle = "#aaa";
      ctx.fillText(`Loadout Slots: ${this.economy.loadoutSlots}`, panelX + 18, panelY + infoY);
      infoY += 24;
    }

    // Asset stats for this building
    const assetStats = this._getAssetStatsForBuilding(this.selectedBuilding);
    if (assetStats.length > 0) {
      ctx.fillStyle = "#bbb";
      ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText("Asset Info:", panelX + 18, panelY + infoY);
      infoY += 20;
      ctx.font = `${Math.max(9, Math.round(11 * scale))}px Arial`;
      for (const stat of assetStats) {
        ctx.fillStyle = "#ddd";
        ctx.fillText(`${stat.name}:`, panelX + 22, panelY + infoY);
        infoY += 16;
        ctx.fillStyle = "#aaa";
        for (const line of stat.lines) {
          ctx.fillText(`  ${line}`, panelX + 26, panelY + infoY);
          infoY += 15;
        }
        infoY += 4;
      }
    }

    // Durability info for relevant assets
    const durabilityAssets = this._getDurabilityAssetsForBuilding(this.selectedBuilding);
    if (durabilityAssets.length > 0) {
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      for (const { name, id } of durabilityAssets) {
        const dur = this.economy.assetDurability[id] ?? 0;
        ctx.fillStyle = dur > 50 ? "#8f8" : dur > 25 ? "#ff8" : "#f88";
        ctx.textAlign = "left";
        ctx.fillText(`${name}: ${dur}/100 durability`, panelX + 18, panelY + infoY);
        infoY += 24;
      }
    }

    // Upgrade tier button
    if (available && building.tier < building.maxTier) {
      const canUpgrade = this.economy.canUpgradeTier(this.selectedBuilding);
      const cost = this.economy.getTierUpgradeCost(this.selectedBuilding);
      const btnW = Math.max(140, Math.round(200 * scale));
      const btnH = Math.max(28, Math.round(34 * scale));
      const btnX = panelX + 18;
      const btnY = panelY + infoY + 6;

      this._upgradeBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.save();
      if (this.isUpgradeHover && canUpgrade) {
        ctx.filter = "blur(6px)";
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
      infoY = btnY - panelY + btnH + 10;
    } else {
      this._upgradeBtn = null;
      infoY += 10;
    }

    // ── Individual upgrades list ──
    this._upgradeBtns = {};
    if (unpurchased.length > 0) {
      ctx.fillStyle = "#ddd";
      ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const headerText = purchasedCount > 0
        ? `Upgrades (${purchasedCount} owned)`
        : "Upgrades";
      ctx.fillText(headerText, panelX + 18, panelY + infoY);
      infoY += Math.round(22 * scale);

      const entryW = panelW - 36;
      for (const upg of unpurchased) {
        const ey = panelY + infoY;
        const canBuy = this.economy.canBuyUpgrade(upg.id);
        const isHov = this.upgradeItemHover === upg.id;

        this._upgradeBtns[upg.id] = { x: panelX + 18, y: ey, w: entryW, h: upgradeRowH };

        // Row background on hover
        if (isHov && canBuy) {
          ctx.fillStyle = "rgba(255, 200, 80, 0.15)";
          ctx.beginPath();
          ctx.roundRect(panelX + 14, ey - 1, entryW + 8, upgradeRowH, 6);
          ctx.fill();
        }

        // Label
        const prereq = this.economy._getUpgradePrerequisite(upg.id);
        const needsPrereq = prereq && !this.economy.upgrades.has(prereq);
        ctx.fillStyle = canBuy ? "#fff" : "#777";
        ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let labelText = upg.label;
        if (needsPrereq) {
          const prereqDef = this.economy.upgradeCatalog[prereq];
          labelText += prereqDef ? ` (need ${prereqDef.label})` : "";
        }
        ctx.fillText(labelText, panelX + 22, ey + 3);

        // Cost (right-aligned)
        ctx.fillStyle = canBuy ? "#fc4" : "#665";
        ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign = "right";
        ctx.fillText(`$${upg.cost.toLocaleString()}`, panelX + 18 + entryW, ey + 3);

        infoY += upgradeRowH;
      }
    } else if (purchasedCount > 0 && unpurchased.length === 0) {
      ctx.fillStyle = "#8f8";
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`All ${purchasedCount} upgrades purchased!`, panelX + 18, panelY + infoY);
      infoY += 20;
    }

    // ── Feed Crew (inside Crew Facilities panel) ──
    this._feedCrewBtn = null;
    if (this.selectedBuilding === "crewFacilities") {
      const fed = this.economy.crewFedStatus;
      const canFeed = this.economy.food > 0 && fed < 100;
      const feedBtnW = panelW - 36;
      const feedBtnH = Math.max(32, Math.round(40 * scale));
      const feedBtnX = panelX + 18;
      const feedBtnY = panelY + infoY + 6;
      this._feedCrewBtn = { x: feedBtnX, y: feedBtnY, w: feedBtnW, h: feedBtnH };

      ctx.fillStyle = canFeed ? "rgba(20, 40, 20, 0.85)" : "rgba(30, 30, 30, 0.7)";
      ctx.strokeStyle = fed >= 76 ? "#8f8" : fed >= 51 ? "#ff8" : fed >= 1 ? "#f88" : "#f44";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(feedBtnX, feedBtnY, feedBtnW, feedBtnH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = canFeed ? "#fff" : "#888";
      ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `Crew: ${fed}%  ${canFeed ? "— Feed (1 Food = +20)" : fed >= 100 ? "(Full)" : "(No Food)"}`,
        feedBtnX + feedBtnW / 2, feedBtnY + feedBtnH / 2
      );
      infoY = feedBtnY - panelY + feedBtnH + 10;
    }

    // ── Repair buttons (inside facility panel for that facility's assets) ──
    this._repairBtns = {};
    if (repairableAssets.length > 0) {
      ctx.fillStyle = "#ddd";
      ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Repair (1 Part = 5 Durability)", panelX + 18, panelY + infoY);
      infoY += Math.round(22 * scale);

      const rBtnW = panelW - 36;
      for (const asset of repairableAssets) {
        const ry = panelY + infoY;
        const dur = this.economy.assetDurability[asset.id] ?? 0;
        const needsRepair = dur < 100;
        const canRepair = needsRepair && this.economy.parts > 0;
        const hovered = this.repairHover[asset.id];

        this._repairBtns[asset.id] = { x: panelX + 18, y: ry, w: rBtnW, h: repairRowH };

        if (hovered && canRepair) {
          ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
          ctx.beginPath();
          ctx.roundRect(panelX + 14, ry - 1, rBtnW + 8, repairRowH, 6);
          ctx.fill();
        }

        ctx.fillStyle = canRepair ? "rgba(20, 25, 40, 0.85)" : "rgba(30, 30, 30, 0.85)";
        ctx.strokeStyle = dur > 50 ? "#8f8" : dur > 25 ? "#ff8" : "#f88";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX + 18, ry, rBtnW, repairRowH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = canRepair ? "#fff" : "#888";
        ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(asset.name, panelX + 26, ry + repairRowH / 2);

        ctx.textAlign = "right";
        ctx.fillStyle = dur >= 100 ? "#8f8" : canRepair ? "#ccc" : "#666";
        ctx.font = `${Math.max(9, Math.round(11 * scale))}px Arial`;
        ctx.fillText(
          dur >= 100 ? "Full (100)" : `${dur}/100 — Repair`,
          panelX + 18 + rBtnW - 8, ry + repairRowH / 2
        );

        infoY += repairRowH + 4;
      }
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
    } else if (key === "airfield") {
      if (this.economy.hasWaterBomber) list.push({ name: "Water Bomber", id: "waterBomber" });
    } else if (key === "intelFacility") {
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
    } else if (key === "intelFacility") {
      stats.push({ name: "Drone Recon", lines: [
        "Temporary movable recon — reveals area for 45s",
        "Cost: 1 Food wear | Cooldown: 10s",
        "Can be repositioned while active",
      ]});
      if (this.economy.hasReconPlane) {
        stats.push({ name: "Recon Plane", lines: [
          "Large-scale strategic recon sweep",
          "Cost: $2,000 per deployment | 1 wear",
          "Durability: 100 | Reveals wide area",
        ]});
      }
    } else if (key === "vehicleBay") {
      stats.push({ name: "Fire Truck", lines: [
        "Small area fire suppression zone",
        "Cost: 1 Fuel/use | 1 wear/4s",
        "Durability: 100",
      ]});
      if (this.economy.hasSprinklerTrailer) {
        stats.push({ name: "Sprinkler Trailer", lines: [
          "Placed water sprinkler — wets area over time",
          "Cost: none | 1 wear/activation",
          "Durability: 100",
        ]});
      }
      if (this.economy.hasBulldozer) {
        stats.push({ name: "Bulldozer", lines: [
          "Clears firebreak lines — uses energy bar",
          "Cost: 1 Fuel/s active | 1 wear/4s",
          "Durability: 100 | Energy: recharges when idle",
        ]});
      }
    } else if (key === "helipad") {
      stats.push({ name: "Helicopter", lines: [
        "Aerial water/retardant drop",
        "Water: 5 Fuel | Retardant: 5 Fuel + 2 Ret",
        "Durability: 100 | 2 wear/deployment",
      ]});
    } else if (key === "airfield") {
      stats.push({ name: "Water Bomber", lines: [
        "Heavy aerial suppression sortie",
        "Water: 8 Fuel | Retardant: 8 Fuel + 4 Ret",
        "Durability: 100 | 3 wear/sortie",
      ]});
    }
    return stats;
  }

  _getUpgradeTooltip(upgradeId) {
    const tooltips = {
      // Command Center
      betterForecast:    "Shows more weather detail in the pre-mission briefing.",
      moreChoices1:      "Adds an extra mission choice when selecting missions.",
      moreChoices2:      "Adds another mission choice (stacks with I).",
      // Crew Facilities
      fasterCutting:     "Fire Crew cuts firebreaks 40% faster.",
      reducedUnderfed1:  "Reduces crew hunger cooldown penalty by 1s.",
      reducedUnderfed2:  "Reduces crew hunger cooldown penalty by 1s more.",
      foodStorage2:      "Increases food storage to 18. (CC Tier 2)",
      foodStorage3:      "Increases food storage to 28. (CC Tier 3)",
      crewAvail1:        "Adds +1 charge to Fire Crew, Fire Watch, and Drone Recon.",
      crewAvail2:        "Adds +1 charge (stacks with I).",
      fireWatchSight1:   "Fire Watch reveal radius +60.",
      fireWatchSight2:   "Fire Watch reveal radius +60 more.",
      crewRecovery:      "All crew cooldowns reduced by 25%.",
      lowerFoodCons1:    "Reduces food wear from crew skills by 30%.",
      lowerFoodCons2:    "Reduces food wear further (stacks with I).",
      // Intel Facility
      weatherForecast:   "Enables weather forecast display during missions.",
      droneRadius1:      "Drone Recon reveal radius +50.",
      droneRadius2:      "Drone Recon reveal radius +50 more.",
      droneDuration1:    "Drone Recon stays active 15s longer.",
      droneDuration2:    "Drone Recon stays active 15s longer (stacks with I).",
      droneControl:      "Drone moves 50% faster when repositioned.",
      reconScanRadius:   "Recon Plane reveals a larger area.",
      reconDuration:     "Recon Plane reveal lasts longer.",
      perfectForecast:   "Shows exact wind and weather for the whole mission.",
      // Vehicle Bay
      engineOutput:      "Fire Truck suppresses fire faster.",
      engineMobility:    "Fire Truck has a larger action radius.",
      engineRecharge:    "Fire Truck cooldown recharges faster.",
      sprinklerRadius:   "Sprinkler Trailer covers a wider area.",
      sprinklerDur:      "Sprinkler Trailer lasts longer before deactivating.",
      sprinklerCooldown: "Sprinkler Trailer cooldown reduced.",
      vehicleWear1:      "All vehicle wear reduced by 30%.",
      vehicleWear2:      "All vehicle wear reduced further (stacks with I).",
      vehicleFuelEff1:   "All vehicle fuel consumption reduced by 30%.",
      vehicleFuelEff2:   "All vehicle fuel consumption reduced further (stacks).",
      fuelStorage2:      "Increases fuel storage to 35. (CC Tier 2)",
      fuelStorage3:      "Increases fuel storage to 50. (CC Tier 3)",
      fuelStorage4:      "Increases fuel storage to 70. (CC Tier 4)",
      partsStorage2:     "Increases parts storage to 18. (CC Tier 2)",
      partsStorage3:     "Increases parts storage to 28. (CC Tier 3)",
      dozerSpeed:        "Bulldozer clears ground faster.",
      dozerLineWidth:    "Bulldozer cuts a wider firebreak.",
      dozerRecharge:     "Bulldozer energy recharges faster.",
      // Helipad
      heliFuelEff:       "Helicopter uses less fuel per deployment.",
      heliDurability:    "Helicopter takes less wear per deployment.",
      heliSuppression:   "Helicopter suppression covers a larger zone.",
      heliTurnaround1:   "Helicopter turnaround time reduced.",
      heliTurnaround2:   "Helicopter turnaround reduced further.",
      // Airfield
      bomberFuelEff:     "Water Bomber uses less fuel per sortie.",
      bomberRetEff:      "Water Bomber uses less retardant per sortie.",
      bomberDurability:  "Water Bomber takes less wear per sortie.",
      bomberTurnaround:  "Water Bomber turnaround time reduced.",
      retStorage2:       "Increases retardant storage to 14. (CC Tier 2)",
      retStorage3:       "Increases retardant storage to 20. (CC Tier 3)",
      retStorage4:       "Increases retardant storage to 28. (CC Tier 4)",
      bomberDrop1:       "Water Bomber drop covers a larger area.",
      bomberDrop2:       "Water Bomber drop area increased further.",
    };
    return tooltips[upgradeId] || null;
  }

  _getUpgradeTooltipLines(upgradeId) {
    const desc = this._getUpgradeTooltip(upgradeId);
    if (!desc) return null;
    const def = this.economy.upgradeCatalog[upgradeId];
    if (!def) return [desc];
    const lines = [desc];
    const bldgName = this.economy.buildingInfo[def.building]?.name || def.building;
    lines.push(`Requires: ${bldgName} Tier ${def.tier}`);
    const prereqId = this.economy._getUpgradePrerequisite(upgradeId);
    if (prereqId) {
      const prereqDef = this.economy.upgradeCatalog[prereqId];
      lines.push(`Requires: ${prereqDef?.label || prereqId}`);
    }
    lines.push(`Cost: $${def.cost.toLocaleString()}`);
    return lines;
  }

  _drawTooltip(ctx, w, h, scale) {
    if (!this._tooltipText || (!this.upgradeItemHover && !this.isUpgradeHover)) return;

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

  // ── Tutorial overlay ──

  _drawTutorial(ctx, w, h, scale) {
    const step = this._tutorialSteps[this._tutorialStep - 1];
    if (!step) return;

    // If highlighting a building, draw a dashed border around it (no dim background)
    if (step.highlight) {
      const rect = this._getBuildingRect(step.highlight, w, h, scale);
      const pad = 10;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 200, 50, 0.9)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.roundRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, 16);
      ctx.stroke();
      ctx.restore();
    }

    // Message box — shift down when a building panel is open
    const boxW = Math.min(Math.round(520 * scale), w * 0.45);
    const lineH = Math.round(20 * scale);
    const boxH = Math.round(60 * scale) + step.lines.length * lineH + (step.nextLabel ? Math.round(50 * scale) : 0);
    const boxX = (w - boxW) / 2;
    const boxY = this.selectedBuilding ? h * 0.72 - boxH / 2 : (h - boxH) / 2;

    ctx.save();
    ctx.fillStyle = "rgba(10, 15, 10, 0.93)";
    ctx.strokeStyle = "rgba(255, 200, 50, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Step indicator
    ctx.fillStyle = "#888";
    ctx.font = `${Math.max(10, Math.round(11 * scale))}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${this._tutorialStep} / ${this._tutorialSteps.length}`, boxX + boxW - 16, boxY + 12);

    // Title
    ctx.fillStyle = "#fc4";
    ctx.font = `bold ${Math.max(16, Math.round(22 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(step.title, boxX + boxW / 2, boxY + 14);

    // Body lines
    ctx.fillStyle = "#ddd";
    ctx.font = `${Math.max(12, Math.round(15 * scale))}px Arial`;
    ctx.textAlign = "center";
    let ly = boxY + Math.round(50 * scale);
    for (const line of step.lines) {
      ctx.fillText(line, boxX + boxW / 2, ly);
      ly += lineH;
    }

    // "Next" / "Begin" button (only for non-waitFor steps)
    this._tutorialNextBtn = null;
    if (step.nextLabel) {
      const nbW = Math.round(140 * scale);
      const nbH = Math.round(38 * scale);
      const nbX = boxX + (boxW - nbW) / 2;
      const nbY = ly + Math.round(10 * scale);
      this._tutorialNextBtn = { x: nbX, y: nbY, w: nbW, h: nbH };

      ctx.fillStyle = "rgba(40, 80, 40, 0.9)";
      ctx.strokeStyle = "rgba(100, 200, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(nbX, nbY, nbW, nbH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(13, Math.round(16 * scale))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(step.nextLabel, nbX + nbW / 2, nbY + nbH / 2);
    }
  }

  // ── Back button ──

  _drawBackButton(ctx, w, h, scale) {
    const btnW = Math.max(80, Math.round(110 * scale));
    const btnH = Math.max(28, Math.round(38 * scale));
    const btnX = Math.round(this.layout.backButton.x * w);
    const btnY = Math.round(this.layout.backButton.y * h) - btnH;
    this._backBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = this.isBackHover ? "rgba(255, 140, 0, 0.45)" : "rgba(255, 140, 0, 0.25)";
    ctx.strokeStyle = "rgba(16, 16, 16, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.max(13, Math.round(16 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Back", btnX + btnW / 2, btnY + btnH / 2);
  }

  // ── Missions button ──

  _drawMissionsButton(ctx, w, h, scale) {
    const btnW = Math.max(140, Math.round(200 * scale));
    const btnH = Math.max(36, Math.round(48 * scale));
    const btnX = Math.round(this.layout.missionsButton.x * w) - btnW;
    const btnY = Math.round(this.layout.missionsButton.y * h) - btnH;
    this._missionsBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = this.isMissionsHover ? "rgba(255, 180, 50, 0.5)" : "rgba(255, 140, 0, 0.3)";
    ctx.strokeStyle = "rgba(16, 16, 16, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = this.isMissionsHover ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = "rgba(16, 16, 16, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.max(15, Math.round(20 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Missions", btnX + btnW / 2, btnY + btnH / 2);
  }

  // ── Input handling ──

  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  handlePointerDown(x, y, evt) {
    const canvas = evt?.target;
    const w = canvas?.width ?? 1280;
    const h = canvas?.height ?? 720;
    const scale = Math.min(w / 1280, h / 720, 2);

    // ── Tutorial input handling ──
    if (this._tutorialStep > 0) {
      const step = this._tutorialSteps[this._tutorialStep - 1];

      // "Next" / "Begin" button click
      if (step.nextLabel && this._hitTest(x, y, this._tutorialNextBtn)) {
        this._advanceTutorial();
        return;
      }

      // For "waitFor" steps, allow clicking the highlighted building + panel interactions
      if (step.waitFor) {
        if (this.selectedBuilding) {
          // Panel is open — handle panel interactions first
          if (this._hitTest(x, y, this._closeBtn)) {
            this.selectedBuilding = null;
            return;
          }
          if (this._hitTest(x, y, this._upgradeBtn)) {
            this.economy.upgradeTier(this.selectedBuilding);
            this._checkTutorialWaitCondition();
            return;
          }
          // Click inside panel — absorb
          if (this._hitTest(x, y, this._panelRect)) {
            return;
          }
          // Click outside panel — close it
          this.selectedBuilding = null;
          return;
        }
        // No panel open — allow building card click to open it
        if (step.highlight) {
          const rect = this._getBuildingRect(step.highlight, w, h, scale);
          if (this._hitTest(x, y, rect)) {
            this.selectedBuilding = step.highlight;
            return;
          }
        }
        // Block everything else during waitFor steps
        return;
      }

      // For non-waitFor, non-nextLabel steps, any click advances
      return;
    }

    // Back button
    if (this._hitTest(x, y, this._backBtn)) {
      this.onBack?.();
      return;
    }

    // Missions button (blocked when a facility panel is open)
    if (!this.selectedBuilding && this._hitTest(x, y, this._missionsBtn)) {
      this.onNavigate?.("missions");
      return;
    }

    // Close button in panel
    if (this.selectedBuilding && this._hitTest(x, y, this._closeBtn)) {
      this.selectedBuilding = null;
      return;
    }

    // Upgrade button in panel
    if (this.selectedBuilding && this._hitTest(x, y, this._upgradeBtn)) {
      this.economy.upgradeTier(this.selectedBuilding);
      return;
    }

    // Individual upgrade purchase buttons
    for (const [upgradeId, rect] of Object.entries(this._upgradeBtns)) {
      if (this._hitTest(x, y, rect)) {
        this.economy.buyUpgrade(upgradeId);
        return;
      }
    }

    // Resource shop buttons
    for (const key of ["fuel", "retardant", "food", "parts"]) {
      if (this._hitTest(x, y, this._shopBtns[key])) {
        this.economy.buyResource(key, 1);
        return;
      }
    }

    // Repair buttons
    for (const [assetId, rect] of Object.entries(this._repairBtns)) {
      if (this._hitTest(x, y, rect)) {
        this.economy.repairAsset(assetId, 1);
        return;
      }
    }

    // Feed crew button
    if (this._feedCrewBtn && this._hitTest(x, y, this._feedCrewBtn)) {
      this.economy.feedCrew();
      return;
    }

    // Building cards — only when no panel is open
    if (!this.selectedBuilding) {
      for (const key of this.buildingKeys) {
        const rect = this._getBuildingRect(key, w, h, scale);
        if (this._hitTest(x, y, rect)) {
          this.selectedBuilding = key;
          return;
        }
      }
    }

    // Click inside panel — absorb without deselecting
    if (this.selectedBuilding && this._hitTest(x, y, this._panelRect)) {
      return;
    }

    // Click outside — deselect
    if (this.selectedBuilding) {
      this.selectedBuilding = null;
    }
  }

  handlePointerMove(x, y, evt) {
    const canvas = evt?.target;
    const w = canvas?.width ?? 1280;
    const h = canvas?.height ?? 720;
    const scale = Math.min(w / 1280, h / 720, 2);

    this.isBackHover = this._hitTest(x, y, this._backBtn);
    this.isMissionsHover = this._hitTest(x, y, this._missionsBtn);
    this.isUpgradeHover = this._hitTest(x, y, this._upgradeBtn);
    this.isCloseHover = this._hitTest(x, y, this._closeBtn);

    // Tier upgrade button tooltip — show what upgrades unlock at next tier
    if (this.isUpgradeHover && this.selectedBuilding) {
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

    // Shop hover
    for (const key of ["fuel", "retardant", "food", "parts"]) {
      this.shopHover[key] = this._hitTest(x, y, this._shopBtns[key]);
    }

    // Repair hover
    for (const assetId of Object.keys(this._repairBtns)) {
      this.repairHover[assetId] = this._hitTest(x, y, this._repairBtns[assetId]);
    }

    // Feed crew hover
    this.feedCrewHover = this._feedCrewBtn ? this._hitTest(x, y, this._feedCrewBtn) : false;

    // Individual upgrade hover
    this.upgradeItemHover = null;
    if (!this.isUpgradeHover) { this._tooltipText = null; this._tooltipLines = null; }
    for (const [upgradeId, rect] of Object.entries(this._upgradeBtns)) {
      if (this._hitTest(x, y, rect)) {
        this.upgradeItemHover = upgradeId;
        this._tooltipLines = this._getUpgradeTooltipLines(upgradeId);
        this._tooltipText = this._tooltipLines ? this._tooltipLines.join("\n") : this._getUpgradeTooltip(upgradeId);
        this._tooltipX = x;
        this._tooltipY = y;
        break;
      }
    }

    // Building hover
    this.hoveredBuilding = null;
    for (const key of this.buildingKeys) {
      const rect = this._getBuildingRect(key, w, h, scale);
      if (this._hitTest(x, y, rect)) {
        this.hoveredBuilding = key;
        break;
      }
    }
  }

  handleKeyDown(evt) {
    // During tutorial, Escape does nothing; Enter/Space can advance text steps
    if (this._tutorialStep > 0) {
      const step = this._tutorialSteps[this._tutorialStep - 1];
      if ((evt.key === "Enter" || evt.key === " ") && step.nextLabel) {
        this._advanceTutorial();
      }
      return;
    }

    if (evt.key === "Escape") {
      if (this.selectedBuilding) {
        this.selectedBuilding = null;
      } else {
        this.onBack?.();
      }
    }
    if (evt.key === "Enter") {
      this.onNavigate?.("missions");
    }
  }

  // ── Tutorial helpers ──

  _advanceTutorial() {
    if (this._tutorialStep >= this._tutorialSteps.length) {
      // Last step — finish tutorial
      this._tutorialStep = 0;
      this.economy.tutorialComplete = true;
      this.selectedBuilding = null;
      return;
    }
    this._tutorialStep++;
    this.selectedBuilding = null;
    // If the new step is the last "done" step, no special handling needed
  }

  _checkTutorialWaitCondition() {
    const step = this._tutorialSteps[this._tutorialStep - 1];
    if (!step?.waitFor) return;

    let satisfied = false;
    if (step.waitFor === "vehicleBayBuilt") {
      satisfied = this.economy.buildings.vehicleBay.tier >= 1;
    } else if (step.waitFor === "ccTier2") {
      satisfied = this.economy.buildings.commandCenter.tier >= 2;
    }

    if (satisfied) {
      this._advanceTutorial();
    }
  }
}
