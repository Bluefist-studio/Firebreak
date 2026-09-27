/**
 * EconomyState — persistent progression state that survives across missions.
 * Tracks money, resources, upgrade tree tiers, upgrades, and asset unlocks.
 */
import { SKILL_CONFIG as SC } from '../data/skillConfig.js';
export class EconomyState {
  constructor() {
    // ── Money ──
    this.money = 10000; // Starting money for a new game

    // ── Tutorial ──
    this.tutorialComplete = true;  // Tutorial disabled

    // ── Resources (current amounts) ──
    this.fuel = 0;
    this.retardant = 0;
    this.food = 0;
    this.parts = 0;

    // ── Resource prices ──
    this.prices = {
      fuel: 200,
      retardant: 500,
      food: 100,
      parts: 200,
    };

    // ── Storage cap tables (indexed by highest unlocked storage tier) ──
    this.storageTiers = {
      fuel:      [5, 10, 20, 40],   // Storage I–IV
      retardant: [4, 6, 8, 10],    // Storage I–IV
      food:      [5, 10, 15],       // Storage I–III
      parts:     [5, 10, 15],       // Storage I–III
    };

    // ── Storage upgrade levels (0-based index into storageTiers) ──
    this.storageLevel = {
      fuel: 0,      // starts at Storage I
      retardant: 0,
      food: 0,
      parts: 0,
    };

    // ── Upgrade trees (all start unlocked, no tiers) ──
    this.buildings = {
      commandCenter:   { tier: 1, maxTier: 1 },  // Logistics
      crewFacilities:  { tier: 1, maxTier: 1 },  // Crew
      vehicleBay:      { tier: 1, maxTier: 1 },  // Ground Support
      helipad:         { tier: 1, maxTier: 1 },  // Air Support
    };

    // ── Tree tier costs (no tiers — all trees are flat) ──
    this.tierCosts = {};

    // ── Skill unlock costs (paid once from the base screen) ──
    this.skillUnlockCosts = {
      droneRecon:       4000,
      sprinklerTrailer: 10000,
      bulldozer:        16000,
      helicopter:       12000,
      reconPlane:       8000,
      waterBomber:      20000,
    };

    // ── Unlocked skills (Fire Crew, Fire Watch, Fire Truck start available) ──
    this.unlockedSkills = new Set(["fireCrew", "fireWatch", "engineTruck"]);

    // ── Skill display info (which building each skill belongs to + display name) ──
    this.skillDisplayInfo = {
      fireCrew:        { building: "crewFacilities", name: "Fire Crew",         tooltip: ["Cuts firebreak lines through forest", "Cost: 1 Food wear | Cooldown: 8s (deferred)", "No durability — uses crew readiness"] },
      fireWatch:       { building: "crewFacilities", name: "Fire Watch",        tooltip: ["Static observation post — reveals area permanently", "Cost: 1 Food wear | Cooldown: 10s", "No durability — uses crew readiness"] },
      droneRecon:      { building: "crewFacilities", name: "Drone Crew",        tooltip: ["Temporary moving recon — reveals area for 45s", "Cost: 1 Food wear | Cooldown: 10s", "Can be repositioned while active"] },
      engineTruck:     { building: "vehicleBay",     name: "Fire Truck",        tooltip: ["Small area fire suppression zone", "Cost: 1 Fuel/use | 1 wear/4s", "Durability: 100"] },
      sprinklerTrailer:{ building: "vehicleBay",     name: "Sprinkler Trailer", tooltip: ["Placed water sprinkler — wets area over time", "Cost: none | 1 wear/activation", "Durability: 100"] },
      bulldozer:       { building: "vehicleBay",     name: "Bulldozer",         tooltip: ["Clears firebreak lines — uses energy bar", "Cost: 1 Fuel/s active | 1 wear/4s", "Durability: 100 | Energy: recharges when idle"] },
      helicopter:      { building: "helipad",        name: "Helicopter",        tooltip: ["Aerial water/retardant drop", "Water: 5 Fuel | Retardant: 5 Fuel + 2 Ret", "Durability: 100 | 2 wear/deployment"] },
      waterBomber:     { building: "helipad",        name: "Water Bomber",      tooltip: ["Heavy aerial suppression sortie", "Water: 8 Fuel | Retardant: 8 Fuel + 4 Ret", "Durability: 100 | 3 wear/sortie"] },
      reconPlane:      { building: "helipad",        name: "Recon Plane",       tooltip: ["Large-scale strategic recon sweep", "Cost: $2,000 per deployment | 1 wear", "Durability: 100 | Reveals wide area"] },
    };

    // ── Tree display info ──
    this.buildingInfo = {
      commandCenter:  { name: "Logistics",      role: "Storage, forecasting, and funding" },
      crewFacilities: { name: "Crew Support",            role: "Fire Crew, Fire Watch, Drone Recon" },
      vehicleBay:     { name: "Ground Support",  role: "Ground vehicles" },
      helipad:        { name: "Air Support",     role: "Helicopter, Water Bomber, Recon Plane" },
    };

    // ── Purchased upgrades (set of upgrade IDs) ──
    this.upgrades = new Set();

    // ── Upgrade catalog ──
    this.upgradeCatalog = {
      // Logistics — storage and forecasting
      weatherForecast:  { building: "commandCenter",  tier: 1, cost: 2000,  label: "Weather Forecast" },
      betterForecast:   { building: "commandCenter",  tier: 1, cost: 4000,  label: "Better Weather Forecast" },
      perfectForecast:  { building: "commandCenter",  tier: 1, cost: 6000,  label: "Perfect Weather Forecast" },
      foodStorage2:     { building: "commandCenter",  tier: 1, cost: 8000,  label: "Food Storage I",       effect: "storage", resource: "food",      storageLevel: 1 },
      foodStorage3:     { building: "commandCenter",  tier: 1, cost: 11000, label: "Food Storage II",      effect: "storage", resource: "food",      storageLevel: 2 },      
      fuelStorage2:     { building: "commandCenter",  tier: 1, cost: 10000, label: "Fuel Storage I",       effect: "storage", resource: "fuel",      storageLevel: 1 },
      fuelStorage3:     { building: "commandCenter",  tier: 1, cost: 14000, label: "Fuel Storage II",      effect: "storage", resource: "fuel",      storageLevel: 2 },
      fuelStorage4:     { building: "commandCenter",  tier: 1, cost: 18000, label: "Fuel Storage III",       effect: "storage", resource: "fuel",      storageLevel: 3 },      
      partsStorage2:    { building: "commandCenter",  tier: 1, cost: 8000,  label: "Parts Storage I",      effect: "storage", resource: "parts",     storageLevel: 1 },
      partsStorage3:    { building: "commandCenter",  tier: 1, cost: 11000, label: "Parts Storage II",     effect: "storage", resource: "parts",     storageLevel: 2 },      
      retStorage2:      { building: "commandCenter",  tier: 1, cost: 12000, label: "Retardant Storage I",  effect: "storage", resource: "retardant", storageLevel: 1 },
      retStorage3:      { building: "commandCenter",  tier: 1, cost: 16000, label: "Retardant Storage II", effect: "storage", resource: "retardant", storageLevel: 2 },
      retStorage4:      { building: "commandCenter",  tier: 1, cost: 22000, label: "Retardant Storage III",  effect: "storage", resource: "retardant", storageLevel: 3 },

      // Crew — fire crew, fire watch, and drone recon
      fasterCutting:    { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 2000,  label: "Faster Firebreak Cutting" },
      fireWatchSight1:  { building: "crewFacilities", tier: 1, skill: "fireWatch",      cost: 2000,  label: "Fire Watch Sight I" },
      lowerFoodCons1:   { building: "crewFacilities", tier: 1,                          cost: 3000,  label: "Lower Food Consumption I" },
      crewRecovery:     { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 4000,  label: "Reduced Crew Recovery" },
      crewRadius1:      { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 8000,  label: "Wider Cutting Radius I" },
      crewRadius2:      { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 10000, label: "Wider Cutting Radius II" },
      crewStamina1:     { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 4000,  label: "Improved Crew Stamina I" },
      crewStamina2:     { building: "crewFacilities", tier: 1, skill: "fireCrew",       cost: 8000,  label: "Improved Crew Stamina II" },
      lowerFoodCons2:   { building: "crewFacilities", tier: 1,                          cost: 6000,  label: "Lower Food Consumption II" },
      fireWatchSight2:  { building: "crewFacilities", tier: 1, skill: "fireWatch",      cost: 3000,  label: "Fire Watch Sight II" },
      droneControl:     { building: "crewFacilities", tier: 1, skill: "droneRecon",     cost: 2000,  label: "Improved Drone Control" },
      droneRadius1:     { building: "crewFacilities", tier: 1, skill: "droneRecon",     cost: 2000,  label: "Drone Reveal Radius I" },
      droneRadius2:     { building: "crewFacilities", tier: 1, skill: "droneRecon",     cost: 4000,  label: "Drone Reveal Radius II" },
      droneDuration1:   { building: "crewFacilities", tier: 1, skill: "droneRecon",     cost: 2000,  label: "Drone Duration I" },
      droneDuration2:   { building: "crewFacilities", tier: 1, skill: "droneRecon",     cost: 4000,  label: "Drone Duration II" },

      // Ground Support — ground vehicles
      engineRadius:     { building: "vehicleBay",     tier: 1, skill: "engineTruck",      cost: 8000,  label: "Fire Truck Radius" },
      engineSuppression:{ building: "vehicleBay",     tier: 1, skill: "engineTruck",      cost: 8000,  label: "Fire Truck Suppression" },
      engineMobility:   { building: "vehicleBay",     tier: 1, skill: "engineTruck",      cost: 8000,  label: "Fire Truck Durability I" },
      engineRecharge:   { building: "vehicleBay",     tier: 1, skill: "engineTruck",      cost: 8000,  label: "Fire Truck Durability II" },
      sprinklerRadius:  { building: "vehicleBay",     tier: 1, skill: "sprinklerTrailer", cost: 8000,  label: "Sprinkler Radius" },
      //sprinklerDur:     { building: "vehicleBay",     tier: 1, skill: "sprinklerTrailer", cost: 8000,  label: "Sprinkler Duration" },
      sprinklerCooldown:{ building: "vehicleBay",     tier: 1, skill: "sprinklerTrailer", cost: 8000,  label: "Sprinkler Cooldown Reduction" },
      dozerSpeed:       { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 10000, label: "Dozer Speed" },
      dozerRecharge:    { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 10000, label: "Dozer Recharge Speed" },
      dozerLineWidth:   { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 10000, label: "Dozer Line Width" },
      vehicleWear1:     { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 9000,  label: "Dozer Wear I" },
      vehicleWear2:     { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 10000, label: "Dozer Wear II" },
      vehicleFuelEff1:  { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 9000,  label: "Dozer Fuel Efficiency I" },
      vehicleFuelEff2:  { building: "vehicleBay",     tier: 1, skill: "bulldozer",        cost: 10000, label: "Dozer Fuel Efficiency II" },

      // Air Support — helicopter, water bomber, and recon plane
      heliFuelEff:      { building: "helipad",        tier: 1, skill: "helicopter",  cost: 11000, label: "Heli Fuel Efficiency" },
      heliDurability:   { building: "helipad",        tier: 1, skill: "helicopter",  cost: 11000, label: "Heli Durability" },
      heliSuppression:  { building: "helipad",        tier: 1, skill: "helicopter",  cost: 14000, label: "Heli Larger Drop" },
      heliTurnaround1:  { building: "helipad",        tier: 1, skill: "helicopter",  cost: 15000, label: "Heli Turnaround I" },
      heliTurnaround2:  { building: "helipad",        tier: 1, skill: "helicopter",  cost: 20000, label: "Heli Turnaround II" },
      bomberFuelEff:    { building: "helipad",        tier: 1, skill: "waterBomber", cost: 13000, label: "Bomber Fuel Efficiency" },
      bomberRetEff:     { building: "helipad",        tier: 1, skill: "waterBomber", cost: 14000, label: "Bomber Retardant Efficiency" },
      bomberDurability: { building: "helipad",        tier: 1, skill: "waterBomber", cost: 13000, label: "Bomber Durability" },
      bomberTurnaround: { building: "helipad",        tier: 1, skill: "waterBomber", cost: 18000, label: "Bomber Turnaround" },
      bomberDrop1:      { building: "helipad",        tier: 1, skill: "waterBomber", cost: 18000, label: "Bomber Larger Drop I" },
      bomberDrop2:      { building: "helipad",        tier: 1, skill: "waterBomber", cost: 22000, label: "Bomber Larger Drop II" },
      reconDuration:    { building: "helipad",        tier: 1, skill: "reconPlane",  cost: 8000,  label: "Recon Longer Duration" },
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

    // ── Mission loadout slots ──
    this.loadoutSlots = 2;

    // ── Fallback funding tier ──
    this.fallbackFundingTier = 1;

    // ── Completed missions ──
    this.completedMissions = new Set();
    this.missionBestDays = {}; // id -> best (highest) day reached for endless missions
  }

  // ── Completed missions ──

  markMissionComplete(id) {
    if (id) this.completedMissions.add(id);
  }

  isMissionComplete(id) {
    return this.completedMissions.has(id);
  }

  setMissionBestDay(id, day) {
    if (!id || day == null) return;
    const current = this.missionBestDays[id] ?? -Infinity;
    if (day > current) this.missionBestDays[id] = day;
  }

  getMissionBestDay(id) {
    return this.missionBestDays[id] ?? null;
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
    this.money = Math.floor(this.money - toBuy * price);
    return toBuy;
  }

  refuelAllVehicles() {
    // Refuel fuel reserve to storage cap in one action, using money as needed.
    return this.buyResource("fuel", Number.MAX_SAFE_INTEGER);
  }

  buyMaxResource(resource) {
    return this.buyResource(resource, Number.MAX_SAFE_INTEGER);
  }

  // ── Asset unlocks (gated by skill unlock purchases) ──

  get hasFireCrew()         { return this.unlockedSkills.has("fireCrew"); }
  get hasFireWatch()        { return this.unlockedSkills.has("fireWatch"); }
  get hasDroneRecon()       { return this.unlockedSkills.has("droneRecon"); }
  get hasBulldozer()        { return this.unlockedSkills.has("bulldozer"); }
  get hasSprinklerTrailer() { return this.unlockedSkills.has("sprinklerTrailer"); }
  get hasEngineTruck()      { return this.unlockedSkills.has("engineTruck"); }
  get hasHelicopter()       { return this.unlockedSkills.has("helicopter"); }
  get hasWaterBomber()      { return this.unlockedSkills.has("waterBomber"); }
  get hasReconPlane()       { return this.unlockedSkills.has("reconPlane"); }

  // ── Tree unlock checks ──

  isBuildingAvailable(buildingId) {
    return !!this.buildings[buildingId];
  }

  // ── Tier upgrades ──

  canUpgradeTier(buildingId) {
    const building = this.buildings[buildingId];
    if (!building) return false;
    if (!this.isBuildingAvailable(buildingId)) return false;
    const nextTier = building.tier + 1;
    if (nextTier > building.maxTier) return false;

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
    this.money = Math.floor(this.money - cost);
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
    // Skill must be unlocked before its upgrades are available
    if (def.skill && !this.unlockedSkills.has(def.skill)) return false;
    // Check prerequisites for sequential upgrades (e.g., fuelStorage3 requires fuelStorage2)
    const prereq = this._getUpgradePrerequisite(upgradeId);
    if (prereq && !this.upgrades.has(prereq)) return false;
    return this.money >= def.cost;
  }

  _getUpgradePrerequisite(upgradeId) {
    // Manual prerequisites for upgrades that don't follow the numeric suffix pattern
    const manualPrereqs = {
      engineSuppression: "engineRadius",
      betterForecast:    "weatherForecast",
      perfectForecast:   "betterForecast",
    };
    if (manualPrereqs[upgradeId]) return manualPrereqs[upgradeId];

    // Match pattern: name ending in a digit > 1 requires the previous level
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
    this.money = Math.floor(this.money - def.cost);
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

  // ── Skill unlocks ──

  canUnlockSkill(skillId) {
    if (this.unlockedSkills.has(skillId)) return false;
    const cost = this.skillUnlockCosts[skillId];
    return cost !== undefined && this.money >= cost;
  }

  unlockSkill(skillId) {
    if (!this.canUnlockSkill(skillId)) return false;
    this.money = Math.floor(this.money - this.skillUnlockCosts[skillId]);
    this.unlockedSkills.add(skillId);
    return true;
  }

  getSkillUnlockCost(skillId) {
    return this.skillUnlockCosts[skillId] ?? 0;
  }

  /** Returns skills belonging to a building, in display order. */
  getSkillsForBuilding(buildingId) {
    return Object.entries(this.skillDisplayInfo)
      .filter(([, info]) => info.building === buildingId)
      .map(([skillId, info]) => ({
        skillId,
        name: info.name,
        unlocked: this.unlockedSkills.has(skillId),
        cost: this.skillUnlockCosts[skillId] ?? 0,
      }));
  }

  /** Returns all upgrades that require a specific skill to be unlocked. */
  getUpgradesForSkill(skillId) {
    const results = [];
    for (const [id, def] of Object.entries(this.upgradeCatalog)) {
      if (def.skill !== skillId) continue;
      results.push({ id, ...def, purchased: this.upgrades.has(id) });
    }
    return results;
  }

  /** Returns upgrades tied directly to a building with no skill requirement (Logistics). */
  getDirectUpgradesForBuilding(buildingId) {
    const results = [];
    for (const [id, def] of Object.entries(this.upgradeCatalog)) {
      if (def.building !== buildingId || def.skill) continue;
      results.push({ id, ...def, purchased: this.upgrades.has(id) });
    }
    return results;
  }

  repairAsset(assetId) {
    const current = this.assetDurability[assetId];
    if (current === undefined || current >= 100) return false;
    const cost = Math.floor((100 - current) * 2); // $2 per durability point
    if (this.money < cost) return false;
    this.money = Math.floor(this.money - cost);
    this.assetDurability[assetId] = 100;
    return true;
  }

  // Repair all vehicles, charging $1 per missing durability point
  repairAllVehicles() {
    const assets = ["engineTruck", "sprinklerTrailer", "bulldozer", "helicopter", "waterBomber", "reconPlane"];
    let repaired = false;
    for (const assetId of assets) {
      if (this.repairAsset(assetId)) repaired = true;
    }
    return repaired;
  }

  isAssetAvailable(assetId) {
    return (this.assetDurability[assetId] ?? 0) > 0;
  }

  // ── Crew fed status ──

  getCooldownModifier() {
    const fed = this.crewFedStatus;
    const p = SC.crewFood.underfedPenalty;
    let mod = 0;
    if (fed >= 76) mod = p.tier0;
    else if (fed >= 51) mod = p.tier1;
    else if (fed >= 26) mod = p.tier2;
    else if (fed >= 1)  mod = p.tier3;
    else mod = p.tier4;

    // reducedUnderfed upgrades soften the penalty
    if (mod > 0 && this.upgrades.has("reducedUnderfed1")) mod = Math.max(0, mod - 1);
    if (mod > 0 && this.upgrades.has("reducedUnderfed2")) mod = Math.max(0, mod - 1);
    return mod;
  }

  // Returns a drain rate multiplier for fire crew stamina based on hunger level.
  // Applied on top of the base drain rate; >1.0 means crew tires faster when underfed.
  getFireCrewDrainMultiplier() {
    const fed = this.crewFedStatus;
    let penalty = 0;
    if (fed >= 76) penalty = 0;
    else if (fed >= 51) penalty = 0.2;  // +20% drain
    else if (fed >= 26) penalty = 0.45; // +45% drain
    else if (fed >= 1)  penalty = 0.7;  // +70% drain
    else                penalty = 1.0;  // +100% drain (starving)

    // reducedUnderfed upgrades also soften the drain penalty
    if (penalty > 0 && this.upgrades.has("reducedUnderfed1")) penalty = Math.max(0, penalty - 0.1);
    if (penalty > 0 && this.upgrades.has("reducedUnderfed2")) penalty = Math.max(0, penalty - 0.1);
    return 1.0 + penalty;
  }

  // Returns a recharge rate multiplier; <1.0 means crew recovers slower when underfed.
  getFireCrewRechargeMultiplier() {
    const fed = this.crewFedStatus;
    let mult;
    if (fed >= 76) mult = 1.0;
    else if (fed >= 51) mult = 0.8;  // -20% regen
    else if (fed >= 26) mult = 0.55; // -45% regen
    else if (fed >= 1)  mult = 0.35; // -65% regen
    else                mult = 0.2;  // -80% regen (starving)

    if (mult < 1.0 && this.upgrades.has("reducedUnderfed1")) mult = Math.min(1.0, mult + 0.05);
    if (mult < 1.0 && this.upgrades.has("reducedUnderfed2")) mult = Math.min(1.0, mult + 0.05);
    return mult;
  }

  // Returns a max-energy multiplier; <1.0 means total stamina pool is smaller when underfed.
  getFireCrewMaxEnergyMultiplier() {
    const fed = this.crewFedStatus;
    let mult;
    if (fed >= 76) mult = 1.0;
    else if (fed >= 51) mult = 0.9;   // -10% max
    else if (fed >= 26) mult = 0.75;  // -25% max
    else if (fed >= 1)  mult = 0.55;  // -45% max
    else                mult = 0.4;   // -60% max (starving)

    if (mult < 1.0 && this.upgrades.has("reducedUnderfed1")) mult = Math.min(1.0, mult + 0.05);
    if (mult < 1.0 && this.upgrades.has("reducedUnderfed2")) mult = Math.min(1.0, mult + 0.05);
    return mult;
  }

  isCrewAvailable() {
    return true; // Crew always available, just slower when hungry
  }

  // Feed crew: spend 1 food to restore 10 crewFedStatus
  feedCrew() {
    if (this.food <= 0 || this.crewFedStatus >= 100) return false;
    this.food -= 1;
    this.crewFedStatus = Math.min(100, this.crewFedStatus + 10);
    return true;
  }

  // Feed crew fully, auto-buy food as needed
  feedCrewFully() {
    if (this.crewFedStatus >= 100) return 0;
    const requiredFood = Math.ceil((100 - this.crewFedStatus) / 10);
    const missingFood = Math.max(0, requiredFood - this.food);
    if (missingFood > 0) {
      this.buyResource("food", missingFood);
    }

    let fedCount = 0;
    while (this.feedCrew()) {
      fedCount += 1;
    }
    return fedCount;
  }

  // ── Mission rewards ──

  addMissionReward(amount) {
    this.money = Math.floor(this.money + amount);
  }

  // ── Fallback funding ──

  getFallbackFunding() {
    const fundingByTier = { 1: 2000, 2: 3000, 3: 4000, 4: 5000 };
    return fundingByTier[this.fallbackFundingTier] ?? 2000;
  }

  // ── Save / Load (localStorage) ──

  static SAVE_KEY = "firebreak_save";

  static hasSavedGame() {
    try {
      return localStorage.getItem(EconomyState.SAVE_KEY) !== null;
    } catch { return false; }
  }

  save() {
    const data = {
      money: this.money,
      tutorialComplete: this.tutorialComplete,
      fuel: this.fuel,
      retardant: this.retardant,
      food: this.food,
      parts: this.parts,
      storageLevel: { ...this.storageLevel },
      buildings: {},
      upgrades: [...this.upgrades],
      unlockedSkills: [...this.unlockedSkills],
      assetDurability: { ...this.assetDurability },
      crewFedStatus: this.crewFedStatus,
      loadoutSlots: this.loadoutSlots,
      fallbackFundingTier: this.fallbackFundingTier,
      completedMissions: [...this.completedMissions],
      missionBestDays: { ...this.missionBestDays },
    };
    for (const [id, b] of Object.entries(this.buildings)) {
      data.buildings[id] = { tier: b.tier };
    }
    try {
      localStorage.setItem(EconomyState.SAVE_KEY, JSON.stringify(data));
      console.log("[Save] Game saved successfully. money=", this.money);
    } catch (e) {
      console.error("[Save] FAILED to save:", e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(EconomyState.SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      this.money = Math.floor(data.money ?? 12000);
      this.tutorialComplete = true;  // Tutorial disabled
      this.fuel = data.fuel ?? 15;
      this.retardant = data.retardant ?? 0;
      this.food = data.food ?? 2;
      this.parts = data.parts ?? 2;

      if (data.storageLevel) {
        for (const key of Object.keys(this.storageLevel)) {
          this.storageLevel[key] = data.storageLevel[key] ?? 0;
        }
      }
      if (data.buildings) {
        for (const [id, saved] of Object.entries(data.buildings)) {
          if (this.buildings[id]) {
            this.buildings[id].tier = saved.tier ?? 0;
          }
        }
      }
      this.upgrades = new Set(data.upgrades ?? []);
      if (data.assetDurability) {
        for (const key of Object.keys(this.assetDurability)) {
          this.assetDurability[key] = data.assetDurability[key] ?? 100;
        }
      }
      this.crewFedStatus = data.crewFedStatus ?? 100;
      this.loadoutSlots = data.loadoutSlots ?? 2;
      this.fallbackFundingTier = data.fallbackFundingTier ?? 1;
      this.unlockedSkills = new Set(data.unlockedSkills ?? ["fireCrew", "fireWatch", "engineTruck"]);
      this.completedMissions = new Set(data.completedMissions ?? []);
      this.missionBestDays = data.missionBestDays ?? {};
      return true;
    } catch { return false; }
  }

  static deleteSave() {
    try { localStorage.removeItem(EconomyState.SAVE_KEY); } catch {}
  }
}
