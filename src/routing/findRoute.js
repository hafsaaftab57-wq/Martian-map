// Public routing API. Contract is in ARCHITECTURE.md.
//
//   initRouting(elevationData, hazardsGeoJson)   call once after the data loads (Arbish)
//   findRoute(start, end, options)               returns a RouteResult or null
//   getLastRouteError()                          plain-English reason when findRoute returned null
import { ROUTING } from '../config.js';
import { buildGrid, latLonToCell, cellToLatLon, HAZARD_NAME, HAZARD_RISK } from './costGrid.js';
import { aStar } from './astar.js';

const SQRT2 = Math.SQRT2;
let GRID = null;
let lastError = null;

export function initRouting(elevationData, hazardsGeoJson = null) {
  GRID = buildGrid(elevationData, hazardsGeoJson);
  lastError = null;
  return GRID;
}

// For tests and tools that already built a grid.
export function setGrid(grid) {
  GRID = grid;
  lastError = null;
}

export function getLastRouteError() {
  return lastError;
}

export function findRoute(start, end, options = {}) {
  lastError = null;
  if (!GRID) return fail('Routing is not ready. The elevation data has not loaded.');

  const opt = { ...ROUTING, ...options };
  const effMaxSlope = opt.maxSlopeDeg * opt.loadFactor;
  const speedKmh = opt.walkSpeedKmh * opt.loadFactor;

  const points = [
    { ...start, name: 'Start' },
    ...(opt.waypoints || []).map((w, i) => ({ ...w, name: w.name || `Stop ${i + 1}` })),
    { ...end, name: 'End' },
  ];

  const cells = points.map((p) => latLonToCell(GRID, p.lat, p.lon));
  const outside = points.findIndex((_, i) => cells[i] === null);
  if (outside !== -1) return fail(`${points[outside].name} is outside the map area.`);

  const legs = [];
  const allCells = [];
  const total = { distM: 0, minutes: 0, maxSlope: 0, riskSum: 0, riskMax: 0, count: 0, hazards: new Set() };

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i], to = points[i + 1];
    const res = aStar(GRID, cells[i].idx, cells[i + 1].idx, effMaxSlope, opt.slopeWeight);
    if (res.error === 'start_blocked') return fail(`${from.name} is on ground too steep or blocked to stand on.`);
    if (res.error === 'goal_blocked') return fail(`${to.name} is on ground too steep or blocked to reach.`);
    if (res.error) return fail(`No safe route from ${from.name} to ${to.name}.`);

    const m = legMetrics(GRID, res.cells, effMaxSlope);
    const minutes = (m.distM / 1000 / speedKmh) * 60;
    legs.push({
      from: from.name,
      to: to.name,
      distanceKm: round(m.distM / 1000, 2),
      walkMinutes: Math.round(minutes),
      maxSlopeDeg: round(m.maxSlope, 1),
      riskScore: riskScore(m.riskSum, m.count, m.riskMax),
    });

    // Drop the first cell of later legs: it repeats the previous leg's last cell.
    allCells.push(...(i === 0 ? res.cells : res.cells.slice(1)));
    total.distM += m.distM;
    total.minutes += minutes;
    total.maxSlope = Math.max(total.maxSlope, m.maxSlope);
    total.riskSum += m.riskSum;
    total.riskMax = Math.max(total.riskMax, m.riskMax);
    total.count += m.count;
    m.hazards.forEach((h) => total.hazards.add(h));
  }

  return {
    path: allCells.map((idx) => cellToLatLon(GRID, idx)),
    distanceKm: round(total.distM / 1000, 2),
    walkMinutes: Math.round(total.minutes),
    maxSlopeDeg: round(total.maxSlope, 1),
    riskScore: riskScore(total.riskSum, total.count, total.riskMax),
    o2UsedPct: Math.round((total.minutes / opt.o2LimitMinutes) * 100),
    hazardsCrossed: [...total.hazards],
    legs,
  };
}

function fail(message) {
  lastError = message;
  return null;
}

function round(x, places) {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}

// Path length in 3D, steepest slope, and the numbers the risk score is built from.
function legMetrics(grid, cells, effMaxSlope) {
  const { z, cols, cellSizeM, slopeDeg, hazard } = grid;
  let distM = 0, maxSlope = 0, riskSum = 0, riskMax = 0;
  const hazards = new Set();
  for (let i = 0; i < cells.length; i++) {
    const idx = cells[i];
    if (i > 0) {
      const p = cells[i - 1];
      const dr = Math.abs(Math.floor(idx / cols) - Math.floor(p / cols));
      const dc = Math.abs((idx % cols) - (p % cols));
      distM += Math.hypot(cellSizeM * (dr && dc ? SQRT2 : 1), z[idx] - z[p]);
    }
    maxSlope = Math.max(maxSlope, slopeDeg[idx]);
    const h = hazard[idx];
    if (h) hazards.add(HAZARD_NAME[h]);
    const risk = Math.max(Math.min(1, slopeDeg[idx] / effMaxSlope), HAZARD_RISK[h]);
    riskSum += risk;
    riskMax = Math.max(riskMax, risk);
  }
  return { distM, maxSlope, riskSum, riskMax, count: cells.length, hazards };
}

// 0 safe to 100 dangerous. Blends the average risk along the path with the worst single cell.
// This is a demo heuristic. Say so in the project description.
function riskScore(sum, count, max) {
  const avg = count ? sum / count : 0;
  return Math.max(0, Math.min(100, Math.round(100 * (0.6 * avg + 0.4 * max))));
}
