import { describe, it, expect } from 'vitest';
import { buildGrid, cellToLatLon, latLonToCell } from '../src/routing/costGrid.js';
import { setGrid, findRoute, getLastRouteError } from '../src/routing/findRoute.js';
import { makeFakeElevation, FAKE_BOUNDS } from '../src/routing/fakeGrid.js';

// Lat/lon of the centre of row r, column c.
const pt = (grid, r, c) => {
  const { lat, lon } = cellToLatLon(grid, r * grid.cols + c);
  return { lat, lon };
};

function gridFor(opts, hazards) {
  const grid = buildGrid(makeFakeElevation(opts), hazards);
  setGrid(grid);
  return grid;
}

describe('findRoute on a flat grid', () => {
  it('goes straight across open ground', () => {
    const g = gridFor({ wall: false });
    const route = findRoute(pt(g, 5, 5), pt(g, 5, 45));
    expect(route).not.toBeNull();
    expect(route.distanceKm).toBeGreaterThan(7.9);
    expect(route.distanceKm).toBeLessThan(8.1);
    expect(route.maxSlopeDeg).toBe(0);
    expect(route.riskScore).toBe(0);
    expect(route.legs).toHaveLength(1);
    expect(route.path[0].lat).toBeCloseTo(pt(g, 5, 5).lat, 6);
  });
});

describe('findRoute with a ridge', () => {
  it('goes through the gap, not over the ridge', () => {
    const g = gridFor({ wall: true, gap: true });
    const route = findRoute(pt(g, 10, 10), pt(g, 10, 40));
    expect(route).not.toBeNull();
    expect(route.distanceKm).toBeGreaterThan(6); // longer than the 6 km straight line
    for (const p of route.path) {
      const { r, c } = latLonToCell(g, p.lat, p.lon);
      if (c >= 23 && c <= 26) {
        expect(r).toBeGreaterThanOrEqual(21);
        expect(r).toBeLessThanOrEqual(23);
      }
    }
  });

  it('returns null with a reason when the ridge has no gap', () => {
    const g = gridFor({ wall: true, gap: false });
    expect(findRoute(pt(g, 10, 10), pt(g, 10, 40))).toBeNull();
    expect(getLastRouteError()).toMatch(/No safe route/);
  });

  it('refuses a start point that is on the ridge', () => {
    const g = gridFor({ wall: true, gap: false });
    expect(findRoute(pt(g, 10, 23), pt(g, 10, 40))).toBeNull();
    expect(getLastRouteError()).toMatch(/Start/);
  });
});

describe('findRoute inputs', () => {
  it('reports a point outside the map', () => {
    const g = gridFor({ wall: false });
    expect(findRoute({ lat: 0, lon: 0 }, pt(g, 5, 5))).toBeNull();
    expect(getLastRouteError()).toMatch(/outside the map area/);
  });

  it('visits waypoints in order and reports one leg per segment', () => {
    const g = gridFor({ wall: false });
    const stop = { ...pt(g, 30, 25), name: 'Delta' };
    const route = findRoute(pt(g, 5, 5), pt(g, 5, 45), { waypoints: [stop] });
    expect(route.legs).toHaveLength(2);
    expect(route.legs[0].to).toBe('Delta');
    expect(route.legs[1].from).toBe('Delta');
    expect(route.path.some((p) => Math.abs(p.lat - stop.lat) < 1e-9 && Math.abs(p.lon - stop.lon) < 1e-9)).toBe(true);
    const sum = route.legs.reduce((a, l) => a + l.distanceKm, 0);
    expect(Math.abs(route.distanceKm - sum)).toBeLessThan(0.02);
  });

  it('a lower loadFactor makes the same slope impassable', () => {
    const rows = 20, cols = 20, cellSizeM = 200;
    const rise = Math.tan((15 * Math.PI) / 180) * cellSizeM; // constant 15 degree ramp
    const elevation = Array.from({ length: rows }, () => Array.from({ length: cols }, (_, c) => c * rise));
    const grid = buildGrid({ bounds: FAKE_BOUNDS, rows, cols, cellSizeM, elevation });
    setGrid(grid);
    const a = pt(grid, 10, 2), b = pt(grid, 10, 17);
    expect(findRoute(a, b, { maxSlopeDeg: 20, loadFactor: 1 })).not.toBeNull(); // limit 20
    expect(findRoute(a, b, { maxSlopeDeg: 20, loadFactor: 0.5 })).toBeNull(); // limit 10
  });
});

describe('hazard polygons', () => {
  it('routes around a rock field', () => {
    const base = makeFakeElevation({ wall: false });
    const probe = buildGrid(base);
    // Rock field covering columns 20-29 and rows 0-39, leaving rows 40-49 open.
    const nw = cellToLatLon(probe, 0 * 50 + 20);
    const se = cellToLatLon(probe, 39 * 50 + 29);
    const w = nw.lon - 0.0001, e = se.lon + 0.0001, n = nw.lat + 0.0001, s = se.lat - 0.0001;
    const hazards = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'rock' },
          geometry: { type: 'Polygon', coordinates: [[[w, n], [e, n], [e, s], [w, s], [w, n]]] },
        },
      ],
    };
    const g = gridFor({ wall: false }, hazards);
    const route = findRoute(pt(g, 10, 10), pt(g, 10, 40));
    expect(route).not.toBeNull();
    expect(route.distanceKm).toBeGreaterThan(6);
    for (const p of route.path) {
      const { r, c } = latLonToCell(g, p.lat, p.lon);
      if (c >= 20 && c <= 29) expect(r).toBeGreaterThanOrEqual(40);
    }
  });
});
