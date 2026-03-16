import { SlotRenderer } from './KernelProvider';
import { cn } from '../../lib/cn';

export function Toolbar({ windowId, className }: { windowId?: string; className?: string }) {
  return (
    <div className={cn("zenmux-toolbar", className)}>
      <div className="zenmux-toolbar__left">
        <SlotRenderer slot="toolbar:left" windowId={windowId} />
      </div>
      <div className="zenmux-toolbar__right">
        <SlotRenderer slot="toolbar:right" windowId={windowId} />
      </div>
    </div>
  );
}
