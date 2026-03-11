import { useMemo, useEffect } from 'react';
import { cn } from '../lib/cn';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createChatKernel } from '../kernel/core/ChatKernel';
import { KernelProvider, useKernel, useOrchestratorState, usePluginState, SlotRenderer } from '../kernel/ui/KernelProvider';
import { Toolbar } from '../kernel/ui/Toolbar';
import { ChatPanel } from '../kernel/ui/ChatPanel';
import { BillingPlugin } from '../plugins/billing';
import { RequestConfigPlugin } from '../plugins/request-config';
import { createModelSelectorPlugin, CHAT_PARAMS, RESPONSES_PARAMS, type ModelOption } from '../plugins/model-selector';
import { FileUploadPlugin } from '../plugins/file-upload';
import { AutoScrollPlugin } from '../plugins/auto-scroll';
import { MessageUsagePlugin } from '../plugins/message-usage';
import { StreamingIndicatorPlugin } from '../plugins/streaming-indicator';
import { ErrorDisplayPlugin } from '../plugins/error-display';
import { MessageReasoningPlugin } from '../plugins/message-reasoning';
import { MessageFilesPlugin } from '../plugins/message-files';
import { InputComposerPlugin } from '../plugins/input-composer';
import { PKPlugin, PK_SLICE, type PKState } from '../plugins/pk';
import { ImageConfigPlugin } from '../plugins/image-config';
import { ChatMemoryPlugin } from '../plugins/chat-memory';
import { createNetworkPlugin, createLocalNetworkService } from '../plugins/network';
import { createSessionListPlugin, SESSION_LIST_SLICE, type SessionListState } from '../plugins/session-list';
import { ArtifactPlugin } from '../plugins/artifact';
import { mockModel } from './mock-model';


// ─── Provider & Model 配置（使用环境变量） ─────────────────────

const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
  baseURL: import.meta.env.VITE_OPENAI_BASE_URL || undefined,
});

const google = createGoogleGenerativeAI({
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? import.meta.env.VITE_OPENAI_API_KEY ?? '',
  baseURL: import.meta.env.VITE_GOOGLE_BASE_URL || undefined,
});

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'mock-grok', label: 'Mock Grok (Artifact测试)', model: mockModel, capabilities: { supportsImages: false, supportsFiles: false, supportedParams: CHAT_PARAMS } },
  { id: 'x-ai/grok-4.2-fast', label: 'Grok 4.2 Fast', model: openai.chat('x-ai/grok-4.2-fast'), capabilities: { supportsImages: true, supportsFiles: true, supportedParams: CHAT_PARAMS } },
  { id: 'gpt-4o', label: 'GPT-4o', model: openai.chat('gpt-4o'), capabilities: { supportsImages: true, supportsFiles: false, supportedParams: CHAT_PARAMS } },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', model: openai.chat('gpt-4o-mini'), capabilities: { supportsImages: true, supportsFiles: false, supportedParams: CHAT_PARAMS } },
  { id: 'gpt-4.1', label: 'GPT-4.1', model: openai.responses('gpt-4.1'), capabilities: { supportsImages: true, supportsFiles: false, supportedParams: RESPONSES_PARAMS } },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', model: openai.responses('gpt-4.1-mini'), capabilities: { supportsImages: true, supportsFiles: false, supportedParams: RESPONSES_PARAMS } },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', model: openai.responses('gpt-4.1-nano'), capabilities: { supportsImages: false, supportsFiles: false, supportedParams: RESPONSES_PARAMS } },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview', model: google('gemini-3.1-flash-image-preview'), capabilities: { supportsImages: true, supportsFiles: true, supportedParams: CHAT_PARAMS } },
];

const networkService = createLocalNetworkService();

function AppInner() {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const [pkState] = usePluginState<PKState>(PK_SLICE);

  const [sessionListState] = usePluginState<SessionListState>(SESSION_LIST_SLICE);

  // 等待 session-list 恢复完成后再创建默认窗口
  useEffect(() => {
    if (!sessionListState.restored) return;
    if (!orchState.activeWindowId) {
      kernel.orchestrator.createWindow('default');
    }
  }, [kernel.orchestrator, orchState.activeWindowId, sessionListState.restored]);

  // 统一用 windowIds 驱动：PK 模式多个窗口，普通模式单窗口
  const windowIds = pkState.windowIds.length > 0
    ? pkState.windowIds
    : orchState.activeWindowId ? [orchState.activeWindowId] : [];

  return (
    <div className="flex h-screen font-sans">
      <SlotRenderer slot="sidebar:left" />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex flex-1 min-h-0">
          {windowIds.map((wid, i) => (
            <div key={wid} className={cn(
              'flex-1 min-w-0 flex flex-col',
              i < windowIds.length - 1 && 'border-r border-chat-border',
            )}>
              <Toolbar windowId={wid} />
              <ChatPanel windowId={wid} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const kernel = useMemo(() => {
    const k = createChatKernel({ defaultModel: MODEL_OPTIONS[0].model });
    // 注册业务插件
    k.plugins.register(createModelSelectorPlugin({ models: MODEL_OPTIONS }));
    k.plugins.register(FileUploadPlugin);
    k.plugins.register(BillingPlugin);
    k.plugins.register(RequestConfigPlugin);
    k.plugins.register(AutoScrollPlugin);
    k.plugins.register(MessageUsagePlugin);
    k.plugins.register(StreamingIndicatorPlugin);
    k.plugins.register(ErrorDisplayPlugin);
    k.plugins.register(MessageReasoningPlugin);
    k.plugins.register(MessageFilesPlugin);
    k.plugins.register(InputComposerPlugin);
    k.plugins.register(PKPlugin);
    k.plugins.register(ImageConfigPlugin);
    k.plugins.register(ChatMemoryPlugin);
    k.plugins.register(ArtifactPlugin);
    // NetworkPlugin 需在 PK 插件之后注册（restore 可能写入 pk 切片）
    // autoRestore: false — 由 session-list 插件接管恢复
    k.plugins.register(createNetworkPlugin({
      service: networkService,
      autoRestore: false,
    }));
    // SessionListPlugin 需在 NetworkPlugin 之后注册（依赖 'network' 服务）
    k.plugins.register(createSessionListPlugin({
      service: networkService,
    }));
    k.boot();
    return k;
  }, []);

  return (
    <KernelProvider kernel={kernel}>
      <AppInner />
    </KernelProvider>
  );
}
