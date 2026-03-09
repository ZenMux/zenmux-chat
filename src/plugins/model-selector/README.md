# model-selector

模型选择器，支持在多个 LLM 之间切换。

## Slot

- `toolbar:left` — 模型下拉选择器

## State Slice

`modelSelector` — `{ selectedModelId: string }`

## Service

`modelInfo: ModelInfoService` — 供其他插件查询当前模型 ID、能力（是否支持图片/文件、支持哪些参数）和可选模型列表。

## 请求钩子

- `onBuildRequest` — 根据用户选择覆盖 `reqCtx.params.model`

## 当前支持的模型

- GPT-4o / GPT-4o Mini（chat completions）
- GPT-4.1 / GPT-4.1 Mini / GPT-4.1 Nano（responses API）
- Gemini 3.1 Flash Image Preview（Google Generative AI）
