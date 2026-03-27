export class FireSpreadSystem {
  constructor({ forest, weather }) {
    this.forest = forest;
    this.weather = weather;
    this.spreadAccumulator = 0;
    this.updateInterval = weather.getFuelHumiditySpreadInterval();
    this.workerCrewZone = null; // Set by GameState each frame
    this.workerCrewRadius = 72; // 3x player spray radius
  }

  reset() {
    this.spreadAccumulator = 0;
  }

  update(dt) {
    // Use the burning trees set for faster iteration instead of filtering all trees
    if (this.forest.burningTrees.size === 0) return;

    // Spread interval from fuel humidity
    const baseFuelInterval = this.weather.getFuelHumiditySpreadInterval();
    this.updateInterval = baseFuelInterval;

    this.spreadAccumulator += dt;
    if (this.spreadAccumulator < this.updateInterval) return;

    // Process one spread/burn cycle
    const step = this.updateInterval;
    this.spreadAccumulator -= this.updateInterval;

    // Pre-compute burn speed modifier from fuel humidity
    const burnSpeedMod = this.weather.getFuelHumidityBurnSpeedModifier();

    for (const tree of this.forest.burningTrees) {
      // Advance burn timer
      tree.timer += step * burnSpeedMod;

      // Burn duration from tree type, modified by fuel humidity burn speed
      // Trees inside a settlement zone burn 3× longer (harder to lose)
      const baseBurnDur = this.weather.getTreeBurnDuration(tree.treeType) * (tree.inSettlement ? 3 : 1);
      if (tree.timer >= baseBurnDur) {
        this.forest.setState(tree, "burnt");
        continue;
      }

        // Base spread radius from temperature
        const baseRadius = this.weather.getBaseSpreadRadius();
        // Wind radius bonus (max possible, for spatial query)
        const windBonus = this.weather.getWindRadiusBonus();
        const maxSearchRadius = baseRadius + windBonus;
        const neighbors = this.forest.grid.queryCircle(tree.x, tree.y, maxSearchRadius);
        let lit = 0;
        for (const other of neighbors) {
          if (lit >= 1) break;
          if (other.state !== "normal") continue;

          // Distance and angle to target
          const dx = other.x - tree.x;
          const dy = other.y - tree.y;
          const distToTarget = Math.sqrt(dx * dx + dy * dy);
          const angleToTarget = Math.atan2(-dy, dx); // Canvas Y-axis adjusted
          
          // Directional wind factor (0–1) based on angle from wind direction
          const dirFactor = this.weather.getDirectionalWindFactor(angleToTarget);
        // Wind teardrop shape: shrink upwind, extend downwind
          const windShapeFactor = windBonus > 0 ? Math.min(windBonus / (baseRadius + windBonus), 0.5) : 0;
          const minRadius = baseRadius * (1 - windShapeFactor);
          const maxRadius = baseRadius + windBonus;
          const windAdjustedRadius = minRadius + (maxRadius - minRadius) * dirFactor;
          
          // Check if target is within wind-adjusted radius
          if (distToTarget > windAdjustedRadius) continue;

        // Ignition chance: base × min(airHum × fuelHum × treeRes, 1.40)
        let chance = this.weather.computeIgnitionChance(other.treeType);
        
        // If target tree is in Worker Crew zone, fire cannot spread (100% humidity effect)
        if (this.workerCrewZone) {
          const dx = other.x - this.workerCrewZone.x;
          const dy = other.y - this.workerCrewZone.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= this.workerCrewRadius) {
            chance = 0; // No fire spread in humidity zone (100% humidity)
          }
        }
        
        if (Math.random() < chance) {
          this.forest.setState(other, "burning");
          other.timer = 0;
          lit++;
        }
      }
    }
  }

  _angleDiff(a, b) {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}
