import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { LogDetailFooter } from './LogDetailFooter';

export const LogDetailsPlugin: ChatPlugin = {
  id: 'log-details',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:footer', {
      id: 'log-detail-footer',
      pluginId: 'log-details',
      order: 10,
      render: (renderCtx) => {
        return <LogDetailFooter message={renderCtx.message} windowId={renderCtx.windowId} />;
      },
    });

    ctx.requests.register('log-details', {
      onResponseHeaders(headersCtx) {
        const requestId = headersCtx.headers['x-zenmux-requestid'];
        if (requestId) {
          headersCtx.extras = { ...headersCtx.extras, zenmuxRequestId: requestId };
        }
      },
    });
  },
};
