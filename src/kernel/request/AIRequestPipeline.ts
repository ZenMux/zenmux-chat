import { streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type {
  RequestLifecycleRegistry,
  RequestContext,
  StreamContext,
  ResponseContext,
  ErrorContext,
  ChatMessage,
  TokenUsage,
  AICallParams,
  GeneratedFileData,
} from '../core/types';

export interface AIRequestPipelineOptions {
  lifecycleRegistry: RequestLifecycleRegistry;
  defaultModel: LanguageModel;
}

/**
 * AI 请求管道 —— 管理请求的完整生命周期，
 * 在各阶段调用所有已注册插件的 hooks，最终通过 AI SDK streamText 发起请求。
 */
export async function executeAIRequest(
  options: AIRequestPipelineOptions,
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk?: (chunk: string, accumulated: string) => void,
  onReasoningChunk?: (chunk: string, accumulated: string) => void,
  onFile?: (file: GeneratedFileData) => void,
  initialMetadata?: Record<string, unknown>,
): Promise<{ text: string; reasoning?: string; responseContent?: Array<Record<string, unknown>>; files?: GeneratedFileData[]; usage?: TokenUsage }> {
  const { lifecycleRegistry, defaultModel } = options;
  const allHooks = lifecycleRegistry.getHooks();
  const requestId = crypto.randomUUID();

  // ── 1. Build request context ──
  const ctx: RequestContext = {
    requestId,
    messages,
    params: {
      model: defaultModel,
    },
    metadata: { ...initialMetadata },
    signal,
  };

  // ── 2. onBuildRequest —— 插件注入/修改 AI SDK 参数 ──
  for (const { hooks } of allHooks) {
    await hooks.onBuildRequest?.(ctx);
  }

  // ── 3. onBeforeSend —— 最后的拦截机会 ──
  for (const { hooks } of allHooks) {
    await hooks.onBeforeSend?.(ctx);
  }

  // ── 4. 调用 AI SDK streamText ──
  // params 由插件自由设置，pipeline 只覆盖 model / messages / abortSignal
  let accumulated = '';
  let accumulatedReasoning = '';
  const collectedFiles: GeneratedFileData[] = [];

  try {
    // 剥离 pipeline 管理的字段，剩余的全部透传给 streamText
    const { model, prompt: _prompt, ...restParams } = ctx.params as AICallParams;
    const result = streamText({
      ...restParams,
      model: model ?? defaultModel,
      messages: ctx.messages.map((m) => {
        // 有附件的 user 消息转为多模态 content
        if (m.role === 'user' && m.attachments?.length) {
          const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mediaType?: string } | { type: 'file'; data: string; mediaType: string; filename?: string }> = [
            { type: 'text', text: m.content },
          ];
          for (const att of m.attachments) {
            if (att.mediaType.startsWith('image/')) {
              parts.push({ type: 'image', image: att.data, mediaType: att.mediaType });
            } else {
              parts.push({ type: 'file', data: att.data, mediaType: att.mediaType, filename: att.name });
            }
          }
          return { role: m.role, content: parts };
        }
        // assistant 消息：优先使用 AI SDK 原始 responseContent（含 providerOptions / thoughtSignature）
        if (m.role === 'assistant' && m.responseContent?.length) {
          return { role: m.role, content: m.responseContent as any };
        }
        // assistant 消息：fallback —— 手动拼装生成文件
        if (m.role === 'assistant' && m.generatedFiles?.length) {
          const parts: Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string }> = [];
          if (m.content) {
            parts.push({ type: 'text', text: m.content });
          }
          for (const file of m.generatedFiles) {
            parts.push({ type: 'file', data: file.base64, mediaType: file.mediaType });
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      }),
      abortSignal: ctx.signal,
    });

    // ── 5. 消费 fullStream（比 textStream 能捕获 error 事件） ──
    let streamError: Error | undefined;

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        accumulated += part.text;

        const streamCtx: StreamContext = { requestId, chunk: part.text, accumulated };
        for (const { hooks } of allHooks) {
          await hooks.onStreamChunk?.(streamCtx);
        }

        onChunk?.(part.text, accumulated);
      } else if (part.type === 'reasoning-delta') {
        accumulatedReasoning += part.text;
        onReasoningChunk?.(part.text, accumulatedReasoning);

        // 触发 onStreamChunk 以便 auto-scroll 等插件能感知 reasoning 阶段的更新
        const streamCtx: StreamContext = { requestId, chunk: part.text, accumulated: accumulatedReasoning };
        for (const { hooks } of allHooks) {
          await hooks.onStreamChunk?.(streamCtx);
        }
      } else if (part.type === 'file') {
        const fileData: GeneratedFileData = {
          base64: part.file.base64,
          mediaType: part.file.mediaType,
        };
        collectedFiles.push(fileData);
        onFile?.(fileData);
      } else if (part.type === 'error') {
        // 捕获流中的错误（如 APICallError），稍后抛出
        streamError = part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }

    // 如果流中出现了错误，直接抛出原始错误（而非让 result.text 抛出泛化的 NoOutputGeneratedError）
    if (streamError) {
      throw streamError;
    }

    // ── 6. 获取最终结果 ──
    const finalText = accumulated || await result.text;
    const rawUsage = await result.usage;

    // 获取 AI SDK 响应的原始 content parts（含 providerOptions，用于回传 thoughtSignature 等）
    const responseData = await result.response;
    const assistantMsg = responseData.messages?.find((msg) => msg.role === 'assistant');
    const responseContent = assistantMsg && Array.isArray(assistantMsg.content)
      ? (assistantMsg.content as Array<Record<string, unknown>>)
      : undefined;

    const usage: TokenUsage | undefined = rawUsage
      ? {
          inputTokens: rawUsage.inputTokens,
          outputTokens: rawUsage.outputTokens,
        }
      : undefined;

    // ── 7. onAfterResponse ──
    const responseCtx: ResponseContext = {
      requestId,
      messages: ctx.messages,
      response: finalText,
      usage,
    };
    for (const { hooks } of allHooks) {
      await hooks.onAfterResponse?.(responseCtx);
    }

    return { text: finalText, reasoning: accumulatedReasoning || undefined, responseContent, files: collectedFiles.length ? collectedFiles : undefined, usage };
  } catch (error) {
    // ── 8. onRequestError ──
    const errorCtx: ErrorContext = {
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
      retryCount: 0,
    };
    for (const { hooks } of allHooks) {
      await hooks.onRequestError?.(errorCtx);
    }
    throw error;
  }
}
