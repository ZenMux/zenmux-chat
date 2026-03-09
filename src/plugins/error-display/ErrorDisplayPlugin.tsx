import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

function ErrorDisplay({ windowId }: { windowId: string }) {
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];

  if (window?.status !== 'error' || !window.error) return null;

  const error = window.error;

  return (
    <div className="px-3.5 py-2.5 rounded-lg bg-error-bg border border-error-border text-error-text text-[13px] leading-[18px] mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold">
          Request failed{error.statusCode ? ` (${error.statusCode})` : ''}
        </span>
        {error.errorType && (
          <span className="text-[11px] text-error-detail font-mono">
            {error.errorType}
          </span>
        )}
      </div>
      <div className="text-error-detail break-words">
        {error.message}
      </div>
      {error.requestId && (
        <div className="text-[11px] text-neutral-400 mt-1.5 font-mono">
          Request ID: {error.requestId}
        </div>
      )}
      {error.responseBody && (
        <details className="mt-1.5">
          <summary className="text-[11px] text-neutral-400 cursor-pointer">
            Response detail
          </summary>
          <pre className="mt-1 p-2 bg-error-pre-bg rounded text-[11px] whitespace-pre-wrap break-all text-error-detail max-h-[200px] overflow-auto">{error.responseBody}</pre>
        </details>
      )}
      <div className="text-[10px] text-neutral-300 mt-1.5">
        {new Date(error.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export const ErrorDisplayPlugin: ChatPlugin = {
  id: 'error-display',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:error', {
      id: 'error-display',
      pluginId: 'error-display',
      order: 0,
      render: (renderCtx) => <ErrorDisplay windowId={renderCtx.windowId!} />,
    });
  },
};
