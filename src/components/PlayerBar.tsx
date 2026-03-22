import { useState } from "react";
import type { GamePhase, PlayerInfo } from "../types/protocol";

interface Props {
  roomCode: string;
  players: PlayerInfo[];
  ownerId: string | null;
  myId: string | null;
  phase: GamePhase;
  onLeave: () => void;
}

const phaseStyle: Record<GamePhase, string> = {
  waiting: "bg-yellow-100 text-yellow-700",
  readying: "bg-blue-100 text-blue-700",
  playing: "bg-green-100 text-green-700",
  ended: "bg-purple-100 text-purple-700",
};

const phaseLabel: Record<GamePhase, string> = {
  waiting: "等待加入",
  readying: "准备中",
  playing: "游戏中",
  ended: "已结束",
};

export default function PlayerBar({
  roomCode,
  players,
  ownerId,
  myId,
  phase,
  onLeave,
}: Props) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/${roomCode}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">房间</span>
          <span className="font-mono text-lg font-bold text-indigo-600 tracking-wider">
            {roomCode}
          </span>
          {players.length < 2 && (
            <button
              className={`px-2 py-0.5 text-xs rounded-md transition ${
                copied
                  ? "bg-green-100 text-green-700"
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              }`}
              onClick={copyLink}
            >
              {copied ? "已复制" : "分享"}
            </button>
          )}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${phaseStyle[phase]}`}
        >
          {phaseLabel[phase]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
              p.id === ownerId
                ? "bg-indigo-50 text-indigo-700"
                : "bg-gray-50 text-gray-700"
            } ${p.id === myId ? "font-semibold" : ""} ${!p.online ? "opacity-50" : ""}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                p.online ? "bg-green-500" : "bg-gray-300"
              }`}
            />
            <span>
              {p.name}
              {p.id === myId && (
                <span className="text-[10px] opacity-50 ml-0.5">(我)</span>
              )}
            </span>
            {p.id === ownerId && (
              <span className="text-[10px] opacity-60">房主</span>
            )}
            {phase === "readying" && (
              <span
                className={`text-[10px] ${p.ready ? "text-green-600" : "text-gray-400"}`}
              >
                {p.ready ? "已准备" : "未准备"}
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        className="px-3 py-1.5 text-sm rounded-lg transition bg-gray-100 text-gray-600 hover:bg-gray-200"
        onClick={onLeave}
      >
        离开
      </button>
    </div>
  );
}
