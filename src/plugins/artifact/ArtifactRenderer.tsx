import { memo, useCallback } from 'react';
import { usePluginState } from '../../kernel/ui/KernelProvider';
import { useArtifactData } from './utils';
import { ARTIFACT_SLICE, type ArtifactState } from './ArtifactPlugin';

// ─── 类型图标 ───────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string }> = {
  'text/html': { label: 'HTML', icon: '🌐' },
  'image/svg+xml': { label: 'SVG', icon: '🎨' },
  'application/vnd.mermaid': { label: 'Mermaid', icon: '📊' },
  'text/markdown': { label: 'Markdown', icon: '📝' },
};

// ─── 内联卡片组件 ───────────────────────────────────────────────

interface ArtifactCardProps {
  // hast 的 dataArtifactId 属性经过 hast-to-jsx 转换后变为 data-artifact-id
  'data-artifact-id'?: string;
  [key: string]: any;
}

/**
 * 消息内的 Artifact 占位卡片。
 * 点击后在右侧面板打开预览。
 */
const ArtifactRenderer = memo<ArtifactCardProps>((props) => {
  const artifactId = props['data-artifact-id'];
  const [, setState] = usePluginState<ArtifactState>(ARTIFACT_SLICE);

  const artifact = useArtifactData(artifactId);

  const handleClick = useCallback(() => {
    if (!artifactId) return;
    setState((prev) => ({ ...prev, openArtifactId: artifactId }));
  }, [artifactId, setState]);

  if (!artifact) return null;

  const { type, title, streaming } = artifact;
  const meta = TYPE_META[type] || { label: type, icon: '📄' };

  return (
    <button
      onClick={handleClick}
      className="my-2 w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 shadow-sm transition-all duration-150 cursor-pointer text-left group"
    >
      {/* 图标 */}
      <div className="w-9 h-9 rounded-lg bg-neutral-100 group-hover:bg-violet-50 flex items-center justify-center text-neutral-500 group-hover:text-violet-600 transition-colors shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>

      {/* 标题 + 类型 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-800 truncate">
          {title || 'Artifact'}
        </div>
        <div className="text-xs text-neutral-400 mt-0.5">
          {meta.icon} {meta.label}
          {streaming && ' · 生成中...'}
        </div>
      </div>

      {/* 箭头 */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
});

export default ArtifactRenderer;
