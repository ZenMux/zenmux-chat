import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import type { ScrollService } from '../../kernel/core/types';

/**
 * 流式结束后确保滚动到底部（作为 Virtuoso followOutput 的兜底）。
 */
export const AutoScrollPlugin: ChatPlugin = {
  id: 'auto-scroll',

  setup(ctx: PluginContext) {
    ctx.requests.register('auto-scroll', {
      onAfterResponse: () => {
        requestAnimationFrame(() => {
          const scroll = ctx.services.get<ScrollService>('scroll');
          if (scroll?.scrollToBottom) {
            scroll.scrollToBottom('auto');
          } else {
            const el = scroll?.getContainer();
            if (el) el.scrollTop = el.scrollHeight;
          }
        });
      },
    });
  },
};
