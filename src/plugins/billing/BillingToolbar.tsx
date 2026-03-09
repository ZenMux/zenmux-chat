import type { BillingMode } from '../../kernel/core/types';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: mode === 'subscription' ? '#e8f5e9' : '#fff3e0',
        color: mode === 'subscription' ? '#2e7d32' : '#e65100',
        fontWeight: 500,
        fontSize: 12,
      }}>
        {mode === 'subscription' ? 'Sub' : 'PAYG'}
      </span>
      <button
        onClick={toggle}
        style={{
          padding: '2px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: '#fff',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Switch
      </button>
      <span style={{ color: '#888', fontSize: 11 }}>
        used: {globalBilling.usageCount}
      </span>
    </div>
  );
}
