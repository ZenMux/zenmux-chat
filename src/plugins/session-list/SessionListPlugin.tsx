import { useState, useRef, useEffect } from 'react';
import { Button, Dropdown, Input } from 'antd';
import type { MenuProps } from 'antd';
import { MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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

function SessionItem({
  entry,
  isActive,
  onSwitch,
  onDelete,
  onRenameStart,
  isRenaming,
  onRenameConfirm,
  canDelete,
}: {
  entry: SessionIndexEntry;
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRenameStart: () => void;
  isRenaming: boolean;
  onRenameConfirm: (name: string) => void;
  canDelete: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(entry.name);

  useEffect(() => {
    if (isRenaming) {
      setEditName(entry.name);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming, entry.name]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed) onRenameConfirm(trimmed);
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); onRenameStart(); },
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      disabled: !canDelete,
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); onDelete(); },
    },
  ];

  return (
    <div
      onClick={!isRenaming ? onSwitch : undefined}
      className={cn('zenmux-session-item', isActive && 'zenmux-session-item--active', isRenaming && 'zenmux-session-item--renaming')}
    >
      {isRenaming ? (
        <Input
          ref={inputRef as never}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onPressEnter={handleRenameSubmit}
          onKeyDown={(e) => { if (e.key === 'Escape') onRenameConfirm(entry.name); }}
          size="small"
          className="zenmux-session-item__name"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Input
          readOnly
          value={entry.name || '新对话'}
          size="small"
          variant="borderless"
          className="zenmux-session-item__name"
          onClick={onSwitch}
        />
      )}
      <div className={cn('zenmux-session-item__actions', isRenaming && 'zenmux-session-item__actions--hidden')}>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined style={{ color: '#858585' }} />}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </div>
    </div>
  );
}

const BackLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 16 16" style={{ fontSize: 16 }}>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.333"
      d="M8.667 12.667 4 8m0 0 4.667-4.667M4 8h10M2 3.333v9.334" />
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 16 16" style={{ fontSize: 16 }}>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.333"
      d="M8.334 13.663q.001-.004.005-.004c3.524-.16 6.327-2.781 6.327-5.992 0-3.314-2.984-6-6.666-6s-6.667 2.686-6.667 6c0 1.53.637 2.928 1.686 3.988.178.18.258.44.191.684l-.284 1.041a.667.667 0 0 0 .721.838l4.682-.55a.01.01 0 0 0 .005-.005M6 8h4M8 6v4" />
  </svg>
);

