# Kernel

微内核架构的核心层，提供插件系统、UI 插槽、请求管道、状态管理和多窗口编排能力。

## 目录结构

```
kernel/
  core/
    types.ts                  # 所有核心接口与类型定义
    ChatKernel.ts             # 内核工厂，组装各子系统
    PluginManager.ts          # 插件注册与生命周期
    ServiceContainer.ts       # 延迟单例 IoC 容器
  ui/
    UISlotRegistry.ts         # 可观察的 UI 插槽注册表（带缓存）
    KernelProvider.tsx        # React Context、hooks、SlotRenderer
    ChatPanel.tsx             # 消息列表 + 输入区域
    Toolbar.tsx               # 顶部工具栏
  request/
    AIRequestPipeline.ts      # streamText 请求管道 + 插件钩子
    RequestLifecycleRegistry.ts  # 请求生命周期钩子注册表
  state/
    RuntimeState.ts           # 基于 slice 的响应式状态管理器
  orchestrator/
    ChatOrchestrator.ts       # 多窗口聊天编排（消息发送、流式响应、中断）
```

## 核心子系统

### PluginManager

插件通过 `ChatPlugin { id, setup(ctx), dispose? }` 接入。`setup` 接收 `PluginContext`：

- `ctx.ui` — 注册 UI 组件到命名插槽 / 注册自定义消息渲染器
- `ctx.requests` — 注册请求生命周期钩子
- `ctx.state` — 注册和管理状态 slice
- `ctx.services` — 访问共享 service

### UISlotRegistry

命名插槽：`toolbar:left`、`toolbar:right`、`panel:header`、`panel:footer`、`message:above`、`message:below`、`message:footer`、`message:reasoning`、`message:files`、`message:streaming`、`message:error`、`input:composer`、`input:actions`

自定义消息渲染器：插件可通过 `registerMessageRenderer` 注册 `MessageRenderer { match, render }`，匹配的消息将替换默认气泡渲染。

缓存策略：`getItems()` / `getMessageRenderers()` 结果被缓存，仅在注册变更时清除，避免 `useSyncExternalStore` 无限重渲染。

### AIRequestPipeline

请求生命周期：`onBuildRequest → onBeforeSend → streamText (fullStream) → onStreamChunk → onAfterResponse / onRequestError`

- 使用 `fullStream`（而非 `textStream`）以捕获流中的 error 事件
- `AICallParams` 从 `streamText` 参数类型派生，插件可自由设置任何 AI SDK 支持的参数

### RuntimeState

基于 slice 的状态管理：`registerSlice` → `getSlice` / `setSlice` → `subscribe`。每个 slice 独立订阅，支持细粒度更新。

### ChatOrchestrator

状态 slice：`core:orchestrator` — `{ windows, activeWindowId }`

核心能力：创建/切换窗口、发送消息、流式响应（RAF 节流）、中断请求、多窗口广播。

## React Hooks

| Hook | 用途 |
|------|------|
| `useKernel()` | 获取内核实例 |
| `useSlotItems(slot)` | 订阅指定插槽的 UI 项 |
| `usePluginState<T>(slice)` | 读写插件状态 slice |
| `useOrchestratorState()` | 订阅编排器状态 |
| `useMessageRenderers()` | 获取所有自定义消息渲染器 |
