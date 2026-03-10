import type { ChatPlugin, PluginContext, WindowRequestConfig } from '../../kernel/core/types';
import { type ParamEntry } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
import { RequestConfigToolbar } from './RequestConfigToolbar';

// ─── State ───────────────────────────────────────────────────────

export type { ParamEntry } from '../../kernel/core/types';

export interface RequestConfigState {
  temperature: ParamEntry<number>;
  topP: ParamEntry<number>;
  maxTokens: ParamEntry<number>;
  maxCompletionTokens: ParamEntry<number>;
  seed: ParamEntry<number>;
  stop: ParamEntry<string>;
  frequencyPenalty: ParamEntry<number>;
  presencePenalty: ParamEntry<number>;
  repetitionPenalty: ParamEntry<number>;
  logprobs: ParamEntry<boolean>;
  topLogprobs: ParamEntry<number>;
  reasoningEffort: ParamEntry<string>;
  thinkingBudget: ParamEntry<number>;
  responseFormat: ParamEntry<string>;
  systemPrompt: ParamEntry<string>;
}

const SLICE_NAME = 'requestConfig';

const INITIAL_STATE: RequestConfigState = {
  temperature: { enabled: false, value: 0.7 },
  topP: { enabled: false, value: 1 },
  maxTokens: { enabled: false, value: 2048 },
  maxCompletionTokens: { enabled: false, value: 2048 },
  seed: { enabled: false, value: 0 },
  stop: { enabled: false, value: '' },
  frequencyPenalty: { enabled: false, value: 0 },
  presencePenalty: { enabled: false, value: 0 },
  repetitionPenalty: { enabled: false, value: 1 },
  logprobs: { enabled: false, value: false },
  topLogprobs: { enabled: false, value: 0 },
  reasoningEffort: { enabled: false, value: 'medium' },
  thinkingBudget: { enabled: false, value: 10240 },
  responseFormat: { enabled: false, value: 'text' },
  systemPrompt: { enabled: false, value: '' },
};

// ─── Plugin ──────────────────────────────────────────────────────

export const RequestConfigPlugin: ChatPlugin = {
  id: 'request-config',

  setup(ctx: PluginContext) {
    // 1. 注册状态 slice
    ctx.state.registerSlice(SLICE_NAME, INITIAL_STATE);

    // 2. 注册 toolbar 右侧参数配置按钮
    ctx.ui.register('toolbar:right', {
      id: 'request-config-toolbar',
      pluginId: 'request-config',
      order: 0,
      render: (renderCtx) => <RequestConfigToolbar windowId={renderCtx.windowId} />,
    });

    // 3. 注册请求生命周期钩子 —— 优先使用窗口级配置，否则使用全局配置
    ctx.requests.register('request-config', {
      onBuildRequest: (reqCtx) => {
        const globalConfig = ctx.state.getSlice<RequestConfigState>(SLICE_NAME);
        let config: RequestConfigState | WindowRequestConfig = globalConfig;

        const windowId = reqCtx.metadata.windowId as string | undefined;
        if (windowId) {
          const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
          const window = orchState.windows[windowId];
          if (window?.requestConfig) {
            config = window.requestConfig;
          }
        }

        if (config.temperature?.enabled) {
          reqCtx.params.temperature = config.temperature.value;
        }
        if (config.topP?.enabled) {
          reqCtx.params.topP = config.topP.value;
        }
        if (config.maxTokens?.enabled) {
          reqCtx.params.maxOutputTokens = config.maxTokens.value;
        }
        if (config.maxCompletionTokens?.enabled) {
          reqCtx.params.maxOutputTokens = config.maxCompletionTokens.value;
        }
        if (config.seed?.enabled) {
          reqCtx.params.seed = config.seed.value;
        }
        if (config.stop?.enabled && config.stop.value) {
          reqCtx.params.stopSequences = config.stop.value.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        if (config.frequencyPenalty?.enabled) {
          reqCtx.params.frequencyPenalty = config.frequencyPenalty.value;
        }
        if (config.presencePenalty?.enabled) {
          reqCtx.params.presencePenalty = config.presencePenalty.value;
        }
        if (config.logprobs?.enabled) {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            openai: {
              ...(reqCtx.params.providerOptions?.openai as Record<string, unknown> ?? {}),
              logprobs: config.logprobs.value,
            },
          };
        }
        if (config.topLogprobs?.enabled) {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            openai: {
              ...(reqCtx.params.providerOptions?.openai as Record<string, unknown> ?? {}),
              topLogprobs: config.topLogprobs.value,
            },
          };
        }
        if (config.reasoningEffort?.enabled) {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            openai: {
              ...(reqCtx.params.providerOptions?.openai as Record<string, unknown> ?? {}),
              reasoningEffort: config.reasoningEffort.value,
            },
          };
        }
        if (config.thinkingBudget?.enabled) {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            anthropic: {
              ...(reqCtx.params.providerOptions?.anthropic as Record<string, unknown> ?? {}),
              thinking: { type: 'enabled', budgetTokens: config.thinkingBudget.value },
            },
          };
        }
        if (config.repetitionPenalty?.enabled) {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            openaicompat: {
              ...(reqCtx.params.providerOptions?.openaicompat as Record<string, unknown> ?? {}),
              repetition_penalty: config.repetitionPenalty.value,
            },
          };
        }
        if (config.responseFormat?.enabled && config.responseFormat.value !== 'text') {
          reqCtx.params.providerOptions = {
            ...reqCtx.params.providerOptions,
            openai: {
              ...(reqCtx.params.providerOptions?.openai as Record<string, unknown> ?? {}),
              responseFormat: { type: config.responseFormat.value },
            },
          };
        }
        if (config.systemPrompt?.enabled && config.systemPrompt.value) {
          reqCtx.params.system = config.systemPrompt.value;
        }
      },
    });
  },
};

export { SLICE_NAME as REQUEST_CONFIG_SLICE };
