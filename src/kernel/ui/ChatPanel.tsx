import { useRef, useState, useEffect, useCallback, memo, Component, type ReactNode, type ErrorInfo } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Markdown } from '@lobehub/ui';
import { cn } from '../../lib/cn';
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
      return <pre className="text-red-500 text-xs whitespace-pre-wrap">
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
      <div className={cn(
        'mb-3 px-3 py-2 rounded-lg',
        msg.role === 'user' ? 'bg-blue-50' : 'bg-neutral-100',
      )}>
        <div className="text-[11px] text-neutral-400 mb-1">
          {msg.role}
        </div>
        <SlotRenderer slot="message:reasoning" messageId={msg.id} windowId={windowId} />
        {msg.role === 'assistant' ? (
          <MemoizedMarkdown
            content={msg.content}
            animated={window?.status === 'streaming' && msg === window.messages[window.messages.length - 1]}
          />
        ) : (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        )}
        <SlotRenderer slot="message:files" messageId={msg.id} windowId={windowId} />
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {msg.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-xs text-neutral-600 max-w-[180px]">
                {att.mediaType.startsWith('image/') ? (
                  <img src={`data:${att.mediaType};base64,${att.data}`} alt={att.name}
                    className="w-5 h-5 rounded-sm object-cover" />
                ) : (
                  <span className="text-sm">&#128206;</span>
                )}
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
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
    <div className="kernel-chat flex flex-col flex-1 min-h-0">
      {/* Panel Header */}
      <div className="px-4 py-2 border-b border-neutral-300">
        <SlotRenderer slot="panel:header" windowId={windowId} />
      </div>

      {/* 消息列表 + 输入域共享父元素 */}
      <div className="relative flex-1 min-h-0">
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
              <div className="px-4 pt-4">
                <SlotRenderer slot="message:above" windowId={windowId} />
              </div>
            ),
            Footer: () => (
              <div className="px-4" style={{ paddingBottom: inputHeight + 16 }}>
                <SlotRenderer slot="message:streaming" windowId={windowId} />
                <SlotRenderer slot="message:error" windowId={windowId} />
                <SlotRenderer slot="message:below" windowId={windowId} />
                <div className="border-t border-neutral-300 pt-2">
                  <SlotRenderer slot="panel:footer" windowId={windowId} />
                </div>
              </div>
            ),
          }}
          itemContent={itemContent}
        />

        {/* Input Area — 绝对定位在底部 */}
        <div ref={inputWrapperRef} className="absolute bottom-0 inset-x-0">
          <SlotRenderer slot="input:composer" windowId={windowId} />
        </div>
      </div>
    </div>
  );
}
