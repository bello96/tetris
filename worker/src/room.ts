import { DurableObject } from "cloudflare:workers";

/* ── 类型定义 ── */
type GamePhase = "waiting" | "readying" | "playing" | "ended";

interface PlayerInfo {
  id: string;
  name: string;
  online: boolean;
  ready: boolean;
}

interface CurrentPiece {
  type: number;
  rotation: number;
  row: number;
  col: number;
}

interface PlayerGameState {
  board: number[][];
  currentPiece: CurrentPiece | null;
  nextType: number;
  score: number;
  pieceIndex: number;
  gameOver: boolean;
}

interface DisconnectedPlayer {
  name: string;
  disconnectedAt: number;
  quickLeave: boolean;
  ready: boolean;
}

interface WsAttachment {
  playerId: string;
  playerName: string;
}

/* ── 常量 ── */
const MAX_PLAYERS = 2;
const GRACE_PERIOD = 30_000;
const QUICK_GRACE = 5_000;
const INACTIVITY_TIMEOUT = 5 * 60_000;

/* ── TetrisRoom Durable Object ── */
export class TetrisRoom extends DurableObject {
  private loaded = false;
  private roomCode = "";
  private created = 0;
  private closed = false;
  private phase: GamePhase = "waiting";
  private ownerId: string | null = null;
  private speed = 3;
  private allowedTypes: number[] = [0, 1, 2, 3, 4, 5, 6];
  private seed: number | null = null;
  private lastActivityAt = 0;
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private playerReady = new Map<string, boolean>();
  private playerGameStates = new Map<string, PlayerGameState>();
  private winner: { id: string; name: string } | null = null;

  /* ── 持久化 ── */
  private async ensureLoaded() {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const s = this.ctx.storage;
    const data = await s.get([
      "roomCode",
      "created",
      "closed",
      "phase",
      "ownerId",
      "speed",
      "allowedTypes",
      "seed",
      "lastActivityAt",
      "playerReady",
      "playerGameStates",
      "winner",
    ]);

    this.roomCode = (data.get("roomCode") as string) || "";
    this.created = (data.get("created") as number) || 0;
    this.closed = (data.get("closed") as boolean) || false;
    this.phase = (data.get("phase") as GamePhase) || "waiting";
    this.ownerId = (data.get("ownerId") as string) || null;
    this.speed = (data.get("speed") as number) || 3;
    this.allowedTypes = (data.get("allowedTypes") as number[]) || [0, 1, 2, 3, 4, 5, 6];
    this.seed = (data.get("seed") as number) || null;
    this.lastActivityAt =
      (data.get("lastActivityAt") as number) || Date.now();
    this.winner =
      (data.get("winner") as { id: string; name: string }) || null;

    const readyData = data.get("playerReady") as
      | Record<string, boolean>
      | undefined;
    if (readyData) {
      this.playerReady = new Map(Object.entries(readyData));
    }

    const gsData = data.get("playerGameStates") as
      | Record<string, PlayerGameState>
      | undefined;
    if (gsData) {
      this.playerGameStates = new Map(Object.entries(gsData));
    }
  }

  private async save(fields: Record<string, unknown>) {
    await this.ctx.storage.put(fields);
  }

