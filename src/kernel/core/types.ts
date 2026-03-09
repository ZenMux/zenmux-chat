import type { ReactNode } from 'react';
import type { streamText } from 'ai';

// ─── AI SDK 派生类型 ────────────────────────────────────────────

/** streamText 的完整参数类型 */
type StreamTextOptions = Parameters<typeof streamText>[0];

/**
 * 插件可设置的 AI SDK 调用参数。
 * 直接从 streamText 参数类型派生，不手动枚举 —— AI SDK 支持什么，插件就能设什么。
 * pipeline 管理的字段（messages、abortSignal）由内核控制，插件无需关心。
 */
export type AICallParams = Partial<Omit<StreamTextOptions, 'messages' | 'abortSignal'>>;

// ─── Plugin System ───────────────────────────────────────────────

export interface ChatPlugin {
  id: string;
  setup(ctx: PluginContext): void;
  dispose?(): void;
}

export interface PluginContext {
  ui: UISlotRegistry;
  requests: RequestLifecycleRegistry;
  state: RuntimeStateManager;
  services: ServiceContainer;
}

// ─── UI Slot System ──────────────────────────────────────────────

export type UISlotName =
  | 'sidebar:left'
  | 'toolbar:left'
  | 'toolbar:right'
  | 'panel:header'
  | 'panel:footer'
  | 'message:above'
  | 'message:below'
  | 'message:footer'
  | 'message:reasoning'
  | 'message:files'
  | 'message:streaming'
  | 'message:error'
  | 'input:composer'
  | 'input:actions';

export interface UISlotItem {
  id: string;
  pluginId: string;
  order?: number;
  visible?: () => boolean;
  render: (ctx: RenderContext) => ReactNode;
}

export interface RenderContext {
  state: RuntimeStateManager;
  services: ServiceContainer;
  /** 当处于 message:footer 等逐条消息 slot 时，传入当前消息 ID */
  messageId?: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
}

/** 插件通过 services.get<ScrollService>('scroll') 获取消息区域 DOM */
export interface ScrollService {
  getContainer(): HTMLDivElement | null;
  scrollToBottom?(behavior?: 'smooth' | 'auto'): void;
}

/** 自定义消息渲染器 —— 插件可注册以替换默认消息气泡 */
export interface MessageRenderer {
  id: string;
  pluginId: string;
  /** 判断是否接管该消息的渲染 */
  match: (msg: ChatMessage) => boolean;
  /** 自定义渲染 */
  render: (msg: ChatMessage, ctx: RenderContext) => ReactNode;
}

export interface UISlotRegistry {
  register(slot: UISlotName, item: UISlotItem): void;
  unregister(slot: UISlotName, itemId: string): void;
  getItems(slot: UISlotName): UISlotItem[];
  /** 注册自定义消息渲染器 */
  registerMessageRenderer(renderer: MessageRenderer): void;
  /** 注销自定义消息渲染器 */
  unregisterMessageRenderer(rendererId: string): void;
  /** 获取所有已注册的消息渲染器 */
  getMessageRenderers(): MessageRenderer[];
  subscribe(fn: () => void): () => void;
}

// ─── Request Lifecycle ───────────────────────────────────────────

export interface RequestContext {
  requestId: string;
  messages: ChatMessage[];
  /** 插件可在此修改 AI SDK 调用参数 */
  params: AICallParams;
  /** 自定义元数据，供插件间传递信息 */
  metadata: Record<string, unknown>;
  signal: AbortSignal;
}

export interface StreamContext {
  requestId: string;
  chunk: string;
  accumulated: string;
}

export interface ResponseContext {
  requestId: string;
  messages: ChatMessage[];
  response: string;
  usage?: TokenUsage;
}

export interface ErrorContext {
  requestId: string;
  error: Error;
  retryCount: number;
}

export interface RequestLifecycleHooks {
  onBuildRequest?: (ctx: RequestContext) => Promise<void> | void;
  onBeforeSend?: (ctx: RequestContext) => Promise<void> | void;
  onStreamChunk?: (ctx: StreamContext) => Promise<void> | void;
  onAfterResponse?: (ctx: ResponseContext) => Promise<void> | void;
  onRequestError?: (ctx: ErrorContext) => Promise<void> | void;
}

