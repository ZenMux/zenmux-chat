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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
      {PHASE_ORDER.map((p, i) => {
        const config = PHASE_CONFIG[p];
        const isCurrent = p === phase;
        const isPast = i < currentIndex;

        return (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* 阶段之间的连接线 */}
            {i > 0 && (
              <div style={{
                width: 16,
                height: 1,
                backgroundColor: isPast || isCurrent ? config.color : '#e0e0e0',
                marginRight: 4,
              }} />
            )}

            {/* 圆点 */}
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isCurrent ? config.color : isPast ? '#bbb' : '#e0e0e0',
              flexShrink: 0,
              animation: isCurrent ? 'streaming-pulse 1.2s ease-in-out infinite' : undefined,
            }} />

            {/* 阶段名 */}
            <span style={{
              color: isCurrent ? config.color : isPast ? '#bbb' : '#d0d0d0',
              fontWeight: isCurrent ? 600 : 400,
              whiteSpace: 'nowrap',
            }}>
              {config.label}
            </span>
          </div>
        );
      })}

      {/* pulse 动画 */}
      <style>{`
        @keyframes streaming-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
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
