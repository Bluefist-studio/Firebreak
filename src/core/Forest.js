import { SpatialGrid } from "./SpatialGrid.js";

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
  constructor({ width, height, treeCount, sprites = null, defaultTreeType = "conifer", treeMix = null }) {
    this.width = width;
    this.height = height;
    this.treeCount = treeCount;
    this.sprites = sprites;
    this.defaultTreeType = defaultTreeType;
    this.treeMix = treeMix;

    this.trees = [];
    this.grid = new SpatialGrid({ cellSize: 100 });
    this.burningTrees = new Set(); // Track burning trees for quick access

    this.normalCount = 0;
    this.burningCount = 0;
    this.burntCount = 0;
    this.wetCount = 0;
    this.everBurnedCount = 0;
  }

  generate() {
    this.trees = [];
    this.burningTrees.clear();
    this.normalCount = 0;
    this.burningCount = 0;
    this.burntCount = 0;
    this.wetCount = 0;
    this.grid.clear();

    for (let i = 0; i < this.treeCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      let treeType;
      if (this.treeMix) {
        const coniferPct = this.treeMix.conifer ?? 100;
        treeType = Math.random() * 100 < coniferPct ? "conifer" : "deciduous";
      } else {
        treeType = this.defaultTreeType;
      }
      const normalSpriteCount = treeType === "conifer" ? 4 : 3;
      const tree = {
        x,
        y,
        state: TREE_STATES.NORMAL,
        treeType,
        timer: Math.random() * 2, // seconds (used for burn progression and wet duration)
        extinguishTimer: 0,
        cutTimer: 0,
        hasEverBurned: false,
        spriteIndex: Math.floor(Math.random() * normalSpriteCount),
      };
      this.trees.push(tree);
      this.grid.add(tree);
      this.normalCount++;
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
    const visibleTrees = this.grid.queryRect(viewportX, viewportY, viewportWidth, viewportHeight);
    
    for (const tree of visibleTrees) {
      if (!includeStates.includes(tree.state)) continue;
      
      if (canUseSprites) {
        const typeSprites = this.sprites[tree.treeType] ?? this.sprites.conifer;
        const img =
          tree.state === TREE_STATES.NORMAL ? typeSprites.normal[tree.spriteIndex] :
          tree.state === TREE_STATES.BURNING ? typeSprites.burning :
          tree.state === TREE_STATES.WET ? typeSprites.wet :
          typeSprites.burnt;

        if (img?.naturalWidth) {
          ctx.drawImage(img, tree.x - TREE_SIZE / 2, tree.y - TREE_SIZE / 2, TREE_SIZE, TREE_SIZE);
          continue;
        }
      }

      if (tree.state === TREE_STATES.NORMAL) ctx.fillStyle = tree.treeType === "deciduous" ? "#4b9" : "#2a7";
      else if (tree.state === TREE_STATES.BURNING) ctx.fillStyle = "#f53";
      else if (tree.state === TREE_STATES.WET) ctx.fillStyle = tree.retardant ? "#a3f" : "#3af";
      else ctx.fillStyle = "#444";

      ctx.beginPath();
      ctx.arc(tree.x, tree.y, TREE_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
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
