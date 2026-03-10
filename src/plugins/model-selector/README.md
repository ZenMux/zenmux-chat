# model-selector

模型选择器，支持在多个 LLM 之间切换，并在消息头部显示模型名称。

## Slot

- `toolbar:left` — 模型下拉选择器
- `message:header` — 消息头部模型名称显示（仅当消息携带 `modelId` 时渲染）

## State Slice

`modelSelector` — `{ selectedModelId: string }`

## Service

`modelInfo: ModelInfoService` — 供其他插件查询当前模型 ID、能力（是否支持图片/文件、支持哪些参数）和可选模型列表。

```ts
interface ModelInfoService {
  getCurrentModelId(): string;
  getCapabilities(): ModelCapabilities;
  getOptions(): ModelOption[];
}
```

## 请求钩子

- `onBuildRequest` — 根据用户选择覆盖 `reqCtx.params.model`，优先使用窗口级模型（`window.modelId`），否则使用全局选择

## 窗口级模型

支持窗口级覆盖：通过 `orchestrator.updateWindow(windowId, { modelId })` 为单个窗口指定模型。

## 当前支持的模型

- GPT-4o / GPT-4o Mini（chat completions）
- GPT-4.1 / GPT-4.1 Mini / GPT-4.1 Nano（responses API）
- Gemini 3.1 Flash Image Preview（Google Generative AI）
