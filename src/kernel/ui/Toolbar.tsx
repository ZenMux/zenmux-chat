import { SlotRenderer } from './KernelProvider';
import { cn } from '../../lib/cn';

export function Toolbar({ windowId, className }: { windowId?: string; className?: string }) {
  return (
    <div className={cn("kernel-toolbar flex justify-between items-center px-4 py-2 border-b border-chat-border", className)}>
      <div className="kernel-toolbar__left flex gap-2">
        <SlotRenderer slot="toolbar:left" windowId={windowId} />
      </div>
      <div className="kernel-toolbar__right flex gap-2">
        <SlotRenderer slot="toolbar:right" windowId={windowId} />
      </div>
    </div>
  );
}
