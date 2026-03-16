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
      className="zenmux-artifact-card"
    >
      {/* 图标 */}
      <div className="zenmux-artifact-card__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>

      {/* 标题 + 类型 */}
      <div className="zenmux-artifact-card__info">
        <div className="zenmux-artifact-card__title">
          {title || 'Artifact'}
        </div>
        <div className="zenmux-artifact-card__type">
          {meta.icon} {meta.label}
          {streaming && ' · 生成中...'}
        </div>
      </div>

      {/* 箭头 */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="zenmux-artifact-card__arrow">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
});

export default ArtifactRenderer;
