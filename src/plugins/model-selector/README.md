# model-selector

模型选择器，支持在多个 LLM 之间切换，并可手动选择请求协议（Chat Completions / Responses API / Google AI / Anthropic Messages）。

## 三层架构

```
ProviderConfig          ProtocolOption              ModelEntry
──────────────          ──────────────              ──────────
id, label               id, label                   id, label
createInstance()        providerId → Provider       compatibleProtocols[]
                        supportedParams             defaultProtocol
                        resolve(provider, modelId)  capabilities
                                                    overrideModel? (mock)
```

- **Provider** — 封装 AI SDK provider 工厂（OpenAI / Google / Anthropic），惰性创建并缓存实例
- **Protocol** — 定义如何将 provider + modelId 转换为 LanguageModel，每个协议绑定一个 provider
- **Model** — 声明兼容的协议列表和默认协议，不绑定特定 provider

## Slot

- `toolbar:left` — 模型下拉 + 协议下拉（仅当模型兼容多种协议时显示协议选择）
- `message:header` — 消息头部模型名称显示（仅当消息携带 `modelId` 时渲染）

## State Slice

`modelSelector` — `{ selectedModelId: string, selectedProtocolId: string }`

## Service

`modelInfo: ModelInfoService` — 供其他插件查询当前模型/协议信息。

```ts
interface ModelInfoService {
  getCurrentModelId(): string;
  getCurrentProtocolId(): string;
  getCapabilities(): ModelCapabilities;
  getModels(): ModelEntry[];
  getProtocols(): ProtocolOption[];
  getCompatibleProtocols(modelId: string): ProtocolOption[];
}
```

`getCapabilities()` 返回的 `supportedParams` 来自当前选中的协议，`supportsImages` / `supportsFiles` 来自模型。

## 请求钩子

- `onBuildRequest` — 根据 modelId + protocolId 延迟创建 LanguageModel 并设置 `reqCtx.params.model`。优先使用窗口级覆盖（`window.modelId` / `window.protocolId`），否则使用全局选择。

## 窗口级覆盖

支持窗口级模型和协议覆盖：

```ts
orchestrator.updateWindow(windowId, { modelId, protocolId });
```

## 协议切换联动

切换模型时，若当前协议不在新模型的 `compatibleProtocols` 中，自动切换到模型的 `defaultProtocol`。

## 插件配置

```ts
createModelSelectorPlugin({
  providers: ProviderConfig[],
  protocols: ProtocolOption[],
  models: ModelEntry[],
  defaultModelId?: string,
  defaultProtocolId?: string,
})
```

## 当前支持的协议

| 协议 | Provider | 方法 |
|------|----------|------|
| Chat Completions | OpenAI | `provider.chat(modelId)` |
| Responses API | OpenAI | `provider.responses(modelId)` |
| Google AI | Google | `provider(modelId)` |
| Anthropic Messages | Anthropic | `provider(modelId)` |
