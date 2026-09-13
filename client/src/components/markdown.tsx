import { For, type JSX } from "solid-js";
import { parseMarkdown, type MdNode } from "@chat-refine/shared";

const inline = (
  tag: "strong" | "em" | "code",
  value: string,
): JSX.Element => {
  if (tag === "strong") {
    return <strong>{value}</strong>;
  }
  if (tag === "em") {
    return <em>{value}</em>;
  }
  return <code>{value}</code>;
};

const renderNode = (node: MdNode) => {
  if (node.type === "br") {
    return <br />;
  }
  if (node.type === "pre") {
    return (
      <pre>
        <code>{node.value}</code>
      </pre>
    );
  }
  if (node.type === "a") {
    return (
      <a href={node.href} rel="noreferrer noopener" target="_blank">
        {node.value}
      </a>
    );
  }
  if (node.type === "text") {
    return node.value;
  }
  return inline(node.type, node.value);
};

export const Markdown = (props: { source: string }) => (
  <div class="chat-md mt-1">
    <For each={parseMarkdown(props.source)}>{renderNode}</For>
  </div>
);
