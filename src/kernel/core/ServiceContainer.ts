import type { ServiceContainer as IServiceContainer } from './types';

export function createServiceContainer(): IServiceContainer {
  const factories = new Map<string, () => unknown>();
  const instances = new Map<string, unknown>();

  return {
    register<T>(name: string, factory: () => T) {
      factories.set(name, factory);
      // 清除已缓存的实例，让下次 get 时用新的 factory
      instances.delete(name);
    },

    get<T>(name: string): T {
      if (instances.has(name)) {
        return instances.get(name) as T;
      }
      const factory = factories.get(name);
      if (!factory) {
        throw new Error(`[ServiceContainer] Service "${name}" is not registered.`);
      }
      const instance = factory() as T;
      instances.set(name, instance);
      return instance;
    },

    has(name: string): boolean {
      return factories.has(name);
    },
  };
}
