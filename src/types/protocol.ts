/* ── 游戏阶段 ── */
export type GamePhase = "waiting" | "readying" | "playing" | "ended";

/* ── 玩家信息 ── */
export interface PlayerInfo {
  id: string;
  name: string;
  online: boolean;
  ready: boolean;
}

/* ── 当前方块 ── */
export interface CurrentPiece {
  type: number;
  rotation: number;
  row: number;
  col: number;
}

/* ── 玩家游戏状态 ── */
export interface PlayerGameState {
  board: number[][];
  currentPiece: CurrentPiece | null;
  nextType: number;
  score: number;
  pieceIndex: number;
  gameOver: boolean;
}

/* ── 服务端 → 客户端 消息 ── */

export interface S_RoomState {
  type: "roomState";
  yourId: string;
  players: PlayerInfo[];
  ownerId: string;
  phase: GamePhase;
  speed: number;
  seed: number | null;
  gameStates: Record<string, PlayerGameState>;
  winner: { id: string; name: string } | null;
}

export interface S_PlayerJoined {
  type: "playerJoined";
  player: PlayerInfo;
}

export interface S_PlayerLeft {
  type: "playerLeft";
  playerId: string;
}

export interface S_PhaseChange {
  type: "phaseChange";
  phase: GamePhase;
  ownerId: string;
}

export interface S_GameStart {
  type: "gameStart";
  seed: number;
  speed: number;
}

export interface S_BoardUpdate {
  type: "boardUpdate";
  playerId: string;
  board: number[][];
  currentPiece: CurrentPiece | null;
  nextType: number;
  score: number;
  pieceIndex: number;
  gameOver: boolean;
}

export interface S_GameEnd {
  type: "gameEnd";
  winnerId: string;
  winnerName: string;
  scores: Record<string, number>;
}

export interface S_ReadyChanged {
  type: "readyChanged";
  playerId: string;
  ready: boolean;
}

export interface S_DifficultyChanged {
  type: "difficultyChanged";
  speed: number;
}

export interface S_Error {
  type: "error";
  message: string;
}

export interface S_RoomClosed {
  type: "roomClosed";
  reason: string;
}

export type ServerMessage =
  | S_RoomState
  | S_PlayerJoined
  | S_PlayerLeft
  | S_PhaseChange
  | S_GameStart
  | S_BoardUpdate
  | S_GameEnd
  | S_ReadyChanged
  | S_DifficultyChanged
  | S_Error
  | S_RoomClosed;

/* ── 客户端 → 服务端 消息 ── */

export interface C_Join {
  type: "join";
  playerName: string;
  playerId?: string;
}

export interface C_Ready {
  type: "ready";
}

export interface C_SetDifficulty {
  type: "setDifficulty";
  speed: number;
}

export interface C_StartGame {
  type: "startGame";
}

export interface C_UpdateBoard {
  type: "updateBoard";
  board: number[][];
  currentPiece: CurrentPiece | null;
  nextType: number;
  score: number;
  pieceIndex: number;
  gameOver: boolean;
}

export interface C_PlayAgain {
  type: "playAgain";
}

export interface C_Leave {
  type: "leave";
}

export interface C_Ping {
  type: "ping";
}

export type ClientMessage =
  | C_Join
  | C_Ready
  | C_SetDifficulty
  | C_StartGame
  | C_UpdateBoard
  | C_PlayAgain
  | C_Leave
  | C_Ping;
