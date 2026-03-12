import { usePluginState, useOrchestratorState, useKernel } from '../../kernel/ui/KernelProvider';
import type { ModelSelectorState, ModelInfoService } from './ModelSelectorPlugin';
import { MODEL_SELECTOR_SLICE } from './ModelSelectorPlugin';

export function ModelSelectorToolbar({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [globalState, setGlobalState] = usePluginState<ModelSelectorState>(MODEL_SELECTOR_SLICE);
  const orchState = useOrchestratorState();

  const modelInfo = kernel.services.get<ModelInfoService>('modelInfo');
  const allModels = modelInfo.getModels();

  const window = windowId ? orchState.windows[windowId] : undefined;
  const isWindowLevel = window?.modelId !== undefined;

  const selectedModelId = isWindowLevel ? window!.modelId! : globalState.selectedModelId;
  const selectedProtocolId = (isWindowLevel ? window?.protocolId : undefined) ?? globalState.selectedProtocolId;

  const compatibleProtocols = modelInfo.getCompatibleProtocols(selectedModelId);

  const handleModelChange = (modelId: string) => {
    const model = allModels.find((m) => m.id === modelId);
    // 如果当前协议不兼容新模型，切换到新模型的默认协议
    const newProtocolId = model && !model.compatibleProtocols.includes(selectedProtocolId)
      ? model.defaultProtocol
      : selectedProtocolId;

    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, { modelId, protocolId: newProtocolId });
    } else {
      setGlobalState({ selectedModelId: modelId, selectedProtocolId: newProtocolId });
    }
  };

  const handleProtocolChange = (protocolId: string) => {
    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, { protocolId });
    } else {
      setGlobalState({ ...globalState, selectedProtocolId: protocolId });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectedModelId}
        onChange={(e) => handleModelChange(e.target.value)}
        className="px-2 py-1 border border-chat-border rounded bg-chat-bg text-[13px] cursor-pointer outline-none"
      >
        {allModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {compatibleProtocols.length > 1 && (
        <select
          value={selectedProtocolId}
          onChange={(e) => handleProtocolChange(e.target.value)}
          className="px-2 py-1 border border-chat-border rounded bg-chat-bg text-[13px] cursor-pointer outline-none"
        >
          {compatibleProtocols.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
