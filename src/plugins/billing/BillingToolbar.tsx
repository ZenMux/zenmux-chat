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
    <div className="zenmux-billing">
      <span className={cn(
        'zenmux-billing__badge',
        mode === 'subscription' ? 'zenmux-billing__badge--sub' : 'zenmux-billing__badge--payg',
      )}>
        {mode === 'subscription' ? 'Sub' : 'PAYG'}
      </span>
      <button
        onClick={toggle}
        className="zenmux-billing__switch-btn"
      >
        Switch
      </button>
      <span className="zenmux-billing__usage">
        used: {globalBilling.usageCount}
      </span>
    </div>
  );
}
