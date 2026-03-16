import { useState, useCallback, useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { cn } from '../../lib/cn';
import type { ChatPlugin, PluginContext, MessageAttachment } from '../../kernel/core/types';
import { useKernel, useOrchestratorState, SlotRenderer } from '../../kernel/ui/KernelProvider';

/** PK 插件通过 services.register('inputSync', ...) 注入此接口 */
export interface InputSyncService {
  isActive(): boolean;
  /** 指定窗口是否参与 PK 同步 */
  isWindowActive(windowId: string): boolean;
  getText(): string;
  setText(text: string): void;
  handleSend(): void;
  handleAbort(): void;
  getWindowIds(): string[];
}

const PK_INPUT_SLICE = 'pk:input';

function InputComposer({ windowId, className }: { windowId: string; className?: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];
  const [localInput, setLocalInput] = useState('');

  // 同步输入支持（PK 模式）
  const syncService = kernel.services.has('inputSync')
    ? kernel.services.get<InputSyncService>('inputSync')
    : null;
  const isPKActive = syncService?.isActive() ?? false;
  const isPKSync = isPKActive && (syncService?.isWindowActive(windowId) ?? false);

  const syncText = useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        if (!isPKSync) return () => {};
        return kernel.state.subscribe(PK_INPUT_SLICE, cb);
      },
      [kernel.state, isPKSync],
    ),
    useCallback(
      () => {
        if (!isPKSync) return '';
        try { return kernel.state.getSlice<{ text: string }>(PK_INPUT_SLICE).text; }
        catch { return ''; }
      },
      [kernel.state, isPKSync],
    ),
  );

  const input = isPKSync ? syncText : localInput;
  const setInput = isPKSync
    ? (text: string) => syncService!.setText(text)
    : setLocalInput;

  const pendingAttachments = window?.pendingAttachments ?? [];
  // PK 模式下，任一窗口 streaming 则视为 streaming
  const isStreaming = isPKSync
    ? syncService!.getWindowIds().some((id) => orchState.windows[id]?.status === 'streaming')
    : window?.status === 'streaming';
  const canSend = !!input.trim() || pendingAttachments.length > 0;

  const handleSend = useCallback(() => {
    if (!input.trim() && pendingAttachments.length === 0) return;
    if (isPKSync) {
      syncService!.handleSend();
    } else {
      kernel.orchestrator.sendMessage(windowId, input.trim());
      setLocalInput('');
    }
  }, [kernel.orchestrator, windowId, input, pendingAttachments.length, isPKSync, syncService]);

  const handleAbort = useCallback(() => {
    if (isPKSync) {
      syncService!.handleAbort();
    } else {
      kernel.orchestrator.abort(windowId);
    }
  }, [kernel.orchestrator, windowId, isPKSync, syncService]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const LINE_HEIGHT = 20;
  const MIN_ROWS = 3;
  const MAX_ROWS = 5;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || expanded) return;
    el.style.height = 'auto';
    const maxHeight = LINE_HEIGHT * MAX_ROWS;
    const minHeight = LINE_HEIGHT * MIN_ROWS;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
  }, [input, expanded]);

  if (!window) return null;

  return (
    <div data-expanded={expanded} className={cn("zenmux-input-composer", className)}>
      {/* Textarea wrapper */}
      <div className="zenmux-input-composer__textarea-wrap">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Start a new message..."
          disabled={isStreaming}
          rows={expanded ? undefined : MIN_ROWS}
          className="zenmux-input-composer__textarea"
          style={expanded ? { height: '80vh' } : undefined}
        />
        {/* 全屏切换按钮 */}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? '退出全屏' : '全屏编辑'}
          className="zenmux-input-composer__expand-btn"
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="zenmux-input-composer__attachments">
          {pendingAttachments.map((att) => (
            <AttachmentChip
              key={att.id}
              attachment={att}
              onRemove={() => kernel.orchestrator.removePendingAttachment(windowId, att.id)}
            />
          ))}
        </div>
      )}

      {/* Bottom bar: slot actions (left) + send (right) */}
      <div className="zenmux-input-composer__actions-bar">
        {/* Left: plugin-injected actions */}
        <div className="zenmux-input-composer__actions-left">
          <SlotRenderer slot="input:actions" windowId={windowId} />
        </div>

        {/* Right: send / stop */}
        {isStreaming ? (
          <button onClick={handleAbort} className={sendBtnClasses(false)} title="Stop">
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={sendBtnClasses(canSend)}
            title="Send"
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function sendBtnClasses(active: boolean): string {
  return cn(
    'zenmux-input-composer__send-btn',
    active ? 'zenmux-input-composer__send-btn--active' : 'zenmux-input-composer__send-btn--inactive',
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3L8 13M8 3L4 7M8 3L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 1v4H1M9 5h4V1M9 13V9h4M5 9H1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/>
    </svg>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: MessageAttachment; onRemove?: () => void }) {
  const isImage = attachment.mediaType.startsWith('image/');
  return (
    <div className="zenmux-input-composer__attachment-chip">
      {isImage ? (
        <img
          src={`data:${attachment.mediaType};base64,${attachment.data}`}
          alt={attachment.name}
          className="zenmux-input-composer__attachment-thumb"
        />
      ) : (
        <span className="zenmux-input-composer__attachment-icon">&#128206;</span>
      )}
      <span className="zenmux-input-composer__attachment-name">
        {attachment.name}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="zenmux-input-composer__attachment-remove"
        >&times;</button>
      )}
    </div>
  );
}

export const InputComposerPlugin: ChatPlugin = {
  id: 'input-composer',

  setup(ctx: PluginContext) {
    ctx.ui.register('input:composer', {
      id: 'input-composer',
      pluginId: 'input-composer',
      order: 0,
      render: (renderCtx) => <InputComposer windowId={renderCtx.windowId!} />,
    });
  },
};
