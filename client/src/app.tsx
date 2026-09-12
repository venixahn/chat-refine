import type { JSX } from "solid-js";

export const App = (props: { children?: JSX.Element }) => (
  <div class="min-h-screen">{props.children}</div>
);
