import type { ChatPlugin, PluginContext } from '@kernel/core/types';
import type { ChatOrchestratorInstance, OrchestratorState } from '@kernel/orchestrator/ChatOrchestrator';
import type { NetworkPluginConfig, NetworkState, NetworkSyncManagerInstance } from './types';
import { createNetworkSerializer } from './NetworkSerializer';
import { createNetworkSyncManager, NETWORK_SLICE } from './NetworkSyncManager';

export { NETWORK_SLICE };

// ─── 插件状态 ────────────────────────────────────────────────────

const INITIAL_STATE: NetworkState = {
  restored: false,
  pendingSaveCount: 0,
  lastSavedAt: null,
  lastError: null,
};

/**
 * 创建网络持久化插件。
 * 使用工厂函数接受用户提供的 NetworkService 实现。
 */
export function createNetworkPlugin(config: NetworkPluginConfig): ChatPlugin {
  const {
    service,
    saveDebounceMs = 1000,
    maxRetries = 3,
    autoRestore = true,
  } = config;

  let disposeCallbacks: Array<() => void> = [];

  return {
    id: 'network',

    setup(ctx: PluginContext) {
      // 1. 注册状态切片
      ctx.state.registerSlice(NETWORK_SLICE, INITIAL_STATE);

      // 2. 创建序列化器和同步管理器
      const serializer = createNetworkSerializer(service);
      const orchestrator = ctx.services.get<ChatOrchestratorInstance>('orchestrator');
      const syncManager = createNetworkSyncManager({
        service,
        serializer,
        stateManager: ctx.state,
        orchestrator,
        saveDebounceMs,
        maxRetries,
      });

      // 3. 注册为服务，供其他插件触发保存
      ctx.services.register<NetworkSyncManagerInstance>('network', () => syncManager);

      // 4. 订阅 orchestrator 状态变化，检测保存时机
      const previousStatuses = new Map<string, string>();

      const unsubOrch = ctx.state.subscribe<OrchestratorState>(
        'core:orchestrator',
        (orchState) => {
          // 未完成恢复前不触发保存
          const networkState = ctx.state.getSlice<NetworkState>(NETWORK_SLICE);
          if (!networkState.restored) return;

          for (const [windowId, window] of Object.entries(orchState.windows)) {
            const prevStatus = previousStatuses.get(windowId);

            // streaming → idle: 响应完成
            // streaming → error: 响应出错（部分结果也值得保存）
            if (
              prevStatus === 'streaming' &&
              (window.status === 'idle' || window.status === 'error')
            ) {
              syncManager.scheduleSave(windowId);
            }

            previousStatuses.set(windowId, window.status);
          }

          // 检测被删除的窗口
          for (const windowId of previousStatuses.keys()) {
            if (!(windowId in orchState.windows)) {
              previousStatuses.delete(windowId);
              service.deleteWindowRecord?.(windowId)?.catch((err) => {
                console.warn(`[NetworkPlugin] 删除窗口记录 ${windowId} 失败:`, err);
              });
            }
          }
        },
      );
      disposeCallbacks.push(unsubOrch);

      // 5. 尝试订阅 PK 状态变化（PK 插件可能未注册）
      try {
        let pkSaveTimer: ReturnType<typeof setTimeout> | null = null;
        const unsubPK = ctx.state.subscribe('pk', () => {
          const networkState = ctx.state.getSlice<NetworkState>(NETWORK_SLICE);
          if (!networkState.restored) return;

          // PK 布局变更防抖保存
          if (pkSaveTimer != null) clearTimeout(pkSaveTimer);
          pkSaveTimer = setTimeout(() => {
            pkSaveTimer = null;
            syncManager.saveAll();
          }, saveDebounceMs);
        });
        disposeCallbacks.push(() => {
          unsubPK();
          if (pkSaveTimer != null) clearTimeout(pkSaveTimer);
        });
      } catch {
        // PK 插件未注册 — 忽略
      }

      // 6. 页面卸载时保存
      const handleBeforeUnload = () => {
        syncManager.saveAll();
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      disposeCallbacks.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));

      // 7. 自动恢复
      if (autoRestore) {
        syncManager.restore().catch((err) => {
          console.error('[NetworkPlugin] 恢复失败:', err);
          ctx.state.setSlice<NetworkState>(NETWORK_SLICE, (prev) => ({
            ...prev,
            restored: true, // 即使失败也标记已完成，避免 UI 卡住
            lastError: err instanceof Error ? err.message : String(err),
          }));
        });
      } else {
        // 不自动恢复，立即标记已完成
        ctx.state.setSlice<NetworkState>(NETWORK_SLICE, (prev) => ({
          ...prev,
          restored: true,
        }));
      }

      // 保存 dispose 引用
      disposeCallbacks.push(() => syncManager.dispose());
    },

    dispose() {
      for (const fn of disposeCallbacks) {
        fn();
      }
      disposeCallbacks = [];
    },
  };
}
