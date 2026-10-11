// Regression harness: renders the REAL RightPanel through the REAL modules and
// asserts it does not throw. tsc cannot catch an unbound identifier in JSX --
// that is a runtime ReferenceError, and the build still passes. This can.
// Run: npx esbuild ./.rheo-verify.tsx --bundle --platform=node --format=cjs \
//        --outfile=/tmp/rv.cjs --define:process.env.NODE_ENV='"development"' && node /tmp/rv.cjs
import "./.rheo-globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RightPanel } from "./src/terminal/components/Panels";

const store: any = new Proxy({
  rightTab: "handbook",   // the branch that evaluates notes={notes}
  tabs: [{ id: "t1", label: "nova", color: "#06b6d4", layout: "grid",
           panes: { a: { id: "a", cwd: "/home/user", lines: [], cmdHistory: [] } } }],
  groups: [], workspaces: [], commands: [], history: [], shortcuts: [], appearance: {}, keys: [],
}, { get: (t, k: string) => (k in t ? (t as any)[k] : []) });

try {
  const html = renderToStaticMarkup(createElement(RightPanel as any, {
    store, notify: () => {},
    groupCtl: { renameG: null, setRenameG: () => {}, gDraft: "", setGDraft: () => {} },
  }));
  console.log("PASS RightPanel rendered, no ReferenceError (" + html.length + " bytes)");
} catch (e: any) {
  console.log("FAIL", e?.constructor?.name + ":", e?.message);
  process.exit(1);
}
