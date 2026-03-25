// ══════════════════════════════════════════════════════════════
// TUNING TABLES — edit these to rebalance fire behavior
// ══════════════════════════════════════════════════════════════

// Temperature → Base Spread Radius (px). Linear 1:1.
const TEMP_RADIUS   = { xs: [10, 16, 22, 28, 34, 40, 50], ys: [10, 16, 22, 28, 34, 40, 50] };

// Air Humidity → Ignition Multiplier (main ignition driver)
const AIR_HUM_IGN   = { xs: [10, 25, 40, 55, 70, 80], ys: [1.22, 1.12, 1.00, 0.90, 0.75, 0.60] };

// Wind Strength → Directional Radius Bonus (px)
const WIND_BONUS    = { xs: [1, 9, 10, 30, 31, 50, 51, 70, 71, 90, 91, 100], ys: [1, 5, 5, 15, 16, 25, 26, 35, 36, 45, 46, 50] };

// Fuel Humidity → Spread Interval (seconds between spread checks)
const FUEL_INTERVAL = { xs: [10, 20, 35, 50, 65, 80], ys: [0.5, 0.7, 0.9, 1.2, 1.6, 2.0] };

// Fuel Humidity → Small Ignition Multiplier
const FUEL_IGN      = { xs: [10, 20, 35, 50, 65, 80], ys: [1.15, 1.10, 1.05, 1.00, 0.95, 0.90] };

// Fuel Humidity → Burn Speed Modifier (higher = burns faster)
const FUEL_BURN     = { xs: [10, 20, 35, 50, 65, 80], ys: [1.30, 1.20, 1.10, 1.00, 0.85, 0.75] };

// Wind Direction → fraction of wind bonus applied
// 0° = downwind, 45° = diagonal downwind, 90° = crosswind, 135° = diagonal upwind, 180° = upwind
const WIND_DIR      = { xs: [0, 45, 90, 135, 180], ys: [1.00, 0.70, 0.35, 0.10, 0.00] };

// Tree Types
const TREE_TYPES = {
  conifer:   { burnDuration: 21.4, ignitionResistance: 1.10 },
  deciduous: { burnDuration: 30.6, ignitionResistance: 0.90 },
};

export { TREE_TYPES };

// ══════════════════════════════════════════════════════════════

export class WeatherSystem {
  constructor({ temperature = 22, airHumidity = 40, windAngle = 0, windStrength = 30, fuelHumidity = 50 } = {}) {
    this.temperature = temperature;
    this.airHumidity = airHumidity;     // 10–80 %
    this.windAngle = windAngle;
    this.windStrength = windStrength;    // 1–100
    this.fuelHumidity = fuelHumidity;    // 10–80 %
    this.baseSpreadChance = 0.012;
  }

  update(dt) {
    // Wind gradually increases over mission duration (+10 per 10 minutes)
    this._elapsed = (this._elapsed || 0) + dt;
    const windIncrease = Math.floor(this._elapsed / 600) * 10;
    this.windStrength = this._baseWindStrength + windIncrease;
  }

  resetTimer() {
    this._elapsed = 0;
    this._baseWindStrength = this.windStrength;
  }

  // ── Temperature → Base Spread Radius (px) ────────────────────
  getBaseSpreadRadius() {
    return _lerp(this.temperature, TEMP_RADIUS);
  }

  // ── Air Humidity → Ignition Multiplier ────────────────────────
  getAirHumidityIgnitionMultiplier() {
    return _lerp(this.airHumidity, AIR_HUM_IGN);
  }

  // ── Wind → Directional Radius Bonus (px) ─────────────────────
  getWindRadiusBonus() {
    return _lerp(this.windStrength, WIND_BONUS);
  }

  // ── Wind Direction → fraction of bonus for a given angle ──────
  // angleDeg = absolute angle difference between wind dir and spread dir (0–180)
  getDirectionalWindFactor(angleToTarget) {
    const windAngleRad = -this.windAngle; // match existing convention
    const diff = this._angleDiff(windAngleRad, angleToTarget);
    const absDeg = Math.abs(diff) * (180 / Math.PI);
    return _lerp(absDeg, WIND_DIR);
  }

  // ── Fuel Humidity → Spread Interval (seconds) ────────────────
  getFuelHumiditySpreadInterval() {
    return _lerp(this.fuelHumidity, FUEL_INTERVAL);
  }

  // ── Fuel Humidity → Small Ignition Multiplier ────────────────
  getFuelHumidityIgnitionMultiplier() {
    return _lerp(this.fuelHumidity, FUEL_IGN);
  }

  // ── Fuel Humidity → Burn Speed Modifier ──────────────────────
  getFuelHumidityBurnSpeedModifier() {
    return _lerp(this.fuelHumidity, FUEL_BURN);
  }

  // ── Tree Type Lookups ────────────────────────────────────────
  getTreeBurnDuration(treeType) {
    return (TREE_TYPES[treeType] || TREE_TYPES.conifer).burnDuration;
  }

  getTreeIgnitionResistance(treeType) {
    return (TREE_TYPES[treeType] || TREE_TYPES.conifer).ignitionResistance;
  }

  // ── Combined Ignition Chance ─────────────────────────────────
  // Returns final chance = base × min(airHum × fuelHum × treeRes, 1.40)
  computeIgnitionChance(treeType) {
    const mult = this.getAirHumidityIgnitionMultiplier()
               * this.getFuelHumidityIgnitionMultiplier()
               * this.getTreeIgnitionResistance(treeType);
    return this.baseSpreadChance * Math.min(mult, 1.40);
  }

  getFireRisk() {
    if (this.airHumidity < 30 || this.temperature >= 35) return "High";
    if (this.airHumidity < 50 || this.temperature >= 27) return "Moderate";
    return "Low";
  }

  _angleDiff(a, b) {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}

// Piecewise linear interpolation helper
function _lerp(value, table) {
  const { xs, ys } = table;
  if (value <= xs[0]) return ys[0];
  if (value >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (value <= xs[i + 1]) {
      const t = (value - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}
