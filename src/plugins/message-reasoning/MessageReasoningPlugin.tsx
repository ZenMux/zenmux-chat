import { Markdown } from '@lobehub/ui';
import type { ChatPlugin, PluginContext, ChatMessage } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

function MessageReasoning({ messageId }: { messageId: string }) {
  const orchState = useOrchestratorState();

  let msg: ChatMessage | undefined;
  for (const w of Object.values(orchState.windows)) {
    msg = w.messages.find((m) => m.id === messageId);
    if (msg) break;
  }

  if (!msg?.reasoning) return null;

  return (
    <details open style={{
      marginBottom: 6,
      padding: '6px 10px',
      borderRadius: 6,
      backgroundColor: msg.role === 'user' ? '#d0e8fc' : '#ededb1',
      fontSize: 13,
      color: '#666',
    }}>
      <summary style={{ cursor: 'pointer', fontSize: 11, color: '#999', userSelect: 'none' }}>
        Thinking
      </summary>
      <div style={{ marginTop: 4 }}>
        <Markdown variant="chat">{msg.reasoning}</Markdown>
      </div>
    </details>
  );
}

export const MessageReasoningPlugin: ChatPlugin = {
  id: 'message-reasoning',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:reasoning', {
      id: 'message-reasoning',
      pluginId: 'message-reasoning',
      order: 0,
      render: (renderCtx) => <MessageReasoning messageId={renderCtx.messageId!} />,
    });
  },
};
