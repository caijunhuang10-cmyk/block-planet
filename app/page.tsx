"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VoxelWorld, {
  DAY_PHASE_SECONDS,
  type AnimalDropKind,
  type BlockKind,
  type ToolKind,
  type PlayerWeaponKind,
  type WeaponAmmo,
  type VillageChestLoot,
  type Weather,
  type WorldMapKind,
  type WorldTime,
  MAX_ANIMALS,
  ROCK_LAYER_DEPTH,
  SHOP_POSITIONS,
  WORLD_MAP_PRESETS,
  WORLD_SIZE,
} from "./VoxelWorld";

type Inventory = Record<BlockKind, number>;
type LootInventory = Record<AnimalDropKind, number>;
type ToolInventory = Record<Exclude<ToolKind, "hand">, number>;
type ToolDurability = Record<Exclude<ToolKind, "hand">, number>;
type ToolItemKind = Exclude<ToolKind, "hand">;
type WeaponKind = "pistol" | "rifle" | "shotgun";
type WeaponInventory = Record<WeaponKind, number>;
type PotionKind = "healthPotion" | "strengthPotion";
type ArmorKind = "leatherArmor" | "ironArmor" | "diamondArmor";
type PotionInventory = Record<PotionKind, number>;
type ArmorInventory = Record<ArmorKind, number>;
type InventoryItemKind =
  | BlockKind
  | AnimalDropKind
  | ToolItemKind
  | WeaponKind
  | PotionKind
  | ArmorKind;
type ChestStorage = Partial<Record<InventoryItemKind, number>>;
type PlayerStats = {
  mined: number;
  placed: number;
  wood: number;
  crafted: number;
  toolsCrafted: number;
  shopPurchases: number;
  villageLoot: number;
  beeFed: number;
  animalDefeats: number;
  banditDefeats: number;
  villagerDefeats: number;
  beeDefeats: number;
};
const formatSaveTime = (timestamp: number | null) => {
  if (!timestamp) return "旧版存档";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};
const createWorldSeed = () => Math.floor(100_000_000 + Math.random() * 900_000_000);
const TOOL_ITEMS: ToolItemKind[] = [
  "woodPickaxe",
  "woodSword",
  "stonePickaxe",
  "stoneSword",
  "ironPickaxe",
  "ironSword",
];
const TOOL_ITEM_SET = new Set<ToolKind>(TOOL_ITEMS);
const isToolItem = (item: unknown): item is ToolItemKind =>
  typeof item === "string" && TOOL_ITEM_SET.has(item as ToolKind);
const toolIconClasses = (tool: ToolItemKind) =>
  `${tool.endsWith("Pickaxe") ? "pickaxe" : "sword"} ${tool.startsWith("stone") ? "stone" : tool.startsWith("iron") ? "iron" : "wood"}`;

const BLOCKS: {
  kind: BlockKind;
  name: string;
  colors: [string, string, string];
}[] = [
  { kind: "grass", name: "草方块", colors: ["#6baa3f", "#765039", "#563821"] },
  { kind: "wheat", name: "小麦", colors: ["#e4bd4e", "#a87827", "#765021"] },
  { kind: "dirt", name: "泥土", colors: ["#916448", "#765039", "#55351f"] },
  { kind: "stone", name: "圆石", colors: ["#929791", "#6c716d", "#535853"] },
  { kind: "wood", name: "橡木原木", colors: ["#d5a35b", "#70451f", "#432916"] },
  {
    kind: "planks",
    name: "橡木木板",
    colors: ["#d8a35b", "#b97939", "#8d5228"],
  },
  { kind: "sand", name: "沙子", colors: ["#e0ce88", "#c1ad6c", "#a38e54"] },
  { kind: "water", name: "水", colors: ["#66b5db", "#3584b1", "#27698f"] },
  {
    kind: "leaves",
    name: "橡树树叶",
    colors: ["#4d8c3a", "#2f6c31", "#205027"],
  },
  {
    kind: "sapling",
    name: "橡树树苗",
    colors: ["#74ad4a", "#3f7c31", "#7b542e"],
  },
  {
    kind: "woolBlock",
    name: "白色羊毛方块",
    colors: ["#f8f6ee", "#d8d4c8", "#aaa59b"],
  },
  { kind: "glass", name: "玻璃", colors: ["#c2e9ec", "#80b9c4", "#5d94a4"] },
  { kind: "ironOre", name: "铁矿", colors: ["#ffd09a", "#c77942", "#713c27"] },
  {
    kind: "rubyOre",
    name: "红宝石矿",
    colors: ["#ffb3bd", "#d5163f", "#650b29"],
  },
  { kind: "coalOre", name: "煤矿", colors: ["#71808a", "#1d252d", "#080b0e"] },
  { kind: "coal", name: "煤炭", colors: ["#3d4248", "#17191d", "#07080a"] },
  { kind: "torch", name: "火把", colors: ["#ffb342", "#8b4c21", "#4a2916"] },
  { kind: "concrete", name: "混凝土", colors: ["#d7d4c9", "#b7b5ad", "#94938e"] },
  { kind: "redConcrete", name: "红色混凝土", colors: ["#f0787b", "#c9434d", "#932c38"] },
  { kind: "yellowConcrete", name: "黄色混凝土", colors: ["#ffe27b", "#d8ae38", "#a37b1d"] },
  { kind: "whiteConcrete", name: "白色混凝土", colors: ["#ffffff", "#e9e6da", "#c7c3b9"] },
  { kind: "purpleConcrete", name: "紫色混凝土", colors: ["#bd82de", "#8950ad", "#60347f"] },
  { kind: "chest", name: "箱子", colors: ["#d89b53", "#9b602b", "#63391d"] },
  { kind: "bed", name: "红色床", colors: ["#e87979", "#9d3545", "#642130"] },
];

const INITIAL_INVENTORY: Inventory = {
  grass: 32,
  wheat: 0,
  dirt: 32,
  stone: 24,
  wood: 16,
  planks: 32,
  sand: 16,
  water: 8,
  leaves: 16,
  sapling: 4,
  woolBlock: 0,
  glass: 12,
  ironOre: 0,
  rubyOre: 0,
  coalOre: 0,
  coal: 0,
  torch: 0,
  concrete: 0,
  redConcrete: 0,
  yellowConcrete: 0,
  whiteConcrete: 0,
  purpleConcrete: 0,
  chest: 0,
  bed: 0,
};
const EMPTY_INVENTORY: Inventory = {
  grass: 0,
  wheat: 0,
  dirt: 0,
  stone: 0,
  wood: 0,
  planks: 0,
  sand: 0,
  water: 0,
  leaves: 0,
  sapling: 0,
  woolBlock: 0,
  glass: 0,
  ironOre: 0,
  rubyOre: 0,
  coalOre: 0,
  coal: 0,
  torch: 0,
  concrete: 0,
  redConcrete: 0,
  yellowConcrete: 0,
  whiteConcrete: 0,
  purpleConcrete: 0,
  chest: 0,
  bed: 0,
};
const INITIAL_LOOT: LootInventory = {
  wool: 0,
  rawPork: 0,
  leather: 0,
  rawBeef: 0,
  poppy: 0,
  dandelion: 0,
  oxeyeDaisy: 0,
  allium: 0,
  honeycomb: 0,
  redDye: 0,
  yellowDye: 0,
  whiteDye: 0,
  purpleDye: 0,
  cookedPork: 0,
  cookedBeef: 0,
  bread: 0,
};
const INITIAL_TOOLS: ToolInventory = {
  woodPickaxe: 0,
  woodSword: 0,
  stonePickaxe: 0,
  stoneSword: 0,
  ironPickaxe: 0,
  ironSword: 0,
};
const TOOL_DURABILITY: Record<ToolItemKind, number> = {
  woodPickaxe: 59,
  woodSword: 59,
  stonePickaxe: 131,
  stoneSword: 131,
  ironPickaxe: 250,
  ironSword: 250,
};
const INITIAL_TOOL_DURABILITY: ToolDurability = {
  woodPickaxe: 0,
  woodSword: 0,
  stonePickaxe: 0,
  stoneSword: 0,
  ironPickaxe: 0,
  ironSword: 0,
};
const TOOL_NAMES: Record<ToolKind, string> = {
  hand: "空手",
  woodPickaxe: "木镐",
  woodSword: "木剑",
  stonePickaxe: "石镐",
  stoneSword: "石剑",
  ironPickaxe: "铁镐",
  ironSword: "铁剑",
};
const TOOL_RECIPES: Record<
  ToolItemKind,
  { head: BlockKind; headSlots: number[]; handleSlots: number[] }
> = {
  woodPickaxe: { head: "planks", headSlots: [0, 1, 2], handleSlots: [5, 9] },
  woodSword: { head: "planks", headSlots: [1, 5], handleSlots: [9] },
  stonePickaxe: { head: "stone", headSlots: [0, 1, 2], handleSlots: [5, 9] },
  stoneSword: { head: "stone", headSlots: [1, 5], handleSlots: [9] },
  ironPickaxe: { head: "ironOre", headSlots: [0, 1, 2], handleSlots: [5, 9] },
  ironSword: { head: "ironOre", headSlots: [1, 5], handleSlots: [9] },
};
const WEAPONS: {
  kind: WeaponKind;
  name: string;
  cost: number;
  className: string;
  role: string;
  description: string;
  power: string;
  handling: string;
}[] = [
  {
    kind: "pistol",
    name: "燧发手枪",
    cost: 3,
    className: "pistol",
    role: "轻便副武器",
    description: "价格最低，适合第一次交易与日常防身。",
    power: "中",
    handling: "灵活",
  },
  {
    kind: "rifle",
    name: "猎人步枪",
    cost: 6,
    className: "rifle",
    role: "远程精准",
    description: "射程与稳定性均衡，适合开阔地形探索。",
    power: "高",
    handling: "稳定",
  },
  {
    kind: "shotgun",
    name: "泵动霰弹枪",
    cost: 9,
    className: "shotgun",
    role: "近距离爆发",
    description: "昂贵但威力最强，适合近距离快速解决威胁。",
    power: "极高",
    handling: "沉重",
  },
];
const INITIAL_WEAPONS: WeaponInventory = { pistol: 0, rifle: 0, shotgun: 0 };
const INITIAL_AMMO: WeaponAmmo = { pistol: 24, rifle: 36, shotgun: 12 };
const FULL_WEAPON_GIFT_AMMO: WeaponAmmo = {
  pistol: 120,
  rifle: 120,
  shotgun: 60,
};
const EMPTY_AMMO: WeaponAmmo = { pistol: 0, rifle: 0, shotgun: 0 };
const POTIONS: { kind: PotionKind; name: string; cost: number; effect: string; className: string }[] = [
  { kind: "healthPotion", name: "生命恢复药剂", cost: 3, effect: "恢复 8 点生命", className: "health-potion" },
  { kind: "strengthPotion", name: "力量药剂", cost: 5, effect: "力量提升 30 秒", className: "strength-potion" },
];
const ARMORS: { kind: ArmorKind; name: string; cost: number; protection: number; className: string }[] = [
  { kind: "leatherArmor", name: "皮革护甲", cost: 4, protection: 2, className: "leather-armor" },
  { kind: "ironArmor", name: "铁制护甲", cost: 8, protection: 5, className: "iron-armor" },
  { kind: "diamondArmor", name: "钻石护甲", cost: 14, protection: 8, className: "diamond-armor" },
];
const INITIAL_POTIONS: PotionInventory = { healthPotion: 0, strengthPotion: 0 };
const INITIAL_ARMOR: ArmorInventory = { leatherArmor: 0, ironArmor: 0, diamondArmor: 0 };
const ARMOR_PROTECTION: Record<ArmorKind, number> = Object.fromEntries(
  ARMORS.map((armor) => [armor.kind, armor.protection]),
) as Record<ArmorKind, number>;
const FLOWER_DYES = {
  poppy: { kind: "redDye", name: "红色染料", concrete: "redConcrete" },
  dandelion: { kind: "yellowDye", name: "黄色染料", concrete: "yellowConcrete" },
  oxeyeDaisy: { kind: "whiteDye", name: "白色染料", concrete: "whiteConcrete" },
  allium: { kind: "purpleDye", name: "紫色染料", concrete: "purpleConcrete" },
} as const;
const LOOT_ITEMS: {
  kind: AnimalDropKind;
  name: string;
  className: string;
  food: number;
}[] = [
  { kind: "wool", name: "白色羊毛", className: "wool", food: 0 },
  { kind: "rawPork", name: "生猪排", className: "pork", food: 3 },
  { kind: "rawBeef", name: "生牛肉", className: "beef", food: 4 },
  { kind: "cookedPork", name: "烤猪排", className: "cooked-pork", food: 8 },
  { kind: "cookedBeef", name: "烤牛排", className: "cooked-beef", food: 10 },
  { kind: "bread", name: "面包", className: "bread", food: 5 },
  { kind: "leather", name: "皮革", className: "leather", food: 0 },
  { kind: "poppy", name: "虞美人", className: "poppy", food: 0 },
  { kind: "dandelion", name: "蒲公英", className: "dandelion", food: 0 },
  { kind: "oxeyeDaisy", name: "滨菊", className: "daisy", food: 0 },
  { kind: "allium", name: "绒球葱", className: "allium", food: 0 },
  { kind: "honeycomb", name: "蜜脾", className: "honeycomb", food: 0 },
  { kind: "redDye", name: "红色染料", className: "red-dye", food: 0 },
  { kind: "yellowDye", name: "黄色染料", className: "yellow-dye", food: 0 },
  { kind: "whiteDye", name: "白色染料", className: "white-dye", food: 0 },
  { kind: "purpleDye", name: "紫色染料", className: "purple-dye", food: 0 },
];
const SHOP_FOODS: {
  kind: "bread" | "cookedPork" | "cookedBeef";
  name: string;
  cost: number;
  food: number;
  className: string;
  description: string;
}[] = [
  { kind: "bread", name: "面包", cost: 1, food: 5, className: "bread", description: "随时可食用的村庄主食，也可通过小麦合成。" },
  { kind: "cookedPork", name: "烤猪排", cost: 2, food: 8, className: "cooked-pork", description: "香脆烤制的猪排，比面包更能填饱肚子。" },
  { kind: "cookedBeef", name: "烤牛排", cost: 3, food: 10, className: "cooked-beef", description: "高营养的热腾牛排，可大幅恢复饱食度。" },
];
const SHOP_AMMO: { weapon: WeaponKind; name: string; cost: number; amount: number; className: string }[] = [
  { weapon: "pistol", name: "手枪弹药包", cost: 1, amount: 12, className: "pistol" },
  { weapon: "rifle", name: "步枪弹药包", cost: 2, amount: 12, className: "rifle" },
  { weapon: "shotgun", name: "霰弹枪弹药包", cost: 2, amount: 6, className: "shotgun" },
];
const DEFAULT_INVENTORY_ORDER: InventoryItemKind[] = [
  ...BLOCKS.map((block) => block.kind),
  ...TOOL_ITEMS,
  ...WEAPONS.map((weapon) => weapon.kind),
  ...LOOT_ITEMS.map((item) => item.kind),
  ...POTIONS.map((item) => item.kind),
  ...ARMORS.map((item) => item.kind),
];
const INVENTORY_ITEM_SET = new Set<string>(DEFAULT_INVENTORY_ORDER);
const BLOCK_KIND_SET = new Set<BlockKind>(BLOCKS.map((block) => block.kind));
const LOOT_KIND_SET = new Set<AnimalDropKind>(
  LOOT_ITEMS.map((item) => item.kind),
);
const POTION_KIND_SET = new Set<PotionKind>(POTIONS.map((item) => item.kind));
const ARMOR_KIND_SET = new Set<ArmorKind>(ARMORS.map((item) => item.kind));
const WORLD_MAP_KIND_SET = new Set<WorldMapKind>(
  WORLD_MAP_PRESETS.map((map) => map.id),
);

