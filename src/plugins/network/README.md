# network

网络持久化插件，负责聊天记录的序列化、保存、恢复和 blob 管理。

## State Slice

`network`:

```ts
interface NetworkState {
  restored: boolean;        // 是否已完成初始恢复
  pendingSaveCount: number; // 正在进行的保存操作数量
  lastSavedAt: number | null;
  lastError: string | null;
}
```

## Service

`network: NetworkSyncManagerInstance` — 供其他插件触发保存操作。

```ts
interface NetworkSyncManagerInstance {
  scheduleSave(windowId: string): void;   // 防抖保存
  saveNow(windowId: string): Promise<void>; // 立即保存
  saveAll(): Promise<void>;
  flushAll(): Promise<void>;  // 清除防抖 + 等待队列 + 全量保存
  restore(): Promise<void>;
  dispose(): void;
}
```

## 核心机制

- **自动保存**：订阅 orchestrator 状态，检测窗口 streaming → idle/error 后触发防抖保存
- **序列化**：`NetworkSerializer` 将 `ChatMessage` 序列化为 `NetworkMessage`，所有二进制数据（附件、生成文件、responseContent 中的 blob）上传为 URL
- **反序列化**：恢复时下载 URL 还原为 base64，单条消息失败降级为纯文本
- **blob 扫描**：已知路径（thoughtSignature 等）+ 启发式扫描（>10KB 的 base64 字符串）
- **PK 布局同步**：监听 PK 状态变化，防抖保存布局信息
- **页面卸载保存**：`beforeunload` 事件触发全量保存
- **指数退避重试**：保存失败最多重试 3 次（可配置）

## NetworkService 接口

用户需实现 `NetworkService` 接口并传入工厂函数。核心方法：

- `uploadBlob` / `downloadBlob` — blob 上传下载
- `saveWindowRecord` / `loadAllRecords` — 窗口记录持久化
- `saveSessionMeta` — 会话元数据保存
- `saveSessionIndex` / `loadSessionIndex` — 会话索引（供 session-list 使用）
- `saveSession` / `loadSession` / `deleteSession` — 会话级快照

## 本地实现

`LocalNetworkService`（`createLocalNetworkService()`）— 基于 localStorage + IndexedDB 的本地实现：
- **localStorage**: 存储窗口记录和会话元数据（JSON，已无二进制）
- **IndexedDB**: 存储 blob 数据（图片、thoughtSignature 等大二进制），使用 `local-blob://` 前缀

## 配置

```ts
interface NetworkPluginConfig {
  service: NetworkService;
  saveDebounceMs?: number;   // 默认 1000
  maxRetries?: number;       // 默认 3
  autoRestore?: boolean;     // 默认 true
}
```

## 文件结构

- `NetworkPlugin.ts` — 插件入口，注册状态、服务、订阅和恢复逻辑
- `NetworkSerializer.ts` — 消息序列化/反序列化，blob 上传下载
- `NetworkSyncManager.ts` — 防抖保存、重试、队列管理
- `LocalNetworkService.ts` — 本地 localStorage + IndexedDB 实现
- `types.ts` — 所有类型定义
