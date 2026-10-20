// Builds the shadcn/ui (base-nova) design-system runtime from a read-only checkout.
// Usage: node scripts/build.mjs [libs|bundle|previews|css|all] [--sections file.json]
import * as esbuild from "esbuild"
import ts from "typescript"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const ROOT = "/home/claude/dsbuild"
const REPO = "/home/claude/gf4e/ui"
const V4 = `${REPO}/apps/v4`
const BASE = `${V4}/registry/bases/base`
const UI = `${BASE}/ui`
const EX = `${BASE}/examples`
const OUT = `${ROOT}/out/project`
const GEN = `${ROOT}/gen`
const NM = `${ROOT}/node_modules`
const NS = "ShadcnUI"

fs.mkdirSync(GEN, { recursive: true })
fs.mkdirSync(`${OUT}/components/lib`, { recursive: true })

const what = process.argv[2] || "all"
const sectionsArg = process.argv.indexOf("--sections")
const SECTIONS = sectionsArg > 0 ? JSON.parse(fs.readFileSync(process.argv[sectionsArg + 1], "utf8")) : null

// The repo's DEFAULT_CONFIG (apps/v4/registry/config.ts), for blocks that read create-page state.
const DEFAULT_CONFIG = { base: "base", style: "nova", baseColor: "neutral", theme: "neutral", chartColor: "neutral", iconLibrary: "lucide", font: "inter", fontHeading: "inherit", item: "Item", rtl: false, pointer: false, menuAccent: "subtle", menuColor: "default", radius: "default", template: "next" }
const define = { "process.env.NODE_ENV": '"production"' }

// ---------- module resolution ----------
const virt = (contents, loader = "js") => ({ contents, loader, resolveDir: ROOT })
const GLOBALS = {
  react: "window.React",
  "react-dom": "window.ReactDOM",
  "react-dom/client": "window.ReactDOM",
  recharts: "window.Recharts",
  sonner: "window.Sonner",
}
const JSX_SHIM = `
const R = window.React;
export const Fragment = R.Fragment;
export function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key })); }
export const jsxs = jsx; export const jsxDEV = jsx;`

function lucideNames(src) {
  return [...new Set([...src.matchAll(/lucide(?:=|:\s*)"([A-Za-z0-9]+)"/g)].map((m) => m[1]))]
}
function iconShim(names) {
  return `import * as React from "react";
import { ${names.join(", ")} } from "lucide-react";
const icons = { ${names.join(", ")} };
export function IconPlaceholder({ lucide, tabler, hugeicons, phosphor, remixicon, ...props }) {
  const I = icons[lucide];
  return I ? React.createElement(I, props) : null;
}`
}

