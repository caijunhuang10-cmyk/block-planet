import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextWaterFlowCells,
  MAX_WATER_FLOW_LEVEL,
} from "../app/water-flow.ts";

test("water falls before spreading sideways", () => {
  const next = getNextWaterFlowCells(
    { x: 3, y: 8, z: 4, level: 2 },
    () => false,
    -20,
  );
  assert.deepEqual(next, [{ x: 3, y: 7, z: 4, level: 2 }]);
});

test("supported water spreads horizontally with increasing depth", () => {
  const occupied = new Set(["0,3,0", "1,4,0"]);
  const next = getNextWaterFlowCells(
    { x: 0, y: 4, z: 0, level: 1 },
    (x, y, z) => occupied.has(`${x},${y},${z}`),
    -20,
  );
  assert.equal(next.length, 3);
  assert.ok(next.every((cell) => cell.level === 2));
});

test("water stops at the configured horizontal range", () => {
  const next = getNextWaterFlowCells(
    { x: 0, y: 4, z: 0, level: MAX_WATER_FLOW_LEVEL },
    (_x, y) => y === 3,
    -20,
  );
  assert.deepEqual(next, []);
});
