import { For } from "solid-js";
import { parseMarkdown, type MdNode } from "@chat-refine/shared";

const renderNode = (node: MdNode) => {
  switch (node.type) {
    case "br":
      return <br />;
    case "strong":
      return <strong>{node.value}</strong>;
    case "em":
      return <em>{node.value}</em>;
    case "code":
      return <code>{node.value}</code>;
    case "pre":
      return (
        <pre>
          <code>{node.value}</code>
        </pre>
      );
    case "a":
      return (
        <a href={node.href} rel="noreferrer noopener" target="_blank">
          {node.value}
        </a>
      );
    default:
      return node.value;
  }
};

export const Markdown = (props: { source: string }) => (
  <div class="chat-md mt-1">
    <For each={parseMarkdown(props.source)}>{renderNode}</For>
  </div>
);