const PLACEHOLDER = "data:image/svg+xml;base64," + fs.readFileSync(`${V4}/public/placeholder.svg`).toString("base64")
const NEXT_IMAGE = `import * as React from "react";
const PH = ${JSON.stringify(PLACEHOLDER)};
export default function Image({ src, alt, fill, priority, quality, placeholder, blurDataURL, loader, unoptimized, style, ...props }) {
  const s = typeof src === "string" && /^https?:/.test(src) ? PH : (src && src.src) || src;
  const st = fill ? Object.assign({ position: "absolute", inset: 0, width: "100%", height: "100%" }, style) : style;
  return React.createElement("img", Object.assign({ src: s, alt, style: st }, props));
}`
const NEXT_LINK = `import * as React from "react";
export default function Link({ href, prefetch, replace, scroll, shallow, legacyBehavior, passHref, ...props }) {
  return React.createElement("a", Object.assign({ href: typeof href === "string" ? href : "#" }, props));
}`
// The repo's example frame, minus min-h-screen / content-center / responsive columns (one column at card width).
const EXAMPLE_SHIM = fs.readFileSync(`${BASE}/components/example.tsx`, "utf8")
  .replace(
    /"mx-auto grid min-h-screen[^"]*"/,
    '"mx-auto grid w-full min-w-0 items-start gap-6 p-4 sm:p-6"'
  )
  .replace(/className=\{cn\(\s*("mx-auto grid[^"]*"),\s*className\s*\)\}/s, "className={$1}")

function plugin({ mode, icons }) {
  return {
    name: "ds",
    setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        const p = a.path
        if (p in GLOBALS) return { path: p, namespace: "global" }
        if (p === "react/jsx-runtime" || p === "react/jsx-dev-runtime") return { path: p, namespace: "jsx" }
        if (p === "@/app/(create)/components/icon-placeholder") return { path: "icons", namespace: "icons" }
        if (p === "next/image") return { path: "next/image", namespace: "shim" }
        if (p === "next/link") return { path: "next/link", namespace: "shim" }
        if (p === "@/registry/bases/base/components/example") return { path: "example", namespace: "example" }
        if (p === "@/registry/bases/base/lib/highlighter") return { path: p, namespace: "stub-hl" }
        if (p === "@/lib/ai") return { path: `${V4}/lib/ai.ts` }
        if (p === "@shadcn/helpers/ai-sdk") return { path: `${REPO}/packages/helpers/src/ai-sdk/index.ts` }
        if (/^@\/components\/ui\/(.+)$/.test(p) && mode === "preview") return { path: p.replace("@/components/ui/", ""), namespace: "ns" }
        if (/^(streamdown|@\/components\/.*)$/.test(p)) return { path: p, namespace: "stub" }
        if (/^@\/app\/\((create|app)\)\/(create\/)?lib\/search-params$/.test(p) || /^@\/app\/\(create\)\/lib\/search-params$/.test(p)) return { path: "search-params", namespace: "search-params" }
        if (p === "shadcn/icons" || p === "shadcn/schema") return { path: p, namespace: "stub" }
        if (mode === "preview" && /^@\/(styles\/base-[a-z]+|registry\/new-york-v4)\/ui\/(.+)$/.test(p)) return { path: p.replace(/^.*\/ui\//, ""), namespace: "ns" }
        let m = p.match(/^@\/registry\/bases\/base\/ui\/(.+)$/)
        if (m) {
          if (mode === "preview") return { path: m[1], namespace: "ns" }
          return { path: `${UI}/${m[1]}.tsx` }
        }
        m = p.match(/^@\/registry\/bases\/base\/(hooks|lib)\/(.+)$/)
        if (m) {
          for (const ext of [".ts", ".tsx"]) if (fs.existsSync(`${BASE}/${m[1]}/${m[2]}${ext}`)) return { path: `${BASE}/${m[1]}/${m[2]}${ext}` }
        }
        m = p.match(/^@shadcn\/react\/(.+)$/)
        if (m) {
          for (const f of ["index.ts", "index.tsx"]) if (fs.existsSync(`${REPO}/packages/react/src/${m[1]}/${f}`)) return { path: `${REPO}/packages/react/src/${m[1]}/${f}` }
        }
        if (p.startsWith("@/")) {
          let rest = p.slice(2).replace(/^app\/\(create\)\//, "app/(app)/(create)/").replace(/^app\/\(app\)\/create\//, "app/(app)/(create)/")
          for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx", ".json"]) {
            const f = `${V4}/${rest}${ext}`
            if (fs.existsSync(f) && fs.statSync(f).isFile()) return { path: f }
          }
        }
        return undefined
      })
      b.onLoad({ filter: /.*/, namespace: "global" }, (a) => virt(`module.exports = ${GLOBALS[a.path]};`))
      b.onLoad({ filter: /.*/, namespace: "jsx" }, () => virt(JSX_SHIM))
      b.onLoad({ filter: /.*/, namespace: "icons" }, () => virt(iconShim(icons), "js"))
      b.onLoad({ filter: /.*/, namespace: "shim" }, (a) => virt(a.path === "next/image" ? NEXT_IMAGE : NEXT_LINK))
      b.onLoad({ filter: /.*/, namespace: "example" }, () => ({ contents: EXAMPLE_SHIM, loader: "tsx", resolveDir: `${BASE}/components` }))
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => virt("module.exports = {};"))
      b.onLoad({ filter: /.*/, namespace: "search-params" }, () => virt(`const DEFAULT = ${JSON.stringify(DEFAULT_CONFIG)};
export function useDesignSystemSearchParams() { return [DEFAULT, () => {}]; }`))
      b.onLoad({ filter: /.*/, namespace: "stub-ai" }, () => virt("export function createChat() { return {}; } export function getMessageText() { return ''; } export function useChat() { throw new Error('AI SDK not bundled in this preview'); }"))
      b.onLoad({ filter: /.*/, namespace: "stub-hl" }, () => virt("export function loadHighlighter() { return Promise.reject(new Error('highlighter not bundled')); }"))
      b.onLoad({ filter: /.*/, namespace: "ns" }, (a) =>
        virt(a.path === "sonner" ? `export const Toaster = window.${NS}.Sonner;` : `module.exports = window.${NS};`)
      )
    },
  }
}

const common = {
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  define,
  jsx: "automatic",
  nodePaths: [NM],
  legalComments: "none",
  logLevel: "warning",
  logOverride: { "unsupported-dynamic-import": "silent" },
}

// ---------- libraries: React 19 + shared runtime singletons ----------
async function libs() {
  const L = [
    ["react", "React", `export * from "react"; import R from "react"; export default R;`, []],
    ["react-dom", "ReactDOM", `export * from "react-dom"; export { createRoot, hydrateRoot } from "react-dom/client";`, ["react"]],
    ["recharts", "Recharts", `export * from "recharts";`, ["react", "react-dom"]],
    ["sonner", "Sonner", `export * from "sonner";`, ["react", "react-dom"]],
  ]
  for (const [name, global, src, ext] of L) {
    const extPlugin = {
      name: "ext",
      setup(b) {
        b.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime)$/ }, (a) =>
          ext.includes(a.path.split("/")[0]) || (a.path === "react/jsx-runtime" && ext.includes("react"))
            ? { path: a.path, namespace: a.path === "react/jsx-runtime" ? "jsx" : "global" }
            : undefined
        )
        b.onLoad({ filter: /.*/, namespace: "global" }, (a) => virt(`module.exports = ${GLOBALS[a.path]};`))
        b.onLoad({ filter: /.*/, namespace: "jsx" }, () => virt(JSX_SHIM))
      },
    }
    await esbuild.build({
      ...common,
      stdin: { contents: src, resolveDir: ROOT, loader: "js" },
      globalName: global,
      plugins: [extPlugin],
      outfile: `${OUT}/components/lib/${name}.production.min.js`,
    })
    const v = JSON.parse(fs.readFileSync(`${NM}/${name}/package.json`, "utf8")).version
    console.log("lib", name, v, fs.statSync(`${OUT}/components/lib/${name}.production.min.js`).size)
  }
}

