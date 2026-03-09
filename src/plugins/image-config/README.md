# image-config

Google Gemini 生图模型的图片生成参数配置。

## Slot

- `input:actions` — 比例 / 分辨率下拉选择器（仅当前模型为 Google 生图模型时显示）

## State Slice

`imageConfig` — `{ aspectRatio: AspectRatio; imageSize: ImageSize }`

- `aspectRatio` — 支持 `1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`
- `imageSize` — 支持 `512`、`1K`、`2K`、`4K`

## 请求钩子

- `onBuildRequest` — 当模型为 Google 生图模型时，注入 `providerOptions.google`（`responseModalities: ['TEXT', 'IMAGE']` + `imageConfig`）
