import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { MessageUsageFooter } from './MessageUsageFooter';

export const MessageUsagePlugin: ChatPlugin = {
  id: 'message-usage',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:footer', {
      id: 'message-usage-footer',
      pluginId: 'message-usage',
      order: 0,
      render: (renderCtx) => {
        return <MessageUsageFooter message={renderCtx.message} />;
      },
    });
  },
};
