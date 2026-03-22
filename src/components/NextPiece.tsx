import { useEffect, useRef } from "react";
import { PIECE_BORDERS, PIECE_COLORS, getPieceShape } from "../utils/tetris";

interface Props {
  typeIndex: number;
  cellSize: number;
}

export default function NextPiece({ typeIndex, cellSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = cellSize * 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#1e1b2e";
    ctx.fillRect(0, 0, size, size);

    const shape = getPieceShape(typeIndex);
    const colorIdx = typeIndex + 1;
    const color = PIECE_COLORS[colorIdx];
    const border = PIECE_BORDERS[colorIdx];
    if (!color || !border) {
      return;
    }

    // 居中绘制
    let minR = 4,
      maxR = 0,
      minC = 4,
      maxC = 0;
    for (const [r, c] of shape) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    const pieceW = maxC - minC + 1;
    const pieceH = maxR - minR + 1;
    const offsetX = (size - pieceW * cellSize) / 2;
    const offsetY = (size - pieceH * cellSize) / 2;

    for (const [r, c] of shape) {
      const x = offsetX + (c - minC) * cellSize;
      const y = offsetY + (r - minR) * cellSize;
      const inset = 1;

      ctx.fillStyle = color;
      ctx.fillRect(x + inset, y + inset, cellSize - 2, cellSize - 2);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + inset, y + inset, cellSize - 2, 2);
      ctx.fillRect(x + inset, y + inset, 2, cellSize - 2);
      ctx.fillStyle = border;
      ctx.fillRect(x + inset, y + cellSize - inset - 2, cellSize - 2, 2);
      ctx.fillRect(x + cellSize - inset - 2, y + inset, 2, cellSize - 2);
    }
  }, [typeIndex, cellSize, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: 4 }}
    />
  );
}
