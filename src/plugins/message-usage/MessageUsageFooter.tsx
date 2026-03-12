import type { ChatMessage } from '../../kernel/core/types';

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

export function MessageUsageFooter({ message }: { message?: ChatMessage }) {
  if (!message?.usage) return null;

  return (
    <div className="text-[11px] text-chat-text-muted flex gap-2 items-center">
      {message.usage.inputTokens != null && <span>输入: {message.usage.inputTokens} tokens</span>}
      {message.usage.outputTokens != null && <span>输出: {message.usage.outputTokens} tokens</span>}
      {message.usage.latencyMs != null && <span>Latency: {formatDuration(message.usage.latencyMs)}</span>}
      {message.usage.totalMs != null && <span>Total: {formatDuration(message.usage.totalMs)}</span>}
    </div>
  );
}
