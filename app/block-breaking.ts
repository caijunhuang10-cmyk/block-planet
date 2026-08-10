export type BreakableBlockKind =
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

export type MiningToolKind =
  | "hand"
  | "woodPickaxe"
  | "woodSword"
  | "stonePickaxe"
  | "stoneSword"
  | "ironPickaxe"
  | "ironSword";

// 徒手破坏时间。数值按材质分层：植物和玻璃最快，土沙次之，
// 木材居中，石材、混凝土和矿石最慢。
export const BLOCK_BREAK_SECONDS: Readonly<Record<BreakableBlockKind, number>> = {
  grass: 0.75,
  wheat: 0.2,
  dirt: 0.65,
  stone: 3.6,
  wood: 1.8,
  planks: 1.2,
  sand: 0.5,
  water: Number.POSITIVE_INFINITY,
  leaves: 0.3,
  sapling: 0.12,
  woolBlock: 0.8,
  glass: 0.28,
  ironOre: 4.5,
  rubyOre: 5.4,
  coalOre: 3.8,
  coal: 0.3,
  torch: 0.15,
  concrete: 4.2,
  redConcrete: 4.2,
  yellowConcrete: 4.2,
  whiteConcrete: 4.2,
  purpleConcrete: 4.2,
  chest: 1.5,
  bed: 1.1,
};

const PICKAXE_EFFECTIVE_BLOCKS = new Set<BreakableBlockKind>([
  "stone",
  "ironOre",
  "rubyOre",
  "coalOre",
  "concrete",
  "redConcrete",
  "yellowConcrete",
  "whiteConcrete",
  "purpleConcrete",
]);

const PICKAXE_TIME_MULTIPLIER: Partial<Record<MiningToolKind, number>> = {
  woodPickaxe: 0.36,
  stonePickaxe: 0.22,
  ironPickaxe: 0.12,
};

export function getBlockBreakSeconds(
  block: BreakableBlockKind,
  tool: MiningToolKind,
) {
  const baseSeconds = BLOCK_BREAK_SECONDS[block];
  const pickaxeMultiplier = PICKAXE_TIME_MULTIPLIER[tool];
  if (!pickaxeMultiplier || !PICKAXE_EFFECTIVE_BLOCKS.has(block))
    return baseSeconds;
  return baseSeconds * pickaxeMultiplier;
}
