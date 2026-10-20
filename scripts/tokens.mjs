// Writes project/tokens.json from the repo's default config (base-nova, neutral) and reports WCAG contrast.
import fs from "node:fs"
const REPO = "/home/claude/gf4e/ui"
const OUT = "/home/claude/dsbuild/out/project"
const SHA = process.env.SHA
if (!SHA) throw new Error("set SHA")

const src = fs.readFileSync(`${REPO}/apps/v4/registry/themes.ts`, "utf8")
const start = src.indexOf('name: "neutral"')
const block = src.slice(start, src.indexOf('name: "stone"'))
const grab = (which) => {
  const s = block.indexOf(`${which}: {`)
  const body = block.slice(s, block.indexOf("}", s))
  return Object.fromEntries([...body.matchAll(/^\s+"?([a-z0-9-]+)"?: "([^"]+)",/gm)].map((m) => [m[1], m[2]]))
}
const light = grab("light"), dark = grab("dark")

const USAGE = {
  background: "Default app background: the page shell and page sections. Pairs with `foreground`.",
  foreground: "Default text and icon colour on `background`, `card` and `popover`.",
  card: "Elevated surfaces: `Card`, dashboard and settings panels. Pairs with `card-foreground`.",
  "card-foreground": "Text and icons on `card`.",
  popover: "Floating surfaces: `Popover`, `DropdownMenu`, `ContextMenu`, `Select`, `HoverCard`. Pairs with `popover-foreground`.",
  "popover-foreground": "Text and icons on `popover`.",
  primary: "High-emphasis actions and brand surfaces: the default `Button`, selected states, default `Badge`, active accents. Pairs with `primary-foreground`.",
  "primary-foreground": "Text and icons on `primary`.",
  secondary: "Lower-emphasis filled actions and supporting surfaces: secondary `Button` and `Badge`. Pairs with `secondary-foreground`.",
  "secondary-foreground": "Text and icons on `secondary`.",
  muted: "Subtle surfaces: skeletons, tab lists, code and kbd chips, disabled fills. Pairs with `muted-foreground`.",
  "muted-foreground": "Lower-emphasis text: descriptions, placeholders, helper text, empty states. Reads on `background`, `card`, `popover` and `muted`.",
  accent: "Interactive hover, focus and active surfaces: ghost `Button` hover, highlighted menu items, hovered rows, selected items. Pairs with `accent-foreground`.",
  "accent-foreground": "Text and icons on `accent`.",
  destructive: "Destructive actions and error emphasis: destructive `Button` (as text on a 10% tint), invalid field borders and rings, destructive menu items, `FieldError` text.",
  border: "Default borders and separators: cards, menus, tables, `Separator`, layout dividers.",
  input: "Form-control borders and the input surface tint (`dark:bg-input/30`): `Input`, `Textarea`, `Select`, outline controls.",
  ring: "Focus rings and outlines on focusable controls; applied at 50% (`ring-ring/50`, `ring-3`) with a solid `border-ring`.",
  "chart-1": "Chart palette, series 1. In the default neutral theme the five series are greys from light to dark.",
  "chart-2": "Chart palette, series 2.",
  "chart-3": "Chart palette, series 3.",
  "chart-4": "Chart palette, series 4.",
  "chart-5": "Chart palette, series 5.",
  sidebar: "The `Sidebar` container surface. Pairs with `sidebar-foreground`.",
  "sidebar-foreground": "Default text and icons inside the sidebar, on `sidebar`.",
  "sidebar-primary": "High-emphasis actions inside the sidebar: active items, icon tiles, badges, sidebar CTAs. Pairs with `sidebar-primary-foreground`.",
  "sidebar-primary-foreground": "Text and icons on `sidebar-primary`.",
  "sidebar-accent": "Hover and selected states inside the sidebar: menu hover, open items, interactive rows. Pairs with `sidebar-accent-foreground`.",
  "sidebar-accent-foreground": "Text and icons on `sidebar-accent`.",
  "sidebar-border": "Sidebar headers, groups and internal dividers.",
  "sidebar-ring": "Focus rings on controls inside the sidebar.",
}

// ---- WCAG contrast for oklch values ----
function oklchToRgb(s) {
  const m = s.match(/oklch\(([\d.]+%?) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)/)
  let L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  const C = parseFloat(m[2]), H = (parseFloat(m[3]) * Math.PI) / 180
  const a = C * Math.cos(H), b = C * Math.sin(H)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, mm = m_ ** 3, ss = s_ ** 3
  let r = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss
  let g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss
  let bb = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss
  const alpha = m[4] ? parseFloat(m[4]) / 100 : 1
  return { rgb: [r, g, bb].map((v) => Math.min(1, Math.max(0, v))), alpha }
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b // linear already
function over(fg, bg) {
  const F = oklchToRgb(fg), B = oklchToRgb(bg)
  // composite in sRGB-encoded space
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
  const dec = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return F.rgb.map((c, i) => dec(enc(c) * F.alpha + enc(B.rgb[i]) * (1 - F.alpha)))
}
function contrast(fg, bg) {
  const a = lum(over(fg, bg)), b = lum(oklchToRgb(bg).rgb)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const hexOf = (s, bg) => "#" + over(s, bg ?? "oklch(1 0 0)").map((v) => Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, "0")).join("")

const PAIRS = [
  ["foreground", "background", 4.5], ["card-foreground", "card", 4.5], ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5], ["secondary-foreground", "secondary", 4.5], ["accent-foreground", "accent", 4.5],
  ["muted-foreground", "background", 4.5], ["muted-foreground", "card", 4.5], ["muted-foreground", "muted", 4.5],
  ["destructive", "background", 4.5], ["destructive", "card", 4.5],
  ["sidebar-foreground", "sidebar", 4.5], ["sidebar-primary-foreground", "sidebar-primary", 4.5], ["sidebar-accent-foreground", "sidebar-accent", 4.5],
  ["input", "background", 3], ["ring", "background", 3], ["border", "background", 3],
]
// ---- the 8 live themes: neutral, plus three accents merged over neutral (buildRegistryTheme, chartColor = theme) ----
const THEMES = JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/themes.json", "utf8"))
const byName = Object.fromEntries(THEMES.map((t) => [t.name, t]))
export const ACCENTS = (process.env.ACCENTS || "blue,emerald,amber").split(",")
const N = byName.neutral.cssVars
const LIVE = [["light", "Light", N.light], ["dark", "Dark", N.dark]]
for (const a of ACCENTS) {
  const t = byName[a]
  if (!t) throw new Error("no theme " + a)
  LIVE.push([`${a}-light`, `${t.title} light`, { ...N.light, ...t.cssVars.light }])
  LIVE.push([`${a}-dark`, `${t.title} dark`, { ...N.dark, ...t.cssVars.dark }])
}
if (LIVE.length > 8) throw new Error("more than 8 themes")

const report = {}
for (const [id, , vars] of LIVE) {
  report[id] = PAIRS.map(([f, b, need]) => {
    const r = contrast(vars[f], vars[b])
    return { pair: `${f} on ${b}`, ratio: +r.toFixed(2), need, pass: r >= need }
  })
}
fs.mkdirSync("/home/claude/dsbuild/gen", { recursive: true })
fs.writeFileSync("/home/claude/dsbuild/gen/contrast.json", JSON.stringify(report, null, 1))
for (const [id, rows] of Object.entries(report)) for (const r of rows) if (!r.pass) console.log(id.padEnd(14), "FAIL", r.ratio.toString().padEnd(6), r.pair)

// ---- notes for failing source pairs (kept exact) ----
const flag = (pair) => {
  const bad = Object.entries(report).map(([id, rows]) => [id, rows.find((r) => r.pair === pair)]).filter(([, r]) => r && !r.pass)
  return bad.length ? ` Source value kept exact: ${pair} is ${bad.map(([id, r]) => `${id} ${r.ratio}:1`).join(", ")}, under ${bad[0][1].need}:1.` : ""
}
for (const [f, b] of PAIRS) {
  const note = flag(`${f} on ${b}`)
  if (note) USAGE[f] = (USAGE[f] ?? "") + note
}
USAGE.border += " Decorative dividers; controls rely on `input`, not `border`, for their edge."
USAGE["chart-1"] = "Chart palette, series 1. Neutral themes: five greys from light to dark. Accent themes: five steps of the accent hue."

const order = Object.keys(N.light).filter((k) => k !== "radius")
const tokens = order.map((name) => ({
  name,
  value: Object.fromEntries(LIVE.map(([id, , vars]) => [id, vars[name]])),
  usage: USAGE[name] ?? "",
}))
for (const t of tokens) for (const [id, v] of Object.entries(t.value)) if (!v) throw new Error(`missing ${t.name} in ${id}`)

const T = {
  name: "shadcn/ui",
  version: 1,
  meta: {
    source: "github",
    repo: "shadcn-ui/ui",
    fork: "GF4E/ui",
    ref: `main@${SHA}`,
    package: "apps/v4",
    config: "base-nova · neutral base colour · neutral theme · neutral chart colour · Inter · Lucide · radius default (0.625rem)",
    paths: {
      tokens: ["apps/v4/registry/themes.ts", "apps/v4/registry/config.ts", "packages/shadcn/src/tailwind.css"],
      fonts: ["apps/v4/lib/font-definitions.ts"],
      assets: ["apps/v4/registry/bases/base/ui (IconPlaceholder lucide names)"],
      docs: ["apps/v4/content/docs/(root)/theming.mdx", "apps/v4/content/docs/(root)/index.mdx", "apps/v4/content/docs/components/base/*.mdx", "apps/v4/registry/new-york-v4/examples/typography-*.tsx"],
      styles: ["apps/v4/registry/styles/style-*.css", "apps/v4/app/style-registry.css"],
      blocks: ["apps/v4/registry/bases/base/blocks"],
      charts: ["apps/v4/registry/new-york-v4/charts"],
    },
    components: Object.fromEntries(
      Object.entries(JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/cards.json", "utf8"))).map(([f, n]) => [n, `apps/v4/registry/bases/base/ui/${f}.tsx`])
    ),
    pages: fs.existsSync("/home/claude/dsbuild/gen/pages.json") ? JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/pages.json", "utf8")) : {},
    synced: new Date().toISOString().slice(0, 10),
  },
  color: {
    note: `Light and Dark are the repo default (neutral base colour, neutral theme). The accent themes (${ACCENTS.join(", ")}) are each merged over neutral exactly as \`buildRegistryTheme\` does, chart colours included. Every surface token pairs with a \`-foreground\` token. In an app, dark is the \`.dark\` class; here it is any theme id ending in \`dark\`. All 24 source themes are listed in the Color themes section.`,
    themes: LIVE.map(([id, name]) => ({ id, name })),
    tokens,
  },
  type: {
    fonts: [],
    families: {
      sans: "Inter, 'Inter Variable', sans-serif",
      heading: "Inter, 'Inter Variable', sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    groups: [
      {
        name: "Typography",
        family: "sans",
        styles: [
          { name: "h1", fontSize: "2.25rem", lineHeight: "2.5rem", fontWeight: 800, letterSpacing: "-0.025em", sample: "Taxing Laughter: The Joke Tax Chronicles", usage: "Page title, once per page: `text-4xl font-extrabold tracking-tight text-balance`, in `font-heading`." },
          { name: "h2", fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: 600, letterSpacing: "-0.025em", sample: "The People of the Kingdom", usage: "Section heading: `text-3xl font-semibold tracking-tight`, with a `border-b pb-2` rule under it." },
          { name: "h3", fontSize: "1.5rem", lineHeight: "2rem", fontWeight: 600, letterSpacing: "-0.025em", sample: "The Joke Tax", usage: "Sub-section heading: `text-2xl font-semibold tracking-tight`." },
          { name: "h4", fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: 600, letterSpacing: "-0.025em", sample: "People stopped telling jokes", usage: "Minor heading: `text-xl font-semibold tracking-tight`." },
          { name: "lead", fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: 400, sample: "A modal dialog that interrupts the user with important content and expects a response.", usage: "Intro paragraph under a page title, in `muted-foreground`." },
          { name: "p", fontSize: "1rem", lineHeight: "1.75rem", fontWeight: 400, sample: "The king, seeing how much happier his subjects were, realized the error of his ways and repealed the joke tax.", usage: "Long-form body copy (`leading-7`); consecutive paragraphs get `mt-6`." },
          { name: "large", fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: 600, sample: "Are you absolutely sure?", usage: "Emphasised standalone line: `text-lg font-semibold`." },
          { name: "small", fontSize: "0.875rem", lineHeight: "1", fontWeight: 500, sample: "Email address", usage: "Labels and compact captions: `text-sm leading-none font-medium`." },
          { name: "muted", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 400, sample: "Enter your email address.", usage: "Secondary text in `muted-foreground`: `text-sm`." },
          { name: "blockquote", fontSize: "1rem", lineHeight: "1.5rem", fontWeight: 400, fontStyle: "italic", sample: "\"After all,\" he said, \"everyone enjoys a good joke, so it's only fair that they should pay for the privilege.\"", usage: "Quotations: italic with a `border-l-2 pl-6` rule." },
          { name: "inline-code", family: "mono", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 600, sample: "@radix-ui/react-alert-dialog", usage: "Code in running text: `font-mono text-sm font-semibold` on a `muted` chip, `rounded` with `px-[0.3rem] py-[0.2rem]`." },
        ],
      },
      {
        name: "Interface",
        family: "sans",
        styles: [
          { name: "ui-base", fontSize: "1rem", lineHeight: "1.375", fontWeight: 500, sample: "Card title", usage: "Card titles (`text-base leading-snug font-medium`); dialog and sheet titles use the same size at `leading-none`." },
          { name: "ui-sm-medium", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 500, sample: "Save changes", usage: "Buttons, labels, tab and menu-trigger text (`text-sm font-medium`)." },
          { name: "ui-sm", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 400, sample: "Make changes to your profile here.", usage: "Default control and body text inside components: inputs, menu items, descriptions (`text-sm`)." },
          { name: "ui-xs-medium", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 500, sample: "Badge", usage: "Badges, kbd, small buttons, menu group labels (`text-xs font-medium`)." },
          { name: "ui-xs", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 400, sample: "⌘K", usage: "Tooltips, shortcuts and the smallest helper text (`text-xs`)." },
        ],
      },
    ],
  },
  spacing: {
    note: "Tailwind v4 spacing: one base unit, and every `p-*`, `m-*`, `gap-*`, `size-*` step is `calc(var(--spacing) * n)`. Change `spacing` and the whole scale follows.",
    tokens: [
      { name: "spacing", value: "0.25rem", usage: "The base unit (4px at a 16px root). Nova steps used most: 1 (4px), 1.5 (6px), 2 (8px), 2.5 (10px), 3 (12px), 4 (16px), 6 (24px)." },
    ],
  },
  radius: {
    note: "One source: `radius`. Components use the derived scale sm ×0.6, md ×0.8, lg ×1, xl ×1.4, 2xl ×1.8, 3xl ×2.2, 4xl ×2.6, so changing `radius` re-rounds everything.",
    tokens: [
      { name: "radius", value: light.radius, usage: "Base corner radius (= `rounded-lg`, 10px). Derived: sm 6px, md 8px, lg 10px, xl 14px, 2xl 18px, 3xl 22px, 4xl 26px. Nova: buttons and inputs `rounded-lg`, cards `rounded-xl`, menus and popovers `rounded-lg`, badges `rounded-4xl`." },
    ],
  },
}
fs.writeFileSync(`${OUT}/tokens.json`, JSON.stringify(T, null, 2) + "\n")
console.log("tokens", tokens.length, "hex samples", hexOf(light["muted-foreground"]), hexOf(light.ring), hexOf(light.destructive))
