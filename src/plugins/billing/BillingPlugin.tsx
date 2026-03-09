import type { ChatPlugin, PluginContext, BillingMode } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
import { BillingToolbar } from './BillingToolbar';

// ─── State ───────────────────────────────────────────────────────

export type { BillingMode } from '../../kernel/core/types';

export interface BillingState {
  mode: BillingMode;
  plan: string;
  usageCount: number;
}

const SLICE_NAME = 'billing';

const INITIAL_STATE: BillingState = {
  mode: 'subscription',
  plan: 'pro',
  usageCount: 0,
};

// ─── Plugin ──────────────────────────────────────────────────────

export const BillingPlugin: ChatPlugin = {
  id: 'billing',

  setup(ctx: PluginContext) {
    // 1. 注册状态 slice
    ctx.state.registerSlice(SLICE_NAME, INITIAL_STATE);

    // 2. 注册 toolbar UI（右侧显示计费模式切换）
    ctx.ui.register('toolbar:right', {
      id: 'billing-toolbar',
      pluginId: 'billing',
      order: 10,
      render: (renderCtx) => <BillingToolbar windowId={renderCtx.windowId} />,
    });

    // 3. 注册请求生命周期钩子 —— 优先使用窗口级计费，否则使用全局
    ctx.requests.register('billing', {
      onBeforeSend: (reqCtx) => {
        const globalBilling = ctx.state.getSlice<BillingState>(SLICE_NAME);
        let mode = globalBilling.mode;
        let plan = globalBilling.plan;

        const windowId = reqCtx.metadata.windowId as string | undefined;
        if (windowId) {
          const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
          const window = orchState.windows[windowId];
          if (window?.billing) {
            mode = window.billing.mode;
            plan = window.billing.plan;
          }
        }

        const headers = reqCtx.params.headers ?? {};
        headers['x-billing-mode'] = mode;
        headers['x-plan'] = plan;
        reqCtx.params.headers = headers;
      },
      onAfterResponse: () => {
        // 用量计数保持全局
        ctx.state.setSlice<BillingState>(SLICE_NAME, (prev) => ({
          ...prev,
          usageCount: prev.usageCount + 1,
        }));
      },
    });
  },
};

export { SLICE_NAME as BILLING_SLICE };
