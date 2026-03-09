import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { FileUploadButton } from './FileUploadButton';

export const FileUploadPlugin: ChatPlugin = {
  id: 'file-upload',

  setup(ctx: PluginContext) {
    // 注册 input:actions slot，渲染 "+" 上传按钮
    ctx.ui.register('input:actions', {
      id: 'file-upload-button',
      pluginId: 'file-upload',
      order: 0,
      render: (renderCtx) => <FileUploadButton windowId={renderCtx.windowId} />,
    });
  },
};
