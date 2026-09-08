# Trail Pocket PWA v4.0.0-beta.7

Trail Pocket is an offline-first hiking PWA designed for iPhone and modern browsers, with a strong focus on reliable South Australia hiking maps.

> **Current status:** v4 is still beta. Do not treat it as a finished safety-critical navigation app until flight-mode restart, interrupted-download recovery, GPS recording and long-distance real-device tests have passed.

## v4.0.0-beta.7

The current `main` branch has moved from the v3 raster/Overpass-focused architecture to the new v4 vector/offline-package architecture.

### Map engine

- MapLibre GL JS vector-map engine.
- OpenFreeMap for online vector browsing.
- Outdoor-oriented map styling inspired by the clarity of Organic Maps.
- GPX/KML route overlays and GPS/activity display remain part of the app.

### Large offline maps

- PMTiles is the primary v4 offline map format.
- Large package files are stored in OPFS where supported.
- IndexedDB stores package metadata, download state and app records.
- PMTiles can be read directly from local storage by the MapLibre map layer.

### Reliable downloads

- Resumable HTTP Range downloads.
- Download progress and pause/resume state.
- Storage/capacity checks before large downloads.
- SHA-256 integrity verification.
- Corrupted package detection and repair/re-download support.
- Download state is designed to survive interruption rather than silently marking incomplete data as installed.

## South Australia offline package system

Trail Pocket v4 divides South Australia into seven production regions:

1. Adelaide & Mount Lofty Ranges
2. Fleurieu Peninsula & Kangaroo Island
3. Yorke Peninsula & Mid North
4. Eyre Peninsula
5. Flinders Ranges & Far North
6. Murraylands & Riverland
7. Limestone Coast

The Offline Maps screen includes a **South Australia / Download All** workflow when a valid seven-region production index is available.

Each production region is designed to publish:

- `*-map.pmtiles` — vector map package
- `*-search.index` — offline place/POI search index
- `*-routing.graph` — offline walking/trail graph
- `*-manifest.json` — file metadata, sizes and SHA-256 hashes

A combined `sa-index.json` describes the complete downloadable catalog.

## South Australia build pipeline

GitHub Actions can build the South Australia packages from the current Geofabrik South Australia OSM extract.

Production builds:

- extract each configured region with `osmium`
- generate PMTiles with Planetiler
- create the offline search index
- create the walking/trail routing graph
- calculate file sizes and SHA-256 hashes
- publish package assets to the `maps-v4-current` release
- generate the combined seven-region `sa-index.json`

The workflow validates that all **7 production manifests** exist before publishing the final production index.

A smaller **Para Wirra** pilot package is retained for explicit smoke testing and development validation.

## Offline search and walking network

Installed v4 packages can provide:

- offline place and POI search
- offline trail/road search data
- walking graph data for routing experiments
- graph merging across overlapping installed regions

Routing is constrained by the downloaded walking graph. Trail Pocket must not invent a valid walking route where downloaded graph data does not support one.

## GPS and activity recording

Trail Pocket includes:

- current GPS position and accuracy
- activity recording
- distance tracking
- elevation data when iOS supplies usable altitude accuracy
- GPS quality filtering and jump rejection
- gap reporting when recording is interrupted
- route and breadcrumb display

### Important iPhone PWA limitation

iOS does not guarantee continuous background GPS for a Home Screen PWA. Screen lock, app switching or browser suspension can interrupt JavaScript and location updates. Trail Pocket records/report gaps rather than pretending missing GPS samples were continuous movement.

A future native iPhone version may be needed if guaranteed background tracking becomes a core requirement.

## GPX / KML and GeoPDF

Existing Trail Pocket functions include:

- import multiple GPX/KML routes
- preserve multi-segment tracks
- route storage and management
- GPX export
- official geospatial PDF import where supported geographic metadata is present
- offline GeoPDF display with GPS overlay

## Backup and migration

v4 introduces a newer backup/storage architecture while preserving the goal of safe migration from existing Trail Pocket data.

The design principles are:

- never silently overwrite a known-good offline package with an incomplete one
- validate new package data before marking it ready
- preserve existing routes and user records during schema upgrades
- retain a recovery path when migrating old data

## PWA deployment

GitHub Pages:

`https://appbuilderlee2.github.io/Trail-Pocket/`

The app is deployed as a static PWA through GitHub Actions.

On iPhone:

1. Open the GitHub Pages site in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Open Trail Pocket from the Home Screen.
5. Download the required offline region(s) before leaving coverage.
6. Test the exact downloaded map in Airplane Mode before relying on it outdoors.

Do not open `index.html` directly from the Files app; Service Worker, modules, OPFS/IndexedDB and PWA behaviour require a proper HTTPS origin.

## Required beta validation before v4.0 stable

Before promoting v4 to a stable release, the following still require real end-to-end validation:

- all seven South Australia production packages available from the production catalog
- Download All behaviour
- pause/resume after a network interruption
- insufficient-storage handling
- SHA-256 corruption detection and repair
- cold restart in Airplane Mode
- PMTiles reopening from OPFS after app restart
- offline search with no network
- walking graph across regional boundaries
- real iPhone GPS recording
- screen-lock/app-switch gap behaviour
- long-distance outdoor comparison walk

## Development

Node.js 20 or later:

```bash
npm install
npm test
```

For local static testing:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. Production PWA behaviour on iPhone still requires HTTPS.

When changing public app resources, keep the visible version and the Service Worker cache version synchronized so installed PWAs can receive the update correctly.

## Data and attribution

- Online vector-map rendering uses OpenFreeMap/OpenStreetMap-derived data according to the applicable provider terms and attribution requirements.
- Offline South Australia packages are generated from OpenStreetMap data. © OpenStreetMap contributors, ODbL 1.0.
- Weather features use Open-Meteo where enabled.
- Existing elevation/terrain features may use Mapzen Terrain Tiles / AWS Open Data and their underlying attribution requirements.

Trail Pocket is a hiking aid, not an authoritative source for closures, hazards or emergency navigation. Current park alerts, official signage and emergency advice take priority.

## Version history

The Git history contains the detailed v2.x/v3.x development record, including GeoPDF, offline Overpass maps, contours, activity recording, GPS reliability, map-first mobile UI and earlier offline-download architecture.

Current application version: **v4.0.0-beta.7**.
