import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackup,
  validateBackup,
  backupCounts,
  BACKUP_FORMAT,
} from "../backup.mjs";
const sample = {
  routes: [{ id: "r1", name: "Route" }],
  maps: [{ id: "r1", data: { elements: [] }, contours: [] }],
  areas: [{ id: "a1", name: "Area" }],
  activities: [{ id: "x1", segments: [] }],
  settings: [
    { id: "keep-awake", value: true },
    { id: "active-activity", value: { secret: "draft" } },
  ],
  geopdfs: [{ id: "geopdf:1", imageData: "data:image/webp;base64,AA==" }],
};
test("backup round trip includes complete durable data but excludes active recording draft", () => {
  const backup = createBackup(sample, 0),
    restored = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.appVersion, "3.0.2");
  assert.equal(backup.created, "1970-01-01T00:00:00.000Z");
  assert.deepEqual(backupCounts(restored), {
    routes: 1,
    maps: 1,
    areas: 1,
    activities: 1,
    settings: 1,
    geopdfs: 1,
  });
  assert.equal(restored.data.settings[0].id, "keep-awake");
});
test("invalid backup type, version and record IDs are rejected", () => {
  assert.throws(() => validateBackup({}), /不是受支援/);
  assert.throws(
    () => validateBackup({ format: BACKUP_FORMAT, version: 2, data: sample }),
    /不是受支援/,
  );
  const bad = createBackup(sample);
  bad.data.routes = [{ id: "" }];
  assert.throws(() => validateBackup(bad), /無效記錄/);
});
