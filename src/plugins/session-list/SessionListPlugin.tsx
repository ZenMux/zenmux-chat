import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn';
import type { ChatPlugin, PluginContext } from '@kernel/core/types';
import type { ChatOrchestratorInstance, OrchestratorState } from '@kernel/orchestrator/ChatOrchestrator';
import type {
  NetworkService,
  NetworkSyncManagerInstance,
  SessionIndexEntry,
  SessionSnapshot,
  NetworkWindowRecord,
} from '@plugins/network';
import { createNetworkSerializer } from '@plugins/network';
import { usePluginState, useKernel } from '@kernel/ui/KernelProvider';
import type { SessionListState, SessionListService } from './types';

export const SESSION_LIST_SLICE = 'session-list';

const INITIAL_STATE: SessionListState = {
  activeSessionId: null,
  sessions: [],
  syncStatus: {},
  sidebarOpen: true,
  restored: false,
  renamingSessionId: null,
};

// ─── 辅助 ────────────────────────────────────────────────────────

function generateSessionName(content: string): string {
  const cleaned = content.replace(/\n/g, ' ').trim();
  if (cleaned.length <= 40) return cleaned;
  const cut = cleaned.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '…';
}

function findFirstUserMessage(orchState: OrchestratorState): string | null {
  for (const w of Object.values(orchState.windows)) {
    const msg = w.messages.find((m) => m.role === 'user');
    if (msg) return msg.content;
  }
  return null;
}

// ─── UI 组件 ─────────────────────────────────────────────────────

function SidebarToggleButton() {
  const [state, setState] = usePluginState<SessionListState>(SESSION_LIST_SLICE);
  return (
    <button
      onClick={() => setState({ ...state, sidebarOpen: !state.sidebarOpen })}
      title={state.sidebarOpen ? '收起侧栏' : '展开侧栏'}
      className="bg-transparent border-none cursor-pointer px-1.5 py-1 text-base leading-none text-neutral-600 rounded"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <rect x="2" y="3" width="14" height="1.5" rx="0.5" />
        <rect x="2" y="8" width="14" height="1.5" rx="0.5" />
        <rect x="2" y="13" width="14" height="1.5" rx="0.5" />
      </svg>
    </button>
  );
}

function SyncDot({ status }: { status: string | undefined }) {
  const color =
    status === 'syncing' ? '#ff9800'
    : status === 'synced' ? '#4caf50'
    : status === 'error' ? '#d32f2f'
    : '#bdbdbd';
  const title =
    status === 'syncing' ? '同步中'
    : status === 'synced' ? '已同步'
    : status === 'error' ? '同步失败'
    : '';
  return <span title={title} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />;
}

function SessionItem({
  entry,
  isActive,
  syncStatus,
  onSwitch,
  onDelete,
  onRenameStart,
  isRenaming,
  onRenameConfirm,
}: {
  entry: SessionIndexEntry;
  isActive: boolean;
  syncStatus: string | undefined;
  onSwitch: () => void;
  onDelete: () => void;
  onRenameStart: () => void;
  isRenaming: boolean;
  onRenameConfirm: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(entry.name);

  useEffect(() => {
    if (isRenaming) {
      setEditName(entry.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming, entry.name]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed) onRenameConfirm(trimmed);
  };

  const relativeTime = formatRelativeTime(entry.updatedAt);

  return (
    <div
      onClick={!isRenaming ? onSwitch : undefined}
      className={cn(
        'group relative px-3 py-2.5 rounded-md transition-colors duration-150',
        isRenaming ? 'cursor-default' : 'cursor-pointer',
        isActive ? 'bg-blue-50' : 'hover:bg-neutral-100',
      )}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <SyncDot status={syncStatus} />
        {isRenaming ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') onRenameConfirm(entry.name); }}
            className="flex-1 text-[13px] font-medium border border-blue-300 rounded-sm px-1 py-px outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
            {entry.name || '新对话'}
          </span>
        )}
        <span className="text-[11px] text-neutral-400 shrink-0">{relativeTime}</span>
      </div>
      {entry.preview && !isRenaming && (
        <div className="text-xs text-neutral-500 overflow-hidden text-ellipsis whitespace-nowrap pl-3">
          {entry.preview}
        </div>
      )}
      {/* 操作按钮 */}
      {!isRenaming && (
        <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
            className={actionBtnClasses} title="重命名">✏</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={cn(actionBtnClasses, 'text-red-700')} title="删除">✕</button>
        </div>
      )}
    </div>
  );
}

const actionBtnClasses = 'bg-transparent border-none cursor-pointer px-1 py-0.5 text-xs leading-none text-neutral-500 rounded-sm';

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString();
}

