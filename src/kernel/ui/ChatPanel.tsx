import { useRef, useState, useEffect, useCallback, useMemo, memo, Component, type ReactNode, type ErrorInfo } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Markdown } from '@lobehub/ui';
import type { ScrollService, ChatMessage, ServiceContainer } from '../core/types';
import { useKernel, useOrchestratorState, useMessageRenderers, SlotRenderer } from './KernelProvider';
import { cn } from '../../lib/cn';

// ─── Markdown 扩展服务类型 ──────────────────────────────────────

interface MarkdownExtensions {
  rehypePlugins: any[];
  components: Record<string, React.FC<any>>;
  preprocess: (content: string) => string;
}

const EMPTY_EXTENSIONS: MarkdownExtensions = {
  rehypePlugins: [],
  components: {},
  preprocess: (s: string) => s,
};

function getMarkdownExtensions(services: ServiceContainer): MarkdownExtensions {
  return services.has('markdownExtensions')
    ? services.get<MarkdownExtensions>('markdownExtensions')
    : EMPTY_EXTENSIONS;
}

// 调试用 ErrorBoundary，捕获并打印完整堆栈
class MarkdownErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('=== Markdown ErrorBoundary ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', info.componentStack);
  }
  render() {
    if (this.state.error) {
      return <pre className="zenmux-chat-panel__error-boundary">
        {this.state.error.message}{'\n'}{this.state.error.stack}
      </pre>;
    }
    return this.props.children;
  }
}

// 稳定引用，避免每次渲染创建新对象导致 context 变化
const STABLE_REMARK_PLUGINS: never[] = [];

const MemoizedMarkdown = memo(({ content, animated, extensions }: {
  content: string;
  animated?: boolean;
  extensions: MarkdownExtensions;
}) => {
  const processedContent = extensions.preprocess(content);
  return (
    <MarkdownErrorBoundary>
      <Markdown
        animated={animated}
        variant="chat"
        enableLatex={true}
        components={extensions.components}
        remarkPlugins={STABLE_REMARK_PLUGINS}
        rehypePlugins={extensions.rehypePlugins}
      >
        {processedContent}
      </Markdown>
    </MarkdownErrorBoundary>
  );
});

