import type { ChatMessage } from '../../kernel/core/types';

export function MessageUsageFooter({ message }: { message?: ChatMessage }) {
  if (!message?.usage) return null;

  return (
    <div className="text-[11px] text-chat-text-muted mt-1 flex gap-2">
      {message.usage.inputTokens != null && <span>输入: {message.usage.inputTokens} tokens</span>}
      {message.usage.outputTokens != null && <span>输出: {message.usage.outputTokens} tokens</span>}
    </div>
  );
}