// ---------- the component bundle ----------
const exportsMap = JSON.parse(fs.readFileSync(`${ROOT}/exports.json`, "utf8"))
async function bundle(cards) {
  const files = Object.keys(exportsMap)
  const lines = []
  for (const f of files) {
    if (f === "sonner") lines.push(`export { Toaster as Sonner } from "${UI}/sonner.tsx";`)
    else lines.push(`export * from "${UI}/${f}.tsx";`)
  }
  const uiIcons = lucideNames(files.map((f) => fs.readFileSync(`${UI}/${f}.tsx`, "utf8")).join("\n"))
  fs.writeFileSync(`${GEN}/ui-icons.json`, JSON.stringify(uiIcons))
  const res = await esbuild.build({
    ...common,
    stdin: { contents: lines.join("\n"), resolveDir: ROOT, loader: "ts" },
    globalName: NS,
    plugins: [plugin({ mode: "bundle", icons: uiIcons })],
    write: false,
    metafile: true,
  })
  let code = res.outputFiles[0].text
  code = code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--")
  const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: NS, components: cards.map((name) => ({ name })) })} */\n`
  fs.writeFileSync(`${OUT}/components/bundle.js`, header + code)
  fs.writeFileSync(`${GEN}/bundle-meta.json`, JSON.stringify(res.metafile))
  console.log("bundle.js", fs.statSync(`${OUT}/components/bundle.js`).size, "icons", uiIcons.length)
}

// ---------- previews from the repo's own example files ----------
function topLevel(file) {
  const src = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const fns = new Map()
  let def = null
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      fns.set(n.name.text, n)
      if (n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) def = n
    }
  })
  const order = []
  if (def) {
    const body = def.body.getText(sf)
    for (const m of body.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) if (fns.has(m[1]) && m[1] !== def.name.text && !order.includes(m[1])) order.push(m[1])
  }
  const exported = new Set()
  sf.forEachChild((n) => {
    if (ts.isExportDeclaration(n) && n.exportClause) n.exportClause.elements.forEach((e) => exported.add(e.name.text))
    if (ts.isFunctionDeclaration(n) && n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) exported.add(n.name.text)
  })
  return { src, order, def: def?.name.text, toExport: [...fns.keys()].filter((k) => !exported.has(k)) }
}

const PATCH = {
  "message-scroller": (src) =>
    src.replace(
      'import { useChat } from "@ai-sdk/react"',
      `import { useState as __useState } from "react"
