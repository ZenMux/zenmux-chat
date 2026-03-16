import type { ChatMessage } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

const LOG_BASE_URL = 'https://zenmux.ai/platform/logs/detail';

export function LogDetailFooter({ message, windowId }: { message?: ChatMessage; windowId?: string }) {
  const orchState = useOrchestratorState();

  if (!message || message.role !== 'assistant') return null;

  // streaming 过程中不展示
  const window = windowId ? orchState.windows[windowId] : undefined;
  if (window?.streamingMessageId === message.id) return null;

  const requestId = message.extras?.zenmuxRequestId as string | undefined;

  if (!requestId) return null;

  return (
    <div className="zenmux-log-detail">
      <a
        href={`${LOG_BASE_URL}/${requestId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="zenmux-log-detail__link"
      >
        Log Detail
      </a>
    </div>
  );
}
