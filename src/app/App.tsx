import { useMemo, useEffect } from "react";
import { cn } from "../lib/cn";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createChatKernel } from "../kernel/core/ChatKernel";
import {
  KernelProvider,
  useKernel,
  useOrchestratorState,
  usePluginState,
  SlotRenderer,
} from "../kernel/ui/KernelProvider";
import { Toolbar } from "../kernel/ui/Toolbar";
import { ChatPanel } from "../kernel/ui/ChatPanel";
import { BillingPlugin } from "../plugins/billing";
import { RequestConfigPlugin } from "../plugins/request-config";
import {
  createModelSelectorPlugin,
  CHAT_PARAMS,
  RESPONSES_PARAMS,
  ANTHROPIC_PARAMS,
} from "../plugins/model-selector";
import type {
  ProviderConfig,
  ProtocolOption,
  ModelEntry,
} from "../plugins/model-selector";
import { FileUploadPlugin } from "../plugins/file-upload";
import { AutoScrollPlugin } from "../plugins/auto-scroll";
import { MessageUsagePlugin } from "../plugins/message-usage";
import { StreamingIndicatorPlugin } from "../plugins/streaming-indicator";
import { ErrorDisplayPlugin } from "../plugins/error-display";
import { MessageReasoningPlugin } from "../plugins/message-reasoning";
import { MessageFilesPlugin } from "../plugins/message-files";
import { InputComposerPlugin } from "../plugins/input-composer";
import { PKPlugin, PK_SLICE, type PKState } from "../plugins/pk";
import { ImageConfigPlugin } from "../plugins/image-config";
import { ChatMemoryPlugin } from "../plugins/chat-memory";
import {
  createNetworkPlugin,
  createLocalNetworkService,
} from "../plugins/network";
import {
  createSessionListPlugin,
  SESSION_LIST_SLICE,
  type SessionListState,
} from "../plugins/session-list";
import { ArtifactPlugin } from "../plugins/artifact";
import { MessageActionsPlugin } from "../plugins/message-actions";
import { LogDetailsPlugin } from "../plugins/log-details";
import { mockModel } from "./mock-model";
import '../styles/index.less';

// ─── Provider / Protocol / Model 配置 ─────────────────────────

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    createInstance: (fetchFn) =>
      createOpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? "",
        baseURL: import.meta.env.VITE_OPENAI_BASE_URL || undefined,
        fetch: fetchFn,
      }),
  },
  {
    id: "google",
    label: "Google",
    createInstance: (fetchFn) =>
      createGoogleGenerativeAI({
        apiKey:
          import.meta.env.VITE_GOOGLE_API_KEY ??
          import.meta.env.VITE_OPENAI_API_KEY ??
          "",
        baseURL: import.meta.env.VITE_GOOGLE_BASE_URL || undefined,
        fetch: fetchFn,
      }),
  },
  {
    id: "anthropic",
    label: "Anthropic",
    createInstance: (fetchFn) =>
      createAnthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY ?? "",
        baseURL: import.meta.env.VITE_ANTHROPIC_BASE_URL || undefined,
        fetch: fetchFn,
      }),
  },
];

const PROTOCOLS: ProtocolOption[] = [
  {
    id: "chat.completion",
    label: "Chat Completions",
    providerId: "openai",
    supportedParams: CHAT_PARAMS,
    resolve: (provider: any, modelId: string) => provider.chat(modelId),
  },
  {
    id: "responses",
    label: "Responses API",
    providerId: "openai",
    supportedParams: RESPONSES_PARAMS,
    resolve: (provider: any, modelId: string) => provider.responses(modelId),
  },
  {
    id: "google",
    label: "Google AI",
    providerId: "google",
    supportedParams: CHAT_PARAMS,
    resolve: (provider: any, modelId: string) => provider(modelId),
  },
  {
    id: "anthropic",
    label: "Anthropic Messages",
    providerId: "anthropic",
    supportedParams: ANTHROPIC_PARAMS,
    resolve: (provider: any, modelId: string) => provider(modelId),
  },
];