// Preview-only: the AI SDK's useChat is replaced by local state that steps through the same scripted chat.
function useChat(_opts: any) {
  const [messages, setMessages] = __useState<any[]>(() => chat.get(4))
  return {
    messages,
    status: "ready" as const,
    stop() {},
    sendMessage(_m: any) {
      setMessages((prev) => chat.get(Math.min(prev.length + 2, chat.get().length)))
    },
  }
}`
    ),
}
export const EXAMPLE_FOR = (f) => `${EX}/${f}-example.tsx`

async function previews(list, probe = false) {
  fs.mkdirSync(`${GEN}/previews`, { recursive: true })
  const info = {}
  for (const f of list) {
    const file = EXAMPLE_FOR(f)
    if (!fs.existsSync(file)) { console.log("no example", f); continue }
    const t = topLevel(file)
    const runs = probe ? t.order.map((n) => [n]) : [SECTIONS?.[f] ?? t.order]
    const ex = fs.readFileSync(file, "utf8")
    const icons = lucideNames(ex + fs.readFileSync(`${BASE}/components/example.tsx`, "utf8"))
    for (const chosen of runs) {
    if (!chosen.length) {
      const entryD = `import * as React from "react"; import { createRoot } from "react-dom/client"; import Ex from "${file}";
createRoot(document.getElementById("root")).render(React.createElement(Ex));`
      const resD = await esbuild.build({ ...common, stdin: { contents: entryD, resolveDir: ROOT, loader: "tsx" }, plugins: [plugin({ mode: "preview", icons })], write: false })
      const codeD = resD.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--")
      fs.writeFileSync(`${GEN}/previews/${f}.js`, codeD)
      info[f] = { order: [], chosen: ["default"], bytes: codeD.length }
      continue
    }
    const entry = `
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ExampleWrapper } from "@/registry/bases/base/components/example";
import { ${chosen.join(", ")} } from "${file}";
const S = { ${chosen.join(", ")} };
const order = ${JSON.stringify(chosen)};
createRoot(document.getElementById("root")).render(
  React.createElement(ExampleWrapper, null, order.map((n) => React.createElement("div", { key: n, "data-section": n, className: "min-w-0" }, React.createElement(S[n]))))
);`
    const exportPlugin = {
      name: "export-all",
      setup(b) {
        b.onLoad({ filter: /-example\.tsx$/ }, (a) => {
          const tl = topLevel(a.path)
          const key = path.basename(a.path).replace("-example.tsx", "")
          const body = PATCH[key] ? PATCH[key](tl.src) : tl.src
          if (PATCH[key] && body === tl.src) throw new Error("patch did not apply: " + key)
          return { contents: body + `\nexport { ${tl.toExport.join(", ")} };\n`, loader: "tsx", resolveDir: path.dirname(a.path) }
        })
      },
    }
    const res = await esbuild.build({
      ...common,
      stdin: { contents: entry, resolveDir: ROOT, loader: "tsx" },
      plugins: [exportPlugin, plugin({ mode: "preview", icons })],
      write: false,
    })
    let code = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--")
    if (probe) { fs.mkdirSync(`${GEN}/probe`, { recursive: true }); fs.writeFileSync(`${GEN}/probe/${f}__${chosen[0]}.js`, code) }
    else fs.writeFileSync(`${GEN}/previews/${f}.js`, code)
    info[f] = { order: t.order, chosen, bytes: code.length }
    }
  }
  fs.writeFileSync(`${GEN}/preview-info.json`, JSON.stringify(info, null, 1))
  console.log("previews", Object.keys(info).length)
}

// ---------- pages: blocks, chart galleries, the styles showcase ----------
const BLOCKS = `${BASE}/blocks`
const CHARTS = `${V4}/registry/new-york-v4/charts`
const pascal = (n) => n.split("-").map((x) => (/^\d+$/.test(x) ? x : x[0].toUpperCase() + x.slice(1))).join("")
export function pageList() {
  const out = []
  const reg = fs.readFileSync(`${BLOCKS}/_registry.ts`, "utf8")
  const names = [...reg.matchAll(/^    name: "([a-z0-9-]+)",$/gm)].map((m) => m[1])
  for (const b of names) {
    const entry = ["page.tsx", "index.tsx"].map((f) => `${BLOCKS}/${b}/${f}`).find((f) => fs.existsSync(f))
    if (!entry) { console.log("no entry for block", b); continue }
    if (/^export default function \w+\(\) \{\s*return <div>[^<]*<\/div>\s*\}\s*$/.test(fs.readFileSync(entry, "utf8"))) { console.log("placeholder block skipped:", b); continue }
    const kind = b.split("-")[0]
    out.push({ card: pascal(b), kind: "block", group: { dashboard: "Dashboard blocks", login: "Login blocks", signup: "Signup blocks", sidebar: "Sidebar blocks", preview: "Showcase blocks" }[kind] ?? "Blocks", name: b, entry, dir: `${BLOCKS}/${b}` })
  }
  const creg = fs.readFileSync(`${CHARTS}/_registry.ts`, "utf8")
  const charts = [...creg.matchAll(/name: "(chart-[a-z0-9-]+)"/g)].map((m) => m[1]).filter((c) => fs.existsSync(`${CHARTS}/${c}.tsx`))
  const types = [...new Set(charts.map((c) => c.split("-")[1]))]
  for (const t of types) out.push({ card: `Charts${pascal(t)}`, kind: "charts", group: "Charts", name: t, charts: charts.filter((c) => c.split("-")[1] === t) })
  for (const st of STYLES) out.push({ card: `Style${pascal(st)}`, kind: "styles", group: "Styles", name: st, entry: `${ROOT}/src/showcase/styles.tsx` })
  return out
}

// Blocks reference the app's /placeholder.svg, which a preview frame can't reach: inline the repo's file.
const localImages = {
  name: "local-images",
  setup(b) {
    b.onLoad({ filter: /\/registry\/bases\/base\/blocks\/.*\.tsx$/ }, (a) => ({
      contents: fs.readFileSync(a.path, "utf8").replaceAll('"/placeholder.svg"', JSON.stringify(PLACEHOLDER)),
      loader: "tsx",
      resolveDir: path.dirname(a.path),
    }))
  },
}

async function pages(only) {
  fs.mkdirSync(`${GEN}/pages`, { recursive: true })
  const list = pageList().filter((p) => !only || only.includes(p.card))
  const meta = {}
  for (const pg of list) {
    let entry, icons = []
    if (pg.kind === "block") {
      const files = fs.readdirSync(pg.dir, { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => fs.readFileSync(`${pg.dir}/${f}`, "utf8"))
      icons = lucideNames(files.join("\n"))
      entry = `import * as React from "react"; import { createRoot } from "react-dom/client"; import Page from "${pg.entry}";
