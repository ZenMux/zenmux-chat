import type { ChatPlugin, PluginContext } from '../../kernel/core/types';
import { systemPrompt } from './prompt';
import { preprocessArtifacts } from './utils';
import rehypeArtifact from './rehypePlugin';
import ArtifactRenderer from './ArtifactRenderer';
import { ArtifactToggle } from './ArtifactToggle';
import { ArtifactPanelHost } from './ArtifactPanelHost';

export interface MarkdownExtensions {
  rehypePlugins: any[];
  components: Record<string, React.FC<any>>;
  preprocess: (content: string) => string;
}

// 稳定引用，避免 Markdown 组件不必要的 re-render
const REHYPE_PLUGINS = [rehypeArtifact];
const COMPONENTS: Record<string, React.FC<any>> = {
  antArtifact: ArtifactRenderer as React.FC<any>,
};

const SLICE_NAME = 'artifact';

export interface ArtifactState {
  /** 是否启用 artifact 系统提示词注入 */
  enabled: boolean;
  /** 当前打开预览的 artifact id，null 表示面板关闭 */
  openArtifactId: string | null;
}

const INITIAL_STATE: ArtifactState = {
  enabled: true,
  openArtifactId: null,
};

export const ArtifactPlugin: ChatPlugin = {
  id: 'artifact',

  setup(ctx: PluginContext) {
    // 1. 注册状态 slice
    ctx.state.registerSlice(SLICE_NAME, INITIAL_STATE);

    // 2. 注册 Markdown 扩展服务（供 ChatPanel 消费）
    const extensions: MarkdownExtensions = {
      rehypePlugins: REHYPE_PLUGINS,
      components: COMPONENTS,
      preprocess: preprocessArtifacts,
    };
    ctx.services.register<MarkdownExtensions>('markdownExtensions', () => extensions);

    // 3. 注册 input:actions 切换按钮 + 面板 portal 宿主
    ctx.ui.register('input:actions', {
      id: 'artifact-toggle',
      pluginId: 'artifact',
      order: 30,
      render: () => <ArtifactToggle />,
    });
    ctx.ui.register('input:actions', {
      id: 'artifact-panel-host',
      pluginId: 'artifact',
      order: 31,
      render: () => <ArtifactPanelHost />,
    });

    // 4. 注册请求生命周期钩子 —— 注入 artifact system prompt
    ctx.requests.register('artifact', {
      onBuildRequest: (reqCtx) => {
        const state = ctx.state.getSlice<ArtifactState>(SLICE_NAME);
        if (!state.enabled) return;

        // 将 artifact 提示词追加到现有 system prompt
        const existing = typeof reqCtx.params.system === 'string' ? reqCtx.params.system : '';
        reqCtx.params.system = existing
          ? `${existing}\n\n${systemPrompt}`
          : systemPrompt;
      },
    });
  },
};

export { SLICE_NAME as ARTIFACT_SLICE };
