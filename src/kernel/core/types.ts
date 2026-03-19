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
  | 'message:header'
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
  /** 当前消息对象（逐条消息 slot 如 message:header/footer 等会传入） */
  message?: ChatMessage;
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
  /** 当前聊天窗口 ID */
  windowId?: string;
  messages: ChatMessage[];
  /** 插件可在此修改 AI SDK 调用参数 */
  params: AICallParams;
  /** 自定义元数据，供插件间传递信息 */
  metadata: Record<string, unknown>;
  signal: AbortSignal;
  /**
   * 插件可在 onBuildRequest 中设置此字段来替换默认的 streamText 执行。
   * 设置后，pipeline 会跳过 streamText 和 fetchInterceptor，
   * 但 onAfterResponse / onRequestError 钩子仍会执行。
   */
  customExecutor?: CustomRequestExecutor;
}

/** 自定义请求执行器的返回类型，与 executeAIRequest 返回值兼容 */
export interface CustomExecutorResult {
  text: string;
  reasoning?: string;
  responseContent?: Array<Record<string, unknown>>;
  files?: GeneratedFileData[];
  usage?: TokenUsage;
  extras?: Record<string, unknown>;
}

/** 自定义请求执行器函数签名 */
export type CustomRequestExecutor = (ctx: {
  requestId: string;
  windowId?: string;
  messages: ChatMessage[];
  params: AICallParams;
  metadata: Record<string, unknown>;
  signal: AbortSignal;
  /** 通知 orchestrator 更新流式文本 */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** 通知 orchestrator 更新 reasoning */
  onReasoningChunk?: (chunk: string, accumulated: string) => void;
  /** 通知 orchestrator 添加生成的文件 */
  onFile?: (file: GeneratedFileData) => void;
}) => Promise<CustomExecutorResult>;

export interface StreamContext {
  requestId: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
  /** 自定义元数据，供插件间传递信息（与 RequestContext.metadata 同引用） */
  metadata: Record<string, unknown>;
  chunk: string;
  accumulated: string;
}

export interface ResponseContext {
  requestId: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
  /** 自定义元数据，供插件间传递信息（与 RequestContext.metadata 同引用） */
  metadata: Record<string, unknown>;
  messages: ChatMessage[];
  response: string;
  usage?: TokenUsage;
  /** 插件可在 onAfterResponse 中写入，orchestrator 会合并到 message.extras */
  extras?: Record<string, unknown>;
}

export interface ErrorContext {
  requestId: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
  /** 自定义元数据，供插件间传递信息（与 RequestContext.metadata 同引用） */
  metadata: Record<string, unknown>;
  error: Error;
  retryCount: number;
}

export interface FinalizeRequestContext {
  requestId: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
  /** 自定义元数据，供插件间传递信息（与 RequestContext.metadata 同引用） */
  metadata: Record<string, unknown>;
  /** 当前请求的 URL */
  url: string;
  /** 当前请求的 HTTP method */
  method: string;
  /** 可读写的请求头，插件可直接修改 */
  headers: Record<string, string>;
  /** 可读写的请求体，插件可直接修改 */
  body?: string | null;
}

export interface ResponseHeadersContext {
  requestId: string;
  /** 当前聊天窗口 ID */
  windowId?: string;
  /** 自定义元数据，供插件间传递信息（与 RequestContext.metadata 同引用） */
  metadata: Record<string, unknown>;
  headers: Record<string, string>;
  /** 插件可写入，orchestrator 会立即合并到 message.extras */
  extras?: Record<string, unknown>;
}

export interface RequestLifecycleHooks {
  onBuildRequest?: (ctx: RequestContext) => Promise<void> | void;
  onBeforeSend?: (ctx: RequestContext) => Promise<void> | void;
  /** fetch 发出前最后一刻触发，插件可修改最终 HTTP 请求头和请求体 */
  onFinalizeRequest?: (ctx: FinalizeRequestContext) => Promise<void> | void;
  /** 响应头到达时立即触发（流开始前），插件可提取 header 写入 extras */
  onResponseHeaders?: (ctx: ResponseHeadersContext) => Promise<void> | void;
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
  maxCompletionTokens?: ParamEntry<number>;
  seed?: ParamEntry<number>;
  stop?: ParamEntry<string>;
  frequencyPenalty?: ParamEntry<number>;
  presencePenalty?: ParamEntry<number>;
  repetitionPenalty?: ParamEntry<number>;
  logprobs?: ParamEntry<boolean>;
  topLogprobs?: ParamEntry<number>;
  reasoningEffort?: ParamEntry<string>;
  thinkingBudget?: ParamEntry<number>;
  responseFormat?: ParamEntry<string>;
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
  /** 生成该消息的模型 ID（仅 assistant 消息） */
  modelId?: string;
  /** 插件自定义扩展数据（序列化时 JSON 透传，不应包含大二进制数据） */
  extras?: Record<string, unknown>;
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
  /** 首 token 延迟（毫秒） */
  latencyMs?: number;
  /** 请求总耗时（毫秒） */
  totalMs?: number;
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
  /** 正在流式更新的消息 ID（用于 animated 等 UI 判断） */
  streamingMessageId?: string;
  /** 待发送的附件（发送后自动清空） */
  pendingAttachments?: MessageAttachment[];
  /** 窗口级模型覆盖（undefined = 使用全局 modelSelector） */
  modelId?: string;
  /** 窗口级协议覆盖（undefined = 使用全局 modelSelector） */
  protocolId?: string;
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