createRoot(document.getElementById("root")).render(React.createElement(Page));`
    } else if (pg.kind === "charts") {
      const imports = pg.charts.map((c, i) => {
        const src = fs.readFileSync(`${CHARTS}/${c}.tsx`, "utf8")
        const fn = src.match(/^export (?:default )?function (\w+)/m)?.[1]
        if (!fn) throw new Error("no chart export in " + c)
        return [`import { ${fn} as C${i} } from "${CHARTS}/${c}.tsx";`, `C${i}`, c]
      })
      entry = `import * as React from "react"; import { createRoot } from "react-dom/client";
${imports.map((x) => x[0]).join("\n")}
const items = [${imports.map((x) => `[${JSON.stringify(x[2])}, ${x[1]}]`).join(", ")}];
createRoot(document.getElementById("root")).render(
  React.createElement("div", { className: "grid grid-cols-2 items-start gap-4 bg-muted p-4 dark:bg-background" },
    items.map(([name, C]) => React.createElement("div", { key: name, "data-chart-name": name, className: "min-w-0" }, React.createElement(C)))));`
    } else {
      const src = ["badge-demo", "button-demo", "card-demo", "checkbox-demo", "input-demo", "switch-demo"].map((f) => fs.readFileSync(`${V4}/examples/base/${f}.tsx`, "utf8")).join("\n")
      icons = lucideNames(src)
      entry = `import * as React from "react"; import { createRoot } from "react-dom/client"; import { StylePage } from "${pg.entry}";
