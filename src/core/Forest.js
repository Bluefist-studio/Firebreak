import { SpatialGrid } from "./SpatialGrid.js";

// Seedable PRNG (mulberry32) for reproducible forest generation
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

//conifer: 
// tree_normal1.png - tree_normal4.png
// burning_tree2.png
// burnt_tree.png
// supressed_tree.png

//deciduous:
// tree_normal6.png, tree_normal8.png, tree_normal9.png
// burning_tree1.png
// burnt_tree2.png
// supressed_tree2.png (same as conifer)

const TREE_STATES = {
  NORMAL: "normal",
  BURNING: "burning",
  BURNT: "burnt",
  WET: "wet",
};

export class Forest {
  constructor({ width, height, treeCount, sprites = null, defaultTreeType = "conifer", treeMix = null, forestStyle = "clustered", seed = null, forestGradient = null }) {
    this.width = width;
    this.height = height;
    this.treeCount = treeCount;
    this.sprites = sprites;
    this.defaultTreeType = defaultTreeType;
    this.treeMix = treeMix;
    this.forestStyle = forestStyle;
    this.forestGradient = forestGradient;
    this.seed = seed; // null = generate a fresh seed each time

    this.trees = [];
    this.grid = new SpatialGrid({ cellSize: 100 });
    this.burningTrees = new Set(); // Track burning trees for quick access

    this.normalCount = 0;
    this.burningCount = 0;
    this.burntCount = 0;
    this.wetCount = 0;
    this.everBurnedCount = 0;

    // Zones within which normal trees are rendered at 0.5 alpha (Fire Watch + Drone Recon).
    // Populated by GameState each frame before rendering.
    this.visibilityZones = [];

    // Settlement zones: trees inside these use settlement-specific sprites.
    // Populated by GameState each frame before rendering.
    this.settlementZones = [];
  }

