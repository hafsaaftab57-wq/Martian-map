// FAKE test data so routing and the UI can be built before Hafsa's real files arrive.
// Do not ship this in the final demo.

// About 10 km x 10 km near Jezero Crater. Placeholder bounds.
export const FAKE_BOUNDS = { west: 77.4, south: 18.35, east: 77.57, north: 18.52 };

/**
 * 50 x 50 grid of flat ground with an optional ridge down the middle.
 * The ridge is columns 23-26 and 300 m high, so its sides are far too steep to cross.
 * With `gap: true` the ridge has a corridor at rows 21-23 that a route can use.
 */
export function makeFakeElevation({ rows = 50, cols = 50, cellSizeM = 200, wall = true, gap = true } = {}) {
  const base = -2500;
  const mid = Math.floor(cols / 2);
  const elevation = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const onRidge = wall && c >= mid - 2 && c <= mid + 1;
      const inGap = gap && r >= 20 && r <= 24;
      row.push(onRidge && !inGap ? base + 300 : base);
    }
    elevation.push(row);
  }
  return { bounds: FAKE_BOUNDS, rows, cols, cellSizeM, elevation };
}
