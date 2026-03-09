import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
import type { InputSyncService } from '../input-composer/InputComposerPlugin';
import type { ModelInfoService } from '../model-selector/ModelSelectorPlugin';
import { useKernel, usePluginState, useOrchestratorState } from '../../kernel/ui/KernelProvider';

// ─── Types ──────────────────────────────────────────────────────

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const IMAGE_SIZES = ['512', '1K', '2K', '4K'] as const;
type ImageSize = (typeof IMAGE_SIZES)[number];

export interface ImageConfigState {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

const SLICE_NAME = 'imageConfig';
/** 窗口级独立配置（非同步窗口使用） */
const WINDOW_SLICE_NAME = 'imageConfig:windows';

interface WindowImageConfigMap {
  [windowId: string]: ImageConfigState;
}

const INITIAL_STATE: ImageConfigState = {
  aspectRatio: '1:1',
  imageSize: '1K',
};

/** 判断模型是否为 Google 生图模型 */
function isGoogleImageModel(modelId: string): boolean {
  return modelId.startsWith('gemini') && modelId.includes('image');
}

// ─── UI ─────────────────────────────────────────────────────────

function ImageConfigToolbar({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [globalConfig, setGlobalConfig] = usePluginState<ImageConfigState>(SLICE_NAME);
  const [windowConfigs, setWindowConfigs] = usePluginState<WindowImageConfigMap>(WINDOW_SLICE_NAME);
  const orchState = useOrchestratorState();

  // 订阅 modelSelector slice 以响应模型切换
  try { usePluginState('modelSelector'); } catch { /* slice 未注册 */ }

  // 判断当前窗口是否独立（不参与 PK 同步）
  const syncService = kernel.services.has('inputSync')
    ? kernel.services.get<InputSyncService>('inputSync')
    : null;
  const isIndependent = windowId
    && syncService?.isActive()
    && !syncService.isWindowActive(windowId);

  // 独立窗口读窗口级配置，否则读全局配置
  const config = isIndependent
    ? (windowConfigs[windowId] ?? INITIAL_STATE)
    : globalConfig;

  const setConfig = (updater: ImageConfigState | ((prev: ImageConfigState) => ImageConfigState)) => {
    if (isIndependent) {
      setWindowConfigs((prev) => {
        const current = prev[windowId] ?? INITIAL_STATE;
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { ...prev, [windowId]: next };
      });
    } else {
      setGlobalConfig(updater);
    }
  };

  // 获取当前生效的模型 ID
  const window = windowId ? orchState.windows[windowId] : undefined;
  let currentModelId: string | undefined;
  if (window?.modelId) {
    currentModelId = window.modelId;
  } else {
    const modelInfo = kernel.services.has('modelInfo')
      ? kernel.services.get<ModelInfoService>('modelInfo')
      : null;
    currentModelId = modelInfo?.getCurrentModelId();
  }

  if (!currentModelId || !isGoogleImageModel(currentModelId)) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#555' }}>
        比例
        <select
          value={config.aspectRatio}
          onChange={(e) => setConfig((prev) => ({ ...prev, aspectRatio: e.target.value as AspectRatio }))}
          style={selectStyle}
        >
          {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#555' }}>
        分辨率
        <select
          value={config.imageSize}
          onChange={(e) => setConfig((prev) => ({ ...prev, imageSize: e.target.value as ImageSize }))}
          style={selectStyle}
        >
          {IMAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '3px 6px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: 12,
  outline: 'none',
  cursor: 'pointer',
};

// ─── Plugin ─────────────────────────────────────────────────────

export const ImageConfigPlugin: ChatPlugin = {
  id: 'image-config',

  setup(ctx: PluginContext) {
    ctx.state.registerSlice(SLICE_NAME, INITIAL_STATE);
    ctx.state.registerSlice<WindowImageConfigMap>(WINDOW_SLICE_NAME, {});

    // input:actions —— 仅在 Google 生图模型下显示，位于输入框底部栏
    ctx.ui.register('input:actions', {
      id: 'image-config-actions',
      pluginId: 'image-config',
      order: 10,
      render: (renderCtx) => <ImageConfigToolbar windowId={renderCtx.windowId} />,
    });

    /** 获取指定窗口生效的 imageConfig（独立窗口用窗口级，否则用全局） */
    const getEffectiveConfig = (windowId?: string): ImageConfigState => {
      if (windowId) {
        const syncService = ctx.services.has('inputSync')
          ? ctx.services.get<InputSyncService>('inputSync')
          : null;
        if (syncService?.isActive() && !syncService.isWindowActive(windowId)) {
          const windowConfigs = ctx.state.getSlice<WindowImageConfigMap>(WINDOW_SLICE_NAME);
          return windowConfigs[windowId] ?? INITIAL_STATE;
        }
      }
      return ctx.state.getSlice<ImageConfigState>(SLICE_NAME);
    };

    // onBuildRequest —— 注入 Google 生图 providerOptions
    ctx.requests.register('image-config', {
      onBuildRequest: (reqCtx) => {
        // 判断当前请求使用的模型是否为 Google 生图模型
        const windowId = reqCtx.metadata.windowId as string | undefined;
        let modelId: string | undefined;

        if (windowId) {
          const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
          modelId = orchState.windows[windowId]?.modelId;
        }
        if (!modelId) {
          const modelInfo = ctx.services.has('modelInfo')
            ? ctx.services.get<ModelInfoService>('modelInfo')
            : null;
          modelId = modelInfo?.getCurrentModelId();
        }

        if (!modelId || !isGoogleImageModel(modelId)) return;

        const config = getEffectiveConfig(windowId);
        const existing = (reqCtx.params.providerOptions as Record<string, any>) ?? {};

        reqCtx.params.providerOptions = {
          ...existing,
          google: {
            ...existing.google,
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: config.aspectRatio,
              imageSize: config.imageSize,
            },
          },
        };
      },
    });
  },
};
