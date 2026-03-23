export class WeatherSystem {
  constructor({ temperature = 22, humidity = 40, windAngle = 0, windStrength = 30 } = {}) {
    this.temperature = temperature;
    this.humidity = humidity;
    this.windAngle = windAngle;
    this.windStrength = windStrength;
    this.baseSpreadChance = 0.004; // adjustable base spread chance
  }

  update(dt) {
    // Wind gradually increases over mission duration (+0.1 per 10 minutes)
    this._elapsed = (this._elapsed || 0) + dt;
    const windIncrease = Math.floor(this._elapsed / 600) * 10;
    this.windStrength = this._baseWindStrength + windIncrease;
  }

  resetTimer() {
    this._elapsed = 0;
    this._baseWindStrength = this.windStrength;
  }

  computeSpreadModifier(source, target) {
    const base = this.baseSpreadChance; // base spread chance

    // Temperature modifier: 10°C = ×0.8, 35°C ≈ ×1.625, 50°C = ×1.8 (linear)
    const tempMod = Math.max(0.5, 0.8 + (this.temperature - 10) * 0.025);

    // Humidity modifier: smooth linear scale.
    // 80% = ×0.45 (very damp), 55% = ×1.00 (neutral), 10% = ×2.00 (extreme dry)
    const humidMod = Math.max(0.45, Math.min(1.45, 0.45 + (80 - this.humidity) * (1.00 / 70)));

    // Wind does NOT affect spread probability — only spread radius (see FireSpreadSystem).
    return base * tempMod * humidMod;
  }

  getFireRisk() {
    if (this.humidity < 30 || this.temperature >= 35) return "High";
    if (this.humidity < 50 || this.temperature >= 27) return "Moderate";
    return "Low";
  }

  _angleDiff(a, b) {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}
