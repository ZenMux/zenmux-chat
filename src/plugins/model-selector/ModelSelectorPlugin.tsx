import type { LanguageModel } from 'ai';
import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
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
  /** 模型支持的可配置请求参数 */
  supportedParams: SupportedParam[];
}

export interface ModelOption {
  id: string;
  label: string;
  model: LanguageModel;
  capabilities: ModelCapabilities;
}

/** 其他插件通过 services.get<ModelInfoService>('modelInfo') 获取 */
export interface ModelInfoService {
  getCurrentModelId(): string;
  getCapabilities(): ModelCapabilities;
  getOptions(): ModelOption[];
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

// ─── State ───────────────────────────────────────────────────────

export interface ModelSelectorState {
  selectedModelId: string;
}

const SLICE_NAME = 'modelSelector';

// ─── 插件配置 ────────────────────────────────────────────────────

export interface ModelSelectorPluginConfig {
  /** 可选模型列表 */
  models: ModelOption[];
  /** 默认选中的模型 ID（不传则使用 models[0].id） */
  defaultModelId?: string;
}

// ─── Plugin ──────────────────────────────────────────────────────

export function createModelSelectorPlugin(config: ModelSelectorPluginConfig): ChatPlugin {
  const { models, defaultModelId } = config;

  const initialState: ModelSelectorState = {
    selectedModelId: defaultModelId ?? models[0]?.id ?? '',
  };

  return {
    id: 'model-selector',

    setup(ctx: PluginContext) {
      // 1. 注册状态 slice
      ctx.state.registerSlice(SLICE_NAME, initialState);

      // 2. 注册 toolbar 左侧模型选择器 UI
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
        getCapabilities: () => {
          const { selectedModelId } = ctx.state.getSlice<ModelSelectorState>(SLICE_NAME);
          const option = models.find((m) => m.id === selectedModelId);
          return option?.capabilities ?? { supportsImages: false, supportsFiles: false, supportedParams: [] };
        },
        getOptions: () => models,
      }));

      // 4. 注册请求生命周期钩子 —— 优先使用窗口级模型，否则使用全局选择
      ctx.requests.register('model-selector', {
        onBuildRequest: (reqCtx) => {
          const windowId = reqCtx.metadata.windowId as string | undefined;
          let modelId: string;

          if (windowId) {
            const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
            const window = orchState.windows[windowId];
            modelId = window?.modelId ?? ctx.state.getSlice<ModelSelectorState>(SLICE_NAME).selectedModelId;
          } else {
            modelId = ctx.state.getSlice<ModelSelectorState>(SLICE_NAME).selectedModelId;
          }

          const option = models.find((m) => m.id === modelId);
          if (option) {
            reqCtx.params.model = option.model;
          }
        },
      });
    },
  };
}

export { SLICE_NAME as MODEL_SELECTOR_SLICE };
