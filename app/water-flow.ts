export type WaterFlowCell = {
  x: number;
  y: number;
  z: number;
  level: number;
};

export const MAX_WATER_FLOW_LEVEL = 5;

export function getNextWaterFlowCells(
  cell: WaterFlowCell,
  hasBlock: (x: number, y: number, z: number) => boolean,
  minY: number,
): WaterFlowCell[] {
  if (cell.y - 1 >= minY && !hasBlock(cell.x, cell.y - 1, cell.z)) {
    return [{ ...cell, y: cell.y - 1 }];
  }
  if (cell.level >= MAX_WATER_FLOW_LEVEL) return [];

  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([dx, dz]) => ({
      x: cell.x + dx,
      y: cell.y,
      z: cell.z + dz,
      level: cell.level + 1,
    }))
    .filter((candidate) => !hasBlock(candidate.x, candidate.y, candidate.z));
}
