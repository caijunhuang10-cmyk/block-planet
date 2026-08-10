import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCK_BREAK_SECONDS,
  getBlockBreakSeconds,
} from "../app/block-breaking.ts";

test("break times follow the material hardness", () => {
  assert.ok(BLOCK_BREAK_SECONDS.leaves < BLOCK_BREAK_SECONDS.dirt);
  assert.ok(BLOCK_BREAK_SECONDS.dirt < BLOCK_BREAK_SECONDS.wood);
  assert.ok(BLOCK_BREAK_SECONDS.wood < BLOCK_BREAK_SECONDS.stone);
  assert.ok(BLOCK_BREAK_SECONDS.stone < BLOCK_BREAK_SECONDS.rubyOre);
  assert.ok(BLOCK_BREAK_SECONDS.concrete > BLOCK_BREAK_SECONDS.wood);
  assert.equal(BLOCK_BREAK_SECONDS.water, Number.POSITIVE_INFINITY);
});

test("pickaxes speed up hard blocks without erasing hardness differences", () => {
  for (const tool of ["woodPickaxe", "stonePickaxe", "ironPickaxe"]) {
    assert.ok(
      getBlockBreakSeconds("stone", tool) <
        getBlockBreakSeconds("ironOre", tool),
    );
    assert.ok(
      getBlockBreakSeconds("ironOre", tool) <
        getBlockBreakSeconds("rubyOre", tool),
    );
  }

  assert.ok(
    getBlockBreakSeconds("stone", "ironPickaxe") <
      getBlockBreakSeconds("stone", "stonePickaxe"),
  );
  assert.ok(
    getBlockBreakSeconds("stone", "stonePickaxe") <
      getBlockBreakSeconds("stone", "woodPickaxe"),
  );
});

test("unrelated tools do not accelerate a block", () => {
  assert.equal(
    getBlockBreakSeconds("stone", "ironSword"),
    BLOCK_BREAK_SECONDS.stone,
  );
  assert.equal(
    getBlockBreakSeconds("wood", "ironPickaxe"),
    BLOCK_BREAK_SECONDS.wood,
  );
});
