import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.ts";

describe("renderMarkdown", () => {
  it("renders light emphasis and code", () => {
    expect(renderMarkdown("**hi** and *there* and `x`")).toBe(
      "<strong>hi</strong> and <em>there</em> and <code>x</code>",
    );
  });

  it("keeps only http(s) links", () => {
    expect(renderMarkdown("[docs](https://example.com/a)")).toContain(
      'href="https://example.com/a"',
    );
    expect(renderMarkdown("[bad](javascript:alert(1))")).toBe("bad");
    expect(renderMarkdown("[a](https://a.test) [b](https://b.test)")).toContain(
      'href="https://b.test"',
    );
  });

  it("escapes raw HTML so scripts cannot run", () => {
    const html = renderMarkdown('<script>alert(1)</script> **ok**');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>ok</strong>");
  });
});
