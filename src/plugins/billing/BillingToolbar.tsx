import type { BillingMode } from '../../kernel/core/types';
import { cn } from '../../lib/cn';
import { usePluginState, useOrchestratorState, useKernel } from '../../kernel/ui/KernelProvider';
import type { BillingState } from './BillingPlugin';
import { BILLING_SLICE } from './BillingPlugin';

export function BillingToolbar({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const [globalBilling, setGlobalBilling] = usePluginState<BillingState>(BILLING_SLICE);
  const orchState = useOrchestratorState();

  const window = windowId ? orchState.windows[windowId] : undefined;
  const isWindowLevel = window?.billing !== undefined;

  const mode = isWindowLevel ? window!.billing!.mode : globalBilling.mode;
  const plan = isWindowLevel ? window!.billing!.plan : globalBilling.plan;

  const toggle = () => {
    const next: BillingMode = mode === 'subscription' ? 'payg' : 'subscription';
    if (isWindowLevel) {
      kernel.orchestrator.updateWindow(windowId!, {
        billing: { mode: next, plan },
      });
    } else {
      setGlobalBilling((prev) => ({ ...prev, mode: next }));
    }
  };

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        mode === 'subscription'
          ? 'bg-billing-sub-bg text-billing-sub-text'
          : 'bg-billing-payg-bg text-billing-payg-text',
      )}>
        {mode === 'subscription' ? 'Sub' : 'PAYG'}
      </span>
      <button
        onClick={toggle}
        className="px-2 py-0.5 border border-chat-border rounded bg-chat-bg cursor-pointer text-xs"
      >
        Switch
      </button>
      <span className="text-chat-text-muted text-[11px]">
        used: {globalBilling.usageCount}
      </span>
    </div>
  );
}
