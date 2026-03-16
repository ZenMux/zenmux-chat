import { Markdown } from '@lobehub/ui';
import { cn } from '../../lib/cn';
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
    <details open className={cn(
      'zenmux-reasoning',
      msg.role === 'user' ? 'zenmux-reasoning--user' : 'zenmux-reasoning--assistant',
    )}>
      <summary className="zenmux-reasoning__summary">
        Thinking
      </summary>
      <div className="zenmux-reasoning__content">
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
