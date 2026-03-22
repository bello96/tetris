import { useEffect, useRef } from "react";
import type { CurrentPiece } from "../types/protocol";
import {
  BOARD_COLS,
  BOARD_ROWS,
  PIECE_BORDERS,
  PIECE_COLORS,
  getGhostRow,
  getPieceCells,
} from "../utils/tetris";

interface Props {
  board: number[][];
  currentPiece: CurrentPiece | null;
  isMe: boolean;
  gameOver: boolean;
  cellSize: number;
}

export default function TetrisBoard({
  board,
  currentPiece,
  isMe,
  gameOver,
  cellSize,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const width = cellSize * BOARD_COLS;
  const height = cellSize * BOARD_ROWS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 浅色背景
    ctx.fillStyle = "#f0f0f8";
    ctx.fillRect(0, 0, width, height);

    // 网格线
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(width, r * cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, height);
      ctx.stroke();
    }

    // 绘制单元格
    function drawCell(r: number, c: number, colorIdx: number, alpha = 1) {
      const color = PIECE_COLORS[colorIdx];
      const border = PIECE_BORDERS[colorIdx];
      if (!color || !border) {
        return;
      }

      const x = c * cellSize;
      const y = r * cellSize;
      const s = cellSize;
      const inset = 1;

      ctx.globalAlpha = alpha;
      // 主体
      ctx.fillStyle = color;
      ctx.fillRect(x + inset, y + inset, s - inset * 2, s - inset * 2);
      // 高光
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + inset, y + inset, s - inset * 2, 2);
      ctx.fillRect(x + inset, y + inset, 2, s - inset * 2);
      // 阴影
      ctx.fillStyle = border;
      ctx.fillRect(x + inset, y + s - inset - 2, s - inset * 2, 2);
      ctx.fillRect(x + s - inset - 2, y + inset, 2, s - inset * 2);
      ctx.globalAlpha = 1;
    }

    // 已锁定的方块
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const v = board[r]?.[c] ?? 0;
        if (v > 0) {
          drawCell(r, c, v);
        }
      }
    }

    // 幽灵方块
    if (currentPiece) {
      const ghostRow = getGhostRow(
        board,
        currentPiece.type,
        currentPiece.rotation,
        currentPiece.row,
        currentPiece.col,
      );
      if (ghostRow !== currentPiece.row) {
        const ghostCells = getPieceCells(
          currentPiece.type,
          currentPiece.rotation,
          ghostRow,
          currentPiece.col,
        );
        for (const [gr, gc] of ghostCells) {
          if (gr >= 0 && gr < BOARD_ROWS) {
            drawCell(gr, gc, currentPiece.type + 1, 0.12);
          }
        }
      }
    }

    // 当前下落方块
    if (currentPiece) {
      const cells = getPieceCells(
        currentPiece.type,
        currentPiece.rotation,
        currentPiece.row,
        currentPiece.col,
      );
      for (const [cr, cc] of cells) {
        if (cr >= 0 && cr < BOARD_ROWS) {
          drawCell(cr, cc, currentPiece.type + 1);
        }
      }
    }

    // 游戏结束遮罩
    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#4f46e5";
      ctx.font = `bold ${cellSize * 1.2}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", width / 2, height / 2);
    }
  }, [board, currentPiece, cellSize, width, height, gameOver]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        borderRadius: 8,
        border: isMe
          ? "3px solid #6366f1"
          : "2px solid rgba(107,114,128,0.3)",
      }}
    />
  );
}
