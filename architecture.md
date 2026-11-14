# Architecture

Mars Navigator runs entirely in the browser. There is no backend, which keeps deployment to one static site and lets five people work without waiting on a server.

## Overview

```
                     ┌──────────────────────────┐
                     │   data/ (Hafse)          │
                     │   elevation_grid.json    │
                     │   poi.geojson            │
                     │   hazards.geojson        │
                     │   ice.geojson            │
                     └────────────┬─────────────┘
                                  │ loaded once at startup
                                  ▼
                     ┌──────────────────────────┐
                     │ src/api/dataLoader.js    │  (Arbish)
                     └────────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
   ┌────────────────────┐ ┌───────────────┐ ┌──────────────────────┐
   │ src/map/ (Ayesha)  │ │ src/state/    │ │ src/routing/ (Maheen)│
   │ MapView, layers,   │◄┤ store.js      ├►│ costGrid, astar,     │
   │ POI, hazards,      │ │ (Arbish)      │ │ findRoute,           │
   │ RouteLayer         │ └───────┬───────┘ │ terrainScore (opt.)  │
   └────────────────────┘         │         └──────────────────────┘
                                  ▼
                     ┌──────────────────────────┐
                     │ src/components/ (Maya)   │
                     │ RoutePanel, Elevation-   │
                     │ Chart, Legend, Toggles   │
                     └──────────────────────────┘
```

## Data flow

1. At startup `dataLoader.js` loads the four files in `data/` and puts them in the store.
2. `MapView.jsx` draws base tiles from `TILE_LAYERS` in `src/config.js`, then the point-of-interest, hazard and ice layers from the loaded data.
3. The user clicks the map. `MapView.jsx` writes `start`, then `end`, to the store.
4. `integration.js` sees both points, calls `findRoute(start, end, options)` and writes the result to `route` in the store.
5. `RouteLayer.jsx` draws `route.path` on the map. `RoutePanel.jsx` and `ElevationChart.jsx` read the same `route` and show numbers and the profile.
6. Clicking a point of interest sets `selectedPoi`. The popup reads it from the store.

Rule: no component talks directly to another folder. Everything goes through `store.js`, the loaded data, or the `findRoute` function.

## Folder layout

```
martian-navigator/
├── README.md
├── ARCHITECTURE.md
├── package.json
├── index.html
├── assets/                     Maya
├── data/                       Hafse
│   ├── elevation_grid.json
│   ├── poi.geojson
│   ├── hazards.geojson
│   ├── ice.geojson
│   └── sources.md
├── docs/
│   ├── DEMO_SCRIPT.md          Maya
│   └── SUBMISSION_CHECKLIST.md Arbish
├── src/
│   ├── App.jsx                 Ayesha
│   ├── main.jsx                Ayesha
│   ├── config.js               Hafse (tiles), Maheen (routing constants)
│   ├── integration.js          Arbish
│   ├── api/
│   │   └── dataLoader.js       Arbish
│   ├── state/
│   │   └── store.js            Arbish
│   ├── map/                    Ayesha
│   │   ├── MapView.jsx
│   │   ├── layers.js
│   │   ├── PoiLayer.jsx
│   │   ├── HazardLayer.jsx
│   │   └── RouteLayer.jsx
│   ├── routing/                Maheen
│   │   ├── costGrid.js
│   │   ├── astar.js
│   │   ├── findRoute.js
│   │   └── terrainScore.js     optional
│   ├── components/             Maya
│   │   ├── RoutePanel.jsx
│   │   ├── ElevationChart.jsx
│   │   ├── Legend.jsx
│   │   └── LayerToggles.jsx
│   └── styles/
│       └── theme.css           Maya
└── tests/
    ├── routing.test.js         Maheen + Arbish
    └── demoFlow.test.js        Arbish
```

## Contracts between members

These two contracts are agreed at kickoff. Changing either one means telling everyone first.

### 1. Data file formats (Hafse → everyone)

**`data/elevation_grid.json`**

```json
{
  "bounds": { "west": 77.0, "south": 17.8, "east": 77.8, "north": 18.6 },
  "rows": 200,
  "cols": 200,
  "cellSizeM": 300,
  "elevation": [[-2540.1, -2538.7], [-2541.0, -2539.2]]
}
```

- `elevation` is `rows` arrays of `cols` numbers, in metres. Row 0 is the north edge, column 0 is the west edge.
- Coordinates are degrees: latitude north, longitude east. The numbers above are placeholders. Hafse replaces them with the real bounds of the chosen area.

**`data/poi.geojson`** — Point features with these properties:

| Property | Meaning |
| --- | --- |
| `name` | Display name |
| `type` | One of `landing`, `ice`, `rover`, `crater`, `landmark` |
| `description` | One or two sentences for the popup |
| `scienceReason` | Why this place serves the mission science goal |
| `survivalNote` | Why this place matters for astronauts |
| `source` | Where the fact came from |

**`data/hazards.geojson`** — Polygon features with:

| Property | Meaning |
| --- | --- |
| `type` | One of `steep`, `dune`, `rough`, `rock` |
| `maxSlopeDeg` | Highest slope inside the polygon, in degrees |

`steep` and `rock` polygons are blocked cells in the router. `dune` and `rough` add cost.

**`data/pov_images.json`** — one entry per stop:

```json
{ "Stop name": { "imageUrl": "https://...", "credit": "NASA/JPL-Caltech", "note": "What the astronaut will see" } }
```

