import { useEffect, useRef } from "react";
import { PIECE_BORDERS, PIECE_COLORS, getPieceShape } from "../utils/tetris";

interface Props {
  typeIndex: number;
  size: number;
  dimmed?: boolean;
}

export default function PieceThumbnail({ typeIndex, size, dimmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // 透明背景
    ctx.clearRect(0, 0, size, size);

    const shape = getPieceShape(typeIndex);
    const colorIdx = typeIndex + 1;
    const color = PIECE_COLORS[colorIdx];
    const border = PIECE_BORDERS[colorIdx];
    if (!color || !border) {
      return;
    }

    // 计算 bounding box
    let minR = 4, maxR = 0, minC = 4, maxC = 0;
    for (const [r, c] of shape) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    const pieceW = maxC - minC + 1;
    const pieceH = maxR - minR + 1;

    // 单元格大小，留一点 padding
    const padding = size * 0.1;
    const cellSize = Math.min(
      (size - padding * 2) / pieceW,
      (size - padding * 2) / pieceH,
    );
    const offsetX = (size - pieceW * cellSize) / 2;
    const offsetY = (size - pieceH * cellSize) / 2;

    ctx.globalAlpha = dimmed ? 0.25 : 1;

    for (const [r, c] of shape) {
      const x = offsetX + (c - minC) * cellSize;
      const y = offsetY + (r - minR) * cellSize;
      const inset = Math.max(0.5, cellSize * 0.06);

      // 主体
      ctx.fillStyle = color;
      ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
      // 高光
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, Math.max(1, cellSize * 0.12));
      ctx.fillRect(x + inset, y + inset, Math.max(1, cellSize * 0.12), cellSize - inset * 2);
      // 阴影
      ctx.fillStyle = border;
      const sh = Math.max(1, cellSize * 0.12);
      ctx.fillRect(x + inset, y + cellSize - inset - sh, cellSize - inset * 2, sh);
      ctx.fillRect(x + cellSize - inset - sh, y + inset, sh, cellSize - inset * 2);
    }

    ctx.globalAlpha = 1;
  }, [typeIndex, size, dimmed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
