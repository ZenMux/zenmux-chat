import { useCallback } from 'react';
import type { ChatPlugin, PluginContext, ChatMessage, ScrollService } from '../../kernel/core/types';
import { useKernel, useOrchestratorState } from '../../kernel/ui/KernelProvider';

function MessageFiles({ messageId }: { messageId: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();

  let msg: ChatMessage | undefined;
  for (const w of Object.values(orchState.windows)) {
    msg = w.messages.find((m) => m.id === messageId);
    if (msg) break;
  }

  const scrollToBottom = useCallback(() => {
    if (!kernel.services.has('scroll')) return;
    const scroll = kernel.services.get<ScrollService>('scroll');
    if (scroll?.scrollToBottom) {
      scroll.scrollToBottom('auto');
    } else {
      const el = scroll?.getContainer();
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [kernel.services]);

  if (!msg?.generatedFiles?.length) return null;

  return (
    <div className="zenmux-message-files">
      {msg.generatedFiles.map((file, i) => (
        <img
          key={i}
          src={file.url || `data:${file.mediaType};base64,${file.base64}`}
          alt={`Generated ${i + 1}`}
          className="zenmux-message-files__image"
          onLoad={scrollToBottom}
        />
      ))}
    </div>
  );
}

export const MessageFilesPlugin: ChatPlugin = {
  id: 'message-files',

  setup(ctx: PluginContext) {
    ctx.ui.register('message:files', {
      id: 'message-files',
      pluginId: 'message-files',
      order: 0,
      render: (renderCtx) => <MessageFiles messageId={renderCtx.messageId!} />,
    });
  },
};
