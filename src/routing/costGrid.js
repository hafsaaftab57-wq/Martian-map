// Builds the grid the router searches: elevation, slope per cell, hazard per cell.
// Grid layout: row 0 is the north edge, column 0 is the west edge.
// Assumes square cells of `cellSizeM` metres.

export const HAZARD = { NONE: 0, DUNE: 1, ROUGH: 2, STEEP: 3, ROCK: 4 };
const HAZARD_CODE = { dune: 1, rough: 2, steep: 3, rock: 4 };
export const HAZARD_NAME = [null, 'dune', 'rough', 'steep', 'rock'];
// Cost multiplier per hazard code. Infinity = blocked.
export const HAZARD_COST = [1, 1.5, 1.3, Infinity, Infinity];
// Risk contribution per hazard code (0 to 1), used for the risk score.
export const HAZARD_RISK = [0, 0.5, 0.4, 1, 1];

/**
 * @param elevationData { bounds:{west,south,east,north}, rows, cols, cellSizeM, elevation:number[][] }
 * @param hazardsGeoJson optional FeatureCollection of Polygon/MultiPolygon with properties.type
 */
export function buildGrid(elevationData, hazardsGeoJson = null) {
  const { bounds, rows, cols, cellSizeM, elevation } = elevationData;
  const z = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) z[r * cols + c] = elevation[r][c];
  }

  const slopeDeg = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const r0 = Math.max(r - 1, 0);
    const r1 = Math.min(r + 1, rows - 1);
    for (let c = 0; c < cols; c++) {
      const c0 = Math.max(c - 1, 0);
      const c1 = Math.min(c + 1, cols - 1);
      const dx = (c1 - c0) * cellSizeM;
      const dy = (r1 - r0) * cellSizeM;
      const dzdx = dx ? (z[r * cols + c1] - z[r * cols + c0]) / dx : 0;
      const dzdy = dy ? (z[r1 * cols + c] - z[r0 * cols + c]) / dy : 0;
      slopeDeg[r * cols + c] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    }
  }

  const grid = {
    rows,
    cols,
    cellSizeM,
    bounds,
    z,
    slopeDeg,
    hazard: new Uint8Array(rows * cols),
  };
  if (hazardsGeoJson) rasterizeHazards(grid, hazardsGeoJson);
  return grid;
}

export function latLonToCell(grid, lat, lon) {
  const { west, south, east, north } = grid.bounds;
  if (lat < south || lat > north || lon < west || lon > east) return null;
  let r = Math.floor(((north - lat) / (north - south)) * grid.rows);
  let c = Math.floor(((lon - west) / (east - west)) * grid.cols);
  r = Math.min(r, grid.rows - 1);
  c = Math.min(c, grid.cols - 1);
  return { r, c, idx: r * grid.cols + c };
}

// Centre of a cell, with its elevation.
export function cellToLatLon(grid, idx) {
  const { west, south, east, north } = grid.bounds;
  const r = Math.floor(idx / grid.cols);
  const c = idx - r * grid.cols;
  return {
    lat: north - ((r + 0.5) / grid.rows) * (north - south),
    lon: west + ((c + 0.5) / grid.cols) * (east - west),
    elevM: grid.z[idx],
  };
}

function rasterizeHazards(grid, geojson) {
  for (const feature of geojson.features || []) {
    const code = HAZARD_CODE[feature.properties && feature.properties.type];
    if (!code || !feature.geometry) continue;
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates
          : [];
    for (const rings of polygons) paintPolygon(grid, rings, code);
  }
}

function paintPolygon(grid, rings, code) {
  const { west, south, east, north } = grid.bounds;
  const outer = rings[0];
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of outer) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const c0 = Math.max(0, Math.floor(((minLon - west) / (east - west)) * grid.cols));
  const c1 = Math.min(grid.cols - 1, Math.ceil(((maxLon - west) / (east - west)) * grid.cols));
  const r0 = Math.max(0, Math.floor(((north - maxLat) / (north - south)) * grid.rows));
  const r1 = Math.min(grid.rows - 1, Math.ceil(((north - minLat) / (north - south)) * grid.rows));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const idx = r * grid.cols + c;
      const { lat, lon } = cellToLatLon(grid, idx);
      if (inPolygon(lon, lat, rings) && code > grid.hazard[idx]) grid.hazard[idx] = code;
    }
  }
}

// Ray casting. rings[0] is the outer ring, the rest are holes.
function inPolygon(lon, lat, rings) {
  if (!inRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(lon, lat, rings[i])) return false;
  return true;
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
