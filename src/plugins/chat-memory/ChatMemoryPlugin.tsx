import { useCallback } from 'react';
import { Popover, Slider } from 'antd';
import type { ChatPlugin, PluginContext, ChatMessage } from '../../kernel/core/types';
import type { OrchestratorState } from '../../kernel/orchestrator/ChatOrchestrator';
import { usePluginState, useKernel } from '../../kernel/ui/KernelProvider';

// ─── State ───────────────────────────────────────────────────────

export interface ChatMemoryState {
  /** 最大携带消息条数，100 表示全部 */
  maxMessages: number;
}

const SLICE_NAME = 'chatMemory';
const MAX_SLIDER = 100;
/** 新会话分隔消息的标记内容 */
const NEW_SESSION_MARKER = '__NEW_SESSION__';

const INITIAL_STATE: ChatMemoryState = {
  maxMessages: MAX_SLIDER,
};

// ─── UI Component ────────────────────────────────────────────────

function ChatMemoryButton() {
  const [state, setState] = usePluginState<ChatMemoryState>(SLICE_NAME);

  const isAll = state.maxMessages >= MAX_SLIDER;
  const displayLabel = isAll ? 'All' : String(state.maxMessages);

  const handleChange = useCallback((val: number) => {
    setState({ maxMessages: val });
  }, [setState]);

  const content = (
    <div className="w-[250px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-[13px] text-neutral-700">
          Chat memory
        </span>
        <span className="bg-neutral-100 rounded-[10px] px-2 py-px text-[11px] font-medium text-neutral-600">
          {displayLabel}
        </span>
      </div>
      <Slider
        min={1}
        max={MAX_SLIDER}
        value={state.maxMessages}
        onChange={handleChange}
      />
      <div className="text-[11px] text-neutral-400 leading-snug">
        {isAll
          ? `Sends all messages from your conversation each request.`
          : `Sends the last ${state.maxMessages} messages from your conversation each request.`}
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="top">
      <button
        title="Chat memory"
        className="flex items-center gap-1 border-none bg-transparent cursor-pointer px-2 py-1 rounded-md text-xs text-neutral-600 leading-none"
      >
        <MemoryIcon />
        <span className="font-medium">{displayLabel}</span>
      </button>
    </Popover>
  );
}

function NewSessionButton({ windowId }: { windowId?: string }) {
  const kernel = useKernel();

  const handleClick = useCallback(() => {
    if (!windowId) return;
    const orchState = kernel.state.getSlice<OrchestratorState>('core:orchestrator');
    const window = orchState.windows[windowId];
    if (!window) return;

    const marker: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: NEW_SESSION_MARKER,
      timestamp: Date.now(),
    };

    kernel.orchestrator.updateWindow(windowId, {
      messages: [...window.messages, marker],
    });
  }, [kernel, windowId]);

  return (
    <button
      title="New Session"
      onClick={handleClick}
      className="flex items-center gap-1 border-none bg-transparent cursor-pointer px-2 py-1 rounded-md text-xs text-neutral-600 leading-none"
    >
      <NewSessionIcon />
      <span className="font-medium">New Session</span>
    </button>
  );
}

function NewSessionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7h12M7 1v12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v4l2.5 1.5M13 7A6 6 0 1 1 1 7a6 6 0 0 1 12 0Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

// ─── Plugin ──────────────────────────────────────────────────────

export const ChatMemoryPlugin: ChatPlugin = {
  id: 'chat-memory',

  setup(ctx: PluginContext) {
    // 1. 注册状态 slice
    ctx.state.registerSlice(SLICE_NAME, INITIAL_STATE);

    // 2. 注册按钮到 input:actions
    ctx.ui.register('input:actions', {
      id: 'chat-memory-button',
      pluginId: 'chat-memory',
      order: 20,
      render: () => <ChatMemoryButton />,
    });

    ctx.ui.register('input:actions', {
      id: 'new-session-button',
      pluginId: 'chat-memory',
      order: 21,
      render: (renderCtx) => <NewSessionButton windowId={renderCtx.windowId} />,
    });

    // 3. 注册自定义消息渲染器 —— 将 new session 标记渲染为分隔线
    ctx.ui.registerMessageRenderer({
      id: 'new-session-divider',
      pluginId: 'chat-memory',
      match: (msg) => msg.role === 'system' && msg.content === NEW_SESSION_MARKER,
      render: () => (
        <div className="flex items-center gap-3 my-4 text-neutral-300 text-xs select-none">
          <div className="flex-1 h-px bg-neutral-200" />
          <span>New Session</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>
      ),
    });

    // 4. 注册请求生命周期钩子 —— 截取历史消息
    ctx.requests.register('chat-memory', {
      onBuildRequest: (reqCtx) => {
        // 先按 new session 分隔：只保留最后一个分隔符之后的消息
        const lastMarkerIdx = findLastIndex(
          reqCtx.messages,
          (m) => m.role === 'system' && m.content === NEW_SESSION_MARKER,
        );
        if (lastMarkerIdx >= 0) {
          reqCtx.messages = reqCtx.messages.slice(lastMarkerIdx + 1);
        }

        // 再按 maxMessages 截取
        const { maxMessages } = ctx.state.getSlice<ChatMemoryState>(SLICE_NAME);
        if (maxMessages < MAX_SLIDER && reqCtx.messages.length > maxMessages) {
          reqCtx.messages = reqCtx.messages.slice(-maxMessages);
        }
      },
    });
  },
};

export { SLICE_NAME as CHAT_MEMORY_SLICE };
