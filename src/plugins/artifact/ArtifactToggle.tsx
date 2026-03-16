import { cn } from '../../lib/cn';
import { usePluginState } from '../../kernel/ui/KernelProvider';
import { ARTIFACT_SLICE, type ArtifactState } from './ArtifactPlugin';

export function ArtifactToggle() {
  const [state, setState] = usePluginState<ArtifactState>(ARTIFACT_SLICE);

  return (
    <button
      title={state.enabled ? 'Artifact 模式已开启' : 'Artifact 模式已关闭'}
      onClick={() => setState((prev) => ({ ...prev, enabled: !prev.enabled }))}
      className={cn(
        'zenmux-artifact-toggle',
        state.enabled ? 'zenmux-artifact-toggle--active' : 'zenmux-artifact-toggle--inactive',
      )}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      Artifact
    </button>
  );
}
