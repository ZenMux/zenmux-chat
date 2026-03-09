import type { RuntimeStateManager } from '@kernel/core/types';
import type { ChatOrchestratorInstance, OrchestratorState } from '@kernel/orchestrator/ChatOrchestrator';
import type {
  NetworkService,
  NetworkState,
  NetworkWindowRecord,
  NetworkSyncManagerInstance,
  SessionMeta,
} from './types';
import type { NetworkSerializerInstance } from './NetworkSerializer';

export const NETWORK_SLICE = 'network';

interface SyncManagerDeps {
  service: NetworkService;
  serializer: NetworkSerializerInstance;
  stateManager: RuntimeStateManager;
  orchestrator: ChatOrchestratorInstance;
  saveDebounceMs: number;
  maxRetries: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createNetworkSyncManager(deps: SyncManagerDeps): NetworkSyncManagerInstance {
  const { service, serializer, stateManager, orchestrator, saveDebounceMs, maxRetries } = deps;

  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const saveQueue = new Map<string, Promise<void>>();
  let disposed = false;

  // ─── 状态辅助 ───────────────────────────────────────────────────

  function setNetworkState(updater: NetworkState | ((prev: NetworkState) => NetworkState)): void {
    stateManager.setSlice(NETWORK_SLICE, updater);
  }

  // ─── 保存单个窗口 ──────────────────────────────────────────────

  async function saveWindow(windowId: string): Promise<void> {
    const orchState = stateManager.getSlice<OrchestratorState>('core:orchestrator');
    const window = orchState.windows[windowId];
    if (!window) return;

    // 序列化所有消息（并行上传 blob）
    const networkMessages = await Promise.all(
      window.messages.map((msg) => serializer.serializeMessage(msg, windowId)),
    );

    const record: NetworkWindowRecord = {
      windowId,
      messages: networkMessages,
      modelId: window.modelId,
      requestConfig: window.requestConfig,
      billing: window.billing,
      savedAt: Date.now(),
    };

    await service.saveWindowRecord(windowId, record);
  }

  /** 带指数退避重试的保存 */
  async function saveWindowWithRetry(windowId: string): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await saveWindow(windowId);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries - 1) {
          await delay(Math.min(1000 * 2 ** attempt, 10000));
        }
      }
    }
    throw lastError;
  }

  /** 安全保存（错误不外抛，只更新状态） */
  async function saveWindowSafe(windowId: string): Promise<void> {
    if (disposed) return;
    try {
      setNetworkState((prev) => ({
        ...prev,
        pendingSaveCount: prev.pendingSaveCount + 1,
        lastError: null,
      }));
      await saveWindowWithRetry(windowId);
      setNetworkState((prev) => ({
        ...prev,
        pendingSaveCount: prev.pendingSaveCount - 1,
        lastSavedAt: Date.now(),
      }));
    } catch (err) {
      console.error(`[NetworkPlugin] 保存窗口 ${windowId} 失败:`, err);
      setNetworkState((prev) => ({
        ...prev,
        pendingSaveCount: Math.max(0, prev.pendingSaveCount - 1),
        lastError: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  /** 串行化同一窗口的保存操作，防止竞态 */
  function enqueueSave(windowId: string): void {
    const existing = saveQueue.get(windowId) ?? Promise.resolve();
    const next = existing.then(() => saveWindowSafe(windowId));
    saveQueue.set(windowId, next);
  }

  // ─── 恢复 ─────────────────────────────────────────────────────

  async function restore(): Promise<void> {
    const snapshot = await service.loadAllRecords();

    // 反序列化所有窗口的消息
    for (const record of snapshot.windows) {
      const messages = await Promise.all(
        record.messages.map((msg) => serializer.deserializeMessageSafe(msg)),
      );

      // 创建窗口（带窗口级配置）
      orchestrator.createWindow(record.windowId, {
        modelId: record.modelId,
        requestConfig: record.requestConfig,
        billing: record.billing,
      });

      // 注入消息
      orchestrator.updateWindow(record.windowId, { messages });
    }

    // 恢复 PK 布局
    if (snapshot.pkLayout) {
      try {
        stateManager.setSlice('pk', snapshot.pkLayout);
      } catch {
        // PK 插件未注册 — 忽略
      }
    }

    // 恢复活跃窗口
    if (snapshot.activeWindowId) {
      orchestrator.setActiveWindow(snapshot.activeWindowId);
    }

    setNetworkState((prev) => ({ ...prev, restored: true }));
  }

  // ─── 公共 API ──────────────────────────────────────────────────

  return {
    scheduleSave(windowId: string) {
      if (disposed) return;
      // 清除该窗口已有的防抖定时器
      const existing = debounceTimers.get(windowId);
      if (existing != null) clearTimeout(existing);

      debounceTimers.set(
        windowId,
        setTimeout(() => {
          debounceTimers.delete(windowId);
          enqueueSave(windowId);
        }, saveDebounceMs),
      );
    },

    async saveNow(windowId: string) {
      // 取消防抖，立即保存
      const existing = debounceTimers.get(windowId);
      if (existing != null) {
        clearTimeout(existing);
        debounceTimers.delete(windowId);
      }
      await saveWindowSafe(windowId);
    },

    async saveAll() {
      if (disposed) return;
      const orchState = stateManager.getSlice<OrchestratorState>('core:orchestrator');
      const windowIds = Object.keys(orchState.windows);
      await Promise.all(windowIds.map((wid) => saveWindowSafe(wid)));

      // 保存会话元数据（activeWindowId、PK 布局）
      if (service.saveSessionMeta) {
        let pkLayout: SessionMeta['pkLayout'] = null;
        try {
          const pkState = stateManager.getSlice<{ windowIds: string[]; excludedWindowIds: string[] }>('pk');
          if (pkState.windowIds.length > 0) {
            pkLayout = { windowIds: pkState.windowIds, excludedWindowIds: pkState.excludedWindowIds };
          }
        } catch { /* PK 插件未注册 */ }

        await service.saveSessionMeta({
          activeWindowId: orchState.activeWindowId,
          pkLayout,
        }).catch((err) => {
          console.warn('[NetworkPlugin] 保存会话元数据失败:', err);
        });
      }
    },

    async flushAll() {
      // 清除所有防抖定时器
      for (const [wid, timer] of debounceTimers) {
        clearTimeout(timer);
        debounceTimers.delete(wid);
      }
      // 等待队列中的保存完成
      await Promise.all(Array.from(saveQueue.values())).catch(() => {});
      // 执行一次全量保存
      const orchState = stateManager.getSlice<OrchestratorState>('core:orchestrator');
      const windowIds = Object.keys(orchState.windows);
      await Promise.all(windowIds.map((wid) => saveWindowSafe(wid)));
    },

    restore,

    dispose() {
      disposed = true;
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
    },
  };
}
