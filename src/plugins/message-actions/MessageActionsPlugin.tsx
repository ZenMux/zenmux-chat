import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { MessageActionsFooter } from './MessageActionsFooter';

export const MessageActionsPlugin: ChatPlugin = {
  id: 'message-actions',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:footer', {
      id: 'message-actions-footer',
      pluginId: 'message-actions',
      order: -1,
      render: (renderCtx) => {
        return <MessageActionsFooter message={renderCtx.message} windowId={renderCtx.windowId} />;
      },
    });
  },
};
