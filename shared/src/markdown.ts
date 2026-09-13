export type MdNode =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "code"; value: string }
  | { type: "pre"; value: string }
  | { type: "a"; href: string; value: string };

const isSafeHref = (href: string): boolean => /^https?:\/\//i.test(href);

const splitText = (
  nodes: MdNode[],
  find: (value: string) => { at: number; length: number; node: MdNode } | null,
): MdNode[] =>
  nodes.flatMap((node) => {
    if (node.type !== "text") {
      return [node];
    }
    const pieces: MdNode[] = [];
    let rest = node.value;
    while (rest.length > 0) {
      const hit = find(rest);
      if (!hit) {
        pieces.push({ type: "text", value: rest });
        break;
      }
      if (hit.at > 0) {
        pieces.push({ type: "text", value: rest.slice(0, hit.at) });
      }
      pieces.push(hit.node);
      rest = rest.slice(hit.at + hit.length);
    }
    return pieces;
  });

const findFence = (value: string) => {
  const match = /```([\s\S]*?)```/.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    at: match.index,
    length: match[0].length,
    node: { type: "pre" as const, value: match[1]?.trim() ?? "" },
  };
};

const findCode = (value: string) => {
  const match = /`([^`]+)`/.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    at: match.index,
    length: match[0].length,
    node: { type: "code" as const, value: match[1] ?? "" },
  };
};

const parenDelta = (ch: string | undefined): number => {
  if (ch === "(") {
    return 1;
  }
  if (ch === ")") {
    return -1;
  }
  return 0;
};

const closeParenAt = (value: string, start: number): number | null => {
  let depth = 1;
  let cursor = start;
  while (cursor < value.length && depth > 0) {
    depth += parenDelta(value[cursor]);
    cursor += 1;
  }
  if (depth !== 0) {
    return null;
  }
  return cursor;
};

const linkSpan = (value: string): { open: number; mid: number } | null => {
  const open = value.indexOf("[");
  if (open === -1) {
    return null;
  }
  const mid = value.indexOf("](", open);
  if (mid === -1) {
    return null;
  }
  return { open, mid };
};

const linkNode = (label: string, href: string): MdNode => {
  if (isSafeHref(href)) {
    return { type: "a", href, value: label };
  }
  return { type: "text", value: label };
};

const findLink = (value: string) => {
  const span = linkSpan(value);
  if (!span) {
    return null;
  }
  const cursor = closeParenAt(value, span.mid + 2);
  if (cursor === null) {
    return null;
  }
  const label = value.slice(span.open + 1, span.mid);
  const href = value.slice(span.mid + 2, cursor - 1);
  return {
    at: span.open,
    length: cursor - span.open,
    node: linkNode(label, href),
  };
};

const findBold = (value: string) => {
  const match = /\*\*([^*]+)\*\*/.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    at: match.index,
    length: match[0].length,
    node: { type: "strong" as const, value: match[1] ?? "" },
  };
};

const findItalic = (value: string) => {
  const match = /(?<!\*)\*([^*]+)\*(?!\*)/.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    at: match.index,
    length: match[0].length,
    node: { type: "em" as const, value: match[1] ?? "" },
  };
};

const findBreak = (value: string) => {
  const at = value.indexOf("\n");
  if (at === -1) {
    return null;
  }
  return { at, length: 1, node: { type: "br" as const } };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const wrapHtml = (tag: string, value: string): string =>
  `<${tag}>${escapeHtml(value)}</${tag}>`;

const nodeHtml: { [K in MdNode["type"]]: (node: Extract<MdNode, { type: K }>) => string } =
  {
    br: () => "<br />",
    text: (node) => escapeHtml(node.value),
    strong: (node) => wrapHtml("strong", node.value),
    em: (node) => wrapHtml("em", node.value),
    code: (node) => wrapHtml("code", node.value),
    pre: (node) => `<pre><code>${escapeHtml(node.value)}</code></pre>`,
    a: (node) =>
      `<a href="${escapeHtml(node.href)}" rel="noreferrer noopener" target="_blank">${escapeHtml(node.value)}</a>`,
  };

const nodeToHtml = (node: MdNode): string =>
  (nodeHtml[node.type] as (value: MdNode) => string)(node);

export const parseMarkdown = (source: string): MdNode[] => {
  const initial: MdNode[] = [{ type: "text", value: source }];
  return splitText(
    splitText(
      splitText(
        splitText(splitText(splitText(initial, findFence), findCode), findLink),
        findBold,
      ),
      findItalic,
    ),
    findBreak,
  );
};

export const renderMarkdown = (source: string): string =>
  parseMarkdown(source).map(nodeToHtml).join("");
