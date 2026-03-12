# artifact

Artifact 插件，支持 `<antArtifact>` 标签渲染、侧边预览面板和全屏模式。

## Slot

- `input:actions` — Artifact 模式开关按钮 + 面板 Portal 宿主

## State Slice

`artifact` — `{ enabled: boolean, openArtifactId: string | null }`

- `enabled` — 是否启用 artifact 系统提示词注入（默认 `false`）
- `openArtifactId` — 当前打开预览的 artifact id，`null` 表示面板关闭

## Service

`markdownExtensions: MarkdownExtensions` — 供 ChatPanel 消费的 Markdown 扩展配置。

```ts
interface MarkdownExtensions {
  rehypePlugins: any[];
  components: Record<string, React.FC<any>>;
  preprocess: (content: string) => string;
}
```

## 请求钩子

- `onBuildRequest` — 当 `enabled` 为 `true` 时，将 artifact 系统提示词追加到 `reqCtx.params.system`

## 支持的 Artifact 类型

| 类型 | MIME | 预览方式 |
|------|------|---------|
| HTML | `text/html` | iframe sandbox 渲染 |
| SVG | `image/svg+xml` | 内联 SVG 渲染 |
| Mermaid | `application/vnd.mermaid` | 代码展示 |
| Markdown | `text/markdown` | Markdown 渲染 |

## 工作流程

1. **预处理**（`preprocessArtifacts`）：从 Markdown 中提取 `<antArtifact>` 标签内容，存入内存 store，替换为空标签
2. **rehype 插件**（`rehypeArtifact`）：将 raw HTML 节点转换为 `antArtifact` element 节点
3. **渲染**（`ArtifactRenderer`）：在消息中显示为可点击的卡片
4. **预览**（`ArtifactPanel`）：点击卡片后在右侧面板打开预览，支持 Preview/Code 切换和全屏模式
5. **流式支持**：未闭合的 `<antArtifact>` 标签会显示为"生成中"状态

## 文件结构

- `ArtifactPlugin.tsx` — 插件入口，注册状态、服务、UI slot 和请求钩子
- `ArtifactRenderer.tsx` — 消息内 artifact 占位卡片组件
- `ArtifactPanel.tsx` — 侧边/全屏预览面板
- `ArtifactPanelHost.tsx` — Portal 宿主，将面板渲染到 body
- `ArtifactToggle.tsx` — input:actions 区域的开关按钮
- `rehypePlugin.ts` — rehype 插件，处理 antArtifact HTML 节点
- `utils.ts` — artifact 内容 store 和预处理函数
- `prompt.ts` — artifact 系统提示词模板
