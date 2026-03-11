import { cn } from '../../lib/cn';
import type { ChatPlugin, PluginContext, WindowRequestConfig, WindowBilling } from '../../kernel/core/types';
import type { ChatOrchestratorInstance } from '../../kernel/orchestrator/ChatOrchestrator';
import type { InputSyncService } from '../input-composer/InputComposerPlugin';
import { MODEL_SELECTOR_SLICE, type ModelInfoService, type ModelSelectorState } from '../model-selector/ModelSelectorPlugin';
import { REQUEST_CONFIG_SLICE, type RequestConfigState } from '../request-config/RequestConfigPlugin';
import { BILLING_SLICE, type BillingState } from '../billing/BillingPlugin';
import { useKernel, usePluginState, useOrchestratorState } from '../../kernel/ui/KernelProvider';

// ─── State ───────────────────────────────────────────────────────

export interface PKState {
  windowIds: string[];
  /** 不参与 PK 同步的窗口 ID 列表 */
  excludedWindowIds: string[];
}

export interface PKInputState {
  text: string;
}

export const PK_SLICE = 'pk';
const PK_INPUT_SLICE = 'pk:input';

const INITIAL_STATE: PKState = {
  windowIds: [],
  excludedWindowIds: [],
};

const INITIAL_INPUT_STATE: PKInputState = { text: '' };

// ─── UI Components ──────────────────────────────────────────────

