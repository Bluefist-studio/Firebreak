/**
 * BaseMode
 * Base class for all game modes. Provides common functionality and fire initialization
 * based on mission configuration parameters.
 *
 * Modes should extend this class and override specific methods as needed.
 */
export class BaseMode {
  constructor() {
    // Subclasses can override
  }

  /**
   * Initialize a new game session
   */
  initializeNewSession(missionStartMoney) {
    // Override in subclass if needed
  }

  /**
   * Get announcement text for display
   */
  getAnnouncementText(isFirstRun) {
    return "Game Mode";
  }

  /**
   * Get a scaled/modified mission for this session
   * 
   * Default implementation respects randomizeWind flag from mission.
   * Override in subclasses to add custom scaling (difficulty progression, etc).
   */
  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));
    
    // Respect randomizeWind flag from mission
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }
    
    return scaledMission;
  }

  /**
   * Get starting money for current session
   */
  getStartingMoney(missionStartMoney) {
    return missionStartMoney;
  }

  /**
   * Skill cost multiplier (1 = normal, 0 = free)
   */
  getSkillCostMultiplier() {
    return 1;
  }

  /**
   * Whether skills should be free to use in this mode
   */
  isSkillFree() {
    return false;
  }

  /**
   * Called when player completes a level
   */
  onLevelComplete(finalMoney) {
    // Override in subclass if needed
  }

  /**
   * Progress to next day/retry
   */
  progressDay() {
    // Override in subclass if needed
  }

  /**
   * Reset mode to initial state
   */
  reset() {
    // Override in subclass if needed
  }

  /**
   * Whether fire control modal should be visible
   */
  shouldShowFireControl() {
    return false;
  }

  /**
   * DEPRECATED: Wind randomization is now controlled by mission.weather.randomizeWind flag
   * This method is kept for backward compatibility but no longer performs any function.
   * See getScaledMission() and missions.js for the new wind control system.
   */
  shouldRandomizeWind() {
    return true;
  }

  /**
   * Initialize fires based on mission configuration
   * This unified method respects fireStartCount, fireStartPattern, and fireStartQuadrants
   * 
   * Patterns:
   * - "center": All fires at center of play area
   * - "quadrant": Fires in specified fireStartQuadrants (distributed ~1 per quadrant)
   * - "random quadrant": All fires in a single randomly selected quadrant
   * - "random": Fires spawn randomly across entire play area
   */
  initializeFires(forest, mission) {
    const fireCount = mission.fireStartCount ?? 1;
    const firePattern = mission.fireStartPattern ?? "center";
    const allowedQuadrants = mission.fireStartQuadrants ?? ["NW", "NE", "SE", "SW"];
    const fireRadius = mission.fireStartRadius ?? null;

    if (firePattern === "center") {
      return this._initializeFiresCenter(forest, fireCount, fireRadius);
    } else if (firePattern === "quadrant") {
      return this._initializeFiresQuadrant(forest, fireCount, allowedQuadrants);
    } else if (firePattern === "random quadrant") {
      return this._initializeFiresRandomQuadrant(forest, fireCount, allowedQuadrants);
    } else if (firePattern === "random") {
      return this._initializeFiresRandom(forest, fireCount);
    } else {
      // Fallback to center
      return this._initializeFiresCenter(forest, fireCount);
    }
  }

  /**
   * Initialize fires at center of map - ignite a small radius of trees
   */
  _initializeFiresCenter(forest, count, radius = null) {
    const centerX = forest.width / 2;
    const centerY = forest.height / 2;
    const ignitionRadius = radius ?? 25;
    const nearby = [...forest.grid.queryCircle(centerX, centerY, ignitionRadius)]
      .filter(t => t.state === "normal");
    for (const tree of nearby) forest.setState(tree, "burning");
    if (nearby.length === 0) return this._initializeFiresCenterLarge(forest, count);
  }

  /**
   * Fallback: Initialize fires at center with large radius
   */
  _initializeFiresCenterLarge(forest, count) {
    const centerX = forest.width / 2;
    const centerY = forest.height / 2;
    const ignitionRadius = 30; // Large fallback radius when no trees found at default radius
    let firesSpawned = 0;
    const treesInRadius = [];
    
    // Find all normal trees within the large ignition radius
    for (const tree of forest.trees) {
      if (tree.state !== "normal") continue;
      
      const dx = tree.x - centerX;
      const dy = tree.y - centerY;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      if (dist <= ignitionRadius) {
        treesInRadius.push({ tree, dist });
      }
    }
    // Ignite all trees in the radius
    for (const { tree } of treesInRadius) {
      forest.setState(tree, "burning");
      firesSpawned++;
    }

    if (firesSpawned === 0) {
      return this._initializeFiresRandom(forest, count);
    } else {
    }
  }

  /**
   * Initialize fires in specified quadrants
   */
  _initializeFiresQuadrant(forest, count, allowedQuadrants) {
    if (allowedQuadrants.length === 0) {
      this._initializeFiresCenter(forest, count);
      return;
    }

    const firesPerQuadrant = Math.max(1, Math.ceil(count / allowedQuadrants.length));
    for (const entry of allowedQuadrants) {
      const parsed = typeof entry === 'string'
        ? { quadrant: entry, cornerOffset: 0.5, centerOffset: null, radius: null }
        : { quadrant: entry.quadrant, cornerOffset: entry.cornerOffset ?? 0.5, centerOffset: entry.centerOffset ?? null, radius: entry.radius ?? null };
      this._initializeFiresInQuadrant(forest, firesPerQuadrant, parsed.quadrant, parsed.cornerOffset, parsed.centerOffset, parsed.radius);
    }
  }

  /**
   * Helper: Initialize fires in a specific quadrant, at the center
   */
  _initializeFiresInQuadrant(forest, count, quadrant, cornerOffset = 0.5, centerOffset = null, radius = null) {
    const halfWidth = forest.width / 2;
    const halfHeight = forest.height / 2;

    // Define quadrant boundaries
    const quadrants = {
      NW: { minX: 0, maxX: halfWidth, minY: 0, maxY: halfHeight },
      NE: { minX: halfWidth, maxX: forest.width, minY: 0, maxY: halfHeight },
      SW: { minX: 0, maxX: halfWidth, minY: halfHeight, maxY: forest.height },
      SE: { minX: halfWidth, maxX: forest.width, minY: halfHeight, maxY: forest.height },
    };

    const quad = quadrants[quadrant];
    if (!quad) {
      return;
    }

    const mapCenterX = forest.width / 2;
    const mapCenterY = forest.height / 2;
    const cornerX = quadrant.includes('W') ? 0 : forest.width;
    const cornerY = quadrant.includes('N') ? 0 : forest.height;
    // centerOffset {x,y}: pixel offset from quadrant center (takes priority over cornerOffset)
    // cornerOffset: lerp from outer corner toward map center (0=corner, 0.5=quadrant center, 1=map center)
    let centerX, centerY;
    if (centerOffset) {
      const quadCX = cornerX + (mapCenterX - cornerX) * 0.5;
      const quadCY = cornerY + (mapCenterY - cornerY) * 0.5;
      centerX = quadCX + (centerOffset.x ?? 0);
      centerY = quadCY + (centerOffset.y ?? 0);
    } else {
      centerX = cornerX + (mapCenterX - cornerX) * cornerOffset;
      centerY = cornerY + (mapCenterY - cornerY) * cornerOffset;
    }
    if (radius != null) {
      // Ignite ALL trees within the given radius of the center point
      const nearby = [...forest.grid.queryCircle(centerX, centerY, radius)]
        .filter(t => t.state === "normal");
      if (nearby.length === 0) forest.igniteRandom(count);
      for (const tree of nearby) forest.setState(tree, "burning");
      return;
    }

    // No radius — ignite the nearest `count` trees in the quadrant
    const treesInQuad = [];
    for (const tree of forest.trees) {
      if (tree.state !== "normal") continue;
      if (tree.x < quad.minX || tree.x >= quad.maxX || tree.y < quad.minY || tree.y >= quad.maxY) continue;
      const dx = tree.x - centerX;
      const dy = tree.y - centerY;
      treesInQuad.push({ tree, distSq: dx * dx + dy * dy });
    }

    if (treesInQuad.length === 0) return;

    treesInQuad.sort((a, b) => a.distSq - b.distSq);
    for (let i = 0; i < count && i < treesInQuad.length; i++) {
      forest.setState(treesInQuad[i].tree, "burning");
    }
  }

  /**
   * Initialize fires: 1 fire per randomly selected quadrant
   */
  _initializeFiresRandomQuadrant(forest, count, allowedQuadrants) {
    if (allowedQuadrants.length === 0) {
      this._initializeFiresCenter(forest, count);
      return;
    }

    // Shuffle the allowed quadrants and pick the first count
    const shuffled = [...allowedQuadrants].sort(() => Math.random() - 0.5);
    const selectedQuadrants = shuffled.slice(0, Math.min(count, shuffled.length));
    // Spawn 1 fire in each selected quadrant
    for (const entry of selectedQuadrants) {
      const parsed = typeof entry === 'string'
        ? { quadrant: entry, cornerOffset: 0.5, centerOffset: null, radius: null }
        : { quadrant: entry.quadrant, cornerOffset: entry.cornerOffset ?? 0.5, centerOffset: entry.centerOffset ?? null, radius: entry.radius ?? null };
      this._initializeFiresInQuadrant(forest, 1, parsed.quadrant, parsed.cornerOffset, parsed.centerOffset, parsed.radius);
    }
  }

  /**
   * Initialize fires randomly across the entire play area
   */
  _initializeFiresRandom(forest, count) {
    let firesSpawned = 0;
    const attempts = Math.min(count * 5, forest.trees.length); // Limit attempts to avoid infinite loop

    for (let i = 0; i < attempts && firesSpawned < count; i++) {
      const tree = forest.trees[Math.floor(Math.random() * forest.trees.length)];
      if (tree.state === "normal") {
        forest.setState(tree, "burning");
        firesSpawned++;
      }
    }

    if (firesSpawned === 0) {
    } else {
    }
  }
}