  generate() {
    this.trees = [];
    this.burningTrees.clear();
    this.normalCount = 0;
    this.burningCount = 0;
    this.burntCount = 0;
    this.wetCount = 0;
    this.grid.clear();

    // Use fixed seed from mission data, or generate a fresh random seed
    const activeSeed = this.seed ?? Math.floor(Math.random() * 2 ** 32);
    this.seed = activeSeed; // Store so it can be read back (e.g. debug view)
    const rng = mulberry32(activeSeed);

    const coniferPct = this.treeMix?.conifer ?? (this.defaultTreeType === "conifer" ? 100 : 0);

    if (this.forestStyle === "dense") {
      // Dense style: uniformly random placement across the whole map
      for (let i = 0; i < this.treeCount; i++) {
        const x = rng() * this.width;
        const y = rng() * this.height;
        const treeType = rng() * 100 < coniferPct ? "conifer" : "deciduous";
        const normalSpriteCount = treeType === "conifer" ? 4 : 3;
        const tree = {
          x,
          y,
          state: TREE_STATES.NORMAL,
          treeType,
          timer: rng() * 2,
          extinguishTimer: 0,
          cutTimer: 0,
          hasEverBurned: false,
          spriteIndex: Math.floor(rng() * normalSpriteCount),
        };
        this.trees.push(tree);
        this.grid.add(tree);
        this.normalCount++;
      }
    } else if (this.forestStyle === "gradient") {
      // Gradient style: density driven by weighted control points.
      // Each control point: { x, y, radius, density, treeType? }
      //   x, y       — world position (0..width, 0..height)
      //   radius     — influence radius in px (density falls off to 0 at edge)
      //   density    — 0..1 peak density (1 = same as dense style)
      //   treeType?  — "conifer" | "deciduous" | omit for treeMix
      // Trees are placed by rejection-sampling: pick a random point, compute its
      // weight as the max influence across all control points, then accept with
      // probability proportional to that weight.
      const cps = this.forestGradient ?? [];
      let placed = 0;
      const maxAttempts = this.treeCount * 40;
      for (let attempt = 0; placed < this.treeCount && attempt < maxAttempts; attempt++) {
        const x = rng() * this.width;
        const y = rng() * this.height;

        // Weight = max influence across all control points (smooth falloff)
        let weight = 0;
        let forcedType = null;
        for (const cp of cps) {
          const dx = x - cp.x;
          const dy = y - cp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const r = cp.radius ?? Math.min(this.width, this.height) * 0.3;
          if (dist < r) {
            const t = 1 - dist / r;
            const w = (cp.density ?? 1) * t * t; // quadratic falloff
            if (w > weight) {
              weight = w;
              if (cp.treeType) forcedType = cp.treeType;
            }
          }
        }

        if (weight === 0 || rng() > weight) continue;

        let treeType;
        if (forcedType === null) {
          treeType = rng() * 100 < coniferPct ? "conifer" : "deciduous";
        } else if (typeof forcedType === 'object') {
          treeType = rng() * 100 < (forcedType.conifer ?? 0) ? "conifer" : "deciduous";
        } else {
          treeType = forcedType;
        }
        const normalSpriteCount = treeType === "conifer" ? 4 : 3;
        const tree = {
          x, y,
          state: TREE_STATES.NORMAL,
          treeType,
          timer: rng() * 2,
          extinguishTimer: 0,
          cutTimer: 0,
          hasEverBurned: false,
          spriteIndex: Math.floor(rng() * normalSpriteCount),
        };
        this.trees.push(tree);
        this.grid.add(tree);
        this.normalCount++;
        placed++;
      }
    } else {
      // Clustered style: organic groupings across the map
      const clusterSize = 100;
      const clusterCount = Math.floor(this.treeCount / 50);
      const treesPerCluster = Math.floor(this.treeCount / clusterCount);
      let treesPlaced = 0;

      for (let c = 0; c < clusterCount && treesPlaced < this.treeCount; c++) {
        const clusterCenterX = rng() * this.width;
        const clusterCenterY = rng() * this.height;
        const treeType = rng() * 100 < coniferPct ? "conifer" : "deciduous";
        const normalSpriteCount = treeType === "conifer" ? 4 : 3;

        for (let i = 0; i < treesPerCluster && treesPlaced < this.treeCount; i++) {
          const angle = rng() * Math.PI * 2;
          const distance = Math.sqrt(rng()) * clusterSize;
          const x = clusterCenterX + Math.cos(angle) * distance;
          const y = clusterCenterY + Math.sin(angle) * distance;
          if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

          const tree = {
            x,
            y,
            state: TREE_STATES.NORMAL,
            treeType,
            timer: rng() * 2,
            extinguishTimer: 0,
            cutTimer: 0,
            hasEverBurned: false,
            spriteIndex: Math.floor(rng() * normalSpriteCount),
          };
          this.trees.push(tree);
          this.grid.add(tree);
          this.normalCount++;
          treesPlaced++;
        }
      }
    }
  }

  igniteRandom(count = 1) {
    const candidates = this.trees.filter((t) => t.state === TREE_STATES.NORMAL);
    for (let i = 0; i < count && candidates.length > 0; i++) {
      const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      this.setState(pick, TREE_STATES.BURNING);
    }
  }