export interface RequestLifecycleRegistry {
  register(pluginId: string, hooks: RequestLifecycleHooks): void;
  unregister(pluginId: string): void;
  getHooks(): Array<{ pluginId: string; hooks: RequestLifecycleHooks }>;
}

// ─── State Management ────────────────────────────────────────────

export interface RuntimeStateManager {
  registerSlice<T>(name: string, initialState: T): void;
  getSlice<T>(name: string): T;
  setSlice<T>(name: string, updater: T | ((prev: T) => T)): void;
  subscribe<T>(name: string, listener: (state: T) => void): () => void;
}

// ─── Service Container ──────────────────────────────────────────

export interface ServiceContainer {
  register<T>(name: string, factory: () => T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
}

// ─── Shared Value Types ─────────────────────────────────────────

/** 带开关的参数值 —— 用于可选请求参数、窗口级配置等 */
export interface ParamEntry<T> {
  enabled: boolean;
  value: T;
}

/** 计费模式 */
export type BillingMode = 'subscription' | 'payg';

/** 窗口级请求参数配置（undefined 字段表示使用全局默认值） */
export interface WindowRequestConfig {
  temperature?: ParamEntry<number>;
  topP?: ParamEntry<number>;
  maxTokens?: ParamEntry<number>;
  systemPrompt?: ParamEntry<string>;
}

/** 窗口级计费配置 */
export interface WindowBilling {
  mode: BillingMode;
  plan: string;
}

// ─── Chat Domain Types ──────────────────────────────────────────

export interface MessageAttachment {
  id: string;
  /** 文件名 */
  name: string;
  /** IANA media type, e.g. 'image/png', 'application/pdf' */
  mediaType: string;
  /** base64 编码的文件内容 */
  data: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** 附件列表（图片、文件等） */
  attachments?: MessageAttachment[];
  /** AI 响应的 token 用量（仅 assistant 消息） */
  usage?: TokenUsage;
  /** 模型思考过程（reasoning/thinking，仅 assistant 消息） */
  reasoning?: string;
  /** AI SDK 响应的原始 content parts（含 providerOptions，用于后续请求回传 thoughtSignature 等） */
  responseContent?: Array<Record<string, unknown>>;
  /** 模型生成的文件（图片等，仅 assistant 消息） */
  generatedFiles?: GeneratedFileData[];
}

export interface GeneratedFileData {
  /** base64 编码的文件内容 */
  base64: string;
  /** IANA media type, e.g. 'image/png' */
  mediaType: string;
}

export interface TokenUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

export interface ChatError {
  message: string;
  /** HTTP 状态码（如 401, 429, 500 等） */
  statusCode?: number;
  /** 错误类型名称（如 APICallError, AuthenticationError） */
  errorType?: string;
  /** 请求 ID，用于向服务商排查 */
  requestId?: string;
  /** 服务端返回的原始错误信息 */
  responseBody?: string;
  /** 错误发生时间 */
  timestamp: number;
}

export interface ChatWindow {
  id: string;
  messages: ChatMessage[];
  status: 'idle' | 'streaming' | 'error';
  error?: ChatError;
  abortController?: AbortController;
  /** 待发送的附件（发送后自动清空） */
  pendingAttachments?: MessageAttachment[];
  /** 窗口级模型覆盖（undefined = 使用全局 modelSelector） */
  modelId?: string;
  /** 窗口级请求参数覆盖（undefined = 使用全局 requestConfig） */
  requestConfig?: WindowRequestConfig;
  /** 窗口级计费覆盖（undefined = 使用全局 billing） */
  billing?: WindowBilling;
}

// ─── Kernel Interface ────────────────────────────────────────────

export interface ChatKernel {
  plugins: PluginManager;
  ui: UISlotRegistry;
  requests: RequestLifecycleRegistry;
  state: RuntimeStateManager;
  services: ServiceContainer;
  boot(): void;
  dispose(): void;
}

export interface PluginManager {
  register(plugin: ChatPlugin): void;
  unregister(pluginId: string): void;
  getPlugin(pluginId: string): ChatPlugin | undefined;
  getAllPlugins(): ChatPlugin[];
}
