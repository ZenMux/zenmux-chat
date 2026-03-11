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
      'mb-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-chat-text-secondary',
      msg.role === 'user' ? 'bg-reasoning-user' : 'bg-reasoning-assistant',
    )}>
      <summary className="cursor-pointer text-[11px] text-chat-text-muted select-none">
        Thinking
      </summary>
      <div className="mt-1">
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