  setState(tree, targetState) {
    if (tree.state === targetState) return;
    if (tree.state === TREE_STATES.NORMAL) this.normalCount--;
    if (tree.state === TREE_STATES.BURNING) {
      this.burningCount--;
      this.burningTrees.delete(tree); // Remove from burning set
    }
    if (tree.state === TREE_STATES.BURNT) this.burntCount--;
    if (tree.state === TREE_STATES.WET) this.wetCount = (this.wetCount || 0) - 1;

    // Track cumulative burn history: once any tree has burned, it should count toward buildup even if later suppressed.
    if ((targetState === TREE_STATES.BURNING || targetState === TREE_STATES.BURNT) && !tree.hasEverBurned) {
      tree.hasEverBurned = true;
      this.everBurnedCount++;
    }

    tree.state = targetState;

    tree.extinguishTimer = 0;
    tree.cutTimer = 0;
    tree.timer = 0;
    if (targetState !== TREE_STATES.WET) tree.retardant = false;

    if (targetState === TREE_STATES.NORMAL) this.normalCount++;
    if (targetState === TREE_STATES.BURNING) {
      this.burningCount++;
      this.burningTrees.add(tree); // Add to burning set
      // Initialize independent spread timer with slight randomness for smoother fire spread
      tree.spreadTimer = Math.random() * 0.1; // Stagger between 0-0.1s for organic feel
    }
    if (targetState === TREE_STATES.BURNT) this.burntCount++;
    if (targetState === TREE_STATES.WET) this.wetCount = (this.wetCount || 0) + 1;
  }

  forNearby(x, y, radius, callback) {
    const items = this.grid.queryCircle(x, y, radius);
    for (const tree of items) {
      if (callback(tree) === false) break;
    }
  }