const INVENTORY_KEY = "block-planet-webgl-inventory-v1";
const ONE_TIME_RUBY_GIFT_KEY = "block-planet-webgl-ruby-gift-v1";
// v5 reissues the one-time full loadout after the inventory-retention update,
// so saves that lost their earlier gift on death can receive it exactly once.
const ONE_TIME_WEAPON_GIFT_KEY = "block-planet-webgl-weapon-gift-v5";
const ENGINE_KEY = "block-planet-webgl-edits-v2";
const LEGACY_ENGINE_KEY = "block-planet-webgl-edits-v1";
const SPAWN = { x: 5, z: 17 };
const FULL_DAY_SECONDS = DAY_PHASE_SECONDS * 2;
const INITIAL_STATS: PlayerStats = {
  mined: 0,
  placed: 0,
  wood: 0,
  crafted: 0,
  toolsCrafted: 0,
  shopPurchases: 0,
  villageLoot: 0,
  beeFed: 0,
  animalDefeats: 0,
  banditDefeats: 0,
  villagerDefeats: 0,
  beeDefeats: 0,
};

function formatCycleTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function sendControl(code: string, pressed: boolean) {
  const event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
    code,
    bubbles: true,
  });
  Object.defineProperty(event, "blockPlanetVirtualControl", { value: true });
  window.dispatchEvent(event);
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [worldCreatorOpen, setWorldCreatorOpen] = useState(false);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [saveUpdatedAt, setSaveUpdatedAt] = useState<number | null>(null);
  const [worldMap, setWorldMap] = useState<WorldMapKind>("dawn-valley");
  const [selectedWorldMap, setSelectedWorldMap] =
    useState<WorldMapKind>("dawn-valley");
  const [worldSeed, setWorldSeed] = useState(20260810);
  const [selectedWorldSeed, setSelectedWorldSeed] = useState(20260810);
  const [paused, setPaused] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inventory, setInventory] = useState<Inventory>(INITIAL_INVENTORY);
  const [tools, setTools] = useState<ToolInventory>(INITIAL_TOOLS);
  const [weapons, setWeapons] = useState<WeaponInventory>(INITIAL_WEAPONS);
  const [potions, setPotions] = useState<PotionInventory>(INITIAL_POTIONS);
  const [armor, setArmor] = useState<ArmorInventory>(INITIAL_ARMOR);
  const [equippedArmor, setEquippedArmor] = useState<ArmorKind | null>(null);
  const [strengthUntil, setStrengthUntil] = useState(0);
  const [ammo, setAmmo] = useState<WeaponAmmo>(INITIAL_AMMO);
  const [toolDurability, setToolDurability] = useState<ToolDurability>(
    INITIAL_TOOL_DURABILITY,
  );
  const [equippedTool, setEquippedTool] = useState<ToolKind>("hand");
  const [selectedItem, setSelectedItem] = useState<InventoryItemKind>("grass");
  const [inventoryOrder, setInventoryOrder] = useState<InventoryItemKind[]>(
    DEFAULT_INVENTORY_ORDER,
  );
  const [draggedInventoryItem, setDraggedInventoryItem] =
    useState<InventoryItemKind | null>(null);
  const [craftingGrid, setCraftingGrid] = useState<(BlockKind | null)[]>(() =>
    Array<BlockKind | null>(16).fill(null),
  );
  const [loot, setLoot] = useState<LootInventory>(INITIAL_LOOT);
  const [chestStorage, setChestStorage] = useState<ChestStorage>({});
  const [position, setPosition] = useState({ x: 5, y: 8, z: 17 });
  const [respawnPoint, setRespawnPoint] = useState(SPAWN);
  const [cycleSeconds, setCycleSeconds] = useState(0);
  const [weather, setWeather] = useState<Weather>("clear");
  const [worldVersion, setWorldVersion] = useState(0);
  const [animalPopulation, setAnimalPopulation] = useState(0);
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [message, setMessage] = useState("正在生成体素世界…");
  const [messageVisible, setMessageVisible] = useState(true);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [hydrated, setHydrated] = useState(false);
  const messageTimer = useRef<number | null>(null);
  const cycleSecondsRef = useRef(0);
  const healthRef = useRef(20);
  const hungerRef = useRef(20);
  const ammoRef = useRef<WeaponAmmo>(INITIAL_AMMO);
  const strengthUntilRef = useRef(0);

  const selected = BLOCKS[selectedIndex];
  const activeWorldMap =
    WORLD_MAP_PRESETS.find((map) => map.id === worldMap) ?? WORLD_MAP_PRESETS[0];
  const equippedWeapon = WEAPONS.some((weapon) => weapon.kind === selectedItem)
    ? (selectedItem as PlayerWeaponKind)
    : null;
  const dead = started && health <= 0;
  const gameActive =
    started &&
    !dead &&
    !paused &&
    !inventoryOpen &&
    !tasksOpen &&
    !shopOpen &&
    !chestOpen;
  const worldTime: WorldTime =
    cycleSeconds < DAY_PHASE_SECONDS ? "day" : "night";
  const cycleProgress = cycleSeconds / FULL_DAY_SECONDS;
  const cycleSecondsLeft =
    DAY_PHASE_SECONDS - (cycleSeconds % DAY_PHASE_SECONDS);
  const distance = Math.floor(
    Math.hypot(position.x - SPAWN.x, position.z - SPAWN.z),
  );
  const nearestShop = SHOP_POSITIONS.reduce(
    (closest, shop) => {
      const distance = Math.hypot(
        position.x - shop.x,
        position.z - shop.z,
      );
      return distance < closest.distance ? { shop, distance } : closest;
    },
    { shop: SHOP_POSITIONS[0], distance: Number.POSITIVE_INFINITY },
  );
  const nearShop = nearestShop.distance < 7;
  const armorProtection = equippedArmor ? ARMOR_PROTECTION[equippedArmor] : 0;
  const strengthActive = strengthUntil > 0;

  const showMessage = useCallback((next: string) => {
    setMessage(next);
    setMessageVisible(true);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(
      () => setMessageVisible(false),
      2400,
    );
  }, []);

  const itemQuantity = useCallback(
    (item: InventoryItemKind) => {
      if (BLOCK_KIND_SET.has(item as BlockKind))
        return inventory[item as BlockKind];
      if (LOOT_KIND_SET.has(item as AnimalDropKind))
        return loot[item as AnimalDropKind];
      if (WEAPONS.some((weapon) => weapon.kind === item))
        return weapons[item as WeaponKind];
      if (POTION_KIND_SET.has(item as PotionKind))
        return potions[item as PotionKind];
      if (ARMOR_KIND_SET.has(item as ArmorKind))
        return armor[item as ArmorKind];
      return tools[item as ToolItemKind];
    },
    [armor, inventory, loot, potions, tools, weapons],
  );
  const visibleInventoryItems = useMemo(
    () => inventoryOrder.filter((item) => itemQuantity(item) > 0),
    [inventoryOrder, itemQuantity],
  );
  const hotbarItems = useMemo(
    () => visibleInventoryItems.slice(0, 9),
    [visibleInventoryItems],
  );
  const chestItems = useMemo(
    () => inventoryOrder.filter((item) => (chestStorage[item] ?? 0) > 0),
    [chestStorage, inventoryOrder],
  );
  const selectInventoryItem = useCallback(
    (item: InventoryItemKind) => {
      setSelectedItem(item);
      const blockIndex = BLOCKS.findIndex((block) => block.kind === item);
      if (blockIndex >= 0) {
        setSelectedIndex(blockIndex);
        setEquippedTool("hand");
        showMessage(`已选择 ${BLOCKS[blockIndex].name}`);
        return;
      }
      if (isToolItem(item)) {
        setEquippedTool(item);
        showMessage(`已装备 ${TOOL_NAMES[item]}`);
        return;
      }
      const lootItem = LOOT_ITEMS.find((entry) => entry.kind === item);
      if (lootItem) showMessage(`已选中 ${lootItem.name}`);
      const weapon = WEAPONS.find((entry) => entry.kind === item);
      if (weapon) {
        setEquippedTool("hand");
        showMessage(`已装备 ${weapon.name} · 已显示第一人称枪械`);
      }
      const potion = POTIONS.find((entry) => entry.kind === item);
      if (potion) showMessage(`已选中 ${potion.name}`);
      const armorItem = ARMORS.find((entry) => entry.kind === item);
      if (armorItem && armor[item as ArmorKind] > 0) {
        setEquippedArmor(armorItem.kind);
        showMessage(`已装备 ${armorItem.name}`);
      }
    },
    [armor, showMessage],
  );

  const setCyclePosition = useCallback((seconds: number) => {
    const normalized =
      ((seconds % FULL_DAY_SECONDS) + FULL_DAY_SECONDS) % FULL_DAY_SECONDS;
    cycleSecondsRef.current = normalized;
    setCycleSeconds(normalized);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(INVENTORY_KEY) ?? "null");
        setSaveEnabled(Boolean(saved));
        setSaveUpdatedAt(
          Number.isFinite(saved?.savedAt) ? Number(saved.savedAt) : null,
        );
        if (WORLD_MAP_KIND_SET.has(saved?.worldMap)) {
          setWorldMap(saved.worldMap as WorldMapKind);
          setSelectedWorldMap(saved.worldMap as WorldMapKind);
        }
        if (Number.isInteger(saved?.worldSeed) && saved.worldSeed > 0) {
          setWorldSeed(saved.worldSeed);
          setSelectedWorldSeed(saved.worldSeed);
        }
        const savedInventory = {
          ...(saved?.inventory ?? {}),
        } as Partial<Inventory> & { campfire?: number };
        delete savedInventory.campfire;
        const loadedInventory = { ...INITIAL_INVENTORY, ...savedInventory };
        if (!localStorage.getItem(ONE_TIME_RUBY_GIFT_KEY)) {
          loadedInventory.rubyOre += 20;
          localStorage.setItem(ONE_TIME_RUBY_GIFT_KEY, "claimed");
          setMessage("一次性补给已到账 · 红宝石 ×20");
          setMessageVisible(true);
        }
        setInventory(loadedInventory);
        if (saved?.loot) setLoot({ ...INITIAL_LOOT, ...saved.loot });
        if (saved?.chestStorage) {
          const savedChestStorage = {
            ...saved.chestStorage,
          } as ChestStorage & { campfire?: number };
          delete savedChestStorage.campfire;
          setChestStorage(savedChestStorage);
        }
        if (saved?.tools) {
          const loadedTools = { ...INITIAL_TOOLS, ...saved.tools };
          setTools(loadedTools);
          setToolDurability(
            Object.fromEntries(
              TOOL_ITEMS.map((tool) => [
                tool,
                saved?.toolDurability?.[tool] ??
                  (loadedTools[tool] > 0 ? TOOL_DURABILITY[tool] : 0),
              ]),
            ) as ToolDurability,
          );
        }
        const loadedWeapons = { ...INITIAL_WEAPONS, ...saved?.weapons };
        const loadedAmmo = { ...INITIAL_AMMO, ...saved?.ammo };
        const receivedWeaponGift = !localStorage.getItem(ONE_TIME_WEAPON_GIFT_KEY);
        if (receivedWeaponGift) {
          (Object.keys(loadedWeapons) as WeaponKind[]).forEach((weapon) => {
            // The grant is a loadout, not an extra copy of each gun.
            loadedWeapons[weapon] = Math.max(loadedWeapons[weapon], 1);
            loadedAmmo[weapon] = Math.max(
              loadedAmmo[weapon],
              FULL_WEAPON_GIFT_AMMO[weapon],
            );
          });
          localStorage.setItem(ONE_TIME_WEAPON_GIFT_KEY, "claimed");
          setSelectedItem("pistol");
          setEquippedTool("hand");
          setMessage("一次性满配武器补给已到账 · 全枪械各 ×1 · 子弹已装满");
          setMessageVisible(true);
        }
        setWeapons(loadedWeapons);
        if (saved?.potions) setPotions({ ...INITIAL_POTIONS, ...saved.potions });
        if (saved?.armor) setArmor({ ...INITIAL_ARMOR, ...saved.armor });
        if (ARMOR_KIND_SET.has(saved?.equippedArmor))
          setEquippedArmor(saved.equippedArmor as ArmorKind);
        setAmmo(loadedAmmo);
        ammoRef.current = loadedAmmo;
        if (isToolItem(saved?.equippedTool))
          setEquippedTool(saved.equippedTool);
        if (Array.isArray(saved?.inventoryOrder)) {
          const restored = saved.inventoryOrder.filter(
            (item: unknown, index: number, values: unknown[]) =>
              typeof item === "string" &&
              INVENTORY_ITEM_SET.has(item) &&
              values.indexOf(item) === index,
          ) as InventoryItemKind[];
          const orderedItems = [
            ...restored,
            ...DEFAULT_INVENTORY_ORDER.filter(
              (item) => !restored.includes(item),
            ),
          ];
          setInventoryOrder(
            receivedWeaponGift
              ? [
                  "pistol",
                  "rifle",
                  "shotgun",
                  ...orderedItems.filter(
                    (item) =>
                      item !== "pistol" &&
                      item !== "rifle" &&
                      item !== "shotgun",
                  ),
                ]
              : orderedItems,
          );
        } else if (receivedWeaponGift) {
          setInventoryOrder([
            "pistol",
            "rifle",
            "shotgun",
            ...DEFAULT_INVENTORY_ORDER.filter(
              (item) =>
                item !== "pistol" && item !== "rifle" && item !== "shotgun",
            ),
          ]);
        }
        if (saved?.stats)
          setStats({ ...INITIAL_STATS, ...saved.stats });
        if (Number.isFinite(saved?.health))
          setHealth(Math.max(0, Math.min(20, saved.health)));
        if (Number.isFinite(saved?.hunger))
          setHunger(Math.max(0, Math.min(20, saved.hunger)));
        if (
          Number.isFinite(saved?.respawnPoint?.x) &&
          Number.isFinite(saved?.respawnPoint?.z)
        )
          setRespawnPoint({ x: saved.respawnPoint.x, z: saved.respawnPoint.z });
      } catch {
        localStorage.removeItem(INVENTORY_KEY);
        setSaveEnabled(false);
        setSaveUpdatedAt(null);
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated || !saveEnabled || !started) return;
    const savedAt = Date.now();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify({
        savedAt,
        worldMap,
        worldSeed,
        inventory,
        loot,
        tools,
        weapons,
        potions,
        armor,
        equippedArmor,
        ammo,
        toolDurability,
        equippedTool,
        inventoryOrder,
        stats,
        health,
        hunger,
        chestStorage,
        respawnPoint,
      }),
    );
    setSaveUpdatedAt(savedAt);
  }, [
    equippedTool,
    health,
    hydrated,
    hunger,
    chestStorage,
    respawnPoint,
    inventory,
    inventoryOrder,
    loot,
    stats,
    toolDurability,
    tools,
    weapons,
    potions,
    armor,
    equippedArmor,
    ammo,
    saveEnabled,
    started,
    worldMap,
    worldSeed,
  ]);

  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);

  useEffect(() => {
    healthRef.current = health;
    hungerRef.current = hunger;
  }, [health, hunger]);

  useEffect(
    () => () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    },
    [],
  );

  const closePointerLock = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  useEffect(() => {
    if (dead) closePointerLock();
  }, [closePointerLock, dead]);

  useEffect(() => {
    if (!gameActive) return;
    const survivalTick = window.setInterval(() => {
      if (hungerRef.current <= 0) {
        setHealth((current) => Math.max(0, current - 1));
        showMessage("饥饿正在消耗生命值");
        return;
      }
      if (hungerRef.current >= 18 && healthRef.current < 20) {
        setHealth((current) => Math.min(20, current + 1));
        setHunger((current) => Math.max(0, current - 1));
        showMessage("饱食充足 · 生命值恢复 +1");
      }
    }, 4000);
    return () => window.clearInterval(survivalTick);
  }, [gameActive, showMessage]);

  useEffect(() => {
    if (!gameActive) return;
    let lastTick = performance.now();
    const cycleTimer = window.setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = (now - lastTick) / 1000;
      lastTick = now;
      const previous = cycleSecondsRef.current;
      const next = (previous + elapsedSeconds) % FULL_DAY_SECONDS;
      const previousPeriod = Math.floor(previous / DAY_PHASE_SECONDS);
      const nextPeriod = Math.floor(next / DAY_PHASE_SECONDS);
      cycleSecondsRef.current = next;
      setCycleSeconds(next);
      if (previousPeriod !== nextPeriod) {
        showMessage(
          nextPeriod === 0
            ? "旭日东升 · 新的一天开始了"
            : "夕阳西下 · 夜晚来临了",
        );
      }
    }, 1000);
    return () => window.clearInterval(cycleTimer);
  }, [gameActive, showMessage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!started) {
        if (event.code === "Enter" && ready) {
          setWorldCreatorOpen(false);
          setSavePickerOpen(true);
        }
        return;
      }
      if (
        event.code === "KeyW" &&
        !(event as KeyboardEvent & { blockPlanetVirtualControl?: boolean })
          .blockPlanetVirtualControl &&
        nearShop &&
        !shopOpen &&
        !inventoryOpen &&
        !tasksOpen &&
        !chestOpen &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePointerLock();
        setShopOpen(true);
        setPaused(false);
        return;
      }
      const number = Number(event.key);
      if (number >= 1 && number <= hotbarItems.length) {
        selectInventoryItem(hotbarItems[number - 1]);
      }
      if (event.code === "KeyE") {
        event.preventDefault();
        closePointerLock();
        setInventoryOpen((value) => !value);
        setTasksOpen(false);
        setPaused(false);
      }
      if (event.code === "KeyL") {
        event.preventDefault();
        closePointerLock();
        setTasksOpen((value) => !value);
        setInventoryOpen(false);
        setPaused(false);
      }
      if (event.code === "KeyT") {
        setCyclePosition(
          worldTime === "day"
            ? DAY_PHASE_SECONDS * 1.5
            : DAY_PHASE_SECONDS * 0.5,
        );
      }
      if (event.code === "Escape") {
        closePointerLock();
        if (shopOpen) {
          setShopOpen(false);
        } else if (chestOpen) {
          setChestOpen(false);
        } else if (inventoryOpen || tasksOpen) {
          setInventoryOpen(false);
          setTasksOpen(false);
        } else setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    closePointerLock,
    inventoryOpen,
    nearShop,
    ready,
    hotbarItems,
    selectInventoryItem,
    setCyclePosition,
    showMessage,
    started,
    shopOpen,
    chestOpen,
    tasksOpen,
    worldTime,
  ]);

  const handlePosition = useCallback(
    (next: { x: number; y: number; z: number }) => {
      setPosition(next);
    },
    [],
  );

  const handleMine = useCallback(
    (kind: BlockKind, dropped: boolean) => {
      setStats((current) => ({
        ...current,
        mined: current.mined + 1,
        wood: current.wood + (kind === "wood" ? 1 : 0),
      }));
      showMessage(
        dropped
          ? "方块已破坏 · 靠近掉落物即可拾取"
          : `${BLOCKS.find((block) => block.kind === kind)?.name ?? kind}未产生掉落 · ${kind === "rubyOre" ? "需要铁镐" : kind === "ironOre" ? "需要石镐或铁镐" : "需要任意镐"}`,
      );
    },
    [showMessage],
  );

  const handleBlockPickup = useCallback(
    (kind: BlockKind, amount: number) => {
      setInventory((current) => ({
        ...current,
        [kind]: current[kind] + amount,
      }));
      const name = BLOCKS.find((block) => block.kind === kind)?.name ?? kind;
      showMessage(`拾取 ${name} +${amount}`);
    },
    [showMessage],
  );

  const handlePlace = useCallback(
    (kind: BlockKind) => {
      setInventory((current) => ({
        ...current,
        [kind]: Math.max(0, current[kind] - 1),
      }));
      setStats((current) => ({ ...current, placed: current.placed + 1 }));
      showMessage(
        `已放置 ${BLOCKS.find((block) => block.kind === kind)?.name}`,
      );
    },
    [showMessage],
  );

  const handleLoot = useCallback(
    (kind: AnimalDropKind, amount: number) => {
      setLoot((current) => ({
        ...current,
        [kind]: current[kind] + amount,
      }));
      const name = LOOT_ITEMS.find((item) => item.kind === kind)?.name ?? kind;
      showMessage(`拾取 ${name} +${amount}`);
    },
    [showMessage],
  );

  const handleCombatDefeat = useCallback(
    (kind: "animal" | "bandit" | "villager" | "bee") => {
      setStats((current) => ({
        ...current,
        animalDefeats: current.animalDefeats + (kind === "animal" ? 1 : 0),
        banditDefeats: current.banditDefeats + (kind === "bandit" ? 1 : 0),
        villagerDefeats: current.villagerDefeats + (kind === "villager" ? 1 : 0),
        beeDefeats: current.beeDefeats + (kind === "bee" ? 1 : 0),
      }));
    },
    [],
  );

  const handleHungerUse = useCallback((amount: number) => {
    setHunger((current) => Math.max(0, current - amount));
  }, []);

  const handleDamage = useCallback(
    (amount: number, cause: "fall" | "fall-water" | "bee" | "bandit") => {
      const reducedAmount = Math.max(1, Math.ceil(amount * (1 - armorProtection * 0.045)));
      setHealth((current) => Math.max(0, current - reducedAmount));
      if (cause === "bee") showMessage(`被蜜蜂蜇伤 · -${reducedAmount} 生命`);
      else if (cause === "bandit")
        showMessage(`遭到劫匪袭击 · -${reducedAmount} 生命`);
      else if (cause === "fall-water")
        showMessage(`落入水中 · 护甲减伤 · -${reducedAmount} 生命`);
      else showMessage(`坠落伤害 -${reducedAmount} 生命`);
    },
    [armorProtection, showMessage],
  );

  const eatFood = (kind: AnimalDropKind) => {
    const food = LOOT_ITEMS.find((item) => item.kind === kind);
    if (!food?.food || loot[kind] <= 0) return;
    if (hunger >= 20) {
      showMessage("饥饿值已经满了");
      return;
    }
    setLoot((current) => ({ ...current, [kind]: current[kind] - 1 }));
    setHunger((current) => Math.min(20, current + food.food));
    showMessage(`食用${food.name} · 饥饿值 +${food.food}`);
  };
  const recordShopPurchase = () =>
    setStats((current) => ({
      ...current,
      shopPurchases: current.shopPurchases + 1,
    }));

  const tradeWeapon = (weapon: (typeof WEAPONS)[number]) => {
    if (inventory.rubyOre < weapon.cost) {
      showMessage(`红宝石不足 · 需要 ${weapon.cost} 颗`);
      return;
    }
    setInventory((current) => ({
      ...current,
      rubyOre: current.rubyOre - weapon.cost,
    }));
    setWeapons((current) => ({
      ...current,
      [weapon.kind]: current[weapon.kind] + 1,
    }));
    recordShopPurchase();
    showMessage(`交易完成 · 获得 ${weapon.name}`);
  };
  const tradePotion = (potion: (typeof POTIONS)[number]) => {
    if (inventory.rubyOre < potion.cost) {
      showMessage(`红宝石不足 · 需要 ${potion.cost} 颗`);
      return;
    }
    setInventory((current) => ({ ...current, rubyOre: current.rubyOre - potion.cost }));
    setPotions((current) => ({ ...current, [potion.kind]: current[potion.kind] + 1 }));
    recordShopPurchase();
    showMessage(`交易完成 · 获得 ${potion.name}`);
  };
  const tradeArmor = (item: (typeof ARMORS)[number]) => {
    if (inventory.rubyOre < item.cost) {
      showMessage(`红宝石不足 · 需要 ${item.cost} 颗`);
      return;
    }
    setInventory((current) => ({ ...current, rubyOre: current.rubyOre - item.cost }));
    setArmor((current) => ({ ...current, [item.kind]: current[item.kind] + 1 }));
    recordShopPurchase();
    showMessage(`交易完成 · 获得 ${item.name}`);
  };
  const tradeFood = (food: (typeof SHOP_FOODS)[number]) => {
    if (inventory.rubyOre < food.cost) {
      showMessage(`红宝石不足 · 需要 ${food.cost} 颗`);
      return;
    }
    setInventory((current) => ({ ...current, rubyOre: current.rubyOre - food.cost }));
    setLoot((current) => ({ ...current, [food.kind]: current[food.kind] + 1 }));
    recordShopPurchase();
    showMessage(`交易完成 · 获得 ${food.name}`);
  };
  const tradeAmmo = (item: (typeof SHOP_AMMO)[number]) => {
    if (inventory.rubyOre < item.cost) {
      showMessage(`红宝石不足 · 需要 ${item.cost} 颗`);
      return;
    }
    setInventory((current) => ({ ...current, rubyOre: current.rubyOre - item.cost }));
    setAmmo((current) => {
      const next = { ...current, [item.weapon]: current[item.weapon] + item.amount };
      ammoRef.current = next;
      return next;
    });
    recordShopPurchase();
    showMessage(`交易完成 · ${item.name} +${item.amount} 发`);
  };
  const consumePotion = (kind: PotionKind) => {
    if (potions[kind] <= 0) return;
    setPotions((current) => ({ ...current, [kind]: current[kind] - 1 }));
    if (kind === "healthPotion") {
      const restored = Math.min(8, 20 - health);
      setHealth((current) => Math.min(20, current + 8));
      showMessage(`饮用生命恢复药剂 · 生命 +${restored}`);
    } else {
      const until = Date.now() + 30_000;
      strengthUntilRef.current = until;
      setStrengthUntil(until);
      window.setTimeout(() => {
        if (strengthUntilRef.current === until) {
          strengthUntilRef.current = 0;
          setStrengthUntil(0);
        }
      }, 30_000);
      showMessage("饮用力量药剂 · 30 秒内攻击伤害提升");
    }
  };
  const equipArmor = (kind: ArmorKind) => {
    if (armor[kind] <= 0) return;
    setEquippedArmor(kind);
    showMessage(`已装备 ${ARMORS.find((item) => item.kind === kind)?.name}`);
  };

  const resetWorld = () => {
    closePointerLock();
    localStorage.removeItem(ENGINE_KEY);
    localStorage.removeItem(`${ENGINE_KEY}-random-world-${worldSeed}`);
    WORLD_MAP_PRESETS.forEach((map) =>
      localStorage.removeItem(`${ENGINE_KEY}-${map.id}`),
    );
    localStorage.removeItem(LEGACY_ENGINE_KEY);
    localStorage.removeItem(INVENTORY_KEY);
    setInventory(EMPTY_INVENTORY);
    setTools(INITIAL_TOOLS);
    setWeapons(INITIAL_WEAPONS);
    setPotions(INITIAL_POTIONS);
    setArmor(INITIAL_ARMOR);
    setEquippedArmor(null);
    setStrengthUntil(0);
    strengthUntilRef.current = 0;
    setAmmo(EMPTY_AMMO);
    ammoRef.current = EMPTY_AMMO;
    setToolDurability(INITIAL_TOOL_DURABILITY);
    setEquippedTool("hand");
    setSelectedItem("grass");
    setInventoryOrder(DEFAULT_INVENTORY_ORDER);
    setCraftingGrid(Array<BlockKind | null>(16).fill(null));
    setLoot(INITIAL_LOOT);
    setChestStorage({});
    setStats(INITIAL_STATS);
    setSelectedIndex(0);
    setCyclePosition(0);
    setWeather("clear");
    setRespawnPoint(SPAWN);
    setPosition({ x: SPAWN.x, y: 8, z: SPAWN.z });
    setAnimalPopulation(3);
    setHealth(20);
    setHunger(20);
    setWorldVersion((value) => value + 1);
    setPaused(false);
    setInventoryOpen(false);
    setTasksOpen(false);
    setShopOpen(false);
    setChestOpen(false);
    showMessage(`${activeWorldMap.name}已重新生成 · 物品栏已清空`);
  };

  const continueSave = () => {
    if (!saveEnabled) return;
    setWorldCreatorOpen(false);
    setSavePickerOpen(false);
    setStarted(true);
    showMessage("已载入自动存档 · 点击画面控制视角");
  };

  const startNewSave = () => {
    resetWorld();
    setWorldMap(selectedWorldMap);
    setWorldSeed(
      selectedWorldMap === "random-world" ? selectedWorldSeed : 20260810,
    );
    setSaveEnabled(true);
    setSaveUpdatedAt(Date.now());
    setSavePickerOpen(false);
    setStarted(true);
    showMessage("新存档已创建 · 点击画面控制视角");
  };

  const deleteSave = () => {
    if (!window.confirm("确定删除当前存档吗？世界与角色进度将无法恢复。"))
      return;
    setSaveEnabled(false);
    setSaveUpdatedAt(null);
    setWorldCreatorOpen(false);
    setWorldMap("dawn-valley");
    setSelectedWorldMap("dawn-valley");
    setWorldSeed(20260810);
    setSelectedWorldSeed(20260810);
    resetWorld();
    setSavePickerOpen(true);
    showMessage("存档已删除");
  };

  const openWorldCreator = () => {
    setSelectedWorldMap(worldMap);
    setSelectedWorldSeed(
      worldMap === "random-world" ? worldSeed : createWorldSeed(),
    );
    setWorldCreatorOpen(true);
    setSavePickerOpen(true);
  };

  const respawn = () => {
    // Death is a setback, not an inventory wipe: every player-held item and
    // equipped armor stays with the player at their configured respawn point.
    setStrengthUntil(0);
    strengthUntilRef.current = 0;
    setCraftingGrid(Array<BlockKind | null>(16).fill(null));
    setHealth(20);
    setHunger(14);
    setPosition({ x: respawnPoint.x, y: 8, z: respawnPoint.z });
    setWorldVersion((value) => value + 1);
    showMessage("已在设定的重生点重生 · 物品栏已保留");
  };

  const chapters = [
    {
      title: "第一章 · 活下去",
      summary: "熟悉移动、采集与基础建造。",
      goals: [
        { label: "探索山谷 30 格", value: distance, target: 30 },
        { label: "砍伐 5 块橡木", value: stats.wood, target: 5 },
        { label: "放置 5 个方块", value: stats.placed, target: 5 },
      ],
    },
    {
      title: "第二章 · 工匠起步",
      summary: "使用合成台式物品栏制作生存工具。",
      goals: [
        { label: "完成 2 次合成", value: stats.crafted, target: 2 },
        { label: "制作任意工具", value: stats.toolsCrafted, target: 1 },
        { label: "制作火把", value: inventory.torch, target: 1 },
      ],
    },
    {
      title: "第三章 · 深入矿层",
      summary: "升级采矿能力，寻找地下资源。",
      goals: [
        { label: "破坏 12 个方块", value: stats.mined, target: 12 },
        { label: "获得煤炭", value: inventory.coal + inventory.coalOre, target: 1 },
        { label: "获得铁矿", value: inventory.ironOre, target: 1 },
        { label: "获得红宝石", value: inventory.rubyOre, target: 1 },
      ],
    },
    {
      title: "第四章 · 村庄日常",
      summary: "与蜜蜂、农田和村庄居民互动。",
      goals: [
        { label: "喂蜜蜂一朵花", value: stats.beeFed, target: 1 },
        { label: "收获小麦或面包", value: inventory.wheat + loot.bread, target: 1 },
        { label: "开启村庄战利品箱", value: stats.villageLoot, target: 1 },
      ],
    },
    {
      title: "第五章 · 商队贸易",
      summary: "用红宝石补齐远行装备。",
      goals: [
        { label: "购买 2 件商店商品", value: stats.shopPurchases, target: 2 },
        { label: "获得任意护甲", value: ARMORS.reduce((total, item) => total + armor[item.kind], 0), target: 1 },
        { label: "购买任意枪械", value: WEAPONS.reduce((total, item) => total + weapons[item.kind], 0), target: 1 },
      ],
    },
    {
      title: "第六章 · 荒野战斗",
      summary: "掌握近战、枪械与夜间防卫。",
      goals: [
        { label: "击败 3 个动物", value: stats.animalDefeats, target: 3 },
        { label: "击败一名劫匪", value: stats.banditDefeats, target: 1 },
        { label: "探索至出生点外 100 格", value: distance, target: 100 },
      ],
    },
  ];
  const objectives = chapters.flatMap((chapter) => chapter.goals);
  const completed = objectives.filter((item) => item.value >= item.target).length;
  const activeChapter =
    chapters.find((chapter) =>
      chapter.goals.some((goal) => goal.value < goal.target),
    ) ?? chapters[chapters.length - 1];
  const activeObjectives = activeChapter.goals;
  const craftingIngredients = craftingGrid.filter(
    (kind): kind is BlockKind => kind !== null,
  );
  const woodInGrid = craftingIngredients.filter(
    (kind) => kind === "wood",
  ).length;
  const hasPlankRecipe = craftingIngredients.length === 1 && woodInGrid === 1;
  const hasBreadRecipe =
    craftingIngredients.length === 3 &&
    craftingIngredients.every((kind) => kind === "wheat");
  const hasBedRecipe =
    craftingIngredients.length === 6 &&
    craftingIngredients.filter((kind) => kind === "woolBlock").length === 3 &&
    craftingIngredients.filter((kind) => kind === "planks").length === 3;
  const matchesToolRecipe = (tool: ToolItemKind) => {
    const recipe = TOOL_RECIPES[tool];
    const expectedCount = recipe.headSlots.length + recipe.handleSlots.length;
    return (
      craftingIngredients.length === expectedCount &&
      recipe.headSlots.every((slot) => craftingGrid[slot] === recipe.head) &&
      recipe.handleSlots.every((slot) => craftingGrid[slot] === "planks")
    );
  };
  const matchedToolRecipe = TOOL_ITEMS.find(matchesToolRecipe) ?? null;
  const hasTorchRecipe =
    craftingIngredients.length === 2 &&
    craftingGrid[1] === "coal" &&
    craftingGrid[5] === "planks";
  const craftingRecipe = hasPlankRecipe
    ? "planks"
    : hasBreadRecipe
    ? "bread"
      : hasBedRecipe
        ? "bed"
      : matchedToolRecipe
      ? matchedToolRecipe
      : hasTorchRecipe
        ? "torch"
        : null;
  const placeCraftingIngredient = (slotIndex: number) => {
    setCraftingGrid((current) => {
      const next = [...current];
      if (next[slotIndex]) {
        next[slotIndex] = null;
        return next;
      }
      const reserved = current.filter((kind) => kind === selected.kind).length;
      if (reserved >= inventory[selected.kind]) {
        showMessage(`${selected.name}数量不足`);
        return current;
      }
      next[slotIndex] = selected.kind;
      return next;
    });
  };
  const dismantleWood = () => {
    if (inventory.wood < 1) {
      showMessage("原木不足 · 需要至少 1 个橡木原木");
      return;
    }
    setInventory((current) => ({
      ...current,
      wood: current.wood - 1,
      planks: current.planks + 4,
    }));
    setCraftingGrid(Array<BlockKind | null>(16).fill(null));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("拆解完成 · 橡木木板 +4");
  };
  const craftTorchDirect = () => {
    if (inventory.coal < 1 || inventory.planks < 1) {
      showMessage("材料不足 · 需要 1 煤炭 + 1 木板");
      return;
    }
    setInventory((current) => ({
      ...current,
      coal: current.coal - 1,
      planks: current.planks - 1,
      torch: current.torch + 4,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 火把 ×4");
  };
  const craftBreadDirect = () => {
    if (inventory.wheat < 3) {
      showMessage("小麦不足 · 需要 3 个小麦");
      return;
    }
    setInventory((current) => ({ ...current, wheat: current.wheat - 3 }));
    setLoot((current) => ({ ...current, bread: current.bread + 1 }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 面包 ×1");
  };
  const craftBedDirect = () => {
    if (inventory.woolBlock < 3 || inventory.planks < 3) {
      showMessage("材料不足 · 需要 3 白色羊毛方块 + 3 木板");
      return;
    }
    setInventory((current) => ({
      ...current,
      woolBlock: current.woolBlock - 3,
      planks: current.planks - 3,
      bed: current.bed + 1,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 红色床 ×1 · 夜晚可睡觉设置重生点");
  };
  const canCraftTool = (tool: ToolItemKind) => {
    const recipe = TOOL_RECIPES[tool];
    const headCost = recipe.headSlots.length;
    const plankCost = recipe.handleSlots.length +
      (recipe.head === "planks" ? headCost : 0);
    return (
      inventory.planks >= plankCost &&
      (recipe.head === "planks" || inventory[recipe.head] >= headCost)
    );
  };
  const craftToolDirect = (tool: ToolItemKind) => {
    if (!canCraftTool(tool)) {
      const recipe = TOOL_RECIPES[tool];
      const headName = BLOCKS.find((block) => block.kind === recipe.head)?.name;
      showMessage(`材料不足 · 需要 ${recipe.headSlots.length} ${headName} + ${recipe.handleSlots.length} 木板`);
      return;
    }
    const recipe = TOOL_RECIPES[tool];
    const headCost = recipe.headSlots.length;
    const handleCost = recipe.handleSlots.length;
    setInventory((current) => {
      const next = { ...current, planks: current.planks - handleCost };
      next[recipe.head] -= headCost;
      return next;
    });
    setTools((current) => ({ ...current, [tool]: current[tool] + 1 }));
    if (tools[tool] === 0)
      setToolDurability((current) => ({
        ...current,
        [tool]: TOOL_DURABILITY[tool],
      }));
    setEquippedTool(tool);
    setStats((current) => ({
      ...current,
      crafted: current.crafted + 1,
      toolsCrafted: current.toolsCrafted + 1,
    }));
    showMessage(`合成完成并装备 · ${TOOL_NAMES[tool]} +1`);
  };
  const craftConcrete = () => {
    if (inventory.sand < 4) {
      showMessage("沙子不足 · 需要 4 个沙子");
      return;
    }
    setInventory((current) => ({
      ...current,
      sand: current.sand - 4,
      concrete: current.concrete + 4,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 混凝土 ×4");
  };
  const craftChest = () => {
    if (inventory.planks < 8) {
      showMessage("木板不足 · 需要 8 个木板");
      return;
    }
    setInventory((current) => ({
      ...current,
      planks: current.planks - 8,
      chest: current.chest + 1,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 箱子 +1");
  };
  const craftWoolBlock = () => {
    if (loot.wool < 4) {
      showMessage("羊毛不足 · 需要 4 个白色羊毛");
      return;
    }
    setLoot((current) => ({ ...current, wool: current.wool - 4 }));
    setInventory((current) => ({
      ...current,
      woolBlock: current.woolBlock + 1,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage("合成完成 · 白色羊毛方块 +1");
  };
  const changeOwnedItem = (item: InventoryItemKind, delta: number) => {
    if (BLOCK_KIND_SET.has(item as BlockKind)) {
      setInventory((current) => ({ ...current, [item]: current[item as BlockKind] + delta }));
    } else if (LOOT_KIND_SET.has(item as AnimalDropKind)) {
      setLoot((current) => ({ ...current, [item]: current[item as AnimalDropKind] + delta }));
    } else if (WEAPONS.some((weapon) => weapon.kind === item)) {
      setWeapons((current) => ({ ...current, [item]: current[item as WeaponKind] + delta }));
    } else {
      setTools((current) => ({ ...current, [item]: current[item as ToolItemKind] + delta }));
    }
  };
  const storeSelectedItem = () => {
    if (itemQuantity(selectedItem) < 1) return;
    changeOwnedItem(selectedItem, -1);
    setChestStorage((current) => ({
      ...current,
      [selectedItem]: (current[selectedItem] ?? 0) + 1,
    }));
    showMessage("已存入箱子 · 物品栏与箱子均会保存");
  };
  const takeChestItem = (item: InventoryItemKind) => {
    if ((chestStorage[item] ?? 0) < 1) return;
    changeOwnedItem(item, 1);
    setChestStorage((current) => ({
      ...current,
      [item]: Math.max(0, (current[item] ?? 0) - 1),
    }));
    showMessage("已从箱子取出物品");
  };
  const extractFlowerDye = (flower: keyof typeof FLOWER_DYES) => {
    const recipe = FLOWER_DYES[flower];
    if (loot[flower] < 1) return;
    setLoot((current) => ({
      ...current,
      [flower]: current[flower] - 1,
      [recipe.kind]: current[recipe.kind] + 1,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage(`拆解完成 · ${recipe.name} +1`);
  };
  const dyeConcrete = (dye: keyof typeof FLOWER_DYES) => {
    const recipe = FLOWER_DYES[dye];
    if (inventory.concrete < 1 || loot[recipe.kind] < 1) {
      showMessage(`材料不足 · 需要 1 混凝土 + 1 ${recipe.name}`);
      return;
    }
    setInventory((current) => ({
      ...current,
      concrete: current.concrete - 1,
      [recipe.concrete]: current[recipe.concrete] + 1,
    }));
    setLoot((current) => ({
      ...current,
      [recipe.kind]: current[recipe.kind] - 1,
    }));
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    showMessage(`染色完成 · ${BLOCKS.find((block) => block.kind === recipe.concrete)?.name} +1`);
  };
  const craftRecipe = () => {
    if (!craftingRecipe) {
      showMessage("当前排列没有匹配的配方");
      return;
    }
    if (craftingRecipe === "planks") {
      if (inventory.wood < 1) return;
      setInventory((current) => ({
        ...current,
        wood: current.wood - 1,
        planks: current.planks + 4,
      }));
      showMessage("拆解完成 · 橡木木板 +4");
    } else if (craftingRecipe === "torch") {
      if (inventory.coal < 1 || inventory.planks < 1) return;
      setInventory((current) => ({
        ...current,
        coal: current.coal - 1,
        planks: current.planks - 1,
        torch: current.torch + 4,
      }));
      showMessage("合成完成 · 火把 ×4");
    } else if (craftingRecipe === "bread") {
      if (inventory.wheat < 3) return;
      setInventory((current) => ({
        ...current,
        wheat: current.wheat - 3,
      }));
      setLoot((current) => ({ ...current, bread: current.bread + 1 }));
      showMessage("合成完成 · 面包 ×1");
    } else if (craftingRecipe === "bed") {
      if (inventory.woolBlock < 3 || inventory.planks < 3) return;
      setInventory((current) => ({
        ...current,
        woolBlock: current.woolBlock - 3,
        planks: current.planks - 3,
        bed: current.bed + 1,
      }));
      showMessage("合成完成 · 红色床 ×1 · 夜晚可睡觉设置重生点");
    } else {
      const toolRecipe = TOOL_RECIPES[craftingRecipe];
      const headCost = toolRecipe.headSlots.length;
      const handleCost = toolRecipe.handleSlots.length;
      setInventory((current) => {
        const next = { ...current, planks: current.planks - handleCost };
        next[toolRecipe.head] -= headCost;
        return next;
      });
      setTools((current) => ({
        ...current,
        [craftingRecipe]: current[craftingRecipe] + 1,
      }));
      if (tools[craftingRecipe] === 0)
        setToolDurability((current) => ({
          ...current,
          [craftingRecipe]: TOOL_DURABILITY[craftingRecipe],
        }));
      setEquippedTool(craftingRecipe);
      setStats((current) => ({
        ...current,
        toolsCrafted: current.toolsCrafted + 1,
      }));
      showMessage(`合成完成并装备 · ${TOOL_NAMES[craftingRecipe]} +1`);
    }
    setStats((current) => ({ ...current, crafted: current.crafted + 1 }));
    setCraftingGrid(Array<BlockKind | null>(16).fill(null));
  };
  const craftFromRecipeBook = (recipeId: string) => {
    if (recipeId === "planks") return dismantleWood();
    if (recipeId === "torch") return craftTorchDirect();
    if (recipeId === "bread") return craftBreadDirect();
    if (recipeId === "bed") return craftBedDirect();
    if (recipeId === "concrete") return craftConcrete();
    if (recipeId === "chest") return craftChest();
    if (recipeId === "woolBlock") return craftWoolBlock();
    if (TOOL_ITEMS.includes(recipeId as ToolItemKind))
      return craftToolDirect(recipeId as ToolItemKind);
    if (recipeId.startsWith("dye:")) {
      const flower = recipeId.slice(4) as keyof typeof FLOWER_DYES;
      return dyeConcrete(flower);
    }
    if (recipeId.startsWith("extract:")) {
      const flower = recipeId.slice(8) as keyof typeof FLOWER_DYES;
      return extractFlowerDye(flower);
    }
  };
  const recipeBookEntries = [
    {
      id: "planks",
      name: "橡木木板",
      formula: "1 橡木原木 → 4 木板",
      available: inventory.wood >= 1,
    },
    {
      id: "torch",
      name: "火把",
      formula: "1 煤炭 + 1 木板 → 4 火把",
      available: inventory.coal >= 1 && inventory.planks >= 1,
    },
    {
      id: "bread",
      name: "面包",
      formula: "3 小麦 → 1 面包",
      available: inventory.wheat >= 3,
    },
    {
      id: "woolBlock",
      name: "白色羊毛方块",
      formula: "4 白色羊毛 → 1 羊毛方块",
      available: loot.wool >= 4,
    },
    {
      id: "bed",
      name: "红色床",
      formula: "3 羊毛方块 + 3 木板 → 1 红色床",
      available: inventory.woolBlock >= 3 && inventory.planks >= 3,
    },
    {
      id: "concrete",
      name: "混凝土",
      formula: "4 沙子 → 4 混凝土",
      available: inventory.sand >= 4,
    },
    {
      id: "chest",
      name: "箱子",
      formula: "8 木板 → 1 箱子",
      available: inventory.planks >= 8,
    },
    ...TOOL_ITEMS.map((tool) => {
      const recipe = TOOL_RECIPES[tool];
      const headName = BLOCKS.find((block) => block.kind === recipe.head)?.name;
      return {
        id: tool,
        name: TOOL_NAMES[tool],
        formula:
          recipe.head === "planks"
            ? `${recipe.headSlots.length + recipe.handleSlots.length} 木板 → 1 ${TOOL_NAMES[tool]}`
            : `${recipe.headSlots.length} ${headName} + ${recipe.handleSlots.length} 木板 → 1 ${TOOL_NAMES[tool]}`,
        available: canCraftTool(tool),
      };
    }),
    ...(Object.entries(FLOWER_DYES) as Array<
      [keyof typeof FLOWER_DYES, (typeof FLOWER_DYES)[keyof typeof FLOWER_DYES]]
    >).flatMap(([flower, recipe]) => [
      {
        id: `extract:${flower}`,
        name: recipe.name,
        formula: `1 ${LOOT_ITEMS.find((item) => item.kind === flower)?.name} → 1 ${recipe.name}`,
        available: loot[flower] >= 1,
      },
      {
        id: `dye:${flower}`,
        name: `${BLOCKS.find((block) => block.kind === recipe.concrete)?.name}`,
        formula: `1 混凝土 + 1 ${recipe.name} → 1 ${BLOCKS.find((block) => block.kind === recipe.concrete)?.name}`,
        available: inventory.concrete >= 1 && loot[recipe.kind] >= 1,
      },
    ]),
  ];
  const handleToolUse = useCallback(
    (tool: Exclude<ToolKind, "hand">) => {
      const currentDurability = toolDurability[tool];
      if (currentDurability > 1) {
        setToolDurability((current) => ({
          ...current,
          [tool]: current[tool] - 1,
        }));
        return;
      }
      const remainingTools = Math.max(0, tools[tool] - 1);
      setTools((current) => ({ ...current, [tool]: remainingTools }));
      setToolDurability((current) => ({
        ...current,
          [tool]: remainingTools > 0 ? TOOL_DURABILITY[tool] : 0,
      }));
      if (remainingTools === 0) setEquippedTool("hand");
      showMessage(
        remainingTools > 0
          ? `${TOOL_NAMES[tool]}已损坏 · 自动装备备用工具`
          : `${TOOL_NAMES[tool]}已损坏 · 已切换为空手`,
      );
    },
    [showMessage, toolDurability, tools],
  );
  const handleWeaponFire = useCallback(
    (weapon: PlayerWeaponKind) => {
      const remaining = ammoRef.current[weapon];
      if (remaining <= 0) {
        showMessage("弹匣已空 · 需要补充子弹");
        return false;
      }
      const nextAmmo = { ...ammoRef.current, [weapon]: remaining - 1 };
      ammoRef.current = nextAmmo;
      setAmmo(nextAmmo);
      return true;
    },
    [showMessage],
  );
  const handleBeeFeed = useCallback(() => {
    const flowers: Array<AnimalDropKind> = [
      "poppy",
      "dandelion",
      "oxeyeDaisy",
      "allium",
    ];
    const flower = flowers.find((kind) => loot[kind] > 0);
    if (!flower) {
      showMessage("蜜蜂：嗡嗡……我想吃花（需要花朵）");
      return false;
    }
    setLoot((current) => ({ ...current, [flower]: current[flower] - 1 }));
    setStats((current) => ({ ...current, beeFed: current.beeFed + 1 }));
    if (Math.random() < 0.38) {
      const reward = Math.random() < 0.2 ? 2 : 1;
      setInventory((current) => ({
        ...current,
        rubyOre: current.rubyOre + reward,
      }));
      showMessage(`蜜蜂：谢谢花花！送你红宝石 ×${reward}`);
    } else showMessage("蜜蜂：谢谢花花！今天没有找到红宝石");
    return true;
  }, [loot, showMessage]);
  const handleBedSleep = useCallback(
    (bed: { x: number; z: number }) => {
      if (worldTime !== "night") {
        showMessage("现在还不能睡觉 · 只能在夜晚使用床");
        return false;
      }
      const nextRespawn = { x: bed.x, z: bed.z + 2 };
      setRespawnPoint(nextRespawn);
      setCyclePosition(DAY_PHASE_SECONDS * 0.08);
      showMessage("一夜安眠 · 已跳过夜晚并设置新的重生点");
      return true;
    },
    [setCyclePosition, showMessage, worldTime],
  );
  const moveInventoryItem = (
    source: InventoryItemKind,
    target: InventoryItemKind,
  ) => {
    if (source === target) return;
    setInventoryOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(source);
      const targetIndex = next.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];
      return next;
    });
  };

  return (
    <main className={`game-shell time-${worldTime}`}>
      <VoxelWorld
        active={gameActive}
        paused={!gameActive}
        selected={selected.kind}
        available={inventory[selected.kind]}
        equippedTool={equippedTool}
        equippedWeapon={equippedWeapon}
        strengthMultiplier={strengthActive ? 1.6 : 1}
        onWeaponFire={handleWeaponFire}
        onBeeFeed={handleBeeFeed}
        canSprint={hunger > 6}
        time={worldTime}
        cycleProgress={cycleProgress}
        worldVersion={worldVersion}
        worldMap={worldMap}
        worldSeed={worldSeed}
        respawnPoint={respawnPoint}
        onReady={() => {
          setReady(true);
          setMessage(`${activeWorldMap.name}已生成`);
        }}
        onPosition={handlePosition}
        onMine={handleMine}
        onBlockPickup={handleBlockPickup}
        onPlace={handlePlace}
        onLoot={handleLoot}
        onCombatDefeat={handleCombatDefeat}
        onAnimalPopulation={setAnimalPopulation}
        onHungerUse={handleHungerUse}
        onDamage={handleDamage}
        onToolUse={handleToolUse}
        onMessage={showMessage}
        onLockChange={() => undefined}
        onWeatherChange={setWeather}
        onBedSleep={handleBedSleep}
        onChestOpen={(villageLoot?: VillageChestLoot) => {
          closePointerLock();
          if (villageLoot) {
            setStats((current) => ({
              ...current,
              villageLoot: current.villageLoot + 1,
            }));
            setChestStorage((current) => {
              const next = { ...current };
              villageLoot.forEach(({ kind, amount }) => {
                next[kind] = (next[kind] ?? 0) + amount;
              });
              return next;
            });
            showMessage(
              `战利品已放入箱子：${villageLoot
                .map(({ kind, amount }) => `${BLOCKS.find((block) => block.kind === kind)?.name ?? WEAPONS.find((weapon) => weapon.kind === kind)?.name ?? kind} ×${amount}`)
                .join("、")}`,
            );
          }
          setChestOpen(true);
          setInventoryOpen(false);
          if (!villageLoot) showMessage("箱子已打开 · 可存取全部物品");
        }}
      />

      {started && (
        <div className="game-hud" aria-label="生存模式界面">
          <div className="debug-hud">
            <b>方块星球 · WebGL 生存模式</b>
            <span>
              XYZ {position.x.toFixed(1)} / {position.y.toFixed(1)} /{" "}
              {position.z.toFixed(1)}
            </span>
            <span>
              {activeWorldMap.name} · {weather === "rain" ? "下雨" : "晴朗"} · {worldTime === "day" ? "白天" : "夜晚"} · 距离
              {worldTime === "day" ? "夜晚" : "白天"}{" "}
              {formatCycleTime(cycleSecondsLeft)}
            </span>
            <span>
              地图 {WORLD_SIZE} × {WORLD_SIZE} 方块
            </span>
            <span className="shop-coordinate-marker">
              商店坐标：{SHOP_POSITIONS.map((shop) => `${shop.label} (${shop.x}, ${shop.z})`).join(" · ")}
            </span>
            <span>岩层 {ROCK_LAYER_DEPTH} 格 · 基岩不可破坏</span>
            <span>红宝石矿提示 X 8 / Z 15 · 地表下约 12 格 · 需铁镐</span>
            <span>
              动物 {animalPopulation}/{MAX_ANIMALS} · 草地自然生成
            </span>
            <span>
              生命 {health}/20 · 饥饿 {hunger}/20
            </span>
            <span>
              装备 {equippedWeapon
                ? `${WEAPONS.find((weapon) => weapon.kind === equippedWeapon)?.name ?? equippedWeapon} · 子弹 ${ammo[equippedWeapon]}`
                : TOOL_NAMES[equippedTool]}
            </span>
            <span>重生点 X {respawnPoint.x} / Z {respawnPoint.z}</span>
          </div>

          <button
            className="objective-card"
            onClick={() => {
              closePointerLock();
              setTasksOpen(true);
            }}
          >
            <div className="objective-card-heading">
              <small>{activeChapter.title}</small>
              <strong>{completed}/{objectives.length}</strong>
            </div>
            <b className="objective-active-label">
              {activeObjectives.find((item) => item.value < item.target)?.label ??
                "本章任务完成"}
            </b>
            <div className="objective-overall-track"><i style={{ width: `${(completed / objectives.length) * 100}%` }} /></div>
            <div className="objective-mini-list">
              {activeObjectives.map((item) => {
                const done = item.value >= item.target;
                return <span className={done ? "done" : ""} key={item.label}><i>{done ? "✓" : "○"}</i>{item.label}<em>{Math.min(item.value, item.target)}/{item.target}</em></span>;
              })}
            </div>
            <span className="objective-card-hint">点击查看任务详情 · 按 L 打开日志</span>
          </button>

          <div className="crosshair" aria-hidden="true">
            <i />
            <b />
          </div>

          <div className={`action-toast ${messageVisible ? "visible" : ""}`}>
            {message}
          </div>

          {health <= 6 && (
            <div className="low-health-vignette" aria-hidden="true" />
          )}

          <div className="survival-bar">
            <div className="held-name">
              {equippedWeapon
                ? `${WEAPONS.find((weapon) => weapon.kind === equippedWeapon)?.name ?? equippedWeapon} · ${ammo[equippedWeapon]} 发`
                : equippedTool === "hand"
                ? selected.name
                : TOOL_NAMES[equippedTool]}
            </div>
            <div className="vital-row">
              <div className="hearts" aria-label={`生命值 ${health}/20`}>
                {Array.from({ length: 10 }, (_, index) => {
                  const value = health - index * 2;
                  return (
                    <i
                      className={
                        value >= 2 ? "full" : value === 1 ? "half" : "empty"
                      }
                      key={index}
                    >
                      ♥
                    </i>
                  );
                })}
              </div>
              <div className="armor" aria-label={`护甲值 ${armorProtection}`}>
                {Array.from({ length: 10 }, (_, index) => (
                  <i className={armorProtection - index * 2 >= 2 ? "full" : armorProtection - index * 2 === 1 ? "half" : "empty"} key={index}>♢</i>
                ))}
              </div>
              <div className="hunger" aria-label={`饥饿值 ${hunger}/20`}>
                {Array.from({ length: 10 }, (_, index) => {
                  const value = hunger - index * 2;
                  return (
                    <i
                      className={
                        value >= 2 ? "full" : value === 1 ? "half" : "empty"
                      }
                      key={index}
                    >
                      ◆
                    </i>
                  );
                })}
              </div>
            </div>
            {strengthActive && <div className="status-effect strength-status">力量药剂生效 · 攻击伤害提升</div>}
            <div className="xp-line">
              <i
                style={{
                  width: `${Math.min(100, (stats.mined + stats.placed) * 7)}%`,
                }}
              />
              <span>{Math.floor((stats.mined + stats.placed) / 5) + 1}</span>
            </div>
            <div className="hotbar" role="toolbar" aria-label="背包快捷栏">
              {Array.from({ length: 9 }, (_, index) => {
                const item = hotbarItems[index];
                if (!item)
                  return (
                    <span
                      className="hotbar-empty"
                      aria-hidden="true"
                      key={index}
                    />
                  );
                const block = BLOCKS.find((entry) => entry.kind === item);
                const lootItem = LOOT_ITEMS.find(
                  (entry) => entry.kind === item,
                );
                const tool = isToolItem(item) ? item : null;
                const weapon = WEAPONS.find((entry) => entry.kind === item);
                return (
                  <button
                    draggable
                    key={item}
                    className={`${selectedItem === item ? "selected" : ""} ${draggedInventoryItem === item ? "dragging" : ""}`}
                    onClick={() => selectInventoryItem(item)}
                    onDragStart={(event) => {
                      setDraggedInventoryItem(item);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const source = event.dataTransfer.getData("text/plain") as InventoryItemKind;
                      if (INVENTORY_ITEM_SET.has(source)) moveInventoryItem(source, item);
                      setDraggedInventoryItem(null);
                    }}
                    onDragEnd={() => setDraggedInventoryItem(null)}
                    aria-label={`${index + 1} ${block?.name ?? (tool ? TOOL_NAMES[tool] : lootItem?.name ?? weapon?.name ?? item)} ${itemQuantity(item)} 个`}
                  >
                    {block && (
                      <span
                        className="block-icon"
                        style={
                          {
                            "--top": block.colors[0],
                            "--left": block.colors[1],
                            "--right": block.colors[2],
                          } as React.CSSProperties
                        }
                      >
                        <i />
                        <b />
                        <em />
                      </span>
                    )}
                    {tool && (
                      <span
                        className={`tool-icon ${toolIconClasses(tool)}`}
                        aria-hidden="true"
                      >
                        <i />
                      </span>
                    )}
                    {weapon && (
                      <span className={`weapon-icon ${weapon.className}`} aria-hidden="true"><i /></span>
                    )}
                    {lootItem && (
                      <span
                        className={`loot-icon ${lootItem.className}`}
                        aria-hidden="true"
                      >
                        <i />
                      </span>
                    )}
                    <small>{index + 1}</small>
                    <strong>{itemQuantity(item)}</strong>
                    {tool && (
                      <i
                        className="hotbar-durability"
                        aria-label={`耐久 ${toolDurability[tool]}/${TOOL_DURABILITY[tool]}`}
                      >
                        <b
                          style={{
                            width: `${(toolDurability[tool] / TOOL_DURABILITY[tool]) * 100}%`,
                          }}
                        />
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="control-legend">
            <span>
              <kbd>WASD</kbd> 移动
            </span>
            <span>
              <kbd>Space</kbd> 跳跃
            </span>
            <span>
              <kbd>Shift</kbd> 疾跑
            </span>
            <span>
              <kbd>E</kbd> 物品栏
            </span>
            <span>
              <kbd>ESC</kbd> 菜单
            </span>
            {equippedWeapon && (
              <span>
                <kbd>短按</kbd> 开火 · <kbd>按住拖动</kbd> 转视角
              </span>
            )}
          </div>

          <div
            className={`first-person-hand ${equippedWeapon ? "weapon-equipped" : ""}`}
            aria-hidden="true"
          >
            {!equippedWeapon && <i />}
            {!equippedWeapon && (equippedTool === "hand" ? (
              <span
                className="held-block"
                style={
                  {
                    "--held-top": selected.colors[0],
                    "--held-side": selected.colors[1],
                  } as React.CSSProperties
                }
              />
            ) : (
              <span className={`held-tool ${equippedTool}`}>
                <i />
                <b />
              </span>
            ))}
          </div>

          <div className="mobile-controls" aria-label="触屏移动控制">
            <button
              className="move-up"
              onPointerDown={() => sendControl("KeyW", true)}
              onPointerUp={() => sendControl("KeyW", false)}
              onPointerCancel={() => sendControl("KeyW", false)}
            >
              ▲
            </button>
            <button
              onPointerDown={() => sendControl("KeyA", true)}
              onPointerUp={() => sendControl("KeyA", false)}
              onPointerCancel={() => sendControl("KeyA", false)}
            >
              ◀
            </button>
            <button
              onPointerDown={() => sendControl("KeyS", true)}
              onPointerUp={() => sendControl("KeyS", false)}
              onPointerCancel={() => sendControl("KeyS", false)}
            >
              ▼
            </button>
            <button
              onPointerDown={() => sendControl("KeyD", true)}
              onPointerUp={() => sendControl("KeyD", false)}
              onPointerCancel={() => sendControl("KeyD", false)}
            >
              ▶
            </button>
            <button
              className="jump-control"
              onPointerDown={() => sendControl("Space", true)}
              onPointerUp={() => sendControl("Space", false)}
              onPointerCancel={() => sendControl("Space", false)}
            >
              跳
            </button>
          </div>
        </div>
      )}

      {!started && (
        <section className="launch-screen" aria-label="方块星球启动页面">
          <div className="launch-vignette" />
          <div className="launch-brand">
            <span>WEBGL VOXEL SURVIVAL</span>
            <h1>方块星球</h1>
            <p>进入一个真正可以行走、破坏与建造的微缩方块世界。</p>
          </div>
          <div className="launch-menu">
            <header>
              <i className={ready ? "ready" : ""} />
              <div>
                <b>{ready ? "特色世界已就绪" : "正在生成体素地形…"}</b>
                <small>
                  真实三维关卡 · {WORLD_SIZE} × {WORLD_SIZE} · 程序化像素贴图
                </small>
              </div>
            </header>
            <div className="world-card">
              <span className="world-thumbnail" aria-hidden="true">
                <i />
                <b />
              </span>
              <div>
                <b>四张特色地图</b>
                <small>森林 · 湖泊 · 河谷 · 高山 · 沙丘 · 完整生存内容</small>
                <em>生存模式 · 普通难度</em>
              </div>
            </div>
            {savePickerOpen ? (
              <section
                className={`save-browser ${worldCreatorOpen ? "world-creator" : ""}`}
                aria-label={worldCreatorOpen ? "选择世界地图" : "选择存档"}
              >
                <div className="save-browser-heading">
                  <button
                    type="button"
                    aria-label={worldCreatorOpen ? "返回存档" : "返回主菜单"}
                    onClick={() => {
                      if (worldCreatorOpen) setWorldCreatorOpen(false);
                      else setSavePickerOpen(false);
                    }}
                  >
                    ‹
                  </button>
                  <div>
                    <h2>{worldCreatorOpen ? "选择世界地图" : "选择存档"}</h2>
                    <p>
                      {worldCreatorOpen
                        ? "每张地图都有完整生态、建筑、资源与任务内容"
                        : "角色与世界进度会自动保存在本机"}
                    </p>
                  </div>
                </div>
                {worldCreatorOpen ? (
                  <>
                    <div className="world-map-grid">
                      {WORLD_MAP_PRESETS.map((map) => (
                        <button
                          key={map.id}
                          className={`world-map-option map-${map.id} ${selectedWorldMap === map.id ? "selected" : ""}`}
                          aria-pressed={selectedWorldMap === map.id}
                          onClick={() => {
                            setSelectedWorldMap(map.id);
                            if (map.id === "random-world")
                              setSelectedWorldSeed(createWorldSeed());
                          }}
                        >
                          <span className="world-map-preview" aria-hidden="true">
                            <i />
                            <b />
                          </span>
                          <span className="world-map-copy">
                            <strong>{map.name}</strong>
                            <em>
                              {map.tagline}
                              {map.id === "random-world" && ` · #${selectedWorldSeed}`}
                            </em>
                            <small>{map.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="world-map-guarantee">
                      全地图共有：河流、湖泊、森林、高山、沙丘、洞穴、矿脉、村庄、哨塔、商店与出生小屋
                    </p>
                    <div className="save-browser-actions world-create-actions">
                      <button className="save-continue" onClick={startNewSave}>
                        {selectedWorldMap === "random-world"
                          ? `随机生成世界 · #${selectedWorldSeed}`
                          : `生成“${WORLD_MAP_PRESETS.find((map) => map.id === selectedWorldMap)?.name}”`}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`save-slot ${saveEnabled ? "" : "empty"}`}>
                      <span className="save-slot-thumbnail" aria-hidden="true">
                        <i />
                      </span>
                      {saveEnabled ? (
                        <div className="save-slot-copy">
                          <strong>{activeWorldMap.name}</strong>
                          <span>
                            自动存档 01 · {formatSaveTime(saveUpdatedAt)} · {activeWorldMap.tagline}
                            {worldMap === "random-world" && ` · #${worldSeed}`}
                          </span>
                          <small>
                            生命 {health}/20 · 饱食 {hunger}/20 · 已挖掘 {stats.mined} 块 ·
                            红宝石 {inventory.rubyOre}
                          </small>
                        </div>
                      ) : (
                        <div className="save-slot-copy">
                          <strong>空存档</strong>
                          <span>从四张特色地图中选择一个新世界</span>
                          <small>均含晨曦山谷的全部生态、建筑与资源</small>
                        </div>
                      )}
                    </div>
                    <div className="save-browser-actions">
                      {saveEnabled && (
                        <button className="save-continue" onClick={continueSave}>
                          继续游戏
                        </button>
                      )}
                      <button onClick={openWorldCreator}>
                        {saveEnabled ? "新建存档" : "创建存档"}
                      </button>
                      {saveEnabled && (
                        <button className="save-delete" onClick={deleteSave}>
                          删除存档
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            ) : (
              <>
                <button
                  className="launch-primary"
                  disabled={!ready}
                  onClick={() => {
                    setWorldCreatorOpen(false);
                    setSavePickerOpen(true);
                  }}
                >
                  进入单人世界
                </button>
                <button disabled={!ready} onClick={openWorldCreator}>
                  创建新的世界
                </button>
                <div className="launch-features">
                  <span>第一人称移动</span>
                  <span>多样生物群系与森林</span>
                  <span>破坏与放置</span>
                  <span>分材质破坏时间与裂纹</span>
                  <span>动物战斗与掉落</span>
                  <span>最多 {MAX_ANIMALS} 只动物自然生成</span>
                  <span>花朵采集与蜜蜂互动</span>
                  <span>自然花田 · 高草丛 · 蕨类植被</span>
                  <span>树叶掉落树苗 · 白天长成橡树</span>
                  <span>4 羊毛可合成羊毛方块</span>
                  <span>4×4 合成与拆解</span>
                  <span>木镐采石与木剑战斗</span>
                  <span>木质工具耐久度</span>
                  <span>统一可拖拽物品栏</span>
                  <span>重力与碰撞</span>
                  <span>水面缓冲摔落伤害</span>
                  <span>白天、夜晚各 10 分钟</span>
                  <span>东升西落与夜间星空</span>
                  <span>{ROCK_LAYER_DEPTH} 格岩层与基岩</span>
                  <span>地下洞穴 · 铁矿 · 红宝石矿</span>
                  <span>红宝石矿脉 · 地表下 9–19 格</span>
                  <span>自动保存角色与世界</span>
                </div>
                <footer>
                  <kbd>Enter</kbd> 打开存档
                </footer>
              </>
            )}
          </div>
        </section>
      )}

      {started && inventoryOpen && (
        <div
          className="modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label="物品栏"
        >
          <section className="inventory-panel">
            <header>
              <div>
                <b>物品栏</b>
                <small>只显示已有物品 · 按住卡片拖动可改变排列位置</small>
              </div>
              <button className="inventory-close-button" onClick={() => setInventoryOpen(false)}>×</button>
            </header>
            <section className="equipment-panel" aria-label="装备栏">
              <div className="equipment-heading"><strong>装备栏</strong><small>穿戴护甲可减少受到的伤害</small></div>
              <div className="equipment-slots">
                <div className={`equipment-slot ${equippedArmor ? "filled" : "empty"}`}>
                  {equippedArmor ? <span className={`armor-item-icon ${ARMORS.find((item) => item.kind === equippedArmor)?.className}`}><i /></span> : <span>护甲</span>}
                  <small>{equippedArmor ? ARMORS.find((item) => item.kind === equippedArmor)?.name : "未装备"}</small>
                  {equippedArmor && <button onClick={() => setEquippedArmor(null)}>卸下</button>}
                </div>
              </div>
            </section>
            <section className="unified-inventory" aria-label="统一物品栏">
              <div className="unified-inventory-heading">
                <strong>全部物品</strong>
                <small>
                  {visibleInventoryItems.length} 种 · 当前装备{" "}
                  {TOOL_NAMES[equippedTool]}
                </small>
              </div>
              <div className="unified-inventory-grid">
                {visibleInventoryItems.map((item) => {
                  const blockIndex = BLOCKS.findIndex(
                    (block) => block.kind === item,
                  );
                  const block = blockIndex >= 0 ? BLOCKS[blockIndex] : null;
                  const lootItem = LOOT_ITEMS.find(
                    (entry) => entry.kind === item,
                  );
                  const flowerDye =
                    lootItem && lootItem.kind in FLOWER_DYES
                      ? FLOWER_DYES[
                          lootItem.kind as keyof typeof FLOWER_DYES
                        ]
                      : null;
                  const tool = isToolItem(item) ? item : null;
                  const weapon = WEAPONS.find((entry) => entry.kind === item);
                  const potion = POTIONS.find((entry) => entry.kind === item);
                  const armorItem = ARMORS.find((entry) => entry.kind === item);
                  const isSelected = selectedItem === item;
                  return (
                    <article
                      key={item}
                      draggable
                      className={`${isSelected ? "selected" : ""} ${draggedInventoryItem === item ? "dragging" : ""}`}
                      onDragStart={(event) => {
                        setDraggedInventoryItem(item);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const source = event.dataTransfer.getData(
                          "text/plain",
                        ) as InventoryItemKind;
                        if (INVENTORY_ITEM_SET.has(source))
                          moveInventoryItem(source, item);
                        setDraggedInventoryItem(null);
                      }}
                      onDragEnd={() => setDraggedInventoryItem(null)}
                    >
                      <span
                        className="inventory-drag-handle"
                        title="拖动改变位置"
                      >
                        ⋮⋮
                      </span>
                      {block && (
                        <span
                          className="block-icon large"
                          style={
                            {
                              "--top": block.colors[0],
                              "--left": block.colors[1],
                              "--right": block.colors[2],
                            } as React.CSSProperties
                          }
                        >
                          <i />
                          <b />
                          <em />
                        </span>
                      )}
                      {tool && (
                        <span
                          className={`tool-icon ${toolIconClasses(tool)}`}
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      )}
                      {weapon && (
                        <span className={`weapon-icon ${weapon.className}`} aria-hidden="true"><i /></span>
                      )}
                      {potion && <span className={`potion-icon ${potion.className}`} aria-hidden="true"><i /></span>}
                      {armorItem && <span className={`armor-item-icon ${armorItem.className}`} aria-hidden="true"><i /></span>}
                      {lootItem && (
                        <span
                          className={`loot-icon ${lootItem.className}`}
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      )}
                      <strong>
                        {block?.name ?? (tool ? TOOL_NAMES[tool] : lootItem?.name ?? potion?.name ?? armorItem?.name)}
                      </strong>
                      <small>×{itemQuantity(item)}</small>
                      {block && (
                        <button
                          onClick={() => {
                            selectInventoryItem(item);
                          }}
                        >
                          选择材料
                        </button>
                      )}
                      {tool && (
                        <>
                          <i className="durability-track">
                            <b
                              style={{
                                width: `${(toolDurability[tool] / TOOL_DURABILITY[tool]) * 100}%`,
                              }}
                            />
                          </i>
                          <small>
                            耐久 {toolDurability[tool]}/
                            {TOOL_DURABILITY[tool]}
                          </small>
                          <button onClick={() => selectInventoryItem(tool)}>
                            {equippedTool === tool ? "已装备" : "装备"}
                          </button>
                        </>
                      )}
                      {weapon && <button onClick={() => selectInventoryItem(weapon.kind)}>装备</button>}
                      {potion && <button onClick={() => consumePotion(potion.kind)}>使用</button>}
                      {armorItem && (
                        <button onClick={() => equipArmor(armorItem.kind)}>
                          {equippedArmor === armorItem.kind ? "已装备" : "装备"}
                        </button>
                      )}
                      {lootItem?.food ? (
                        <button
                          disabled={hunger >= 20}
                          onClick={() => eatFood(lootItem.kind)}
                        >
                          食用 +{lootItem.food}
                        </button>
                      ) : null}
                      {lootItem?.kind === "wool" && (
                        <button onClick={craftWoolBlock}>
                          合成羊毛方块（4）
                        </button>
                      )}
                      {flowerDye && (
                        <button
                          onClick={() =>
                            extractFlowerDye(
                              lootItem!.kind as keyof typeof FLOWER_DYES,
                            )
                          }
                        >
                          拆成 {flowerDye.name}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="recipe-book-panel" aria-label="配方书">
              <div className="recipe-book-heading">
                <div>
                  <strong>配方书</strong>
                  <small>收录全部可合成与拆解配方 · 点击条目直接制作</small>
                </div>
                <span>{recipeBookEntries.filter((recipe) => recipe.available).length}/{recipeBookEntries.length} 可制作</span>
              </div>
              <div className="recipe-book-grid">
                {recipeBookEntries.map((recipe) => (
                  <article
                    className={recipe.available ? "available" : "locked"}
                    key={recipe.id}
                  >
                    <div>
                      <strong>{recipe.name}</strong>
                      <small>{recipe.formula}</small>
                    </div>
                    <button
                      disabled={!recipe.available}
                      onClick={() => craftFromRecipeBook(recipe.id)}
                    >
                      {recipe.available ? "制作" : "材料不足"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section className="inventory-hotbar" aria-label="背包中的快捷栏">
              <small>快捷栏</small>
              <div>
                {Array.from({ length: 9 }, (_, index) => {
                  const item = hotbarItems[index];
                  if (!item)
                    return (
                      <span className="inventory-slot empty" key={index} />
                    );
                  const block = BLOCKS.find((entry) => entry.kind === item);
                  const lootItem = LOOT_ITEMS.find(
                    (entry) => entry.kind === item,
                  );
                  const tool = isToolItem(item) ? item : null;
                  const weapon = WEAPONS.find((entry) => entry.kind === item);
                  return (
                    <button
                      draggable
                      className={`inventory-slot ${selectedItem === item ? "selected" : ""}`}
                      key={item}
                      onClick={() => selectInventoryItem(item)}
                      onDragStart={(event) => {
                        setDraggedInventoryItem(item);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const source = event.dataTransfer.getData("text/plain") as InventoryItemKind;
                        if (INVENTORY_ITEM_SET.has(source)) moveInventoryItem(source, item);
                        setDraggedInventoryItem(null);
                      }}
                      onDragEnd={() => setDraggedInventoryItem(null)}
                      aria-label={`快捷栏 ${index + 1}`}
                    >
                      {block && (
                        <span
                          className="block-icon"
                          style={
                            {
                              "--top": block.colors[0],
                              "--left": block.colors[1],
                              "--right": block.colors[2],
                            } as React.CSSProperties
                          }
                        >
                          <i />
                          <b />
                          <em />
                        </span>
                      )}
                      {tool && (
                        <span
                          className={`tool-icon ${toolIconClasses(tool)}`}
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      )}
                      {weapon && (
                        <span className={`weapon-icon ${weapon.className}`} aria-hidden="true"><i /></span>
                      )}
                      {lootItem && (
                        <span
                          className={`loot-icon ${lootItem.className}`}
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      )}
                      <b>{itemQuantity(item)}</b>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="crafting-section" aria-label="4乘4合成表">
              <div className="crafting-copy">
                <small>工作台</small>
                <h3>4 × 4 合成与拆解</h3>
                <p>选择材料后点击格子放入；再次点击可取出。</p>
                <strong>也可以直接在上方配方书中制作。</strong>
              </div>
              <div
                className="crafting-grid"
                role="grid"
                aria-label="4乘4合成格"
              >
                {craftingGrid.map((kind, index) => {
                  const block = BLOCKS.find((entry) => entry.kind === kind);
                  return (
                    <button
                      key={index}
                      onClick={() => placeCraftingIngredient(index)}
                      aria-label={
                        block
                          ? `合成格 ${index + 1}，${block.name}，点击取出`
                          : `空合成格 ${index + 1}，点击放入${selected.name}`
                      }
                    >
                      {block && (
                        <span
                          className="block-icon crafting-block"
                          style={
                            {
                              "--top": block.colors[0],
                              "--left": block.colors[1],
                              "--right": block.colors[2],
                            } as React.CSSProperties
                          }
                        >
                          <i />
                          <b />
                          <em />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="crafting-arrow" aria-hidden="true">
                →
              </span>
              <div
                className={`crafting-result ${craftingRecipe ? "ready" : ""}`}
              >
                {craftingRecipe === "planks" ? (
                  <>
                    <span
                      className="block-icon large"
                      style={
                        {
                          "--top": BLOCKS[4].colors[0],
                          "--left": BLOCKS[4].colors[1],
                          "--right": BLOCKS[4].colors[2],
                        } as React.CSSProperties
                      }
                    >
                      <i />
                      <b />
                      <em />
                    </span>
                    <strong>×4</strong>
                  </>
                ) : craftingRecipe === "torch" ? (
                  <>
                    <span
                      className="block-icon large torch-icon"
                      style={
                        {
                          "--top": BLOCKS[BLOCKS.findIndex((block) => block.kind === "torch")].colors[0],
                          "--left": BLOCKS[BLOCKS.findIndex((block) => block.kind === "torch")].colors[1],
                          "--right": BLOCKS[BLOCKS.findIndex((block) => block.kind === "torch")].colors[2],
                        } as React.CSSProperties
                      }
                    >
                      <i />
                      <b />
                      <em />
                    </span>
                    <strong>火把 ×4</strong>
                  </>
                ) : craftingRecipe === "bread" ? (
                  <>
                    <span className="loot-icon bread" aria-hidden="true"><i /></span>
                    <strong>面包 ×1</strong>
                  </>
                ) : craftingRecipe === "bed" ? (
                  <>
                    <span
                      className="block-icon large"
                      style={
                        {
                          "--top": BLOCKS[BLOCKS.findIndex((block) => block.kind === "bed")].colors[0],
                          "--left": BLOCKS[BLOCKS.findIndex((block) => block.kind === "bed")].colors[1],
                          "--right": BLOCKS[BLOCKS.findIndex((block) => block.kind === "bed")].colors[2],
                        } as React.CSSProperties
                      }
                    >
                      <i />
                      <b />
                      <em />
                    </span>
                    <strong>红色床 ×1</strong>
                  </>
                ) : isToolItem(craftingRecipe) ? (
                  <>
                    <span
                      className={`tool-icon ${toolIconClasses(craftingRecipe)}`}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                    <strong>{TOOL_NAMES[craftingRecipe]} ×1</strong>
                  </>
                ) : (
                  <small>无匹配配方</small>
                )}
                <button disabled={!craftingRecipe} onClick={craftRecipe}>
                  合成 / 拆解
                </button>
              </div>
            </section>
            <div className="inventory-help">
              <span>所有物品统一显示 · 数量为 0 时自动隐藏</span>
              <span>鼠标拖拽物品卡片可调整排列顺序</span>
              <span>左键：攻击动物 / 按住破坏方块</span>
              <span>徒手破坏石头：不会产生掉落物</span>
              <span>花朵：瞬间采集 · 蜜蜂：可攻击但会反击</span>
              <span>树苗：种在草地或泥土顶部，露天白天约 1 分钟长成大树</span>
              <span>羊毛方块：4 个白色羊毛合成，可放置并回收</span>
              <span>花朵可拆成对应染料；4 沙子可合成 4 混凝土</span>
              <span>1 混凝土 + 1 染料可制成对应颜色的混凝土</span>
              <span>箱子：左键打开存取</span>
              <span>煤矿：木镐挖掘掉落煤炭 · 1 煤炭 + 1 木板可合成 4 火把</span>
              <span>手持火把右键放置在方块旁，为周围提供光照</span>
              <span>合成表：1 原木可拆成 4 木板</span>
              <span>镐等级：木镐采石/煤，石镐可采铁，铁镐可采红宝石</span>
              <span>红宝石矿：地下 9–19 格；保底矿脉位于 X 8 / Z 15 地表下约 12 格</span>
              <span>伤害区分：空手 0.5 · 木剑 2.5 · 石剑 4 · 铁剑 5.5</span>
              <span>枪械伤害：手枪 8 · 步枪 12 · 霰弹枪 17</span>
              <span>劫匪：普通型生命 8–10、伤害 3–4；重甲型生命 20–22、伤害 5–6</span>
              <span>工具耐久：木 59 · 石 131 · 铁 250，损坏后自动切换备用工具</span>
              <span>村庄：村民、农田和村庄箱子散落在出生点附近</span>
              <span>小麦成熟后可收获；3 个小麦可合成 1 个面包</span>
              <span>床：夜晚左键睡觉，跳过夜晚并设置重生点</span>
              <span>破坏后：靠近小方块拾取</span>
              <span>右键：放置方块</span>
              <span>数字键 1–9：切换快捷栏</span>
            </div>
          </section>
        </div>
      )}

      {started && tasksOpen && (
        <div
          className="modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label="任务日志"
        >
          <section className="task-panel">
            <header>
              <div>
                <small>冒险任务线</small>
                <h2>{activeWorldMap.name}编年史</h2>
              </div>
              <button onClick={() => setTasksOpen(false)}>×</button>
            </header>
            <p>从生存建造、地下采矿到村庄贸易与荒野战斗，完成全部章节目标。</p>
            <div className="task-list">
              {chapters.map((chapter) => (
                <section className="task-chapter" key={chapter.title}>
                  <header>
                    <b>{chapter.title}</b>
                    <small>{chapter.summary}</small>
                  </header>
                  {chapter.goals.map((item) => {
                    const done = item.value >= item.target;
                    return (
                      <div className={done ? "done" : ""} key={item.label}>
                        <i>{done ? "✓" : ""}</i>
                        <span>
                          <b>{item.label}</b>
                          <em>
                            <u
                              style={{
                                width: `${Math.min(100, (item.value / item.target) * 100)}%`,
                              }}
                            />
                          </em>
                        </span>
                        <strong>
                          {Math.min(item.value, item.target)}/{item.target}
                        </strong>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </section>
        </div>
      )}

      {started && nearShop && !shopOpen && !inventoryOpen && !tasksOpen && (
        <div className="shop-prompt" role="status">
          <b>{nearestShop.shop.label}</b>
          <span><kbd>W</kbd> 与售货员交易</span>
        </div>
      )}

      {started && shopOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label={nearestShop.shop.label}>
          <section className="shop-panel weapon-shop-panel">
            <header className="shop-heading">
              <div>
                <small>{activeWorldMap.name} · {nearestShop.shop.label}</small>
                <h2>综合商店 · 全部商品</h2>
                <p>每个商店均售卖武器、弹药、药剂、护甲和食物，红宝石会在购买时自动扣除。</p>
              </div>
              <button className="shop-close" aria-label="关闭商店" onClick={() => setShopOpen(false)}>×</button>
            </header>
            <div className="shop-summary">
              <div className="shop-merchant">
                <span className="trader-avatar" aria-hidden="true">▣</span>
                <div>
                  <b>铁砧 · 综合商人</b>
                  <span>“所有商店货物相同，选好后直接放入背包。”</span>
                </div>
              </div>
              <div className="shop-balance" aria-label={`当前拥有 ${inventory.rubyOre} 颗红宝石`}>
                <span>可用余额</span>
                <strong><i aria-hidden="true">◆</i> {inventory.rubyOre}</strong>
                <small>红宝石</small>
              </div>
            </div>
            <div className="shop-items">
              {WEAPONS.map((weapon) => {
                const affordable = inventory.rubyOre >= weapon.cost;
                const missing = Math.max(0, weapon.cost - inventory.rubyOre);
                return (
                  <article key={weapon.kind} className={`shop-item ${affordable ? "can-buy" : "locked"}`}>
                    <div className="shop-item-topline">
                      <span className={`weapon-icon ${weapon.className}`} aria-hidden="true"><i /></span>
                      <span className="shop-owned">已拥有 <b>{weapons[weapon.kind]}</b></span>
                    </div>
                    <div className="shop-item-copy">
                      <small>{weapon.role}</small>
                      <h3>{weapon.name}</h3>
                      <p>{weapon.description}</p>
                    </div>
                    <dl className="shop-stats">
                      <div><dt>威力</dt><dd>{weapon.power}</dd></div>
                      <div><dt>操控</dt><dd>{weapon.handling}</dd></div>
                    </dl>
                    <div className="shop-purchase">
                      <div>
                        <span>价格</span>
                        <strong><i aria-hidden="true">◆</i> {weapon.cost}</strong>
                      </div>
                      <button disabled={!affordable} onClick={() => tradeWeapon(weapon)}>
                        {affordable ? "购买" : `还差 ${missing} 颗`}
                      </button>
                    </div>
                  </article>
                );
              })}
              {POTIONS.map((potion) => {
                const affordable = inventory.rubyOre >= potion.cost;
                return (
                  <article key={potion.kind} className={`shop-item ${affordable ? "can-buy" : "locked"}`}>
                    <div className="shop-item-topline"><span className={`potion-icon ${potion.className}`}><i /></span><span className="shop-owned">已拥有 <b>{potions[potion.kind]}</b></span></div>
                    <div className="shop-item-copy"><small>消耗品</small><h3>{potion.name}</h3><p>{potion.effect}</p></div>
                    <div className="shop-purchase"><div><span>价格</span><strong><i aria-hidden="true">◆</i> {potion.cost}</strong></div><button disabled={!affordable} onClick={() => tradePotion(potion)}>{affordable ? "购买" : "红宝石不足"}</button></div>
                  </article>
                );
              })}
              {SHOP_FOODS.map((food) => {
                const affordable = inventory.rubyOre >= food.cost;
                return (
                  <article key={food.kind} className={`shop-item ${affordable ? "can-buy" : "locked"}`}>
                    <div className="shop-item-topline"><span className={`loot-icon ${food.className}`}><i /></span><span className="shop-owned">背包中 <b>{loot[food.kind]}</b></span></div>
                    <div className="shop-item-copy"><small>食物 · 饥饿值 +{food.food}</small><h3>{food.name}</h3><p>{food.description}</p></div>
                    <div className="shop-purchase"><div><span>价格</span><strong><i aria-hidden="true">◆</i> {food.cost}</strong></div><button disabled={!affordable} onClick={() => tradeFood(food)}>{affordable ? "购买" : "红宝石不足"}</button></div>
                  </article>
                );
              })}
              {SHOP_AMMO.map((item) => {
                const affordable = inventory.rubyOre >= item.cost;
                return (
                  <article key={item.weapon} className={`shop-item ${affordable ? "can-buy" : "locked"}`}>
                    <div className="shop-item-topline"><span className={`weapon-icon ${item.className}`} aria-hidden="true"><i /></span><span className="shop-owned">现有 <b>{ammo[item.weapon]}</b> 发</span></div>
                    <div className="shop-item-copy"><small>枪械补给</small><h3>{item.name}</h3><p>补充 {item.amount} 发，适用于已拥有的{WEAPONS.find((weapon) => weapon.kind === item.weapon)?.name}。</p></div>
                    <div className="shop-purchase"><div><span>价格</span><strong><i aria-hidden="true">◆</i> {item.cost}</strong></div><button disabled={!affordable} onClick={() => tradeAmmo(item)}>{affordable ? "购买" : "红宝石不足"}</button></div>
                  </article>
                );
              })}
              {ARMORS.map((item) => {
                const affordable = inventory.rubyOre >= item.cost;
                return (
                  <article key={item.kind} className={`shop-item ${affordable ? "can-buy" : "locked"}`}>
                    <div className="shop-item-topline"><span className={`armor-item-icon ${item.className}`}><i /></span><span className="shop-owned">已拥有 <b>{armor[item.kind]}</b></span></div>
                    <div className="shop-item-copy"><small>防具 · {item.protection} 点护甲</small><h3>{item.name}</h3><p>装备后降低受到的伤害，可在物品栏切换。</p></div>
                    <div className="shop-purchase"><div><span>价格</span><strong><i aria-hidden="true">◆</i> {item.cost}</strong></div><button disabled={!affordable} onClick={() => tradeArmor(item)}>{affordable ? "购买" : "红宝石不足"}</button></div>
                  </article>
                );
              })}
            </div>
            <footer className="shop-footer">
              <span><kbd>点击</kbd> 购买任意商品</span>
              <span><kbd>ESC</kbd> 关闭商店</span>
            </footer>
          </section>
        </div>
      )}

      {started && chestOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="箱子存取">
          <section className="shop-panel chest-panel">
            <header>
              <div>
                <small>储物容器</small>
                <h2>橡木箱子</h2>
              </div>
              <button onClick={() => setChestOpen(false)}>×</button>
            </header>
            <div className="shop-trader-card">
              <span className="trader-avatar" aria-hidden="true">▤</span>
              <div>
                <b>已选择：{BLOCKS.find((block) => block.kind === selectedItem)?.name ?? LOOT_ITEMS.find((item) => item.kind === selectedItem)?.name ?? (isToolItem(selectedItem) ? TOOL_NAMES[selectedItem] : undefined) ?? WEAPONS.find((weapon) => weapon.kind === selectedItem)?.name ?? selectedItem}</b>
                <span>将当前选中的物品存入箱子；内容会随世界保存。</span>
              </div>
              <button disabled={itemQuantity(selectedItem) < 1} onClick={storeSelectedItem}>存入 ×1</button>
            </div>
            <div className="chest-storage" aria-label="箱子内容">
              {chestItems.length ? chestItems.map((item) => {
                const name = BLOCKS.find((block) => block.kind === item)?.name ?? LOOT_ITEMS.find((entry) => entry.kind === item)?.name ?? (isToolItem(item) ? TOOL_NAMES[item] : WEAPONS.find((weapon) => weapon.kind === item)?.name) ?? item;
                return <button key={item} onClick={() => takeChestItem(item)}><span>{name}</span><b>×{chestStorage[item]}</b><small>取出 1</small></button>;
              }) : <p className="empty-chest">箱子还是空的。选择背包物品后点击“存入 ×1”。</p>}
            </div>
            <footer>左键打开箱子 · 点击物品取出 1 个 · 自然箱子的战利品仅生成一次</footer>
          </section>
        </div>
      )}

      {started && dead && (
        <div
          className="modal-layer death-layer"
          role="dialog"
          aria-modal="true"
          aria-label="玩家死亡"
        >
          <section className="death-panel">
            <small>生存挑战结束</small>
            <h2>你死了！</h2>
            <p>生命值已耗尽。重生后将保留物品栏、装备与世界建筑。</p>
            <button onClick={respawn}>在重生点重生</button>
          </section>
        </div>
      )}

      {started && paused && !dead && (
        <div
          className="modal-layer pause-layer"
          role="dialog"
          aria-modal="true"
          aria-label="游戏菜单"
        >
          <section className="pause-panel">
            <h2>游戏菜单</h2>
            <p>{activeWorldMap.name} · 世界进度已自动保存</p>
            <button onClick={() => setPaused(false)}>返回游戏</button>
            <div>
              <button
                onClick={() => {
                  setPaused(false);
                  setInventoryOpen(true);
                }}
              >
                物品栏
              </button>
              <button
                onClick={() => {
                  setPaused(false);
                  setTasksOpen(true);
                }}
              >
                任务日志
              </button>
            </div>
            <div className="time-controls">
              <span>自动昼夜 · 每阶段 10 分钟</span>
              <button onClick={() => setCyclePosition(0)}>清晨</button>
              <button onClick={() => setCyclePosition(DAY_PHASE_SECONDS / 2)}>
                正午
              </button>
              <button onClick={() => setCyclePosition(DAY_PHASE_SECONDS - 30)}>
                黄昏
              </button>
              <button onClick={() => setCyclePosition(DAY_PHASE_SECONDS * 1.5)}>
                午夜
              </button>
            </div>
            <button className="reset-button" onClick={resetWorld}>
              重新生成世界
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
