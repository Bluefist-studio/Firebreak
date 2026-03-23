/**
 * EconomyState — persistent progression state that survives across missions.
 * Tracks money, resources, building tiers, upgrades, and asset unlocks.
 */
export class EconomyState {
  constructor() {
    // ── Money ──
    this.money = 12000; // Starting money for a new game

    // ── Tutorial ──
    this.tutorialComplete = false;

    // ── Resources (current amounts) ──
    this.fuel = 15;
    this.retardant = 0;
    this.food = 2;
    this.parts = 2;

    // ── Resource prices ──
    this.prices = {
      fuel: 200,
      retardant: 500,
      food: 100,
      parts: 400,
    };

    // ── Storage cap tables (indexed by highest unlocked storage tier) ──
    this.storageTiers = {
      fuel:      [20, 35, 50, 70],   // Storage I–IV
      retardant: [8, 14, 20, 28],    // Storage I–IV
      food:      [10, 18, 28],       // Storage I–III
      parts:     [10, 18, 28],       // Storage I–III
    };

    // ── Storage upgrade levels (0-based index into storageTiers) ──
    this.storageLevel = {
      fuel: 0,      // starts at Storage I
      retardant: 0,
      food: 0,
      parts: 0,
    };

    // ── Building tiers (1 = unlocked at tier 1, 0 = not built) ──
    this.buildings = {
      commandCenter:   { tier: 1, maxTier: 4 },  // Starting building
      crewFacilities:  { tier: 1, maxTier: 4 },  // Starting building
      intelFacility:   { tier: 0, maxTier: 3 },  // Buildable
      vehicleBay:      { tier: 0, maxTier: 4 },  // Buildable
      helipad:         { tier: 0, maxTier: 3 },  // Buildable
      airfield:        { tier: 0, maxTier: 4 },  // Buildable
    };

    // ── Building tier costs (includes tier 1 = build cost) ──
    this.tierCosts = {
      commandCenter:  { 2: 0, 3: 0, 4: 0 },  // Free — gated by buildings built
      crewFacilities: { 2: 8000, 3: 12000, 4: 18000 },
      intelFacility:  { 1: 8000, 2: 14000, 3: 22000 },
      vehicleBay:     { 1: 10000, 2: 16000, 3: 24000, 4: 18000 },
      helipad:        { 1: 15000, 2: 18000, 3: 22000 },
      airfield:       { 1: 20000, 2: 24000, 3: 30000, 4: 22000 },
    };

    // ── Building display info ──
    this.buildingInfo = {
      commandCenter:  { name: "Command Center",  role: "Strategic upgrades, logistics, and funding" },
      crewFacilities: { name: "Crew Facilities",  role: "Fire Crew, Fire Watch" },
      intelFacility:  { name: "Intel Facility",   role: "Forecasting, and recon" },
      vehicleBay:     { name: "Vehicle Bay",      role: "Ground vehicles" },
      helipad:        { name: "Helipad",           role: "Helicopter operations" },
      airfield:       { name: "Airfield",          role: "Fixed-wing aircraft" },
    };

    // ── Purchased upgrades (set of upgrade IDs) ──
    this.upgrades = new Set();

    // ── Upgrade catalog ──
    this.upgradeCatalog = {
      // Command Center — includes all storage upgrades
      betterForecast:   { building: "commandCenter",  tier: 2, cost: 6000,  label: "Better Pre-mission Forecast" },
      moreChoices1:     { building: "commandCenter",  tier: 2, cost: 8000,  label: "More Mission Choices I" },
      foodStorage2:     { building: "commandCenter",  tier: 2, cost: 8000,  label: "Food Storage II", effect: "storage", resource: "food", storageLevel: 1 },
      fuelStorage2:     { building: "commandCenter",  tier: 2, cost: 10000, label: "Fuel Storage II", effect: "storage", resource: "fuel", storageLevel: 1 },
      partsStorage2:    { building: "commandCenter",  tier: 2, cost: 10000, label: "Parts Storage II", effect: "storage", resource: "parts", storageLevel: 1 },
      retStorage2:      { building: "commandCenter",  tier: 2, cost: 12000, label: "Retardant Storage II", effect: "storage", resource: "retardant", storageLevel: 1 },
      foodStorage3:     { building: "commandCenter",  tier: 3, cost: 11000, label: "Food Storage III", effect: "storage", resource: "food", storageLevel: 2 },
      fuelStorage3:     { building: "commandCenter",  tier: 3, cost: 14000, label: "Fuel Storage III", effect: "storage", resource: "fuel", storageLevel: 2 },
      partsStorage3:    { building: "commandCenter",  tier: 3, cost: 14000, label: "Parts Storage III", effect: "storage", resource: "parts", storageLevel: 2 },
      retStorage3:      { building: "commandCenter",  tier: 3, cost: 16000, label: "Retardant Storage III", effect: "storage", resource: "retardant", storageLevel: 2 },
      moreChoices2:     { building: "commandCenter",  tier: 4, cost: 12000, label: "More Mission Choices II" },
      fuelStorage4:     { building: "commandCenter",  tier: 4, cost: 18000, label: "Fuel Storage IV", effect: "storage", resource: "fuel", storageLevel: 3 },
      retStorage4:      { building: "commandCenter",  tier: 4, cost: 22000, label: "Retardant Storage IV", effect: "storage", resource: "retardant", storageLevel: 3 },

      // Crew Facilities
      fasterCutting:    { building: "crewFacilities", tier: 2, cost: 6000,  label: "Faster Firebreak Cutting" },
      reducedUnderfed1: { building: "crewFacilities", tier: 2, cost: 7000,  label: "Reduced Underfed Effects I" },
      crewAvail1:       { building: "crewFacilities", tier: 2, cost: 12000, label: "More Crew Availability I" },
      fireWatchSight1:  { building: "crewFacilities", tier: 2, cost: 8000,  label: "Fire Watch Sight I" },
      crewRecovery:     { building: "crewFacilities", tier: 3, cost: 9000,  label: "Reduced Crew Recovery" },
      lowerFoodCons1:   { building: "crewFacilities", tier: 3, cost: 8000,  label: "Lower Food Consumption I" },
      crewAvail2:       { building: "crewFacilities", tier: 4, cost: 18000, label: "More Crew Availability II" },
      reducedUnderfed2: { building: "crewFacilities", tier: 4, cost: 12000, label: "Reduced Underfed Effects II" },
      lowerFoodCons2:   { building: "crewFacilities", tier: 4, cost: 12000, label: "Lower Food Consumption II" },
      fireWatchSight2:  { building: "crewFacilities", tier: 4, cost: 12000, label: "Fire Watch Sight II" },

      // Intel Facility
      weatherForecast:  { building: "intelFacility",  tier: 1, cost: 6000,  label: "Weather Forecast" },
      droneRadius1:     { building: "intelFacility",  tier: 1, cost: 8000,  label: "Drone Reveal Radius I" },
      droneDuration1:   { building: "intelFacility",  tier: 1, cost: 8000,  label: "Drone Duration I" },
      droneControl:     { building: "intelFacility",  tier: 2, cost: 8000,  label: "Improved Drone Control" },
      droneRadius2:     { building: "intelFacility",  tier: 2, cost: 12000, label: "Drone Reveal Radius II" },
      droneDuration2:   { building: "intelFacility",  tier: 2, cost: 12000, label: "Drone Duration II" },
      reconScanRadius:  { building: "intelFacility",  tier: 3, cost: 12000, label: "Larger Recon Scan Radius" },
      reconDuration:    { building: "intelFacility",  tier: 3, cost: 12000, label: "Longer Recon Duration" },
      perfectForecast:  { building: "intelFacility",  tier: 3, cost: 14000, label: "Perfect Weather Forecast" },

      // Vehicle Bay
      engineOutput:     { building: "vehicleBay",     tier: 1, cost: 10000, label: "Fire Truck Suppression" },
      engineMobility:   { building: "vehicleBay",     tier: 1, cost: 10000, label: "Fire Truck Radius" },
      engineRecharge:   { building: "vehicleBay",     tier: 1, cost: 10000, label: "Fire Truck Faster Cooldown" },
      sprinklerRadius:  { building: "vehicleBay",     tier: 2, cost: 8000,  label: "Sprinkler Radius" },
      sprinklerDur:     { building: "vehicleBay",     tier: 2, cost: 8000,  label: "Sprinkler Duration" },
      sprinklerCooldown:{ building: "vehicleBay",     tier: 2, cost: 9000,  label: "Sprinkler Cooldown Reduction" },
      vehicleWear1:     { building: "vehicleBay",     tier: 2, cost: 9000,  label: "Reduced Vehicle Wear I" },
      vehicleFuelEff1:  { building: "vehicleBay",     tier: 2, cost: 9000,  label: "Better Vehicle Fuel Efficiency I" },
      dozerSpeed:       { building: "vehicleBay",     tier: 3, cost: 8000,  label: "Dozer Speed" },
      dozerLineWidth:   { building: "vehicleBay",     tier: 3, cost: 9000,  label: "Dozer Line Width" },
      vehicleFuelEff2:  { building: "vehicleBay",     tier: 3, cost: 13000, label: "Better Vehicle Fuel Efficiency II" },
      vehicleWear2:     { building: "vehicleBay",     tier: 3, cost: 13000, label: "Reduced Vehicle Wear II" },
      dozerRecharge:    { building: "vehicleBay",     tier: 3, cost: 10000, label: "Dozer Recharge Speed" },

      // Helipad
      heliFuelEff:      { building: "helipad",        tier: 1, cost: 11000, label: "Better Fuel Efficiency" },
      heliDurability:   { building: "helipad",        tier: 1, cost: 11000, label: "Better Durability" },
      heliSuppression:  { building: "helipad",        tier: 2, cost: 14000, label: "Larger Suppression Zone" },
      heliTurnaround1:  { building: "helipad",        tier: 2, cost: 15000, label: "Reduced Turnaround I" },
      heliTurnaround2:  { building: "helipad",        tier: 3, cost: 20000, label: "Reduced Turnaround II" },

      // Airfield
      bomberFuelEff:    { building: "airfield",       tier: 1, cost: 13000, label: "Better Fuel Efficiency" },
      bomberRetEff:     { building: "airfield",       tier: 1, cost: 14000, label: "Better Retardant Efficiency" },
      bomberDurability: { building: "airfield",       tier: 1, cost: 13000, label: "Increased Bomber Durability" },
      bomberTurnaround: { building: "airfield",       tier: 2, cost: 18000, label: "Reduced Turnaround" },
      bomberDrop1:      { building: "airfield",       tier: 2, cost: 18000, label: "Larger Bomber Drop I" },
      bomberDrop2:      { building: "airfield",       tier: 3, cost: 22000, label: "Larger Bomber Drop II" },
    };

    // ── Asset durability (100 max, persists between missions) ──
    this.assetDurability = {
      waterBomber:      100,
      helicopter:       100,
      bulldozer:        100,
      sprinklerTrailer: 100,
      engineTruck:      100,
      reconPlane:       100,
    };

    // ── Crew fed status (0-100, persists between missions) ──
    this.crewFedStatus = 100;

    // ── Mission loadout slots (based on Command Center tier) ──
    this.loadoutSlots = 2;

    // ── Fallback funding tier ──
    this.fallbackFundingTier = 1;
  }

