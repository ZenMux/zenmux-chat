import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

export function MessageUsageFooter({ messageId }: { messageId: string }) {
  const orchState = useOrchestratorState();

  // 在所有窗口中找到这条消息
  for (const window of Object.values(orchState.windows)) {
    const msg = window.messages.find((m) => m.id === messageId);
    if (msg?.usage) {
      return (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, display: 'flex', gap: 8 }}>
          {msg.usage.inputTokens != null && <span>输入: {msg.usage.inputTokens} tokens</span>}
          {msg.usage.outputTokens != null && <span>输出: {msg.usage.outputTokens} tokens</span>}
        </div>
      );
    }
  }

  return null;
}
