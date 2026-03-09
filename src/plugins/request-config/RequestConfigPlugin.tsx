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
  systemPrompt: ParamEntry<string>;
}

const SLICE_NAME = 'requestConfig';

const INITIAL_STATE: RequestConfigState = {
  temperature: { enabled: false, value: 0.7 },
  topP: { enabled: false, value: 1 },
  maxTokens: { enabled: false, value: 2048 },
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
        if (config.systemPrompt?.enabled && config.systemPrompt.value) {
          reqCtx.params.system = config.systemPrompt.value;
        }
      },
    });
  },
};

export { SLICE_NAME as REQUEST_CONFIG_SLICE };
