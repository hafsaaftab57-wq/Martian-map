// A* over the grid, eight directions.
import { HAZARD_COST } from './costGrid.js';

const SQRT2 = Math.SQRT2;
const DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

class MinHeap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }
  get size() {
    return this.keys.length;
  }
  push(key, val) {
    const k = this.keys, v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop() {
    const k = this.keys, v = this.vals;
    const top = v[0];
    const lastK = k.pop(), lastV = v.pop();
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        if (r < n && k[r] < k[l]) l = r;
        if (k[l] >= lastK) break;
        k[i] = k[l];
        v[i] = v[l];
        i = l;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return top;
  }
}

// Cost multiplier per cell: 1 on flat ground, higher on steeper or hazardous ground,
// Infinity when blocked.
export function cellMultipliers(grid, effMaxSlopeDeg, slopeWeight = 1) {
  const n = grid.rows * grid.cols;
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = HAZARD_COST[grid.hazard[i]];
    const s = grid.slopeDeg[i];
    if (h === Infinity || s >= effMaxSlopeDeg) {
      m[i] = Infinity;
    } else {
      const ratio = s / effMaxSlopeDeg;
      m[i] = (1 + slopeWeight * ratio * ratio) * h;
    }
  }
  return m;
}

/**
 * @returns { cells:number[] } on success, { error:'start_blocked'|'goal_blocked'|'no_route' } otherwise
 */
export function aStar(grid, startIdx, goalIdx, effMaxSlopeDeg, slopeWeight = 1) {
  const { rows, cols, cellSizeM, z } = grid;
  const m = cellMultipliers(grid, effMaxSlopeDeg, slopeWeight);
  if (m[startIdx] === Infinity) return { error: 'start_blocked' };
  if (m[goalIdx] === Infinity) return { error: 'goal_blocked' };

  const N = rows * cols;
  const g = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const gr = Math.floor(goalIdx / cols);
  const gc = goalIdx - gr * cols;

  // Octile distance in metres. Every step costs at least its horizontal length, so this never overestimates.
  const h = (r, c) => {
    const dx = Math.abs(c - gc), dy = Math.abs(r - gr);
    return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * cellSizeM;
  };

  const heap = new MinHeap();
  g[startIdx] = 0;
  heap.push(h(Math.floor(startIdx / cols), startIdx % cols), startIdx);

  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goalIdx) break;
    closed[cur] = 1;
    const r = Math.floor(cur / cols);
    const c = cur - r * cols;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const n = nr * cols + nc;
      if (closed[n] || m[n] === Infinity) continue;
      const diagonal = dr !== 0 && dc !== 0;
      // No cutting corners past a blocked cell.
      if (diagonal && (m[r * cols + nc] === Infinity || m[nr * cols + c] === Infinity)) continue;
      const horiz = cellSizeM * (diagonal ? SQRT2 : 1);
      const len = Math.hypot(horiz, z[n] - z[cur]);
      const cost = g[cur] + len * ((m[cur] + m[n]) / 2);
      if (cost < g[n]) {
        g[n] = cost;
        prev[n] = cur;
        heap.push(cost + h(nr, nc), n);
      }
    }
  }

  if (g[goalIdx] === Infinity) return { error: 'no_route' };
  const cells = [];
  for (let i = goalIdx; i !== -1; i = prev[i]) cells.push(i);
  cells.reverse();
  return { cells };
}