function SessionListSidebar() {
  const kernel = useKernel();
  const [state] = usePluginState<SessionListState>(SESSION_LIST_SLICE);

  if (!state.sidebarOpen) return null;

  const sessionListService = kernel.services.get<SessionListService>('sessionList');

  const handleCreate = () => sessionListService.createSession();
  const handleSwitch = (id: string) => sessionListService.switchSession(id);
  const handleDelete = (id: string) => {
    if (state.sessions.length <= 1) return; // 至少保留一个会话
    sessionListService.deleteSession(id);
  };
  const handleRenameStart = (id: string) => {
    kernel.state.setSlice<SessionListState>(SESSION_LIST_SLICE, (prev) => ({
      ...prev,
      renamingSessionId: id,
    }));
  };
  const handleRenameConfirm = (id: string, name: string) => {
    sessionListService.renameSession(id, name);
    kernel.state.setSlice<SessionListState>(SESSION_LIST_SLICE, (prev) => ({
      ...prev,
      renamingSessionId: null,
    }));
  };

  return (
    <div className="w-[260px] h-full border-r border-neutral-300 flex flex-col bg-neutral-50 shrink-0 overflow-hidden">
      {/* 头部 */}
      <div className="px-3 pt-3 pb-2 border-b border-neutral-300">
        <button
          onClick={handleCreate}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white cursor-pointer text-[13px] text-neutral-700 flex items-center justify-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          新建对话
        </button>
      </div>
      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {state.sessions.map((entry) => (
          <SessionItem
            key={entry.id}
            entry={entry}
            isActive={entry.id === state.activeSessionId}
            syncStatus={state.syncStatus[entry.id]}
            onSwitch={() => handleSwitch(entry.id)}
            onDelete={() => handleDelete(entry.id)}
            onRenameStart={() => handleRenameStart(entry.id)}
            isRenaming={state.renamingSessionId === entry.id}
            onRenameConfirm={(name) => handleRenameConfirm(entry.id, name)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 插件工厂 ────────────────────────────────────────────────────

export interface SessionListPluginConfig {
  service: NetworkService;
}

export function createSessionListPlugin(config: SessionListPluginConfig): ChatPlugin {
  const { service } = config;
  let disposeCallbacks: Array<() => void> = [];

  return {
    id: 'session-list',

    setup(ctx: PluginContext) {
      // 1. 注册状态切片
      ctx.state.registerSlice<SessionListState>(SESSION_LIST_SLICE, INITIAL_STATE);

      // 2. 获取依赖
      const orchestrator = ctx.services.get<ChatOrchestratorInstance>('orchestrator');
      const networkSync = ctx.services.get<NetworkSyncManagerInstance>('network');
      const serializer = createNetworkSerializer(service);

      let isSwitching = false;

      // ─── 状态辅助 ──────────────────────────────────────────

      function getState(): SessionListState {
        return ctx.state.getSlice<SessionListState>(SESSION_LIST_SLICE);
      }

      function setState(updater: SessionListState | ((prev: SessionListState) => SessionListState)): void {
        ctx.state.setSlice(SESSION_LIST_SLICE, updater);
      }

      function persistIndex(): void {
        const { sessions } = getState();
        service.saveSessionIndex?.(sessions)?.catch((err) => {
          console.warn('[SessionListPlugin] 保存会话索引失败:', err);
        });
      }

      // ─── 快照/恢复 ─────────────────────────────────────────

      async function snapshotCurrentSession(): Promise<SessionSnapshot | null> {
        const state = getState();
        if (!state.activeSessionId) return null;

        const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
        const sessionMeta = state.sessions.find((s) => s.id === state.activeSessionId);
        if (!sessionMeta) return null;

        // 序列化所有窗口消息
        const windows: NetworkWindowRecord[] = await Promise.all(
          Object.values(orchState.windows).map(async (w) => {
            const messages = await Promise.all(
              w.messages.map((msg) => serializer.serializeMessage(msg, w.id)),
            );
            return {
              windowId: w.id,
              messages,
              modelId: w.modelId,
              requestConfig: w.requestConfig,
              billing: w.billing,
              savedAt: Date.now(),
            };
          }),
        );

        let pkLayout: SessionSnapshot['pkLayout'] = null;
        try {
          const pkState = ctx.state.getSlice<{ windowIds: string[]; excludedWindowIds: string[] }>('pk');
          if (pkState.windowIds.length > 0) {
            pkLayout = { windowIds: pkState.windowIds, excludedWindowIds: pkState.excludedWindowIds };
          }
        } catch { /* PK 未注册 */ }

        return {
          meta: { ...sessionMeta, updatedAt: Date.now() },
          windows,
          pkLayout,
          activeWindowId: orchState.activeWindowId,
        };
      }

      async function restoreSnapshot(snapshot: SessionSnapshot): Promise<void> {
        for (const record of snapshot.windows) {
          const messages = await Promise.all(
            record.messages.map((msg) => serializer.deserializeMessageSafe(msg)),
          );
          orchestrator.createWindow(record.windowId, {
            modelId: record.modelId,
            requestConfig: record.requestConfig,
            billing: record.billing,
          });
          orchestrator.updateWindow(record.windowId, { messages });
        }

        if (snapshot.pkLayout && snapshot.pkLayout.windowIds.length > 0) {
          try { ctx.state.setSlice('pk', snapshot.pkLayout); } catch { /* ignore */ }
        }

        if (snapshot.activeWindowId) {
          orchestrator.setActiveWindow(snapshot.activeWindowId);
        }
      }

      function clearCurrentState(): void {
        orchestrator.clearAllWindows();
        try { ctx.state.setSlice('pk', { windowIds: [], excludedWindowIds: [] }); } catch { /* ignore */ }
        try { ctx.state.setSlice('pk:input', { text: '' }); } catch { /* ignore */ }
      }

      // ─── 核心操作 ──────────────────────────────────────────

      async function createSession(): Promise<string> {
        const currentState = getState();

        // 保存当前会话（如果有）
        if (currentState.activeSessionId && !isSwitching) {
          isSwitching = true;
          try {
            await networkSync.flushAll();
            const snapshot = await snapshotCurrentSession();
            if (snapshot) {
              await service.saveSession?.(currentState.activeSessionId, snapshot);
              setState((prev) => ({
                ...prev,
                syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'synced' },
              }));
            }
          } catch (err) {
            console.error('[SessionListPlugin] 保存当前会话失败:', err);
          }
        }

        // 清空
        clearCurrentState();

        // 创建新会话
        const newId = crypto.randomUUID();
        const now = Date.now();
        const newEntry: SessionIndexEntry = {
          id: newId,
          name: '',
          nameManual: false,
          createdAt: now,
          updatedAt: now,
          preview: '',
        };

        setState((prev) => ({
          ...prev,
          activeSessionId: newId,
          sessions: [newEntry, ...prev.sessions],
          syncStatus: { ...prev.syncStatus, [newId]: 'idle' },
        }));
        persistIndex();

        // 创建默认窗口
        orchestrator.createWindow();

        isSwitching = false;
        return newId;
      }

      async function switchSession(targetId: string): Promise<void> {
        const currentState = getState();
        if (targetId === currentState.activeSessionId || isSwitching) return;

        isSwitching = true;
        try {
          // 1. 保存当前会话
          if (currentState.activeSessionId) {
            await networkSync.flushAll();
            const snapshot = await snapshotCurrentSession();
            if (snapshot) {
              setState((prev) => ({
                ...prev,
                syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'syncing' },
              }));
              await service.saveSession?.(currentState.activeSessionId, snapshot);
              setState((prev) => ({
                ...prev,
                sessions: prev.sessions.map((s) =>
                  s.id === currentState.activeSessionId ? { ...s, updatedAt: Date.now() } : s,
                ),
                syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'synced' },
              }));
            }
          }

          // 2. 清空
          clearCurrentState();

          // 3. 加载目标会话
          const targetSnapshot = await service.loadSession?.(targetId);
          if (targetSnapshot) {
            await restoreSnapshot(targetSnapshot);
          } else {
            orchestrator.createWindow();
          }

          // 4. 更新状态
          setState((prev) => ({
            ...prev,
            activeSessionId: targetId,
            syncStatus: { ...prev.syncStatus, [targetId]: targetSnapshot ? 'synced' : 'idle' },
          }));
        } catch (err) {
          console.error('[SessionListPlugin] 切换会话失败:', err);
          // 确保至少有一个窗口
          const orchState = ctx.state.getSlice<OrchestratorState>('core:orchestrator');
          if (Object.keys(orchState.windows).length === 0) {
            orchestrator.createWindow();
          }
          setState((prev) => ({
            ...prev,
            activeSessionId: targetId,
            syncStatus: { ...prev.syncStatus, [targetId]: 'error' },
          }));
        } finally {
          isSwitching = false;
        }
      }

      async function deleteSession(sessionId: string): Promise<void> {
        const currentState = getState();
        if (currentState.sessions.length <= 1) return;

        // 删除持久化数据
        await service.deleteSession?.(sessionId)?.catch(() => {});

        // 更新列表
        setState((prev) => {
          const { [sessionId]: _, ...restSync } = prev.syncStatus;
          return {
            ...prev,
            sessions: prev.sessions.filter((s) => s.id !== sessionId),
            syncStatus: restSync,
          };
        });
        persistIndex();

        // 如果删除的是当前活跃会话，切换到第一个
        if (sessionId === currentState.activeSessionId) {
          const remaining = getState().sessions;
          if (remaining.length > 0) {
            await switchSession(remaining[0].id);
          }
        }
      }

      function renameSession(sessionId: string, name: string): void {
        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === sessionId ? { ...s, name, nameManual: true } : s,
          ),
        }));
        persistIndex();
      }

      async function saveCurrentSession(): Promise<void> {
        const currentState = getState();
        if (!currentState.activeSessionId) return;

        await networkSync.flushAll();
        const snapshot = await snapshotCurrentSession();
        if (snapshot) {
          setState((prev) => ({
            ...prev,
            syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'syncing' },
          }));
          try {
            await service.saveSession?.(currentState.activeSessionId, snapshot);
            setState((prev) => ({
              ...prev,
              syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'synced' },
            }));
          } catch {
            setState((prev) => ({
              ...prev,
              syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'error' },
            }));
          }
        }
      }

      // 3. 注册服务
      const sessionListService: SessionListService = {
        getActiveSessionId: () => getState().activeSessionId,
        createSession,
        switchSession,
        deleteSession,
        renameSession,
        saveCurrentSession,
      };
      ctx.services.register<SessionListService>('sessionList', () => sessionListService);

      // 4. 注册 UI
      ctx.ui.register('toolbar:left', {
        id: 'session-list-toggle',
        pluginId: 'session-list',
        order: -100,
        render: () => <SidebarToggleButton />,
      });

      ctx.ui.register('sidebar:left', {
        id: 'session-list-sidebar',
        pluginId: 'session-list',
        order: 0,
        render: () => <SessionListSidebar />,
      });

      // 5. 自动命名：订阅 orchestrator 状态
      let lastAutoName = '';
      const unsubOrch = ctx.state.subscribe<OrchestratorState>('core:orchestrator', (orchState) => {
        if (isSwitching) return;
        const state = getState();
        if (!state.activeSessionId) return;
        const session = state.sessions.find((s) => s.id === state.activeSessionId);
        if (!session || session.nameManual) return;

        const firstMsg = findFirstUserMessage(orchState);
        if (!firstMsg) return;

        const autoName = generateSessionName(firstMsg);
        if (autoName === lastAutoName) return;
        lastAutoName = autoName;

        const preview = firstMsg.slice(0, 80);
        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === state.activeSessionId ? { ...s, name: autoName, preview, updatedAt: Date.now() } : s,
          ),
        }));
        persistIndex();
      });
      disposeCallbacks.push(unsubOrch);

      // 5.5. 响应完成后自动保存会话快照
      const prevWindowStatuses = new Map<string, string>();
      const unsubAutoSave = ctx.state.subscribe<OrchestratorState>('core:orchestrator', (orchState) => {
        if (isSwitching) return;
        const state = getState();
        if (!state.activeSessionId || !state.restored) {
          // 未恢复完成前只追踪状态，不触发保存
          for (const [wid, w] of Object.entries(orchState.windows)) {
            prevWindowStatuses.set(wid, w.status);
          }
          return;
        }

        let shouldSave = false;
        for (const [wid, w] of Object.entries(orchState.windows)) {
          const prev = prevWindowStatuses.get(wid);
          if (prev === 'streaming' && (w.status === 'idle' || w.status === 'error')) {
            shouldSave = true;
          }
          prevWindowStatuses.set(wid, w.status);
        }
        // 清理已删除的窗口
        for (const wid of prevWindowStatuses.keys()) {
          if (!(wid in orchState.windows)) prevWindowStatuses.delete(wid);
        }

        if (shouldSave) {
          saveCurrentSession().catch((err) => {
            console.warn('[SessionListPlugin] 自动保存会话失败:', err);
          });
        }
      });
      disposeCallbacks.push(unsubAutoSave);

      // 6. 同步 NetworkState → 活跃会话的 syncStatus
      const unsubNetwork = ctx.state.subscribe('network', () => {
        const state = getState();
        if (!state.activeSessionId || isSwitching) return;
        try {
          const networkState = ctx.state.getSlice<{ pendingSaveCount: number; lastSavedAt: number | null; lastError: string | null }>('network');
          let status: 'syncing' | 'synced' | 'error' | 'idle' = 'idle';
          if (networkState.pendingSaveCount > 0) status = 'syncing';
          else if (networkState.lastError) status = 'error';
          else if (networkState.lastSavedAt) status = 'synced';

          const current = state.syncStatus[state.activeSessionId];
          if (current !== status) {
            setState((prev) => ({
              ...prev,
              syncStatus: { ...prev.syncStatus, [state.activeSessionId!]: status },
            }));
          }
        } catch { /* network slice 不存在 */ }
      });
      disposeCallbacks.push(unsubNetwork);

      // 7. 初始化：加载会话索引 + 迁移旧数据
      (async () => {
        try {
          let sessions = await service.loadSessionIndex?.() ?? [];

          if (sessions.length === 0) {
            // 尝试迁移旧数据
            const legacy = await service.loadAllRecords();
            if (legacy.windows.length > 0) {
              const migrationId = crypto.randomUUID();
              const now = Date.now();

              // 找第一条用户消息作为名称
              let name = '历史对话';
              let preview = '';
              for (const record of legacy.windows) {
                const userMsg = record.messages.find((m) => m.role === 'user');
                if (userMsg) {
                  name = generateSessionName(userMsg.content);
                  preview = userMsg.content.slice(0, 80);
                  break;
                }
              }

              const migrationEntry: SessionIndexEntry = {
                id: migrationId, name, nameManual: false,
                createdAt: now, updatedAt: now, preview,
              };

              const snapshot: SessionSnapshot = {
                meta: migrationEntry,
                windows: legacy.windows,
                pkLayout: legacy.pkLayout,
                activeWindowId: legacy.activeWindowId,
              };

              await service.saveSession?.(migrationId, snapshot);
              sessions = [migrationEntry];
              await service.saveSessionIndex?.(sessions);

              // 恢复到当前状态（旧数据已通过 NetworkPlugin restore 加载了一部分，
              // 但这里用完整的 snapshot 方式确保一致性）
              setState((prev) => ({
                ...prev,
                activeSessionId: migrationId,
                sessions,
                syncStatus: { [migrationId]: 'synced' },
                restored: true,
              }));
              return;
            }
          }

          if (sessions.length > 0) {
            // 加载最近的会话
            const targetId = sessions[0].id;
            setState((prev) => ({
              ...prev,
              sessions,
              activeSessionId: targetId,
              syncStatus: Object.fromEntries(sessions.map((s) => [s.id, 'synced' as const])),
            }));

            const snapshot = await service.loadSession?.(targetId);
            if (snapshot) {
              await restoreSnapshot(snapshot);
            } else {
              orchestrator.createWindow();
            }

            setState((prev) => ({ ...prev, restored: true }));
          } else {
            // 没有任何数据 — 创建第一个会话
            const firstId = crypto.randomUUID();
            const now = Date.now();
            const firstEntry: SessionIndexEntry = {
              id: firstId, name: '', nameManual: false,
              createdAt: now, updatedAt: now, preview: '',
            };
            setState((prev) => ({
              ...prev,
              activeSessionId: firstId,
              sessions: [firstEntry],
              syncStatus: { [firstId]: 'idle' },
              restored: true,
            }));
            await service.saveSessionIndex?.([firstEntry]);
          }
        } catch (err) {
          console.error('[SessionListPlugin] 初始化失败:', err);
          setState((prev) => ({ ...prev, restored: true }));
        }
      })();
    },

    dispose() {
      for (const fn of disposeCallbacks) fn();
      disposeCallbacks = [];
    },
  };
}
