import type {
  PluginManager as IPluginManager,
  ChatPlugin,
  PluginContext,
} from './types';

export function createPluginManager(getContext: () => PluginContext): IPluginManager {
  const plugins = new Map<string, ChatPlugin>();

  return {
    register(plugin: ChatPlugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`[PluginManager] Plugin "${plugin.id}" is already registered.`);
      }
      plugins.set(plugin.id, plugin);
      plugin.setup(getContext());
    },

    unregister(pluginId: string) {
      const plugin = plugins.get(pluginId);
      if (plugin) {
        plugin.dispose?.();
        plugins.delete(pluginId);
      }
    },

    getPlugin(pluginId: string) {
      return plugins.get(pluginId);
    },

    getAllPlugins() {
      return Array.from(plugins.values());
    },
  };
}
