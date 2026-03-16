import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

function ErrorDisplay({ windowId }: { windowId: string }) {
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];

  if (window?.status !== 'error' || !window.error) return null;

  const error = window.error;

  return (
    <div className="zenmux-error-display">
      <div className="zenmux-error-display__header">
        <span className="zenmux-error-display__title">
          Request failed{error.statusCode ? ` (${error.statusCode})` : ''}
        </span>
        {error.errorType && (
          <span className="zenmux-error-display__error-type">
            {error.errorType}
          </span>
        )}
      </div>
      <div className="zenmux-error-display__message">
        {error.message}
      </div>
      {error.requestId && (
        <div className="zenmux-error-display__request-id">
          Request ID: {error.requestId}
        </div>
      )}
      {error.responseBody && (
        <details className="mt-1.5">
          <summary className="zenmux-error-display__details-summary">
            Response detail
          </summary>
          <pre className="zenmux-error-display__details-body">{error.responseBody}</pre>
        </details>
      )}
      <div className="zenmux-error-display__timestamp">
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
