import { streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type {
  RequestLifecycleRegistry,
  RequestContext,
  FinalizeRequestContext,
  StreamContext,
  ResponseContext,
  ResponseHeadersContext,
  ErrorContext,
  ChatMessage,
  TokenUsage,
  AICallParams,
  GeneratedFileData,
} from '../core/types';
import { PIPELINE_REQUEST_ID_HEADER, type FetchInterceptor } from './fetchInterceptor';

export interface AIRequestPipelineOptions {
  lifecycleRegistry: RequestLifecycleRegistry;
  defaultModel: LanguageModel;
  fetchInterceptor: FetchInterceptor;
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
  /** onResponseHeaders 钩子提取的 extras，通过此回调尽早写入消息 */
  onEarlyExtras?: (extras: Record<string, unknown>) => void,
): Promise<{ text: string; reasoning?: string; responseContent?: Array<Record<string, unknown>>; files?: GeneratedFileData[]; usage?: TokenUsage; extras?: Record<string, unknown> }> {
  const { lifecycleRegistry, defaultModel, fetchInterceptor } = options;
  const allHooks = lifecycleRegistry.getHooks();
  const requestId = crypto.randomUUID();
  const windowId = initialMetadata?.windowId as string | undefined;

  // ── 1. Build request context ──
  const ctx: RequestContext = {
    requestId,
    windowId,
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

  // ── 4. 执行请求 ──

  // ── 4a. 如果插件设置了 customExecutor，跳过 streamText 直接使用自定义执行器 ──
  if (ctx.customExecutor) {
    try {
      const result = await ctx.customExecutor({
        requestId: ctx.requestId,
        windowId,
        messages: ctx.messages,
        params: ctx.params,
        metadata: ctx.metadata,
        signal: ctx.signal,
        onChunk,
        onReasoningChunk,
        onFile,
      });

      // 仍然执行 onAfterResponse 钩子（billing、log-details 等插件需要）
      const responseCtx: ResponseContext = {
        requestId,
        windowId,
        metadata: ctx.metadata,
        messages: ctx.messages,
        response: result.text,
        usage: result.usage,
        extras: result.extras,
      };
      for (const { hooks } of allHooks) {
        await hooks.onAfterResponse?.(responseCtx);
      }

      return {
        text: result.text,
        reasoning: result.reasoning,
        responseContent: result.responseContent,
        files: result.files,
        usage: result.usage,
        extras: responseCtx.extras,
      };
    } catch (error) {
      const errorCtx: ErrorContext = {
        requestId,
        windowId,
        metadata: ctx.metadata,
        error: error instanceof Error ? error : new Error(String(error)),
        retryCount: 0,
      };
      for (const { hooks } of allHooks) {
        await hooks.onRequestError?.(errorCtx);
      }
      throw error;
    }
  }

  // ── 4b. 默认路径：调用 AI SDK streamText ──
  // params 由插件自由设置，pipeline 只覆盖 model / messages / abortSignal
  let accumulated = '';
  let accumulatedReasoning = '';
  const collectedFiles: GeneratedFileData[] = [];
  const startTime = performance.now();
  let firstTokenTime: number | undefined;
  let earlyExtras: Record<string, unknown> | undefined;

  // ── 注入管道请求 ID 到 headers，用于 fetch 拦截器关联并发请求 ──
  ctx.params.headers = {
    ...ctx.params.headers,
    [PIPELINE_REQUEST_ID_HEADER]: requestId,
  };

  try {
    // ── 注册请求级 fetch 拦截监听器（按 requestId 隔离，支持 PK 并发） ──
    fetchInterceptor.register(requestId, {
      onRequest: async (reqCtx) => {
        const finalizeCtx: FinalizeRequestContext = {
          requestId,
          windowId,
          metadata: ctx.metadata,
          url: reqCtx.url,
          method: reqCtx.method,
          headers: reqCtx.headers,
          body: reqCtx.body,
        };
        for (const { hooks } of allHooks) {
          await hooks.onFinalizeRequest?.(finalizeCtx);
        }
        // 将插件修改的 body 写回 reqCtx
        reqCtx.body = finalizeCtx.body;
      },
      onResponse: (headers) => {
        if (Object.keys(headers).length > 0) {
          const headersCtx: ResponseHeadersContext = { requestId, windowId, metadata: ctx.metadata, headers };
          for (const { hooks } of allHooks) {
            hooks.onResponseHeaders?.(headersCtx);
          }
          if (headersCtx.extras) {
            earlyExtras = headersCtx.extras;
            onEarlyExtras?.(headersCtx.extras);
          }
        }
      },
    });

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
        if (firstTokenTime === undefined) firstTokenTime = performance.now();
        accumulated += part.text;

        const streamCtx: StreamContext = { requestId, windowId, metadata: ctx.metadata, chunk: part.text, accumulated };
        for (const { hooks } of allHooks) {
          await hooks.onStreamChunk?.(streamCtx);
        }

        onChunk?.(part.text, accumulated);
      } else if (part.type === 'reasoning-delta') {
        if (firstTokenTime === undefined) firstTokenTime = performance.now();
        accumulatedReasoning += part.text;
        onReasoningChunk?.(part.text, accumulatedReasoning);

        // 触发 onStreamChunk 以便 auto-scroll 等插件能感知 reasoning 阶段的更新
        const streamCtx: StreamContext = { requestId, windowId, metadata: ctx.metadata, chunk: part.text, accumulated: accumulatedReasoning };
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

    const endTime = performance.now();
    const usage: TokenUsage | undefined = rawUsage
      ? {
          inputTokens: rawUsage.inputTokens,
          outputTokens: rawUsage.outputTokens,
          latencyMs: firstTokenTime !== undefined ? Math.round(firstTokenTime - startTime) : undefined,
          totalMs: Math.round(endTime - startTime),
        }
      : undefined;

    // ── 7. onAfterResponse ──
    const responseCtx: ResponseContext = {
      requestId,
      windowId,
      metadata: ctx.metadata,
      messages: ctx.messages,
      response: finalText,
      usage,
      extras: earlyExtras,
    };
    for (const { hooks } of allHooks) {
      await hooks.onAfterResponse?.(responseCtx);
    }

    fetchInterceptor.unregister(requestId);
    return { text: finalText, reasoning: accumulatedReasoning || undefined, responseContent, files: collectedFiles.length ? collectedFiles : undefined, usage, extras: responseCtx.extras };
  } catch (error) {
    // ── 8. onRequestError ──
    const errorCtx: ErrorContext = {
      requestId,
      windowId,
      metadata: ctx.metadata,
      error: error instanceof Error ? error : new Error(String(error)),
      retryCount: 0,
    };
    for (const { hooks } of allHooks) {
      await hooks.onRequestError?.(errorCtx);
    }
    fetchInterceptor.unregister(requestId);
    throw error;
  }
}
