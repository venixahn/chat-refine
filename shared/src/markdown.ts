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

const findLink = (value: string) => {
  const open = value.indexOf("[");
  const mid = open === -1 ? -1 : value.indexOf("](", open);
  if (open === -1 || mid === -1) {
    return null;
  }
  let depth = 1;
  let cursor = mid + 2;
  while (cursor < value.length && depth > 0) {
    if (value[cursor] === "(") {
      depth += 1;
    } else if (value[cursor] === ")") {
      depth -= 1;
    }
    cursor += 1;
  }
  if (depth !== 0) {
    return null;
  }
  const label = value.slice(open + 1, mid);
  const href = value.slice(mid + 2, cursor - 1);
  return {
    at: open,
    length: cursor - open,
    node: isSafeHref(href)
      ? { type: "a" as const, href, value: label }
      : { type: "text" as const, value: label },
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

const nodeToHtml = (node: MdNode): string => {
  switch (node.type) {
    case "br":
      return "<br />";
    case "strong":
      return `<strong>${escapeHtml(node.value)}</strong>`;
    case "em":
      return `<em>${escapeHtml(node.value)}</em>`;
    case "code":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "pre":
      return `<pre><code>${escapeHtml(node.value)}</code></pre>`;
    case "a":
      return `<a href="${escapeHtml(node.href)}" rel="noreferrer noopener" target="_blank">${escapeHtml(node.value)}</a>`;
    default:
      return escapeHtml(node.value);
  }
};

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
