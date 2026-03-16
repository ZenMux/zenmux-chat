import { cn } from '../../lib/cn';
import type { ChatPlugin, PluginContext, ChatMessage } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

type StreamPhase = 'sending' | 'thinking' | 'outputting';

const PHASE_CONFIG: Record<StreamPhase, { label: string; color: string }> = {
  sending: { label: '发送中', color: '#888' },
  thinking: { label: '思考中', color: '#b07cd8' },
  outputting: { label: '输出中', color: '#4a9eda' },
};

/** 所有阶段按顺序排列，用于展示流程条 */
const PHASE_ORDER: StreamPhase[] = ['sending', 'thinking', 'outputting'];

function derivePhaseFromMessage(msg: ChatMessage | undefined): StreamPhase {
  if (msg?.role === 'assistant') {
    if (msg.content) return 'outputting';
    if (msg.reasoning) return 'thinking';
  }
  return 'sending';
}

function StreamingIndicator({ windowId, message }: { windowId: string; message?: ChatMessage }) {
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];

  if (!window || window.status !== 'streaming') return null;

  const streamingId = window.streamingMessageId;

  if (message) {
    // 从 per-message 渲染调用：仅在该消息是正在流式输出的消息时显示
    if (streamingId && message.id !== streamingId) return null;
    if (!streamingId) return null;  // streamingId 尚未设置，由 Footer 兜底
  } else {
    // 从 Footer 渲染调用：仅在 streamingId 尚未设置时显示（assistant 消息未创建的初始阶段）
    if (streamingId) return null;
  }

  const targetMsg = streamingId
    ? window.messages.find((m) => m.id === streamingId)
    : undefined;

  const phase = derivePhaseFromMessage(targetMsg);
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="zenmux-streaming-indicator">
      {PHASE_ORDER.map((p, i) => {
        const config = PHASE_CONFIG[p];
        const isCurrent = p === phase;
        const isPast = i < currentIndex;

        return (
          <div key={p} className="zenmux-streaming-indicator__phase">
            {/* 阶段之间的连接线 */}
            {i > 0 && (
              <div
                className="zenmux-streaming-indicator__connector"
                style={{ backgroundColor: isPast || isCurrent ? config.color : '#e0e0e0' }}
              />
            )}

            {/* 圆点 */}
            <div
              className={cn('zenmux-streaming-indicator__dot', isCurrent && 'zenmux-streaming-indicator__dot--current')}
              style={{ backgroundColor: isCurrent ? config.color : isPast ? '#bbb' : '#e0e0e0' }}
            />

            {/* 阶段名 */}
            <span
              className={cn('zenmux-streaming-indicator__label', isCurrent && 'zenmux-streaming-indicator__label--current')}
              style={{ color: isCurrent ? config.color : isPast ? '#bbb' : '#d0d0d0' }}
            >
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const StreamingIndicatorPlugin: ChatPlugin = {
  id: 'streaming-indicator',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:streaming', {
      id: 'streaming-indicator',
      pluginId: 'streaming-indicator',
      order: 0,
      render: (renderCtx) => (
        <StreamingIndicator windowId={renderCtx.windowId!} message={renderCtx.message} />
      ),
    });
  },
};
