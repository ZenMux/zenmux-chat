import type { ChatMessage } from '@kernel/core/types';
import type {
  NetworkService,
  NetworkMessage,
  NetworkAttachment,
  NetworkGeneratedFile,
  ResponseContentBlobRef,
} from './types';

// ─── 已知的二进制字段路径模式 ────────────────────────────────────

const KNOWN_BLOB_PATHS = [
  'providerOptions.openai.thoughtSignature',
  'providerOptions.google.thoughtSignature',
  'providerOptions.anthropic.thoughtSignature',
];

/** 大于此阈值的字符串会被检查是否为 base64 */
const BASE64_THRESHOLD = 10240; // 10KB

// ─── 工具函数 ───────────────────────────────────────────────────

function base64ToBlob(base64: string, mediaType: string): Blob {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mediaType });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** 按点分路径读取嵌套对象属性 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** 按点分路径设置嵌套对象属性 */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

/** 快速检查字符串是否像 base64（只检查前 200 字符避免性能问题） */
function isLikelyBase64(str: string): boolean {
  if (str.length < BASE64_THRESHOLD) return false;
  return /^[A-Za-z0-9+/\n\r]+=*$/.test(str.slice(0, 200));
}

// ─── Serializer 工厂 ────────────────────────────────────────────

export function createNetworkSerializer(service: NetworkService) {

  /**
   * 深度扫描对象，找出所有大的 base64 字符串字段。
   * 除已知路径外，还会启发式扫描未知的大字符串。
   */
  async function scanAndUploadBlobs(
    entry: Record<string, unknown>,
    index: number,
    messageId: string,
    windowId: string,
    blobRefs: ResponseContentBlobRef[],
    visitedPaths: Set<string>,
  ): Promise<void> {
    const stack: Array<{ obj: Record<string, unknown>; prefix: string }> = [
      { obj: entry, prefix: '' },
    ];

    while (stack.length > 0) {
      const { obj, prefix } = stack.pop()!;
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (visitedPaths.has(path)) continue;

        if (typeof val === 'string' && isLikelyBase64(val)) {
          visitedPaths.add(path);
          const blob = base64ToBlob(val, 'application/octet-stream');
          const url = await service.uploadBlob(blob, {
            source: 'response-content',
            mediaType: 'application/octet-stream',
            messageId,
            windowId,
          });
          setByPath(entry, path, '');
          blobRefs.push({ index, path, url, mediaType: 'application/octet-stream' });
        } else if (val != null && typeof val === 'object' && !Array.isArray(val)) {
          stack.push({ obj: val as Record<string, unknown>, prefix: path });
        }
      }
    }
  }

  /**
   * 序列化 responseContent：上传已知路径的 blob + 启发式扫描未知大字符串
   */
  async function serializeResponseContent(
    content: Array<Record<string, unknown>>,
    messageId: string,
    windowId: string,
  ): Promise<{ content: Array<Record<string, unknown>>; blobRefs: ResponseContentBlobRef[] }> {
    const cloned = structuredClone(content);
    const blobRefs: ResponseContentBlobRef[] = [];

    for (let i = 0; i < cloned.length; i++) {
      const entry = cloned[i];
      const visitedPaths = new Set<string>();

      // 1. 先处理已知路径
      for (const path of KNOWN_BLOB_PATHS) {
        const value = getByPath(entry, path);
        if (typeof value === 'string' && value.length > 0) {
          visitedPaths.add(path);
          const blob = base64ToBlob(value, 'application/octet-stream');
          const url = await service.uploadBlob(blob, {
            source: 'response-content',
            mediaType: 'application/octet-stream',
            messageId,
            windowId,
          });
          setByPath(entry, path, '');
          blobRefs.push({ index: i, path, url, mediaType: 'application/octet-stream' });
        }
      }

      // 2. 启发式扫描未知大 base64 字符串
      await scanAndUploadBlobs(entry, i, messageId, windowId, blobRefs, visitedPaths);
    }

    return { content: cloned, blobRefs };
  }

  /**
   * 反序列化 responseContent：根据 blobRefs 下载并注入回原始路径
   */
  async function deserializeResponseContent(
    content: Array<Record<string, unknown>>,
    blobRefs?: ResponseContentBlobRef[],
  ): Promise<Array<Record<string, unknown>>> {
    if (!blobRefs?.length) return content;
    const cloned = structuredClone(content);

    await Promise.all(
      blobRefs.map(async (ref) => {
        const blob = await service.downloadBlob(ref.url);
        const base64 = await blobToBase64(blob);
        setByPath(cloned[ref.index], ref.path, base64);
      }),
    );

    return cloned;
  }

  // ─── 公共 API ──────────────────────────────────────────────────

  /**
   * 序列化 ChatMessage → NetworkMessage，上传所有二进制数据为 URL
   */
  async function serializeMessage(msg: ChatMessage, windowId: string): Promise<NetworkMessage> {
    const networkMsg: NetworkMessage = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      usage: msg.usage,
      reasoning: msg.reasoning,
      modelId: msg.modelId,
      extras: msg.extras,
    };

    // 1. attachments: base64 → URL
    if (msg.attachments?.length) {
      networkMsg.attachments = await Promise.all(
        msg.attachments.map(async (att): Promise<NetworkAttachment> => {
          const blob = base64ToBlob(att.data, att.mediaType);
          const url = await service.uploadBlob(blob, {
            source: 'attachment',
            mediaType: att.mediaType,
            messageId: msg.id,
            windowId,
            filename: att.name,
          });
          return { id: att.id, name: att.name, mediaType: att.mediaType, url };
        }),
      );
    }

    // 2. generatedFiles: base64 → URL
    if (msg.generatedFiles?.length) {
      networkMsg.generatedFiles = await Promise.all(
        msg.generatedFiles.map(async (file): Promise<NetworkGeneratedFile> => {
          const blob = base64ToBlob(file.base64, file.mediaType);
          const url = await service.uploadBlob(blob, {
            source: 'generated-file',
            mediaType: file.mediaType,
            messageId: msg.id,
            windowId,
          });
          return { url, mediaType: file.mediaType };
        }),
      );
    }

    // 3. responseContent: 深度扫描 blob 字段，上传后记录引用
    if (msg.responseContent?.length) {
      const { content, blobRefs } = await serializeResponseContent(
        msg.responseContent,
        msg.id,
        windowId,
      );
      networkMsg.responseContent = content;
      if (blobRefs.length > 0) {
        networkMsg.responseContentBlobRefs = blobRefs;
      }
    }

    return networkMsg;
  }

  /**
   * 反序列化 NetworkMessage → ChatMessage，下载所有 URL 还原为 base64。
   * 单条消息失败时降级返回纯文本消息。
   */
  async function deserializeMessage(networkMsg: NetworkMessage): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: networkMsg.id,
      role: networkMsg.role,
      content: networkMsg.content,
      timestamp: networkMsg.timestamp,
      usage: networkMsg.usage,
      reasoning: networkMsg.reasoning,
      modelId: networkMsg.modelId,
      extras: networkMsg.extras,
    };

    // 1. attachments: URL → base64
    if (networkMsg.attachments?.length) {
      msg.attachments = await Promise.all(
        networkMsg.attachments.map(async (att) => {
          const blob = await service.downloadBlob(att.url);
          const base64 = await blobToBase64(blob);
          return { id: att.id, name: att.name, mediaType: att.mediaType, data: base64 };
        }),
      );
    }

    // 2. generatedFiles: URL → base64
    if (networkMsg.generatedFiles?.length) {
      msg.generatedFiles = await Promise.all(
        networkMsg.generatedFiles.map(async (file) => {
          const blob = await service.downloadBlob(file.url);
          const base64 = await blobToBase64(blob);
          return { base64, mediaType: file.mediaType };
        }),
      );
    }

    // 3. responseContent: 根据 blobRefs 还原
    if (networkMsg.responseContent?.length) {
      msg.responseContent = await deserializeResponseContent(
        networkMsg.responseContent,
        networkMsg.responseContentBlobRefs,
      );
    }

    return msg;
  }

  /**
   * 安全反序列化 — 单条失败降级为纯文本消息
   */
  async function deserializeMessageSafe(networkMsg: NetworkMessage): Promise<ChatMessage> {
    try {
      return await deserializeMessage(networkMsg);
    } catch (err) {
      console.warn(`[NetworkPlugin] 反序列化消息 ${networkMsg.id} 失败，降级为纯文本:`, err);
      return {
        id: networkMsg.id,
        role: networkMsg.role,
        content: networkMsg.content,
        timestamp: networkMsg.timestamp,
        reasoning: networkMsg.reasoning,
        usage: networkMsg.usage,
        modelId: networkMsg.modelId,
        extras: networkMsg.extras,
      };
    }
  }

  return { serializeMessage, deserializeMessage, deserializeMessageSafe };
}

export type NetworkSerializerInstance = ReturnType<typeof createNetworkSerializer>;
