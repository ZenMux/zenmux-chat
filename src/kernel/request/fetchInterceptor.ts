/**
 * 可拦截请求/响应的 fetch 包装器，支持并发请求隔离。
 *
 * 通过 x-pipeline-request-id 请求头关联每个 fetch 调用与注册的监听器，
 * 解决 PK 模式下多个并发请求共享同一 fetch 函数时的竞态问题。
 *
 * 用法：
 * 1. 调用 createFetchInterceptor() 创建实例
 * 2. 将 interceptor.fetch 传给所有 provider 的 fetch 选项
 * 3. 每次请求前调用 register(requestId, listeners)
 * 4. 请求结束后调用 unregister(requestId)
 */

/** 管道注入的请求头，用于关联 fetch 调用与注册的监听器（发送前自动移除） */
export const PIPELINE_REQUEST_ID_HEADER = 'x-pipeline-request-id';

export interface RequestInterceptorListeners {
  /** fetch 发出前触发，可修改 headers 和 body */
  onRequest?: (ctx: { url: string; method: string; headers: Record<string, string>; body?: string | null }) => Promise<void> | void;
  /** 响应头到达时立即触发 */
  onResponse?: (headers: Record<string, string>) => void;
}

export interface FetchInterceptor {
  /** 传给 provider 的稳定 fetch 函数 */
  fetch: typeof globalThis.fetch;
  /** 注册请求级监听器（按 requestId 隔离，支持并发） */
  register(requestId: string, listeners: RequestInterceptorListeners): void;
  /** 注销请求级监听器 */
  unregister(requestId: string): void;
}

export function createFetchInterceptor(): FetchInterceptor {
  const listenerMap = new Map<string, RequestInterceptorListeners>();

  const wrappedFetch: typeof globalThis.fetch = async (input, init) => {
    // ── 提取 headers，查找管道请求 ID ──
    const currentHeaders: Record<string, string> = {};
    const initHeaders = init?.headers;
    if (initHeaders instanceof Headers) {
      initHeaders.forEach((v, k) => { currentHeaders[k.toLowerCase()] = v; });
    } else if (Array.isArray(initHeaders)) {
      for (const [k, v] of initHeaders) { currentHeaders[k.toLowerCase()] = v; }
    } else if (initHeaders && typeof initHeaders === 'object') {
      for (const [k, v] of Object.entries(initHeaders)) { currentHeaders[k.toLowerCase()] = v; }
    }

    const pipelineRequestId = currentHeaders[PIPELINE_REQUEST_ID_HEADER];

    // 非管道请求，直接透传
    if (!pipelineRequestId) {
      return globalThis.fetch(input, init);
    }

    // 移除内部标记头（不发送到服务端）
    delete currentHeaders[PIPELINE_REQUEST_ID_HEADER];
    const listeners = listenerMap.get(pipelineRequestId);

    // ── 请求拦截 ──
    if (listeners?.onRequest) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

      const rawBody = init?.body;
      const reqCtx: { url: string; method: string; headers: Record<string, string>; body?: string | null } = {
        url,
        method,
        headers: currentHeaders,
        body: typeof rawBody === 'string' ? rawBody : (rawBody == null ? null : undefined),
      };

      await listeners.onRequest(reqCtx);

      // 将修改后的 headers 和 body 写回 init
      init = { ...init, headers: currentHeaders };
      if (reqCtx.body !== undefined && typeof reqCtx.body === 'string') {
        init = { ...init, body: reqCtx.body };
      }
    } else {
      // 无 onRequest 监听器但仍需写回去掉标记头的 headers
      init = { ...init, headers: currentHeaders };
    }

    const response = await globalThis.fetch(input, init);

    // ── 响应头拦截 ──
    if (listeners?.onResponse) {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      listeners.onResponse(headers);
    }

    return response;
  };

  return {
    fetch: wrappedFetch,
    register(requestId, listeners) {
      listenerMap.set(requestId, listeners);
    },
    unregister(requestId) {
      listenerMap.delete(requestId);
    },
  };
}
