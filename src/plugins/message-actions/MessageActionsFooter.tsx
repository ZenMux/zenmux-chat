import { useCallback } from 'react';
import type { ChatMessage } from '../../kernel/core/types';
import { useKernel, useOrchestratorState } from '../../kernel/ui/KernelProvider';

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function MessageActionsFooter({ message, windowId }: { message?: ChatMessage; windowId?: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();

  const handleCopy = useCallback(() => {
    if (message?.content) {
      navigator.clipboard.writeText(message.content);
    }
  }, [message?.content]);

  const handleRetry = useCallback(() => {
    if (!windowId || !message) return;
    kernel.orchestrator.retryMessage(windowId, message.id);
  }, [windowId, message, kernel.orchestrator]);

  const handleDelete = useCallback(() => {
    if (!windowId || !message) return;
    const window = orchState.windows[windowId];
    if (!window) return;

    const msgIndex = window.messages.findIndex((m) => m.id === message.id);
    if (msgIndex < 0) return;

    // 删除该 assistant 消息及其前面配对的 user 消息
    let startIndex = msgIndex;
    if (msgIndex > 0 && window.messages[msgIndex - 1].role === 'user') {
      startIndex = msgIndex - 1;
    }

    const newMessages = [...window.messages.slice(0, startIndex), ...window.messages.slice(msgIndex + 1)];
    kernel.orchestrator.updateWindow(windowId, { messages: newMessages });
  }, [windowId, message, orchState.windows, kernel.orchestrator]);

  // 仅对 assistant 消息显示操作按钮
  const window = windowId ? orchState.windows[windowId] : undefined;
  if (!message || message.role !== 'assistant') return null;

  // 正在流式输出的消息：隐藏按钮；其它消息：禁用按钮
  const isStreaming = window?.status === 'streaming';
  const isThisMessageStreaming = isStreaming && window?.streamingMessageId === message.id;

  if (isThisMessageStreaming) return null;

  const disabled = isStreaming;
  const btnClass = disabled
    ? 'p-1 rounded text-chat-text-muted/40 cursor-not-allowed'
    : 'p-1 rounded hover:bg-chat-bg-hover text-chat-text-muted hover:text-chat-text transition-colors cursor-pointer';

  return (
    <div className="flex gap-1 items-center mr-1">
      <button type="button" className={btnClass} onClick={handleCopy} disabled={disabled} title="复制">
        <CopyIcon />
      </button>
      <button type="button" className={btnClass} onClick={handleRetry} disabled={disabled} title="重试">
        <RetryIcon />
      </button>
      <button type="button" className={btnClass} onClick={handleDelete} disabled={disabled} title="删除">
        <DeleteIcon />
      </button>
    </div>
  );
}
