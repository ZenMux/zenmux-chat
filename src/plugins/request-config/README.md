# request-config

用户可配置的请求参数面板，支持全局和窗口级配置。

## Slot

- `toolbar:right` — 参数配置按钮，展开后可开关和调整各参数

## State Slice

`requestConfig` — 每个参数为 `ParamEntry<T>` 结构（`{ enabled, value }`），只有用户主动启用的参数才会注入请求。

## 支持的参数

| 参数 | 类型 | 说明 |
|------|------|------|
| temperature | number | 采样温度 0-2 |
| topP | number | Top-P 采样 0-1 |
| maxTokens | number | 最大输出 token 数 |
| maxCompletionTokens | number | 最大完成 token 数 |
| seed | number | 随机种子 |
| stop | string | 停止序列（逗号分隔） |
| frequencyPenalty | number | 频率惩罚 -2~2 |
| presencePenalty | number | 存在惩罚 -2~2 |
| repetitionPenalty | number | 重复惩罚 0-2（openaicompat） |
| logprobs | boolean | 是否返回 token logprobs |
| topLogprobs | number | 返回 top N logprobs 0-20 |
| reasoningEffort | string | 推理力度 low/medium/high（OpenAI） |
| thinkingBudget | number | thinking budget token 数（Anthropic） |
| responseFormat | string | 响应格式 text/json_object |
| systemPrompt | string | 系统提示词 |

## 请求钩子

- `onBuildRequest` — 将已启用的参数写入 `reqCtx.params`，优先使用窗口级配置，否则使用全局配置

## 窗口级配置

支持窗口级覆盖：通过 `orchestrator.updateWindow(windowId, { requestConfig })` 为单个窗口设置独立参数，未设置的参数回退到全局配置。

## 依赖

- `modelInfo` 服务（来自 model-selector 插件）— 根据当前模型能力动态显示支持的参数项
