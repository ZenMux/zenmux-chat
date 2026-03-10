import type { Node } from 'unist';
import { visit } from 'unist-util-visit';
import { parseAttr } from './utils';

/**
 * 从 raw HTML 字符串中创建 antArtifact element 节点。
 */
function tryCreateArtifactNode(rawValue: string) {
  if (!rawValue.includes('<antArtifact')) return null;
  const attrMatch = rawValue.match(/<antArtifact\s+([^>]*)>/);
  if (!attrMatch) return null;

  const attrs = attrMatch[1];
  const identifier = parseAttr(attrs, 'identifier');

  return {
    type: 'element',
    tagName: 'antArtifact',
    properties: { dataArtifactId: identifier },
    children: [],
  };
}

/**
 * Rehype 插件：查找包含 <antArtifact> 的 raw 节点并替换为 element 节点。
 *
 * Markdown 解析器将 `<antArtifact ...></antArtifact>` 拆为两个 raw 节点：
 * - `<antArtifact ...>` (开标签)
 * - `</antArtifact>` (闭标签)
 * 因此需要分别处理：开标签替换为 element，闭标签直接删除。
 */
const rehypeArtifact = () => (tree: Node) => {
  // 1. 顶层 raw 节点
  visit(tree, 'raw', (node: any, index: any, parent: any) => {
    if (typeof node.value !== 'string') return;

    // 删除 </antArtifact> 闭标签残留
    if (node.value.trim() === '</antArtifact>') {
      parent.children.splice(index, 1);
      return index;
    }

    const artifactNode = tryCreateArtifactNode(node.value);
    if (!artifactNode) return;
    parent.children.splice(index, 1, artifactNode);
    return index;
  });

  // 2. <p> 内的 raw 子节点（内联 HTML 场景）
  visit(tree, 'element', (node: any, index: any, parent: any) => {
    if (node.tagName !== 'p') return;
    const children: any[] = node.children || [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.type !== 'raw' || typeof child.value !== 'string') continue;

      if (child.value.trim() === '</antArtifact>') {
        children.splice(i, 1);
        i--;
        continue;
      }

      const artifactNode = tryCreateArtifactNode(child.value);
      if (!artifactNode) continue;
      parent.children.splice(index, 1, artifactNode);
      return index;
    }
  });
};

export default rehypeArtifact;
