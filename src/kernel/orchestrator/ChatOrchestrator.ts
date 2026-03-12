import type { LanguageModel } from 'ai';
import type {
  ChatWindow,
  ChatMessage,
  ChatError,
  MessageAttachment,
  RequestLifecycleRegistry,
  RuntimeStateManager,
} from '../core/types';
import { executeAIRequest } from '../request/AIRequestPipeline';

export interface OrchestratorConfig {
  defaultModel: LanguageModel;
  lifecycleRegistry: RequestLifecycleRegistry;
  stateManager: RuntimeStateManager;
}

const ORCHESTRATOR_SLICE = 'core:orchestrator';

export interface OrchestratorState {
  windows: Record<string, ChatWindow>;
  activeWindowId: string | null;
}

const INITIAL_STATE: OrchestratorState = {
  windows: {},
  activeWindowId: null,
};

/**
 * 多窗口聊天编排器 —— 管理多个 chat window 的创建、消息发送、流式响应、中断。
 */
export function createChatOrchestrator(config: OrchestratorConfig) {
  const { defaultModel, lifecycleRegistry, stateManager } = config;

  // 注册 orchestrator 状态
  stateManager.registerSlice(ORCHESTRATOR_SLICE, INITIAL_STATE);

  function getState(): OrchestratorState {
    return stateManager.getSlice<OrchestratorState>(ORCHESTRATOR_SLICE);
  }

  function setState(updater: (prev: OrchestratorState) => OrchestratorState) {
    stateManager.setSlice(ORCHESTRATOR_SLICE, updater);
  }

  function updateWindow(windowId: string, patch: Partial<ChatWindow>) {
    setState((prev) => ({
      ...prev,
      windows: {
        ...prev.windows,
        [windowId]: { ...prev.windows[windowId], ...patch },
      },
    }));
  }

  // 流式更新节流：每帧最多触发一次 UI 更新，避免 useSyncExternalStore 嵌套更新超限
  let pendingStreamPatch: Record<string, Partial<ChatWindow>> = {};
  let rafId: number | null = null;

  function updateWindowThrottled(windowId: string, patch: Partial<ChatWindow>) {
    pendingStreamPatch[windowId] = {
      ...pendingStreamPatch[windowId],
      ...patch,
    };
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        const patches = pendingStreamPatch;
        pendingStreamPatch = {};
        rafId = null;
        for (const [wid, p] of Object.entries(patches)) {
          updateWindow(wid, p);
        }
      });
    }
  }

  return {
    /** 创建一个新的聊天窗口，可传入窗口级初始设置 */
    createWindow(windowId?: string, settings?: Partial<Pick<ChatWindow, 'modelId' | 'requestConfig' | 'billing'>>): string {
      const id = windowId ?? crypto.randomUUID();
      setState((prev) => ({
        ...prev,
        windows: {
          ...prev.windows,
          [id]: { id, messages: [], status: 'idle', ...settings },
        },
        activeWindowId: prev.activeWindowId ?? id,
      }));
      return id;
    },

    /** 切换活跃窗口 */
    setActiveWindow(windowId: string) {
      setState((prev) => ({ ...prev, activeWindowId: windowId }));
    },

    /** 获取窗口 */
    getWindow(windowId: string): ChatWindow | undefined {
      return getState().windows[windowId];
    },

    /** 更新窗口属性（浅合并） */
    updateWindow(windowId: string, patch: Partial<ChatWindow>) {
      updateWindow(windowId, patch);
    },

    /** 添加待发送附件 */
    addPendingAttachment(windowId: string, attachment: MessageAttachment) {
      const window = getState().windows[windowId];
      if (!window) return;
      updateWindow(windowId, {
        pendingAttachments: [...(window.pendingAttachments ?? []), attachment],
      });
    },

    /** 移除待发送附件 */
    removePendingAttachment(windowId: string, attachmentId: string) {
      const window = getState().windows[windowId];
      if (!window) return;
      updateWindow(windowId, {
        pendingAttachments: (window.pendingAttachments ?? []).filter((a) => a.id !== attachmentId),
      });
    },

    /** 发送用户消息并获取 AI 响应 */
    async sendMessage(windowId: string, content: string): Promise<void> {
      const window = getState().windows[windowId];
      if (!window) throw new Error(`Window "${windowId}" not found.`);

      // 消费 pending attachments
      const attachments = window.pendingAttachments?.length ? window.pendingAttachments : undefined;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
        attachments,
      };

      const abortController = new AbortController();

      updateWindow(windowId, {
        messages: [...window.messages, userMsg],
        status: 'streaming',
        error: undefined,
        abortController,
        pendingAttachments: [],  // 清空 pending
      });

      try {
        const allMessages = [...window.messages, userMsg];

        // 解析当前窗口使用的模型 ID
        const resolveModelId = (wid: string): string | undefined => {
          const w = getState().windows[wid];
          if (w?.modelId) return w.modelId;
          try {
            const ms = stateManager.getSlice<{ selectedModelId: string }>('modelSelector');
            return ms.selectedModelId;
          } catch { return undefined; }
        };

        const ensureAssistantMsg = (windowId: string) => {
          const current = getState().windows[windowId];
          const msgs = [...current.messages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.role === 'assistant') {
            if (!current.streamingMessageId) updateWindow(windowId, { streamingMessageId: lastMsg.id });
            return { msgs, assistant: lastMsg };
          }
          const newMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            modelId: resolveModelId(windowId),
          };
          msgs.push(newMsg);
          updateWindow(windowId, { streamingMessageId: newMsg.id });
          return { msgs, assistant: newMsg };
        };

        const { text: response, reasoning, responseContent, files, usage } = await executeAIRequest(
          { lifecycleRegistry, defaultModel },
          allMessages,
          abortController.signal,
          (_chunk, accumulated) => {
            const { msgs, assistant } = ensureAssistantMsg(windowId);
            msgs[msgs.length - 1] = { ...assistant, content: accumulated };
            updateWindowThrottled(windowId, { messages: msgs });
          },
          (_chunk, accumulatedReasoning) => {
            const { msgs, assistant } = ensureAssistantMsg(windowId);
            msgs[msgs.length - 1] = { ...assistant, reasoning: accumulatedReasoning };
            updateWindowThrottled(windowId, { messages: msgs });
          },
          (fileData) => {
            const { msgs, assistant } = ensureAssistantMsg(windowId);
            const existing = assistant.generatedFiles ?? [];
            msgs[msgs.length - 1] = { ...assistant, generatedFiles: [...existing, fileData] };
            updateWindow(windowId, { messages: msgs });
          },
          { windowId },
        );

        // 取消 pending 的 RAF，将流式数据 + 最终数据合并为一次原子更新
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        const pendingPatch = pendingStreamPatch[windowId];
        pendingStreamPatch = {};

        // 合并 pending 流式数据（如有）和当前 state
        const base = pendingPatch
          ? { ...getState().windows[windowId], ...pendingPatch }
          : getState().windows[windowId];
        const msgs = [...base.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.role === 'assistant') {
          msgs[msgs.length - 1] = { ...lastMsg, content: response, reasoning, responseContent, generatedFiles: files, usage };
        }

        updateWindow(windowId, {
          messages: msgs,
          status: 'idle',
          abortController: undefined,
          streamingMessageId: undefined,
        });
      } catch (error) {
        console.error('Error in sendMessage:', error);
        if ((error as Error).name === 'AbortError') {
          updateWindow(windowId, { status: 'idle', error: undefined, abortController: undefined, streamingMessageId: undefined });
        } else {
          const chatError = extractChatError(error);
          updateWindow(windowId, { status: 'error', error: chatError, abortController: undefined, streamingMessageId: undefined });
        }
      }
    },

    /** 重试指定 assistant 消息：原地更新，不影响后续消息 */
    async retryMessage(windowId: string, assistantMessageId: string): Promise<void> {
      const window = getState().windows[windowId];
      if (!window) throw new Error(`Window "${windowId}" not found.`);

      const msgIndex = window.messages.findIndex((m) => m.id === assistantMessageId);
      if (msgIndex < 0 || window.messages[msgIndex].role !== 'assistant') return;

      // 找到配对的 user 消息
      let userMsgIndex = msgIndex - 1;
      while (userMsgIndex >= 0 && window.messages[userMsgIndex].role !== 'user') {
        userMsgIndex--;
      }
      if (userMsgIndex < 0) return;

      // 发送给 AI 的消息：从开头到 user 消息（含）
      const messagesForAI = window.messages.slice(0, userMsgIndex + 1);
      const abortController = new AbortController();

      const resolveModelId = (wid: string): string | undefined => {
        const w = getState().windows[wid];
        if (w?.modelId) return w.modelId;
        try {
          const ms = stateManager.getSlice<{ selectedModelId: string }>('modelSelector');
          return ms.selectedModelId;
        } catch { return undefined; }
      };

      // 清空 assistant 消息内容，进入 streaming 状态，更新 modelId 为当前选择
      const resetAssistant: ChatMessage = {
        ...window.messages[msgIndex],
        content: '',
        reasoning: undefined,
        responseContent: undefined,
        generatedFiles: undefined,
        usage: undefined,
        modelId: resolveModelId(windowId),
      };
      const msgs = [...window.messages];
      msgs[msgIndex] = resetAssistant;
      updateWindow(windowId, { messages: msgs, status: 'streaming', error: undefined, abortController, streamingMessageId: assistantMessageId });

      try {

        // 获取当前 assistant 消息在 messages 数组中的位置（流式更新用）
        const getAssistantInPlace = () => {
          const current = getState().windows[windowId];
          const currentMsgs = [...current.messages];
          const idx = currentMsgs.findIndex((m) => m.id === assistantMessageId);
          return { msgs: currentMsgs, assistant: currentMsgs[idx], idx };
        };

        const { text: response, reasoning, responseContent, files, usage } = await executeAIRequest(
          { lifecycleRegistry, defaultModel },
          messagesForAI,
          abortController.signal,
          (_chunk, accumulated) => {
            const { msgs, assistant, idx } = getAssistantInPlace();
            msgs[idx] = { ...assistant, content: accumulated, modelId: assistant.modelId ?? resolveModelId(windowId) };
            updateWindowThrottled(windowId, { messages: msgs });
          },
          (_chunk, accumulatedReasoning) => {
            const { msgs, assistant, idx } = getAssistantInPlace();
            msgs[idx] = { ...assistant, reasoning: accumulatedReasoning };
            updateWindowThrottled(windowId, { messages: msgs });
          },
          (fileData) => {
            const { msgs, assistant, idx } = getAssistantInPlace();
            const existing = assistant.generatedFiles ?? [];
            msgs[idx] = { ...assistant, generatedFiles: [...existing, fileData] };
            updateWindow(windowId, { messages: msgs });
          },
          { windowId },
        );

        // 取消 pending RAF，合并最终数据
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        const pendingPatch = pendingStreamPatch[windowId];
        pendingStreamPatch = {};

        const base = pendingPatch
          ? { ...getState().windows[windowId], ...pendingPatch }
          : getState().windows[windowId];
        const finalMsgs = [...base.messages];
        const finalIdx = finalMsgs.findIndex((m) => m.id === assistantMessageId);
        if (finalIdx >= 0) {
          finalMsgs[finalIdx] = { ...finalMsgs[finalIdx], content: response, reasoning, responseContent, generatedFiles: files, usage };
        }

        updateWindow(windowId, { messages: finalMsgs, status: 'idle', abortController: undefined, streamingMessageId: undefined });
      } catch (error) {
        console.error('Error in retryMessage:', error);
        if ((error as Error).name === 'AbortError') {
          updateWindow(windowId, { status: 'idle', error: undefined, abortController: undefined, streamingMessageId: undefined });
        } else {
          const chatError = extractChatError(error);
          updateWindow(windowId, { status: 'error', error: chatError, abortController: undefined, streamingMessageId: undefined });
        }
      }
    },

    /** 中断指定窗口的请求 */
    abort(windowId: string) {
      const window = getState().windows[windowId];
      window?.abortController?.abort();
    },

    /** 向多个窗口广播同一条消息 */
    async broadcast(windowIds: string[], content: string): Promise<void> {
      await Promise.all(
        windowIds.map((id) => this.sendMessage(id, content)),
      );
    },

    /** 移除指定窗口（中断请求后从状态中删除） */
    removeWindow(windowId: string) {
      const window = getState().windows[windowId];
      window?.abortController?.abort();
      setState((prev) => {
        const { [windowId]: _, ...remaining } = prev.windows;
        return {
          ...prev,
          windows: remaining,
          activeWindowId: prev.activeWindowId === windowId
            ? Object.keys(remaining)[0] ?? null
            : prev.activeWindowId,
        };
      });
    },

    /** 清空所有窗口（中断所有请求，重置为初始状态） */
    clearAllWindows() {
      const current = getState();
      for (const w of Object.values(current.windows)) {
        w.abortController?.abort();
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingStreamPatch = {};
      setState(() => INITIAL_STATE);
    },

    /** 订阅 orchestrator 状态变化 */
    subscribe(listener: (state: OrchestratorState) => void) {
      return stateManager.subscribe<OrchestratorState>(ORCHESTRATOR_SLICE, listener);
    },
  };
}

