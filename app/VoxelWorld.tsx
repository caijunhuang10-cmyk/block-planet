"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getBlockBreakSeconds } from "./block-breaking";
import { getNextWaterFlowCells } from "./water-flow";

export type BlockKind =
  | "grass"
  | "wheat"
  | "dirt"
  | "stone"
  | "wood"
  | "planks"
  | "sand"
  | "water"
  | "leaves"
  | "sapling"
  | "woolBlock"
  | "glass"          
  | "ironOre"
  | "rubyOre"
  | "coalOre"
  | "coal"
  | "torch"
  | "concrete"
  | "redConcrete"
  | "yellowConcrete"
  | "whiteConcrete"
  | "purpleConcrete"
  | "chest"
  | "bed";
export type ToolKind =
  | "hand"
  | "woodPickaxe"
  | "woodSword"
  | "stonePickaxe"
  | "stoneSword"
  | "ironPickaxe"
  | "ironSword";
export type PlayerWeaponKind = "pistol" | "rifle" | "shotgun";
export type WeaponAmmo = Record<PlayerWeaponKind, number>;
export type VillageChestLoot = Array<{
  kind: BlockKind | PlayerWeaponKind;
  amount: number;
}>;
type TerrainBlockKind = BlockKind | "bedrock";

export type WorldTime = "sunset" | "day" | "night";
export type Weather = "clear" | "rain";
export type WorldMapKind =
  | "dawn-valley"
  | "emerald-basin"
  | "crown-peaks"
  | "sunlit-oasis"
  | "random-world";
export const WORLD_MAP_PRESETS: ReadonlyArray<{
  id: WorldMapKind;
  name: string;
  tagline: string;
  description: string;
}> = [
  {
    id: "dawn-valley",
    name: "晨曦山谷",
    tagline: "均衡 · 经典",
    description: "河谷、森林、群山与沙丘均衡交错，适合完整体验所有玩法。",
  },
  {
    id: "emerald-basin",
    name: "翡翠环谷",
    tagline: "丰水 · 密林",
    description: "宽河与大湖环绕茂密林地，平缓盆地间仍有山脉和沙丘。",
  },
  {
    id: "crown-peaks",
    name: "云冠群峰",
    tagline: "高山 · 峡谷",
    description: "陡峭山脊主导天际线，河湖、森林、村庄与沙地散布谷底。",
  },
  {
    id: "sunlit-oasis",
    name: "金沙绿洲",
    tagline: "沙丘 · 绿洲",
    description: "广阔沙丘包围河流绿洲，同时保留森林、高山和完整资源带。",
  },
  {
    id: "random-world",
    name: "随机世界",
    tagline: "全新种子 · 每次不同",
    description: "随机重排地貌、洞穴、矿脉与植被，同时保留全部核心内容。",
  },
];
export type AnimalDropKind =
  | "wool"
  | "rawPork"
  | "leather"
  | "rawBeef"
  | "poppy"
  | "dandelion"
  | "oxeyeDaisy"
  | "allium"
  | "honeycomb"
  | "redDye"
  | "yellowDye"
  | "whiteDye"
  | "purpleDye"
  | "cookedPork"
  | "cookedBeef"
  | "bread";

type Position = { x: number; y: number; z: number };

type Props = {
  active: boolean;
  paused: boolean;
  selected: BlockKind;
  available: number;
  equippedTool: ToolKind;
  equippedWeapon: PlayerWeaponKind | null;
  strengthMultiplier: number;
  onWeaponFire: (weapon: PlayerWeaponKind) => boolean;
  onBeeFeed: () => boolean;
  canSprint: boolean;
  time: WorldTime;
  cycleProgress: number;
  worldVersion: number;
  worldMap: WorldMapKind;
  worldSeed: number;
  respawnPoint: { x: number; z: number };
  onReady: () => void;
  onPosition: (position: Position) => void;
  onMine: (kind: BlockKind, dropped: boolean) => void;
  onBlockPickup: (kind: BlockKind, amount: number) => void;
  onPlace: (kind: BlockKind) => void;
  onLoot: (kind: AnimalDropKind, amount: number) => void;
  onCombatDefeat: (kind: "animal" | "bandit" | "villager" | "bee") => void;
  onAnimalPopulation: (count: number) => void;
  onHungerUse: (amount: number) => void;
  onDamage: (
    amount: number,
    cause: "fall" | "fall-water" | "bee" | "bandit",
  ) => void;
  onToolUse: (tool: Exclude<ToolKind, "hand">) => void;
  onMessage: (message: string) => void;
  onLockChange: (locked: boolean) => void;
  onChestOpen: (villageLoot?: VillageChestLoot) => void;
  onWeatherChange: (weather: Weather) => void;
  onBedSleep: (bed: { x: number; z: number }) => boolean;
};

type BlockRecord = { x: number; y: number; z: number; kind: TerrainBlockKind };
type LootRecord = {
  id: string;
  kind: AnimalDropKind;
  amount: number;
  x: number;
  y: number;
  z: number;
};
type BlockDropRecord = {
  id: string;
  kind: BlockKind;
  x: number;
  y: number;
  z: number;
};

export const WORLD_SIZE = 350;
const WORLD_MIN = -Math.floor(WORLD_SIZE / 2);
const WORLD_MAX = WORLD_MIN + WORLD_SIZE - 1;
export const MAX_ANIMALS = 30;
export const SHOP_POSITIONS = [
  { x: WORLD_MAX - 12, z: WORLD_MIN + 12, label: "武器商店" },
  { x: WORLD_MIN + 14, z: WORLD_MIN + 14, label: "工具商店" },
  { x: WORLD_MIN + 14, z: WORLD_MAX - 14, label: "补给商店" },
  { x: WORLD_MAX - 14, z: WORLD_MAX - 14, label: "材料商店" },
] as const;
export const ROCK_LAYER_DEPTH = 20;
export const DAY_PHASE_SECONDS = 10 * 60;
const SAPLING_GROWTH_SECONDS = 55;
const MIN_SURFACE_HEIGHT = 2;
const WORLD_BOTTOM_Y = MIN_SURFACE_HEIGHT - ROCK_LAYER_DEPTH - 2;
const EYE_HEIGHT = 1.62;
// v1 可能包含旧版破坏逻辑写入的损坏坐标；升级版本后从干净地形开始。
const STORAGE_KEY = "block-planet-webgl-edits-v2";
const LEGACY_STORAGE_KEY = "block-planet-webgl-edits-v1";
const PLACEABLE = new Set<BlockKind>([
  "grass",
  "dirt",
  "stone",
  "wood",
  "planks",
  "sand",
  "water",
  "leaves",
  "sapling",
  "woolBlock",
  "glass",
  "ironOre",
  "rubyOre",
  "coalOre",
  "coal",
  "torch",
  "concrete",
  "redConcrete",
  "yellowConcrete",
  "whiteConcrete",
  "purpleConcrete",
  "chest",
  "bed",
]);
const PICKAXE_TIER: Partial<Record<ToolKind, number>> = {
  woodPickaxe: 1,
  stonePickaxe: 2,
  ironPickaxe: 3,
};
const SWORD_DAMAGE: Partial<Record<ToolKind, number>> = {
  woodSword: 2.5,
  stoneSword: 4,
  ironSword: 5.5,
};
const HAND_DAMAGE = 0.5;
const WEAPON_DAMAGE: Record<PlayerWeaponKind, number> = {
  pistol: 8,
  rifle: 12,
  shotgun: 17,
};
const WEAPON_RANGE: Record<PlayerWeaponKind, number> = {
  pistol: 60,
  rifle: 90,
  shotgun: 36,
};

const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
const BLOCK_NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
type TerrainBiome =
  "water" | "shore" | "plains" | "forest" | "highlands" | "rocky" | "dunes";
type TerrainProfile = {
  height: number;
  biome: TerrainBiome;
};
type TerrainPreset = {
  offsetX: number;
  offsetZ: number;
  riverShift: number;
  riverWidth: number;
  lakes: readonly [number, number, number][];
  heightBase: number;
  ridgeScale: number;
  moistureBias: number;
  drynessBias: number;
  forestThreshold: number;
  duneThreshold: number;
};

const TERRAIN_PRESETS: Record<Exclude<WorldMapKind, "random-world">, TerrainPreset> = {
  "dawn-valley": {
    offsetX: 0,
    offsetZ: 0,
    riverShift: -2.5,
    riverWidth: 1.7,
    lakes: [[-34, -20, 7.5], [36, 27, 6.5]],
    heightBase: 5.4,
    ridgeScale: 4.6,
    moistureBias: 0,
    drynessBias: 0,
    forestThreshold: 0.34,
    duneThreshold: 1.12,
  },
  "emerald-basin": {
    offsetX: 61,
    offsetZ: -43,
    riverShift: 18,
    riverWidth: 2.6,
    lakes: [[-55, 30, 11], [65, -35, 9.5]],
    heightBase: 5.1,
    ridgeScale: 3.7,
    moistureBias: 0.55,
    drynessBias: -0.12,
    forestThreshold: 0.08,
    duneThreshold: 1.42,
  },
  "crown-peaks": {
    offsetX: -77,
    offsetZ: 52,
    riverShift: -18,
    riverWidth: 1.8,
    lakes: [[-60, -48, 8], [56, 52, 8.5]],
    heightBase: 6.1,
    ridgeScale: 6.4,
    moistureBias: 0.1,
    drynessBias: 0.05,
    forestThreshold: 0.22,
    duneThreshold: 1.25,
  },
  "sunlit-oasis": {
    offsetX: 113,
    offsetZ: 79,
    riverShift: 4,
    riverWidth: 2,
    lakes: [[-42, 45, 12], [58, -45, 10]],
    heightBase: 5.2,
    ridgeScale: 4.9,
    moistureBias: -0.25,
    drynessBias: 0.55,
    forestThreshold: 0.45,
    duneThreshold: 0.72,
  },
};

function parseBlockKey(key: string) {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}

