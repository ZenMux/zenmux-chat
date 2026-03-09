import type {
  RequestLifecycleRegistry as IRequestLifecycleRegistry,
  RequestLifecycleHooks,
} from '../core/types';

export function createRequestLifecycleRegistry(): IRequestLifecycleRegistry {
  const entries = new Map<string, RequestLifecycleHooks>();

  return {
    register(pluginId, hooks) {
      entries.set(pluginId, hooks);
    },

    unregister(pluginId) {
      entries.delete(pluginId);
    },

    getHooks() {
      return Array.from(entries.entries()).map(([pluginId, hooks]) => ({
        pluginId,
        hooks,
      }));
    },
  };
}
