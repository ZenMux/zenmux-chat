import { createPortal } from 'react-dom';
import { usePluginState } from '../../kernel/ui/KernelProvider';
import { ARTIFACT_SLICE, type ArtifactState } from './ArtifactPlugin';
import ArtifactPanel from './ArtifactPanel';

/**
 * Portal 宿主：始终挂载在 input:actions 中，
 * 当 openArtifactId 有值时通过 portal 渲染右侧面板到 body。
 */
export function ArtifactPanelHost() {
  const [state] = usePluginState<ArtifactState>(ARTIFACT_SLICE);

  if (!state.openArtifactId) return null;

  return createPortal(<ArtifactPanel />, document.body);
}
