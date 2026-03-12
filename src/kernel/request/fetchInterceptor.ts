/**
 * 可拦截响应头的 fetch 包装器。
 *
 * 创建一个稳定的 fetch 函数，在每次 HTTP 响应到达时（流开始前），
 * 调用当前设置的 onHeaders 回调，让管道能尽早获取响应头。
 *
 * 用法：
 * 1. 调用 createFetchInterceptor() 创建实例
 * 2. 将 interceptor.fetch 传给所有 provider 的 fetch 选项
 * 3. 每次请求前调用 interceptor.setHeadersListener(callback)
 * 4. 请求结束后调用 interceptor.clearHeadersListener()
 */

export interface FetchInterceptor {
  /** 传给 provider 的稳定 fetch 函数 */
  fetch: typeof globalThis.fetch;
  /** 请求前设置回调，响应头到达时立即触发 */
  setHeadersListener(listener: (headers: Record<string, string>) => void): void;
  /** 请求结束后清除回调 */
  clearHeadersListener(): void;
}

export function createFetchInterceptor(): FetchInterceptor {
  let onHeaders: ((headers: Record<string, string>) => void) | null = null;

  const wrappedFetch: typeof globalThis.fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init);

    if (onHeaders) {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      onHeaders(headers);
    }

    return response;
  };

  return {
    fetch: wrappedFetch,
    setHeadersListener(listener) {
      onHeaders = listener;
    },
    clearHeadersListener() {
      onHeaders = null;
    },
  };
}
