# session-list

多会话管理插件，支持会话的创建、切换、删除、重命名和持久化。

## Slot

- `toolbar:left` — 侧栏展开/收起按钮（order: -100，排最左）
- `sidebar:left` — 会话列表侧栏（260px 宽）

## State Slice

`session-list`:

```ts
interface SessionListState {
  activeSessionId: string | null;
  sessions: SessionIndexEntry[];
  syncStatus: Record<string, SessionSyncStatus>; // idle | syncing | synced | error
  sidebarOpen: boolean;
  restored: boolean;
  renamingSessionId: string | null;
}
```

## Service

`sessionList: SessionListService` — 供其他插件操作会话。

```ts
interface SessionListService {
  getActiveSessionId(): string | null;
  createSession(): Promise<string>;
  switchSession(targetId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, name: string): void;
  saveCurrentSession(): Promise<void>;
}
```

## 核心机制

- **会话切换**：切换时先保存当前会话快照（包括所有窗口消息、模型配置、PK 布局），再加载目标会话
- **自动命名**：订阅 orchestrator 状态，从第一条用户消息自动生成会话名称（最多 40 字符），手动重命名后不再自动覆盖
- **自动保存**：检测窗口 streaming → idle/error 状态变化后自动保存会话快照
- **同步状态**：监听 network slice 同步状态，实时更新每个会话的同步指示点
- **旧数据迁移**：首次加载时如果没有会话索引但有旧窗口记录，自动迁移为一个"历史对话"会话

## 依赖

- `orchestrator` 服务 — 管理窗口和消息
- `network` 服务（NetworkSyncManager）— 刷新保存队列
- `NetworkService` — 会话级持久化（saveSession / loadSession / saveSessionIndex 等）