/** PK 开关按钮（始终显示在 toolbar:right，每个窗口各自渲染） */
function PKToolbarButton({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [pkState, setPKState] = usePluginState<PKState>(PK_SLICE);
  const orchState = useOrchestratorState();

  /** 从全局状态读取当前 config / billing，作为新窗口的初始值 */
  const readGlobalDefaults = () => {
    const globalConfig = kernel.state.getSlice<RequestConfigState>(REQUEST_CONFIG_SLICE);
    const globalBilling = kernel.state.getSlice<BillingState>(BILLING_SLICE);
    const requestConfig: WindowRequestConfig = {
      temperature: { ...globalConfig.temperature },
      topP: { ...globalConfig.topP },
      maxTokens: { ...globalConfig.maxTokens },
      systemPrompt: { ...globalConfig.systemPrompt },
    };
    const billing: WindowBilling = { mode: globalBilling.mode, plan: globalBilling.plan };
    return { requestConfig, billing };
  };

  const handleClick = () => {
    if (pkState.windowIds.length <= 1) {
      // 首次开启 PK：当前窗口 + 新建窗口
      const currentWindowId = orchState.activeWindowId;
      if (!currentWindowId) return;

      const modelInfo = kernel.services.get<ModelInfoService>('modelInfo');
      const modelOptions = modelInfo.getOptions();
      const currentModelId = modelInfo.getCurrentModelId();
      const altModel = modelOptions.find((m) => m.id !== currentModelId) ?? modelOptions[0];
      const { requestConfig, billing } = readGlobalDefaults();

      // 给现有窗口设置窗口级覆盖
      kernel.orchestrator.updateWindow(currentWindowId, {
        modelId: currentModelId,
        requestConfig: { ...requestConfig },
        billing: { ...billing },
      });

      // 创建新窗口，带不同模型但相同 config/billing
      const currentWindow = orchState.windows[currentWindowId];
      const pendingAttachments = currentWindow?.pendingAttachments ?? [];

      const newWindowId = kernel.orchestrator.createWindow(undefined, {
        modelId: altModel.id,
        requestConfig: { ...requestConfig },
        billing: { ...billing },
      });

      // 同步当前窗口的附件到新窗口
      if (pendingAttachments.length > 0) {
        kernel.orchestrator.updateWindow(newWindowId, { pendingAttachments: [...pendingAttachments] });
      }

      setPKState({
        windowIds: [currentWindowId, newWindowId],
        excludedWindowIds: [],
      });
    } else {
      // 追加窗口：继承第一个窗口的设置，包括附件
      const firstWindowId = pkState.windowIds[0];
      const firstWindow = orchState.windows[firstWindowId];
      const pendingAttachments = firstWindow?.pendingAttachments ?? [];
      const usedModelIds = new Set(
        pkState.windowIds.map((wid) => orchState.windows[wid]?.modelId).filter(Boolean),
      );
      const modelOptions = kernel.services.get<ModelInfoService>('modelInfo').getOptions();
      const unusedModel = modelOptions.find((m) => !usedModelIds.has(m.id)) ?? modelOptions[0];

      const newWindowId = kernel.orchestrator.createWindow(undefined, {
        modelId: unusedModel.id,
        requestConfig: firstWindow?.requestConfig ? { ...firstWindow.requestConfig } : undefined,
        billing: firstWindow?.billing ? { ...firstWindow.billing } : undefined,
      });

      // 同步附件到新窗口
      if (pendingAttachments.length > 0) {
        kernel.orchestrator.updateWindow(newWindowId, { pendingAttachments: [...pendingAttachments] });
      }

      setPKState((prev) => ({
        ...prev,
        windowIds: [...prev.windowIds, newWindowId],
      }));
    }
  };

  /** 移除当前窗口；剩余 <=1 个窗口时退出 PK 模式 */
  const handleRemoveWindow = () => {
    if (!windowId) return;
    const remaining = pkState.windowIds.filter((id) => id !== windowId);
    if (remaining.length <= 1) {
      // 只剩一个窗口，退出 PK 模式；将剩余窗口的模型同步回全局状态
      const lastWindowId = remaining[0];
      if (lastWindowId) {
        const lastWindow = orchState.windows[lastWindowId];
        if (lastWindow?.modelId) {
          kernel.state.setSlice<ModelSelectorState>(MODEL_SELECTOR_SLICE, { selectedModelId: lastWindow.modelId });
        }
        // 清除窗口级覆盖，回到全局模式
        kernel.orchestrator.updateWindow(lastWindowId, {
          modelId: undefined,
          requestConfig: undefined,
          billing: undefined,
        });
      }
      setPKState(INITIAL_STATE);
    } else {
      setPKState((prev) => ({
        ...prev,
        windowIds: remaining,
        excludedWindowIds: prev.excludedWindowIds.filter((id) => id !== windowId),
      }));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        className={cn(
          'px-3 py-1 border border-pk rounded text-[13px] font-semibold cursor-pointer transition-all duration-150',
          pkState.windowIds.length > 1
            ? 'bg-pk text-white'
            : 'bg-chat-bg text-pk',
        )}
      >
        PK{pkState.windowIds.length > 1 ? ' +' : ''}
      </button>
      {pkState.windowIds.length > 1 && (
        <button
          onClick={handleRemoveWindow}
          className="px-2 py-1 border border-chat-border rounded bg-chat-bg text-chat-text-secondary text-xs cursor-pointer"
          title="移除此窗口"
        >
          &times;
        </button>
      )}
    </div>
  );
}

/** PK 参与开关（PK 模式激活时显示在每个窗口的 toolbar:right） */
function PKJoinSwitch({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [pkState, setPKState] = usePluginState<PKState>(PK_SLICE);
  const orchState = useOrchestratorState();

  if (!windowId || pkState.windowIds.length <= 1) return null;

  const isJoined = !pkState.excludedWindowIds.includes(windowId);

  const handleToggle = () => {
    if (isJoined) {
      // 退出 PK 同步
      setPKState((prev) => ({ ...prev, excludedWindowIds: [...prev.excludedWindowIds, windowId] }));
    } else {
      // 重新加入 PK 同步：同步其他参与窗口的附件到当前窗口
      const activeIds = pkState.windowIds.filter(
        (id) => id !== windowId && !pkState.excludedWindowIds.includes(id),
      );
      const allAttachments = activeIds.flatMap(
        (wid) => orchState.windows[wid]?.pendingAttachments ?? [],
      );
      if (allAttachments.length > 0) {
        kernel.orchestrator.updateWindow(windowId, { pendingAttachments: [...allAttachments] });
      }
      setPKState((prev) => ({ ...prev, excludedWindowIds: prev.excludedWindowIds.filter((id) => id !== windowId) }));
    }
  };

  return (
    <label
      className="flex items-center gap-1.5 text-xs text-chat-text-secondary cursor-pointer select-none"
      title={isJoined ? '已参与 PK 同步' : '已退出 PK 同步（独立窗口）'}
    >
      <span className="whitespace-nowrap">同步</span>
      <span
        onClick={handleToggle}
        className={cn(
          'relative inline-block w-8 h-[18px] rounded-[9px] cursor-pointer shrink-0 transition-colors duration-200',
          isJoined ? 'bg-pk' : 'bg-chat-btn-inactive',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-chat-bg transition-[left] duration-200',
            isJoined ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}

// ─── Plugin ─────────────────────────────────────────────────────

export const PKPlugin: ChatPlugin = {
  id: 'pk',

  setup(ctx: PluginContext) {
    // 1. 注册状态
    ctx.state.registerSlice(PK_SLICE, INITIAL_STATE);
    ctx.state.registerSlice(PK_INPUT_SLICE, INITIAL_INPUT_STATE);

    // 2. 注册 PK 开关按钮（始终可见）
    ctx.ui.register('toolbar:right', {
      id: 'pk-toolbar-button',
      pluginId: 'pk',
      order: -10,
      render: (renderCtx) => <PKToolbarButton windowId={renderCtx.windowId} />,
    });

    // 3. 注册 PK 参与开关（PK 模式时每个窗口显示）
    ctx.ui.register('toolbar:right', {
      id: 'pk-join-switch',
      pluginId: 'pk',
      order: -9,
      render: (renderCtx) => <PKJoinSwitch windowId={renderCtx.windowId} />,
    });

    // 4. 注册 inputSync service
    const orchestrator = ctx.services.get<ChatOrchestratorInstance>('orchestrator');

    /** 获取当前参与 PK 同步的窗口（排除 excludedWindowIds） */
    const getActiveWindowIds = () => {
      const s = ctx.state.getSlice<PKState>(PK_SLICE);
      return s.windowIds.filter((id) => !s.excludedWindowIds.includes(id));
    };

    ctx.services.register<InputSyncService>('inputSync', () => ({
      isActive() {
        return ctx.state.getSlice<PKState>(PK_SLICE).windowIds.length > 1;
      },
      isWindowActive(windowId: string) {
        return !ctx.state.getSlice<PKState>(PK_SLICE).excludedWindowIds.includes(windowId);
      },
      getText() {
        return ctx.state.getSlice<PKInputState>(PK_INPUT_SLICE).text;
      },
      setText(text: string) {
        ctx.state.setSlice<PKInputState>(PK_INPUT_SLICE, { text });
      },
      handleSend() {
        const activeIds = getActiveWindowIds();
        const { text } = ctx.state.getSlice<PKInputState>(PK_INPUT_SLICE);

        // 收集参与窗口的 pendingAttachments，同步到每个参与窗口
        const allAttachments = activeIds.flatMap(
          (wid) => orchestrator.getWindow(wid)?.pendingAttachments ?? [],
        );
        if (!text.trim() && allAttachments.length === 0) return;

        if (allAttachments.length > 0) {
          for (const wid of activeIds) {
            orchestrator.updateWindow(wid, { pendingAttachments: [...allAttachments] });
          }
        }

        orchestrator.broadcast(activeIds, text.trim());
        ctx.state.setSlice<PKInputState>(PK_INPUT_SLICE, { text: '' });
      },
      handleAbort() {
        for (const wid of getActiveWindowIds()) {
          orchestrator.abort(wid);
        }
      },
      getWindowIds() {
        return getActiveWindowIds();
      },
    }));
  },
};