  // ── Storage caps ──

  getCap(resource) {
    const level = this.storageLevel[resource] ?? 0;
    const tiers = this.storageTiers[resource];
    if (!tiers) return 0;
    return tiers[Math.min(level, tiers.length - 1)];
  }

  get fuelCap()      { return this.getCap("fuel"); }
  get retardantCap() { return this.getCap("retardant"); }
  get foodCap()      { return this.getCap("food"); }
  get partsCap()     { return this.getCap("parts"); }

  // ── Resource purchasing ──

  buyResource(resource, amount) {
    const price = this.prices[resource];
    if (!price) return 0;
    const cap = this.getCap(resource);
    const current = this[resource];
    const canFit = cap - current;
    const canAfford = Math.floor(this.money / price);
    const toBuy = Math.min(amount, canFit, canAfford);
    if (toBuy <= 0) return 0;
    this[resource] += toBuy;
    this.money -= toBuy * price;
    return toBuy;
  }

  // ── Asset unlocks (derived from building tiers) ──

  get hasFireCrew()         { return this.buildings.crewFacilities.tier >= 1; }
  get hasFireWatch()        { return this.buildings.crewFacilities.tier >= 1; }
  get hasDroneRecon()       { return this.buildings.intelFacility.tier >= 1; }
  get hasBulldozer()        { return this.buildings.vehicleBay.tier >= 3; }
  get hasSprinklerTrailer() { return this.buildings.vehicleBay.tier >= 2; }
  get hasEngineTruck()      { return this.buildings.vehicleBay.tier >= 1; }
  get hasHelicopter()       { return this.buildings.helipad.tier >= 1; }
  get hasWaterBomber()      { return this.buildings.airfield.tier >= 1; }
  get hasReconPlane()       { return this.buildings.intelFacility.tier >= 3; }

