export const OFFLINE_REGIONS = [
  { id: "para-wirra", name: "Para Wirra Conservation Park", places: "Devils Nose、South Para Grand Hike", bounds: { west: 138.78, south: -34.735, east: 138.91, north: -34.60 } },
  { id: "belair", name: "Belair National Park", places: "Waterfall Hike、Upper Waterfall", bounds: { west: 138.61, south: -35.04, east: 138.69, north: -34.975 } },
  { id: "morialta", name: "Morialta Conservation Park", places: "First Falls、Deep View Lookout", bounds: { west: 138.68, south: -35.005, east: 138.76, north: -34.88 } },
  { id: "alligator-gorge", name: "Alligator Gorge", places: "Ring Route、The Narrows", bounds: { west: 138.03, south: -32.82, east: 138.16, north: -32.66 } },
  { id: "cleland", name: "Cleland National Park", places: "Mount Lofty、Waterfall Gully", bounds: { west: 138.675, south: -35.035, east: 138.755, north: -34.93 } },
  { id: "onkaparinga", name: "Onkaparinga River National Park", places: "Punchbowl、Sundews Ridge", bounds: { west: 138.52, south: -35.19, east: 138.64, north: -35.115 } },
];

export function filterRegions(regions, query = "") {
  const key = String(query).trim().toLocaleLowerCase();
  if (!key) return regions;
  return regions.filter((r) => `${r.name} ${r.places}`.toLocaleLowerCase().includes(key));
}