function baseTerrainHash(x: number, z: number, seed = 0) {
  let value = Math.imul(x + seed * 17, 374761393);
  value = (value ^ Math.imul(z - seed * 31, 668265263)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function randomTerrainPreset(worldSeed: number): TerrainPreset {
  const sample = (salt: number) => baseTerrainHash(worldSeed, salt, salt + 701);
  return {
    offsetX: Math.floor(sample(11) * 301) - 150,
    offsetZ: Math.floor(sample(17) * 301) - 150,
    riverShift: Math.floor(sample(23) * 51) - 25,
    riverWidth: 1.7 + sample(29),
    lakes: [
      [
        -70 + Math.floor(sample(31) * 45),
        -60 + Math.floor(sample(37) * 120),
        7.5 + sample(41) * 4.5,
      ],
      [
        30 + Math.floor(sample(43) * 45),
        -60 + Math.floor(sample(47) * 120),
        7 + sample(53) * 4.5,
      ],
    ],
    heightBase: 5.15 + sample(59) * 0.75,
    ridgeScale: 4.2 + sample(61) * 1.6,
    moistureBias: -0.15 + sample(67) * 0.5,
    drynessBias: -0.1 + sample(71) * 0.45,
    forestThreshold: 0.2 + sample(73) * 0.25,
    duneThreshold: 0.9 + sample(79) * 0.4,
  };
}

function terrainProfileForMap(
  x: number,
  z: number,
  worldMap: WorldMapKind,
  worldSeed: number,
): TerrainProfile {
  const preset =
    worldMap === "random-world"
      ? randomTerrainPreset(worldSeed)
      : TERRAIN_PRESETS[worldMap];
  const tx = x + preset.offsetX;
  const tz = z + preset.offsetZ;
  const riverCenter =
    preset.riverShift + Math.sin(tz * 0.075) * 3.4 + Math.sin(tz * 0.19);
  const riverEdge = Math.abs(x - riverCenter) - preset.riverWidth;
  const waterEdgeRaw = Math.min(
    riverEdge,
    ...preset.lakes.map(([lakeX, lakeZ, radius]) =>
      Math.hypot(x - lakeX, z - lakeZ) - radius,
    ),
  );
  // Every preset keeps the shared spawn clearing dry and immediately playable.
  const waterEdge =
    Math.hypot(x - 5, z - 17) < 8 ? Math.max(waterEdgeRaw, 3.2) : waterEdgeRaw;

  const broadShape =
    Math.sin(tx * 0.052) +
    Math.cos(tz * 0.047) +
    Math.sin((tx - tz) * 0.033) * 0.72;
  const rolling =
    Math.sin(tx * 0.27) * 0.78 +
    Math.cos(tz * 0.23) * 0.68 +
    Math.sin((tx + tz) * 0.145) * 0.54;
  const ridgeSignal =
    Math.sin(tx * 0.081 + Math.cos(tz * 0.035) * 1.6) +
    Math.cos(tz * 0.071 - tx * 0.018);
  const ridge = Math.max(0, ridgeSignal - 0.62) * preset.ridgeScale;
  const dryness =
    Math.sin(tx * 0.043 + tz * 0.027) +
    Math.cos(tz * 0.058 - tx * 0.019) +
    preset.drynessBias;
  const moisture =
    Math.sin(tx * 0.072 - tz * 0.051) +
    Math.cos((tx + tz) * 0.039) +
    Math.sin(tz * 0.16) * 0.36 +
    preset.moistureBias;

  let height = Math.floor(preset.heightBase + broadShape * 1.32 + rolling + ridge);
  if (dryness > preset.duneThreshold - 0.07 && height < 9)
    height += Math.floor((Math.sin(tx * 0.42 + tz * 0.3) + 1) * 0.75);
  height = THREE.MathUtils.clamp(height, MIN_SURFACE_HEIGHT + 1, 17);

  if (waterEdge < 0) return { height: MIN_SURFACE_HEIGHT, biome: "water" };
  if (waterEdge < 2.4) {
    const bankHeight = MIN_SURFACE_HEIGHT + 1 + Math.floor(waterEdge * 0.85);
    return { height: Math.min(height, bankHeight), biome: "shore" };
  }
  if (ridge > 3.8 || height >= 13) return { height, biome: "rocky" };
  if (height >= 9) return { height, biome: "highlands" };
  if (dryness > preset.duneThreshold) return { height, biome: "dunes" };
  if (moisture > preset.forestThreshold) return { height, biome: "forest" };
  return { height, biome: "plains" };
}

function makePixelTexture(
  renderer: THREE.WebGLRenderer,
  base: string,
  flecks: string[],
  seed: number,
  topBand?: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.fillStyle = base;
  context.fillRect(0, 0, 16, 16);
  if (topBand) {
    context.fillStyle = topBand;
    context.fillRect(0, 0, 16, 5);
  }
  let value = seed >>> 0;
  for (let index = 0; index < 62; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const x = value % 16;
    value = (value * 1664525 + 1013904223) >>> 0;
    const y = value % 16;
    context.fillStyle = flecks[value % flecks.length];
    context.globalAlpha = 0.34 + ((value >> 8) % 52) / 100;
    context.fillRect(x, y, 1 + (value % 2), 1 + ((value >> 3) % 2));
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeConcreteTexture(
  renderer: THREE.WebGLRenderer,
  base: string,
  aggregate: string,
  highlight: string,
  shadow: string,
  seed: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.fillStyle = base;
  context.fillRect(0, 0, 16, 16);

  // Concrete reads as a compact, matte cast surface: sparse aggregate and
  // tiny pores instead of the broader, organic flecks used by terrain.
  let value = seed >>> 0;
  for (let index = 0; index < 34; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const x = value % 16;
    value = (value * 1664525 + 1013904223) >>> 0;
    const y = value % 16;
    context.fillStyle = index % 5 === 0 ? shadow : aggregate;
    context.fillRect(x, y, 1, 1);
  }
  context.fillStyle = highlight;
  [[2, 3], [8, 2], [12, 6], [4, 11], [10, 13]].forEach(([x, y]) =>
    context.fillRect(x, y, 1, 1),
  );
  context.fillStyle = shadow;
  [[1, 7], [6, 5], [11, 10], [14, 3]].forEach(([x, y]) => {
    context.fillRect(x, y, 1, 1);
    context.fillRect(x + 1, y, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeVillagerFabricTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#2f6870";
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = "#43848a";
  for (let x = 1; x < 16; x += 4) context.fillRect(x, 0, 1, 16);
  context.fillStyle = "#245057";
  for (let y = 2; y < 16; y += 4) context.fillRect(0, y, 16, 1);
  context.fillStyle = "#c89b4d";
  context.fillRect(0, 11, 16, 2);
  context.fillStyle = "#e1be68";
  context.fillRect(0, 11, 16, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeVillagerSkinTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#c98965";
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = "#e3ad82";
  context.fillRect(2, 2, 12, 5);
  context.fillStyle = "#a96850";
  [[2, 9], [5, 12], [10, 10], [13, 6]].forEach(([x, y]) =>
    context.fillRect(x, y, 1, 1),
  );
  context.fillStyle = "#f1c09b";
  [[3, 4], [11, 3], [8, 6]].forEach(([x, y]) =>
    context.fillRect(x, y, 1, 1),
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeOreTexture(
  renderer: THREE.WebGLRenderer,
  vein: string,
  highlight: string,
  shadow: string,
  seed: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;

  context.fillStyle = "#737873";
  context.fillRect(0, 0, 16, 16);
  const stoneFlecks = ["#91958e", "#565c57", "#686d68"];
  let value = seed >>> 0;
  for (let index = 0; index < 42; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const x = value % 16;
    value = (value * 1664525 + 1013904223) >>> 0;
    const y = value % 16;
    context.fillStyle = stoneFlecks[value % stoneFlecks.length];
    context.fillRect(x, y, 1, 1);
  }

  const clusters = [
    [2, 2, 3, 3],
    [9, 1, 4, 4],
    [5, 8, 5, 4],
    [12, 10, 3, 4],
    [1, 12, 3, 2],
  ];
  clusters.forEach(([x, y, width, height], index) => {
    context.fillStyle = shadow;
    context.fillRect(x - 1, y, width + 1, height + 1);
    context.fillStyle = vein;
    context.fillRect(x, y, width, height);
    context.fillStyle = highlight;
    context.fillRect(x, y, Math.max(1, width - 1), 1);
    context.fillRect(x, y, 1, Math.max(1, height - (index % 2)));
    if (width > 3 && height > 3) {
      context.fillStyle = shadow;
      context.fillRect(x + width - 1, y + height - 1, 1, 1);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makePlankTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#bd7f3f";
  context.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y += 4) {
    context.fillStyle = "#6b3f20";
    context.fillRect(0, y, 16, 1);
    context.fillStyle = "#d49a55";
    context.fillRect(0, y + 1, 16, 1);
    const seam = y % 8 === 0 ? 5 : 11;
    context.fillStyle = "#754622";
    context.fillRect(seam, y, 1, 4);
  }
  const grain = [
    [2, 2],
    [8, 2],
    [13, 3],
    [1, 6],
    [7, 7],
    [14, 6],
    [3, 10],
    [9, 9],
    [12, 11],
    [2, 14],
    [7, 14],
    [14, 13],
  ];
  context.fillStyle = "#945c2c";
  grain.forEach(([x, y]) => context.fillRect(x, y, 2, 1));

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeChestTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;

  // Deliberately graphic, pixel-art chest face: individual boards, iron bands,
  // reinforced corners and a gold lock remain readable from a few blocks away.
  context.fillStyle = "#6b3b1c";
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = "#be7838";
  context.fillRect(1, 1, 14, 14);
  for (let y = 2; y < 15; y += 4) {
    context.fillStyle = "#7b421e";
    context.fillRect(1, y, 14, 1);
    context.fillStyle = "#df9a4e";
    context.fillRect(2, y + 1, 12, 1);
  }
  context.fillStyle = "#8f5127";
  [
    [3, 1, 4], [9, 2, 3], [5, 5, 4], [11, 6, 2],
    [2, 9, 3], [8, 10, 4], [4, 13, 2], [11, 14, 2],
  ].forEach(([x, y, width]) => context.fillRect(x, y, width, 1));

  context.fillStyle = "#363438";
  context.fillRect(2, 1, 2, 14);
  context.fillRect(12, 1, 2, 14);
  context.fillStyle = "#76828a";
  context.fillRect(3, 1, 1, 14);
  context.fillRect(12, 1, 1, 14);
  context.fillStyle = "#292528";
  context.fillRect(1, 1, 14, 1);
  context.fillRect(1, 14, 14, 1);
  context.fillStyle = "#d0a54f";
  context.fillRect(6, 7, 4, 4);
  context.fillStyle = "#f0d27a";
  context.fillRect(7, 7, 2, 1);
  context.fillStyle = "#4c3820";
  context.fillRect(7, 9, 2, 2);
  context.fillRect(6, 10, 4, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeLogSideTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;

  context.fillStyle = "#68411f";
  context.fillRect(0, 0, 16, 16);

  const barkBands: Array<[number, number, string]> = [
    [0, 2, "#3d2818"],
    [2, 2, "#85562b"],
    [4, 1, "#51331b"],
    [5, 3, "#765029"],
    [8, 2, "#4a2e18"],
    [10, 2, "#956331"],
    [12, 1, "#5b371c"],
    [13, 3, "#744a24"],
  ];
  barkBands.forEach(([x, width, color]) => {
    context.fillStyle = color;
    context.fillRect(x, 0, width, 16);
  });

  const darkGrooves: Array<[number, number, number]> = [
    [1, 1, 5],
    [1, 9, 6],
    [4, 4, 7],
    [7, 0, 4],
    [7, 11, 5],
    [9, 5, 4],
    [12, 1, 5],
    [12, 10, 6],
    [15, 5, 7],
  ];
  context.fillStyle = "#2e1d12";
  darkGrooves.forEach(([x, y, height]) => context.fillRect(x, y, 1, height));

  const highlights: Array<[number, number, number]> = [
    [3, 0, 4],
    [3, 9, 5],
    [6, 5, 4],
    [10, 0, 3],
    [11, 11, 4],
    [14, 2, 5],
  ];
  context.fillStyle = "#aa7138";
  highlights.forEach(([x, y, height]) => context.fillRect(x, y, 1, height));

  // A small knot keeps the bark recognizable even when the block is viewed nearby.
  context.fillStyle = "#2c1b10";
  context.fillRect(9, 7, 4, 3);
  context.fillStyle = "#bf8141";
  context.fillRect(10, 7, 2, 1);
  context.fillStyle = "#70451f";
  context.fillRect(10, 8, 2, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeLogTopTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;

  // Dark, uneven bark surrounds the freshly cut golden wood.
  context.fillStyle = "#432916";
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = "#65401f";
  context.fillRect(1, 1, 14, 14);
  context.fillStyle = "#b87c3c";
  context.fillRect(2, 2, 12, 12);
  context.fillStyle = "#d5a35b";
  context.fillRect(3, 3, 10, 10);

  // Pixelated growth rings and their irregular breaks.
  context.strokeStyle = "#9d642f";
  context.lineWidth = 1;
  context.strokeRect(3.5, 3.5, 8, 8);
  context.strokeStyle = "#bd8240";
  context.strokeRect(5.5, 5.5, 4, 4);
  context.fillStyle = "#e2b86e";
  context.fillRect(6, 6, 4, 4);
  context.fillStyle = "#7b4a23";
  context.fillRect(7, 7, 2, 2);

  context.fillStyle = "#e3b66a";
  context.fillRect(4, 3, 3, 1);
  context.fillRect(10, 5, 2, 1);
  context.fillRect(4, 11, 3, 1);
  context.fillStyle = "#8d5728";
  context.fillRect(3, 8, 2, 1);
  context.fillRect(9, 11, 3, 1);

  // Short radial cracks sell the cut-log surface without smoothing the pixels.
  context.fillStyle = "#69401f";
  context.fillRect(8, 3, 1, 4);
  context.fillRect(9, 4, 1, 1);
  context.fillRect(9, 9, 1, 3);
  context.fillRect(10, 11, 2, 1);
  context.fillRect(4, 9, 3, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export default function VoxelWorld({
  active,
  paused,
  selected,
  available,
  equippedTool,
  equippedWeapon,
  strengthMultiplier,
  onWeaponFire,
  onBeeFeed,
  canSprint,
  time,
  cycleProgress,
  worldVersion,
  worldMap,
  worldSeed,
  respawnPoint,
  onReady,
  onPosition,
  onMine,
  onBlockPickup,
  onPlace,
  onLoot,
  onCombatDefeat,
  onAnimalPopulation,
  onHungerUse,
  onDamage,
  onToolUse,
  onMessage,
  onLockChange,
  onChestOpen,
  onWeatherChange,
  onBedSleep,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const pausedRef = useRef(paused);
  const selectedRef = useRef(selected);
  const availableRef = useRef(available);
  const equippedToolRef = useRef(equippedTool);
  const equippedWeaponRef = useRef<PlayerWeaponKind | null>(equippedWeapon);
  const strengthMultiplierRef = useRef(strengthMultiplier);
  const canSprintRef = useRef(canSprint);
  const timeRef = useRef(time);
  const cycleProgressRef = useRef(cycleProgress);
  const respawnPointRef = useRef(respawnPoint);
  const callbacksRef = useRef({
    onReady,
    onPosition,
    onMine,
    onBlockPickup,
    onPlace,
    onLoot,
    onCombatDefeat,
    onAnimalPopulation,
    onHungerUse,
    onDamage,
    onToolUse,
    onWeaponFire,
    onBeeFeed,
    onMessage,
    onLockChange,
    onChestOpen,
    onWeatherChange,
    onBedSleep,
  });

  useEffect(() => {
    activeRef.current = active;
    pausedRef.current = paused;
    selectedRef.current = selected;
    availableRef.current = available;
    equippedToolRef.current = equippedTool;
    equippedWeaponRef.current = equippedWeapon;
    strengthMultiplierRef.current = strengthMultiplier;
    canSprintRef.current = canSprint;
    timeRef.current = time;
    cycleProgressRef.current = cycleProgress;
    callbacksRef.current = {
      onReady,
      onPosition,
      onMine,
      onBlockPickup,
      onPlace,
      onLoot,
      onCombatDefeat,
      onAnimalPopulation,
      onHungerUse,
      onDamage,
      onToolUse,
      onWeaponFire,
      onBeeFeed,
      onMessage,
      onLockChange,
      onChestOpen,
      onWeatherChange,
      onBedSleep,
    };
  }, [
    active,
    available,
    equippedTool,
    equippedWeapon,
    strengthMultiplier,
    canSprint,
    cycleProgress,
    onLockChange,
    onChestOpen,
    onWeatherChange,
    onBedSleep,
    onMessage,
    onMine,
    onBlockPickup,
    onPlace,
    onLoot,
    onCombatDefeat,
    onAnimalPopulation,
    onHungerUse,
    onDamage,
    onToolUse,
    onWeaponFire,
    onBeeFeed,
    onPosition,
    onReady,
    paused,
    selected,
    time,
  ]);

  useEffect(() => {
    respawnPointRef.current = respawnPoint;
  }, [respawnPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const terrainProfile = (x: number, z: number) =>
      terrainProfileForMap(x, z, worldMap, worldSeed);
    const terrainHeight = (x: number, z: number) =>
      terrainProfile(x, z).height;
    const terrainHash = (x: number, z: number, seed = 0) =>
      worldMap === "random-world"
        ? baseTerrainHash(
            x + (worldSeed % 997) - 498,
            z - (worldSeed % 991) + 495,
            seed + (worldSeed % 8191),
          )
        : baseTerrainHash(x, z, seed);
    const saveStorageKey =
      worldMap === "dawn-valley"
        ? STORAGE_KEY
        : worldMap === "random-world"
          ? `${STORAGE_KEY}-${worldMap}-${worldSeed}`
          : `${STORAGE_KEY}-${worldMap}`;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    // Retina screens can otherwise render well over twice as many pixels as
    // the CSS viewport. A modest cap keeps the image crisp without making the
    // GPU shade millions of unnecessary pixels every frame.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.autoClear = false;

    type SoundKind =
      | "gun"
      | "melee"
      | "break"
      | "place"
      | "pickup"
      | "hurt"
      | "bee"
      | "sheep"
      | "pig"
      | "cow"
      | "animalDeath";
    let audioContext: AudioContext | null = null;
    const playSound = (kind: SoundKind) => {
      if (!audioContext) audioContext = new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();
      const profile: Record<SoundKind, [OscillatorType, number, number, number, number]> = {
        gun: ["sawtooth", 150, 48, 0.12, 0.16],
        melee: ["triangle", 210, 85, 0.07, 0.09],
        break: ["square", 125, 58, 0.045, 0.075],
        place: ["triangle", 155, 115, 0.035, 0.07],
        pickup: ["sine", 620, 980, 0.045, 0.11],
        hurt: ["sawtooth", 130, 72, 0.07, 0.14],
        bee: ["sine", 250, 335, 0.035, 0.12],
        sheep: ["sine", 660, 510, 0.045, 0.2],
        pig: ["square", 190, 125, 0.035, 0.15],
        cow: ["sine", 145, 92, 0.05, 0.34],
        animalDeath: ["triangle", 240, 72, 0.045, 0.19],
      };
      const [wave, startFrequency, endFrequency, volume, duration] = profile[kind];
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(startFrequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
      gain.gain.setValueAtTime(volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    };

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd69a72, 34, 92);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 180);
    camera.rotation.order = "YXZ";
    // Render the weapon in its own scene after the world. This is a real 3D
    // view-model pass, so it keeps perspective, lighting and recoil while
    // never being hidden behind nearby blocks or the HUD.
    const weaponScene = new THREE.Scene();
    const weaponCamera = new THREE.PerspectiveCamera(62, 1, 0.04, 10);
    weaponScene.add(new THREE.HemisphereLight(0xeaf5ff, 0x5b331f, 2.4));
    const weaponKeyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    weaponKeyLight.position.set(-2, 4, 3);
    weaponScene.add(weaponKeyLight);

    const rainCount = 180;
    const rainDrops = Array.from({ length: rainCount }, () => ({
      x: 0,
      y: 0,
      z: 0,
      speed: 18 + Math.random() * 12,
    }));
    const rainPositions = new Float32Array(rainCount * 6);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rainPositions, 3),
    );
    const rainMaterial = new THREE.LineBasicMaterial({
      color: 0xa9d7ee,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
    rain.visible = false;
    rain.frustumCulled = false;
    scene.add(rain);
    const resetRainDrop = (drop: (typeof rainDrops)[number], index: number) => {
      drop.x = camera.position.x - 22 + Math.random() * 44;
      drop.z = camera.position.z - 22 + Math.random() * 44;
      drop.y = camera.position.y + 5 + Math.random() * 24;
      const offset = index * 6;
      rainPositions[offset] = drop.x;
      rainPositions[offset + 1] = drop.y;
      rainPositions[offset + 2] = drop.z;
      rainPositions[offset + 3] = drop.x - 0.08;
      rainPositions[offset + 4] = drop.y - 0.72;
      rainPositions[offset + 5] = drop.z;
    };
    rainDrops.forEach(resetRainDrop);
    let weather: Weather = "clear";
    let weatherTimer = 35 + Math.random() * 35;
    const setWeather = (next: Weather) => {
      if (weather === next) return;
      weather = next;
      rain.visible = weather === "rain";
      callbacksRef.current.onWeatherChange(weather);
      callbacksRef.current.onMessage(
        weather === "rain" ? "天空阴沉下来 · 开始下雨" : "雨停了 · 天空重新放晴",
      );
      if (weather === "rain") rainDrops.forEach(resetRainDrop);
    };

    // A separate view-model rig gives firearms a readable 3D FPS silhouette
    // without interfering with world raycasts or block collisions.
    const firstPersonRig = new THREE.Group();
    // A clean HUD-style view model: no hands, just the firearm resting in the
    // lower-right while its barrel remains parallel with the camera's -Z axis.
    firstPersonRig.position.set(0.7, -0.62, -1.75);
    firstPersonRig.scale.setScalar(0.62);
    firstPersonRig.renderOrder = 10;
    weaponScene.add(firstPersonRig);
    const firstPersonMaterial = (color: number) =>
      new THREE.MeshLambertMaterial({
        color,
        depthTest: false,
        depthWrite: false,
      });
    const fpMetal = firstPersonMaterial(0x8497a2);
    const fpDarkMetal = firstPersonMaterial(0x1d2a34);
    const fpPolymer = firstPersonMaterial(0x344b5b);
    const fpWood = firstPersonMaterial(0x805238);
    const fpAccent = firstPersonMaterial(0xd7a94b);
    const weaponVisuals = {} as Record<PlayerWeaponKind, THREE.Group>;
    type CasingShell = {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      spin: THREE.Vector3;
      age: number;
    };
    const casingMaterial = firstPersonMaterial(0xc99535);
    const casingShells: CasingShell[] = [];
    const spawnCasing = (weapon: PlayerWeaponKind) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, weapon === "shotgun" ? 0.18 : 0.12, 0.08),
        casingMaterial,
      );
      // Eject from the receiver's right side in view-model space, then let
      // gravity and spin carry the brass down out of the lower-right corner.
      mesh.position.set(0.92, -0.42, -1.58);
      mesh.rotation.set(0.35, 0.2, 0.1);
      mesh.renderOrder = 12;
      weaponScene.add(mesh);
      casingShells.push({
        mesh,
        velocity: new THREE.Vector3(
          1.1 + Math.random() * 0.28,
          0.84 + Math.random() * 0.2,
          0.1 + Math.random() * 0.12,
        ),
        spin: new THREE.Vector3(12 + Math.random() * 6, 18 + Math.random() * 8, 8),
        age: 0,
      });
    };
    const makeFirstPersonWeapon = (kind: PlayerWeaponKind) => {
      const group = new THREE.Group();
      if (kind === "pistol") {
        const grip = addBox(group, fpPolymer, [0.16, 0.42, 0.2], [0, -0.2, 0.12]);
        grip.rotation.x = -0.18;
        addBox(group, fpMetal, [0.24, 0.17, 0.58], [0, 0.05, -0.18]);
        addBox(group, fpDarkMetal, [0.19, 0.1, 0.7], [0, 0.16, -0.22]);
        addBox(group, fpAccent, [0.08, 0.05, 0.18], [0, 0.22, -0.34]);
        addBox(group, fpDarkMetal, [0.09, 0.09, 0.1], [0, 0.05, -0.57]);
      } else if (kind === "rifle") {
        addBox(group, fpWood, [0.24, 0.2, 0.55], [0, -0.01, 0.23]);
        addBox(group, fpMetal, [0.3, 0.22, 0.48], [0, 0.02, -0.15]);
        addBox(group, fpPolymer, [0.25, 0.19, 0.72], [0, 0.01, -0.65]);
        addBox(group, fpDarkMetal, [0.09, 0.09, 0.92], [0, 0.05, -1.27]);
        addBox(group, fpMetal, [0.2, 0.12, 0.12], [0, 0.05, -1.76]);
        addBox(group, fpDarkMetal, [0.13, 0.12, 0.34], [0, 0.24, -0.24]);
        addBox(group, fpAccent, [0.08, 0.06, 0.16], [0, 0.3, -0.4]);
        addBox(group, fpPolymer, [0.18, 0.3, 0.16], [0, -0.2, -0.2]);
      } else {
        addBox(group, fpWood, [0.24, 0.2, 0.52], [0, -0.02, 0.2]);
        addBox(group, fpMetal, [0.34, 0.25, 0.38], [0, 0.03, -0.18]);
        addBox(group, fpPolymer, [0.28, 0.2, 0.75], [0, 0.03, -0.74]);
        addBox(group, fpDarkMetal, [0.13, 0.13, 0.9], [0, 0.08, -1.37]);
        addBox(group, fpMetal, [0.26, 0.14, 0.12], [0, 0.08, -1.84]);
        addBox(group, fpAccent, [0.08, 0.08, 0.18], [0, 0.23, -0.28]);
      }
      group.visible = false;
      firstPersonRig.add(group);
      weaponVisuals[kind] = group;
    };
    (['pistol', 'rifle', 'shotgun'] as PlayerWeaponKind[]).forEach(
      makeFirstPersonWeapon,
    );
    let weaponRecoil = 0;

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x2879c7) },
        horizon: { value: new THREE.Color(0xffaa65) },
        lower: { value: new THREE.Color(0xf17b4f) },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 lower;
        varying vec3 vPosition;
        void main() {
          float h = normalize(vPosition).y * 0.5 + 0.5;
          vec3 lowMix = mix(lower, horizon, smoothstep(0.22, 0.48, h));
          vec3 color = mix(lowMix, zenith, smoothstep(0.46, 0.95, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(115, 32, 18),
      skyMaterial,
    );
    scene.add(sky);

    const starGeometry = new THREE.BufferGeometry();
    // A denser, brighter field makes the nighttime sky immediately legible
    // even above forests and mountains.
    const starPositions = new Float32Array(360 * 3);
    let starSeed = 0x9e3779b9;
    const starRandom = () => {
      starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0;
      return starSeed / 4294967296;
    };
    for (let index = 0; index < starPositions.length / 3; index += 1) {
      const azimuth = starRandom() * Math.PI * 2;
      const elevation = 0.12 + starRandom() * 1.34;
      const radius = 92 + starRandom() * 8;
      const horizontalRadius = Math.cos(elevation) * radius;
      starPositions[index * 3] = Math.cos(azimuth) * horizontalRadius;
      starPositions[index * 3 + 1] = Math.sin(elevation) * radius;
      starPositions[index * 3 + 2] = Math.sin(azimuth) * horizontalRadius;
    }
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starMaterial = new THREE.PointsMaterial({
      color: 0xfff3cf,
      size: 1.85,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    starField.frustumCulled = false;
    starField.renderOrder = 2;
    scene.add(starField);

    const ambient = new THREE.HemisphereLight(0x93c8ff, 0x304527, 1.45);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffbf76, 3.6);
    sunLight.position.set(-18, 28, -38);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -34;
    sunLight.shadow.camera.right = 34;
    sunLight.shadow.camera.top = 34;
    sunLight.shadow.camera.bottom = -34;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    scene.add(sunLight);
    scene.add(sunLight.target);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffdc });
    const sun = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 5.5, 0.8),
      sunMaterial,
    );
    sun.position.set(0, 14, -69);
    scene.add(sun);
    const moonGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x9bc7ff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      depthTest: false,
    });
    const moonGlow = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 8.4, 0.45),
      moonGlowMaterial,
    );
    moonGlow.renderOrder = 3;
    scene.add(moonGlow);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xeaf2ff,
      depthWrite: false,
      depthTest: false,
    });
    const moon = new THREE.Mesh(
      new THREE.BoxGeometry(6.1, 6.1, 0.7),
      moonMaterial,
    );
    moon.renderOrder = 4;
    moon.position.set(0, -40, -69);
    scene.add(moon);

    const textureList: THREE.Texture[] = [];
    const texture = (
      base: string,
      flecks: string[],
      seed: number,
      topBand?: string,
    ) => {
      const result = makePixelTexture(renderer, base, flecks, seed, topBand);
      textureList.push(result);
      return result;
    };
    const grassTop = texture("#5c9d36", ["#79b845", "#376e2b", "#91c957"], 11);
    const grassSide = texture(
      "#755039",
      ["#8b6245", "#543722", "#426e2d"],
      12,
      "#5f9f38",
    );
    const wheat = texture("#d7ad3c", ["#f1d66a", "#a77925", "#6e4a1d"], 17);
    const dirt = texture("#795238", ["#916548", "#563822", "#a27550"], 23);
    const stone = texture("#777b77", ["#92958f", "#555b57", "#696d68"], 34);
    const bedrock = texture("#292b2d", ["#45484b", "#151719", "#5b5d5f"], 35);
    const woodSide = makeLogSideTexture(renderer);
    const woodTop = makeLogTopTexture(renderer);
    textureList.push(woodSide, woodTop);
    const planks = makePlankTexture(renderer);
    textureList.push(planks);
    const sand = texture("#d6c27c", ["#ead996", "#b5a05f", "#c6b270"], 68);
    const leaves = texture("#2d6a2f", ["#44823a", "#1d5227", "#5a963d"], 79);
    const sapling = texture("#477f2d", ["#79b845", "#2c5f26", "#8f6935"], 81);
    const woolBlock = texture("#e8e4d8", ["#ffffff", "#c8c1b2", "#aaa395"], 82);
    const glass = texture("#8bc2cc", ["#c1edf0", "#5898a9", "#d9ffff"], 80);
    const ironOre = makeOreTexture(
      renderer,
      "#c77942",
      "#ffd09a",
      "#713c27",
      91,
    );
    const rubyOre = makeOreTexture(
      renderer,
      "#d5163f",
      "#ffb3bd",
      "#650b29",
      97,
    );
    const coalOre = makeOreTexture(
      renderer,
      "#1d252d",
      "#71808a",
      "#080b0e",
      101,
    );
    textureList.push(ironOre, rubyOre, coalOre);
    const concrete = makeConcreteTexture(
      renderer,
      "#a9aaa4",
      "#858782",
      "#d1d2ca",
      "#686a66",
      108,
    );
    const redConcrete = makeConcreteTexture(
      renderer,
      "#b94b50",
      "#94383f",
      "#df7674",
      "#6f2932",
      109,
    );
    const yellowConcrete = makeConcreteTexture(
      renderer,
      "#c99e38",
      "#9f7724",
      "#f0d46e",
      "#74561c",
      110,
    );
    const whiteConcrete = makeConcreteTexture(
      renderer,
      "#ddd9cb",
      "#bab6ab",
      "#ffffff",
      "#9d9a91",
      111,
    );
    const purpleConcrete = makeConcreteTexture(
      renderer,
      "#79509c",
      "#5d397e",
      "#ad82ca",
      "#44285d",
      112,
    );
    const chest = makeChestTexture(renderer);
    textureList.push(chest);
    const bed = texture("#9d3545", ["#e87979", "#642130", "#f0d6c8"], 114);

    const lambert = (map: THREE.Texture, color = 0xffffff) =>
      new THREE.MeshLambertMaterial({ map, color });
    const dirtMaterial = lambert(dirt);
    const stoneMaterial = lambert(stone);
    const bedrockMaterial = lambert(bedrock);
    const woodMaterial = lambert(woodSide);
    const woodTopMaterial = lambert(woodTop);
    const planksMaterial = lambert(planks);
    const sandMaterial = lambert(sand);
    const leavesMaterial = lambert(leaves);
    const coalMaterial = lambert(coalOre);
    const torchMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8d2d,
      emissive: 0xff5a16,
      emissiveIntensity: 1.8,
      roughness: 0.7,
    });
    const glassMaterial = new THREE.MeshPhongMaterial({
      map: glass,
      color: 0xa9e5ef,
      transparent: true,
      opacity: 0.62,
      shininess: 90,
    });
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x3e9ed0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      shininess: 120,
      specular: 0xffcf8c,
    });
    const grassSideMaterial = lambert(grassSide);
    const grassTopMaterial = lambert(grassTop);
    const grassMaterials = [
      grassSideMaterial,
      grassSideMaterial,
      grassTopMaterial,
      dirtMaterial,
      grassSideMaterial,
      grassSideMaterial,
    ];
    const woodMaterials = [
      woodMaterial,
      woodMaterial,
      woodTopMaterial,
      woodTopMaterial,
      woodMaterial,
      woodMaterial,
    ];
    const materialMap: Record<
      TerrainBlockKind,
      THREE.Material | THREE.Material[]
    > = {
      grass: grassMaterials,
      wheat: lambert(wheat),
      dirt: dirtMaterial,
      stone: stoneMaterial,
      bedrock: bedrockMaterial,
      wood: woodMaterials,
      planks: planksMaterial,
      sand: sandMaterial,
      water: waterMaterial,
      leaves: leavesMaterial,
      sapling: lambert(sapling),
      woolBlock: lambert(woolBlock),
      glass: glassMaterial,
      ironOre: lambert(ironOre),
      rubyOre: lambert(rubyOre),
      coalOre: coalMaterial,
      coal: coalMaterial,
      torch: torchMaterial,
      concrete: lambert(concrete),
      redConcrete: lambert(redConcrete),
      yellowConcrete: lambert(yellowConcrete),
      whiteConcrete: lambert(whiteConcrete),
      purpleConcrete: lambert(purpleConcrete),
      chest: lambert(chest),
      bed: lambert(bed),
    };

    const world = new Map<string, TerrainBlockKind>();
    const removed = new Set<string>();
    const added = new Map<string, BlockKind>();
    const waterFlowLevels = new Map<string, number>();
    const saplingGrowth = new Map<string, number>();
    const defeatedAnimals = new Set<string>();
    const lootDropRecords = new Map<string, LootRecord>();
    const blockDropRecords = new Map<string, BlockDropRecord>();
    const villageChestLoot = new Map<string, VillageChestLoot>();
    // Natural chests remain after being searched. This tracks only that their
    // generated loot was already transferred into the chest inventory.
    const lootedVillageChests = new Set<string>();
    const setBlock = (
      x: number,
      y: number,
      z: number,
      kind: TerrainBlockKind,
    ) => {
      const key = blockKey(x, y, z);
      world.set(key, kind);
    };

    for (let x = WORLD_MIN; x <= WORLD_MAX; x += 1) {
      for (let z = WORLD_MIN; z <= WORLD_MAX; z += 1) {
        const profile = terrainProfile(x, z);
        const { height, biome } = profile;
        const sandy =
          biome === "water" || biome === "shore" || biome === "dunes";
        const rocky = biome === "rocky";
        const stoneBottom = height - ROCK_LAYER_DEPTH - 1;
        setBlock(x, stoneBottom - 1, z, "bedrock");
        for (let y = stoneBottom; y <= height; y += 1) {
          const kind: TerrainBlockKind =
            y < height - 1
              ? "stone"
              : y < height
                ? sandy
                  ? "sand"
                  : rocky
                    ? "stone"
                    : "dirt"
                : sandy
                  ? "sand"
                  : rocky
                    ? "stone"
                    : "grass";
          setBlock(x, y, z, kind);
        }
        if (biome === "water") setBlock(x, 3, z, "water");
      }
    }

    // Carve a denser network of deterministic chambers and winding tunnels.
    const carveCaveSphere = (
      cx: number,
      cy: number,
      cz: number,
      radius: number,
    ) => {
      const span = Math.ceil(radius);
      for (let dx = -span; dx <= span; dx += 1) {
        for (let dy = -span; dy <= span; dy += 1) {
          for (let dz = -span; dz <= span; dz += 1) {
            if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
            const key = blockKey(cx + dx, cy + dy, cz + dz);
            if (world.get(key) === "stone") world.delete(key);
          }
        }
      }
    };
    for (let cave = 0; cave < 30; cave += 1) {
      const seed = cave * 23 + 101;
      let x =
        WORLD_MIN +
        12 +
        Math.floor(terrainHash(seed, seed + 7, 41) * (WORLD_SIZE - 24));
      let z =
        WORLD_MIN +
        12 +
        Math.floor(terrainHash(seed, seed + 19, 43) * (WORLD_SIZE - 24));
      const angle = terrainHash(seed, seed + 29, 47) * Math.PI * 2;
      for (let step = 0; step < 18; step += 1) {
        const profile = terrainProfile(x, z);
        const floorY = profile.height - ROCK_LAYER_DEPTH + 2;
        const centerY = Math.max(
          floorY + 3,
          profile.height - 7 - Math.floor(terrainHash(x, z, 53) * 5),
        );
        if (Math.hypot(x - 5, z - 17) > 11)
          carveCaveSphere(
            x,
            centerY,
            z,
            2.2 + terrainHash(step, cave, 59) * 1.2,
          );
        x += Math.round(Math.cos(angle + Math.sin(step * 0.7) * 0.35));
        z += Math.round(Math.sin(angle + Math.cos(step * 0.6) * 0.35));
        x = Math.max(WORLD_MIN + 6, Math.min(WORLD_MAX - 6, x));
        z = Math.max(WORLD_MIN + 6, Math.min(WORLD_MAX - 6, z));
      }
    }

    // A handful of tunnels break through to the surface, making caves visible
    // from exploration instead of requiring every system to be found by mining.
    const carveOpenCaveSphere = (
      cx: number,
      cy: number,
      cz: number,
      radius: number,
    ) => {
      const span = Math.ceil(radius);
      for (let dx = -span; dx <= span; dx += 1) {
        for (let dy = -span; dy <= span; dy += 1) {
          for (let dz = -span; dz <= span; dz += 1) {
            if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
            const key = blockKey(cx + dx, cy + dy, cz + dz);
            const kind = world.get(key);
            if (kind && kind !== "bedrock" && kind !== "water") world.delete(key);
          }
        }
      }
    };
    for (let entrance = 0; entrance < 9; entrance += 1) {
      const seed = 701 + entrance * 41;
      const x =
        WORLD_MIN +
        20 +
        Math.floor(terrainHash(seed, seed + 9, 79) * (WORLD_SIZE - 40));
      const z =
        WORLD_MIN +
        20 +
        Math.floor(terrainHash(seed, seed + 17, 83) * (WORLD_SIZE - 40));
      const profile = terrainProfile(x, z);
      if (
        profile.biome === "water" ||
        profile.biome === "shore" ||
        Math.hypot(x - 5, z - 17) < 24 ||
        Math.hypot(x - 42, z + 22) < 24
      )
        continue;
      const angle = terrainHash(seed, seed + 31, 89) * Math.PI * 2;
      carveOpenCaveSphere(x, profile.height - 2, z, 3.1);
      for (let depth = 1; depth <= 6; depth += 1) {
        carveOpenCaveSphere(
          x + Math.round(Math.cos(angle) * depth),
          profile.height - 2 - depth,
          z + Math.round(Math.sin(angle) * depth),
          1.7,
        );
      }
    }

    // Generate ore veins after caves so exposed cave walls can reveal them.
    // Ruby stays deep and uncommon, but now receives its own roll before the
    // common ores so coal and iron cannot silently replace every ruby result.
    for (let x = WORLD_MIN + 2; x <= WORLD_MAX - 2; x += 1) {
      for (let z = WORLD_MIN + 2; z <= WORLD_MAX - 2; z += 1) {
        const height = terrainProfile(x, z).height;
        const stoneBottom = height - ROCK_LAYER_DEPTH - 1;
        for (let y = stoneBottom + 1; y < height - 1; y += 1) {
          if (world.get(blockKey(x, y, z)) !== "stone") continue;
          const depth = height - y;
          const coalRoll = terrainHash(x + y * 7, z - y * 11, 57);
          const ironRoll = terrainHash(x + y * 13, z - y * 7, 61);
          const rubyRoll = terrainHash(x - y * 17, z + y * 11, 67);
          if (depth >= 9 && depth <= 19 && rubyRoll < 0.0065) {
            world.set(blockKey(x, y, z), "rubyOre");
            const rubyNeighbors = [
              [1, 0, 0],
              [0, 0, 1],
              [0, 1, 0],
            ] as const;
            rubyNeighbors.forEach(([dx, dy, dz], index) => {
              if (
                world.get(blockKey(x + dx, y + dy, z + dz)) === "stone" &&
                terrainHash(x + index * 13, z - y * 5, 73 + index * 2) < 0.58
              )
                world.set(blockKey(x + dx, y + dy, z + dz), "rubyOre");
            });
          } else if (depth >= 3 && coalRoll < 0.022) {
            world.set(blockKey(x, y, z), "coalOre");
            if (
              world.get(blockKey(x + 1, y, z)) === "stone" &&
              terrainHash(x - z, y, 59) < 0.58
            )
              world.set(blockKey(x + 1, y, z), "coalOre");
          } else if (depth >= 4 && ironRoll < 0.012) {
            world.set(blockKey(x, y, z), "ironOre");
            if (
              world.get(blockKey(x + 1, y, z)) === "stone" &&
              terrainHash(x, z + y, 71) < 0.5
            )
              world.set(blockKey(x + 1, y, z), "ironOre");
          }
        }
      }
    }

    // Guaranteed starter veins prevent a valid world seed from feeling as if
    // ruby does not exist. They remain underground and still require an iron
    // pickaxe, preserving the intended tool progression.
    const starterRubyVeins = [
      [8, 15],
      [2, 20],
      [11, 21],
    ] as const;
    const starterVeinOffsets = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, -1],
      [1, 1, 0],
      [1, 0, 1],
      [-1, 0, 1],
    ] as const;
    starterRubyVeins.forEach(([veinX, veinZ]) => {
      const centerY = terrainProfile(veinX, veinZ).height - 12;
      let placed = 0;
      for (const [dx, dy, dz] of starterVeinOffsets) {
        if (placed >= 4) break;
        const key = blockKey(veinX + dx, centerY + dy, veinZ + dz);
        const current = world.get(key);
        if (current === "rubyOre") {
          placed += 1;
          continue;
        }
        if (current !== "stone" && current !== "coalOre" && current !== "ironOre")
          continue;
        world.set(key, "rubyOre");
        placed += 1;
      }
    });

    const surfaceCenter = (x: number, z: number) => {
      for (let y = 30; y >= 0; y -= 1) {
        const kind = world.get(blockKey(x, y, z));
        if (kind && kind !== "water" && kind !== "leaves") return y;
      }
      return 0;
    };

    const shopWood = new THREE.MeshLambertMaterial({ color: 0x70421f });
    const shopPlanks = new THREE.MeshLambertMaterial({ color: 0xb87938 });
    const shopMetal = new THREE.MeshLambertMaterial({ color: 0x5d6870 });
    const shopSkin = new THREE.MeshLambertMaterial({ color: 0xd18b63 });
    const shopClothes = new THREE.MeshLambertMaterial({ color: 0x2d547a });
    const shopRoofMaterials = [0x3b241b, 0x263d4c, 0x4e2b42, 0x31452b].map(
      (color) => new THREE.MeshLambertMaterial({ color }),
    );
    const shopGlowColors = [0xffb44d, 0x79c8ff, 0xff7d9d, 0x9ee06f];
    const shopSignMaterials = shopGlowColors.map(
      (color) => new THREE.MeshBasicMaterial({ color }),
    );
    // Four permanent market stalls make the expanded world worth exploring.
    SHOP_POSITIONS.forEach((shopPosition, index) => {
      const shopGroup = new THREE.Group();
      const shopY = surfaceCenter(shopPosition.x, shopPosition.z) + 0.5;
      const shopGlow = new THREE.PointLight(shopGlowColors[index], 2.2, 12);
      shopGroup.position.set(shopPosition.x, shopY, shopPosition.z);
      addBox(shopGroup, shopWood, [0.35, 3.4, 0.35], [-2.9, 1.7, -1.8]);
      addBox(shopGroup, shopWood, [0.35, 3.4, 0.35], [2.9, 1.7, -1.8]);
      addBox(shopGroup, shopWood, [0.35, 3.4, 0.35], [-2.9, 1.7, 1.8]);
      addBox(shopGroup, shopWood, [0.35, 3.4, 0.35], [2.9, 1.7, 1.8]);
      addBox(shopGroup, shopRoofMaterials[index], [7, 0.45, 5], [0, 3.55, 0]);
      addBox(shopGroup, shopPlanks, [6.2, 0.8, 0.7], [0, 1.2, -1.55]);
      addBox(shopGroup, shopMetal, [0.5, 0.55, 1.25], [-1.8, 1.9, -1.2]);
      addBox(shopGroup, shopMetal, [0.5, 0.55, 1.25], [1.8, 1.9, -1.2]);
      const sign = addBox(
        shopGroup,
        shopSignMaterials[index],
        [2.1, 0.38, 0.1],
        [0, 2.45, -2.05],
      );
      sign.castShadow = false;
      const trader = new THREE.Group();
      addBox(trader, shopClothes, [0.85, 1.15, 0.58], [0, 0.85, 0]);
      addBox(trader, shopSkin, [0.68, 0.68, 0.68], [0, 1.75, 0]);
      addBox(trader, shopMetal, [0.18, 0.18, 0.08], [-0.18, 1.78, -0.34]);
      addBox(trader, shopMetal, [0.18, 0.18, 0.08], [0.18, 1.78, -0.34]);
      trader.position.set(0, 0.8, 0.25);
      shopGroup.add(trader);
      shopGlow.position.set(0, 3.1, 0);
      shopGroup.add(shopGlow);
      scene.add(shopGroup);
    });

    const hutX = 10;
    const hutZ = -5;
    type TreeShape = "round" | "tall" | "broad";
    const treeCenters: Array<{ x: number; z: number }> = [];
    const addTree = (
      x: number,
      z: number,
      trunkHeight: number,
      shape: TreeShape = "round",
    ) => {
      const ground = surfaceCenter(x, z);
      if (world.get(blockKey(x, ground, z)) !== "grass") return false;
      if (treeCenters.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 4.5))
        return false;
      if (
        Math.hypot(x - 5, z - 17) < 7 ||
        (Math.abs(x - hutX) < 8 && Math.abs(z - hutZ) < 7)
      )
        return false;
      for (let y = 1; y <= trunkHeight; y += 1)
        if (world.has(blockKey(x, ground + y, z))) return false;
      for (let y = 1; y <= trunkHeight; y += 1)
        setBlock(x, ground + y, z, "wood");
      const crownY = ground + trunkHeight;
      const radius = shape === "broad" ? 3 : 2;
      const minDy = shape === "tall" ? 0 : -1;
      const maxDy = shape === "tall" ? 3 : 2;
      const crownLimit = shape === "broad" ? 5 : shape === "tall" ? 4 : 4;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          for (let dy = minDy; dy <= maxDy; dy += 1) {
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > crownLimit)
              continue;
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            const leafKey = blockKey(x + dx, crownY + dy, z + dz);
            if (!world.has(leafKey)) world.set(leafKey, "leaves");
          }
        }
      }
      treeCenters.push({ x, z });
      return true;
    };
    const landmarkTrees: Array<[number, number, number, TreeShape]> = [
      [-9, 13, 7, "tall"],
      [-13, 5, 5, "broad"],
      [-8, -6, 5, "round"],
      [7, 6, 5, "round"],
      [13, -10, 6, "tall"],
      [16, 9, 6, "broad"],
      [-17, -13, 6, "round"],
      [18, -2, 5, "round"],
    ];
    landmarkTrees.forEach(([x, z, height, shape]) =>
      addTree(x, z, height, shape),
    );

    for (let cellX = WORLD_MIN + 4; cellX <= WORLD_MAX - 4; cellX += 5) {
      for (let cellZ = WORLD_MIN + 4; cellZ <= WORLD_MAX - 4; cellZ += 5) {
        const x = cellX + Math.floor(terrainHash(cellX, cellZ, 11) * 3) - 1;
        const z = cellZ + Math.floor(terrainHash(cellX, cellZ, 17) * 3) - 1;
        const profile = terrainProfile(x, z);
        const treeChance =
          profile.biome === "forest"
            ? 0.62
            : profile.biome === "plains"
              ? 0.13
              : profile.biome === "highlands"
                ? 0.07
                : 0;
        if (terrainHash(x, z, 23) > treeChance) continue;
        const neighborHeights = [
          terrainHeight(x + 1, z),
          terrainHeight(x - 1, z),
          terrainHeight(x, z + 1),
          terrainHeight(x, z - 1),
        ];
        if (
          neighborHeights.some(
            (neighborHeight) => Math.abs(neighborHeight - profile.height) > 1,
          )
        )
          continue;
        const shapeRoll = terrainHash(x, z, 31);
        const shape: TreeShape =
          shapeRoll < 0.2 ? "tall" : shapeRoll > 0.78 ? "broad" : "round";
        const trunkHeight =
          (shape === "tall" ? 6 : 4) + Math.floor(terrainHash(x, z, 37) * 3);
        addTree(x, z, trunkHeight, shape);
      }
    }

    let hutGround = 0;
    for (let x = hutX - 4; x <= hutX + 4; x += 1) {
      for (let z = hutZ - 3; z <= hutZ + 3; z += 1)
        hutGround = Math.max(hutGround, surfaceCenter(x, z));
    }
    for (let x = hutX - 4; x <= hutX + 4; x += 1) {
      for (let z = hutZ - 3; z <= hutZ + 3; z += 1) {
        for (let y = surfaceCenter(x, z) + 1; y <= hutGround; y += 1)
          setBlock(x, y, z, "stone");
        setBlock(x, hutGround + 1, z, "planks");
      }
    }
    for (let y = hutGround + 2; y <= hutGround + 5; y += 1) {
      for (let x = hutX - 4; x <= hutX + 4; x += 1) {
        const frontDoor = x === hutX && y <= hutGround + 3;
        if (!frontDoor) setBlock(x, y, hutZ + 3, "planks");
        setBlock(x, y, hutZ - 3, "planks");
      }
      for (let z = hutZ - 2; z <= hutZ + 2; z += 1) {
        const windowLevel = y === hutGround + 3;
        setBlock(
          hutX - 4,
          y,
          z,
          windowLevel && z === hutZ ? "glass" : "planks",
        );
        setBlock(
          hutX + 4,
          y,
          z,
          windowLevel && z === hutZ ? "glass" : "planks",
        );
      }
    }
    for (let step = 0; step < 3; step += 1) {
      for (let x = hutX - 5 + step; x <= hutX + 5 - step; x += 1) {
        for (const z of [hutZ - 4 + step, hutZ + 4 - step])
          setBlock(x, hutGround + 6 + step, z, "planks");
      }
    }
    for (let z = hutZ - 3; z <= hutZ + 3; z += 1)
      setBlock(hutX, hutGround + 8, z, "planks");
    for (let y = hutGround + 6; y <= hutGround + 9; y += 1)
      setBlock(hutX + 3, y, hutZ - 1, "stone");

    // Keep the village as a separate destination from the starter hut/spawn.
    // Its center is over 50 blocks from (5, 17), encouraging exploration.
    const villageOrigin = { x: 42, z: -22 };
    const villageBounds = {
      minX: villageOrigin.x - 17,
      maxX: villageOrigin.x + 6,
      minZ: villageOrigin.z - 13,
      maxZ: villageOrigin.z + 3,
    };
    let villageGround = 0;
    for (let x = villageBounds.minX; x <= villageBounds.maxX; x += 1)
      for (let z = villageBounds.minZ; z <= villageBounds.maxZ; z += 1)
        villageGround = Math.max(villageGround, surfaceCenter(x, z));
    // Level the village plateau at its local terrain height and add foundations
    // below it, so the distant settlement never floats at the starter-hut Y.
    for (let x = villageBounds.minX; x <= villageBounds.maxX; x += 1) {
      for (let z = villageBounds.minZ; z <= villageBounds.maxZ; z += 1) {
        for (let y = villageGround + 1; y <= villageGround + 10; y += 1)
          world.delete(blockKey(x, y, z));
        for (let y = surfaceCenter(x, z) + 1; y <= villageGround; y += 1)
          setBlock(x, y, z, "stone");
        setBlock(x, villageGround, z, "grass");
      }
    }
    const wheatPlotSeeds: Array<{ x: number; z: number; y: number; age: number }> = [];
    const outpostBanditSpawns: Array<{ x: number; z: number; seed: number }> = [];
    const villageVillagerSpawns: Array<{ x: number; z: number; name: string }> = [
      { x: 34, z: -23, name: "农夫" },
      { x: 43, z: -22, name: "村民" },
      { x: 29, z: -27, name: "商人" },
    ];
    const buildVillageHouse = (
      centerX: number,
      centerZ: number,
      ground = villageGround,
    ) => {
      for (let x = centerX - 3; x <= centerX + 3; x += 1) {
        for (let z = centerZ - 2; z <= centerZ + 2; z += 1) {
          setBlock(x, ground + 1, z, "planks");
          for (let y = ground + 2; y <= ground + 4; y += 1) {
            const door = x === centerX && z === centerZ + 2 && y <= ground + 3;
            if (!door && (x === centerX - 3 || x === centerX + 3 || z === centerZ - 2 || z === centerZ + 2))
              setBlock(x, y, z, "planks");
          }
        }
      }
      for (let x = centerX - 4; x <= centerX + 4; x += 1)
        for (let z = centerZ - 3; z <= centerZ + 3; z += 1)
          if (Math.abs(x - centerX) + Math.abs(z - centerZ) <= 5)
            setBlock(x, ground + 5, z, "planks");
    };
    buildVillageHouse(villageOrigin.x + 2, villageOrigin.z);
    buildVillageHouse(villageOrigin.x - 13, villageOrigin.z - 5);
    const farmY = villageGround + 1;
    for (let x = villageOrigin.x - 7; x <= villageOrigin.x + 3; x += 1) {
      for (let z = villageOrigin.z - 12; z <= villageOrigin.z - 4; z += 1) {
        if (x === villageOrigin.x - 2) {
          setBlock(x, farmY, z, "water");
          continue;
        }
        setBlock(x, farmY, z, "dirt");
        wheatPlotSeeds.push({ x, z, y: farmY + 0.5, age: terrainHash(x, z, 401) * 0.65 });
      }
    }
    const addVillageChest = (x: number, z: number, seed: number) => {
      const key = blockKey(x, farmY + 1, z);
      setBlock(x, farmY + 1, z, "chest");
      const loot: VillageChestLoot = [{ kind: "wheat", amount: 2 + (seed % 3) }];
      if (seed % 2 === 0) loot.push({ kind: "rubyOre", amount: 1 });
      if (seed % 3 === 0) loot.push({ kind: "coal", amount: 2 });
      villageChestLoot.set(key, loot);
    };
    addVillageChest(villageOrigin.x + 2, villageOrigin.z + 2, 7);
    addVillageChest(villageOrigin.x - 13, villageOrigin.z - 6, 11);

    // Two additional settlements make villages a real world-wide discovery
    // rather than a single destination. Each is flattened onto local ground.
    const remoteVillages = [
      { x: -54, z: 94, seed: 83, name: "林地" },
      { x: 100, z: 56, seed: 167, name: "河湾" },
    ];
    const buildRemoteVillage = (site: (typeof remoteVillages)[number]) => {
      const bounds = {
        minX: site.x - 12,
        maxX: site.x + 12,
        minZ: site.z - 10,
        maxZ: site.z + 9,
      };
      let ground = 0;
      for (let x = bounds.minX; x <= bounds.maxX; x += 1)
        for (let z = bounds.minZ; z <= bounds.maxZ; z += 1)
          ground = Math.max(ground, surfaceCenter(x, z));
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
          for (let y = ground + 1; y <= ground + 10; y += 1)
            world.delete(blockKey(x, y, z));
          for (let y = surfaceCenter(x, z) + 1; y <= ground; y += 1)
            setBlock(x, y, z, "stone");
          setBlock(x, ground, z, "grass");
        }
      }
      buildVillageHouse(site.x - 5, site.z + 3, ground);
      buildVillageHouse(site.x + 6, site.z + 2, ground);
      const farmY = ground + 1;
      for (let x = site.x - 9; x <= site.x + 9; x += 1) {
        for (let z = site.z - 8; z <= site.z - 3; z += 1) {
          if (x === site.x) {
            setBlock(x, farmY, z, "water");
            continue;
          }
          setBlock(x, farmY, z, "dirt");
          wheatPlotSeeds.push({
            x,
            z,
            y: farmY + 0.5,
            age: terrainHash(x, z, site.seed) * 0.65,
          });
        }
      }
      const chestX = site.x - 9;
      const chestZ = site.z + 4;
      const chestKey = blockKey(chestX, farmY, chestZ);
      setBlock(chestX, farmY, chestZ, "chest");
      const loot: VillageChestLoot = [
        { kind: "wheat", amount: 3 + (site.seed % 3) },
        { kind: "coal", amount: 1 + (site.seed % 2) },
      ];
      if (site.seed % 2 === 1) loot.push({ kind: "rubyOre", amount: 1 });
      villageChestLoot.set(chestKey, loot);
      villageVillagerSpawns.push(
        { x: site.x - 2, z: site.z + 1, name: `${site.name}农夫` },
        { x: site.x + 2, z: site.z, name: `${site.name}村民` },
        { x: site.x + 8, z: site.z + 4, name: `${site.name}商人` },
      );
    };
    remoteVillages.forEach(buildRemoteVillage);

    // A few distant outposts give the expanded world high-risk destinations.
    // Each tower is deliberately far from spawn, the village, and the shops.
    const outpostSites = [
      { x: -104, z: -88, seed: 71 },
      { x: 108, z: -96, seed: 149 },
      { x: -112, z: 101, seed: 233 },
    ];
    const buildBanditOutpost = (site: (typeof outpostSites)[number]) => {
      const radius = 4;
      let ground = 0;
      for (let x = site.x - radius; x <= site.x + radius; x += 1)
        for (let z = site.z - radius; z <= site.z + radius; z += 1)
          ground = Math.max(ground, surfaceCenter(x, z));
      for (let x = site.x - radius; x <= site.x + radius; x += 1) {
        for (let z = site.z - radius; z <= site.z + radius; z += 1) {
          for (let y = surfaceCenter(x, z) + 1; y <= ground; y += 1)
            setBlock(x, y, z, "stone");
          setBlock(x, ground, z, "grass");
          for (let y = ground + 1; y <= ground + 9; y += 1)
            world.delete(blockKey(x, y, z));
        }
      }
      for (const dx of [-3, 3]) {
        for (const dz of [-3, 3]) {
          for (let y = ground + 1; y <= ground + 7; y += 1)
            setBlock(site.x + dx, y, site.z + dz, "wood");
        }
      }
      for (let x = site.x - 3; x <= site.x + 3; x += 1) {
        for (let z = site.z - 3; z <= site.z + 3; z += 1) {
          if (Math.abs(x - site.x) === 3 || Math.abs(z - site.z) === 3)
            setBlock(x, ground + 4, z, "planks");
          setBlock(x, ground + 8, z, "planks");
        }
      }
      for (let x = site.x - 2; x <= site.x + 2; x += 1)
        for (let z = site.z - 2; z <= site.z + 2; z += 1)
          setBlock(x, ground + 9, z, "planks");
      for (let y = ground + 1; y <= ground + 6; y += 1)
        setBlock(site.x - 3, y, site.z, "planks");

      const chestX = site.x + 1;
      const chestZ = site.z + 1;
      const chestKey = blockKey(chestX, ground + 1, chestZ);
      setBlock(chestX, ground + 1, chestZ, "chest");
      const loot: VillageChestLoot = [
        { kind: "rubyOre", amount: 3 + (site.seed % 3) },
        { kind: "ironOre", amount: 2 + (site.seed % 2) },
        { kind: "coal", amount: 4 + (site.seed % 3) },
      ];
      // Rare firearm cache: each tower independently has a small chance to
      // contain a shotgun, making an outpost worth checking even after one run.
      if (terrainHash(site.x, site.z, 607) < 0.18)
        loot.push({ kind: "shotgun", amount: 1 });
      villageChestLoot.set(chestKey, loot);
      outpostBanditSpawns.push({ x: site.x - 1, z: site.z - 1, seed: site.seed });
    };
    outpostSites.forEach(buildBanditOutpost);

    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const saved = JSON.parse(localStorage.getItem(saveStorageKey) ?? "null");
      if (saved?.removed && Array.isArray(saved.removed)) {
        for (const key of saved.removed) {
          // Older versions deleted a natural chest after auto-claiming its
          // loot. Restore that chest as an already-searched empty container
          // so existing saves no longer show a disappearing chest.
          if (villageChestLoot.has(key)) {
            lootedVillageChests.add(key);
            villageChestLoot.delete(key);
            continue;
          }
          if (world.get(key) === "bedrock") continue;
          world.delete(key);
          removed.add(key);
        }
      }
      if (saved?.added && Array.isArray(saved.added)) {
        for (const [key, kind] of saved.added as [string, BlockKind][]) {
          if (PLACEABLE.has(kind)) {
            world.set(key, kind);
            added.set(key, kind);
          }
        }
      }
      if (saved?.waterFlowLevels && Array.isArray(saved.waterFlowLevels)) {
        for (const [key, level] of saved.waterFlowLevels as [string, number][]) {
          if (
            world.get(key) === "water" &&
            Number.isInteger(level) &&
            level >= 0 &&
            level <= 5
          )
            waterFlowLevels.set(key, level);
        }
      }
      // Water placed by an older save becomes a source block and starts
      // flowing after the upgrade.
      for (const [key, kind] of added)
        if (kind === "water" && !waterFlowLevels.has(key))
          waterFlowLevels.set(key, 0);
      if (saved?.saplingGrowth && Array.isArray(saved.saplingGrowth)) {
        for (const [key, age] of saved.saplingGrowth as [string, number][]) {
          if (world.get(key) === "sapling" && Number.isFinite(age))
            saplingGrowth.set(
              key,
              Math.max(0, Math.min(age, SAPLING_GROWTH_SECONDS)),
            );
        }
      }
      if (saved?.defeatedAnimals && Array.isArray(saved.defeatedAnimals)) {
        for (const id of saved.defeatedAnimals) defeatedAnimals.add(String(id));
      }
      if (
        saved?.lootedVillageChests &&
        Array.isArray(saved.lootedVillageChests)
      ) {
        for (const key of saved.lootedVillageChests) {
          const chestKey = String(key);
          lootedVillageChests.add(chestKey);
          villageChestLoot.delete(chestKey);
        }
      }
      if (saved?.lootDrops && Array.isArray(saved.lootDrops)) {
        for (const record of saved.lootDrops as LootRecord[]) {
          if (
            record?.id &&
            [
              "wool",
              "rawPork",
              "leather",
              "rawBeef",
              "poppy",
              "dandelion",
              "oxeyeDaisy",
              "allium",
              "honeycomb",
            ].includes(record.kind)
          )
            lootDropRecords.set(record.id, record);
        }
      }
      if (saved?.blockDrops && Array.isArray(saved.blockDrops)) {
        for (const record of saved.blockDrops as BlockDropRecord[]) {
          if (record?.id && PLACEABLE.has(record.kind))
            blockDropRecords.set(record.id, record);
        }
      }
    } catch {
      localStorage.removeItem(saveStorageKey);
    }
    for (const [key, kind] of added)
      if (kind === "sapling" && !saplingGrowth.has(key))
        saplingGrowth.set(key, 0);

    const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
    const voxelGroup = new THREE.Group();
    scene.add(voxelGroup);
    const VOXEL_CHUNK_SIZE = 32;
    const voxelChunkCoordinates = (x: number, z: number) => ({
      x: Math.floor(x / VOXEL_CHUNK_SIZE),
      z: Math.floor(z / VOXEL_CHUNK_SIZE),
    });
    const voxelMeshesByChunk = new Map<string, THREE.InstancedMesh[]>();
    const saplingVisualsByChunk = new Map<
      string,
      Array<{ group: THREE.Group; block: BlockRecord }>
    >();
    const torchLightsByChunk = new Map<string, THREE.PointLight[]>();
    let saplingVisuals: Array<{ group: THREE.Group; block: BlockRecord }> = [];
    type WheatEntity = { x: number; z: number; group: THREE.Group; age: number };
    const wheatEntities: WheatEntity[] = [];
    const dummy = new THREE.Object3D();

    const refreshSaplingVisuals = () => {
      saplingVisuals = Array.from(saplingVisualsByChunk.values()).flat();
    };
    const disposeVoxelChunk = (chunkKey: string) => {
      for (const mesh of voxelMeshesByChunk.get(chunkKey) ?? []) {
        voxelGroup.remove(mesh);
        mesh.dispose();
      }
      voxelMeshesByChunk.delete(chunkKey);
      for (const saplingVisual of saplingVisualsByChunk.get(chunkKey) ?? []) {
        voxelGroup.remove(saplingVisual.group);
        saplingVisual.group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
      }
      saplingVisualsByChunk.delete(chunkKey);
      for (const light of torchLightsByChunk.get(chunkKey) ?? [])
        scene.remove(light);
      torchLightsByChunk.delete(chunkKey);
    };
    const rebuildVoxelChunk = (chunkKey: string) => {
      disposeVoxelChunk(chunkKey);
      const [chunkX, chunkZ] = chunkKey.split(",").map(Number);
      const minX = Math.max(WORLD_MIN, chunkX * VOXEL_CHUNK_SIZE);
      const maxX = Math.min(
        WORLD_MAX,
        (chunkX + 1) * VOXEL_CHUNK_SIZE - 1,
      );
      const minZ = Math.max(WORLD_MIN, chunkZ * VOXEL_CHUNK_SIZE);
      const maxZ = Math.min(
        WORLD_MAX,
        (chunkZ + 1) * VOXEL_CHUNK_SIZE - 1,
      );
      if (minX > maxX || minZ > maxZ) return;
      const grouped = new Map<TerrainBlockKind, BlockRecord[]>();
      const chunkSaplings: Array<{ group: THREE.Group; block: BlockRecord }> = [];
      const chunkTorchLights: THREE.PointLight[] = [];
      for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          for (let y = WORLD_BOTTOM_Y; y <= 40; y += 1) {
            const key = blockKey(x, y, z);
            const kind = world.get(key);
            if (!kind) continue;
            const position = { x, y, z };
            if (kind === "sapling") {
              const group = new THREE.Group();
              addBox(group, woodMaterial, [0.12, 0.58, 0.12], [0, -0.21, 0]);
              addBox(group, leavesMaterial, [0.46, 0.34, 0.46], [0, 0.17, 0]);
              addBox(group, leavesMaterial, [0.3, 0.26, 0.3], [0.08, 0.39, -0.05]);
              group.position.set(position.x, position.y, position.z);
              voxelGroup.add(group);
              chunkSaplings.push({ group, block: { ...position, kind } });
              continue;
            }
            const exposed = BLOCK_NEIGHBORS.some(
              ([dx, dy, dz]) =>
                !world.has(blockKey(x + dx, y + dy, z + dz)),
            );
            if (!exposed) continue;
            const bucket = grouped.get(kind) ?? [];
            bucket.push({ ...position, kind });
            grouped.set(kind, bucket);
            if (kind === "torch") {
              const light = new THREE.PointLight(0xffa13a, 1.65, 7, 1.8);
              light.position.set(position.x, position.y + 0.85, position.z);
              scene.add(light);
              chunkTorchLights.push(light);
            }
          }
        }
      }
      for (const [kind, blocks] of grouped) {
        const mesh = new THREE.InstancedMesh(
          voxelGeometry,
          materialMap[kind],
          blocks.length,
        );
        // `dummy` is also reused by the crossed grass-blade instances below,
        // where its rotation and scale are changed. Reset the full transform
        // before rebuilding terrain or mined blocks inherit those transforms
        // and stretch into spikes.
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        blocks.forEach((block, index) => {
          if (kind === "water") {
            const level = waterFlowLevels.get(
              blockKey(block.x, block.y, block.z),
            );
            const height =
              level == null ? 0.92 : Math.max(0.2, 0.92 - level * 0.14);
            dummy.scale.set(1, height, 1);
            dummy.position.set(
              block.x,
              block.y - (1 - height) * 0.5 + 0.03,
              block.z,
            );
          } else {
            dummy.scale.set(1, 1, 1);
            dummy.position.set(block.x, block.y, block.z);
          }
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        // 实例数量/位置会在挖掘和放置后变化，必须刷新包围体；否则
        // Three.js 会沿用旧范围，导致整组方块被错误裁剪或射线命中错位。
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
        mesh.frustumCulled = true;
        mesh.userData.positions = blocks;
        mesh.userData.blockType = kind;
        mesh.userData.chunkKey = chunkKey;
        // Tree silhouettes provide most of the useful world shadows. Avoid
        // rendering every terrain cube into the shadow map.
        mesh.castShadow = kind === "wood" || kind === "leaves";
        mesh.receiveShadow = kind !== "water";
        // Transparent water must test the opaque terrain depth without writing
        // to it, otherwise adjacent water instances create see-through seams.
        mesh.renderOrder = kind === "water" ? 4 : kind === "glass" ? 3 : 1;
        voxelGroup.add(mesh);
        const chunkMeshes = voxelMeshesByChunk.get(chunkKey) ?? [];
        chunkMeshes.push(mesh);
        voxelMeshesByChunk.set(chunkKey, chunkMeshes);
      }
      if (chunkSaplings.length > 0)
        saplingVisualsByChunk.set(chunkKey, chunkSaplings);
      if (chunkTorchLights.length > 0)
        torchLightsByChunk.set(chunkKey, chunkTorchLights);
    };
    const rebuildVoxelMeshes = () => {
      for (const chunkKey of voxelMeshesByChunk.keys())
        disposeVoxelChunk(chunkKey);
      const minChunkX = Math.floor(WORLD_MIN / VOXEL_CHUNK_SIZE);
      const maxChunkX = Math.floor(WORLD_MAX / VOXEL_CHUNK_SIZE);
      const minChunkZ = Math.floor(WORLD_MIN / VOXEL_CHUNK_SIZE);
      const maxChunkZ = Math.floor(WORLD_MAX / VOXEL_CHUNK_SIZE);
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1)
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1)
          rebuildVoxelChunk(`${chunkX},${chunkZ}`);
      refreshSaplingVisuals();
    };
    const dirtyVoxelChunks = new Set<string>();
    const markVoxelChange = (x: number, z: number) => {
      const chunk = voxelChunkCoordinates(x, z);
      const localX = x - chunk.x * VOXEL_CHUNK_SIZE;
      const localZ = z - chunk.z * VOXEL_CHUNK_SIZE;
      dirtyVoxelChunks.add(`${chunk.x},${chunk.z}`);
      if (localX === 0) dirtyVoxelChunks.add(`${chunk.x - 1},${chunk.z}`);
      if (localX === VOXEL_CHUNK_SIZE - 1)
        dirtyVoxelChunks.add(`${chunk.x + 1},${chunk.z}`);
      if (localZ === 0) dirtyVoxelChunks.add(`${chunk.x},${chunk.z - 1}`);
      if (localZ === VOXEL_CHUNK_SIZE - 1)
        dirtyVoxelChunks.add(`${chunk.x},${chunk.z + 1}`);
    };
    const indexRuntimeBlock = (_key: string, x: number, z: number) =>
      markVoxelChange(x, z);
    const unindexRuntimeBlock = (_key: string, x: number, z: number) =>
      markVoxelChange(x, z);
    const rebuildChangedVoxelMeshes = () => {
      for (const chunkKey of dirtyVoxelChunks) rebuildVoxelChunk(chunkKey);
      dirtyVoxelChunks.clear();
      refreshSaplingVisuals();
    };
    rebuildVoxelMeshes();
    const wheatMaterial = materialMap.wheat as THREE.Material;
    wheatPlotSeeds.forEach((seed) => {
      const group = new THREE.Group();
      addBox(group, wheatMaterial, [0.08, 0.72, 0.08], [0, 0.36, 0]);
      addBox(group, wheatMaterial, [0.24, 0.08, 0.08], [0.12, 0.58, 0]);
      addBox(group, wheatMaterial, [0.08, 0.08, 0.24], [-0.12, 0.48, 0]);
      group.position.set(seed.x, seed.y, seed.z);
      group.scale.y = 0.45 + seed.age * 0.7;
      scene.add(group);
      wheatEntities.push({ x: seed.x, z: seed.z, group, age: seed.age });
    });

    type BlockDropEntity = {
      record: BlockDropRecord;
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      baseY: number;
      phase: number;
      age: number;
      settled: boolean;
      active: boolean;
    };
    const blockDropEntities: BlockDropEntity[] = [];
    const blockDropGround = (x: number, z: number, startY: number) => {
      const bx = Math.round(x);
      const bz = Math.round(z);
      for (
        let y = Math.min(30, Math.floor(startY));
        y >= WORLD_BOTTOM_Y;
        y -= 1
      ) {
        const kind = world.get(blockKey(bx, y, bz));
        if (
          kind &&
          kind !== "water" &&
          kind !== "leaves" &&
          kind !== "sapling" &&
          kind !== "glass"
        )
          return y + 0.72;
      }
      return WORLD_BOTTOM_Y - 0.28;
    };
    const spawnBlockDropEntity = (record: BlockDropRecord, fresh = false) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.34, 0.34),
        materialMap[record.kind],
      );
      const groundY = blockDropGround(record.x, record.z, record.y);
      mesh.position.set(record.x, fresh ? record.y : groundY, record.z);
      mesh.rotation.set(0.18, 0.35, 0.08);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const scatter = (record.id.length % 7) * 0.13;
      blockDropEntities.push({
        record,
        mesh,
        velocity: fresh
          ? new THREE.Vector3(
              Math.sin(scatter * 4.7) * 0.85,
              2.35,
              Math.cos(scatter * 3.9) * 0.85,
            )
          : new THREE.Vector3(),
        baseY: groundY,
        phase: record.id.length * 0.61,
        age: fresh ? 0 : 1,
        settled: !fresh,
        active: true,
      });
    };
    blockDropRecords.forEach((record) => spawnBlockDropEntity(record, false));

    const cloudLightMaterial = new THREE.MeshLambertMaterial({
      color: 0xfff7eb,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    const cloudMidMaterial = new THREE.MeshLambertMaterial({
      color: 0xdce8f0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const cloudShadowMaterial = new THREE.MeshLambertMaterial({
      color: 0xaec1d0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    type VoxelCloud = {
      group: THREE.Group;
      speed: number;
      baseZ: number;
      phase: number;
    };
    const clouds: VoxelCloud[] = [];
    const cloudData: Array<[number, number, number, number, number, number]> = [
      [-58, 25, -38, 1.05, 0.34, 0],
      [-27, 31, -62, 1.45, 0.25, 1],
      [7, 23, -34, 1.12, 0.41, 2],
      [42, 29, -58, 1.35, 0.29, 0],
      [65, 24, -22, 0.92, 0.46, 1],
      [-48, 27, 18, 1.2, 0.31, 2],
      [-5, 34, 35, 1.55, 0.22, 1],
      [38, 26, 16, 1.08, 0.38, 0],
      [70, 32, 48, 1.4, 0.27, 2],
    ];
    cloudData.forEach(([x, y, z, scale, speed, variant], index) => {
      const group = new THREE.Group();
      const cloudBox = (
        material: THREE.Material,
        size: [number, number, number],
        position: [number, number, number],
      ) => {
        const mesh = addBox(group, material, size, position);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      };
      cloudBox(cloudShadowMaterial, [8.4, 0.72, 3.5], [0, -0.52, 0]);
      cloudBox(cloudMidMaterial, [7.2, 1.05, 3.15], [0, 0, 0]);
      if (variant === 0) {
        cloudBox(cloudLightMaterial, [4.1, 1.65, 2.75], [-2.25, 0.86, 0]);
        cloudBox(cloudLightMaterial, [3.4, 2.2, 2.5], [0.75, 1.08, -0.08]);
        cloudBox(cloudMidMaterial, [2.6, 1.35, 2.8], [3.5, 0.45, 0.12]);
      } else if (variant === 1) {
        cloudBox(cloudLightMaterial, [3.2, 2.4, 2.6], [-1.7, 1.2, 0]);
        cloudBox(cloudLightMaterial, [4.3, 1.6, 2.9], [1.45, 0.78, 0.08]);
        cloudBox(cloudMidMaterial, [2.1, 1.05, 2.5], [4.2, 0.2, 0]);
      } else {
        cloudBox(cloudLightMaterial, [5.1, 1.45, 2.65], [-1.5, 0.7, 0]);
        cloudBox(cloudLightMaterial, [2.8, 2.05, 2.35], [1.9, 1.02, 0]);
        cloudBox(cloudMidMaterial, [2.4, 0.9, 2.75], [4.05, 0.1, 0]);
      }
      group.position.set(x, y, z);
      group.scale.setScalar(scale);
      group.rotation.y = ((index % 3) - 1) * 0.08;
      scene.add(group);
      clouds.push({ group, speed, baseZ: z, phase: index * 0.83 });
    });

    type AnimalKind = "sheep" | "pig" | "cow";
    type AnimalNPC = {
      id: string;
      kind: AnimalKind;
      group: THREE.Group;
      body: THREE.Mesh;
      head: THREE.Mesh;
      legs: THREE.Mesh[];
      target: THREE.Vector3;
      speed: number;
      stateTimer: number;
      walking: boolean;
      seed: number;
      phase: number;
      baseBodyY: number;
      baseHeadY: number;
      baseScale: number;
      health: number;
      maxHealth: number;
      hurtTimer: number;
      soundTimer: number;
      deathTimer: number;
      dead: boolean;
      persistent: boolean;
    };
    type BanditWeapon = "sword" | "rifle";
    type BanditKind = "normal" | "armored";
    type BanditNPC = {
      id: string;
      weapon: BanditWeapon;
      kind: BanditKind;
      group: THREE.Group;
      body: THREE.Mesh;
      head: THREE.Mesh;
      legs: THREE.Mesh[];
      muzzleFlash: THREE.Mesh | null;
      baseBodyY: number;
      baseHeadY: number;
      baseScale: number;
      health: number;
      maxHealth: number;
      hurtTimer: number;
      deathTimer: number;
      attackCooldown: number;
      muzzleFlashTimer: number;
      seed: number;
      dead: boolean;
    };
    type VillagerNPC = {
      id: string;
      name: string;
      group: THREE.Group;
      home: { x: number; z: number };
      target: { x: number; z: number };
      seed: number;
      wanderStep: number;
      stateTimer: number;
      health: number;
      maxHealth: number;
      hurtTimer: number;
      deathTimer: number;
      dead: boolean;
    };

    const sheepWool = lambert(
      texture("#eee9da", ["#ffffff", "#d4cec0", "#bab3a6"], 183),
    );
    const sheepFace = lambert(
      texture("#b9aa91", ["#d4c4aa", "#857663", "#e2d4bc"], 184),
    );
    const sheepLeg = lambert(
      texture("#4d4239", ["#75665a", "#2f2925", "#8d7b6a"], 185),
    );
    const pigSkin = lambert(
      texture("#df8e96", ["#f1adb0", "#bd6d7b", "#f5c2bd"], 193),
    );
    const pigSnout = lambert(
      texture("#f0a7a9", ["#ffd0cb", "#cf7c86", "#e58f98"], 194),
    );
    const cowHide = lambert(
      texture("#e8dfca", ["#fff8e5", "#5f4231", "#3b2b23"], 203),
    );
    const cowPatch = lambert(
      texture("#523829", ["#76523b", "#30231e", "#916548"], 204),
    );
    const cowFace = lambert(
      texture("#76513b", ["#997057", "#513728", "#b48a6c"], 205),
    );
    const cowMuzzle = lambert(
      texture("#c6987c", ["#e4b89c", "#9d705c", "#d4a487"], 206),
    );
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x16130f });
    const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x48272d });
    const hornMaterial = new THREE.MeshLambertMaterial({ color: 0xe8d7a4 });
    const hoofMaterial = new THREE.MeshLambertMaterial({ color: 0x29231f });
    const villagerFabric = makeVillagerFabricTexture(renderer);
    const villagerSkin = makeVillagerSkinTexture(renderer);
    textureList.push(villagerFabric, villagerSkin);
    const villagerRobeMaterial = new THREE.MeshLambertMaterial({
      map: villagerFabric,
      color: 0xffffff,
    });
    const villagerSkinMaterial = new THREE.MeshLambertMaterial({
      map: villagerSkin,
      color: 0xffffff,
    });
    const villagerNoseMaterial = new THREE.MeshLambertMaterial({ color: 0xa96850 });
    const villagerBeltMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3826 });
    const villagerBuckleMaterial = new THREE.MeshLambertMaterial({ color: 0xd6ad5c });
    const villagerApronMaterial = new THREE.MeshLambertMaterial({ color: 0xb78557 });
    const banditCoatMaterial = new THREE.MeshLambertMaterial({ color: 0x54243b });
    const banditLeatherMaterial = new THREE.MeshLambertMaterial({ color: 0x70402a });
    const banditArmorMaterial = new THREE.MeshLambertMaterial({ color: 0x27364f });
    const banditTrimMaterial = new THREE.MeshLambertMaterial({ color: 0xd19a45 });
    const banditScarfMaterial = new THREE.MeshLambertMaterial({ color: 0xb93552 });
    const banditSkinMaterial = new THREE.MeshLambertMaterial({ color: 0xc98767 });
    const banditMaskMaterial = new THREE.MeshLambertMaterial({ color: 0x202238 });
    const banditBootMaterial = new THREE.MeshLambertMaterial({ color: 0x241b2a });
    const banditEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const banditMetalMaterial = new THREE.MeshLambertMaterial({ color: 0xbcc9d6 });
    const banditGunStockMaterial = new THREE.MeshLambertMaterial({
      color: 0x6d452e,
    });
    const banditGunAccentMaterial = new THREE.MeshLambertMaterial({
      color: 0x364353,
    });
    const banditFlashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd45b,
    });
    const animalNPCs: AnimalNPC[] = [];
    const banditNPCs: BanditNPC[] = [];
    const villagerNPCs: VillagerNPC[] = [];
    let worldSpawnSequence = 0;
    const uniformWorldPoint = (margin = 8) => {
      // Low-discrepancy sampling covers the whole map instead of clustering
      // every new creature around the player.
      const index = worldSpawnSequence++;
      const xRatio = (index * 0.61803398875) % 1;
      const zRatio = (index * 0.41421356237 + 0.23) % 1;
      const span = WORLD_SIZE - margin * 2;
      return {
        x: Math.round(WORLD_MIN + margin + xRatio * span),
        z: Math.round(WORLD_MIN + margin + zRatio * span),
      };
    };

    const animalGroundAt = (x: number, z: number, currentGround: number) => {
      const blockX = Math.round(x);
      const blockZ = Math.round(z);
      if (
        blockX <= WORLD_MIN + 1 ||
        blockX >= WORLD_MAX - 1 ||
        blockZ <= WORLD_MIN + 1 ||
        blockZ >= WORLD_MAX - 1
      )
        return null;

      const currentBlockY = Math.round(currentGround - 0.5);
      for (
        let y = Math.min(30, currentBlockY + 1);
        y >= Math.max(0, currentBlockY - 2);
        y -= 1
      ) {
        const groundKind = world.get(blockKey(blockX, y, blockZ));
        if (
          !groundKind ||
          groundKind === "water" ||
          groundKind === "leaves" ||
          groundKind === "wood"
        )
          continue;
        const spaceAbove = world.get(blockKey(blockX, y + 1, blockZ));
        const headSpace = world.get(blockKey(blockX, y + 2, blockZ));
        if (spaceAbove || headSpace) return null;
        return y + 0.5;
      }
      return null;
    };

    const makeVillager = (name: string, x: number, z: number, seed: number) => {
      const group = new THREE.Group();
      addBox(group, villagerRobeMaterial, [0.72, 1.08, 0.5], [0, 0.92, 0]);
      addBox(group, villagerApronMaterial, [0.47, 0.55, 0.05], [0, 0.88, -0.28]);
      addBox(group, villagerBeltMaterial, [0.76, 0.1, 0.54], [0, 1.07, 0]);
      addBox(group, villagerBuckleMaterial, [0.12, 0.12, 0.04], [0, 1.07, -0.29]);
      addBox(group, villagerSkinMaterial, [0.58, 0.58, 0.58], [0, 1.82, 0]);
      addBox(group, villagerNoseMaterial, [0.16, 0.22, 0.18], [0, 1.76, -0.34]);
      addBox(group, eyeMaterial, [0.07, 0.07, 0.04], [-0.13, 1.9, -0.3]);
      addBox(group, eyeMaterial, [0.07, 0.07, 0.04], [0.13, 1.9, -0.3]);
      addBox(group, villagerRobeMaterial, [0.22, 0.72, 0.22], [-0.2, 0.38, 0]);
      addBox(group, villagerRobeMaterial, [0.22, 0.72, 0.22], [0.2, 0.38, 0]);
      const ground =
        animalGroundAt(x, z, surfaceCenter(x, z) + 0.5) ??
        surfaceCenter(x, z) + 0.5;
      group.position.set(x, ground, z);
      group.rotation.y = Math.PI;
      scene.add(group);
      const id = `villager-${name}`;
      const dead = defeatedAnimals.has(id);
      group.visible = !dead;
      villagerNPCs.push({
        id,
        name,
        group,
        home: { x, z },
        target: { x, z },
        seed,
        wanderStep: 0,
        stateTimer: 0.7 + (seed % 5) * 0.2,
        health: dead ? 0 : 6,
        maxHealth: 6,
        hurtTimer: 0,
        deathTimer: 0,
        dead,
      });
    };

    const makeAnimal = (
      id: string,
      kind: AnimalKind,
      x: number,
      z: number,
      scale: number,
      seed: number,
      persistent = true,
    ) => {
      const group = new THREE.Group();
      const legs: THREE.Mesh[] = [];
      let body: THREE.Mesh;
      let head: THREE.Mesh;

      if (kind === "sheep") {
        body = addBox(group, sheepWool, [1.62, 0.92, 0.9], [0, 1.08, 0]);
        addBox(group, sheepWool, [0.48, 0.34, 0.94], [-0.5, 1.63, 0]);
        addBox(group, sheepWool, [0.56, 0.37, 0.95], [0.03, 1.65, 0]);
        addBox(group, sheepWool, [0.44, 0.31, 0.93], [0.53, 1.59, 0]);
        head = addBox(group, sheepFace, [0.68, 0.72, 0.68], [1.04, 1.15, 0]);
        addBox(group, sheepWool, [0.56, 0.28, 0.72], [0.9, 1.52, 0]);
        addBox(group, sheepFace, [0.22, 0.18, 0.28], [1.03, 1.38, -0.43]);
        addBox(group, sheepFace, [0.22, 0.18, 0.28], [1.03, 1.38, 0.43]);
        for (const [lx, lz] of [
          [-0.5, -0.27],
          [-0.5, 0.27],
          [0.5, -0.27],
          [0.5, 0.27],
        ]) {
          const leg = addBox(group, sheepLeg, [0.2, 0.66, 0.2], [lx, 0.42, lz]);
          legs.push(leg);
          addBox(leg, hoofMaterial, [0.22, 0.18, 0.22], [0.03, -0.31, 0]);
        }
        addBox(group, eyeMaterial, [0.09, 0.11, 0.1], [1.39, 1.25, -0.21]);
        addBox(group, eyeMaterial, [0.09, 0.11, 0.1], [1.39, 1.25, 0.21]);
      } else if (kind === "pig") {
        body = addBox(group, pigSkin, [1.58, 0.82, 0.86], [0, 1, 0]);
        head = addBox(group, pigSkin, [0.76, 0.74, 0.72], [1.02, 1.05, 0]);
        addBox(group, pigSnout, [0.27, 0.34, 0.48], [1.53, 0.98, 0]);
        addBox(group, pigSkin, [0.22, 0.24, 0.2], [0.98, 1.53, -0.23]);
        addBox(group, pigSkin, [0.22, 0.24, 0.2], [0.98, 1.53, 0.23]);
        addBox(group, pigSkin, [0.18, 0.18, 0.18], [-0.9, 1.22, 0]);
        for (const [lx, lz] of [
          [-0.5, -0.27],
          [-0.5, 0.27],
          [0.5, -0.27],
          [0.5, 0.27],
        ]) {
          const leg = addBox(group, pigSkin, [0.2, 0.62, 0.2], [lx, 0.39, lz]);
          legs.push(leg);
          addBox(leg, hoofMaterial, [0.21, 0.14, 0.21], [0.03, -0.29, 0]);
        }
        addBox(group, eyeMaterial, [0.09, 0.1, 0.09], [1.4, 1.19, -0.22]);
        addBox(group, eyeMaterial, [0.09, 0.1, 0.09], [1.4, 1.19, 0.22]);
        addBox(group, nostrilMaterial, [0.05, 0.09, 0.08], [1.68, 1, -0.13]);
        addBox(group, nostrilMaterial, [0.05, 0.09, 0.08], [1.68, 1, 0.13]);
      } else {
        body = addBox(group, cowHide, [1.75, 1, 0.92], [0, 1.14, 0]);
        addBox(group, cowPatch, [0.58, 0.72, 0.95], [-0.34, 1.18, 0]);
        addBox(group, cowPatch, [0.36, 0.42, 0.96], [0.55, 1.35, 0]);
        head = addBox(group, cowFace, [0.76, 0.82, 0.76], [1.13, 1.16, 0]);
        addBox(group, cowMuzzle, [0.3, 0.36, 0.56], [1.62, 0.99, 0]);
        addBox(group, cowFace, [0.25, 0.18, 0.3], [1.08, 1.51, -0.48]);
        addBox(group, cowFace, [0.25, 0.18, 0.3], [1.08, 1.51, 0.48]);
        addBox(group, hornMaterial, [0.3, 0.16, 0.14], [1.16, 1.67, -0.37]);
        addBox(group, hornMaterial, [0.3, 0.16, 0.14], [1.16, 1.67, 0.37]);
        for (const [lx, lz] of [
          [-0.56, -0.28],
          [-0.56, 0.28],
          [0.56, -0.28],
          [0.56, 0.28],
        ]) {
          const leg = addBox(
            group,
            cowPatch,
            [0.22, 0.78, 0.22],
            [lx, 0.45, lz],
          );
          legs.push(leg);
          addBox(leg, hoofMaterial, [0.24, 0.18, 0.24], [0.03, -0.37, 0]);
        }
        addBox(group, eyeMaterial, [0.09, 0.11, 0.1], [1.52, 1.29, -0.23]);
        addBox(group, eyeMaterial, [0.09, 0.11, 0.1], [1.52, 1.29, 0.23]);
        addBox(group, nostrilMaterial, [0.06, 0.08, 0.08], [1.79, 1, -0.15]);
        addBox(group, nostrilMaterial, [0.06, 0.08, 0.08], [1.79, 1, 0.15]);
      }

      const ground = surfaceCenter(x, z) + 0.5;
      group.position.set(x, ground, z);
      group.scale.setScalar(scale);
      group.rotation.y = (seed % 12) * 0.32;
      scene.add(group);
      // A modest durability increase keeps animals from being defeated by a
      // single weak hit, while preserving their distinct toughness.
      const maxHealth = kind === "cow" ? 6 : kind === "pig" ? 5 : 4;
      const dead = defeatedAnimals.has(id);
      group.visible = !dead;
      const npc: AnimalNPC = {
        id,
        kind,
        group,
        body,
        head,
        legs,
        target: new THREE.Vector3(x, ground, z),
        speed: kind === "pig" ? 1.12 : kind === "sheep" ? 0.92 : 0.76,
        stateTimer: 0.45 + (seed % 4) * 0.35,
        walking: false,
        seed,
        phase: (seed % 17) * 0.37,
        baseBodyY: body.position.y,
        baseHeadY: head.position.y,
        baseScale: scale,
        health: maxHealth,
        maxHealth,
        hurtTimer: 0,
        soundTimer: 5 + (seed % 11) * 0.6,
        deathTimer: 0,
        dead,
        persistent,
      };
      animalNPCs.push(npc);
      return npc;
    };

    const makeBandit = (
      id: string,
      weapon: BanditWeapon,
      kind: BanditKind,
      x: number,
      z: number,
      seed: number,
    ) => {
      const group = new THREE.Group();
      const legs: THREE.Mesh[] = [];
      const body = addBox(group, banditCoatMaterial, [0.74, 1.02, 0.5], [0, 1.14, 0]);
      addBox(group, banditArmorMaterial, [0.58, 0.52, 0.08], [0, 1.22, -0.28]);
      addBox(group, banditTrimMaterial, [0.42, 0.07, 0.05], [0, 1.43, -0.33]);
      addBox(group, banditLeatherMaterial, [0.82, 0.16, 0.54], [0, 0.77, 0]);
      addBox(group, banditTrimMaterial, [0.16, 0.18, 0.06], [0, 0.78, -0.31]);
      addBox(group, banditLeatherMaterial, [0.2, 0.3, 0.22], [-0.47, 0.82, -0.08]);
      addBox(group, banditLeatherMaterial, [0.2, 0.3, 0.22], [0.47, 0.82, -0.08]);
      const head = addBox(group, banditSkinMaterial, [0.56, 0.6, 0.54], [0, 1.94, 0]);
      addBox(group, banditMaskMaterial, [0.62, 0.2, 0.1], [0, 1.84, -0.3]);
      addBox(group, banditScarfMaterial, [0.66, 0.18, 0.08], [0, 1.68, -0.29]);
      addBox(group, banditMaskMaterial, [0.72, 0.18, 0.62], [0, 2.25, 0]);
      addBox(group, banditTrimMaterial, [0.82, 0.1, 0.7], [0, 2.12, -0.02]);
      addBox(group, banditScarfMaterial, [0.72, 0.09, 0.58], [0, 2.06, -0.02]);
      addBox(group, banditEyeMaterial, [0.08, 0.08, 0.04], [-0.15, 1.99, -0.35]);
      addBox(group, banditEyeMaterial, [0.08, 0.08, 0.04], [0.15, 1.99, -0.35]);
      for (const legX of [-0.2, 0.2]) {
        const leg = addBox(group, banditMaskMaterial, [0.22, 0.76, 0.24], [legX, 0.38, 0]);
        legs.push(leg);
        addBox(leg, banditBootMaterial, [0.25, 0.2, 0.3], [0, -0.31, -0.05]);
      }
      addBox(group, banditArmorMaterial, [0.3, 0.22, 0.28], [-0.47, 1.49, 0]);
      addBox(group, banditArmorMaterial, [0.3, 0.22, 0.28], [0.47, 1.49, 0]);
      if (kind === "armored") {
        addBox(group, banditMetalMaterial, [0.9, 0.72, 0.18], [0, 1.2, -0.34]);
        addBox(group, banditGunAccentMaterial, [0.78, 0.11, 0.08], [0, 1.47, -0.46]);
        addBox(group, banditMetalMaterial, [0.78, 0.28, 0.68], [0, 2.2, 0]);
        addBox(group, banditGunAccentMaterial, [0.84, 0.1, 0.72], [0, 2.34, 0]);
        addBox(group, banditMetalMaterial, [0.38, 0.22, 0.32], [-0.54, 1.5, 0]);
        addBox(group, banditMetalMaterial, [0.38, 0.22, 0.32], [0.54, 1.5, 0]);
      }
      const arm = addBox(group, banditCoatMaterial, [0.2, 0.68, 0.2], [0.47, 1.17, -0.02]);
      arm.rotation.z = -0.3;
      const weaponGroup = new THREE.Group();
      weaponGroup.position.set(0, 1.3, -0.32);
      group.add(weaponGroup);
      let muzzleFlash: THREE.Mesh | null = null;
      if (weapon === "sword") {
        weaponGroup.rotation.z = -0.62;
        weaponGroup.position.set(0.63, 1.26, -0.08);
        addBox(weaponGroup, banditLeatherMaterial, [0.13, 0.24, 0.16], [0, 0, 0]);
        addBox(weaponGroup, banditMetalMaterial, [0.13, 0.84, 0.1], [0.12, 0.38, 0]);
        addBox(weaponGroup, banditMetalMaterial, [0.38, 0.1, 0.12], [0.03, 0.07, 0]);
      } else {
        // The rifle is held across the chest and points along the character's
        // forward (-Z) direction, rather than floating beside one arm.
        arm.rotation.z = -0.72;
        arm.rotation.x = -0.2;
        const supportArm = addBox(
          group,
          banditCoatMaterial,
          [0.2, 0.68, 0.2],
          [-0.47, 1.17, -0.02],
        );
        supportArm.rotation.z = 0.72;
        supportArm.rotation.x = -0.2;
        addBox(group, banditLeatherMaterial, [0.18, 0.18, 0.18], [0.24, 1.28, -0.52]);
        addBox(group, banditLeatherMaterial, [0.18, 0.18, 0.18], [-0.24, 1.28, -0.52]);
        // Stock, receiver, handguard and barrel form a readable pixel rifle.
        addBox(weaponGroup, banditGunStockMaterial, [0.24, 0.22, 0.48], [0, 0, 0.2]);
        addBox(weaponGroup, banditMetalMaterial, [0.3, 0.24, 0.42], [0, 0, -0.18]);
        addBox(weaponGroup, banditGunStockMaterial, [0.38, 0.2, 0.28], [0, 0, -0.48]);
        addBox(weaponGroup, banditGunAccentMaterial, [0.12, 0.12, 0.75], [0, 0.01, -0.92]);
        addBox(weaponGroup, banditMetalMaterial, [0.2, 0.12, 0.12], [0, 0.01, -1.28]);
        addBox(weaponGroup, banditGunAccentMaterial, [0.12, 0.12, 0.3], [0, 0.2, -0.2]);
        addBox(weaponGroup, banditMetalMaterial, [0.08, 0.18, 0.12], [0, -0.2, -0.2]);
        addBox(weaponGroup, banditGunAccentMaterial, [0.2, 0.08, 0.2], [0, -0.16, 0.02]);
        muzzleFlash = addBox(weaponGroup, banditFlashMaterial, [0.22, 0.22, 0.22], [0, 0.01, -1.43]);
        muzzleFlash.visible = false;
      }

      const ground = surfaceCenter(x, z) + 0.5;
      group.position.set(x, ground, z);
      group.scale.setScalar(kind === "armored" ? 1.12 : 1);
      group.rotation.y = (seed % 12) * 0.32;
      scene.add(group);
      const npc: BanditNPC = {
        id,
        weapon,
        kind,
        group,
        body,
        head,
        legs,
        muzzleFlash,
        baseBodyY: body.position.y,
        baseHeadY: head.position.y,
        baseScale: kind === "armored" ? 1.12 : 1,
        health: kind === "armored" ? (weapon === "rifle" ? 22 : 20) : weapon === "rifle" ? 10 : 8,
        maxHealth: kind === "armored" ? (weapon === "rifle" ? 22 : 20) : weapon === "rifle" ? 10 : 8,
        hurtTimer: 0,
        deathTimer: 0,
        attackCooldown: 0.8 + (seed % 7) * 0.08,
        muzzleFlashTimer: 0,
        seed,
        dead: false,
      };
      banditNPCs.push(npc);
      return npc;
    };

    villageVillagerSpawns.forEach((villager, index) =>
      makeVillager(villager.name, villager.x, villager.z, 731 + index * 97),
    );
    outpostBanditSpawns.forEach((spawn, index) =>
      makeBandit(
        `outpost-guard-${index}`,
        index % 2 === 0 ? "rifle" : "sword",
        "armored",
        spawn.x,
        spawn.z,
        spawn.seed,
      ),
    );
    const starterAnimalPoints = [
      uniformWorldPoint(26),
      uniformWorldPoint(26),
      uniformWorldPoint(26),
    ];
    makeAnimal("sheep-1", "sheep", starterAnimalPoints[0].x, starterAnimalPoints[0].z, 1, 9183);
    makeAnimal("pig-1", "pig", starterAnimalPoints[1].x, starterAnimalPoints[1].z, 0.9, 4197);
    makeAnimal("cow-1", "cow", starterAnimalPoints[2].x, starterAnimalPoints[2].z, 1.06, 7301);
    callbacksRef.current.onAnimalPopulation(
      animalNPCs.filter((animal) => !animal.dead).length,
    );

    const npcRandom = (npc: AnimalNPC) => {
      npc.seed = (npc.seed * 1664525 + 1013904223) >>> 0;
      return npc.seed / 4294967296;
    };

    const chooseAnimalTarget = (npc: AnimalNPC) => {
      for (let attempt = 0; attempt < 14; attempt += 1) {
        const angle = npcRandom(npc) * Math.PI * 2;
        const distance = 3.5 + npcRandom(npc) * 6.5;
        const x = THREE.MathUtils.clamp(
          npc.group.position.x + Math.cos(angle) * distance,
          WORLD_MIN + 2,
          WORLD_MAX - 2,
        );
        const z = THREE.MathUtils.clamp(
          npc.group.position.z + Math.sin(angle) * distance,
          WORLD_MIN + 2,
          WORLD_MAX - 2,
        );
        const ground = animalGroundAt(x, z, npc.group.position.y);
        if (ground === null || Math.abs(ground - npc.group.position.y) > 1.05)
          continue;
        npc.target.set(x, ground, z);
        npc.walking = true;
        npc.stateTimer = 4.5 + npcRandom(npc) * 5;
        return;
      }
      npc.walking = false;
      npc.stateTimer = 1 + npcRandom(npc) * 1.8;
    };

    const updateAnimalNPC = (
      npc: AnimalNPC,
      delta: number,
      elapsed: number,
    ) => {
      if (npc.dead) {
        if (npc.deathTimer <= 0) return;
        npc.deathTimer -= delta;
        npc.group.rotation.z = THREE.MathUtils.lerp(
          npc.group.rotation.z,
          -Math.PI * 0.48,
          Math.min(1, delta * 10),
        );
        const deathScale = Math.max(0.05, npc.deathTimer / 0.48);
        npc.group.scale.setScalar(npc.baseScale * deathScale);
        if (npc.deathTimer <= 0) npc.group.visible = false;
        return;
      }
      npc.soundTimer -= delta;
      if (
        npc.soundTimer <= 0 &&
        activeRef.current &&
        npc.group.position.distanceTo(camera.position) < 13
      ) {
        playSound(npc.kind);
        npc.soundTimer = 8 + ((npc.seed + Math.floor(elapsed)) % 7) * 0.7;
      }
      if (npc.hurtTimer > 0) {
        npc.hurtTimer -= delta;
        const pulse = 1 + Math.sin(npc.hurtTimer * 48) * 0.06;
        npc.group.scale.setScalar(npc.baseScale * pulse);
      } else npc.group.scale.setScalar(npc.baseScale);
      npc.stateTimer -= delta;
      if (!npc.walking) {
        if (npc.stateTimer <= 0) chooseAnimalTarget(npc);
        npc.legs.forEach((leg) => {
          leg.rotation.z = THREE.MathUtils.lerp(leg.rotation.z, 0, delta * 7);
        });
        npc.head.rotation.y = THREE.MathUtils.lerp(
          npc.head.rotation.y,
          0,
          delta * 7,
        );
        npc.body.position.y =
          npc.baseBodyY + Math.sin(elapsed * 1.4 + npc.phase) * 0.012;
        npc.head.position.y = npc.baseHeadY;
        return;
      }

      const dx = npc.target.x - npc.group.position.x;
      const dz = npc.target.z - npc.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.28 || npc.stateTimer <= 0) {
        npc.walking = false;
        npc.stateTimer = 0.8 + npcRandom(npc) * 2.3;
        return;
      }

      const dirX = dx / distance;
      const dirZ = dz / distance;
      const nextX = npc.group.position.x + dirX * npc.speed * delta;
      const nextZ = npc.group.position.z + dirZ * npc.speed * delta;
      const nextGround = animalGroundAt(nextX, nextZ, npc.group.position.y);
      if (
        nextGround === null ||
        Math.abs(nextGround - npc.group.position.y) > 1.05
      ) {
        npc.walking = false;
        npc.stateTimer = 0.18;
        return;
      }

      const tooClose = animalNPCs.some((other) => {
        if (other === npc) return false;
        const currentDistance = other.group.position.distanceToSquared(
          npc.group.position,
        );
        const nextDistance =
          (other.group.position.x - nextX) ** 2 +
          (other.group.position.y - nextGround) ** 2 +
          (other.group.position.z - nextZ) ** 2;
        return currentDistance < 1.5 && nextDistance < currentDistance;
      });
      if (tooClose) {
        npc.walking = false;
        npc.stateTimer = 0.35 + npcRandom(npc) * 0.5;
        return;
      }

      npc.group.position.x = nextX;
      npc.group.position.z = nextZ;
      npc.group.position.y = THREE.MathUtils.lerp(
        npc.group.position.y,
        nextGround,
        Math.min(1, delta * 10),
      );
      const targetRotation = Math.atan2(-dirZ, dirX);
      const rotationDelta = Math.atan2(
        Math.sin(targetRotation - npc.group.rotation.y),
        Math.cos(targetRotation - npc.group.rotation.y),
      );
      npc.group.rotation.y += rotationDelta * Math.min(1, delta * 6);

      const stride =
        Math.sin(elapsed * (7.5 + npc.speed * 2) + npc.phase) * 0.5;
      npc.legs.forEach((leg, index) => {
        leg.rotation.z = stride * (index === 0 || index === 3 ? 1 : -1);
      });
      const bob = Math.abs(Math.sin(elapsed * 8 + npc.phase)) * 0.035;
      npc.body.position.y = npc.baseBodyY + bob;
      npc.head.position.y = npc.baseHeadY + bob * 0.65;
      npc.head.rotation.y = THREE.MathUtils.lerp(
        npc.head.rotation.y,
        0,
        delta * 8,
      );
    };

    const hasBanditLineOfSight = (npc: BanditNPC) => {
      const start = new THREE.Vector3(
        npc.group.position.x,
        npc.group.position.y + 1.35,
        npc.group.position.z,
      );
      const end = camera.position;
      const distance = start.distanceTo(end);
      const steps = Math.ceil(distance * 4);
      for (let step = 1; step < steps; step += 1) {
        const point = start.clone().lerp(end, step / steps);
        const kind = world.get(
          blockKey(Math.round(point.x), Math.round(point.y), Math.round(point.z)),
        );
        // Water is transparent enough for the simplified combat model;
        // every solid/opaque block, including leaves and glass, is cover.
        if (kind && kind !== "water") return false;
      }
      return true;
    };

    const updateBanditNPC = (
      npc: BanditNPC,
      delta: number,
      elapsed: number,
    ) => {
      if (npc.dead) {
        if (npc.deathTimer <= 0) return;
        npc.deathTimer -= delta;
        npc.group.rotation.z = THREE.MathUtils.lerp(
          npc.group.rotation.z,
          -Math.PI * 0.48,
          Math.min(1, delta * 9),
        );
        npc.group.scale.setScalar(
          npc.baseScale * Math.max(0.05, npc.deathTimer / 0.55),
        );
        if (npc.deathTimer <= 0) npc.group.visible = false;
        return;
      }

      npc.attackCooldown = Math.max(0, npc.attackCooldown - delta);
      npc.hurtTimer = Math.max(0, npc.hurtTimer - delta);
      npc.muzzleFlashTimer = Math.max(0, npc.muzzleFlashTimer - delta);
      if (npc.muzzleFlash)
        npc.muzzleFlash.visible = npc.muzzleFlashTimer > 0;
      const pulse = npc.hurtTimer > 0 ? 1.08 : 1;
      npc.group.scale.setScalar(npc.baseScale * pulse);

      const dx = camera.position.x - npc.group.position.x;
      const dz = camera.position.z - npc.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 22) return;
      const dirX = dx / Math.max(distance, 0.001);
      const dirZ = dz / Math.max(distance, 0.001);
      const targetRotation = Math.atan2(-dirZ, dirX);
      const rotationDelta = Math.atan2(
        Math.sin(targetRotation - npc.group.rotation.y),
        Math.cos(targetRotation - npc.group.rotation.y),
      );
      npc.group.rotation.y += rotationDelta * Math.min(1, delta * 7);

      const preferredDistance = npc.weapon === "sword" ? 1.35 : 7.2;
      const shouldAdvance = distance > preferredDistance + 0.35;
      const shouldRetreat = npc.weapon === "rifle" && distance < 4.2;
      if (shouldAdvance || shouldRetreat) {
        const motion = shouldRetreat ? -1 : 1;
        const speed = (npc.weapon === "sword" ? 2.45 : 1.85) * (npc.kind === "armored" ? 0.82 : 1);
        const nextX = npc.group.position.x + dirX * speed * delta * motion;
        const nextZ = npc.group.position.z + dirZ * speed * delta * motion;
        const nextGround = animalGroundAt(nextX, nextZ, npc.group.position.y);
        if (
          nextGround !== null &&
          Math.abs(nextGround - npc.group.position.y) <= 1.05
        ) {
          npc.group.position.x = nextX;
          npc.group.position.z = nextZ;
          npc.group.position.y = THREE.MathUtils.lerp(
            npc.group.position.y,
            nextGround,
            Math.min(1, delta * 10),
          );
        }
      }

      if (!hasBanditLineOfSight(npc)) return;

      const stride = Math.sin(elapsed * 9 + npc.seed) * 0.48;
      npc.legs.forEach((leg, index) => {
        leg.rotation.z = stride * (index === 0 ? 1 : -1);
      });
      const bob = Math.abs(Math.sin(elapsed * 9 + npc.seed)) * 0.028;
      npc.body.position.y = npc.baseBodyY + bob;
      npc.head.position.y = npc.baseHeadY + bob;

      const canStrike =
        npc.weapon === "sword" ? distance < 1.8 : distance < 11.5;
      if (!canStrike || npc.attackCooldown > 0) return;
      npc.attackCooldown = npc.weapon === "sword" ? 0.95 : 1.4;
      if (npc.weapon === "rifle") npc.muzzleFlashTimer = 0.16;
      const damage =
        npc.kind === "armored"
          ? npc.weapon === "sword"
            ? 6
            : 5
          : npc.weapon === "sword"
            ? 4
            : 3;
      playSound("hurt");
      callbacksRef.current.onDamage(damage, "bandit");
      callbacksRef.current.onMessage(
        `${npc.kind === "armored" ? "重甲劫匪" : "普通劫匪"}${npc.weapon === "sword" ? "重劈" : "开火"}命中！ · -${damage} 生命`,
      );
    };

    const chooseVillagerTarget = (npc: VillagerNPC) => {
      npc.wanderStep += 1;
      const angle = (npc.seed * 0.71 + npc.wanderStep * 2.39) % (Math.PI * 2);
      const radius = 1.5 + ((npc.seed + npc.wanderStep * 3) % 5) * 0.8;
      npc.target.x = npc.home.x + Math.cos(angle) * radius;
      npc.target.z = npc.home.z + Math.sin(angle) * radius;
      npc.stateTimer = 2.2 + ((npc.seed + npc.wanderStep) % 4) * 0.5;
    };

    const updateVillagerNPC = (npc: VillagerNPC, delta: number, elapsed: number) => {
      if (npc.dead) {
        if (npc.deathTimer <= 0) return;
        npc.deathTimer -= delta;
        npc.group.rotation.z = THREE.MathUtils.lerp(
          npc.group.rotation.z,
          -Math.PI * 0.46,
          Math.min(1, delta * 9),
        );
        npc.group.scale.setScalar(Math.max(0.05, npc.deathTimer / 0.52));
        if (npc.deathTimer <= 0) npc.group.visible = false;
        return;
      }
      npc.hurtTimer = Math.max(0, npc.hurtTimer - delta);
      npc.group.scale.setScalar(npc.hurtTimer > 0 ? 1.07 : 1);
      npc.stateTimer -= delta;
      const dx = npc.target.x - npc.group.position.x;
      const dz = npc.target.z - npc.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.25 || npc.stateTimer <= 0) {
        chooseVillagerTarget(npc);
        return;
      }
      const dirX = dx / distance;
      const dirZ = dz / distance;
      const nextX = npc.group.position.x + dirX * 1.15 * delta;
      const nextZ = npc.group.position.z + dirZ * 1.15 * delta;
      const ground = animalGroundAt(nextX, nextZ, npc.group.position.y);
      if (ground === null || Math.abs(ground - npc.group.position.y) > 1.05) {
        npc.stateTimer = 0;
        return;
      }
      npc.group.position.x = nextX;
      npc.group.position.z = nextZ;
      npc.group.position.y = THREE.MathUtils.lerp(
        npc.group.position.y,
        ground,
        Math.min(1, delta * 10),
      );
      const targetRotation = Math.atan2(-dirZ, dirX);
      const rotationDelta = Math.atan2(
        Math.sin(targetRotation - npc.group.rotation.y),
        Math.cos(targetRotation - npc.group.rotation.y),
      );
      npc.group.rotation.y += rotationDelta * Math.min(1, delta * 6);
      npc.group.position.y += Math.abs(Math.sin(elapsed * 8 + npc.seed)) * 0.008;
    };

    type LootEntity = {
      record: LootRecord;
      group: THREE.Group;
      baseY: number;
      phase: number;
      active: boolean;
    };
    const woolDropMaterial = new THREE.MeshLambertMaterial({
      map: texture("#e8e4d8", ["#ffffff", "#c8c1b2", "#aaa395"], 244),
    });
    const porkDropMaterial = new THREE.MeshLambertMaterial({
      map: texture("#d96f75", ["#f4a0a0", "#a94450", "#f3c2b9"], 245),
    });
    const beefDropMaterial = new THREE.MeshLambertMaterial({
      map: texture("#a9433e", ["#db7165", "#762c2d", "#e4a38c"], 246),
    });
    const leatherDropMaterial = new THREE.MeshLambertMaterial({
      map: texture("#8b552e", ["#b77c46", "#5e371f", "#d09a5b"], 247),
    });
    const flowerDropMaterials: Record<
      "poppy" | "dandelion" | "oxeyeDaisy" | "allium",
      THREE.Material
    > = {
      poppy: new THREE.MeshLambertMaterial({ color: 0xe64a32 }),
      dandelion: new THREE.MeshLambertMaterial({ color: 0xf6d34a }),
      oxeyeDaisy: new THREE.MeshLambertMaterial({ color: 0xf4eee3 }),
      allium: new THREE.MeshLambertMaterial({ color: 0xd964a1 }),
    };
    const lootStemMaterial = new THREE.MeshLambertMaterial({ color: 0x3f7c31 });
    const honeycombMaterial = new THREE.MeshLambertMaterial({
      color: 0xe7a72b,
    });
    const honeycombDarkMaterial = new THREE.MeshLambertMaterial({
      color: 0x6d4518,
    });
    const lootEntities: LootEntity[] = [];

    const spawnLootEntity = (record: LootRecord) => {
      const group = new THREE.Group();
      const material =
        record.kind === "wool"
          ? woolDropMaterial
          : record.kind === "rawPork"
            ? porkDropMaterial
            : record.kind === "rawBeef"
              ? beefDropMaterial
              : record.kind === "leather"
                ? leatherDropMaterial
                : record.kind === "honeycomb"
                  ? honeycombMaterial
                  : flowerDropMaterials[
                      record.kind as keyof typeof flowerDropMaterials
                    ];
      if (record.kind === "wool") {
        addBox(group, material, [0.46, 0.42, 0.46], [0, 0, 0]);
        addBox(group, material, [0.27, 0.24, 0.27], [0.25, 0.18, 0.12]);
      } else if (record.kind === "leather") {
        const hide = addBox(group, material, [0.48, 0.08, 0.38], [0, 0, 0]);
        hide.rotation.z = 0.18;
        addBox(group, material, [0.17, 0.08, 0.18], [-0.25, 0.05, 0.18]);
      } else if (
        record.kind === "poppy" ||
        record.kind === "dandelion" ||
        record.kind === "oxeyeDaisy" ||
        record.kind === "allium"
      ) {
        addBox(group, lootStemMaterial, [0.08, 0.48, 0.08], [0, 0, 0]);
        addBox(group, material, [0.34, 0.2, 0.34], [0, 0.3, 0]);
      } else if (record.kind === "honeycomb") {
        addBox(group, material, [0.5, 0.12, 0.42], [0, 0, 0]);
        addBox(
          group,
          honeycombDarkMaterial,
          [0.12, 0.14, 0.1],
          [-0.14, 0.01, 0],
        );
        addBox(
          group,
          honeycombDarkMaterial,
          [0.12, 0.14, 0.1],
          [0.14, 0.01, 0],
        );
      } else {
        addBox(group, material, [0.46, 0.2, 0.34], [0, 0, 0]);
        addBox(group, material, [0.2, 0.16, 0.18], [0.25, 0.03, 0]);
      }
      group.position.set(record.x, record.y, record.z);
      group.scale.setScalar(0.82);
      scene.add(group);
      lootEntities.push({
        record,
        group,
        baseY: record.y,
        phase: record.id.length * 0.73,
        active: true,
      });
    };
    lootDropRecords.forEach((record) => spawnLootEntity(record));

    const bee = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: 0xe6ad21 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x272017 });
    const wing = new THREE.MeshLambertMaterial({
      color: 0xdff5ef,
      transparent: true,
      opacity: 0.78,
    });
    addBox(bee, yellow, [0.62, 0.42, 0.42], [0, 0, 0]);
    addBox(bee, dark, [0.14, 0.44, 0.44], [-0.12, 0, 0]);
    addBox(bee, wing, [0.32, 0.08, 0.5], [-0.08, 0.29, 0]);
    // Keep the friendly bee at the player's spawn point so every new world
    // starts with a predictable bee encounter instead of a random location.
    const beeHome = {
      x: 5,
      z: 17,
      y: surfaceCenter(5, 17) + 4.2,
    };
    bee.position.set(beeHome.x, beeHome.y, beeHome.z);
    const beeId = "bee-main";
    let beeHealth = defeatedAnimals.has(beeId) ? 0 : 3;
    let beeHurtTimer = 0;
    let beeAggroTimer = 0;
    let beeStingCooldown = 0;
    let beeSpeechTimer = 0;
    bee.visible = beeHealth > 0;
    scene.add(bee);

    // A small swarm makes the meadow feel alive. The original bee remains the
    // interactive quest bee; its companions use the same 3D model and orbit
    // nearby flowers without multiplying combat or reward interactions.
    type BeeCompanion = {
      group: THREE.Group;
      home: { x: number; y: number; z: number };
      phase: number;
    };
    const beeCompanions: BeeCompanion[] = [];
    const makeBeeCompanion = (x: number, z: number, phase: number) => {
      const companion = new THREE.Group();
      addBox(companion, yellow, [0.5, 0.34, 0.34], [0, 0, 0]);
      addBox(companion, dark, [0.12, 0.36, 0.36], [-0.1, 0, 0]);
      addBox(companion, wing, [0.28, 0.06, 0.42], [-0.06, 0.22, 0]);
      const home = { x, z, y: surfaceCenter(x, z) + 3.1 };
      companion.position.set(home.x, home.y, home.z);
      companion.scale.setScalar(0.82);
      scene.add(companion);
      beeCompanions.push({ group: companion, home, phase });
    };
    makeBeeCompanion(8, 18, 0.4);
    makeBeeCompanion(3, 20, 1.7);
    makeBeeCompanion(9, 14, 3.1);
    makeBeeCompanion(1, 15, 4.5);

    const flowerMaterials = [0xe64a32, 0xf6d34a, 0xf4eee3, 0xd964a1].map(
      (color) => new THREE.MeshLambertMaterial({ color }),
    );
    const flowerCenterMaterials = {
      dark: new THREE.MeshLambertMaterial({ color: 0x542b1e }),
      yellow: new THREE.MeshLambertMaterial({ color: 0xf1b92f }),
      light: new THREE.MeshLambertMaterial({ color: 0xffef9a }),
    };
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x3f7c31 });
    type FlowerKind = "poppy" | "dandelion" | "oxeyeDaisy" | "allium";
    type FlowerEntity = {
      id: string;
      kind: FlowerKind;
      group: THREE.Group;
      active: boolean;
    };
    const flowerKinds: FlowerKind[] = [
      "poppy",
      "dandelion",
      "oxeyeDaisy",
      "allium",
    ];
    const flowerEntities: FlowerEntity[] = [];
    const flowerPositionKeys = new Set<string>();
    const addFlower = (
      x: number,
      z: number,
      kind: FlowerKind,
      id: string,
    ) => {
      if (defeatedAnimals.has(id)) return false;
      const groundBlockY = surfaceCenter(x, z);
      if (world.get(blockKey(x, groundBlockY, z)) !== "grass") return false;
      if (world.has(blockKey(x, groundBlockY + 1, z))) return false;
      const positionKey = `${x},${z}`;
      if (flowerPositionKeys.has(positionKey)) return false;

      const ground = groundBlockY + 0.5;
      const flower = new THREE.Group();
      const kindIndex = flowerKinds.indexOf(kind);
      const stemHeight = 0.5 + terrainHash(x, z, 149) * 0.14;
      addBox(
        flower,
        stemMaterial,
        [0.07, stemHeight, 0.07],
        [0, stemHeight / 2, 0],
      );

      if (kind === "poppy") {
        addBox(
          flower,
          flowerMaterials[kindIndex],
          [0.42, 0.12, 0.28],
          [0, stemHeight + 0.02, 0],
        );
        addBox(
          flower,
          flowerMaterials[kindIndex],
          [0.28, 0.12, 0.42],
          [0, stemHeight + 0.02, 0],
        );
        addBox(
          flower,
          flowerCenterMaterials.dark,
          [0.12, 0.08, 0.12],
          [0, stemHeight + 0.1, 0],
        );
      } else if (kind === "dandelion") {
        addBox(
          flower,
          flowerMaterials[kindIndex],
          [0.34, 0.2, 0.34],
          [0, stemHeight + 0.02, 0],
        );
        addBox(
          flower,
          flowerCenterMaterials.light,
          [0.16, 0.1, 0.16],
          [0, stemHeight + 0.13, 0],
        );
      } else if (kind === "oxeyeDaisy") {
        addBox(
          flower,
          flowerMaterials[kindIndex],
          [0.5, 0.09, 0.16],
          [0, stemHeight + 0.03, 0],
        );
        addBox(
          flower,
          flowerMaterials[kindIndex],
          [0.16, 0.09, 0.5],
          [0, stemHeight + 0.03, 0],
        );
        addBox(
          flower,
          flowerCenterMaterials.yellow,
          [0.16, 0.12, 0.16],
          [0, stemHeight + 0.1, 0],
        );
      } else {
        const petalMaterial = flowerMaterials[kindIndex];
        addBox(
          flower,
          petalMaterial,
          [0.3, 0.26, 0.3],
          [0, stemHeight + 0.06, 0],
        );
        addBox(
          flower,
          petalMaterial,
          [0.18, 0.2, 0.18],
          [-0.18, stemHeight + 0.04, 0.08],
        );
        addBox(
          flower,
          petalMaterial,
          [0.18, 0.2, 0.18],
          [0.18, stemHeight + 0.08, -0.08],
        );
      }

      flower.rotation.y = terrainHash(x, z, 151) * Math.PI;
      flower.position.set(x, ground, z);
      scene.add(flower);
      flowerPositionKeys.add(positionKey);
      flowerEntities.push({ id, kind, group: flower, active: true });
      return true;
    };

    const landmarkFlowers = [
      [-10, 11],
      [-8, 9],
      [-5, 12],
      [-4, 6],
      [4, 10],
      [6, 7],
      [8, 3],
      [-11, 4],
      [13, 7],
      [-6, 2],
    ] as const;
    landmarkFlowers.forEach(([x, z], index) =>
      addFlower(
        x,
        z,
        flowerKinds[index % flowerKinds.length],
        `flower-${index}`,
      ),
    );

    // A dense, colourful meadow around the starting area makes the vegetation
    // immediately visible without placing plants directly in the player's path.
    for (let x = -7; x <= 17; x += 2) {
      for (let z = 7; z <= 29; z += 2) {
        if (Math.hypot(x - 5, z - 17) < 2.6) continue;
        if (terrainHash(x, z, 157) > 0.34) continue;
        const kindIndex = Math.floor(
          terrainHash(x, z, 163) * flowerKinds.length,
        );
        addFlower(
          x,
          z,
          flowerKinds[kindIndex],
          `meadow-flower-${x}-${z}`,
        );
      }
    }

    // Additional flower clusters are spread throughout plains, forests and
    // highlands. Coordinates are deterministic so harvested flowers stay gone.
    for (let cellX = WORLD_MIN + 3; cellX <= WORLD_MAX - 3; cellX += 4) {
      for (let cellZ = WORLD_MIN + 3; cellZ <= WORLD_MAX - 3; cellZ += 4) {
        const x = cellX + Math.floor(terrainHash(cellX, cellZ, 167) * 3) - 1;
        const z = cellZ + Math.floor(terrainHash(cellX, cellZ, 173) * 3) - 1;
        const profile = terrainProfile(x, z);
        const flowerChance =
          profile.biome === "plains"
            ? 0.045
            : profile.biome === "forest"
              ? 0.024
              : profile.biome === "highlands"
                ? 0.014
                : 0;
        if (terrainHash(x, z, 179) > flowerChance) continue;
        const kindIndex = Math.floor(
          terrainHash(x, z, 181) * flowerKinds.length,
        );
        addFlower(
          x,
          z,
          flowerKinds[kindIndex],
          `wild-flower-${x}-${z}`,
        );
      }
    }

    // Tall grass and fern-like tufts use two instanced crossed blades, keeping
    // Hundreds of plants remain inexpensive to render across the 350×350 world.
    type GrassTuft = {
      x: number;
      y: number;
      z: number;
      rotation: number;
      scale: number;
      color: THREE.Color;
    };
    const grassTufts: GrassTuft[] = [];
    const grassPositionKeys = new Set<string>();
    const addGrassTuft = (x: number, z: number, meadow = false) => {
      const positionKey = `${x},${z}`;
      if (grassPositionKeys.has(positionKey) || flowerPositionKeys.has(positionKey))
        return;
      const groundY = surfaceCenter(x, z);
      if (world.get(blockKey(x, groundY, z)) !== "grass") return;
      if (world.has(blockKey(x, groundY + 1, z))) return;
      const fern = terrainHash(x, z, 191) < (meadow ? 0.14 : 0.24);
      const shade = terrainHash(x, z, 193);
      const color = new THREE.Color(fern ? 0x39742f : 0x579431);
      color.offsetHSL(0, 0.04, (shade - 0.5) * 0.12);
      grassPositionKeys.add(positionKey);
      grassTufts.push({
        x,
        y: groundY + 0.5,
        z,
        rotation: terrainHash(x, z, 197) * Math.PI,
        scale: (0.76 + terrainHash(x, z, 199) * 0.42) * (fern ? 1.18 : 1),
        color,
      });
    };

    for (let x = -9; x <= 19; x += 2) {
      for (let z = 5; z <= 31; z += 2) {
        if (Math.hypot(x - 5, z - 17) < 2.4) continue;
        if (terrainHash(x, z, 211) < 0.5) addGrassTuft(x, z, true);
      }
    }
    for (let cellX = WORLD_MIN + 2; cellX <= WORLD_MAX - 2; cellX += 2) {
      for (let cellZ = WORLD_MIN + 2; cellZ <= WORLD_MAX - 2; cellZ += 2) {
        const profile = terrainProfile(cellX, cellZ);
        const grassChance =
          profile.biome === "plains"
            ? 0.11
            : profile.biome === "forest"
              ? 0.085
              : profile.biome === "highlands"
                ? 0.045
                : 0;
        if (terrainHash(cellX, cellZ, 223) < grassChance)
          addGrassTuft(cellX, cellZ);
      }
    }

    if (grassTufts.length > 0) {
      const bladeGeometry = new THREE.BoxGeometry(0.07, 0.58, 0.48);
      const bladeMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
      });
      const bladeA = new THREE.InstancedMesh(
        bladeGeometry,
        bladeMaterial,
        grassTufts.length,
      );
      const bladeB = new THREE.InstancedMesh(
        bladeGeometry.clone(),
        bladeMaterial,
        grassTufts.length,
      );
      grassTufts.forEach((tuft, index) => {
        dummy.position.set(tuft.x, tuft.y + 0.29 * tuft.scale, tuft.z);
        dummy.rotation.set(0, tuft.rotation, 0);
        dummy.scale.set(tuft.scale, tuft.scale, tuft.scale);
        dummy.updateMatrix();
        bladeA.setMatrixAt(index, dummy.matrix);
        bladeA.setColorAt(index, tuft.color);
        dummy.rotation.y = tuft.rotation + Math.PI / 2;
        dummy.updateMatrix();
        bladeB.setMatrixAt(index, dummy.matrix);
        bladeB.setColorAt(index, tuft.color);
      });
      bladeA.instanceMatrix.needsUpdate = true;
      bladeB.instanceMatrix.needsUpdate = true;
      if (bladeA.instanceColor) bladeA.instanceColor.needsUpdate = true;
      if (bladeB.instanceColor) bladeB.instanceColor.needsUpdate = true;
      bladeA.receiveShadow = true;
      bladeB.receiveShadow = true;
      bladeA.frustumCulled = true;
      bladeB.frustumCulled = true;
      scene.add(bladeA, bladeB);
    }

    const highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025, 1.025, 1.025)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    highlight.visible = false;
    highlight.renderOrder = 20;
    scene.add(highlight);

    const crackCanvas = document.createElement("canvas");
    crackCanvas.width = 64;
    crackCanvas.height = 64;
    const crackContext = crackCanvas.getContext("2d")!;
    const crackTexture = new THREE.CanvasTexture(crackCanvas);
    crackTexture.colorSpace = THREE.SRGBColorSpace;
    crackTexture.magFilter = THREE.NearestFilter;
    crackTexture.minFilter = THREE.NearestFilter;
    textureList.push(crackTexture);
    const crackMaterial = new THREE.MeshBasicMaterial({
      map: crackTexture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      alphaTest: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const crackOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.018, 1.018, 1.018),
      crackMaterial,
    );
    crackOverlay.visible = false;
    crackOverlay.renderOrder = 21;
    scene.add(crackOverlay);
    let visibleCrackStage = -1;
    const drawCracks = (progress: number) => {
      const stage = Math.min(9, Math.max(0, Math.floor(progress * 10)));
      if (stage === visibleCrackStage) return;
      visibleCrackStage = stage;
      crackContext.clearRect(0, 0, 64, 64);
      crackContext.strokeStyle = "rgba(30, 24, 22, 0.94)";
      crackContext.lineWidth = 3;
      crackContext.lineCap = "square";
      crackContext.lineJoin = "miter";
      const paths = [
        [
          [32, 32],
          [25, 25],
          [19, 19],
          [10, 16],
          [4, 9],
        ],
        [
          [32, 32],
          [39, 25],
          [45, 18],
          [55, 17],
          [62, 9],
        ],
        [
          [32, 32],
          [39, 38],
          [44, 47],
          [53, 52],
          [61, 61],
        ],
        [
          [32, 32],
          [24, 39],
          [19, 48],
          [10, 52],
          [3, 61],
        ],
        [
          [32, 32],
          [31, 22],
          [34, 13],
          [29, 5],
          [30, 0],
        ],
        [
          [32, 32],
          [34, 42],
          [31, 51],
          [36, 58],
          [35, 64],
        ],
        [
          [25, 25],
          [16, 28],
          [10, 35],
          [1, 37],
        ],
        [
          [39, 38],
          [49, 36],
          [57, 30],
          [64, 31],
        ],
      ];
      const pathCount = Math.min(paths.length, 2 + stage);
      const pointsPerPath = Math.min(5, 2 + Math.ceil(stage / 2));
      for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
        const path = paths[pathIndex];
        const visiblePointCount = Math.min(pointsPerPath, path.length);
        crackContext.beginPath();
        crackContext.moveTo(path[0][0], path[0][1]);
        for (let point = 1; point < visiblePointCount; point += 1)
          crackContext.lineTo(path[point][0], path[point][1]);
        crackContext.stroke();
      }
      crackTexture.needsUpdate = true;
    };

    const spawnX = respawnPointRef.current.x;
    const spawnZ = respawnPointRef.current.z;
    camera.position.set(
      spawnX,
      surfaceCenter(spawnX, spawnZ) + 0.5 + EYE_HEIGHT,
      spawnZ,
    );
    let yaw = 0;
    let pitch = -0.08;
    camera.rotation.set(pitch, yaw, 0);
    let verticalVelocity = 0;
    let grounded = true;
    let falling = false;
    let fallStartY = camera.position.y;
    let hungerExhaustion = 0;
    let lastPositionReport = 0;
    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    raycaster.far = 6;

    const saveEdits = () => {
      localStorage.setItem(
        saveStorageKey,
        JSON.stringify({
          removed: [...removed],
          added: [...added.entries()],
          waterFlowLevels: [...waterFlowLevels.entries()],
          saplingGrowth: [...saplingGrowth.entries()].filter(
            ([key]) => world.get(key) === "sapling",
          ),
          defeatedAnimals: [...defeatedAnimals],
          lootedVillageChests: [...lootedVillageChests],
          lootDrops: [...lootDropRecords.values()],
          blockDrops: [...blockDropRecords.values()],
        }),
      );
    };

    let waterFlowTimer = 0;
    const updateWaterFlow = (delta: number) => {
      waterFlowTimer += delta;
      if (waterFlowTimer < 0.28 || waterFlowLevels.size === 0) return;
      waterFlowTimer = 0;
      const pending = new Map<string, { x: number; y: number; z: number; level: number }>();

      for (const [key, level] of waterFlowLevels) {
        if (world.get(key) !== "water") continue;
        const cell = { ...parseBlockKey(key), level };
        for (const next of getNextWaterFlowCells(
          cell,
          (x, y, z) => world.has(blockKey(x, y, z)),
          WORLD_BOTTOM_Y + 1,
        )) {
          if (
            next.x < WORLD_MIN ||
            next.x > WORLD_MAX ||
            next.z < WORLD_MIN ||
            next.z > WORLD_MAX ||
            next.y > 40
          )
            continue;
          const nextKey = blockKey(next.x, next.y, next.z);
          const queued = pending.get(nextKey);
          if (!queued || next.level < queued.level) pending.set(nextKey, next);
        }
      }

      if (pending.size === 0) return;
      for (const [key, next] of pending) {
        if (world.has(key)) continue;
        world.set(key, "water");
        added.set(key, "water");
        waterFlowLevels.set(key, next.level);
        removed.delete(key);
        indexRuntimeBlock(key, next.x, next.z);
      }
      rebuildChangedVoxelMeshes();
      saveEdits();
    };

    const isSolid = (kind?: TerrainBlockKind) =>
      Boolean(
        kind &&
          kind !== "water" &&
          kind !== "leaves" &&
          kind !== "sapling" &&
          kind !== "glass",
      );

    const surfaceForPlayer = (x: number, z: number, footY: number) => {
      const bx = Math.round(x);
      const bz = Math.round(z);
      const maxY = Math.min(30, Math.floor(footY + 1.05));
      for (let y = maxY; y >= WORLD_BOTTOM_Y; y -= 1) {
        if (isSolid(world.get(blockKey(bx, y, bz)))) return y + 0.5;
      }
      return WORLD_BOTTOM_Y - 0.5;
    };

    const isWaterLanding = (x: number, z: number, ground: number) => {
      const bx = Math.round(x);
      const bz = Math.round(z);
      const landingY = Math.floor(ground + 0.5);
      return [landingY - 1, landingY, landingY + 1].some(
        (y) => world.get(blockKey(bx, y, bz)) === "water",
      );
    };

    const bodyBlocked = (x: number, z: number, footY: number) => {
      const bx = Math.round(x);
      const bz = Math.round(z);
      return [footY + 0.42, footY + 1.28].some((height) =>
        isSolid(world.get(blockKey(bx, Math.round(height), bz))),
      );
    };

    const hasOpenSky = (x: number, y: number, z: number) => {
      for (let checkY = y + 1; checkY <= 30; checkY += 1)
        if (world.has(blockKey(x, checkY, z))) return false;
      return true;
    };
    const growSapling = (key: string) => {
      if (world.get(key) !== "sapling") return false;
      const { x, y, z } = parseBlockKey(key);
      const soil = world.get(blockKey(x, y - 1, z));
      if ((soil !== "grass" && soil !== "dirt") || !hasOpenSky(x, y, z))
        return false;
      const shapeRoll = terrainHash(x, z, 317);
      const trunkHeight = 5 + Math.floor(terrainHash(x, z, 331) * 3);
      const crownY = y + trunkHeight - 1;
      const crownRadius = shapeRoll > 0.7 ? 3 : 2;
      const crownLimit = shapeRoll > 0.7 ? 5 : 4;
      for (let trunkY = y + 1; trunkY < y + trunkHeight; trunkY += 1)
        if (world.has(blockKey(x, trunkY, z))) return false;

      world.delete(key);
      unindexRuntimeBlock(key, x, z);
      added.delete(key);
      saplingGrowth.delete(key);
      const growBlock = (
        blockX: number,
        blockY: number,
        blockZ: number,
        kind: BlockKind,
      ) => {
        const blockKeyValue = blockKey(blockX, blockY, blockZ);
        world.set(blockKeyValue, kind);
        indexRuntimeBlock(blockKeyValue, blockX, blockZ);
        added.set(blockKeyValue, kind);
        removed.delete(blockKeyValue);
      };
      for (let trunkY = y; trunkY < y + trunkHeight; trunkY += 1)
        growBlock(x, trunkY, z, "wood");
      for (let dx = -crownRadius; dx <= crownRadius; dx += 1) {
        for (let dz = -crownRadius; dz <= crownRadius; dz += 1) {
          for (let dy = -1; dy <= 2; dy += 1) {
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > crownLimit)
              continue;
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            const leafKey = blockKey(x + dx, crownY + dy, z + dz);
            if (!world.has(leafKey))
              growBlock(x + dx, crownY + dy, z + dz, "leaves");
          }
        }
      }
      return true;
    };
    let saplingSaveTimer = 0;
    const updateSaplingGrowth = (delta: number) => {
      if (timeRef.current !== "day") return;
      saplingSaveTimer += delta;
      let grew = false;
      for (const [key, kind] of world) {
        if (kind !== "sapling") continue;
        const age = (saplingGrowth.get(key) ?? 0) + delta;
        if (age < SAPLING_GROWTH_SECONDS) {
          saplingGrowth.set(key, age);
          continue;
        }
        if (growSapling(key)) grew = true;
        else saplingGrowth.set(key, SAPLING_GROWTH_SECONDS - 8);
      }
      if (grew) {
        rebuildChangedVoxelMeshes();
        saveEdits();
        callbacksRef.current.onMessage("树苗成长为一棵橡树");
        saplingSaveTimer = 0;
      } else if (saplingSaveTimer >= 8) {
        saveEdits();
        saplingSaveTimer = 0;
      }
    };

    // Keep meadows lively: replenish wildlife more frequently while retaining
    // the MAX_ANIMALS cap so the scene stays performant.
    let animalSpawnTimer = 1.5;
    let animalSpawnSequence = 0;
    let animalSpawnSeed = (Date.now() ^ 0x51f15e) >>> 0;
    const spawnRandom = () => {
      animalSpawnSeed = (animalSpawnSeed * 1664525 + 1013904223) >>> 0;
      return animalSpawnSeed / 4294967296;
    };
    const livingAnimalCount = () =>
      animalNPCs.filter((animal) => !animal.dead).length;

    const removeExpiredWildlife = () => {
      for (let index = animalNPCs.length - 1; index >= 0; index -= 1) {
        const animal = animalNPCs[index];
        if (animal.persistent || !animal.dead || animal.deathTimer > 0)
          continue;
        scene.remove(animal.group);
        animal.group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        animalNPCs.splice(index, 1);
      }
    };

    const removeExpiredBandits = () => {
      for (let index = banditNPCs.length - 1; index >= 0; index -= 1) {
        const bandit = banditNPCs[index];
        if (!bandit.dead || bandit.deathTimer > 0) continue;
        scene.remove(bandit.group);
        bandit.group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        banditNPCs.splice(index, 1);
      }
    };

    // 劫匪仍然更偏向夜间活动，但会更快补充，让探索时更容易
    // 遇到巡逻队。数量上限避免持续生成拖慢场景。
    const MAX_ACTIVE_BANDITS = 10;
    let banditSpawnTimer = 7;
    let banditSpawnSequence = 0;
    const trySpawnBandit = () => {
      removeExpiredBandits();
      if (
        banditNPCs.filter((bandit) => !bandit.dead).length >=
        MAX_ACTIVE_BANDITS
      )
        return false;
      // Spawn patrols around the player rather than at an arbitrary point on
      // the map. The 13–26 block radius keeps them visible without spawning
      // directly on top of the player.
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const angle = spawnRandom() * Math.PI * 2;
        const distance = 13 + spawnRandom() * 13;
        const x = Math.max(
          WORLD_MIN + 8,
          Math.min(WORLD_MAX - 8, Math.round(camera.position.x + Math.cos(angle) * distance)),
        );
        const z = Math.max(
          WORLD_MIN + 8,
          Math.min(WORLD_MAX - 8, Math.round(camera.position.z + Math.sin(angle) * distance)),
        );
        const ground = animalGroundAt(x, z, surfaceCenter(x, z) + 0.5);
        if (ground === null) continue;
        if (world.get(blockKey(x, Math.round(ground - 0.5), z)) !== "grass")
          continue;
        if (
          banditNPCs.some(
            (bandit) =>
              !bandit.dead &&
              Math.hypot(
                bandit.group.position.x - x,
                bandit.group.position.z - z,
              ) < 5,
          )
        )
          continue;
        banditSpawnSequence += 1;
        const weapon: BanditWeapon = spawnRandom() < 0.58 ? "sword" : "rifle";
        const kind: BanditKind = spawnRandom() < 0.3 ? "armored" : "normal";
        makeBandit(
          `bandit-${Date.now()}-${banditSpawnSequence}`,
          weapon,
          kind,
          x,
          z,
          (animalSpawnSeed + banditSpawnSequence * 311) >>> 0,
        );
        callbacksRef.current.onMessage(
          kind === "armored"
            ? `附近出现重甲${weapon === "sword" ? "持剑" : "持枪"}劫匪！`
            : weapon === "sword"
              ? "附近出现普通持剑劫匪！"
              : "附近出现普通持枪劫匪！",
        );
        return true;
      }
      return false;
    };

    const trySpawnAnimal = () => {
      removeExpiredWildlife();
      if (livingAnimalCount() >= MAX_ANIMALS) return false;

      for (let attempt = 0; attempt < 48; attempt += 1) {
        const candidate = uniformWorldPoint(8);
        const x = candidate.x;
        const z = candidate.z;
        const estimatedGround = surfaceCenter(x, z) + 0.5;
        const ground = animalGroundAt(x, z, estimatedGround);
        if (ground === null) continue;
        const groundKind = world.get(blockKey(x, Math.round(ground - 0.5), z));
        if (groundKind !== "grass") continue;
        if (
          animalNPCs.some(
            (animal) =>
              !animal.dead &&
              Math.hypot(
                animal.group.position.x - x,
                animal.group.position.z - z,
              ) < 3.6,
          )
        )
          continue;

        const roll = spawnRandom();
        const kind: AnimalKind =
          roll < 0.46 ? "sheep" : roll < 0.78 ? "pig" : "cow";
        const baseScale = kind === "cow" ? 1.04 : kind === "pig" ? 0.9 : 1;
        animalSpawnSequence += 1;
        makeAnimal(
          `wild-${Date.now()}-${animalSpawnSequence}`,
          kind,
          x,
          z,
          baseScale * (0.94 + spawnRandom() * 0.1),
          (animalSpawnSeed + animalSpawnSequence * 977) >>> 0,
          false,
        );
        callbacksRef.current.onAnimalPopulation(livingAnimalCount());
        callbacksRef.current.onMessage(
          `世界各处草地生成了${kind === "sheep" ? "一只绵羊" : kind === "pig" ? "一只猪" : "一头奶牛"}`,
        );
        return true;
      }
      return false;
    };

    const traceAim = (range = 6) => {
      raycaster.far = range;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const cameraChunk = voxelChunkCoordinates(
        camera.position.x,
        camera.position.z,
      );
      const targets: THREE.Object3D[] = [];
      const chunkRadius = Math.ceil(range / VOXEL_CHUNK_SIZE);
      for (let offsetX = -chunkRadius; offsetX <= chunkRadius; offsetX += 1) {
        for (let offsetZ = -chunkRadius; offsetZ <= chunkRadius; offsetZ += 1) {
          targets.push(
            ...(voxelMeshesByChunk.get(
              `${cameraChunk.x + offsetX},${cameraChunk.z + offsetZ}`,
            ) ?? []),
          );
        }
      }
      animalNPCs.forEach((npc) => {
        if (!npc.dead && npc.group.visible) targets.push(npc.group);
      });
      banditNPCs.forEach((npc) => {
        if (!npc.dead && npc.group.visible) targets.push(npc.group);
      });
      villagerNPCs.forEach((npc) => {
        if (!npc.dead && npc.group.visible) targets.push(npc.group);
      });
      saplingVisuals.forEach((saplingVisual) => {
        if (saplingVisual.group.position.distanceToSquared(camera.position) < range * range)
          targets.push(saplingVisual.group);
      });
      flowerEntities.forEach((flower) => {
        if (
          flower.active &&
          flower.group.position.distanceToSquared(camera.position) < range * range
        )
          targets.push(flower.group);
      });
      wheatEntities.forEach((wheat) => {
        if (wheat.group.position.distanceToSquared(camera.position) < range * range)
          targets.push(wheat.group);
      });
      if (beeHealth > 0 && bee.visible) targets.push(bee);
      const hits = raycaster.intersectObjects(targets, true);
      for (const hit of hits) {
        if (
          hit.object instanceof THREE.InstancedMesh &&
          hit.instanceId !== undefined
        ) {
          const block = (hit.object.userData.positions as BlockRecord[])[
            hit.instanceId
          ];
          return { type: "block" as const, hit, block };
        }
        let parent: THREE.Object3D | null = hit.object;
        while (parent) {
          const npc = animalNPCs.find(
            (candidate) => candidate.group === parent,
          );
          if (npc && !npc.dead) return { type: "animal" as const, hit, npc };
          const bandit = banditNPCs.find(
            (candidate) => candidate.group === parent,
          );
          if (bandit && !bandit.dead)
            return { type: "bandit" as const, hit, npc: bandit };
          const villager = villagerNPCs.find(
            (candidate) => candidate.group === parent,
          );
          if (villager && !villager.dead)
            return { type: "villager" as const, hit, npc: villager };
          const saplingVisual = saplingVisuals.find(
            (candidate) => candidate.group === parent,
          );
          if (saplingVisual)
            return { type: "block" as const, hit, block: saplingVisual.block };
          const flower = flowerEntities.find(
            (candidate) => candidate.active && candidate.group === parent,
          );
          if (flower) return { type: "flower" as const, hit, flower };
          const wheat = wheatEntities.find(
            (candidate) => candidate.group === parent,
          );
          if (wheat) return { type: "wheat" as const, hit, wheat };
          if (parent === bee && beeHealth > 0)
            return { type: "bee" as const, hit };
          parent = parent.parent;
        }
      }
      return null;
    };

    let cachedAim: ReturnType<typeof traceAim> = null;
    let lastAimSampleAt = -Infinity;
    let cachedAimRange = 6;
    const currentAim = (force = false, range = 6) => {
      const now = performance.now();
      if (
        !force &&
        cachedAimRange === range &&
        now - lastAimSampleAt < 45
      )
        return cachedAim;
      lastAimSampleAt = now;
      cachedAimRange = range;
      cachedAim = traceAim(range);
      return cachedAim;
    };

    const currentHit = (force = false) => {
      const target = currentAim(force);
      return target?.type === "block" ? target : null;
    };

    const animalNames: Record<AnimalKind, string> = {
      sheep: "绵羊",
      pig: "猪",
      cow: "奶牛",
    };
    const animalDrops: Record<
      AnimalKind,
      { kind: AnimalDropKind; amount: number }[]
    > = {
      sheep: [{ kind: "wool", amount: 1 }],
      pig: [{ kind: "rawPork", amount: 2 }],
      cow: [
        { kind: "rawBeef", amount: 2 },
        { kind: "leather", amount: 1 },
      ],
    };
    const weaponRange = (weapon: PlayerWeaponKind | null) =>
      weapon ? WEAPON_RANGE[weapon] : 4.25;
    let lastAnimalAttack = 0;

    const harvestFlower = (flower: FlowerEntity) => {
      if (!flower.active) return;
      flower.active = false;
      flower.group.visible = false;
      defeatedAnimals.add(flower.id);
      const record: LootRecord = {
        id: `${flower.id}-${Date.now()}`,
        kind: flower.kind,
        amount: 1,
        x: flower.group.position.x,
        y: flower.group.position.y + 0.3,
        z: flower.group.position.z,
      };
      lootDropRecords.set(record.id, record);
      spawnLootEntity(record);
      saveEdits();
      callbacksRef.current.onMessage("花朵已采集 · 掉落物已生成");
    };

    const harvestWheat = (wheat: WheatEntity) => {
      if (wheat.age < 0.72) {
        callbacksRef.current.onMessage("小麦还没有成熟");
        return;
      }
      wheat.age = 0;
      wheat.group.scale.y = 0.45;
      callbacksRef.current.onBlockPickup("wheat", 1);
      callbacksRef.current.onMessage("收获小麦 ×1 · 作物会重新生长");
    };

    const playerAttackDamage = (weapon: PlayerWeaponKind | null = null) => {
      const equipped = equippedToolRef.current;
      const baseDamage = weapon
        ? WEAPON_DAMAGE[weapon]
        : SWORD_DAMAGE[equipped] ?? HAND_DAMAGE;
      return Math.max(
        HAND_DAMAGE,
        Math.round(baseDamage * strengthMultiplierRef.current * 2) / 2,
      );
    };

    const attackBee = (
      distance: number,
      weapon: PlayerWeaponKind | null = null,
    ) => {
      const range = weaponRange(weapon);
      if (beeHealth <= 0 || distance > range) return;
      const equipped = equippedToolRef.current;
      if (!weapon) playSound("melee");
      const damage = playerAttackDamage(weapon);
      beeHealth -= damage;
      if (SWORD_DAMAGE[equipped])
        callbacksRef.current.onToolUse(equipped as Exclude<ToolKind, "hand">);
      beeHurtTimer = 0.28;
      beeAggroTimer = 7;
      if (beeHealth > 0) {
        callbacksRef.current.onMessage(
          `攻击蜜蜂 · 生命 ${beeHealth}/3 · 它被激怒了`,
        );
        return;
      }
      bee.visible = false;
      defeatedAnimals.add(beeId);
      callbacksRef.current.onCombatDefeat("bee");
      const record: LootRecord = {
        id: `${beeId}-honeycomb-${Date.now()}`,
        kind: "honeycomb",
        amount: 1,
        x: bee.position.x,
        y: bee.position.y,
        z: bee.position.z,
      };
      lootDropRecords.set(record.id, record);
      spawnLootEntity(record);
      saveEdits();
      callbacksRef.current.onMessage("蜜蜂被击败 · 掉落 蜜脾 ×1");
    };

    const attackAnimal = (
      npc: AnimalNPC,
      distance: number,
      weapon: PlayerWeaponKind | null = null,
    ) => {
      if (npc.dead) return;
      const range = weaponRange(weapon);
      if (distance > range) {
        callbacksRef.current.onMessage(`${animalNames[npc.kind]}距离太远`);
        return;
      }
      const now = performance.now();
      if (now - lastAnimalAttack < 280) return;
      lastAnimalAttack = now;
      const equipped = equippedToolRef.current;
      if (!weapon) playSound("melee");
      const damage = playerAttackDamage(weapon);
      npc.health -= damage;
      playSound(npc.kind);
      if (SWORD_DAMAGE[equipped])
        callbacksRef.current.onToolUse(equipped as Exclude<ToolKind, "hand">);
      npc.hurtTimer = 0.24;
      npc.walking = false;
      npc.stateTimer = 0.42;

      const pushX = npc.group.position.x - camera.position.x;
      const pushZ = npc.group.position.z - camera.position.z;
      const pushLength = Math.hypot(pushX, pushZ) || 1;
      const knockX = npc.group.position.x + (pushX / pushLength) * 0.34;
      const knockZ = npc.group.position.z + (pushZ / pushLength) * 0.34;
      const knockGround = animalGroundAt(knockX, knockZ, npc.group.position.y);
      if (
        knockGround !== null &&
        Math.abs(knockGround - npc.group.position.y) <= 1.05
      ) {
        npc.group.position.x = knockX;
        npc.group.position.z = knockZ;
        npc.group.position.y = knockGround;
      }

      if (npc.health > 0) {
        callbacksRef.current.onMessage(
          `攻击${animalNames[npc.kind]} · 生命 ${npc.health}/${npc.maxHealth}`,
        );
        return;
      }

      npc.dead = true;
      npc.deathTimer = 0.48;
      npc.walking = false;
      playSound("animalDeath");
      if (npc.persistent) defeatedAnimals.add(npc.id);
      callbacksRef.current.onCombatDefeat("animal");
      callbacksRef.current.onAnimalPopulation(
        animalNPCs.filter((animal) => !animal.dead).length,
      );
      animalDrops[npc.kind].forEach((drop, index) => {
        const record: LootRecord = {
          id: `${npc.id}-${drop.kind}-${index}`,
          kind: drop.kind,
          amount: drop.amount,
          x: npc.group.position.x + (index - 0.35) * 0.42,
          y: npc.group.position.y + 0.62,
          z: npc.group.position.z + (index % 2 === 0 ? 0.2 : -0.2),
        };
        lootDropRecords.set(record.id, record);
        spawnLootEntity(record);
      });
      saveEdits();
      callbacksRef.current.onMessage(
        `${animalNames[npc.kind]}被击杀 · 掉落物已生成`,
      );
    };

    const attackBandit = (
      npc: BanditNPC,
      distance: number,
      weapon: PlayerWeaponKind | null = null,
    ) => {
      if (npc.dead) return;
      if (distance > weaponRange(weapon)) {
        callbacksRef.current.onMessage("劫匪距离太远");
        return;
      }
      const equipped = equippedToolRef.current;
      if (!weapon) playSound("melee");
      const damage = playerAttackDamage(weapon);
      npc.health -= damage;
      npc.hurtTimer = 0.22;
      if (!weapon && SWORD_DAMAGE[equipped])
        callbacksRef.current.onToolUse(equipped as Exclude<ToolKind, "hand">);
      if (npc.health > 0) {
        callbacksRef.current.onMessage(`劫匪受伤 · 剩余生命 ${npc.health}`);
        return;
      }

      npc.dead = true;
      npc.deathTimer = 0.55;
      callbacksRef.current.onCombatDefeat("bandit");
      const rubyAmount = 1 + ((npc.seed >>> 3) % 2);
      const dropRecord: BlockDropRecord = {
        id: `bandit-ruby-${Date.now()}-${npc.id}`,
        kind: "rubyOre",
        x: npc.group.position.x,
        y: npc.group.position.y + 0.7,
        z: npc.group.position.z,
      };
      blockDropRecords.set(dropRecord.id, dropRecord);
      spawnBlockDropEntity(dropRecord, true);
      if (rubyAmount === 2) {
        const bonusDrop: BlockDropRecord = {
          ...dropRecord,
          id: `${dropRecord.id}-bonus`,
          x: dropRecord.x + 0.24,
          z: dropRecord.z - 0.18,
        };
        blockDropRecords.set(bonusDrop.id, bonusDrop);
        spawnBlockDropEntity(bonusDrop, true);
      }
      saveEdits();
      callbacksRef.current.onMessage(`劫匪被击败 · 掉落红宝石 ×${rubyAmount}`);
    };

    const attackVillager = (
      npc: VillagerNPC,
      distance: number,
      weapon: PlayerWeaponKind | null = null,
    ) => {
      if (npc.dead) return;
      const range = weaponRange(weapon);
      if (distance > range) {
        callbacksRef.current.onMessage("村民距离太远");
        return;
      }
      const equipped = equippedToolRef.current;
      if (!weapon) playSound("melee");
      const damage = playerAttackDamage(weapon);
      npc.health -= damage;
      npc.hurtTimer = 0.22;
      if (!weapon && SWORD_DAMAGE[equipped])
        callbacksRef.current.onToolUse(equipped as Exclude<ToolKind, "hand">);
      if (npc.health > 0) {
        callbacksRef.current.onMessage(
          `${npc.name}受伤 · 剩余生命 ${npc.health}/${npc.maxHealth}`,
        );
        return;
      }
      npc.dead = true;
      npc.deathTimer = 0.52;
      defeatedAnimals.add(npc.id);
      callbacksRef.current.onCombatDefeat("villager");
      const rubyAmount = 1 + ((npc.seed >>> 2) % 2);
      for (let index = 0; index < rubyAmount; index += 1) {
        const dropRecord: BlockDropRecord = {
          id: `villager-ruby-${Date.now()}-${npc.id}-${index}`,
          kind: "rubyOre",
          x: npc.group.position.x + (index ? 0.25 : -0.16),
          y: npc.group.position.y + 0.7,
          z: npc.group.position.z + (index ? -0.14 : 0.16),
        };
        blockDropRecords.set(dropRecord.id, dropRecord);
        spawnBlockDropEntity(dropRecord, true);
      }
      saveEdits();
      callbacksRef.current.onMessage(`${npc.name}被击败 · 掉落红宝石 ×${rubyAmount}`);
    };

    const fireWeapon = () => {
      const weapon = equippedWeaponRef.current;
      if (!weapon) return false;
      if (!callbacksRef.current.onWeaponFire(weapon)) return true;
      playSound("gun");
      spawnCasing(weapon);
      weaponRecoil = 1;
      const target = currentAim(true, weaponRange(weapon));
      if (!target) {
        callbacksRef.current.onMessage(`${weapon === "shotgun" ? "霰弹枪" : weapon === "rifle" ? "步枪" : "手枪"}开火`);
        return true;
      }
      if (target.type === "animal")
        attackAnimal(target.npc, target.hit.distance, weapon);
      else if (target.type === "bandit")
        attackBandit(target.npc, target.hit.distance, weapon);
      else if (target.type === "villager")
        attackVillager(target.npc, target.hit.distance, weapon);
      else if (target.type === "bee") attackBee(target.hit.distance, weapon);
      else callbacksRef.current.onMessage("子弹命中方块");
      return true;
    };

    const finishMiningBlock = (block: BlockRecord) => {
      if (block.kind === "bedrock" || block.kind === "water") return;
      const key = blockKey(block.x, block.y, block.z);
      if (!world.has(key)) return;
      world.delete(key);
      unindexRuntimeBlock(key, block.x, block.z);
      saplingGrowth.delete(key);
      if (added.has(key)) added.delete(key);
      else removed.add(key);
      rebuildChangedVoxelMeshes();
      playSound("break");
      const needsPickaxe =
        block.kind === "stone" ||
        block.kind === "ironOre" ||
        block.kind === "rubyOre" ||
        block.kind === "coalOre";
      const requiredTier =
        block.kind === "rubyOre"
          ? 3
          : block.kind === "ironOre"
            ? 2
            : needsPickaxe
              ? 1
              : 0;
      const equipped = equippedToolRef.current;
      const pickaxeTier = PICKAXE_TIER[equipped] ?? 0;
      const dropped = !needsPickaxe || pickaxeTier >= requiredTier;
      if (dropped) {
        const dropKinds: BlockKind[] = [
          block.kind === "coalOre" ? "coal" : block.kind,
        ];
        if (
          block.kind === "leaves" &&
          terrainHash(block.x + block.y * 7, block.z - block.y * 5, 347) <
            0.3
        )
          dropKinds.push("sapling");
        dropKinds.forEach((kind, index) => {
          const dropRecord: BlockDropRecord = {
            id: `block-${Date.now()}-${block.x}-${block.y}-${block.z}-${index}`,
            kind,
            x: block.x + (index ? 0.22 : 0),
            y: block.y + 0.38,
            z: block.z + (index ? -0.16 : 0),
          };
          blockDropRecords.set(dropRecord.id, dropRecord);
          spawnBlockDropEntity(dropRecord, true);
        });
      }
      saveEdits();
      callbacksRef.current.onMine(block.kind, dropped);
      if (needsPickaxe && pickaxeTier > 0)
        callbacksRef.current.onToolUse(equipped as Exclude<ToolKind, "hand">);
    };

    type MiningState = {
      key: string;
      block: BlockRecord;
      elapsed: number;
      duration: number;
    };
    let miningHeld = false;
    let miningState: MiningState | null = null;
    const clearMining = () => {
      miningState = null;
      crackOverlay.visible = false;
      visibleCrackStage = -1;
    };
    const beginMiningOrAttack = () => {
      const target = currentAim();
      if (!target) return clearMining();
      if (target.type === "animal") {
        clearMining();
        attackAnimal(target.npc, target.hit.distance);
        return;
      }
      if (target.type === "bandit") {
        clearMining();
        attackBandit(target.npc, target.hit.distance);
        return;
      }
      if (target.type === "villager") {
        clearMining();
        attackVillager(target.npc, target.hit.distance);
        return;
      }
      if (target.type === "wheat") {
        clearMining();
        harvestWheat(target.wheat);
        return;
      }
      if (target.type === "flower") {
        clearMining();
        harvestFlower(target.flower);
        return;
      }
      if (target.type === "bee") {
        clearMining();
        attackBee(target.hit.distance);
        return;
      }
      if (target.block.kind === "bedrock") {
        clearMining();
        callbacksRef.current.onMessage("基岩无法破坏");
        return;
      }
      if (target.block.kind === "water") return clearMining();
      if (target.block.kind === "bed") {
        clearMining();
        callbacksRef.current.onBedSleep({
          x: target.block.x,
          z: target.block.z,
        });
        return;
      }
      if (target.block.kind === "chest") {
        clearMining();
        const chestKey = blockKey(
          target.block.x,
          target.block.y,
          target.block.z,
        );
        const villageLoot = villageChestLoot.get(chestKey);
        if (villageLoot) {
          // Populate the normal chest UI with the generated loot while the
          // physical chest stays in the world as an empty container later on.
          villageChestLoot.delete(chestKey);
          lootedVillageChests.add(chestKey);
          saveEdits();
          callbacksRef.current.onChestOpen(villageLoot);
        } else callbacksRef.current.onChestOpen();
        return;
      }
      const key = blockKey(target.block.x, target.block.y, target.block.z);
      if (miningState?.key === key) return;
      miningState = {
        key,
        block: target.block,
        elapsed: 0,
        duration: getBlockBreakSeconds(
          target.block.kind,
          equippedToolRef.current,
        ),
      };
      crackOverlay.position.set(target.block.x, target.block.y, target.block.z);
      crackOverlay.visible = true;
      visibleCrackStage = -1;
      drawCracks(0);
    };
    const updateMining = (delta: number) => {
      if (!miningHeld) return clearMining();
      const target = currentAim();
      if (!target || target.type !== "block") return clearMining();
      if (target.block.kind === "bedrock" || target.block.kind === "water")
        return clearMining();
      const targetKey = blockKey(
        target.block.x,
        target.block.y,
        target.block.z,
      );
      if (miningState?.key !== targetKey) beginMiningOrAttack();
      if (!miningState || miningState.key !== targetKey) return;
      miningState.elapsed += delta;
      const progress = Math.min(1, miningState.elapsed / miningState.duration);
      drawCracks(progress);
      if (progress < 1) return;
      const completedBlock = miningState.block;
      clearMining();
      finishMiningBlock(completedBlock);
    };

    const placeBlock = () => {
      const target = currentHit();
      const kind = selectedRef.current;
      if (!target || !PLACEABLE.has(kind)) return;
      if (availableRef.current <= 0) {
        callbacksRef.current.onMessage("这个方块已经用完了");
        return;
      }
      const normal = target.hit.face?.normal;
      if (!normal) return;
      const x = target.block.x + Math.round(normal.x);
      const y = target.block.y + Math.round(normal.y);
      const z = target.block.z + Math.round(normal.z);
      const key = blockKey(x, y, z);
      if (world.has(key)) return;
      if (
        kind === "sapling" &&
        (normal.y !== 1 ||
          (target.block.kind !== "grass" && target.block.kind !== "dirt"))
      ) {
        callbacksRef.current.onMessage("树苗只能种在草地或泥土顶部");
        return;
      }
      const footY = camera.position.y - EYE_HEIGHT;
      if (
        Math.abs(camera.position.x - x) < 0.72 &&
        Math.abs(camera.position.z - z) < 0.72 &&
        y >= Math.floor(footY) &&
        y <= Math.ceil(camera.position.y)
      ) {
        callbacksRef.current.onMessage("不能在角色身体内放置方块");
        return;
      }
      world.set(key, kind);
      indexRuntimeBlock(key, x, z);
      added.set(key, kind);
      if (kind === "sapling") saplingGrowth.set(key, 0);
      if (kind === "water") waterFlowLevels.set(key, 0);
      removed.delete(key);
      saveEdits();
      rebuildChangedVoxelMeshes();
      playSound("place");
      callbacksRef.current.onPlace(kind);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "Space") event.preventDefault();
      if (
        event.code === "KeyF" &&
        activeRef.current &&
        !pausedRef.current &&
        beeHealth > 0 &&
        bee.position.distanceTo(camera.position) < 4.8
      ) {
        event.preventDefault();
        if (callbacksRef.current.onBeeFeed()) {
          beeAggroTimer = 0;
          beeSpeechTimer = 5;
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    let draggingView = false;
    let dragPointerId = -1;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragDistance = 0;
    let weaponPointerPending = false;
    let weaponPointerStartedAt = 0;
    const capturePointerSafely = (pointerId: number) => {
      try {
        canvas.setPointerCapture?.(pointerId);
      } catch {
        // Some embedded browsers invalidate the pointer while a modal is
        // closing. Dragging still works without capture, so do not crash the
        // game when the browser rejects this optional enhancement.
      }
    };
    const releasePointerSafely = (pointerId: number) => {
      try {
        if (canvas.hasPointerCapture?.(pointerId))
          canvas.releasePointerCapture?.(pointerId);
      } catch {
        // The pointer may already have been released by pointer lock or by a
        // modal transition.
      }
    };
    const rotateView = (
      movementX: number,
      movementY: number,
      sensitivity: number,
    ) => {
      yaw -= movementX * sensitivity;
      pitch -= movementY * sensitivity;
      pitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, pitch));
      camera.rotation.set(pitch, yaw, 0);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (
        document.pointerLockElement !== canvas ||
        !activeRef.current ||
        pausedRef.current
      )
        return;
      if (equippedWeaponRef.current && !weaponPointerPending) return;
      if (weaponPointerPending)
        dragDistance += Math.abs(event.movementX) + Math.abs(event.movementY);
      rotateView(event.movementX, event.movementY, 0.00225);
    };
    const onPointerLockChange = () => {
      draggingView = false;
      weaponPointerPending = false;
      callbacksRef.current.onLockChange(document.pointerLockElement === canvas);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!activeRef.current || pausedRef.current) return;
      if (document.pointerLockElement === canvas) {
        if (event.button === 0) {
          if (equippedWeaponRef.current) {
            draggingView = true;
            dragPointerId = event.pointerId;
            dragDistance = 0;
            weaponPointerPending = true;
            weaponPointerStartedAt = performance.now();
            return;
          }
          miningHeld = true;
          beginMiningOrAttack();
        }
        if (event.button === 2) placeBlock();
        return;
      }
      if (event.button === 2) {
        placeBlock();
        return;
      }
      if (event.button !== 0) return;
      if (equippedWeaponRef.current) {
        draggingView = true;
        dragPointerId = event.pointerId;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        dragDistance = 0;
        weaponPointerPending = true;
        weaponPointerStartedAt = performance.now();
        capturePointerSafely(event.pointerId);
        return;
      }
      draggingView = true;
      miningHeld = true;
      beginMiningOrAttack();
      dragPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      dragDistance = 0;
      capturePointerSafely(event.pointerId);
      if (event.pointerType !== "touch") {
        try {
          const lockRequest = canvas.requestPointerLock();
          if (lockRequest instanceof Promise) {
            lockRequest.catch(() => {
              callbacksRef.current.onMessage(
                "鼠标锁定不可用 · 按住左键拖动仍可转动视角",
              );
            });
          }
        } catch {
          callbacksRef.current.onMessage(
            "鼠标锁定不可用 · 按住左键拖动仍可转动视角",
          );
        }
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (
        !draggingView ||
        event.pointerId !== dragPointerId ||
        document.pointerLockElement === canvas ||
        !activeRef.current ||
        pausedRef.current
      )
        return;
      const movementX = event.clientX - lastPointerX;
      const movementY = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      dragDistance += Math.abs(movementX) + Math.abs(movementY);
      if (dragDistance >= 5) {
        miningHeld = false;
        clearMining();
      }
      rotateView(
        movementX,
        movementY,
        event.pointerType === "touch" ? 0.006 : 0.004,
      );
    };
    const endPointerDrag = (event: PointerEvent) => {
      if (weaponPointerPending && event.pointerId === dragPointerId) {
        const isClick =
          event.type === "pointerup" &&
          dragDistance < 5 &&
          performance.now() - weaponPointerStartedAt < 280;
        weaponPointerPending = false;
        draggingView = false;
        releasePointerSafely(event.pointerId);
        if (isClick) fireWeapon();
        return;
      }
      if (event.button === 0) {
        miningHeld = false;
        clearMining();
      }
      if (!draggingView || event.pointerId !== dragPointerId) return;
      draggingView = false;
      weaponPointerPending = false;
      releasePointerSafely(event.pointerId);
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onWindowBlur = () => {
      keys.clear();
      draggingView = false;
      weaponPointerPending = false;
      miningHeld = false;
      clearMining();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointerDrag);
    canvas.addEventListener("pointercancel", endPointerDrag);
    canvas.addEventListener("contextmenu", onContextMenu);

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      weaponCamera.aspect = width / height;
      weaponCamera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    type LightingKeyframe = {
      at: number;
      zenith: THREE.Color;
      horizon: THREE.Color;
      lower: THREE.Color;
      fog: THREE.Color;
      light: THREE.Color;
      sun: THREE.Color;
      cloud: THREE.Color;
      cloudShadow: THREE.Color;
      ambient: number;
      intensity: number;
    };
    const lightingKeyframes: LightingKeyframe[] = [
      {
        at: 0,
        zenith: new THREE.Color(0x315c9a),
        horizon: new THREE.Color(0xffaa67),
        lower: new THREE.Color(0xe8714c),
        fog: new THREE.Color(0xb87865),
        light: new THREE.Color(0xffb66e),
        sun: new THREE.Color(0xfff1b8),
        cloud: new THREE.Color(0xffd3b5),
        cloudShadow: new THREE.Color(0xc48e87),
        ambient: 1.05,
        intensity: 2.5,
      },
      {
        at: 0.08,
        zenith: new THREE.Color(0x2c83d3),
        horizon: new THREE.Color(0xb7e4f5),
        lower: new THREE.Color(0xe1f4fb),
        fog: new THREE.Color(0xa6ccdc),
        light: new THREE.Color(0xfff1c0),
        sun: new THREE.Color(0xffffdc),
        cloud: new THREE.Color(0xfffbf2),
        cloudShadow: new THREE.Color(0xb7cad8),
        ambient: 1.78,
        intensity: 3.2,
      },
      {
        at: 0.3,
        zenith: new THREE.Color(0x217bd0),
        horizon: new THREE.Color(0x9fdcf2),
        lower: new THREE.Color(0xd8f0f8),
        fog: new THREE.Color(0x98c5d8),
        light: new THREE.Color(0xffffd5),
        sun: new THREE.Color(0xffffe5),
        cloud: new THREE.Color(0xffffff),
        cloudShadow: new THREE.Color(0xaabfce),
        ambient: 1.85,
        intensity: 3.35,
      },
      {
        at: 0.43,
        zenith: new THREE.Color(0x3b75b5),
        horizon: new THREE.Color(0xffc477),
        lower: new THREE.Color(0xf08b58),
        fog: new THREE.Color(0xd39a74),
        light: new THREE.Color(0xffc37b),
        sun: new THREE.Color(0xffffc7),
        cloud: new THREE.Color(0xffdcc1),
        cloudShadow: new THREE.Color(0xbe7f77),
        ambient: 1.35,
        intensity: 3,
      },
      {
        at: 0.5,
        zenith: new THREE.Color(0x1a3768),
        horizon: new THREE.Color(0xff824b),
        lower: new THREE.Color(0x6c3352),
        fog: new THREE.Color(0x8f5260),
        light: new THREE.Color(0xff9a58),
        sun: new THREE.Color(0xffffba),
        cloud: new THREE.Color(0xffb087),
        cloudShadow: new THREE.Color(0x82536a),
        ambient: 0.85,
        intensity: 2.1,
      },
      {
        at: 0.57,
        zenith: new THREE.Color(0x06142d),
        horizon: new THREE.Color(0x172d4c),
        lower: new THREE.Color(0x0a1629),
        fog: new THREE.Color(0x09172b),
        light: new THREE.Color(0x8aa7d6),
        sun: new THREE.Color(0xcbd8df),
        cloud: new THREE.Color(0x8795aa),
        cloudShadow: new THREE.Color(0x3e4c66),
        ambient: 0.42,
        intensity: 0.58,
      },
      {
        at: 0.8,
        zenith: new THREE.Color(0x020817),
        horizon: new THREE.Color(0x12213b),
        lower: new THREE.Color(0x07101e),
        fog: new THREE.Color(0x071225),
        light: new THREE.Color(0x7899cc),
        sun: new THREE.Color(0xc7d8f2),
        cloud: new THREE.Color(0x74849c),
        cloudShadow: new THREE.Color(0x344259),
        ambient: 0.34,
        intensity: 0.48,
      },
      {
        at: 0.94,
        zenith: new THREE.Color(0x17294a),
        horizon: new THREE.Color(0x725f7d),
        lower: new THREE.Color(0x332844),
        fog: new THREE.Color(0x3e3b57),
        light: new THREE.Color(0x9daed1),
        sun: new THREE.Color(0xd7e0ed),
        cloud: new THREE.Color(0x9b91a7),
        cloudShadow: new THREE.Color(0x56536e),
        ambient: 0.58,
        intensity: 0.82,
      },
      {
        at: 1,
        zenith: new THREE.Color(0x315c9a),
        horizon: new THREE.Color(0xffaa67),
        lower: new THREE.Color(0xe8714c),
        fog: new THREE.Color(0xb87865),
        light: new THREE.Color(0xffb66e),
        sun: new THREE.Color(0xfff1b8),
        cloud: new THREE.Color(0xffd3b5),
        cloudShadow: new THREE.Color(0xc48e87),
        ambient: 1.05,
        intensity: 2.5,
      },
    ];
    const updateLighting = () => {
      const progress = ((cycleProgressRef.current % 1) + 1) % 1;
      let frameIndex = lightingKeyframes.length - 2;
      for (let index = 0; index < lightingKeyframes.length - 1; index += 1) {
        if (
          progress >= lightingKeyframes[index].at &&
          progress <= lightingKeyframes[index + 1].at
        ) {
          frameIndex = index;
          break;
        }
      }
      const from = lightingKeyframes[frameIndex];
      const to = lightingKeyframes[frameIndex + 1];
      const rawBlend = (progress - from.at) / Math.max(0.001, to.at - from.at);
      const blend = rawBlend * rawBlend * (3 - 2 * rawBlend);
      skyMaterial.uniforms.zenith.value
        .copy(from.zenith)
        .lerp(to.zenith, blend);
      skyMaterial.uniforms.horizon.value
        .copy(from.horizon)
        .lerp(to.horizon, blend);
      skyMaterial.uniforms.lower.value.copy(from.lower).lerp(to.lower, blend);
      scene.fog!.color.copy(from.fog).lerp(to.fog, blend);
      sunLight.color.copy(from.light).lerp(to.light, blend);
      sunLight.intensity = THREE.MathUtils.lerp(
        from.intensity,
        to.intensity,
        blend,
      );
      ambient.intensity = THREE.MathUtils.lerp(from.ambient, to.ambient, blend);
      sunMaterial.color.copy(from.sun).lerp(to.sun, blend);
      cloudLightMaterial.color.copy(from.cloud).lerp(to.cloud, blend);
      cloudShadowMaterial.color
        .copy(from.cloudShadow)
        .lerp(to.cloudShadow, blend);
      cloudMidMaterial.color
        .copy(cloudLightMaterial.color)
        .lerp(cloudShadowMaterial.color, 0.34);
      if (weather === "rain") {
        skyMaterial.uniforms.zenith.value.multiplyScalar(0.72);
        skyMaterial.uniforms.horizon.value.multiplyScalar(0.68);
        scene.fog!.color.multiplyScalar(0.72);
        sunLight.intensity *= 0.55;
        ambient.intensity *= 0.82;
      }

      const orbitAngle = progress * Math.PI * 2;
      const sunAltitude = Math.sin(orbitAngle) * 50;
      const sunOffsetX = Math.cos(orbitAngle) * 82;
      const moonAngle = orbitAngle + Math.PI;
      const moonAltitude = Math.sin(moonAngle) * 50;
      const moonOffsetX = Math.cos(moonAngle) * 82;
      sun.position.set(
        camera.position.x + sunOffsetX,
        camera.position.y + 9 + sunAltitude,
        camera.position.z,
      );
      moon.position.set(
        camera.position.x + moonOffsetX,
        camera.position.y + 9 + moonAltitude,
        camera.position.z,
      );
      moonGlow.position.copy(moon.position);
      sun.lookAt(camera.position);
      moon.lookAt(camera.position);
      moonGlow.lookAt(camera.position);
      sun.visible = sunAltitude > -10;
      moon.visible = timeRef.current === "night" && moonAltitude > -10;
      moonGlow.visible = moon.visible;
      const nightDepth = Math.max(0, -Math.sin(orbitAngle));
      starMaterial.opacity =
        timeRef.current === "night"
          ? THREE.MathUtils.lerp(
              0.35,
              0.98,
              THREE.MathUtils.smoothstep(nightDepth, 0.02, 0.48),
            )
          : 0;

      const lightAngle = timeRef.current === "night" ? moonAngle : orbitAngle;
      sunLight.position.set(
        camera.position.x + Math.cos(lightAngle) * 42,
        camera.position.y + 24 + Math.max(8, Math.sin(lightAngle) * 38),
        camera.position.z,
      );
      sunLight.target.position.set(camera.position.x, 0, camera.position.z);
    };

    const clock = new THREE.Clock();
    const moveForward = new THREE.Vector3();
    const moveRight = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();
    const forwardAxis = new THREE.Vector3(0, 0, -1);
    const rightAxis = new THREE.Vector3(1, 0, 0);
    let shadowFrame = 0;
    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      if (activeRef.current && !pausedRef.current) {
        weatherTimer -= delta;
        if (weatherTimer <= 0) {
          if (weather === "rain") {
            setWeather("clear");
            weatherTimer = 70 + Math.random() * 80;
          } else if (Math.random() < 0.14) {
            setWeather("rain");
            weatherTimer = 25 + Math.random() * 30;
          } else weatherTimer = 45 + Math.random() * 65;
        }
        if (weather === "rain") {
          rainDrops.forEach((drop, index) => {
            drop.y -= drop.speed * delta;
            if (
              drop.y < camera.position.y - 4 ||
              Math.abs(drop.x - camera.position.x) > 28 ||
              Math.abs(drop.z - camera.position.z) > 28
            )
              resetRainDrop(drop, index);
            else {
              const offset = index * 6;
              rainPositions[offset] = drop.x;
              rainPositions[offset + 1] = drop.y;
              rainPositions[offset + 2] = drop.z;
              rainPositions[offset + 3] = drop.x - 0.08;
              rainPositions[offset + 4] = drop.y - 0.72;
              rainPositions[offset + 5] = drop.z;
            }
          });
          (rainGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
      }
      updateLighting();

      sky.position.copy(camera.position);
      starField.position.copy(camera.position);
      const elapsed = clock.elapsedTime;
      const waterPulse = Math.sin(elapsed * 1.7) * 0.5 + 0.5;
      waterMaterial.opacity = 0.68 + waterPulse * 0.07;
      waterMaterial.color.setHSL(
        0.55 + Math.sin(elapsed * 0.55) * 0.008,
        0.58,
        0.51 + waterPulse * 0.035,
      );
      const activeWeapon = equippedWeaponRef.current;
      (Object.keys(weaponVisuals) as PlayerWeaponKind[]).forEach((kind) => {
        weaponVisuals[kind].visible = kind === activeWeapon;
      });
      firstPersonRig.visible = Boolean(activeWeapon);
      weaponRecoil = Math.max(0, weaponRecoil - delta * 7.5);
      firstPersonRig.position.x = 0.7 + Math.sin(elapsed * 5.5) * 0.006;
      firstPersonRig.position.y =
        -0.62 + Math.sin(elapsed * 7.5) * 0.008 - weaponRecoil * 0.05;
      firstPersonRig.position.z = -1.75 + weaponRecoil * 0.1;
      // The weapon geometry is built along local -Z, which is also the
      // view camera's forward direction. Keeping yaw at zero makes the
      // muzzle point straight ahead while recoil only raises it slightly.
      firstPersonRig.rotation.set(weaponRecoil * 0.08, 0, 0);
      for (let index = casingShells.length - 1; index >= 0; index -= 1) {
        const casing = casingShells[index];
        casing.age += delta;
        casing.velocity.y -= 3.7 * delta;
        casing.mesh.position.addScaledVector(casing.velocity, delta);
        casing.mesh.rotation.x += casing.spin.x * delta;
        casing.mesh.rotation.y += casing.spin.y * delta;
        casing.mesh.rotation.z += casing.spin.z * delta;
        if (casing.age >= 0.8 || casing.mesh.position.y < -1.7) {
          weaponScene.remove(casing.mesh);
          casing.mesh.geometry.dispose();
          casingShells.splice(index, 1);
        }
      }
      clouds.forEach((cloud, index) => {
        cloud.group.position.x += delta * cloud.speed;
        cloud.group.position.z =
          cloud.baseZ + Math.sin(elapsed * 0.055 + cloud.phase) * 3.2;
        cloud.group.position.y +=
          Math.sin(elapsed * 0.08 + index) * delta * 0.025;
        if (cloud.group.position.x > WORLD_MAX + 35)
          cloud.group.position.x = WORLD_MIN - 35;
      });
      if (activeRef.current && !pausedRef.current) {
        updateWaterFlow(delta);
        if (timeRef.current === "day") {
          wheatEntities.forEach((wheat) => {
            wheat.age = Math.min(1, wheat.age + delta / 55);
            wheat.group.scale.y = 0.45 + wheat.age * 0.7;
          });
        }
        updateMining(delta);
        updateSaplingGrowth(delta);
        animalNPCs.forEach((animal) => updateAnimalNPC(animal, delta, elapsed));
        banditNPCs.forEach((bandit) => updateBanditNPC(bandit, delta, elapsed));
        villagerNPCs.forEach((villager) => updateVillagerNPC(villager, delta, elapsed));
        animalSpawnTimer -= delta * (timeRef.current === "night" ? 0.35 : 1);
        if (animalSpawnTimer <= 0) {
          const spawned = trySpawnAnimal();
          const population = livingAnimalCount();
          animalSpawnTimer =
            population < 8
              ? 2 + spawnRandom() * 1.5
              : spawned
                ? 4 + spawnRandom() * 3.5
                : 3 + spawnRandom() * 2.5;
        }
        const isNight = timeRef.current === "night";
        // Night patrols replenish about twice as quickly, but the active
        // bandit cap above still prevents the world from becoming crowded.
        banditSpawnTimer -= delta * (isNight ? 3 : 0.65);
        if (banditSpawnTimer <= 0) {
          trySpawnBandit();
          banditSpawnTimer = isNight
            ? 3.5 + spawnRandom() * 2.5
            : 16 + spawnRandom() * 10;
        }
        const playerFootY = camera.position.y - EYE_HEIGHT;
        blockDropEntities.forEach((drop) => {
          if (!drop.active) return;
          drop.age += delta;
          drop.mesh.rotation.y += delta * 2.7;
          drop.mesh.rotation.x += delta * 0.45;
          if (!drop.settled) {
            drop.velocity.y -= 9.8 * delta;
            drop.mesh.position.addScaledVector(drop.velocity, delta);
            drop.baseY = blockDropGround(
              drop.mesh.position.x,
              drop.mesh.position.z,
              drop.mesh.position.y,
            );
            if (drop.mesh.position.y <= drop.baseY) {
              drop.mesh.position.y = drop.baseY;
              if (Math.abs(drop.velocity.y) > 0.75 && drop.age < 1.4) {
                drop.velocity.y = Math.abs(drop.velocity.y) * 0.28;
                drop.velocity.x *= 0.62;
                drop.velocity.z *= 0.62;
              } else {
                drop.velocity.set(0, 0, 0);
                drop.settled = true;
              }
            }
          } else {
            drop.mesh.position.y =
              drop.baseY + Math.sin(elapsed * 3.4 + drop.phase) * 0.1;
          }
          const pickupDistance =
            (drop.mesh.position.x - camera.position.x) ** 2 +
            (drop.mesh.position.y - (playerFootY + 0.72)) ** 2 +
            (drop.mesh.position.z - camera.position.z) ** 2;
          if (drop.age < 0.32 || pickupDistance >= 2.1) return;
          drop.active = false;
          scene.remove(drop.mesh);
          drop.mesh.geometry.dispose();
          blockDropRecords.delete(drop.record.id);
          saveEdits();
          playSound("pickup");
          callbacksRef.current.onBlockPickup(drop.record.kind, 1);
        });
        for (let index = blockDropEntities.length - 1; index >= 0; index -= 1)
          if (!blockDropEntities[index].active)
            blockDropEntities.splice(index, 1);
        lootEntities.forEach((loot) => {
          if (!loot.active) return;
          loot.group.rotation.y += delta * 2.4;
          loot.group.position.y =
            loot.baseY + Math.sin(elapsed * 3.2 + loot.phase) * 0.14;
          const pickupDistance =
            (loot.group.position.x - camera.position.x) ** 2 +
            (loot.group.position.y - (playerFootY + 0.75)) ** 2 +
            (loot.group.position.z - camera.position.z) ** 2;
          if (pickupDistance >= 2.15) return;
          loot.active = false;
          loot.group.visible = false;
          lootDropRecords.delete(loot.record.id);
          saveEdits();
          playSound("pickup");
          callbacksRef.current.onLoot(loot.record.kind, loot.record.amount);
        });
      }
      if (beeHealth > 0) {
        beeHurtTimer = Math.max(0, beeHurtTimer - delta);
        beeAggroTimer = Math.max(0, beeAggroTimer - delta);
        beeStingCooldown = Math.max(0, beeStingCooldown - delta);
        beeSpeechTimer = Math.max(0, beeSpeechTimer - delta);
        const aggro = beeAggroTimer > 0 && activeRef.current;
        const targetX = aggro
          ? camera.position.x
          : beeHome.x + Math.sin(elapsed * 1.3) * 1.7;
        const targetY = aggro
          ? camera.position.y - 0.35
          : beeHome.y + Math.sin(elapsed * 2.1) * 0.45;
        const targetZ = aggro
          ? camera.position.z
          : beeHome.z + Math.cos(elapsed * 1.05) * 1.25;
        const followSpeed = aggro ? 3.8 : 2.2;
        bee.position.x = THREE.MathUtils.lerp(
          bee.position.x,
          targetX,
          Math.min(1, delta * followSpeed),
        );
        bee.position.y = THREE.MathUtils.lerp(
          bee.position.y,
          targetY,
          Math.min(1, delta * followSpeed),
        );
        bee.position.z = THREE.MathUtils.lerp(
          bee.position.z,
          targetZ,
          Math.min(1, delta * followSpeed),
        );
        bee.rotation.y = Math.atan2(
          camera.position.x - bee.position.x,
          camera.position.z - bee.position.z,
        );
        bee.scale.setScalar(beeHurtTimer > 0 ? 1.22 : 1);
        if (
          beeSpeechTimer <= 0 &&
          bee.position.distanceTo(camera.position) < 4.8
        ) {
          beeSpeechTimer = 8;
          callbacksRef.current.onMessage("蜜蜂：嗡嗡～有花吗？按 F 喂我");
        }
        if (
          aggro &&
          beeStingCooldown <= 0 &&
          bee.position.distanceTo(camera.position) < 1.55
        ) {
          beeStingCooldown = 2.5;
          beeAggroTimer = 0;
          playSound("bee");
          callbacksRef.current.onDamage(2, "bee");
        }
      }
      beeCompanions.forEach((companion) => {
        const flutter = elapsed * 1.6 + companion.phase;
        const targetX = companion.home.x + Math.sin(flutter) * 1.8;
        const targetY = companion.home.y + Math.sin(flutter * 1.8) * 0.42;
        const targetZ = companion.home.z + Math.cos(flutter * 0.85) * 1.45;
        companion.group.position.x = THREE.MathUtils.lerp(
          companion.group.position.x,
          targetX,
          Math.min(1, delta * 2.5),
        );
        companion.group.position.y = THREE.MathUtils.lerp(
          companion.group.position.y,
          targetY,
          Math.min(1, delta * 2.5),
        );
        companion.group.position.z = THREE.MathUtils.lerp(
          companion.group.position.z,
          targetZ,
          Math.min(1, delta * 2.5),
        );
        companion.group.rotation.y = Math.atan2(
          targetX - companion.group.position.x,
          targetZ - companion.group.position.z,
        );
      });
      if (activeRef.current && !pausedRef.current) {
        moveForward.copy(forwardAxis).applyQuaternion(camera.quaternion);
        moveForward.y = 0;
        moveForward.normalize();
        moveRight.copy(rightAxis).applyQuaternion(camera.quaternion);
        moveRight.y = 0;
        moveRight.normalize();
        moveDirection.set(0, 0, 0);
        if (keys.has("KeyW")) moveDirection.add(moveForward);
        if (keys.has("KeyS")) moveDirection.sub(moveForward);
        if (keys.has("KeyD")) moveDirection.add(moveRight);
        if (keys.has("KeyA")) moveDirection.sub(moveRight);
        const moving = moveDirection.lengthSq() > 0;
        const sprinting =
          moving &&
          canSprintRef.current &&
          (keys.has("ShiftLeft") || keys.has("ShiftRight"));
        const targetFov = sprinting ? 78 : 72;
        const nextFov = THREE.MathUtils.lerp(
          camera.fov,
          targetFov,
          Math.min(1, delta * 8),
        );
        if (Math.abs(nextFov - camera.fov) > 0.01) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
        if (moving) {
          moveDirection.normalize();
          const speed = sprinting ? 7.8 : 4.8;
          // Hunger supports long exploration sessions: walking consumes very
          // little, and even sustained sprinting now takes roughly a minute
          // before costing one hunger point.
          hungerExhaustion += delta * (sprinting ? 0.08 : 0.02);
          const footY = camera.position.y - EYE_HEIGHT;
          const tryX = camera.position.x + moveDirection.x * speed * delta;
          const tryZ = camera.position.z + moveDirection.z * speed * delta;
          const groundX = surfaceForPlayer(tryX, camera.position.z, footY);
          if (
            groundX <= footY + 1.02 &&
            !bodyBlocked(tryX, camera.position.z, groundX)
          ) {
            camera.position.x = Math.max(
              WORLD_MIN + 1,
              Math.min(WORLD_MAX - 1, tryX),
            );
            if (groundX > footY && grounded)
              camera.position.y = groundX + EYE_HEIGHT;
          }
          const currentFoot = camera.position.y - EYE_HEIGHT;
          const groundZ = surfaceForPlayer(
            camera.position.x,
            tryZ,
            currentFoot,
          );
          if (
            groundZ <= currentFoot + 1.02 &&
            !bodyBlocked(camera.position.x, tryZ, groundZ)
          ) {
            camera.position.z = Math.max(
              WORLD_MIN + 1,
              Math.min(WORLD_MAX - 1, tryZ),
            );
            if (groundZ > currentFoot && grounded)
              camera.position.y = groundZ + EYE_HEIGHT;
          }
        }
        if (keys.has("Space") && grounded) {
          verticalVelocity = 7.1;
          grounded = false;
          hungerExhaustion += 0.04;
        }
        if (!grounded && verticalVelocity <= 0 && !falling) {
          falling = true;
          fallStartY = camera.position.y;
        }
        verticalVelocity -= 19.5 * delta;
        camera.position.y += verticalVelocity * delta;
        const footY = camera.position.y - EYE_HEIGHT;
        const ground = surfaceForPlayer(
          camera.position.x,
          camera.position.z,
          footY + 0.18,
        );
        if (footY <= ground && verticalVelocity <= 0) {
          if (falling) {
            const fallDistance = fallStartY - (ground + EYE_HEIGHT);
            const waterLanding = isWaterLanding(
              camera.position.x,
              camera.position.z,
              ground,
            );
            // Give players a wider safe landing range and make tall falls less
            // punishing, while retaining a cap for extreme drops.
            if (fallDistance > 4.5) {
              const normalDamage = Math.min(7, Math.ceil((fallDistance - 4) * 0.55));
              playSound("hurt");
              callbacksRef.current.onDamage(
                waterLanding
                  ? Math.max(1, Math.ceil(normalDamage * 0.2))
                  : normalDamage,
                waterLanding ? "fall-water" : "fall",
              );
            }
            falling = false;
          }
          camera.position.y = ground + EYE_HEIGHT;
          verticalVelocity = 0;
          grounded = true;
        } else if (Math.abs(footY - ground) > 0.08) grounded = false;

        if (hungerExhaustion >= 6) {
          const hungerUsed = Math.floor(hungerExhaustion / 6);
          hungerExhaustion %= 6;
          callbacksRef.current.onHungerUse(hungerUsed);
        }

        const target = currentHit();
        if (target) {
          highlight.position.set(
            target.block.x,
            target.block.y,
            target.block.z,
          );
          highlight.visible = true;
        } else highlight.visible = false;

        if (elapsed - lastPositionReport > 0.1) {
          lastPositionReport = elapsed;
          callbacksRef.current.onPosition({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          });
        }
      } else highlight.visible = false;

      shadowFrame = (shadowFrame + 1) % 3;
      if (shadowFrame === 0) renderer.shadowMap.needsUpdate = true;
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
    };
    animate();
    callbacksRef.current.onReady();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointerDrag);
      canvas.removeEventListener("pointercancel", endPointerDrag);
      canvas.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      const uniqueMaterials = new Set<THREE.Material>();
      const disposeRenderable = (object: THREE.Object3D) => {
        if (
          !(object instanceof THREE.Mesh) &&
          !(object instanceof THREE.LineSegments) &&
          !(object instanceof THREE.Points)
        )
          return;
        if (object.geometry !== voxelGeometry) object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material))
          material.forEach((entry) => uniqueMaterials.add(entry));
        else uniqueMaterials.add(material);
      };
      scene.traverse(disposeRenderable);
      weaponScene.traverse(disposeRenderable);
      casingMaterial.dispose();
      voxelGeometry.dispose();
      uniqueMaterials.forEach((material) => material.dispose());
      textureList.forEach((entry) => entry.dispose());
      if (audioContext) void audioContext.close();
      renderer.dispose();
    };
  }, [worldMap, worldSeed, worldVersion]);

  return (
    <canvas
      ref={canvasRef}
      className="voxel-canvas"
      aria-label="可操作的三维 Minecraft 风格体素世界"
      tabIndex={0}
    />
  );
}
