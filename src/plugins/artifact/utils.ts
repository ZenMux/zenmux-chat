import { useSyncExternalStore } from 'react';

/**
 * Artifact 内容存储 —— 预处理时提取内容存入 store，组件按 id 读取。
 */
export interface ArtifactData {
  content: string;
  type: string;
  title: string;
  identifier: string;
  streaming: boolean;
}

const artifactStore = new Map<string, ArtifactData>();
const listeners = new Set<() => void>();
let storeVersion = 0;

function notifyListeners() {
  storeVersion++;
  listeners.forEach((l) => l());
}

function setArtifact(id: string, data: ArtifactData) {
  artifactStore.set(id, data);
  notifyListeners();
}

let idCounter = 0;

export function parseAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

/** 响应式 hook：当 artifact 数据更新时自动重新渲染 */
export function useArtifactData(id: string | undefined): ArtifactData | undefined {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => (id ? artifactStore.get(id) : undefined),
  );
}

/**
 * 预处理 Markdown 中的 <antArtifact> 标签：
 * 1. 提取内容存入 artifactStore
 * 2. 将标签替换为空的 <antArtifact identifier="..." type="..." title="..."></antArtifact>
 * 3. 移除 antArtifact 标签内所有换行（与 demo 一致），使其成为单行 raw node
 */
export function preprocessArtifacts(markdown: string): string {
  // 1. 处理完整的 artifact（已闭合标签）
  let result = markdown.replace(
    /<antArtifact\s+([^>]*)>([\s\S]*?)<\/antArtifact>/gi,
    (_, attrs, content) => {
      const identifier = parseAttr(attrs, 'identifier') || `artifact-${++idCounter}`;
      const type = parseAttr(attrs, 'type') || 'text/markdown';
      const title = parseAttr(attrs, 'title') || 'Artifact';

      setArtifact(identifier, {
        content: content.trim(),
        type,
        title,
        identifier,
        streaming: false,
      });

      // 保留 antArtifact 标签但清空内容，rehype 插件会识别这个 raw node
      return `<antArtifact identifier="${identifier}" type="${type}" title="${title}"></antArtifact>`;
    },
  );

  // 2. 处理 streaming 中未闭合的 artifact
  result = result.replace(
    /<antArtifact\s+([^>]*)>([\s\S]*)$/gi,
    (match) => {
      // 跳过已处理的空标签
      if (match.match(/<antArtifact\s[^>]*><\/antArtifact>/)) return match;
      const m = match.match(/<antArtifact\s+([^>]*)>([\s\S]*)$/i);
      if (!m) return match;
      const [, attrs, partialContent] = m;
      const identifier = parseAttr(attrs, 'identifier') || `artifact-stream-${++idCounter}`;
      const type = parseAttr(attrs, 'type') || 'text/markdown';
      const title = parseAttr(attrs, 'title') || 'Artifact';

      setArtifact(identifier, {
        content: partialContent,
        type,
        title,
        identifier,
        streaming: true,
      });

      return `<antArtifact identifier="${identifier}" type="${type}" title="${title}"></antArtifact>`;
    },
  );

  // 3. 移除 antArtifact 标签内的所有换行符（与 demo 的 removeLineBreaksInAntArtifact 一致）
  result = result.replace(/<antArtifact\b[^>]*>[\S\s]*?(?:<\/antArtifact>|$)/g, (match: string) => {
    return match.replace(/\r?\n|\r/g, '');
  });

  return result;
}

/** 组件通过 id 获取 artifact 数据 */
export function getArtifactData(id: string): ArtifactData | undefined {
  return artifactStore.get(id);
}
