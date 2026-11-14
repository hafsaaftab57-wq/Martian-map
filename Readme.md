# Mars Navigator

NASA Space Apps Challenge 2026 · **Interplanetary Survival Guide: Martian Map**
Team: Maheen, Ayesha, Hafse, Maya, Arbish

Mars Navigator is a web map where an astronaut picks a start and an end point on Mars and gets the safest walking route. The route panel shows distance, elevation profile, slope risk, walking time and an oxygen budget. Hazards and survival-relevant points of interest (water ice, landing sites, past rovers) are layers on the same map.

> Concept only. Not flight-certified. Not approved by NASA or any space agency for operational use.

---

## Demo flow (build this first)

1. Open the map on the study area (default: Jezero Crater).
2. Toggle layers: terrain, slope hazards, points of interest, subsurface ice.
3. Click a start point, then an end point.
4. The app draws the safest route and fills the route panel.
5. Click any point of interest to see why it matters for survival.

If a task does not help this flow, it waits until the flow works end to end.

---

## Quick start

```bash
git clone <repo-url> martian-navigator
cd martian-navigator
npm install
npm run dev        # http://localhost:5173
npm test           # routing tests
npm run build      # production build in dist/
```

Everyone works on a branch named after their folder, for example `ayesha/map`. Open a pull request into `main`. Pull `main` before you start each work block. Never edit a file owned by someone else without telling them.

---

## Who owns what

Each person owns the files listed under their name. If you need a change in someone else's file, ask them or open a small pull request and tag them.

### Maheen — team lead and routing engine

Folder: `src/routing/`

| File | What to do |
| --- | --- |
| `src/routing/costGrid.js` | Load `data/elevation_grid.json`. Compute slope in degrees per cell. Turn slope and hazard polygons into a cost per cell (steeper = costlier, above `MAX_SAFE_SLOPE_DEG` = blocked). |
| `src/routing/astar.js` | A* search over the cost grid. Eight-direction movement. Return the cell path or `null` if no route exists. |
| `src/routing/findRoute.js` | Public function the map calls. Converts lat/lon to cells, runs A*, converts back, and builds the result object (see the contract in ARCHITECTURE.md). |
| `src/routing/terrainScore.js` | **Optional, only after the demo flow works.** Small classifier that scores each cell as safe, risky or avoid and feeds `costGrid.js`. If it is not ready by Sun 1 PM, delete the import and ship slope-only routing. |
| `tests/routing.test.js` | Co-owned with Arbish. Test a flat grid, a grid with a wall, and a start that is inside a blocked cell. |

Also: read the official challenge Details tab at kickoff and keep the scope honest.

### Ayesha — frontend and map

Folder: `src/map/` and `src/App.jsx`

| File | What to do |
| --- | --- |
| `src/App.jsx` | Page layout: map on the left, route panel (Maya) on the right, layer toggles on top. |
| `src/map/MapView.jsx` | Leaflet or MapLibre map. Load Mars base tiles from `src/config.js`. Handle click to set start, then click to set end. |
| `src/map/layers.js` | Layer definitions and toggle logic: terrain, hazards, points of interest, ice. |
| `src/map/PoiLayer.jsx` | Draw points of interest from `data/poi.geojson` with icons and a popup showing `description` and `survivalNote`. |
| `src/map/HazardLayer.jsx` | Draw `data/hazards.geojson` polygons, coloured by `type`. |
| `src/map/RouteLayer.jsx` | Draw the route returned by `findRoute`, mark start and end, and highlight any hazards crossed. |

### Hafse — data

Folder: `data/`

| File | What to do |
| --- | --- |
| `data/elevation_grid.json` | Elevation for the study area from NASA Mars Trek or another open NASA/USGS source, downsampled to about 200 x 200 cells. Format is in ARCHITECTURE.md. |
| `data/poi.geojson` | 15 to 20 points of interest with `name`, `type`, `description`, `survivalNote`, `source`. |
| `data/hazards.geojson` | Polygons for steep slopes, dunes and rough terrain, with `type` and `maxSlopeDeg`. |
| `data/ice.geojson` | Subsurface ice layer, or a link to the tile layer if it is served as tiles. |
| `data/sources.md` | Every dataset: name, URL, date accessed, licence or credit line. Needed for the submission. |
| `src/config.js` (tile section only) | Confirm the working Mars Trek tile URLs and write them into the `TILE_LAYERS` object. Check them in a browser before you commit. |

### Maya — UI, UX and visuals

Folder: `src/components/` and `src/styles/`

| File | What to do |
| --- | --- |
| `src/styles/theme.css` | Colours, fonts, spacing. Dark theme that reads clearly over the map. |
| `src/components/RoutePanel.jsx` | Shows distance, walking time, max slope, risk score, oxygen used. Empty state tells the user to click a start point. |
| `src/components/ElevationChart.jsx` | Line chart of elevation along the route. Hovering a point highlights it on the map. |
| `src/components/Legend.jsx` | Legend for hazard colours and point-of-interest icons. |
| `src/components/LayerToggles.jsx` | The toggle buttons that Ayesha's `layers.js` controls. |
| `docs/DEMO_SCRIPT.md` | Three-minute spoken script that matches the demo flow, with one line per screen. |
| `assets/` | Logo and icons. |

Also: record the demo video together with Arbish on Sunday afternoon.

### Arbish — integration, testing and submission

Folder: `src/state/`, `src/api/`, `tests/`, `docs/`

| File | What to do |
| --- | --- |
| `src/state/store.js` | Shared app state: `start`, `end`, `route`, `visibleLayers`, `selectedPoi`. Everyone reads and writes through this, not through props across folders. |
| `src/api/dataLoader.js` | Loads the files in `data/` once at startup and exposes them to the map and the router. |
| `src/integration.js` | Watches `start` and `end` in the store, calls `findRoute`, writes the result to `route`. |
| `tests/demoFlow.test.js` | Automated check of the five-step demo flow. |
| `docs/SUBMISSION_CHECKLIST.md` | The final checklist; tick items as they are done. |
| Deployment | Set up Vercel or GitHub Pages on Saturday evening, not Sunday afternoon. |
| Project description | Draft early, finish on Sunday. Must name the challenge, the data used and what is original. |

---

## Timeline

| When | Goal |
| --- | --- |
| Sat 5-6 PM | Kickoff call. Read the Details tab, agree scope, create repo, agree on the two interfaces in ARCHITECTURE.md. |
| Sat 6-11 PM | Everyone builds their own files in parallel. |
| Sat 11 PM | Five-minute demo checkpoint, then sleep. |
| Sun 9 AM-1 PM | Integration. Route draws on the map. Panel and chart show real values. |
| Sun 1 PM | **Feature freeze.** Bug fixes only. |
| Sun 1-5 PM | Polish, deploy, demo video, project description. |
| Sun 5-6 PM | Submit. Leave the rest as buffer. |

Submission deadline per a third-party source is Sun Nov 15, 11:59 PM local time. Confirm on the official Space Apps site.

---

## Rules

- Build the demo path first. One complete flow beats ten half-finished features.
- Stuck for 30 minutes? Ask for help.
- Commit small and often. Pull before you start.
- Do not copy code from other teams' public repositories. Your own routing logic and design are what is judged.
- Be honest about data. If a layer uses sample or simulated values, say so in the app and in the description.

---

## Credits

Mars imagery, elevation and ice data: NASA and partner space agencies, via Mars Trek and other open sources. Full list in `data/sources.md`."# Martian-map" 
"# Martian map" 
