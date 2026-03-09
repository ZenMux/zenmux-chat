import type { SessionIndexEntry } from '@plugins/network';

// ─── 插件状态 ────────────────────────────────────────────────────

export type SessionSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SessionListState {
  /** 当前活跃会话 ID */
  activeSessionId: string | null;
  /** 所有会话元数据（按 updatedAt 降序） */
  sessions: SessionIndexEntry[];
  /** 每个会话的同步状态 */
  syncStatus: Record<string, SessionSyncStatus>;
  /** 侧栏是否展开 */
  sidebarOpen: boolean;
  /** 初始加载是否完成 */
  restored: boolean;
  /** 正在重命名的会话 ID */
  renamingSessionId: string | null;
}

// ─── 服务接口 ────────────────────────────────────────────────────

export interface SessionListService {
  getActiveSessionId(): string | null;
  createSession(): Promise<string>;
  switchSession(targetId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, name: string): void;
  saveCurrentSession(): Promise<void>;
}
