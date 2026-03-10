/**
 * Mock 模型 —— 使用 AI SDK 测试工具模拟流式响应，避免消耗真实 token。
 * 从 mock-response.ts 读取预录的 grok-4.2-fast 响应数据。
 */
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { MOCK_RESPONSE } from './mock-response';

function buildChunks(): LanguageModelV3StreamPart[] {
  const textId = 'text-0';
  const chunkSize = 20;
  const parts: LanguageModelV3StreamPart[] = [];

  parts.push({ type: 'text-start', id: textId });

  for (let i = 0; i < MOCK_RESPONSE.length; i += chunkSize) {
    parts.push({
      type: 'text-delta',
      id: textId,
      delta: MOCK_RESPONSE.slice(i, i + chunkSize),
    });
  }

  parts.push({ type: 'text-end', id: textId });
  parts.push({
    type: 'finish',
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 1544, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 3877, text: undefined, reasoning: undefined },
    },
  });

  return parts;
}

export const mockModel = new MockLanguageModelV3({
  provider: 'mock',
  modelId: 'x-ai/grok-4.2-fast-mock',
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 15,
      chunks: buildChunks(),
    }),
  }),
});
