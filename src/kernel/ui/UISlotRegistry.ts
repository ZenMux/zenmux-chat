import type {
  UISlotRegistry as IUISlotRegistry,
  UISlotName,
  UISlotItem,
  MessageRenderer,
} from '../core/types';

export function createUISlotRegistry(): IUISlotRegistry {
  const slots = new Map<UISlotName, Map<string, UISlotItem>>();
  const renderers = new Map<string, MessageRenderer>();
  const listeners = new Set<() => void>();
  // 缓存 getItems 结果，避免每次返回新数组引用导致 useSyncExternalStore 死循环
  const cache = new Map<UISlotName, UISlotItem[]>();
  let renderersCache: MessageRenderer[] | null = null;

  function getOrCreateSlot(name: UISlotName) {
    let slot = slots.get(name);
    if (!slot) {
      slot = new Map();
      slots.set(name, slot);
    }
    return slot;
  }

  function notify() {
    cache.clear();
    renderersCache = null;
    listeners.forEach((fn) => fn());
  }

  const EMPTY: UISlotItem[] = [];

  const registry: IUISlotRegistry = {
    register(slotName, item) {
      const slot = getOrCreateSlot(slotName);
      slot.set(item.id, item);
      notify();
    },

    unregister(slotName, itemId) {
      const slot = slots.get(slotName);
      if (slot) {
        slot.delete(itemId);
        notify();
      }
    },

    getItems(slotName) {
      const cached = cache.get(slotName);
      if (cached) return cached;

      const slot = slots.get(slotName);
      if (!slot || slot.size === 0) return EMPTY;

      const items = Array.from(slot.values())
        .filter((item) => !item.visible || item.visible())
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      cache.set(slotName, items);
      return items;
    },

    registerMessageRenderer(renderer) {
      renderers.set(renderer.id, renderer);
      notify();
    },

    unregisterMessageRenderer(rendererId) {
      if (renderers.delete(rendererId)) {
        notify();
      }
    },

    getMessageRenderers() {
      if (renderersCache) return renderersCache;
      renderersCache = Array.from(renderers.values());
      return renderersCache;
    },

    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  return registry;
}

export type ObservableUISlotRegistry = ReturnType<typeof createUISlotRegistry>;