  // ── Building unlock checks ──

  isBuildingAvailable(buildingId) {
    if (!this.buildings[buildingId]) return false;
    // Starting buildings are always available
    if (buildingId === "commandCenter" || buildingId === "crewFacilities") return true;
    // Non-starting buildings are always available to build
    return true;
  }

  // ── Tier upgrades ──

  canUpgradeTier(buildingId) {
    const building = this.buildings[buildingId];
    if (!building) return false;
    if (!this.isBuildingAvailable(buildingId)) return false;
    const nextTier = building.tier + 1;
    if (nextTier > building.maxTier) return false;

    // Command Center: free upgrade, gated by number of non-starting buildings built
    if (buildingId === "commandCenter") {
      const builtCount = ["intelFacility", "vehicleBay", "helipad", "airfield"]
        .filter(id => this.buildings[id].tier >= 1).length;
      return builtCount >= (nextTier - 1);
    }

    const cost = this.tierCosts[buildingId]?.[nextTier];
    if (cost === undefined) return false;
    return this.money >= cost;
  }

  getTierUpgradeCost(buildingId) {
    const building = this.buildings[buildingId];
    if (!building) return 0;
    const nextTier = building.tier + 1;
    return this.tierCosts[buildingId]?.[nextTier] ?? 0;
  }

