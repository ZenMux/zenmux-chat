import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { useOrchestratorState } from '../../kernel/ui/KernelProvider';

function ErrorDisplay({ windowId }: { windowId: string }) {
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];

  if (window?.status !== 'error' || !window.error) return null;

  const error = window.error;

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 8,
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#991b1b',
      fontSize: 13,
      lineHeight: '18px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>
          Request failed{error.statusCode ? ` (${error.statusCode})` : ''}
        </span>
        {error.errorType && (
          <span style={{ fontSize: 11, color: '#b91c1c', fontFamily: 'monospace' }}>
            {error.errorType}
          </span>
        )}
      </div>
      <div style={{ color: '#b91c1c', wordBreak: 'break-word' }}>
        {error.message}
      </div>
      {error.requestId && (
        <div style={{ fontSize: 11, color: '#999', marginTop: 6, fontFamily: 'monospace' }}>
          Request ID: {error.requestId}
        </div>
      )}
      {error.responseBody && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 11, color: '#999', cursor: 'pointer' }}>
            Response detail
          </summary>
          <pre style={{
            marginTop: 4,
            padding: 8,
            backgroundColor: '#fff5f5',
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: '#b91c1c',
            maxHeight: 200,
            overflow: 'auto',
          }}>{error.responseBody}</pre>
        </details>
      )}
      <div style={{ fontSize: 10, color: '#ccc', marginTop: 6 }}>
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