const MODELS: ModelEntry[] = [
  {
    id: "mock-grok",
    label: "Mock Grok (Artifact测试)",

    overrideModel: mockModel,
    compatibleProtocols: ["chat.completion"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: false,
      supportsFiles: false,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "baidu/ernie-x1.1-preview",
    label: "baidu/ernie-x1.1-preview",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
     {
    id: "baidu/ernie-5.0-thinking-preview",
    label: "baidu/ernie-5.0-thinking-preview",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
   {
    id: "x-ai/grok-4.2-fast-non-reasoning",
    label: "x-ai/grok-4.2-fast-non-reasoning",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4.2-fast",
    label: "x-ai/grok-4.2-fast",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4.1-fast-non-reasoning",
    label: "x-ai/grok-4.1-fast-non-reasoning",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4.1-fast",
    label: "x-ai/grok-4.1-fast",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4-fast-non-reasoning",
    label: "x-ai/grok-4-fast-non-reasoning",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4-fast",
    label: "x-ai/grok-4-fast",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-code-fast-1",
    label: "Grok 4 code fast 1",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "x-ai/grok-4",
    label: "Grok 4",
    compatibleProtocols: ["chat.completion", "responses", "anthropic"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",

    compatibleProtocols: ["chat.completion", "responses"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: false,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",

    compatibleProtocols: ["chat.completion", "responses"],
    defaultProtocol: "chat.completion",
    capabilities: {
      supportsImages: true,
      supportsFiles: false,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",

    compatibleProtocols: ["chat.completion", "responses"],
    defaultProtocol: "responses",
    capabilities: {
      supportsImages: true,
      supportsFiles: false,
      supportedParams: RESPONSES_PARAMS,
    },
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",

    compatibleProtocols: ["chat.completion", "responses"],
    defaultProtocol: "responses",
    capabilities: {
      supportsImages: true,
      supportsFiles: false,
      supportedParams: RESPONSES_PARAMS,
    },
  },
  {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 Nano",

    compatibleProtocols: ["chat.completion", "responses"],
    defaultProtocol: "responses",
    capabilities: {
      supportsImages: false,
      supportsFiles: false,
      supportedParams: RESPONSES_PARAMS,
    },
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image Preview",
    compatibleProtocols: ["google"],
    defaultProtocol: "google",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: CHAT_PARAMS,
    },
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    compatibleProtocols: ["anthropic"],
    defaultProtocol: "anthropic",
    capabilities: {
      supportsImages: true,
      supportsFiles: true,
      supportedParams: ANTHROPIC_PARAMS,
    },
  },
];

const networkService = createLocalNetworkService();

function AppInner() {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const [pkState] = usePluginState<PKState>(PK_SLICE);

  const [sessionListState] =
    usePluginState<SessionListState>(SESSION_LIST_SLICE);

  // 等待 session-list 恢复完成后再创建默认窗口
  useEffect(() => {
    if (!sessionListState.restored) return;
    if (!orchState.activeWindowId) {
      kernel.orchestrator.createWindow("default");
    }
  }, [
    kernel.orchestrator,
    orchState.activeWindowId,
    sessionListState.restored,
  ]);

  // 统一用 windowIds 驱动：PK 模式多个窗口，普通模式单窗口
  const windowIds =
    pkState.windowIds.length > 0
      ? pkState.windowIds
      : orchState.activeWindowId
        ? [orchState.activeWindowId]
        : [];

  return (
    <div className="zenmux-app">
      <SlotRenderer slot="sidebar:left" />
      <div className="zenmux-app__main">
        <div className="zenmux-app__panels">
          {windowIds.map((wid, i) => (
            <div
              key={wid}
              className={cn(
                "zenmux-app__panel",
                i < windowIds.length - 1 && "zenmux-app__panel--bordered",
              )}
            >
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
    const k = createChatKernel({ defaultModel: MODELS[0].overrideModel! });
    // 注册业务插件
    k.plugins.register(
      createModelSelectorPlugin({
        providers: PROVIDERS,
        protocols: PROTOCOLS,
        models: MODELS,
      }),
    );
    k.plugins.register(FileUploadPlugin);
    k.plugins.register(BillingPlugin);
    k.plugins.register(RequestConfigPlugin);
    k.plugins.register(AutoScrollPlugin);
    k.plugins.register(MessageActionsPlugin);
    k.plugins.register(LogDetailsPlugin);
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
    k.plugins.register(
      createNetworkPlugin({
        service: networkService,
        autoRestore: false,
      }),
    );
    // SessionListPlugin 需在 NetworkPlugin 之后注册（依赖 'network' 服务）
    k.plugins.register(
      createSessionListPlugin({
        service: networkService,
      }),
    );
    k.boot();
    return k;
  }, []);

  return (
    <KernelProvider kernel={kernel}>
      <AppInner />
    </KernelProvider>
  );
}