function SessionListSidebar({ className }: { className?: string } = {}) {
  const kernel = useKernel();
  const [state, setState] = usePluginState<SessionListState>(SESSION_LIST_SLICE);

  const toggleSidebar = () => setState({ ...state, sidebarOpen: !state.sidebarOpen });
  const sessionListService = kernel.services.get<SessionListService>('sessionList');
  const handleCreate = () => sessionListService.createSession();

  // 收起态：窄图标条
  if (!state.sidebarOpen) {
    return (
      <div className={cn("zenmux-session-sidebar zenmux-session-sidebar--collapsed", className)}>
        <Button
          type="text"
          className="zenmux-session-sidebar__icon-btn"
          title="新建对话"
          onClick={handleCreate}
          icon={<ChatIcon />}
        />
        <Button
          type="text"
          className="zenmux-session-sidebar__icon-btn"
          title="展开侧栏"
          onClick={toggleSidebar}
          icon={<span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><BackLeftIcon /></span>}
        />
      </div>
    );
  }

  // 展开态
  const handleSwitch = (id: string) => sessionListService.switchSession(id);
  const canDelete = state.sessions.length > 1;
  const handleDelete = (id: string) => {
    if (!canDelete) return;
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
    <div className={cn("zenmux-session-sidebar", className)}>
      {/* 头部 */}
      <div className="zenmux-session-sidebar__header">
        <div
          onClick={handleCreate}
          className="zenmux-session-sidebar__new-btn"
        >
          <ChatIcon />
          <span>新建对话</span>
        </div>
        <Button
          type="text"
          size="small"
          className="zenmux-session-sidebar__toggle-btn"
          title="收起侧栏"
          onClick={toggleSidebar}
          icon={<BackLeftIcon />}
        />
      </div>
      {/* 会话列表 */}
      <div className="zenmux-session-sidebar__list">
        {state.sessions.map((entry) => (
          <SessionItem
            key={entry.id}
            entry={entry}
            isActive={entry.id === state.activeSessionId}
            onSwitch={() => handleSwitch(entry.id)}
            onDelete={() => handleDelete(entry.id)}
            onRenameStart={() => handleRenameStart(entry.id)}
            isRenaming={state.renamingSessionId === entry.id}
            canDelete={canDelete}
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

        // 保存当前会话（如果在列表中）
        const currentInList = currentState.activeSessionId &&
          currentState.sessions.some((s) => s.id === currentState.activeSessionId);
        if (currentInList && !isSwitching) {
          isSwitching = true;
          try {
            await networkSync.flushAll();
            const snapshot = await snapshotCurrentSession();
            if (snapshot) {
              await service.saveSession?.(currentState.activeSessionId!, snapshot);
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

        // 懒创建：只设置 activeSessionId，不加入 sessions 列表
        // 等用户发送第一条消息后，由自动命名逻辑将其加入列表
        const newId = crypto.randomUUID();
        setState((prev) => ({
          ...prev,
          activeSessionId: newId,
        }));

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
          // 1. 保存当前会话（仅当它在列表中时，跳过懒创建的空会话）
          const currentInList = currentState.activeSessionId &&
            currentState.sessions.some((s) => s.id === currentState.activeSessionId);
          if (currentInList) {
            await networkSync.flushAll();
            const snapshot = await snapshotCurrentSession();
            if (snapshot) {
              setState((prev) => ({
                ...prev,
                syncStatus: { ...prev.syncStatus, [currentState.activeSessionId!]: 'syncing' },
              }));
              await service.saveSession?.(currentState.activeSessionId!, snapshot);
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

      ctx.ui.register('sidebar:left', {
        id: 'session-list-sidebar',
        pluginId: 'session-list',
        order: 0,
        render: () => <SessionListSidebar />,
      });

      // 5. 自动命名：订阅 orchestrator 状态
      //    同时负责懒创建：当活跃会话不在 sessions 列表中时，
      //    检测到第一条用户消息后才将其加入列表
      let lastAutoName = '';
      const unsubOrch = ctx.state.subscribe<OrchestratorState>('core:orchestrator', (orchState) => {
        if (isSwitching) return;
        const state = getState();
        if (!state.activeSessionId) return;

        const firstMsg = findFirstUserMessage(orchState);
        if (!firstMsg) return;

        const session = state.sessions.find((s) => s.id === state.activeSessionId);

        // 懒创建：会话不在列表中，第一条用户消息到达时创建条目
        if (!session) {
          const now = Date.now();
          const autoName = generateSessionName(firstMsg);
          const preview = firstMsg.slice(0, 80);
          lastAutoName = autoName;
          const newEntry: SessionIndexEntry = {
            id: state.activeSessionId,
            name: autoName,
            nameManual: false,
            createdAt: now,
            updatedAt: now,
            preview,
          };
          setState((prev) => ({
            ...prev,
            sessions: [newEntry, ...prev.sessions],
            syncStatus: { ...prev.syncStatus, [state.activeSessionId!]: 'idle' },
          }));
          persistIndex();
          return;
        }

        // 已有条目：自动更新名称（除非手动命名过）
        if (session.nameManual) return;

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
            // 没有任何数据 — 懒创建第一个会话（不加入列表，等第一条消息）
            const firstId = crypto.randomUUID();
            setState((prev) => ({
              ...prev,
              activeSessionId: firstId,
              restored: true,
            }));
            orchestrator.createWindow();
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
