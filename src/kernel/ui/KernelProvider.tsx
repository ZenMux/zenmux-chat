import { createContext, useContext, useSyncExternalStore, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ChatKernelInstance } from '../core/ChatKernel';
import type { UISlotName, RenderContext, ChatMessage } from '../core/types';
import type { OrchestratorState } from '../orchestrator/ChatOrchestrator';

// ─── Kernel Context ──────────────────────────────────────────────

const KernelContext = createContext<ChatKernelInstance | null>(null);

export function KernelProvider({
  kernel,
  children,
}: {
  kernel: ChatKernelInstance;
  children: ReactNode;
}) {
  return (
    <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>
  );
}

export function useKernel(): ChatKernelInstance {
  const kernel = useContext(KernelContext);
  if (!kernel) throw new Error('useKernel must be used within KernelProvider');
  return kernel;
}

// ─── Slot Rendering Hook ────────────────────────────────────────

export function useSlotItems(slotName: UISlotName) {
  const kernel = useKernel();
  const registry = kernel.ui;

  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(onStoreChange),
    [registry],
  );

  const getSnapshot = useCallback(
    () => registry.getItems(slotName),
    [registry, slotName],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ─── Plugin State Hook ──────────────────────────────────────────

export function usePluginState<T>(sliceName: string): [T, (updater: T | ((prev: T) => T)) => void] {
  const kernel = useKernel();

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel.state.subscribe(sliceName, onStoreChange),
    [kernel.state, sliceName],
  );

  const getSnapshot = useCallback(
    () => kernel.state.getSlice<T>(sliceName),
    [kernel.state, sliceName],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot);

  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      kernel.state.setSlice(sliceName, updater);
    },
    [kernel.state, sliceName],
  );

  return [state, setState];
}

// ─── Orchestrator State Hook ────────────────────────────────────

export function useOrchestratorState(): OrchestratorState {
  const kernel = useKernel();

  const subscribe = useCallback(
    (onStoreChange: () => void) => kernel.orchestrator.subscribe(onStoreChange),
    [kernel.orchestrator],
  );

  const getSnapshot = useCallback(
    () => kernel.state.getSlice<OrchestratorState>('core:orchestrator'),
    [kernel.state],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ─── Message Renderer Hook ──────────────────────────────────────

export function useMessageRenderers() {
  const kernel = useKernel();
  const registry = kernel.ui;

  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(onStoreChange),
    [registry],
  );

  const getSnapshot = useCallback(
    () => registry.getMessageRenderers(),
    [registry],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ─── Slot Renderer Component ────────────────────────────────────

export function SlotRenderer({ slot, messageId, windowId, message }: { slot: UISlotName; messageId?: string; windowId?: string; message?: ChatMessage }) {
  const kernel = useKernel();
  const items = useSlotItems(slot);

  const renderCtx: RenderContext = {
    state: kernel.state,
    services: kernel.services,
    messageId,
    windowId,
    message,
  };

  return (
    <>
      {items.map((item) => (
        <div key={item.id} data-slot-item={item.id}>
          {item.render(renderCtx)}
        </div>
      ))}
    </>
  );
}
