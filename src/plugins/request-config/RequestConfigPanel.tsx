import { usePluginState, useOrchestratorState, useKernel } from '../../kernel/ui/KernelProvider';
import { cn } from '../../lib/cn';
import type { ParamEntry } from '../../kernel/core/types';
import type { RequestConfigState } from './RequestConfigPlugin';
import { REQUEST_CONFIG_SLICE } from './RequestConfigPlugin';
import type { ModelInfoService, SupportedParam } from '../model-selector/ModelSelectorPlugin';

export function RequestConfigPanel({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [globalConfig, setGlobalConfig] = usePluginState<RequestConfigState>(REQUEST_CONFIG_SLICE);
  const orchState = useOrchestratorState();

  const window = windowId ? orchState.windows[windowId] : undefined;
  const isWindowLevel = window?.requestConfig !== undefined;

  // 当前生效的配置（窗口级 or 全局）
  const config: RequestConfigState = isWindowLevel
    ? {
        temperature: window!.requestConfig!.temperature ?? globalConfig.temperature,
        topP: window!.requestConfig!.topP ?? globalConfig.topP,
        maxTokens: window!.requestConfig!.maxTokens ?? globalConfig.maxTokens,
        systemPrompt: window!.requestConfig!.systemPrompt ?? globalConfig.systemPrompt,
      }
    : globalConfig;

  // 获取当前模型支持的参数
  const modelInfo = kernel.services.get<ModelInfoService>('modelInfo');
  let supported: SupportedParam[];
  if (isWindowLevel && window?.modelId) {
    const option = modelInfo.getOptions().find((m) => m.id === window.modelId);
    supported = option?.capabilities.supportedParams ?? modelInfo?.getCapabilities().supportedParams ?? [];
  } else {
    supported = modelInfo?.getCapabilities().supportedParams ?? [];
  }

  const toggleEnabled = (key: keyof RequestConfigState) => {
    const newEntry = { ...config[key], enabled: !config[key].enabled };
    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, {
        requestConfig: { ...window!.requestConfig, [key]: newEntry },
      });
    } else {
      setGlobalConfig((prev) => ({ ...prev, [key]: newEntry }));
    }
  };

  const updateValue = <T,>(key: keyof RequestConfigState, value: T) => {
    const newEntry = { ...(config[key] as ParamEntry<T>), value };
    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, {
        requestConfig: { ...window!.requestConfig, [key]: newEntry },
      });
    } else {
      setGlobalConfig((prev) => ({ ...prev, [key]: newEntry }));
    }
  };

  const paramMap: Record<SupportedParam, () => React.ReactNode> = {
    temperature: () => (
      <ParamRow
        key="temperature"
        label={`Temperature: ${config.temperature.value}`}
        entry={config.temperature}
        onToggle={() => toggleEnabled('temperature')}
      >
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={config.temperature.value}
          onChange={(e) => updateValue('temperature', Number(e.target.value))}
          disabled={!config.temperature.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    topP: () => (
      <ParamRow
        key="topP"
        label={`Top P: ${config.topP.value}`}
        entry={config.topP}
        onToggle={() => toggleEnabled('topP')}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.topP.value}
          onChange={(e) => updateValue('topP', Number(e.target.value))}
          disabled={!config.topP.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    maxTokens: () => (
      <ParamRow
        key="maxTokens"
        label="Max Tokens"
        entry={config.maxTokens}
        onToggle={() => toggleEnabled('maxTokens')}
      >
        <input
          type="number"
          min={1}
          max={128000}
          value={config.maxTokens.value}
          onChange={(e) => updateValue('maxTokens', Number(e.target.value))}
          disabled={!config.maxTokens.enabled}
          className={inputClasses}
        />
      </ParamRow>
    ),
    systemPrompt: () => (
      <ParamRow
        key="systemPrompt"
        label="System Prompt"
        entry={config.systemPrompt}
        onToggle={() => toggleEnabled('systemPrompt')}
      >
        <textarea
          value={config.systemPrompt.value}
          onChange={(e) => updateValue('systemPrompt', e.target.value)}
          disabled={!config.systemPrompt.enabled}
          rows={4}
          placeholder="Enter a system prompt..."
          className={cn(inputClasses, 'resize-y')}
        />
      </ParamRow>
    ),
  };

  if (supported.length === 0) {
    return <div className="text-xs text-neutral-400 p-2">当前模型无可配置参数</div>;
  }

  return (
    <div className="flex flex-col gap-3.5 text-[13px]">
      {supported.map((param) => paramMap[param]())}
    </div>
  );
}

const inputClasses = 'px-2 py-1.5 border border-neutral-200 rounded text-[13px] outline-none w-full box-border';

function ParamRow({
  label,
  entry,
  onToggle,
  children,
}: {
  label: string;
  entry: ParamEntry<unknown>;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={entry.enabled ? 'opacity-100' : 'opacity-50'}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 mb-1 cursor-pointer">
        <input
          type="checkbox"
          checked={entry.enabled}
          onChange={onToggle}
        />
        {label}
      </label>
      {children}
    </div>
  );
}
