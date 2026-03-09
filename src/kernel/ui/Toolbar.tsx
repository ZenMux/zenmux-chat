import { SlotRenderer } from './KernelProvider';

export function Toolbar({ windowId }: { windowId?: string }) {
  return (
    <div className="kernel-toolbar flex justify-between items-center px-4 py-2 border-b border-neutral-300">
      <div className="kernel-toolbar__left flex gap-2">
        <SlotRenderer slot="toolbar:left" windowId={windowId} />
      </div>
      <div className="kernel-toolbar__right flex gap-2">
        <SlotRenderer slot="toolbar:right" windowId={windowId} />
      </div>
    </div>
  );
}
