import { memo, useState, useEffect, useCallback } from 'react';
import { Markdown } from '@lobehub/ui';
import { cn } from '../../lib/cn';
import { usePluginState } from '../../kernel/ui/KernelProvider';
import { useArtifactData } from './utils';
import { ARTIFACT_SLICE, type ArtifactState } from './ArtifactPlugin';

// ─── ArtifactPanel ──────────────────────────────────────────────

const TYPE_META: Record<string, { label: string }> = {
  'text/html': { label: 'HTML' },
  'image/svg+xml': { label: 'SVG' },
  'application/vnd.mermaid': { label: 'Mermaid' },
  'text/markdown': { label: 'Markdown' },
};

const ArtifactPanel = memo(() => {
  const [state, setState] = usePluginState<ArtifactState>(ARTIFACT_SLICE);
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const artifactId = state.openArtifactId;
  const artifact = useArtifactData(artifactId ?? undefined);

  const handleClose = useCallback(() => {
    setFullscreen(false);
    setState((prev) => ({ ...prev, openArtifactId: null }));
  }, [setState]);

  const handleCopy = useCallback(() => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [artifact]);

  // ESC 关闭（全屏时先退出全屏）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false);
        else handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose, fullscreen]);

  if (!artifactId || !artifact) return null;

  const { content, type, title, streaming } = artifact;
  const meta = TYPE_META[type] || { label: type };

  const renderPreview = () => {
    if (streaming) {
      return (
        <div className="zenmux-artifact-panel__loading">
          <div className="zenmux-artifact-panel__spinner" />
          <span className="zenmux-artifact-panel__loading-text">正在生成中...</span>
          <span className="zenmux-artifact-panel__loading-subtext">{content.length} 字符已接收</span>
        </div>
      );
    }

    switch (type) {
      case 'text/html':
        return (
          <iframe
            srcDoc={content}
            sandbox="allow-scripts allow-popups"
            className="zenmux-artifact-panel__iframe"
          />
        );

      case 'image/svg+xml':
        return (
          <div
            className="zenmux-artifact-panel__svg-preview"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );

      case 'application/vnd.mermaid':
        return (
          <pre className="zenmux-artifact-panel__mermaid-preview">
            <code>{content}</code>
          </pre>
        );

      case 'text/markdown':
      default:
        return (
          <div className="zenmux-artifact-panel__md-preview">
            <Markdown variant="chat">{content}</Markdown>
          </div>
        );
    }
  };

  const panelClass = fullscreen
    ? 'zenmux-artifact-panel zenmux-artifact-panel--fullscreen'
    : 'zenmux-artifact-panel zenmux-artifact-panel--side';

  return (
    <>
      {/* 背景遮罩（非全屏时显示） */}
      {!fullscreen && (
        <div
          className="zenmux-artifact-panel__backdrop"
          onClick={handleClose}
        />
      )}

      {/* 面板 */}
      <div className={panelClass}>
        {/* Header */}
        <div className="zenmux-artifact-panel__header">
          <div className="zenmux-artifact-panel__header-left">
            <button
              onClick={handleClose}
              className="zenmux-artifact-panel__close-btn"
              title="关闭"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className="zenmux-artifact-panel__title">
              {title || 'Artifact'}
            </span>
            <span className="zenmux-artifact-panel__type-badge">
              {meta.label}
            </span>
            {streaming && (
              <span className="zenmux-artifact-panel__streaming-badge">
                生成中...
              </span>
            )}
          </div>

          <div className="zenmux-artifact-panel__header-actions">
            {/* Copy */}
            <button
              onClick={handleCopy}
              className="zenmux-artifact-panel__copy-btn"
              title="复制代码"
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="zenmux-artifact-panel__fullscreen-btn"
              title={fullscreen ? '退出全屏' : '全屏'}
            >
              {fullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="zenmux-artifact-panel__tabs">
          <button
            className={cn('zenmux-artifact-panel__tab', mode === 'preview' && 'zenmux-artifact-panel__tab--active')}
            onClick={() => setMode('preview')}
          >
            Preview
            {mode === 'preview' && (
              <div className="zenmux-artifact-panel__tab-indicator" />
            )}
          </button>
          <button
            className={cn('zenmux-artifact-panel__tab', mode === 'code' && 'zenmux-artifact-panel__tab--active')}
            onClick={() => setMode('code')}
          >
            Code
            {mode === 'code' && (
              <div className="zenmux-artifact-panel__tab-indicator" />
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="zenmux-artifact-panel__content">
          {mode === 'code' ? (
            <pre className="zenmux-artifact-panel__code">
              <code>{content}</code>
            </pre>
          ) : (
            renderPreview()
          )}
        </div>
      </div>
    </>
  );
});

export default ArtifactPanel;
