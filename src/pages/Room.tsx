import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getHttpBase, getWsBase } from "../api";
import Confetti from "../components/Confetti";
import NextPiece from "../components/NextPiece";
import PlayerBar from "../components/PlayerBar";
import TetrisBoard from "../components/TetrisBoard";
import { useWebSocket } from "../hooks/useWebSocket";
import type {
  CurrentPiece,
  GamePhase,
  PlayerInfo,
  ServerMessage,
} from "../types/protocol";
import {
  clearLines,
  createBoard,
  createRNG,
  generatePieceSequence,
  getDropInterval,
  getSpawnPosition,
  isValidPosition,
  lockPiece,
  tryRotate,
} from "../utils/tetris";

interface Props {
  roomCode: string;
  nickname: string;
  playerId: string;
  onLeave: () => void;
}

const FAST_DROP_INTERVAL = 50;

export default function Room({
  roomCode,
  nickname,
  playerId,
  onLeave,
}: Props) {
  /* ── 房间状态 ── */
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [speed, setSpeed] = useState(3);
  const [seed, setSeed] = useState<number | null>(null);
  const [winner, setWinner] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showConfetti, setShowConfetti] = useState(false);

  /* ── 我的游戏状态 ── */
  const [myBoard, setMyBoard] = useState<number[][]>(createBoard);
  const [myPiece, setMyPiece] = useState<CurrentPiece | null>(null);
  const [myNextType, setMyNextType] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myGameOver, setMyGameOver] = useState(false);

  /* ── 对方游戏状态 ── */
  const [oppBoard, setOppBoard] = useState<number[][]>(createBoard);
  const [oppPiece, setOppPiece] = useState<CurrentPiece | null>(null);
  const [oppNextType, setOppNextType] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [oppGameOver, setOppGameOver] = useState(false);

  /* ── 游戏逻辑 Refs ── */
  const rngRef = useRef<(() => number) | null>(null);
  const seqRef = useRef<number[]>([]);
  const pieceIndexRef = useRef(0);
  const fastDropRef = useRef(false);
  const [fastDrop, setFastDrop] = useState(false);

  // Refs 用于在回调中读取最新值
  const myBoardRef = useRef(myBoard);
  myBoardRef.current = myBoard;
  const myPieceRef = useRef(myPiece);
  myPieceRef.current = myPiece;
  const myScoreRef = useRef(myScore);
  myScoreRef.current = myScore;
  const myGameOverRef = useRef(myGameOver);
  myGameOverRef.current = myGameOver;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const myNextTypeRef = useRef(myNextType);
  myNextTypeRef.current = myNextType;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;
  const playerIdRef = useRef(playerId);

  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── WebSocket ── */
  const wsUrl = useMemo(
    () => `${getWsBase()}/api/rooms/${roomCode}/ws`,
    [roomCode],
  );
  const { connected, send, addListener, leave } = useWebSocket(wsUrl);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (connected) {
      send({
        type: "join",
        playerName: nickname,
        playerId: playerIdRef.current,
      });
    }
  }, [connected, nickname, send]);

  /* ── 发送棋盘状态 ── */
  const sendBoardUpdate = useCallback(() => {
    sendRef.current({
      type: "updateBoard",
      board: myBoardRef.current,
      currentPiece: myPieceRef.current,
      nextType: myNextTypeRef.current,
      score: myScoreRef.current,
      pieceIndex: pieceIndexRef.current,
      gameOver: myGameOverRef.current,
    });
  }, []);

  /* ── 生成下一块方块 ── */
  const spawnPiece = useCallback(() => {
    const idx = pieceIndexRef.current;
    // 按需扩展序列
    while (seqRef.current.length <= idx + 1) {
      if (rngRef.current) {
        const more = generatePieceSequence(rngRef.current, 70);
        seqRef.current.push(...more);
      }
    }
    const type = seqRef.current[idx]!;
    const nextType = seqRef.current[idx + 1] ?? 0;
    pieceIndexRef.current = idx + 1;

    const spawn = getSpawnPosition();
    if (
      !isValidPosition(myBoardRef.current, type, 0, spawn.row, spawn.col)
    ) {
      // 游戏结束
      setMyGameOver(true);
      setMyPiece(null);
      setMyNextType(nextType);
      // 延迟发送，确保状态更新
      setTimeout(() => {
        myGameOverRef.current = true;
        myPieceRef.current = null;
        sendBoardUpdate();
      }, 0);
      return;
    }

    const newPiece = { type, rotation: 0, row: spawn.row, col: spawn.col };
    setMyPiece(newPiece);
    setMyNextType(nextType);
    myPieceRef.current = newPiece;
    myNextTypeRef.current = nextType;
  }, [sendBoardUpdate]);

  /* ── 下落逻辑 ── */
  const tick = useCallback(() => {
    if (phaseRef.current !== "playing" || myGameOverRef.current) {
      return;
    }
    const piece = myPieceRef.current;
    if (!piece) {
      return;
    }

    const board = myBoardRef.current;
    if (
      isValidPosition(board, piece.type, piece.rotation, piece.row + 1, piece.col)
    ) {
      const newPiece = { ...piece, row: piece.row + 1 };
      setMyPiece(newPiece);
      myPieceRef.current = newPiece;
      sendBoardUpdate();
    } else {
      // 锁定
      const newBoard = lockPiece(
        board,
        piece.type,
        piece.rotation,
        piece.row,
        piece.col,
      );
      const [clearedBoard, lines] = clearLines(newBoard);
      const newScore = myScoreRef.current + lines;

      setMyBoard(clearedBoard);
      setMyScore(newScore);
      setMyPiece(null);
      myBoardRef.current = clearedBoard;
      myScoreRef.current = newScore;
      myPieceRef.current = null;

      sendBoardUpdate();

      // 生成下一块
      setTimeout(() => spawnPiece(), 10);
    }
  }, [spawnPiece, sendBoardUpdate]);

  /* ── 游戏循环 ── */
  useEffect(() => {
    if (phase !== "playing" || myGameOver || seed === null) {
      return;
    }

    const interval = fastDrop ? FAST_DROP_INTERVAL : getDropInterval(speed);
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }, [phase, myGameOver, seed, speed, fastDrop, tick]);

  /* ── 键盘控制 ── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (phaseRef.current !== "playing" || myGameOverRef.current) {
        return;
      }
      const piece = myPieceRef.current;
      if (!piece) {
        return;
      }
      const board = myBoardRef.current;

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          if (
            isValidPosition(
              board,
              piece.type,
              piece.rotation,
              piece.row,
              piece.col - 1,
            )
          ) {
            const np = { ...piece, col: piece.col - 1 };
            setMyPiece(np);
            myPieceRef.current = np;
            sendBoardUpdate();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (
            isValidPosition(
              board,
              piece.type,
              piece.rotation,
              piece.row,
              piece.col + 1,
            )
          ) {
            const np = { ...piece, col: piece.col + 1 };
            setMyPiece(np);
            myPieceRef.current = np;
            sendBoardUpdate();
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (!fastDropRef.current) {
            fastDropRef.current = true;
            setFastDrop(true);
          }
          break;
        }
        case "ArrowUp": {
          // 硬降落（直接落到底部）
          e.preventDefault();
          let dropRow = piece.row;
          while (
            isValidPosition(
              board,
              piece.type,
              piece.rotation,
              dropRow + 1,
              piece.col,
            )
          ) {
            dropRow++;
          }
          // 直接锁定
          const newBoard = lockPiece(
            board,
            piece.type,
            piece.rotation,
            dropRow,
            piece.col,
          );
          const [clearedBoard, lines] = clearLines(newBoard);
          const newScore = myScoreRef.current + lines;
          setMyBoard(clearedBoard);
          setMyScore(newScore);
          setMyPiece(null);
          myBoardRef.current = clearedBoard;
          myScoreRef.current = newScore;
          myPieceRef.current = null;
          sendBoardUpdate();
          setTimeout(() => spawnPiece(), 10);
          break;
        }
        case " ": {
          e.preventDefault();
          const result = tryRotate(
            board,
            piece.type,
            piece.rotation,
            piece.row,
            piece.col,
          );
          if (result) {
            const np = {
              ...piece,
              rotation: result.rotation,
              row: result.row,
              col: result.col,
            };
            setMyPiece(np);
            myPieceRef.current = np;
            sendBoardUpdate();
          }
          break;
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        fastDropRef.current = false;
        setFastDrop(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [sendBoardUpdate, spawnPiece]);

  /* ── 开始游戏初始化 ── */
  const startGame = useCallback(
    (gameSeed: number) => {
      const rng = createRNG(gameSeed);
      rngRef.current = rng;
      seqRef.current = generatePieceSequence(rng, 70);
      pieceIndexRef.current = 0;
      fastDropRef.current = false;
      setFastDrop(false);

      const emptyBoard = createBoard();
      setMyBoard(emptyBoard);
      setMyPiece(null);
      setMyScore(0);
      setMyGameOver(false);
      setOppBoard(createBoard());
      setOppPiece(null);
      setOppScore(0);
      setOppGameOver(false);
      setWinner(null);
      setShowConfetti(false);

      myBoardRef.current = emptyBoard;
      myPieceRef.current = null;
      myScoreRef.current = 0;
      myGameOverRef.current = false;

      // 稍后生成第一块
      setTimeout(() => spawnPiece(), 100);
    },
    [spawnPiece],
  );

  /* ── WebSocket 消息处理 ── */
  useEffect(() => {
    const unsub = addListener((msg: ServerMessage) => {
      switch (msg.type) {
        case "roomState": {
          setMyId(msg.yourId);
          myIdRef.current = msg.yourId;
          setPlayers(msg.players);
          setOwnerId(msg.ownerId);
          setPhase(msg.phase);
          phaseRef.current = msg.phase;
          setSpeed(msg.speed);
          speedRef.current = msg.speed;
          setSeed(msg.seed);
          setWinner(msg.winner);
          // 恢复游戏状态（断线重连）
          const myState = msg.gameStates[msg.yourId];
          if (myState) {
            setMyBoard(myState.board);
            setMyPiece(myState.currentPiece);
            setMyNextType(myState.nextType);
            setMyScore(myState.score);
            setMyGameOver(myState.gameOver);
            myBoardRef.current = myState.board;
            myPieceRef.current = myState.currentPiece;
            myNextTypeRef.current = myState.nextType;
            myScoreRef.current = myState.score;
            myGameOverRef.current = myState.gameOver;
            pieceIndexRef.current = myState.pieceIndex;
            // 恢复 RNG
            if (msg.seed !== null && msg.phase === "playing") {
              const rng = createRNG(msg.seed);
              rngRef.current = rng;
              // 生成足够多的序列以匹配当前进度
              seqRef.current = generatePieceSequence(
                rng,
                Math.max(70, myState.pieceIndex + 20),
              );
            }
          }
          // 恢复对方状态
          for (const [pid, state] of Object.entries(msg.gameStates)) {
            if (pid !== msg.yourId) {
              setOppBoard(state.board);
              setOppPiece(state.currentPiece);
              setOppNextType(state.nextType);
              setOppScore(state.score);
              setOppGameOver(state.gameOver);
            }
          }
          if (msg.winner) {
            setScores(
              Object.fromEntries(
                Object.entries(msg.gameStates).map(([id, s]) => [id, s.score]),
              ),
            );
          }
          break;
        }
        case "playerJoined":
          setPlayers((p) => {
            if (p.find((x) => x.id === msg.player.id)) {
              return p.map((x) =>
                x.id === msg.player.id ? { ...x, online: true } : x,
              );
            }
            return [...p, msg.player];
          });
          break;
        case "playerLeft":
          setPlayers((p) => p.filter((x) => x.id !== msg.playerId));
          break;
        case "phaseChange":
          setPhase(msg.phase);
          phaseRef.current = msg.phase;
          setOwnerId(msg.ownerId);
          break;
        case "gameStart":
          setPhase("playing");
          phaseRef.current = "playing";
          setSeed(msg.seed);
          setSpeed(msg.speed);
          speedRef.current = msg.speed;
          startGame(msg.seed);
          break;
        case "boardUpdate":
          if (msg.playerId !== myIdRef.current) {
            setOppBoard(msg.board);
            setOppPiece(msg.currentPiece);
            setOppNextType(msg.nextType);
            setOppScore(msg.score);
            setOppGameOver(msg.gameOver);
          }
          break;
        case "gameEnd":
          setPhase("ended");
          phaseRef.current = "ended";
          setWinner({ id: msg.winnerId, name: msg.winnerName });
          setScores(msg.scores);
          setShowConfetti(msg.winnerId === myIdRef.current);
          if (confettiTimerRef.current) {
            clearTimeout(confettiTimerRef.current);
          }
          confettiTimerRef.current = setTimeout(
            () => setShowConfetti(false),
            5000,
          );
          break;
        case "readyChanged":
          setPlayers((p) =>
            p.map((x) =>
              x.id === msg.playerId ? { ...x, ready: msg.ready } : x,
            ),
          );
          break;
        case "difficultyChanged":
          setSpeed(msg.speed);
          speedRef.current = msg.speed;
          break;
        case "error":
          if (msg.message === "房间已满" || msg.message === "房间已关闭") {
            setTimeout(onLeave, 1500);
          }
          break;
        case "roomClosed":
          setTimeout(onLeave, 1500);
          break;
      }
    });
    return unsub;
  }, [addListener, startGame, onLeave]);

  /* ── 页面关闭通知 ── */
  useEffect(() => {
    function handlePageHide() {
      navigator.sendBeacon(
        `${getHttpBase()}/api/rooms/${roomCode}/quickleave`,
        playerIdRef.current,
      );
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [roomCode]);

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) {
        clearTimeout(confettiTimerRef.current);
      }
    };
  }, []);

  /* ── 操作 ── */
  const isOwner = myId === ownerId;
  const mePlayer = players.find((p) => p.id === myId);
  const allReady = players.length === 2 && players.every((p) => p.ready);

  function handleLeave() {
    leave();
    onLeave();
  }

  function handleReady() {
    send({ type: "ready" });
  }

  function handleStart() {
    send({ type: "startGame" });
  }

  function handleSetSpeed(s: number) {
    send({ type: "setDifficulty", speed: s });
  }

  function handlePlayAgain() {
    send({ type: "playAgain" });
  }

  /* ── 计算 cellSize ── */
  // 根据窗口大小动态计算，确保两个棋盘都能放下
  const cellSize = useMemo(() => {
    // 留出顶部 PlayerBar (~60px) + 间距
    const availableH = window.innerHeight - 120;
    const availableW = window.innerWidth - 80;
    // 每个棋盘占一半宽度，减去侧边栏和间距
    const halfW = (availableW - 60) / 2;
    const boardW = halfW - 100; // 减去 next/score 面板
    const fromW = Math.floor(boardW / 10);
    const fromH = Math.floor(availableH / 20);
    return Math.max(16, Math.min(fromW, fromH, 32));
  }, []);

  /* ── 渲染 ── */

  // 等待阶段
  if (phase === "waiting") {
    return (
      <div className="flex flex-col h-screen bg-gray-50 gap-3 p-3">
        <Confetti show={false} />
        <PlayerBar
          roomCode={roomCode}
          players={players}
          ownerId={ownerId}
          myId={myId}
          phase={phase}
          onLeave={handleLeave}
        />
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-bounce">🎮</div>
            <div className="text-gray-500 font-medium mb-1">
              等待另一位玩家加入
            </div>
            <div className="text-sm text-gray-400">
              分享房间号{" "}
              <span className="font-mono font-bold text-indigo-600">
                {roomCode}
              </span>{" "}
              给好友
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 准备阶段
  if (phase === "readying") {
    return (
      <div className="flex flex-col h-screen bg-gray-50 gap-3 p-3">
        <Confetti show={false} />
        <PlayerBar
          roomCode={roomCode}
          players={players}
          ownerId={ownerId}
          myId={myId}
          phase={phase}
          onLeave={handleLeave}
        />
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm">
          <div className="text-center w-full max-w-md px-8">
            <div className="text-3xl mb-6">🎮 准备对战</div>

            {/* 难度设置 - 仅房主 */}
            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-2">
                下落速度 {isOwner ? "(房主可调整)" : ""}
              </div>
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <button
                    key={s}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                      s === speed
                        ? "bg-indigo-600 text-white"
                        : isOwner
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-gray-50 text-gray-400"
                    }`}
                    disabled={!isOwner}
                    onClick={() => handleSetSpeed(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 玩家准备状态 */}
            <div className="space-y-3 mb-6">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    p.ready ? "bg-green-50" : "bg-gray-50"
                  }`}
                >
                  <span className="font-medium text-gray-700">
                    {p.name}
                    {p.id === ownerId && (
                      <span className="text-xs text-indigo-500 ml-1">
                        房主
                      </span>
                    )}
                    {p.id === myId && (
                      <span className="text-xs text-gray-400 ml-1">(我)</span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium ${p.ready ? "text-green-600" : "text-gray-400"}`}
                  >
                    {p.ready ? "已准备" : "未准备"}
                  </span>
                </div>
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                className={`flex-1 py-3 px-4 font-semibold rounded-lg transition ${
                  mePlayer?.ready
                    ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
                onClick={handleReady}
              >
                {mePlayer?.ready ? "取消准备" : "准备"}
              </button>
              {isOwner && (
                <button
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  disabled={!allReady}
                  onClick={handleStart}
                >
                  开始游戏
                </button>
              )}
            </div>

            {isOwner && !allReady && (
              <p className="text-xs text-gray-400 mt-3">
                双方都准备后才能开始游戏
              </p>
            )}

            {/* 操作说明 */}
            <div className="mt-6 text-left bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">
                操作说明
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>← → 左右移动</div>
                <div>↓ 按住加速下落</div>
                <div>↑ 硬降落（直接到底）</div>
                <div>空格 旋转方块</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 游戏中 / 已结束
  return (
    <div className="flex flex-col h-screen bg-gray-50 gap-3 p-3">
      <Confetti show={showConfetti} />
      <PlayerBar
        roomCode={roomCode}
        players={players}
        ownerId={ownerId}
        myId={myId}
        phase={phase}
        onLeave={handleLeave}
      />

      <div className="flex-1 flex items-center justify-center gap-8 min-h-0">
        {/* 我的游戏区 */}
        <GameArea
          board={myBoard}
          currentPiece={myPiece}
          nextType={myNextType}
          score={myScore}
          gameOver={myGameOver}
          cellSize={cellSize}
          label="我的游戏"
          isMe={true}
          speed={speed}
        />

        {/* 对方游戏区 */}
        <GameArea
          board={oppBoard}
          currentPiece={oppPiece}
          nextType={oppNextType}
          score={oppScore}
          gameOver={oppGameOver}
          cellSize={Math.max(12, Math.floor(cellSize * 0.75))}
          label="对方"
          isMe={false}
        />
      </div>

      {/* 游戏结束弹窗 */}
      {phase === "ended" && winner && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center">
            <div className="text-4xl mb-3">
              {winner.id === myId ? "🎉" : "😢"}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {winner.id === myId ? "你赢了！" : `${winner.name} 获胜`}
            </h2>
            <div className="text-gray-500 mb-4">
              {players.map((p) => (
                <span key={p.id} className="mx-2">
                  {p.name}: {scores[p.id] ?? 0} 分
                </span>
              ))}
            </div>
            {isOwner && (
              <button
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                onClick={handlePlayAgain}
              >
                再来一局
              </button>
            )}
            {!isOwner && (
              <p className="text-sm text-gray-400">等待房主开始新一局...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 游戏区组件 ── */
function GameArea({
  board,
  currentPiece,
  nextType,
  score,
  gameOver,
  cellSize,
  label,
  isMe,
  speed,
}: {
  board: number[][];
  currentPiece: CurrentPiece | null;
  nextType: number;
  score: number;
  gameOver: boolean;
  cellSize: number;
  label: string;
  isMe: boolean;
  speed?: number;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ opacity: isMe ? 1 : 0.85 }}
    >
      {/* 标签 */}
      <div
        className={`px-4 py-1 rounded-full text-sm font-medium ${
          isMe
            ? "bg-indigo-100 text-indigo-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {label}
      </div>

      <div className="flex gap-3">
        {/* 棋盘 */}
        <TetrisBoard
          board={board}
          currentPiece={currentPiece}
          isMe={isMe}
          gameOver={gameOver}
          cellSize={cellSize}
        />

        {/* 侧边信息 */}
        <div className="flex flex-col gap-3">
          {/* 下一块 */}
          <div
            className={`rounded-lg p-2 ${isMe ? "bg-indigo-50" : "bg-gray-50"}`}
          >
            <div className="text-xs text-gray-500 mb-1 text-center">
              下一个
            </div>
            <NextPiece
              typeIndex={nextType}
              cellSize={Math.max(10, Math.floor(cellSize * 0.6))}
            />
          </div>

          {/* 分数 */}
          <div
            className={`rounded-lg p-3 text-center ${isMe ? "bg-indigo-50" : "bg-gray-50"}`}
          >
            <div className="text-xs text-gray-500">得分</div>
            <div
              className={`text-2xl font-bold font-mono ${isMe ? "text-indigo-600" : "text-gray-700"}`}
            >
              {score}
            </div>
          </div>

          {/* 速度 */}
          {speed !== undefined && (
            <div
              className={`rounded-lg p-3 text-center ${isMe ? "bg-indigo-50" : "bg-gray-50"}`}
            >
              <div className="text-xs text-gray-500">速度</div>
              <div className="text-lg font-bold text-gray-700">{speed}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
