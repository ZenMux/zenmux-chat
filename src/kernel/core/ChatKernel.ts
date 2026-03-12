import type { LanguageModel } from 'ai';
import type { ChatKernel as IChatKernel, PluginContext } from './types';
import { createPluginManager } from './PluginManager';
import { createServiceContainer } from './ServiceContainer';
import { createUISlotRegistry } from '../ui/UISlotRegistry';
import { createRequestLifecycleRegistry } from '../request/RequestLifecycleRegistry';
import { createRuntimeStateManager } from '../state/RuntimeState';
import { createChatOrchestrator, type ChatOrchestratorInstance } from '../orchestrator/ChatOrchestrator';
import { createFetchInterceptor } from '../request/fetchInterceptor';

export interface ChatKernelConfig {
  /** 默认语言模型，例如 openai('gpt-4o') */
  defaultModel: LanguageModel;
}

export interface ChatKernelInstance extends IChatKernel {
  orchestrator: ChatOrchestratorInstance;
}

export function createChatKernel(config: ChatKernelConfig): ChatKernelInstance {
  const ui = createUISlotRegistry();
  const requests = createRequestLifecycleRegistry();
  const state = createRuntimeStateManager();
  const services = createServiceContainer();

  const fetchInterceptor = createFetchInterceptor();
  services.register('fetchInterceptor', () => fetchInterceptor);

  const getContext = (): PluginContext => ({ ui, requests, state, services });

  const plugins = createPluginManager(getContext);

  const orchestrator = createChatOrchestrator({
    defaultModel: config.defaultModel,
    lifecycleRegistry: requests,
    stateManager: state,
    fetchInterceptor,
  });

  // 将 orchestrator 注册为核心 service，插件可通过 services.get('orchestrator') 获取
  services.register('orchestrator', () => orchestrator);

  return {
    plugins,
    ui,
    requests,
    state,
    services,
    orchestrator,

    boot() {
      // 未来可在此做启动时初始化，例如从持久化恢复状态
      console.log('[ChatKernel] booted with', plugins.getAllPlugins().length, 'plugins');
    },

    dispose() {
      plugins.getAllPlugins().forEach((p) => {
        plugins.unregister(p.id);
      });
    },
  };
}
