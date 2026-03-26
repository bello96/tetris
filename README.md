# 俄罗斯方块对战

双人在线实时对战俄罗斯方块，同步方块序列，公平竞技，先存活者获胜。

**在线体验**: https://tetris.dengjiabei.cn/

## 游戏规则

- 20x10 标准棋盘，7 种标准方块（I/O/T/S/Z/J/L）
- 双方接收相同的方块序列（种子随机，保证公平）
- 消除整行得分，对手棋盘先满则获胜
- 支持 SRS 旋转系统 + 踢墙机制
- 可调节下落速度（难度 1-10）

## 操作方式

| 按键 | 动作 |
|------|------|
| ← → | 左右移动 |
| ↑ | 旋转方块 |
| ↓ | 加速下落 |
| Space | 硬降（直接落底） |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Twind |
| 渲染 | HTML5 Canvas |
| 后端 | Cloudflare Workers + Durable Objects |
| 通信 | WebSocket（实时同步） |
| 部署 | Cloudflare Pages + Workers |
| CI/CD | GitHub Actions |

## 项目结构

```
tetris/
├── src/
│   ├── components/
│   │   ├── TetrisBoard.tsx      # Canvas 棋盘渲染
│   │   ├── NextPiece.tsx        # 下一个方块预览
│   │   ├── PieceThumbnail.tsx   # 方块缩略图
│   │   ├── PlayerBar.tsx        # 房间信息栏
│   │   └── Confetti.tsx         # 胜利特效
│   ├── pages/
│   │   ├── Home.tsx             # 创建/加入房间
│   │   └── Room.tsx             # 游戏房间
│   ├── hooks/useWebSocket.ts    # WebSocket 自动重连
│   ├── types/protocol.ts       # 前后端共享消息协议
│   ├── utils/tetris.ts         # 核心游戏逻辑（方块、碰撞、旋转）
│   ├── api.ts                   # API 地址配置
│   ├── App.tsx                  # 路由 + 会话管理
│   └── main.tsx                 # 入口
├── worker/
│   └── src/
│       ├── index.ts             # HTTP 路由
│       └── room.ts              # TetrisRoom Durable Object
├── .github/workflows/
│   ├── deploy-pages.yml         # 前端自动部署
│   └── deploy-worker.yml        # Worker 自动部署
└── .env.development             # 开发环境配置
```

## 核心特性

- **公平竞技**: 种子随机生成方块序列（Mulberry32 算法），双方序列完全一致
- **SRS 旋转**: 标准旋转系统 + 踢墙检测，操作手感流畅
- **Ghost Piece**: 半透明预览显示硬降落点
- **实时对战**: 可实时看到对手棋盘状态
- **难度调节**: 房主可设置下落速度（1-10 级）
- **断线重连**: 支持重连恢复游戏状态

## 本地开发

```bash
# 安装依赖
npm install
cd worker && npm install && cd ..

# 启动前端
npm run dev

# 启动本地 Worker（可选）
npm run dev:worker
```

## 部署

推送到 `master` 分支后 GitHub Actions 自动部署：

- 前端变更 → Cloudflare Pages
- `worker/` 变更 → Cloudflare Workers

手动部署：

```bash
npm run build
npx wrangler pages deploy dist --project-name=tetris
cd worker && npx wrangler deploy
```

## License

MIT
