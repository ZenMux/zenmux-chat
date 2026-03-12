import { wrapLanguageModel } from 'ai';
import type { LanguageModel, LanguageModelMiddleware } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';

/**
 * Chat Completions reasoning 提取中间件。
 *
 * @ai-sdk/openai 的 Chat Completions 实现不解析 SSE chunk 中的
 * `delta.reasoning_content` 字段（Zod schema 会将其丢弃）。
 * 本中间件通过 `includeRawChunks` 获取原始 JSON，从中提取 reasoning_content
 * 并注入 reasoning-start / reasoning-delta / reasoning-end 事件。
 */
const chatCompletionReasoningMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',

  transformParams: async ({ params }) => ({
    ...params,
    includeRawChunks: true,
  }),

  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();

    let reasoningStarted = false;

    return {
      stream: stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            // 从 raw chunk 中提取 reasoning_content
            if (chunk.type === 'raw') {
              const raw = chunk.rawValue as any;
              const delta = raw?.choices?.[0]?.delta;
              const reasoningContent =
                delta?.reasoning_content ?? delta?.reasoning;
              if (reasoningContent) {
                if (!reasoningStarted) {
                  reasoningStarted = true;
                  controller.enqueue({
                    type: 'reasoning-start' as const,
                    id: 'reasoning-0',
                  });
                }
                controller.enqueue({
                  type: 'reasoning-delta' as const,
                  id: 'reasoning-0',
                  delta: reasoningContent,
                });
              }
              // 不向下传递 raw 事件
              return;
            }

            // 在 finish 事件前关闭 reasoning
            if (chunk.type === 'finish' && reasoningStarted) {
              controller.enqueue({
                type: 'reasoning-end' as const,
                id: 'reasoning-0',
              });
            }

            controller.enqueue(chunk);
          },
        }),
      ),
      ...rest,
    };
  },
};

/**
 * 包装 Chat Completions 模型，使其支持 reasoning_content 展示。
 */
export function withReasoningSupport(model: LanguageModel): LanguageModel {
  return wrapLanguageModel({
    model: model as LanguageModelV3,
    middleware: chatCompletionReasoningMiddleware,
  });
}
