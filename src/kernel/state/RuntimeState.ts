import type { RuntimeStateManager as IRuntimeStateManager } from '../core/types';

/**
 * 运行时状态管理器 —— 以 slice 为单位管理各插件和核心层的状态。
 * 每个 slice 独立注册、读写、订阅。
 */
export function createRuntimeStateManager(): IRuntimeStateManager {
  const slices = new Map<string, unknown>();
  const listeners = new Map<string, Set<(state: unknown) => void>>();

  return {
    registerSlice<T>(name: string, initialState: T) {
      if (slices.has(name)) {
        throw new Error(`[RuntimeState] Slice "${name}" already registered.`);
      }
      slices.set(name, initialState);
    },

    getSlice<T>(name: string): T {
      if (!slices.has(name)) {
        throw new Error(`[RuntimeState] Slice "${name}" is not registered.`);
      }
      return slices.get(name) as T;
    },

    setSlice<T>(name: string, updater: T | ((prev: T) => T)) {
      if (!slices.has(name)) {
        throw new Error(`[RuntimeState] Slice "${name}" is not registered.`);
      }
      const prev = slices.get(name) as T;
      const next = typeof updater === 'function'
        ? (updater as (prev: T) => T)(prev)
        : updater;
      slices.set(name, next);

      // 通知订阅者
      const subs = listeners.get(name);
      if (subs) {
        subs.forEach((fn) => fn(next));
      }
    },

    subscribe<T>(name: string, listener: (state: T) => void) {
      if (!listeners.has(name)) {
        listeners.set(name, new Set());
      }
      const wrappedListener = listener as (state: unknown) => void;
      listeners.get(name)!.add(wrappedListener);
      return () => {
        listeners.get(name)?.delete(wrappedListener);
      };
    },
  };
}
