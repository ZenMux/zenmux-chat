import { useRef, useState, useEffect, useCallback, memo, Component, type ReactNode, type ErrorInfo } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Markdown } from '@lobehub/ui';
import type { ScrollService, ChatMessage } from '../core/types';
import { useKernel, useOrchestratorState, useMessageRenderers, SlotRenderer } from './KernelProvider';

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
      return <pre style={{ color: 'red', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        {this.state.error.message}{'\n'}{this.state.error.stack}
      </pre>;
    }
    return this.props.children;
  }
}

// 稳定引用，避免每次渲染创建新对象导致 context 变化
const STABLE_COMPONENTS: Record<string, never> = {};
const STABLE_REMARK_PLUGINS: never[] = [];
const STABLE_REHYPE_PLUGINS: never[] = [];

const MemoizedMarkdown = memo(({ content, animated }: { content: string; animated?: boolean }) => (
  <MarkdownErrorBoundary>
    <Markdown
      animated={animated}
      variant="chat"
      enableLatex={true}
      components={STABLE_COMPONENTS}
      remarkPlugins={STABLE_REMARK_PLUGINS}
      rehypePlugins={STABLE_REHYPE_PLUGINS}
    >
      {content}
    </Markdown>
  </MarkdownErrorBoundary>
));

export function ChatPanel({ windowId }: { windowId: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const window = orchState.windows[windowId];
  const messageRenderers = useMessageRenderers();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState(0);
  const renderCtx = { state: kernel.state, services: kernel.services, windowId };

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
    return (
      <div
        style={{
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
        }}
      >
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
          {msg.role}
        </div>
        <SlotRenderer slot="message:reasoning" messageId={msg.id} windowId={windowId} />
        {msg.role === 'assistant' ? (
          <MemoizedMarkdown
            content={msg.content}
            animated={window?.status === 'streaming' && msg === window.messages[window.messages.length - 1]}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        )}
        <SlotRenderer slot="message:files" messageId={msg.id} windowId={windowId} />
        {msg.attachments && msg.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {msg.attachments.map((att) => (
              <div key={att.id} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 6,
                backgroundColor: '#f0f0f0', fontSize: 12, color: '#555', maxWidth: 180,
              }}>
                {att.mediaType.startsWith('image/') ? (
                  <img src={`data:${att.mediaType};base64,${att.data}`} alt={att.name}
                    style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 14 }}>&#128206;</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </span>
              </div>
            ))}
          </div>
        )}
        <SlotRenderer slot="message:footer" messageId={msg.id} windowId={windowId} />
      </div>
    );
  }, [messageRenderers, renderCtx, window?.status, window?.messages, windowId]);

  if (!window) return <div>Window not found.</div>;

  return (
    <div className="kernel-chat" style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }}>
      {/* Panel Header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0' }}>
        <SlotRenderer slot="panel:header" windowId={windowId} />
      </div>

      {/* 消息列表 + 输入域共享父元素 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
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
              <div style={{ padding: '16px 16px 0' }}>
                <SlotRenderer slot="message:above" windowId={windowId} />
              </div>
            ),
            Footer: () => (
              <div style={{ padding: `0 16px ${inputHeight + 16}px` }}>
                <SlotRenderer slot="message:streaming" windowId={windowId} />
                <SlotRenderer slot="message:error" windowId={windowId} />
                <SlotRenderer slot="message:below" windowId={windowId} />
                <div style={{ borderTop: '1px solid #e0e0e0', padding: '8px 0 0' }}>
                  <SlotRenderer slot="panel:footer" windowId={windowId} />
                </div>
              </div>
            ),
          }}
          itemContent={itemContent}
        />

        {/* Input Area — 绝对定位在底部 */}
        <div ref={inputWrapperRef} style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}>
          <SlotRenderer slot="input:composer" windowId={windowId} />
        </div>
      </div>
    </div>
  );
}