### 2. Route function (Maheen → Ayesha, Maya, Arbish)

```js
// src/routing/findRoute.js
findRoute(start, end, options?) → RouteResult | null
```

Inputs:

```js
start = { lat: 18.44, lon: 77.45 }
end   = { lat: 18.40, lon: 77.60 }
options = {
  waypoints: [ { lat: 18.42, lon: 77.50, name: "Stop 1" } ],  // optional science stops, visited in order
  maxSlopeDeg: 20,       // before load factor
  loadFactor: 0.8,       // 1 = no load; lower = suit and equipment slow and limit the astronaut
  walkSpeedKmh: 3,
  o2LimitMinutes: 240
}  // all optional
```

Output:

```js
{
  path: [ { lat, lon, elevM }, ... ],   // ordered points from start through stops to end
  distanceKm: 12.4,
  walkMinutes: 248,
  maxSlopeDeg: 14.2,
  riskScore: 37,                        // 0 safe to 100 dangerous
  o2UsedPct: 103,                       // walk time divided by o2LimitMinutes
  hazardsCrossed: [ "steep", "rough" ],
  legs: [                               // one entry per leg; a single leg when there are no waypoints
    { from: "Start", to: "Stop 1", distanceKm: 5.1, walkMinutes: 102, maxSlopeDeg: 11.0, riskScore: 30 }
  ]
}
```

Effective slope limit is `maxSlopeDeg * loadFactor`, and effective walking speed is `walkSpeedKmh * loadFactor`.

Returns `null` if any point is outside the grid, or if any leg has no route under the slope limit. After a `null`, call `getLastRouteError()` for a plain-English reason (for example "No safe route from Stop 1 to End.") and show it in the UI. `integration.js` writes it to `routeError`.

Setup: Arbish's `dataLoader.js` calls `initRouting(elevationData, hazardsGeoJson)` once after the data files load, before any call to `findRoute`. Until then `findRoute` returns `null`.

```js
import { initRouting, findRoute, getLastRouteError } from './routing/findRoute.js';
```

Build order for Maheen: single leg first, waypoints second. Ayesha and Arbish build against the single-leg shape from the start, because `legs` always has at least one entry.

All defaults live in `src/config.js` so they can be changed in one place. The walking speed and oxygen limit are assumptions for the demo, not mission data. The app and the project description must say that.

## Routing approach

1. **Slope per cell:** from neighbouring elevations and `cellSizeM`, in degrees.
2. **Cost per cell:** `1 + (slopeDeg / maxSlopeDeg)²`. Cells at or above `maxSlopeDeg`, or inside a hazard polygon of type `steep`, are blocked.
3. **Search:** A* with eight-direction moves, distance-based heuristic, and move cost scaled by the average of the two cells.
4. **Result:** cell path converted back to lat/lon with elevation. Risk score is the average cost of the path scaled to 0-100.
5. **Optional ML:** `terrainScore.js` returns safe, risky or avoid per cell and multiplies the cost from step 2. It is skipped if it is not ready by Sunday 1 PM.

A downsampled grid of about 200 x 200 cells keeps search fast enough to run in the browser on each click.

## State shape

`src/state/store.js` holds exactly this:

```js
{
  data: { elevation, poi, hazards, ice },   // set once by dataLoader
  start: null | { lat, lon },
  waypoints: [],                            // science stops, in visit order
  end: null | { lat, lon },
  route: null | RouteResult,
  routeError: null | string,
  visibleLayers: { terrain: true, hazards: true, poi: true, ice: false },
  selectedPoi: null | Feature
}
```

Components subscribe to the parts they need. Only these writers are allowed:

| Field | Written by |
| --- | --- |
| `data` | `dataLoader.js` |
| `start`, `waypoints`, `end` | `MapView.jsx` (and `PoiLayer.jsx` for "Add as stop") |
| `route`, `routeError` | `integration.js` |
| `visibleLayers` | `LayerToggles.jsx` |
| `selectedPoi` | `PoiLayer.jsx` |

## Technology

| Part | Choice | Notes |
| --- | --- | --- |
| Build | Vite + React | `npm run dev` for local work |
| Map | Leaflet or MapLibre | Ayesha picks one on Saturday evening and tells the team. Check that the Mars tile projection matches before committing to either. |
| Base tiles | NASA Mars Trek tile services | Hafse confirms the working URLs and writes them in `config.js` |
| Charts | A small chart library or plain SVG | Maya's choice, keep it light |
| Tests | Vitest | Routing and demo flow only |
| Hosting | Vercel or GitHub Pages | Static build in `dist/` |

## Integration checkpoints

| Checkpoint | What must work |
| --- | --- |
| Sat 11 PM | Map shows tiles and toggles. Data files load. `findRoute` returns a path on a test grid. Panel renders with fake numbers. |
| Sun 1 PM (freeze) | Click start and end → real route on the map → real numbers in the panel and chart. |
| Sun 5 PM | Deployed link works on a fresh browser. Video recorded. Description written. |

## Fallbacks

| If this fails | Do this |
| --- | --- |
| Tile service is slow or blocked | Lower the zoom, cache screenshots for the video |
| `terrainScore.js` not ready | Ship slope-only routing and mention ML as future work |
| Routing too slow | Shrink the grid or limit the area to one crater |
| Deploy fails near the deadline | Record the video from a local run and submit the repo link |