  upgradeTier(buildingId) {
    if (!this.canUpgradeTier(buildingId)) return false;
    const building = this.buildings[buildingId];
    const cost = this.getTierUpgradeCost(buildingId);
    this.money -= cost;
    building.tier += 1;

    // Apply side effects of tier upgrades
    this._onTierUpgraded(buildingId, building.tier);
    return true;
  }

  _onTierUpgraded(buildingId, newTier) {
    if (buildingId === "commandCenter") {
      this._applyCCTierEffects(newTier);
    }
  }

  _applyCCTierEffects(ccTier) {
    const slotsByTier = { 1: 2, 2: 2, 3: 3, 4: 4 };
    this.loadoutSlots = slotsByTier[ccTier] ?? 2;
    this.fallbackFundingTier = ccTier;
  }

  // ── Upgrade system ──

  getUpgradesForBuilding(buildingId) {
    const buildingTier = this.buildings[buildingId]?.tier ?? 0;
    const results = [];
    for (const [id, def] of Object.entries(this.upgradeCatalog)) {
      if (def.building !== buildingId) continue;
      if (def.tier > buildingTier) continue;
      results.push({ id, ...def, purchased: this.upgrades.has(id) });
    }
    return results;
  }

  canBuyUpgrade(upgradeId) {
    const def = this.upgradeCatalog[upgradeId];
    if (!def) return false;
    if (this.upgrades.has(upgradeId)) return false;
    const buildingTier = this.buildings[def.building]?.tier ?? 0;
    if (def.tier > buildingTier) return false;
    // Check prerequisites for sequential upgrades (e.g., fuelStorage3 requires fuelStorage2)
    const prereq = this._getUpgradePrerequisite(upgradeId);
    if (prereq && !this.upgrades.has(prereq)) return false;
    return this.money >= def.cost;
  }

