// Shared config. Hafsa owns TILE_LAYERS. Maheen owns ROUTING.

export const TILE_LAYERS = {
  // Hafsa: confirm each tile URL opens in a browser, then fill in. Shape:
  // base: {
  //   name: 'Mars imagery',
  //   url: '',                 // tile URL template
  //   attribution: 'NASA/JPL-Caltech',
  //   crs: 'EPSG4326',         // projection the tiles use. Check before using.
  //   dataType: 'optical',     // shown next to the layer toggle
  // },
};

// Routing defaults. These are demo assumptions, NOT mission data.
// Say so in the app and in the project description.
export const ROUTING = {
  maxSlopeDeg: 20, // steepest ground we allow, before the load factor
  loadFactor: 0.8, // 1 = no load; lower = suit and equipment limit slope and speed
  walkSpeedKmh: 3,
  o2LimitMinutes: 240,
  slopeWeight: 1, // how strongly steep ground raises cost; tune on real terrain
};
