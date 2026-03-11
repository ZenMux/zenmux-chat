import { usePluginState, useOrchestratorState, useKernel } from '../../kernel/ui/KernelProvider';
import type { ModelSelectorState, ModelInfoService } from './ModelSelectorPlugin';
import { MODEL_SELECTOR_SLICE } from './ModelSelectorPlugin';

export function ModelSelectorToolbar({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [globalState, setGlobalState] = usePluginState<ModelSelectorState>(MODEL_SELECTOR_SLICE);
  const orchState = useOrchestratorState();

  const modelInfo = kernel.services.get<ModelInfoService>('modelInfo');
  const modelOptions = modelInfo.getOptions();

  const window = windowId ? orchState.windows[windowId] : undefined;
  const isWindowLevel = window?.modelId !== undefined;

  const selectedModelId = isWindowLevel ? window!.modelId! : globalState.selectedModelId;

  const handleChange = (modelId: string) => {
    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, { modelId });
    } else {
      setGlobalState({ selectedModelId: modelId });
    }
  };

  return (
    <select
      value={selectedModelId}
      onChange={(e) => handleChange(e.target.value)}
      className="px-2 py-1 border border-chat-border rounded bg-chat-bg text-[13px] cursor-pointer outline-none"
    >
      {modelOptions.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
