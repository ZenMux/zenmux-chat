import type { LanguageModel } from 'ai';
import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
import { withReasoningSupport } from '../../lib/reasoning-middleware';
import { ModelSelectorToolbar } from './ModelSelectorToolbar';
import { ModelMessageHeader } from './ModelMessageHeader';

/** 模型支持的请求参数 */
export type SupportedParam =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'maxCompletionTokens'
  | 'seed'
  | 'stop'
  | 'frequencyPenalty'
  | 'presencePenalty'
  | 'repetitionPenalty'
  | 'logprobs'
  | 'topLogprobs'
  | 'reasoningEffort'
  | 'thinkingBudget'
  | 'responseFormat'
  | 'systemPrompt';

export interface ModelCapabilities {
  /** 是否支持图片输入 */
  supportsImages: boolean;
  /** 是否支持文件输入（PDF 等） */
  supportsFiles: boolean;
  /** 模型支持的可配置请求参数（仅当模型只兼容一种协议时有意义，多协议场景下由协议决定） */
  supportedParams: SupportedParam[];
}

// ─── Provider / Protocol / Model 三层模型 ─────────────────────

/** Provider 配置 — 封装 AI SDK provider 工厂 */
export interface ProviderConfig {
  id: string;
  label: string;
  /** 惰性创建 provider 实例（内部自动缓存）。可选 fetch 参数用于注入拦截器 */
  createInstance: (fetchFn?: typeof globalThis.fetch) => unknown;
}

/** Protocol — 如何将 provider + modelId 转换为 LanguageModel */
export interface ProtocolOption {
  id: string;
  label: string;
  /** 该协议使用的 provider ID（引用 ProviderConfig.id） */
  providerId: string;
  supportedParams: SupportedParam[];
  /** 给定 provider 实例和模型 ID，返回 LanguageModel */
  resolve: (providerInstance: any, modelId: string) => LanguageModel;
}

/** 解耦后的模型条目 */
export interface ModelEntry {
  id: string;
  label: string;
  capabilities: ModelCapabilities;
  /** 该模型兼容的协议 ID 列表 */
  compatibleProtocols: string[];
  /** 默认协议 ID */
  defaultProtocol: string;
  /** 跳过 protocol resolve，直接使用此 LanguageModel（mock 等场景） */
  overrideModel?: LanguageModel;
}

/** 兼容旧版：预绑定的模型选项 */
export interface ModelOption {
  id: string;
  label: string;
  model: LanguageModel;
  capabilities: ModelCapabilities;
}

/** 其他插件通过 services.get<ModelInfoService>('modelInfo') 获取 */
export interface ModelInfoService {
  getCurrentModelId(): string;
  getCurrentProtocolId(): string;
  getCapabilities(): ModelCapabilities;
  getModels(): ModelEntry[];
  getProtocols(): ProtocolOption[];
  getCompatibleProtocols(modelId: string): ProtocolOption[];
  /** @deprecated 使用 getModels() 代替 */
  getOptions(): ModelEntry[];
}

/** chat completions 模型通用参数 */
export const CHAT_PARAMS: SupportedParam[] = [
  'temperature', 'topP', 'maxTokens', 'maxCompletionTokens',
  'seed', 'stop', 'frequencyPenalty', 'presencePenalty',
  'logprobs', 'topLogprobs', 'reasoningEffort', 'thinkingBudget',
  'responseFormat', 'systemPrompt',
];
/** responses API 模型参数（不支持 topP） */
export const RESPONSES_PARAMS: SupportedParam[] = [
  'temperature', 'maxTokens', 'maxCompletionTokens',
  'seed', 'stop', 'frequencyPenalty', 'presencePenalty',
  'logprobs', 'topLogprobs', 'reasoningEffort', 'thinkingBudget',
  'responseFormat', 'systemPrompt',
];
/** Anthropic Messages API 参数 */
export const ANTHROPIC_PARAMS: SupportedParam[] = [
  'temperature', 'topP', 'maxTokens', 'maxCompletionTokens',
  'stop', 'thinkingBudget', 'systemPrompt',
];

// ─── State ───────────────────────────────────────────────────────

export interface ModelSelectorState {
  selectedModelId: string;
  selectedProtocolId: string;
}

const SLICE_NAME = 'modelSelector';

// ─── 插件配置 ────────────────────────────────────────────────────

export interface ModelSelectorPluginConfig {
  providers: ProviderConfig[];
  protocols: ProtocolOption[];
  models: ModelEntry[];
  defaultModelId?: string;
  defaultProtocolId?: string;
}

// ─── Plugin ──────────────────────────────────────────────────────

