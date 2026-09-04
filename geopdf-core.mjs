import { validCoordinate } from "./core.mjs";

function solve(matrix, values) {
  const n = values.length,
    a = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10)
      throw Error("GeoPDF 地理控制點不足或重疊。");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= d;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}
function leastSquares(rows, values, n) {
  const normal = Array.from({ length: n }, () => Array(n).fill(0)),
    rhs = Array(n).fill(0);
  for (let r = 0; r < rows.length; r++)
    for (let i = 0; i < n; i++) {
      rhs[i] += rows[r][i] * values[r];
      for (let j = 0; j < n; j++) normal[i][j] += rows[r][i] * rows[r][j];
    }
  return solve(normal, rhs);
}
export function selectPrimaryViewport(items = []) {
  const valid = items.filter(
    (v) =>
      Array.isArray(v.bbox) &&
      v.bbox.length === 4 &&
      Array.isArray(v.gpts) &&
      v.gpts.length >= 8 &&
      v.gpts.length === v.lpts?.length &&
      v.gpts.length % 2 === 0,
  );
  if (!valid.length) throw Error("呢份 PDF 冇可讀取嘅 GeoPDF 地理定位。");
  return valid.sort(
    (a, b) =>
      Math.abs((b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])) -
      Math.abs((a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1])),
  )[0];
}
export function createGeoTransform({
  bbox,
  gpts,
  lpts,
  pageWidth,
  pageHeight,
}) {
  if (
    !Number.isFinite(pageWidth) ||
    !Number.isFinite(pageHeight) ||
    pageWidth <= 0 ||
    pageHeight <= 0
  )
    throw Error("GeoPDF 頁面尺寸無效。");
  const points = [];
  for (let i = 0; i < gpts.length; i += 2) {
    const geo = [gpts[i + 1], gpts[i]],
      u = lpts[i],
      v = lpts[i + 1],
      pdfX = bbox[0] + (bbox[2] - bbox[0]) * u,
      pdfY = bbox[1] + (bbox[3] - bbox[1]) * v;
    if (!validCoordinate(geo) || ![u, v, pdfX, pdfY].every(Number.isFinite))
      throw Error("GeoPDF 控制點無效。");
    points.push({ geo, page: [pdfX / pageWidth, 1 - pdfY / pageHeight] });
  }
  if (points.length < 4) throw Error("GeoPDF 至少需要 4 個地理控制點。");
  const center = [
      points.reduce((n, p) => n + p.geo[0], 0) / points.length,
      points.reduce((n, p) => n + p.geo[1], 0) / points.length,
    ],
    spread = [
      Math.max(...points.map((p) => Math.abs(p.geo[0] - center[0]))),
      Math.max(...points.map((p) => Math.abs(p.geo[1] - center[1]))),
    ];
  if (spread.some((v) => v < 1e-9)) throw Error("GeoPDF 控制點範圍無效。");
  const rows = [],
    values = [];
  for (const p of points) {
    const x = (p.geo[0] - center[0]) / spread[0],
      y = (p.geo[1] - center[1]) / spread[1],
      u = p.page[0],
      v = p.page[1];
    rows.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y],
      [0, 0, 0, x, y, 1, -v * x, -v * y],
    );
    values.push(u, v);
  }
  const matrix = leastSquares(rows, values, 8),
    footprint = points.map((p) => p.geo),
    bounds = {
      west: Math.min(...footprint.map((p) => p[0])),
      east: Math.max(...footprint.map((p) => p[0])),
      south: Math.min(...footprint.map((p) => p[1])),
      north: Math.max(...footprint.map((p) => p[1])),
    };
  return { version: 1, center, spread, matrix, footprint, bounds };
}
export function geoToPage(transform, point) {
  if (!transform || !validCoordinate(point)) return null;
  const x = (point[0] - transform.center[0]) / transform.spread[0],
    y = (point[1] - transform.center[1]) / transform.spread[1],
    m = transform.matrix,
    d = m[6] * x + m[7] * y + 1;
  if (!Number.isFinite(d) || Math.abs(d) < 1e-10) return null;
  const p = [
    (m[0] * x + m[1] * y + m[2]) / d,
    (m[3] * x + m[4] * y + m[5]) / d,
  ];
  return p.every(Number.isFinite) ? p : null;
}
export function pointInFootprint(transform, point) {
  const polygon = transform?.footprint;
  if (!polygon?.length || !validCoordinate(point)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j],
      cross =
        a[1] > point[1] !== b[1] > point[1] &&
        point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (cross) inside = !inside;
  }
  return inside;
}
export function accuracyPixels(
  transform,
  point,
  metres,
  imageWidth,
  imageHeight,
) {
  if (!Number.isFinite(metres) || metres <= 0) return 0;
  const p = geoToPage(transform, point),
    lat = (point[1] * Math.PI) / 180,
    east = [
      point[0] + metres / (111320 * Math.max(0.05, Math.cos(lat))),
      point[1],
    ],
    north = [point[0], point[1] + metres / 110574],
    a = geoToPage(transform, east),
    b = geoToPage(transform, north);
  if (!p || !a || !b) return 0;
  return (
    (Math.hypot((a[0] - p[0]) * imageWidth, (a[1] - p[1]) * imageHeight) +
      Math.hypot((b[0] - p[0]) * imageWidth, (b[1] - p[1]) * imageHeight)) /
    2
  );
}
