export class WeatherSystem {
  constructor({ temperature = 22, humidity = 40, windAngle = 0, windStrength = 0.3 } = {}) {
    this.temperature = temperature;
    this.humidity = humidity;
    this.windAngle = windAngle;
    this.windStrength = windStrength;
    this.baseSpreadChance = 0.004; // adjustable base spread chance
  }

  update(dt) {
    // Wind gradually increases over mission duration (+0.1 per 10 minutes)
    this._elapsed = (this._elapsed || 0) + dt;
    const windIncrease = Math.floor(this._elapsed / 600) * 0.1;
    this.windStrength = this._baseWindStrength + windIncrease;
  }

  resetTimer() {
    this._elapsed = 0;
    this._baseWindStrength = this.windStrength;
  }

  computeSpreadModifier(source, target) {
    const base = this.baseSpreadChance; // base spread chance

    // Temperature modifier: 22 = standard, 40 = extreme (hot)
    const tempNorm = Math.max(0, Math.min(1, (this.temperature - 22) / (40 - 22)));
    const tempMod = 1 + tempNorm * tempNorm * 0.5; // smooth curve, minimal change near 22

    // Humidity modifier (relative humidity behavior):
    // - >= 60% : fire spreads slowly, harder to ignite
    // - 30–60%: moderate fire activity
    // - < 30% : fire spreads easily
    // - < 20% : extreme fire behavior possible
    let humidMod;
    if (this.humidity >= 60) {
      humidMod = 0.45; // damp conditions
    } else if (this.humidity >= 30) {
      humidMod = 1.0; // normal spread
    } else if (this.humidity >= 20) {
      humidMod = 1.5; // easier spread
    } else {
      humidMod = 2.0; // extreme dry
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    // Account for canvas Y-axis (inverted): negate dy to convert to standard math coords
    const angleToTarget = Math.atan2(-dy, dx);
    const windDiff = this._angleDiff(this.windAngle, angleToTarget);
    const windFactor = 1 + this.windStrength * Math.max(0, Math.cos(windDiff));

    // If it's very humid, fire spread becomes much less likely.
    return base * tempMod * humidMod * windFactor;
  }

  getFireRisk() {
    if (this.humidity < 20 || this.temperature >= 32) return "High";
    if (this.humidity < 30 || this.temperature >= 25) return "Moderate";
    return "Low";
  }

  _angleDiff(a, b) {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}