export function createModelSelectorPlugin(config: ModelSelectorPluginConfig): ChatPlugin {
  const { providers, protocols, models, defaultModelId, defaultProtocolId } = config;

  // Provider 实例缓存
  const providerInstances = new Map<string, unknown>();
  let interceptorFetch: typeof globalThis.fetch | undefined;

  function getProviderInstance(providerId: string): unknown {
    let instance = providerInstances.get(providerId);
    if (!instance) {
      const providerConfig = providers.find((p) => p.id === providerId);
      if (!providerConfig) throw new Error(`Provider "${providerId}" not found`);
      instance = providerConfig.createInstance(interceptorFetch);
      providerInstances.set(providerId, instance);
    }
    return instance;
  }

  const defaultModel = models[0];
  const initialState: ModelSelectorState = {
    selectedModelId: defaultModelId ?? defaultModel?.id ?? '',
    selectedProtocolId: defaultProtocolId ?? defaultModel?.defaultProtocol ?? '',
  };

  /** 解析 modelId + protocolId（窗口级优先） */
  function resolveSelections(
    ctx: PluginContext,
    windowId: string | undefined,
  ): { modelId: string; protocolId: string } {
    const globalState = ctx.state.getSlice<ModelSelectorState>(SLICE_NAME);

    if (windowId) {
      const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
      const win = orchState.windows[windowId];
      return {
        modelId: win?.modelId ?? globalState.selectedModelId,
        protocolId: win?.protocolId ?? globalState.selectedProtocolId,
      };
    }

    return {
      modelId: globalState.selectedModelId,
      protocolId: globalState.selectedProtocolId,
    };
  }

  /** 根据 modelId + protocolId 解析出 LanguageModel */
  function resolveLanguageModel(modelId: string, protocolId: string): LanguageModel | undefined {
    const model = models.find((m) => m.id === modelId);
    if (!model) return undefined;

    // 特殊场景：overrideModel 跳过协议解析
    if (model.overrideModel) return model.overrideModel;

    const protocol = protocols.find((p) => p.id === protocolId);
    if (!protocol) return undefined;

    const providerInstance = getProviderInstance(protocol.providerId);
    const languageModel = protocol.resolve(providerInstance, model.id);

    // Chat Completions 协议：@ai-sdk/openai 不解析 reasoning_content，需要中间件提取
    if (protocolId === 'chat.completion') {
      return withReasoningSupport(languageModel);
    }

    return languageModel;
  }

  return {
    id: 'model-selector',

    setup(ctx: PluginContext) {
      // 0. 获取 fetchInterceptor（如果已注册），provider 创建时注入
      if (ctx.services.has('fetchInterceptor')) {
        interceptorFetch = ctx.services.get<{ fetch: typeof globalThis.fetch }>('fetchInterceptor').fetch;
      }

      // 1. 注册状态 slice
      ctx.state.registerSlice(SLICE_NAME, initialState);

      // 2. 注册 toolbar 左侧模型 + 协议选择器 UI
      ctx.ui.register('toolbar:left', {
        id: 'model-selector-toolbar',
        pluginId: 'model-selector',
        order: 0,
        render: (renderCtx) => <ModelSelectorToolbar windowId={renderCtx.windowId} />,
      });

      // 3. 注册消息头部模型名称显示
      ctx.ui.register('message:header', {
        id: 'model-message-header',
        pluginId: 'model-selector',
        order: 0,
        render: (renderCtx) => <ModelMessageHeader ctx={renderCtx} />,
      });

      // 4. 注册 modelInfo service —— 供其他插件查询当前模型能力
      ctx.services.register<ModelInfoService>('modelInfo', () => ({
        getCurrentModelId: () => ctx.state.getSlice<ModelSelectorState>(SLICE_NAME).selectedModelId,
        getCurrentProtocolId: () => ctx.state.getSlice<ModelSelectorState>(SLICE_NAME).selectedProtocolId,
        getCapabilities: () => {
          const { selectedModelId, selectedProtocolId } = ctx.state.getSlice<ModelSelectorState>(SLICE_NAME);
          const model = models.find((m) => m.id === selectedModelId);
          const protocol = protocols.find((p) => p.id === selectedProtocolId);
          return {
            supportsImages: model?.capabilities.supportsImages ?? false,
            supportsFiles: model?.capabilities.supportsFiles ?? false,
            supportedParams: protocol?.supportedParams ?? model?.capabilities.supportedParams ?? [],
          };
        },
        getModels: () => models,
        getProtocols: () => protocols,
        getCompatibleProtocols: (modelId: string) => {
          const model = models.find((m) => m.id === modelId);
          if (!model) return [];
          return protocols.filter((p) => model.compatibleProtocols.includes(p.id));
        },
        getOptions: () => models,
      }));

      // 5. 注册请求生命周期钩子 —— 优先使用窗口级模型+协议，否则使用全局选择
      ctx.requests.register('model-selector', {
        onBuildRequest: (reqCtx) => {
          const windowId = reqCtx.metadata.windowId as string | undefined;
          const { modelId, protocolId } = resolveSelections(ctx, windowId);
          const languageModel = resolveLanguageModel(modelId, protocolId);
          if (languageModel) {
            reqCtx.params.model = languageModel;
          }
        },
      });
    },
  };
}

export { SLICE_NAME as MODEL_SELECTOR_SLICE };
