import type { RenderContext } from '../../kernel/core/types';
import type { ModelInfoService } from './ModelSelectorPlugin';

export function ModelMessageHeader({ ctx }: { ctx: RenderContext }) {
  const modelId = ctx.message?.modelId;
  if (!modelId || !ctx.services.has('modelInfo')) return null;

  const modelInfo = ctx.services.get<ModelInfoService>('modelInfo');
  const option = modelInfo.getOptions().find((m) => m.id === modelId);
  if (!option) return null;

  return (
    <div className="text-xs text-neutral-500 font-medium mb-1">
      {option.label}
    </div>
  );
}