/**
 * 从错误对象中提取结构化字段（statusCode / responseBody / requestId 等）。
 * 适用于 AI SDK 的 APICallError 等带有额外属性的 Error。
 */
function extractFieldsFromError(err: Record<string, unknown>, target: ChatError) {
  if (!target.statusCode && typeof err.statusCode === 'number') {
    target.statusCode = err.statusCode;
  }
  if (!target.responseBody && typeof err.responseBody === 'string') {
    target.responseBody = err.responseBody;
  }
  if (!target.requestId) {
    if (typeof err.requestId === 'string') {
      target.requestId = err.requestId;
    } else if (err.responseHeaders && typeof err.responseHeaders === 'object') {
      const headers = err.responseHeaders as Record<string, string>;
      target.requestId = headers['x-request-id'] ?? headers['request-id'];
    }
  }
}

/**
 * 从各种错误对象中提取结构化的调试信息。
 * 兼容 AI SDK 的 APICallError、NoOutputGeneratedError 等包装类型。
 * 会沿 cause 链向下查找，直到找到真正包含详细信息的错误。
 */
function extractChatError(error: unknown): ChatError {
  const timestamp = Date.now();

  if (!(error instanceof Error)) {
    return { message: String(error), errorType: 'Unknown', timestamp };
  }

  const chatError: ChatError = {
    message: error.message,
    errorType: error.constructor.name !== 'Error' ? error.constructor.name : error.name,
    timestamp,
  };

  // 从当前错误提取字段
  extractFieldsFromError(error as unknown as Record<string, unknown>, chatError);

  // 沿 cause 链向下查找更具体的错误信息（最多 5 层防止死循环）
  let current: unknown = (error as unknown as Record<string, unknown>).cause;
  let depth = 0;
  while (current instanceof Error && depth < 5) {
    const causeRecord = current as unknown as Record<string, unknown>;
    extractFieldsFromError(causeRecord, chatError);

    // 如果 cause 有更具体的错误消息且当前消息过于泛化，替换之
    if (chatError.statusCode && !chatError.message.includes(String(chatError.statusCode))) {
      chatError.message = current.message;
      chatError.errorType = current.constructor.name !== 'Error' ? current.constructor.name : current.name;
    }

    current = causeRecord.cause;
    depth++;
  }

  return chatError;
}

export type ChatOrchestratorInstance = ReturnType<typeof createChatOrchestrator>;
