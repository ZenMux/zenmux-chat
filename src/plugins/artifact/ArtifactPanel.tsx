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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-chat-text-muted">
          <div className="w-8 h-8 border-2 border-neutral-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm">正在生成中...</span>
          <span className="text-xs text-chat-text-muted">{content.length} 字符已接收</span>
        </div>
      );
    }

    switch (type) {
      case 'text/html':
        return (
          <iframe
            srcDoc={content}
            sandbox="allow-scripts allow-popups"
            className="w-full h-full border-none"
          />
        );

      case 'image/svg+xml':
        return (
          <div
            className="flex items-center justify-center p-6 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );

      case 'application/vnd.mermaid':
        return (
          <pre className="p-6 text-sm overflow-x-auto">
            <code>{content}</code>
          </pre>
        );

      case 'text/markdown':
      default:
        return (
          <div className="p-6">
            <Markdown variant="chat">{content}</Markdown>
          </div>
        );
    }
  };

  const panelClass = fullscreen
    ? 'fixed inset-0 z-50 bg-chat-bg flex flex-col animate-in fade-in duration-150'
    : 'fixed top-0 right-0 bottom-0 w-[min(560px,50vw)] z-50 bg-chat-bg border-l border-chat-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200';

  return (
    <>
      {/* 背景遮罩（非全屏时显示） */}
      {!fullscreen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200"
          onClick={handleClose}
        />
      )}

      {/* 面板 */}
      <div className={panelClass}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-chat-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-chat-hover text-chat-text-secondary transition-colors"
              title="关闭"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className="text-sm font-medium text-chat-text truncate">
              {title || 'Artifact'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-chat-hover text-chat-text-secondary font-mono shrink-0">
              {meta.label}
            </span>
            {streaming && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 animate-pulse">
                生成中...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Copy */}
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-xs rounded hover:bg-chat-hover text-chat-text-secondary transition-colors"
              title="复制代码"
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="p-1 rounded hover:bg-chat-hover text-chat-text-secondary transition-colors"
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
        <div className="flex border-b border-chat-border shrink-0">
          <button
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              mode === 'preview'
                ? 'text-chat-text'
                : 'text-chat-text-muted hover:text-chat-text-secondary',
            )}
            onClick={() => setMode('preview')}
          >
            Preview
            {mode === 'preview' && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-chat-text rounded-full" />
            )}
          </button>
          <button
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              mode === 'code'
                ? 'text-chat-text'
                : 'text-chat-text-muted hover:text-chat-text-secondary',
            )}
            onClick={() => setMode('code')}
          >
            Code
            {mode === 'code' && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-chat-text rounded-full" />
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto flex flex-col">
          {mode === 'code' ? (
            <pre className="p-4 text-xs text-chat-text overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
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
