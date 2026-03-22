/* ── 俄罗斯方块核心逻辑 ── */

export const BOARD_ROWS = 20;
export const BOARD_COLS = 10;

/** 方块颜色（索引 1-7，0 为空） */
export const PIECE_COLORS: (string | null)[] = [
  null,
  "#06b6d4", // 1: I - 青色
  "#eab308", // 2: O - 黄色
  "#a855f7", // 3: T - 紫色
  "#22c55e", // 4: S - 绿色
  "#ef4444", // 5: Z - 红色
  "#3b82f6", // 6: J - 蓝色
  "#f97316", // 7: L - 橙色
];

/** 方块暗色边框 */
export const PIECE_BORDERS: (string | null)[] = [
  null,
  "#0891b2",
  "#ca8a04",
  "#9333ea",
  "#16a34a",
  "#dc2626",
  "#2563eb",
  "#ea580c",
];

/**
 * 方块形状定义（SRS 标准旋转系统）
 * SHAPES[typeIndex][rotation] = [[row, col], ...]
 * typeIndex: 0=I, 1=O, 2=T, 3=S, 4=Z, 5=J, 6=L
 */
const SHAPES: [number, number][][][] = [
  // I (4×4)
  [
    [[1, 0], [1, 1], [1, 2], [1, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 1], [1, 1], [2, 1], [3, 1]],
  ],
  // O (3×3)
  [
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
  ],
  // T
  [
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 1]],
  ],
  // S
  [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 1], [1, 2], [2, 0], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],
  // Z
  [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 2], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
  // J
  [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ],
  // L
  [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [1, 2], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],
];

/** Mulberry32 伪随机数生成器 */
export function createRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 创建空棋盘 */
export function createBoard(): number[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    new Array<number>(BOARD_COLS).fill(0),
  );
}

/** 获取方块在指定位置和旋转状态的绝对坐标 */
export function getPieceCells(
  typeIndex: number,
  rotation: number,
  row: number,
  col: number,
): [number, number][] {
  return SHAPES[typeIndex]![rotation]!.map(([r, c]) => [row + r, col + c]);
}

/** 检查位置是否有效（无碰撞） */
export function isValidPosition(
  board: number[][],
  typeIndex: number,
  rotation: number,
  row: number,
  col: number,
): boolean {
  const cells = getPieceCells(typeIndex, rotation, row, col);
  for (const [r, c] of cells) {
    if (c < 0 || c >= BOARD_COLS) {
      return false;
    }
    if (r >= BOARD_ROWS) {
      return false;
    }
    // 允许在棋盘上方（r < 0）
    if (r >= 0 && board[r]![c] !== 0) {
      return false;
    }
  }
  return true;
}

/** 将方块锁定到棋盘上 */
export function lockPiece(
  board: number[][],
  typeIndex: number,
  rotation: number,
  row: number,
  col: number,
): number[][] {
  const newBoard = board.map((r) => [...r]);
  const cells = getPieceCells(typeIndex, rotation, row, col);
  const colorIndex = typeIndex + 1;
  for (const [r, c] of cells) {
    if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
      newBoard[r]![c] = colorIndex;
    }
  }
  return newBoard;
}

/** 消除满行，返回 [新棋盘, 消除行数] */
export function clearLines(board: number[][]): [number[][], number] {
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = BOARD_ROWS - remaining.length;
  if (cleared === 0) {
    return [board, 0];
  }
  const emptyRows = Array.from({ length: cleared }, () =>
    new Array<number>(BOARD_COLS).fill(0),
  );
  return [[...emptyRows, ...remaining], cleared];
}

/** 获取出生位置 */
export function getSpawnPosition(): { row: number; col: number } {
  return { row: 0, col: 3 };
}

/** 7-bag 随机序列生成 */
export function generatePieceSequence(
  rng: () => number,
  count: number,
): number[] {
  const sequence: number[] = [];
  while (sequence.length < count) {
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    sequence.push(...bag);
  }
  return sequence.slice(0, count);
}

/** 尝试旋转（带墙踢） */
export function tryRotate(
  board: number[][],
  typeIndex: number,
  currentRotation: number,
  row: number,
  col: number,
): { rotation: number; row: number; col: number } | null {
  const newRot = (currentRotation + 1) % 4;
  // 墙踢偏移量
  const kicks: [number, number][] = [
    [0, 0],
    [0, -1],
    [0, 1],
    [-1, 0],
    [0, -2],
    [0, 2],
  ];
  for (const [dr, dc] of kicks) {
    if (isValidPosition(board, typeIndex, newRot, row + dr, col + dc)) {
      return { rotation: newRot, row: row + dr, col: col + dc };
    }
  }
  return null;
}

/** 计算幽灵方块位置（硬降落预览） */
export function getGhostRow(
  board: number[][],
  typeIndex: number,
  rotation: number,
  row: number,
  col: number,
): number {
  let ghostRow = row;
  while (isValidPosition(board, typeIndex, rotation, ghostRow + 1, col)) {
    ghostRow++;
  }
  return ghostRow;
}

/** 根据难度等级计算下落间隔（毫秒） */
export function getDropInterval(speed: number): number {
  return Math.max(100, 1000 - (speed - 1) * 100);
}

/** 获取方块形状（用于预览 next piece） */
export function getPieceShape(typeIndex: number): [number, number][] {
  return SHAPES[typeIndex]![0]!;
}
