/**
 * ============================================================
 *  SKILL TUNING CONFIG — one place to balance all 9 skills
 * ============================================================
 *  Import in GameState.js:
 *    import { SKILL_CONFIG as SC } from '../data/skillConfig.js';
 *
 *  Each section maps to an in-game skill.  Units are noted in
 *  comments.  "px" = world-space pixels, "s" = seconds.
 *
 *  Upgrade multipliers are NOT here (those are in EconomyState).
 *  Only the BASE numeric constants live here.
 * ============================================================
 */

export const SKILL_CONFIG = {

  // ──────────────────────────────────────────────────────────
  // 1 · WATER BOMBER  (key 1, LMB strafe)
  // ──────────────────────────────────────────────────────────
  waterBomber: {
    targetingRadius:    220,   // px  — UI circle shown while aiming
    strafeDuration:     2.5,   // s   — how long the strafe animation takes
    strafeRadius:       36,    // px  — spray width per step along the path
    cooldown:           8,     // s   — base cooldown between uses
    pathExtendDist:     150,   // px  — entry/exit path extension beyond click points
    sprayStepSize:      20,    // px  — distance between spray dots along path
    fuelCostBase:       3,     // fuel units per sortie
    fuelCostUpgraded:   2,     // fuel units w/ bomberFuelEff upgrade
    retardantCostBase:  2,     // retardant units per sortie
    retardantCostUpg:   1,     // retardant units w/ bomberRetEff upgrade
    durabilityWear:     5,     // % per sortie (base)
    durabilityWearUpg:  3,     // % per sortie w/ bomberDurability upgrade
    cooldownMultUpg:    0.70,  // multiplier w/ bomberTurnaround upgrade
    dropRadiusMultUpg:  1.25,  // multiplier per bomberDrop1 / bomberDrop2 upgrade
  },

  // ──────────────────────────────────────────────────────────
  // 2 · HELI DROP  (key 2, circle suppression)
  // ──────────────────────────────────────────────────────────
  heliDrop: {
    targetingRadius:    260,   // px  — UI circle shown while aiming
    suppressionRadius:  43,    // px  — actual suppression circle on drop
    cooldown:           4,     // s   — base cooldown
    animSprayDelay:     0.5,   // s   — delay after animation starts before spray lands
    animDuration:       3,     // s   — total helicopter animation duration
    fuelCostBase:       2,     // fuel units per deployment
    fuelCostUpgraded:   1,     // fuel units w/ heliFuelEff upgrade
    retardantCost:      1,     // retardant units (when retardant mode active)
    durabilityWear:     4,     // % per deployment (base)
    durabilityWearUpg:  2,     // % per deployment w/ heliDurability upgrade
    cooldownMultUpg:    0.80,  // multiplier per heliTurnaround1 / heliTurnaround2 upgrade
    suppressRadiusUpg:  1.30,  // multiplier w/ heliSuppression upgrade
  },

  // ──────────────────────────────────────────────────────────
  // 3 · BULLDOZER  (key 3, toggle while holding LMB)
  // ──────────────────────────────────────────────────────────
  bulldozer: {
    targetingRadius:    180,   // px  — UI display radius
    cutTime:            0.2,   // s   — time to cut one tree (lower = faster)
    cutRadius:          24,    // px  — base cutting width
    cutRadiusUpg:       32,    // px  — cutting width w/ dozerLineWidth upgrade
    energy:             100,   // starting & max energy
    drainRate:          25,    // energy/s while active + clicking
    rechargeRate:       5,     // energy/s while inactive
    rechargeMultUpg:    1.50,  // multiplier w/ dozerRecharge upgrade
    cutTimeMultUpg:     0.60,  // multiplier w/ dozerSpeed upgrade (lower = faster)
    fuelInterval:       1,     // s   — fuel consumed every N seconds (base)
    fuelIntervalUpg1:   1.3,   // s   — w/ vehicleFuelEff1
    fuelIntervalUpg2:   1.6,   // s   — w/ both vehicleFuelEff upgrades
    fuelPerTick:        1,     // fuel units consumed per interval
    wearInterval:       2,     // s   — durability drained every N seconds (base)
    wearIntervalUpg:    1.30,  // multiplier per vehicleWear1 / vehicleWear2 upgrade
    wearPerTick:        3,     // % durability per interval
  },

  // ──────────────────────────────────────────────────────────
  // 4 · SPRINKLER TRAILER  (key 4, placed humidity zone)
  // ──────────────────────────────────────────────────────────
  sprinklerTrailer: {
    targetingRadius:    140,   // px  — UI circle
    zoneRadius:         72,    // px  — active humidity zone (3× player spray)
    zoneRadiusUpg:      1.30,  // multiplier w/ sprinklerRadius upgrade
    cooldown:           12,    // s   — base cooldown
    cooldownMultUpg:    0.70,  // multiplier w/ sprinklerCooldown upgrade
    duration:           10,    // s   — zone active duration (base)
    durationBonusUpg:   4,     // s   — added duration w/ sprinklerDur upgrade
    durabilityWear:     2,     // % per activation (base)
    durabilityWearUpg:  1,     // % per activation w/ vehicleWear1 upgrade
  },

  // ──────────────────────────────────────────────────────────
  // 5 · FIRE WATCH  (key 5, placed minimap reveal zone)
  // ──────────────────────────────────────────────────────────
  fireWatch: {
    targetingRadius:    280,   // px  — also base fog-reveal radius
    revealRadiusBonus1: 60,    // px  — added by fireWatchSight1 upgrade
    revealRadiusBonus2: 60,    // px  — added by fireWatchSight2 upgrade
    chargeRecharge:     10,    // s   — base recharge time per charge
    startCharges:       1,     //      starting charges
    maxCharges:         1,     //      starting max (raised by crewAvail upgrades)
    rechargeMultUpg:    0.75,  // multiplier w/ crewRecovery upgrade
    burnOutDuration:    10,    // s   — tower stays active before burning out
  },

  // ──────────────────────────────────────────────────────────
  // 6 · DRONE RECON  (key 6, deployed movable intel)
  // ──────────────────────────────────────────────────────────
  droneRecon: {
    targetingRadius:    280,   // px  — UI circle while deploying
    radius:             200,   // px  — fog reveal radius
    radiusBonus1:       50,    // px  — added by droneRadius1 upgrade
    radiusBonus2:       50,    // px  — added by droneRadius2 upgrade
    duration:           45,    // s   — time before drone expires
    durationBonus1:     15,    // s   — added by droneDuration1 upgrade
    durationBonus2:     15,    // s   — added by droneDuration2 upgrade
    moveSpeed:          120,   // px/s — repositioning speed
    moveSpeedMultUpg:   1.50,  // multiplier w/ droneControl upgrade
    chargeRecharge:     10,    // s   — base recharge time per charge
    startCharges:       1,     //
    maxCharges:         1,     //      starting max (raised by crewAvail upgrades)
    rechargeMultUpg:    0.75,  // multiplier w/ crewRecovery upgrade
  },

  // ──────────────────────────────────────────────────────────
  // 7 · RECON PLANE  (key 7, whole-map reveal)
  // ──────────────────────────────────────────────────────────
  reconPlane: {
    targetingRadius:    600,   // px  — overlay circle while aiming
    revealDuration:     8,     // s   — full-map reveal duration
    cooldown:           20,    // s   — base cooldown
    moneyCost:          2000,  // $   — money spent per deployment
    durabilityWear:     2,     // % per deployment
  },

  // ──────────────────────────────────────────────────────────
  // 8 · FIRE CREW  (key 8 / LMB hold)
  // ──────────────────────────────────────────────────────────
  fireCrew: {
    targetingRadius:    96,    // px  — UI display
    cutRadius:          12,    // px  — base cutting width
    cutRadiusBonus1:    2,     // px  — added by crewRadius1 upgrade
    cutRadiusBonus2:    2,     // px  — added by crewRadius2 upgrade
    cutTime:            0.5,   // s   — time to cut one tree
    cutTimeMultUpg:     0.60,  // multiplier w/ fasterCutting upgrade
    maxEnergy:          150,   // energy cap
    drainRate:          15,    // energy/s while actively cutting
    drainMultUpg:       0.90,  // multiplier per crewStamina1 / crewStamina2 upgrade
    rechargeRate:       12,    // energy/s while idle
    foodWearInterval:   3,     // s   — food worn once per this many seconds of cutting
    maxTreesPerTick:    8,     //      max trees processed per update tick
  },

  // ──────────────────────────────────────────────────────────
  // 9 · FIRE TRUCK / ENGINE TRUCK  (key 9 / RMB hold)
  // ──────────────────────────────────────────────────────────
  engineTruck: {
    targetingRadius:    60,    // px  — UI display
    sprayRadius:        12,    // px  — base spray width (same as fire crew)
    sprayRadiusMultUpg: 1.35,  // multiplier w/ engineRadius upgrade
    sprayTime:          0.8,   // s   — hold time to wet one tree
    sprayTimeMultUpg:   0.65,  // multiplier w/ engineSuppression upgrade (lower = faster)
    wearInterval:       4,     // s   — 2% durability drained every N seconds
    wearIntervalUpg1:   1.50,  // multiplier w/ engineMobility upgrade
    wearIntervalUpg2:   1.25,  // multiplier w/ engineRecharge upgrade
    wearPerTick:        2,     // % durability per interval
  },

  // ──────────────────────────────────────────────────────────
  // SHARED CREW FOOD SYSTEM  (Fire Watch, Drone, Fire Crew)
  // ──────────────────────────────────────────────────────────
  crewFood: {
    fedStatusDrainBase: 5,     // fed-status % drained per _consumeCrewFood() call
    drainMultUpg:       0.75,  // multiplier per lowerFoodCons1 / lowerFoodCons2 upgrade
    foodRestorePerUnit: 20,    // fed-status restored per food item consumed
    autoFeedThreshold:  75,    // auto-feed triggers when fed-status drops below this %
    // Underfed cooldown penalties (added seconds per charge recharge)
    underfedPenalty: {
      tier0:  0,   // fed  76–100%
      tier1:  1,   // fed  51– 75%
      tier2:  3,   // fed  26– 50%
      tier3:  5,   // fed   1– 25%
      tier4: 10,   // fed    0%
    },
  },

};