  removeTree(tree) {
    const idx = this.trees.indexOf(tree);
    if (idx === -1) return;
    this.trees.splice(idx, 1);
    this.grid.remove(tree);
    this.burningTrees.delete(tree);
    if (tree.state === "normal") this.normalCount--;
    else if (tree.state === "burning") this.burningCount--;
    else if (tree.state === "burnt") this.burntCount--;
    else if (tree.state === "wet") this.wetCount = Math.max(0, (this.wetCount || 0) - 1);
    // Count toward everBurned for firebreak effect (tree was removed intentionally)
  }
  /**
   * Remove all trees within `halfWidth` pixels of any segment of the given polyline.
   * Used to clear roads and creeks from the forest after generation.
   */
  clearAlongPath(waypoints, halfWidth) {
    if (!waypoints || waypoints.length < 2) return;
    const toRemove = [];
    for (const tree of this.trees) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        if (this._distToSegment(
          tree.x, tree.y,
          waypoints[i].x, waypoints[i].y,
          waypoints[i + 1].x, waypoints[i + 1].y
        ) <= halfWidth) {
          toRemove.push(tree);
          break;
        }
      }
    }
    for (const tree of toRemove) this.removeTree(tree);
  }

  _distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  update(dt) {
    // Wet trees dry out over time and become normal again.
    // Water = short suppression, Retardant = long suppression
    for (const tree of this.trees) {
      if (tree.state !== TREE_STATES.WET) continue;
      tree.timer += dt;
      const duration = tree.retardant ? 10 : 3;
      if (tree.timer >= duration) {
        this.setState(tree, TREE_STATES.NORMAL);
      }
    }
  }

  _renderTreesOfStates(ctx, includeStates) {
    const TREE_SIZE = 28;
    
    // Get current camera transform
    const transform = ctx.getTransform();
    const offsetX = transform.e;
    const offsetY = transform.f;
    
    // Calculate visible world bounds in canvas space
    // The canvas is already transformed by scale and translate
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const zoom = transform.a; // Camera zoom is stored in the transform matrix
    
    // Calculate viewport bounds in world space
    // Expand bounds slightly to avoid pop-in at edges
    const padding = TREE_SIZE;
    const viewportX = -offsetX / zoom - padding;
    const viewportY = -offsetY / zoom - padding;
    const viewportWidth = canvasWidth / zoom + padding * 2;
    const viewportHeight = canvasHeight / zoom + padding * 2;
    
    const canUseSprites = this.sprites?.conifer?.normal[0]?.complete;
    
    // Query only trees in visible viewport using spatial grid
    const visibleTrees = [...this.grid.queryRect(viewportX, viewportY, viewportWidth, viewportHeight)];

    const zones = this.visibilityZones;
    const applyDimming = zones.length > 0 && includeStates.includes(TREE_STATES.NORMAL);

    const _inAnyZone = applyDimming
      ? (tree) => {
          for (const z of zones) {
            const dx = tree.x - z.x, dy = tree.y - z.y;
            if (dx * dx + dy * dy <= z.radius * z.radius) return true;
          }
          return false;
        }
      : null;

    const settlementZones = this.settlementZones;
    const settlementTreeSprites = this.sprites?.settlementTree;

    const _inAnySettlement = settlementZones.length > 0
      ? (tree) => {
          for (const z of settlementZones) {
            const dx = tree.x - z.x, dy = tree.y - z.y;
            if (dx * dx + dy * dy <= z.radius * z.radius) return true;
          }
          return false;
        }
      : null;

    const _drawTree = (tree) => {
      // Normal trees inside a settlement zone are skipped entirely (invisible)
      if (tree.state === TREE_STATES.NORMAL && _inAnySettlement && _inAnySettlement(tree)) return;

      if (canUseSprites) {
        let img;
        const inSettlement = _inAnySettlement && _inAnySettlement(tree);
        if (inSettlement && settlementTreeSprites && tree.state !== TREE_STATES.NORMAL) {
          img =
            tree.state === TREE_STATES.BURNING ? settlementTreeSprites.burning[tree.spriteIndex % settlementTreeSprites.burning.length] :
            tree.state === TREE_STATES.WET ? settlementTreeSprites.wet :
            settlementTreeSprites.burnt;
        } else {
          const typeSprites = this.sprites[tree.treeType] ?? this.sprites.conifer;
          img =
            tree.state === TREE_STATES.NORMAL ? typeSprites.normal[tree.spriteIndex] :
            tree.state === TREE_STATES.BURNING ? typeSprites.burning :
            tree.state === TREE_STATES.WET ? (tree.retardant ? typeSprites.retardant : typeSprites.wet) :
            typeSprites.burnt;
        }

        if (img?.naturalWidth) {
          ctx.drawImage(img, tree.x - TREE_SIZE / 2, tree.y - TREE_SIZE / 2, TREE_SIZE, TREE_SIZE);
          return;
        }
      }

      if (tree.state === TREE_STATES.NORMAL) ctx.fillStyle = tree.treeType === "deciduous" ? "#4b9" : "#2a7";
      else if (tree.state === TREE_STATES.BURNING) ctx.fillStyle = "#f53";
      else if (tree.state === TREE_STATES.WET) ctx.fillStyle = tree.retardant ? "#a3f" : "#3af";
      else ctx.fillStyle = "#444";

      ctx.beginPath();
      ctx.arc(tree.x, tree.y, TREE_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    if (applyDimming) {
      // Pass 1: full alpha — non-normal trees, and normal trees outside all zones
      for (const tree of visibleTrees) {
        if (!includeStates.includes(tree.state)) continue;
        if (tree.state === TREE_STATES.NORMAL && _inAnyZone(tree)) continue;
        _drawTree(tree);
      }
      // Pass 2: 0.5 alpha — normal trees inside a zone
      ctx.globalAlpha = 0.20;
      for (const tree of visibleTrees) {
        if (tree.state !== TREE_STATES.NORMAL) continue;
        if (!_inAnyZone(tree)) continue;
        _drawTree(tree);
      }
      ctx.globalAlpha = 1.0;
    } else {
      for (const tree of visibleTrees) {
        if (!includeStates.includes(tree.state)) continue;
        _drawTree(tree);
      }
    }
  }

  renderNonBurnt(ctx) {
    this._renderTreesOfStates(ctx, [TREE_STATES.NORMAL, TREE_STATES.BURNING, TREE_STATES.WET]);
  }

  renderBurntOnly(ctx) {
    this._renderTreesOfStates(ctx, [TREE_STATES.BURNT]);
  }

  render(ctx) {
    this._renderTreesOfStates(ctx, [TREE_STATES.NORMAL, TREE_STATES.BURNING, TREE_STATES.WET, TREE_STATES.BURNT]);
  }
}