  /* ── HTTP 入口 ── */
  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const { roomCode } = (await request.json()) as { roomCode: string };
      this.roomCode = roomCode;
      this.created = Date.now();
      this.lastActivityAt = Date.now();
      await this.save({
        roomCode,
        created: this.created,
        lastActivityAt: this.lastActivityAt,
        phase: "waiting",
        closed: false,
        speed: 3,
      });
      return new Response("ok");
    }

    if (url.pathname === "/quickleave" && request.method === "POST") {
      const playerId = await request.text();
      const dp = this.disconnectedPlayers.get(playerId);
      if (dp) {
        dp.quickLeave = true;
      }
      return new Response("ok");
    }

    if (url.pathname === "/info" && request.method === "GET") {
      const players = this.getActivePlayers();
      const owner = players.find((p) => p.id === this.ownerId);
      return Response.json({
        roomCode: this.roomCode,
        phase: this.phase,
        playerCount: players.length,
        closed: this.closed,
        ownerName: owner?.name || null,
      });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response("Not Found", { status: 404 });
  }

  /* ── WebSocket 生命周期 ── */
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.ensureLoaded();
    if (typeof raw !== "string") {
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      await this.onJoin(ws, msg);
      return;
    }

    const att = this.getAttachment(ws);
    if (!att) {
      this.sendTo(ws, { type: "error", message: "未加入房间" });
      return;
    }

    this.lastActivityAt = Date.now();
    await this.save({ lastActivityAt: this.lastActivityAt });

    switch (msg.type as string) {
      case "ping":
        break;
      case "ready":
        await this.onReady(att);
        break;
      case "setDifficulty":
        await this.onSetDifficulty(att, msg);
        break;
      case "startGame":
        await this.onStartGame(att);
        break;
      case "updateBoard":
        await this.onUpdateBoard(att, msg as unknown as PlayerGameState);
        break;
      case "playAgain":
        await this.onPlayAgain(att);
        break;
      case "transferOwner":
        await this.onTransferOwner(att);
        break;
      case "leave":
        await this.onLeave(ws, att);
        break;
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.ensureLoaded();
    const att = this.getAttachment(ws);
    if (att) {
      this.handleDisconnect(att.playerId, att.playerName);
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.ensureLoaded();
    const att = this.getAttachment(ws);
    if (att) {
      this.handleDisconnect(att.playerId, att.playerName);
    }
  }

  /* ── 消息处理 ── */
  private async onJoin(ws: WebSocket, msg: Record<string, unknown>) {
    if (this.closed) {
      this.sendTo(ws, { type: "roomClosed", reason: "房间已关闭" });
      ws.close(1000, "Room closed");
      return;
    }

    const playerName = (msg.playerName as string) || "匿名";
    const requestedId = msg.playerId as string | undefined;

    // 断线重连
    if (requestedId) {
      if (this.disconnectedPlayers.has(requestedId)) {
        const dp = this.disconnectedPlayers.get(requestedId)!;
        this.disconnectedPlayers.delete(requestedId);
        this.playerReady.set(requestedId, dp.ready);
        this.setAttachment(ws, { playerId: requestedId, playerName });
        this.broadcastExcept(ws, {
          type: "playerJoined",
          player: {
            id: requestedId,
            name: playerName,
            online: true,
            ready: dp.ready,
          },
        });
        this.sendRoomState(ws, requestedId);
        this.scheduleAlarm();
        return;
      }

      const existing = this.findWsByPlayerId(requestedId);
      if (existing) {
        this.setAttachment(existing, null as unknown as WsAttachment);
        try {
          existing.close(1000, "Replaced");
        } catch {
          /* ignore */
        }
        this.disconnectedPlayers.delete(requestedId);
        this.setAttachment(ws, { playerId: requestedId, playerName });
        this.sendRoomState(ws, requestedId);
        return;
      }
    }

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length >= MAX_PLAYERS) {
      this.sendTo(ws, { type: "error", message: "房间已满" });
      ws.close(1000, "Room full");
      return;
    }

    const playerId = requestedId || generateId();
    this.setAttachment(ws, { playerId, playerName });
    this.playerReady.set(playerId, false);

    if (!this.ownerId) {
      this.ownerId = playerId;
      await this.save({ ownerId: playerId });
    }

    this.broadcastExcept(ws, {
      type: "playerJoined",
      player: { id: playerId, name: playerName, online: true, ready: false },
    });

    const allPlayers = this.getActivePlayers();
    if (allPlayers.length === 2 && this.phase === "waiting") {
      this.phase = "readying";
      await this.save({
        phase: "readying",
        playerReady: Object.fromEntries(this.playerReady),
      });
      this.broadcast({
        type: "phaseChange",
        phase: "readying",
        ownerId: this.ownerId,
      });
    }

    this.sendRoomState(ws, playerId);
    this.scheduleAlarm();
  }

  private async onReady(att: WsAttachment) {
    if (this.phase !== "readying") {
      return;
    }
    const current = this.playerReady.get(att.playerId) || false;
    this.playerReady.set(att.playerId, !current);
    await this.save({ playerReady: Object.fromEntries(this.playerReady) });
    this.broadcast({
      type: "readyChanged",
      playerId: att.playerId,
      ready: !current,
    });
  }

  private async onSetDifficulty(att: WsAttachment, msg: Record<string, unknown>) {
    if (att.playerId !== this.ownerId || this.phase !== "readying") {
      return;
    }
    if (typeof msg.speed === "number") {
      this.speed = Math.max(1, Math.min(10, Math.floor(msg.speed)));
    }
    if (Array.isArray(msg.allowedTypes) && msg.allowedTypes.length > 0) {
      this.allowedTypes = (msg.allowedTypes as number[]).filter(
        (t) => t >= 0 && t <= 6,
      );
      if (this.allowedTypes.length === 0) {
        this.allowedTypes = [0, 1, 2, 3, 4, 5, 6];
      }
    }
    await this.save({ speed: this.speed, allowedTypes: this.allowedTypes });
    this.broadcast({
      type: "difficultyChanged",
      speed: this.speed,
      allowedTypes: this.allowedTypes,
    });
  }

  private async onStartGame(att: WsAttachment) {
    if (att.playerId !== this.ownerId || this.phase !== "readying") {
      return;
    }
    // 检查是否所有人都准备了
    const players = this.getActivePlayers();
    if (
      players.length < 2 ||
      !players.every((p) => this.playerReady.get(p.id))
    ) {
      return;
    }

    this.seed = Math.floor(Math.random() * 2147483647);
    this.phase = "playing";
    this.winner = null;
    this.playerGameStates.clear();

    await this.save({
      seed: this.seed,
      phase: "playing",
      winner: null,
      playerGameStates: {},
    });

    this.broadcast({
      type: "gameStart",
      seed: this.seed,
      speed: this.speed,
      allowedTypes: this.allowedTypes,
    });
  }

  private async onUpdateBoard(
    att: WsAttachment,
    msg: PlayerGameState,
  ) {
    if (this.phase !== "playing") {
      return;
    }

    const state: PlayerGameState = {
      board: msg.board,
      currentPiece: msg.currentPiece,
      nextType: msg.nextType,
      score: msg.score,
      pieceIndex: msg.pieceIndex,
      gameOver: msg.gameOver,
    };

    this.playerGameStates.set(att.playerId, state);

    // 广播给其他玩家
    this.broadcastExcept(this.findWsByPlayerId(att.playerId)!, {
      type: "boardUpdate",
      playerId: att.playerId,
      ...state,
    });

    // 检查游戏是否结束
    if (state.gameOver) {
      await this.checkGameEnd();
    }
  }

  private async checkGameEnd() {
    if (this.phase !== "playing") {
      return;
    }
    const players = this.getActivePlayers();
    const gameOverPlayers: string[] = [];

    for (const p of players) {
      const gs = this.playerGameStates.get(p.id);
      if (gs?.gameOver) {
        gameOverPlayers.push(p.id);
      }
    }

    if (gameOverPlayers.length === 0) {
      return;
    }

    // 有人失败了，找出赢家
    let winnerId: string | null = null;
    let winnerName = "";
    let isDraw = false;

    if (gameOverPlayers.length >= players.length) {
      // 所有人都失败了，比分数
      const playerScores = players.map((p) => ({
        id: p.id,
        name: p.name,
        score: this.playerGameStates.get(p.id)?.score ?? 0,
      }));
      playerScores.sort((a, b) => b.score - a.score);
      if (
        playerScores.length >= 2 &&
        playerScores[0]!.score === playerScores[1]!.score
      ) {
        // 平局
        isDraw = true;
      } else {
        winnerId = playerScores[0]!.id;
        winnerName = playerScores[0]!.name;
      }
    } else {
      // 还有人活着，活着的人赢
      for (const p of players) {
        if (!gameOverPlayers.includes(p.id)) {
          winnerId = p.id;
          winnerName = p.name;
          break;
        }
      }
    }

    this.phase = "ended";
    this.winner = isDraw ? null : { id: winnerId!, name: winnerName };

    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = this.playerGameStates.get(p.id)?.score ?? 0;
    }

    await this.save({
      phase: "ended",
      winner: this.winner,
      playerGameStates: Object.fromEntries(this.playerGameStates),
    });

    this.broadcast({
      type: "gameEnd",
      winnerId,
      winnerName,
      isDraw,
      scores,
    });
  }

  private async onPlayAgain(att: WsAttachment) {
    if (att.playerId !== this.ownerId) {
      return;
    }
    if (this.phase !== "ended") {
      return;
    }

    this.phase = "readying";
    this.seed = null;
    this.winner = null;
    this.playerGameStates.clear();
    // 重置所有人的准备状态
    for (const key of this.playerReady.keys()) {
      this.playerReady.set(key, false);
    }

    await this.save({
      phase: "readying",
      seed: null,
      winner: null,
      playerGameStates: {},
      playerReady: Object.fromEntries(this.playerReady),
    });

    this.broadcast({
      type: "phaseChange",
      phase: "readying",
      ownerId: this.ownerId,
    });
    // 广播所有人的 ready 状态重置
    for (const [pid] of this.playerReady) {
      this.broadcast({ type: "readyChanged", playerId: pid, ready: false });
    }
  }

  private async onTransferOwner(att: WsAttachment) {
    if (att.playerId !== this.ownerId) {
      return;
    }
    if (this.phase === "playing") {
      return;
    }
    const players = this.getActivePlayers();
    const other = players.find((p) => p.id !== att.playerId);
    if (!other) {
      return;
    }
    this.ownerId = other.id;
    await this.save({ ownerId: other.id });
    this.broadcast({
      type: "phaseChange",
      phase: this.phase,
      ownerId: this.ownerId,
    });
  }

  private async onLeave(ws: WebSocket, att: WsAttachment) {
    this.removePlayer(att.playerId);
    try {
      ws.close(1000, "Left");
    } catch {
      /* ignore */
    }
    this.broadcast({ type: "playerLeft", playerId: att.playerId });
    await this.handlePlayerRemoved(att.playerId);
  }

  /* ── 断线处理 ── */
  private handleDisconnect(playerId: string, playerName: string) {
    this.disconnectedPlayers.set(playerId, {
      name: playerName,
      disconnectedAt: Date.now(),
      quickLeave: false,
      ready: this.playerReady.get(playerId) || false,
    });
    this.scheduleAlarm();
  }

  private async handlePlayerRemoved(removedId: string) {
    this.disconnectedPlayers.delete(removedId);
    this.playerReady.delete(removedId);
    this.playerGameStates.delete(removedId);
    const remaining = this.getActivePlayers();

    if (remaining.length === 0) {
      this.closed = true;
      await this.save({ closed: true });
      return;
    }

    if (removedId === this.ownerId && remaining.length > 0) {
      this.ownerId = remaining[0]!.id;
      await this.save({ ownerId: this.ownerId });
    }

    // 游戏中有人离开 → 另一方获胜
    if (this.phase === "playing") {
      const winner = remaining[0]!;
      this.phase = "ended";
      this.winner = { id: winner.id, name: winner.name };
      const scores: Record<string, number> = {};
      // 包含所有玩家的分数（含已离开的）
      for (const p of remaining) {
        scores[p.id] = this.playerGameStates.get(p.id)?.score ?? 0;
      }
      scores[removedId] = 0;
      await this.save({
        phase: "ended",
        winner: this.winner,
        playerGameStates: Object.fromEntries(this.playerGameStates),
      });
      this.broadcast({
        type: "gameEnd",
        winnerId: winner.id,
        winnerName: winner.name,
        isDraw: false,
        scores,
      });
      return;
    }

    if (remaining.length < 2 && this.phase !== "waiting") {
      this.phase = "waiting";
      await this.save({
        phase: "waiting",
        playerReady: Object.fromEntries(this.playerReady),
      });
      this.broadcast({
        type: "phaseChange",
        phase: "waiting",
        ownerId: this.ownerId,
      });
    }
  }

  /* ── 定时器 ── */
  private scheduleAlarm() {
    this.ctx.storage.setAlarm(Date.now() + 5000);
  }

  async alarm() {
    await this.ensureLoaded();
    if (this.closed) {
      return;
    }
    const now = Date.now();

    for (const [id, dp] of this.disconnectedPlayers) {
      const grace = dp.quickLeave ? QUICK_GRACE : GRACE_PERIOD;
      if (now - dp.disconnectedAt >= grace) {
        this.disconnectedPlayers.delete(id);
        const stillConnected = this.findWsByPlayerId(id);
        if (stillConnected) {
          continue;
        }
        this.broadcast({ type: "playerLeft", playerId: id });
        await this.handlePlayerRemoved(id);
      }
    }

    if (now - this.lastActivityAt >= INACTIVITY_TIMEOUT) {
      this.closed = true;
      await this.save({ closed: true });
      this.broadcast({ type: "roomClosed", reason: "长时间无操作，房间已关闭" });
      return;
    }

    if (
      this.disconnectedPlayers.size > 0 ||
      this.getWebSockets().length > 0
    ) {
      this.scheduleAlarm();
    }
  }

  /* ── 工具方法 ── */
  private getWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  private getAttachment(ws: WebSocket): WsAttachment | null {
    try {
      return ws.deserializeAttachment() as WsAttachment | null;
    } catch {
      return null;
    }
  }

  private setAttachment(ws: WebSocket, att: WsAttachment) {
    ws.serializeAttachment(att);
  }

  private getActivePlayers(): PlayerInfo[] {
    const players: PlayerInfo[] = [];
    const seen = new Set<string>();
    for (const ws of this.getWebSockets()) {
      const att = this.getAttachment(ws);
      if (att && !seen.has(att.playerId)) {
        seen.add(att.playerId);
        players.push({
          id: att.playerId,
          name: att.playerName,
          online: true,
          ready: this.playerReady.get(att.playerId) || false,
        });
      }
    }
    for (const [id, dp] of this.disconnectedPlayers) {
      if (!seen.has(id)) {
        players.push({
          id,
          name: dp.name,
          online: false,
          ready: dp.ready,
        });
      }
    }
    return players;
  }

  private findWsByPlayerId(playerId: string): WebSocket | null {
    for (const ws of this.getWebSockets()) {
      const att = this.getAttachment(ws);
      if (att?.playerId === playerId) {
        return ws;
      }
    }
    return null;
  }

  private removePlayer(playerId: string) {
    for (const ws of this.getWebSockets()) {
      const att = this.getAttachment(ws);
      if (att?.playerId === playerId) {
        this.setAttachment(ws, null as unknown as WsAttachment);
      }
    }
  }

  private sendRoomState(ws: WebSocket, yourId: string) {
    const gameStates: Record<string, PlayerGameState> = {};
    for (const [id, state] of this.playerGameStates) {
      gameStates[id] = state;
    }
    this.sendTo(ws, {
      type: "roomState",
      yourId,
      players: this.getActivePlayers(),
      ownerId: this.ownerId,
      phase: this.phase,
      speed: this.speed,
      allowedTypes: this.allowedTypes,
      seed: this.seed,
      gameStates,
      winner: this.winner,
    });
  }

  private sendTo(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  private broadcast(data: unknown) {
    const msg = JSON.stringify(data);
    for (const ws of this.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* ignore */
      }
    }
  }

  private broadcastExcept(exclude: WebSocket | null, data: unknown) {
    const msg = JSON.stringify(data);
    for (const ws of this.getWebSockets()) {
      if (ws !== exclude) {
        try {
          ws.send(msg);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/* ── 工具函数 ── */
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