createRoot(document.getElementById("root")).render(React.createElement(StylePage, { name: ${JSON.stringify(pg.name)} }));`
    }
    const res = await esbuild.build({
      ...common,
      stdin: { contents: entry, resolveDir: ROOT, loader: "tsx" },
      plugins: [localImages, plugin({ mode: "preview", icons })],
      loader: { ".json": "json" },
      write: false,
    })
    const code = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--")
    fs.writeFileSync(`${GEN}/pages/${pg.card}.js`, code)
    meta[pg.card] = { kind: pg.kind, group: pg.group, name: pg.name, charts: pg.charts, bytes: code.length }
  }
  const prev = fs.existsSync(`${GEN}/pages.json`) && only ? JSON.parse(fs.readFileSync(`${GEN}/pages.json`, "utf8")) : {}
  fs.writeFileSync(`${GEN}/pages.json`, JSON.stringify({ ...prev, ...meta }, null, 1))
  for (const [k, v] of Object.entries(meta)) console.log(k.padEnd(16), v.bytes)
}

// ---------- stylesheet ----------
export const STYLES = ["nova", "vega", "maia", "lyra", "mira", "luma", "sera", "rhea"] // nova first: the default
function css() {
  const others = STYLES.filter((x) => x !== "nova").map((x) => `.style-${x}`).join(", ")
  for (const st of STYLES) {
    const lines = fs.readFileSync(`${V4}/registry/styles/style-${st}.css`, "utf8").split("\n")
    if (lines[0].trim() !== `.style-${st} {`) throw new Error(`unexpected style-${st} wrapper`)
    let out
    if (st === "nova") {
      // Default style: applies wherever no other style class is set (on <html> or any container).
      let last = lines.length - 1
      while (lines[last].trim() === "") last--
      if (lines[last].trim() !== "}") throw new Error("unexpected style-nova end")
      out = lines.slice(1, last).map((l) => {
        const m = l.match(/^  (\.cn-[a-z0-9-]+) \{$/)
        if (/^  [^ /}].*\{$/.test(l) && !m) throw new Error("non-simple nova rule: " + l)
        return m ? `  ${m[1]}:not(:is(${others}) *) {` : l
      }).join("\n")
    } else out = lines.join("\n")
    fs.writeFileSync(`${GEN}/style-${st}.scoped.css`, out)
  }
  fs.copyFileSync(`${REPO}/packages/shadcn/src/tailwind.css`, `${GEN}/shadcn-tailwind.css`)
  const rel = (p) => path.relative(GEN, p)
  const variants = STYLES.map((x) =>
    x === "nova"
      ? `@custom-variant style-nova (&:where(.style-nova *, :not(:is(${others}) *)));`
      : `@custom-variant style-${x} (&:where(.style-${x} *));`
  ).join("\n")
  const input = `/* shadcn/ui · Base UI components in all 8 styles. Nova applies by default; set class="style-<name>" on <html> or a container to switch.
   Colour, radius, spacing and font variables come from tokens.css. */
@import "tailwindcss" source(none);
@import "tw-animate-css";
@import "./shadcn-tailwind.css";

@source "${rel(ROOT + "/scripts")}";
@source "${rel(UI)}";
@source "${rel(EX)}";
@source "${rel(BASE + "/components")}";
@source "${rel(BASE + "/blocks")}";
@source "${rel(V4 + "/registry/new-york-v4/charts")}";
@source "${rel(REPO + "/packages/react/src")}";
@source "${rel(ROOT + "/src")}";

${variants}
@custom-variant dark (&:where(.dark, .dark *, [data-theme$="dark"], [data-theme$="dark"] *));

@theme inline {
  --font-sans: var(--font-sans);
  --font-heading: var(--font-heading, var(--font-sans));
  --font-mono: var(--font-mono);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
${["background","foreground","card","card-foreground","popover","popover-foreground","primary","primary-foreground","secondary","secondary-foreground","muted","muted-foreground","accent","accent-foreground","destructive","border","input","ring","chart-1","chart-2","chart-3","chart-4","chart-5","sidebar","sidebar-foreground","sidebar-primary","sidebar-primary-foreground","sidebar-accent","sidebar-accent-foreground","sidebar-border","sidebar-ring"].map((n) => `  --color-${n}: var(--${n});`).join("\n")}
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@import "./style-nova.scoped.css" layer(base);
`
  fs.writeFileSync(`${GEN}/input.css`, input)
  execFileSync(`${NM}/.bin/tailwindcss`, ["-i", `${GEN}/input.css`, "-o", `${OUT}/components/bundle.css`, "--minify"], { cwd: GEN, stdio: "inherit" })
  let out = fs.readFileSync(`${OUT}/components/bundle.css`, "utf8")
  if (/<\/style/i.test(out)) throw new Error("</style in css")
  console.log("bundle.css", out.length)
  // The other seven styles: one stylesheet each, loaded after bundle.css. @reference resolves @apply without re-emitting Tailwind.
  fs.mkdirSync(`${OUT}/components/styles`, { recursive: true })
  for (const st of STYLES.filter((x) => x !== "nova")) {
    fs.writeFileSync(`${GEN}/alt-${st}.css`, `@reference "./input.css";\n@layer base {\n${fs.readFileSync(`${GEN}/style-${st}.scoped.css`, "utf8")}\n}\n`)
    execFileSync(`${NM}/.bin/tailwindcss`, ["-i", `${GEN}/alt-${st}.css`, "-o", `${OUT}/components/styles/style-${st}.css`, "--minify"], { cwd: GEN, stdio: "pipe" })
    const t = fs.readFileSync(`${OUT}/components/styles/style-${st}.css`, "utf8")
    if (/<\/style/i.test(t)) throw new Error("</style in " + st)
    fs.writeFileSync(`${OUT}/components/styles/style-${st}.css`, `/* shadcn/ui style "${st}": load after bundle.css, then set class="style-${st}" on <html> or a container. */\n` + t)
    console.log(`style-${st}.css`, t.length)
  }
}

const GROUPS = ["Actions", "Forms", "Overlays", "Menus & navigation", "Feedback", "Data display", "Layout", "AI & chat"]
const CARD_FILES = Object.keys(exportsMap).filter((f) => f !== "direction")
const cardName = (f) =>
  ({ sonner: "Sonner", chart: "ChartContainer", "input-otp": "InputOTP", "resizable": "ResizablePanelGroup" }[f] ??
  f.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(""))
fs.writeFileSync(`${GEN}/cards.json`, JSON.stringify(Object.fromEntries(CARD_FILES.map((f) => [f, cardName(f)])), null, 1))

if (what === "libs" || what === "all") await libs()
const ORDERED = fs.existsSync(`${GEN}/card-order.json`)
  ? JSON.parse(fs.readFileSync(`${GEN}/card-order.json`, "utf8")).sort((a, b) => GROUPS.indexOf(a[0]) - GROUPS.indexOf(b[0]) || a[1].localeCompare(b[1])).map((x) => x[1])
  : CARD_FILES.map(cardName)
if (what === "bundle" || what === "all") await bundle(ORDERED)
if (what === "previews" || what === "all") await previews(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3].split(",") : CARD_FILES)
if (what === "css" || what === "all") css()
if (what === "probe") await previews(process.argv[3].split(","), true)
if (what === "pages") await pages(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3].split(",") : null)
