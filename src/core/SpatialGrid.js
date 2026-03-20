export class SpatialGrid {
  constructor({ cellSize = 128 } = {}) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _key(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  add(item) {
    const key = this._key(item.x, item.y);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(item);
  }

  queryCircle(x, y, radius) {
    const range = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const out = [];

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        for (const item of bucket) {
          const dx2 = item.x - x;
          const dy2 = item.y - y;
          if (dx2 * dx2 + dy2 * dy2 <= radius * radius) {
            out.push(item);
          }
        }
      }
    }

    return out;
  }

  // Query trees in a rectangular viewport
  queryRect(x, y, width, height) {
    const out = [];
    const minCellX = Math.floor(x / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (bucket) {
          out.push(...bucket);
        }
      }
    }

    return out;
  }
}
