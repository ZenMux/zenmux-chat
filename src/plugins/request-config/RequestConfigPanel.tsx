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
  const wrc = window?.requestConfig;
  const config: RequestConfigState = isWindowLevel
    ? {
        temperature: wrc!.temperature ?? globalConfig.temperature,
        topP: wrc!.topP ?? globalConfig.topP,
        maxTokens: wrc!.maxTokens ?? globalConfig.maxTokens,
        maxCompletionTokens: wrc!.maxCompletionTokens ?? globalConfig.maxCompletionTokens,
        seed: wrc!.seed ?? globalConfig.seed,
        stop: wrc!.stop ?? globalConfig.stop,
        frequencyPenalty: wrc!.frequencyPenalty ?? globalConfig.frequencyPenalty,
        presencePenalty: wrc!.presencePenalty ?? globalConfig.presencePenalty,
        repetitionPenalty: wrc!.repetitionPenalty ?? globalConfig.repetitionPenalty,
        logprobs: wrc!.logprobs ?? globalConfig.logprobs,
        topLogprobs: wrc!.topLogprobs ?? globalConfig.topLogprobs,
        reasoningEffort: wrc!.reasoningEffort ?? globalConfig.reasoningEffort,
        thinkingBudget: wrc!.thinkingBudget ?? globalConfig.thinkingBudget,
        responseFormat: wrc!.responseFormat ?? globalConfig.responseFormat,
        systemPrompt: wrc!.systemPrompt ?? globalConfig.systemPrompt,
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
    maxCompletionTokens: () => (
      <ParamRow
        key="maxCompletionTokens"
        label="Max Completion Tokens"
        entry={config.maxCompletionTokens}
        onToggle={() => toggleEnabled('maxCompletionTokens')}
      >
        <input
          type="number"
          min={1}
          max={128000}
          value={config.maxCompletionTokens.value}
          onChange={(e) => updateValue('maxCompletionTokens', Number(e.target.value))}
          disabled={!config.maxCompletionTokens.enabled}
          className={inputClasses}
        />
      </ParamRow>
    ),
    seed: () => (
      <ParamRow
        key="seed"
        label="Seed"
        entry={config.seed}
        onToggle={() => toggleEnabled('seed')}
      >
        <input
          type="number"
          min={0}
          value={config.seed.value}
          onChange={(e) => updateValue('seed', Number(e.target.value))}
          disabled={!config.seed.enabled}
          className={inputClasses}
        />
      </ParamRow>
    ),
    stop: () => (
      <ParamRow
        key="stop"
        label="Stop Sequences"
        entry={config.stop}
        onToggle={() => toggleEnabled('stop')}
      >
        <input
          type="text"
          value={config.stop.value}
          onChange={(e) => updateValue('stop', e.target.value)}
          disabled={!config.stop.enabled}
          placeholder="逗号分隔，如: \n, END, STOP"
          className={inputClasses}
        />
      </ParamRow>
    ),
    frequencyPenalty: () => (
      <ParamRow
        key="frequencyPenalty"
        label={`Frequency Penalty: ${config.frequencyPenalty.value}`}
        entry={config.frequencyPenalty}
        onToggle={() => toggleEnabled('frequencyPenalty')}
      >
        <input
          type="range"
          min={-2}
          max={2}
          step={0.1}
          value={config.frequencyPenalty.value}
          onChange={(e) => updateValue('frequencyPenalty', Number(e.target.value))}
          disabled={!config.frequencyPenalty.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    presencePenalty: () => (
      <ParamRow
        key="presencePenalty"
        label={`Presence Penalty: ${config.presencePenalty.value}`}
        entry={config.presencePenalty}
        onToggle={() => toggleEnabled('presencePenalty')}
      >
        <input
          type="range"
          min={-2}
          max={2}
          step={0.1}
          value={config.presencePenalty.value}
          onChange={(e) => updateValue('presencePenalty', Number(e.target.value))}
          disabled={!config.presencePenalty.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    repetitionPenalty: () => (
      <ParamRow
        key="repetitionPenalty"
        label={`Repetition Penalty: ${config.repetitionPenalty.value}`}
        entry={config.repetitionPenalty}
        onToggle={() => toggleEnabled('repetitionPenalty')}
      >
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={config.repetitionPenalty.value}
          onChange={(e) => updateValue('repetitionPenalty', Number(e.target.value))}
          disabled={!config.repetitionPenalty.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    logprobs: () => (
      <ParamRow
        key="logprobs"
        label="Logprobs"
        entry={config.logprobs}
        onToggle={() => toggleEnabled('logprobs')}
      >
        <label className="flex items-center gap-1.5 text-xs text-chat-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={config.logprobs.value}
            onChange={(e) => updateValue('logprobs', e.target.checked)}
            disabled={!config.logprobs.enabled}
          />
          返回 token logprobs
        </label>
      </ParamRow>
    ),
    topLogprobs: () => (
      <ParamRow
        key="topLogprobs"
        label={`Top Logprobs: ${config.topLogprobs.value}`}
        entry={config.topLogprobs}
        onToggle={() => toggleEnabled('topLogprobs')}
      >
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={config.topLogprobs.value}
          onChange={(e) => updateValue('topLogprobs', Number(e.target.value))}
          disabled={!config.topLogprobs.enabled}
          className="w-full"
        />
      </ParamRow>
    ),
    reasoningEffort: () => (
      <ParamRow
        key="reasoningEffort"
        label="Reasoning Effort"
        entry={config.reasoningEffort}
        onToggle={() => toggleEnabled('reasoningEffort')}
      >
        <select
          value={config.reasoningEffort.value}
          onChange={(e) => updateValue('reasoningEffort', e.target.value)}
          disabled={!config.reasoningEffort.enabled}
          className={inputClasses}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </ParamRow>
    ),
    thinkingBudget: () => (
      <ParamRow
        key="thinkingBudget"
        label="Thinking Budget (tokens)"
        entry={config.thinkingBudget}
        onToggle={() => toggleEnabled('thinkingBudget')}
      >
        <input
          type="number"
          min={1024}
          max={131072}
          value={config.thinkingBudget.value}
          onChange={(e) => updateValue('thinkingBudget', Number(e.target.value))}
          disabled={!config.thinkingBudget.enabled}
          className={inputClasses}
        />
      </ParamRow>
    ),
    responseFormat: () => (
      <ParamRow
        key="responseFormat"
        label="Response Format"
        entry={config.responseFormat}
        onToggle={() => toggleEnabled('responseFormat')}
      >
        <select
          value={config.responseFormat.value}
          onChange={(e) => updateValue('responseFormat', e.target.value)}
          disabled={!config.responseFormat.enabled}
          className={inputClasses}
        >
          <option value="text">text</option>
          <option value="json_object">json_object</option>
        </select>
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
    return <div className="text-xs text-chat-text-muted p-2">当前模型无可配置参数</div>;
  }

  return (
    <div className="flex flex-col gap-3.5 text-[13px]">
      {supported.map((param) => paramMap[param]())}
    </div>
  );
}

const inputClasses = 'px-2 py-1.5 border border-chat-border rounded text-[13px] outline-none w-full box-border';

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
      <label className="flex items-center gap-1.5 text-xs font-medium text-chat-text-secondary mb-1 cursor-pointer">
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