export function ChatPanel({ windowId, className }: { windowId: string; className?: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];
  const messageRenderers = useMessageRenderers();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState(0);
  const renderCtx = { state: kernel.state, services: kernel.services, windowId };

  // 获取 Markdown 扩展（artifact 等插件注入的 rehype 插件和组件）
  const mdExtensions = useMemo(
    () => getMarkdownExtensions(kernel.services),
    [kernel.services],
  );

  // 注册 scroll service，供插件获取消息区域 DOM + scrollToBottom
  useEffect(() => {
    if (!kernel.services.has('scroll')) {
      kernel.services.register<ScrollService>('scroll', () => ({
        getContainer: () => scrollContainerRef.current,
        scrollToBottom: (behavior?: 'smooth' | 'auto') => {
          virtuosoRef.current?.scrollTo({
            top: Number.MAX_SAFE_INTEGER,
            behavior: behavior ?? 'auto',
          });
        },
      }));
    }
  }, [kernel.services]);

  // 监听输入域高度变化，动态设置消息列表 paddingBottom
  useEffect(() => {
    const el = inputWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const isExpanded = el.querySelector('[data-expanded="true"]') !== null;
      setInputHeight(isExpanded ? 0 : el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // followOutput：streaming 时自动跟底
  const followOutput = useCallback((isAtBottom: boolean) => {
    if (window?.status === 'streaming') return 'smooth';
    return isAtBottom ? 'auto' : false;
  }, [window?.status]);

  // 捕获 Virtuoso 内部的 scroll container DOM
  const scrollerRef = useCallback((el: HTMLElement | Window | null) => {
    if (el instanceof HTMLDivElement) {
      scrollContainerRef.current = el;
    }
  }, []);

  // 单条消息渲染
  const itemContent = useCallback((_index: number, msg: ChatMessage) => {
    const customRenderer = messageRenderers.find((r) => r.match(msg));
    if (customRenderer) {
      return <div>{customRenderer.render(msg, renderCtx)}</div>;
    }

    // ── 用户消息：右对齐气泡 ──
    if (msg.role === 'user') {
      return (
        <div className="zenmux-chat-panel__message--user">
          <div className="zenmux-chat-panel__bubble--user">
            <div className="zenmux-chat-panel__bubble-content">{msg.content}</div>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="zenmux-chat-panel__attachments">
                {msg.attachments.map((att) => (
                  <div key={att.id} className="zenmux-chat-panel__attachment-chip">
                    {att.mediaType.startsWith('image/') ? (
                      <img src={`data:${att.mediaType};base64,${att.data}`} alt={att.name}
                        className="zenmux-chat-panel__attachment-thumb" />
                    ) : (
                      <span className="zenmux-chat-panel__attachment-icon">&#128206;</span>
                    )}
                    <span className="zenmux-chat-panel__attachment-name">
                      {att.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── 助手消息：左对齐，头部由插件渲染 ──
    return (
      <div className="zenmux-chat-panel__message--assistant">
        <SlotRenderer slot="message:header" messageId={msg.id} windowId={windowId} message={msg} />
        <div className="zenmux-chat-panel__message-content">
          <SlotRenderer slot="message:reasoning" messageId={msg.id} windowId={windowId} message={msg} />
          <MemoizedMarkdown
            content={msg.content}
            animated={window?.status === 'streaming' && window.streamingMessageId === msg.id}
            extensions={mdExtensions}
          />
          <SlotRenderer slot="message:files" messageId={msg.id} windowId={windowId} message={msg} />
          <SlotRenderer slot="message:error" messageId={msg.id} windowId={windowId} message={msg} />
          <div className="zenmux-chat-panel__message-footer">
            <SlotRenderer slot="message:footer" messageId={msg.id} windowId={windowId} message={msg} />
          </div>
          <SlotRenderer slot="message:streaming" messageId={msg.id} windowId={windowId} message={msg} />
        </div>
      </div>
    );
  }, [messageRenderers, renderCtx, window?.status, window?.messages, windowId, mdExtensions]);

  if (!window) return <div>Window not found.</div>;

  return (
    <div className={cn("zenmux-chat-panel", className)}>
      {/* Panel Header */}
      <div className="zenmux-chat-panel__header">
        <SlotRenderer slot="panel:header" windowId={windowId} />
      </div>

      {/* 消息列表 + 输入域共享父元素 */}
      <div className="zenmux-chat-panel__body">
        {/* Virtuoso 虚拟滚动消息列表 */}
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={scrollerRef}
          style={{ height: '100%' }}
          data={window.messages}
          increaseViewportBy={{ top: 200, bottom: 200 }}
          followOutput={followOutput}
          components={{
            Header: () => (
              <div className="zenmux-chat-panel__list-header">
                <SlotRenderer slot="message:above" windowId={windowId} />
              </div>
            ),
            Footer: () => (
              <div className="zenmux-chat-panel__list-footer" style={{ paddingBottom: inputHeight + 16 }}>
                {/* streaming 指示器的 Footer 兜底：仅在 assistant 消息尚未创建时显示（如 sendMessage 的初始 sending 阶段） */}
                <SlotRenderer slot="message:streaming" windowId={windowId} />
                <SlotRenderer slot="message:below" windowId={windowId} />
                <SlotRenderer slot="panel:footer" windowId={windowId} />
              </div>
            ),
          }}
          itemContent={itemContent}
        />

        {/* Input Area — 绝对定位在底部 */}
        <div ref={inputWrapperRef} className="zenmux-chat-panel__input-area">
          <SlotRenderer slot="input:composer" windowId={windowId} />
        </div>
      </div>
    </div>
  );
}