  _getUpgradePrerequisite(upgradeId) {
    // Match pattern: name ending in a digit > 2 requires the previous level
    const match = upgradeId.match(/^(.+?)(\d+)$/);
    if (!match) return null;
    const base = match[1];
    const level = parseInt(match[2], 10);
    if (level <= 1) return null; // Level 1 is the base tier, no prereq
    const prereqId = base + (level - 1);
    // Only enforce if the prerequisite actually exists in the catalog
    if (this.upgradeCatalog[prereqId]) return prereqId;
    return null;
  }

  buyUpgrade(upgradeId) {
    if (!this.canBuyUpgrade(upgradeId)) return false;
    const def = this.upgradeCatalog[upgradeId];
    this.money -= def.cost;
    this.upgrades.add(upgradeId);
    // Apply storage effects
    if (def.effect === "storage") {
      const current = this.storageLevel[def.resource] ?? 0;
      if (def.storageLevel > current) {
        this.storageLevel[def.resource] = def.storageLevel;
      }
    }
    return true;
  }

  // ── Durability / Repair ──

  repairAsset(assetId, partsToSpend) {
    if (this.parts < partsToSpend) return 0;
    const current = this.assetDurability[assetId];
    if (current === undefined || current >= 100) return 0;
    const maxRestore = 100 - current;
    const durabilityFromParts = partsToSpend * 5; // 1 part = 5 durability
    const actual = Math.min(maxRestore, durabilityFromParts);
    const partsUsed = Math.ceil(actual / 5);
    this.parts -= partsUsed;
    this.assetDurability[assetId] += partsUsed * 5;
    if (this.assetDurability[assetId] > 100) this.assetDurability[assetId] = 100;
    return partsUsed;
  }

  isAssetAvailable(assetId) {
    return (this.assetDurability[assetId] ?? 0) > 0;
  }

  // ── Crew fed status ──

  getCooldownModifier() {
    const fed = this.crewFedStatus;
    let mod = 0;
    if (fed >= 76) mod = 0;
    else if (fed >= 51) mod = 1;
    else if (fed >= 26) mod = 3;
    else if (fed >= 1) mod = 5;
    else mod = 10; // 0 = crew starving, large cooldown penalty but still usable

    // reducedUnderfed upgrades soften the penalty
    if (mod > 0 && this.upgrades.has("reducedUnderfed1")) mod = Math.max(0, mod - 1);
    if (mod > 0 && this.upgrades.has("reducedUnderfed2")) mod = Math.max(0, mod - 1);
    return mod;
  }

  isCrewAvailable() {
    return true; // Crew always available, just slower when hungry
  }

  // Feed crew: spend 1 food to restore 20 crewFedStatus
  feedCrew() {
    if (this.food <= 0 || this.crewFedStatus >= 100) return false;
    this.food -= 1;
    this.crewFedStatus = Math.min(100, this.crewFedStatus + 20);
    return true;
  }

  // ── Mission rewards ──

  addMissionReward(amount) {
    this.money += amount;
  }

  // ── Fallback funding ──

  getFallbackFunding() {
    const fundingByTier = { 1: 2000, 2: 3000, 3: 4000, 4: 5000 };
    return fundingByTier[this.fallbackFundingTier] ?? 2000;
  }
}
