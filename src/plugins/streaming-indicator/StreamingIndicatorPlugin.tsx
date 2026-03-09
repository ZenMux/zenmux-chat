import { cn } from '../../lib/cn';
import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

type StreamPhase = 'sending' | 'thinking' | 'outputting';

const PHASE_CONFIG: Record<StreamPhase, { label: string; color: string }> = {
  sending: { label: '发送中', color: '#888' },
  thinking: { label: '思考中', color: '#b07cd8' },
  outputting: { label: '输出中', color: '#4a9eda' },
};

/** 所有阶段按顺序排列，用于展示流程条 */
const PHASE_ORDER: StreamPhase[] = ['sending', 'thinking', 'outputting'];

function derivePhase(windowId: string, orchState: ReturnType<typeof useOrchestratorState>): StreamPhase | null {
  const window = orchState.windows[windowId];
  if (window?.status !== 'streaming') return null;

  const lastMsg = window.messages[window.messages.length - 1];
  if (lastMsg?.role === 'assistant') {
    if (lastMsg.content) return 'outputting';
    if (lastMsg.reasoning) return 'thinking';
  }
  return 'sending';
}

function StreamingIndicator({ windowId }: { windowId: string }) {
  const orchState = useOrchestratorState();
  const phase = derivePhase(windowId, orchState);

  if (!phase) return null;

  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {PHASE_ORDER.map((p, i) => {
        const config = PHASE_CONFIG[p];
        const isCurrent = p === phase;
        const isPast = i < currentIndex;

        return (
          <div key={p} className="flex items-center gap-1">
            {/* 阶段之间的连接线 */}
            {i > 0 && (
              <div
                className="w-4 h-px mr-1"
                style={{ backgroundColor: isPast || isCurrent ? config.color : '#e0e0e0' }}
              />
            )}

            {/* 圆点 */}
            <div
              className={cn('w-1.5 h-1.5 rounded-full shrink-0', isCurrent && 'animate-streaming-pulse')}
              style={{ backgroundColor: isCurrent ? config.color : isPast ? '#bbb' : '#e0e0e0' }}
            />

            {/* 阶段名 */}
            <span
              className={cn('whitespace-nowrap', isCurrent ? 'font-semibold' : 'font-normal')}
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
      render: (renderCtx) => <StreamingIndicator windowId={renderCtx.windowId!} />,
    });
  },
};
