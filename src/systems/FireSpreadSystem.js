export class FireSpreadSystem {
  constructor({ forest, weather }) {
    this.forest = forest;
    this.weather = weather;
    this.spreadAccumulator = 0;
    this.baseUpdateInterval = 0.6; // seconds between spread checks (faster spread)
    this.updateInterval = this.baseUpdateInterval;
    this.workerCrewZone = null; // Set by GameState each frame
    this.workerCrewRadius = 72; // 3x player spray radius
    this.fireBuildup = null; // Set by GameState each frame
    this.currentBurntCount = 0; // Set by GameState each frame
  }

  reset() {
    this.spreadAccumulator = 0;
  }

  /**
   * Get the fire speed multiplier during build-up phase
   * Returns values from 2.0 (at 0 burnt) to 1.0 (at threshold)
   */
  _getFireBuildupMultiplier() {
    if (!this.fireBuildup?.enabled || this.currentBurntCount >= this.fireBuildup.burntThreshold) {
      return 1.0;
    }

    const progress = this.currentBurntCount / this.fireBuildup.burntThreshold;
    const multiplier = this.fireBuildup.maxSpeedup - (progress * (this.fireBuildup.maxSpeedup - 1.0));
    return multiplier;
  }

  update(dt) {
    // Use the burning trees set for faster iteration instead of filtering all trees
    if (this.forest.burningTrees.size === 0) return;

    // Get fire build-up multiplier (how much faster fire runs)
    const speedupMultiplier = this._getFireBuildupMultiplier();
    
    // Adjust update interval based on speedup during buildup
    // Faster buildup = shorter interval between spread checks
    this.updateInterval = this.baseUpdateInterval / speedupMultiplier;

    this.spreadAccumulator += dt;
    if (this.spreadAccumulator < this.updateInterval) return;

    // Process one spread/burn cycle
    const step = this.updateInterval;
    this.spreadAccumulator -= this.updateInterval;

    for (const tree of this.forest.burningTrees) {
      // During buildup, accelerate tree timer advancement
      // Using 0.7 factor to slow burn slightly (0.7 second burn time)
      tree.timer += step * speedupMultiplier * 0.7;

      // Burn duration shortens with higher temperature: 10°C = 18s, 30°C = 13s, 50°C = 8s
      const burnDuration = Math.max(6, 18 - (this.weather.temperature - 10) * 0.25);
      
      if (tree.timer >= burnDuration) {
        this.forest.setState(tree, "burnt");
        continue;
      }

        // Temperature affects radius: 10°C = 6px, 30°C ≈ 27px, 50°C = 49px
        // Wind (1–100 scale) adds 3–15px to the max search radius
        const baseRadius = Math.max(3, 5 + (this.weather.temperature - 10) * 1.0);
        const windAddedRadius = Math.max(1, (this.weather.windStrength / 100) * 50);
        const maxSearchRadius = baseRadius + windAddedRadius;
        const neighbors = this.forest.grid.queryCircle(tree.x, tree.y, maxSearchRadius);
        let lit = 0;
        for (const other of neighbors) {
          if (lit >= 1) break;
          if (other.state !== "normal") continue;

          // Calculate effective spread radius for this specific target based on wind direction
          const dx = other.x - tree.x;
          const dy = other.y - tree.y;
          const distToTarget = Math.sqrt(dx * dx + dy * dy);
          const angleToTarget = Math.atan2(-dy, dx); // Canvas Y-axis adjusted
          
          // Calculate wind-adjusted radius: expands downwind, contracts upwind
          const windAngleRad = -this.weather.windAngle;  // Already in radians
          const windDiff = this._angleDiff(windAngleRad, angleToTarget);
          const windInfluence = Math.cos(windDiff); // -1 (upwind) to +1 (downwind)
          // Wind expands radius downwind, no bonus upwind
          const windAdjustedRadius = baseRadius + windAddedRadius * Math.max(0, windInfluence);
          
          // Check if target is within wind-adjusted radius
          if (distToTarget > windAdjustedRadius) continue;

        let chance = this.weather.computeSpreadModifier(tree, other);
        
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
