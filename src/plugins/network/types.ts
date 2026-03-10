import type { WindowRequestConfig, WindowBilling } from '@kernel/core/types';

// ─── NetworkService 接口（用户实现） ─────────────────────────────

/**
 * 网络服务接口 — 由用户实现，传入 createNetworkPlugin 工厂函数。
 * 所有方法都可能因网络错误而失败，调用方会捕获并处理。
 */
export interface NetworkService {
  /** 上传二进制数据（图片、thoughtSignature 等），返回可访问的 URL */
  uploadBlob(blob: Blob, metadata: BlobUploadMetadata): Promise<string>;
  /** 下载之前上传的 blob（restore 时将 URL 还原回 base64） */
  downloadBlob(url: string): Promise<Blob>;
  /** 保存单个窗口的聊天记录（每次传完整消息列表，实现方自行决定增量/全量） */
  saveWindowRecord(windowId: string, record: NetworkWindowRecord): Promise<void>;
  /** 加载所有窗口记录（启动时恢复） */
  loadAllRecords(): Promise<NetworkSessionSnapshot>;
  /** 保存会话元数据（activeWindowId、PK 布局等） */
  saveSessionMeta?(meta: SessionMeta): Promise<void>;
  /** 删除指定窗口记录（可选） */
  deleteWindowRecord?(windowId: string): Promise<void>;

  // ─── 会话级持久化（session-list 插件使用） ──────────────────
  /** 保存会话索引 */
  saveSessionIndex?(sessions: SessionIndexEntry[]): Promise<void>;
  /** 加载会话索引 */
  loadSessionIndex?(): Promise<SessionIndexEntry[]>;
  /** 保存完整会话快照 */
  saveSession?(sessionId: string, snapshot: SessionSnapshot): Promise<void>;
  /** 加载完整会话快照 */
  loadSession?(sessionId: string): Promise<SessionSnapshot | null>;
  /** 删除会话及其所有数据 */
  deleteSession?(sessionId: string): Promise<void>;
}

export interface SessionMeta {
  activeWindowId: string | null;
  pkLayout: { windowIds: string[]; excludedWindowIds: string[] } | null;
}

export interface BlobUploadMetadata {
  /** 数据来源类型 */
  source: 'attachment' | 'generated-file' | 'response-content';
  /** IANA media type, e.g. 'image/png', 'application/octet-stream' */
  mediaType: string;
  /** 关联的消息 ID */
  messageId: string;
  /** 关联的窗口 ID */
  windowId: string;
  /** 原始文件名（仅 attachment 时有） */
  filename?: string;
}

// ─── 网络可存储的消息格式（URL 替代 base64） ──────────────────────

export interface NetworkMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: NetworkAttachment[];
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
  reasoning?: string;
  responseContent?: Array<Record<string, unknown>>;
  /** 记录 responseContent 中哪些 blob 被替换为 URL */
  responseContentBlobRefs?: ResponseContentBlobRef[];
  generatedFiles?: NetworkGeneratedFile[];
  /** 生成该消息的模型 ID */
  modelId?: string;
  /** 插件自定义扩展数据（JSON 透传） */
  extras?: Record<string, unknown>;
}

export interface NetworkAttachment {
  id: string;
  name: string;
  mediaType: string;
  /** 替代原始 base64 data 的 URL */
  url: string;
}

export interface NetworkGeneratedFile {
  /** 替代原始 base64 的 URL */
  url: string;
  mediaType: string;
}

/**
 * 记录 responseContent 中被替换为 URL 的 blob 位置，
 * 用于 restore 时精确还原。
 */
export interface ResponseContentBlobRef {
  /** responseContent 数组中的索引 */
  index: number;
  /** 被替换字段的 JSON path, e.g. "providerOptions.openai.thoughtSignature" */
  path: string;
  /** 上传后的 URL */
  url: string;
  /** 原始数据的 media type */
  mediaType: string;
}

// ─── 窗口记录与会话快照 ─────────────────────────────────────────

export interface NetworkWindowRecord {
  windowId: string;
  messages: NetworkMessage[];
  /** 窗口级模型覆盖 */
  modelId?: string;
  /** 窗口级请求参数覆盖 */
  requestConfig?: WindowRequestConfig;
  /** 窗口级计费覆盖 */
  billing?: WindowBilling;
  /** 保存时间戳 */
  savedAt: number;
}

/**
 * 完整的会话快照 — loadAllRecords 的返回值。
 * 包含所有窗口记录和 PK 布局信息。
 */
export interface NetworkSessionSnapshot {
  windows: NetworkWindowRecord[];
  /** PK 模式的窗口布局，null 表示非 PK 模式 */
  pkLayout: {
    windowIds: string[];
    excludedWindowIds: string[];
  } | null;
  /** 当前活跃窗口 ID */
  activeWindowId: string | null;
}

// ─── 会话索引与快照（session-list 插件使用） ────────────────────

/** 会话索引条目（轻量，仅元数据） */
export interface SessionIndexEntry {
  id: string;
  /** 显示名称 */
  name: string;
  /** 是否由用户手动命名（阻止自动重命名） */
  nameManual: boolean;
  createdAt: number;
  updatedAt: number;
  /** 第一条用户消息的前 80 字符预览 */
  preview: string;
}

/** 完整会话快照 */
export interface SessionSnapshot {
  meta: SessionIndexEntry;
  windows: NetworkWindowRecord[];
  pkLayout: { windowIds: string[]; excludedWindowIds: string[] } | null;
  activeWindowId: string | null;
}

// ─── 插件状态与配置 ──────────────────────────────────────────────

export interface NetworkState {
  /** 是否已完成初始恢复 */
  restored: boolean;
  /** 正在进行的保存操作数量 */
  pendingSaveCount: number;
  /** 最后一次成功保存的时间戳 */
  lastSavedAt: number | null;
  /** 最近的错误信息 */
  lastError: string | null;
}

export interface NetworkPluginConfig {
  /** 用户实现的网络服务 */
  service: NetworkService;
  /** 保存防抖延迟（毫秒），默认 1000 */
  saveDebounceMs?: number;
  /** 保存失败时最大重试次数，默认 3 */
  maxRetries?: number;
  /** 是否在启动时自动恢复，默认 true */
  autoRestore?: boolean;
}

// ─── SyncManager 接口 ───────────────────────────────────────────

export interface NetworkSyncManagerInstance {
  /** 防抖保存指定窗口 */
  scheduleSave(windowId: string): void;
  /** 立即保存指定窗口（绕过防抖） */
  saveNow(windowId: string): Promise<void>;
  /** 立即保存所有窗口 */
  saveAll(): Promise<void>;
  /** 刷新所有待保存操作（清除防抖 + 等待队列 + saveAll） */
  flushAll(): Promise<void>;
  /** 从网络恢复所有记录 */
  restore(): Promise<void>;
  /** 清理定时器和待处理操作 */
  dispose(): void;
}
