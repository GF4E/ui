shadcn/ui is not a component library you install. It is the code for one: you add a component's source to your app (`npx shadcn@latest add button`), then own and edit it. This system follows the repository's main branch. Its default is **base-nova**: Base UI primitives, the Nova style, the neutral palette, Inter and Lucide icons, with a 0.625rem radius. The other seven styles, three accent themes, 29 blocks and 71 chart recipes sit on top of it.

> "This is not a component library. It is how you build your component library."

## Principles

- **Open code.** The top layer of every component is yours to edit. Change the component file, not an override stylesheet.
- **Composition.** Every component shares one interface: small named parts (`Card`, `CardHeader`, `CardTitle`, `CardContent`) that you assemble. Learn one, read them all.
- **Beautiful defaults.** Neutral surfaces, quiet borders, one strong ink. Components look finished on their own and match each other without tuning.
- **Semantic tokens over literal colours.** Components only reference tokens (`bg-primary`, `text-muted-foreground`). Retheme by changing token values, never class names.
- **Style is structure, theme is colour.** A style sets heights, padding, radii and casing. A theme sets colours. Any style works with any theme.

## Content

- Write UI copy in the second person and in sentence case: "Save changes", "Accept terms and conditions", "Enter your email address."
- Buttons are short verbs or verb phrases: "Continue", "Cancel", "Save changes", "Delete".
- A dialog title asks or states the one thing at stake; the description says the consequence in one sentence. The house example: **Are you absolutely sure?** / "This action cannot be undone. This will permanently delete your account and remove your data from our servers."
- Helper and description text is one sentence in `muted-foreground`. Errors say what to fix: "Enter a valid email address."
- No emoji in interface chrome. Icons carry meaning only beside a word, or with an `sr-only` label when alone.

## Colour

Every surface token has a `-foreground` partner for the text and icons on it: `primary` + `primary-foreground`, `card` + `card-foreground`. Use the pair together, always.

- Page: `background` with `foreground`. Elevated panels: `card` with `card-foreground`. Floating layers (menus, popovers, dialogs, selects): `popover` with `popover-foreground`.
- One high-emphasis action per view in `primary`. Lower emphasis: `secondary`, then outline (`border-border` on `background`), then ghost.
- `accent` is for interaction feedback only: hover, focus and the highlighted item in menus and lists. Never use it as a decorative fill.
- `muted` is for quiet fills (skeletons, tab lists, code and kbd chips); `muted-foreground` is for descriptions, placeholders and captions.
- `destructive` is the error hue. Destructive buttons are `destructive` text on a 10% tint (`bg-destructive/10`), not a solid red fill. Invalid fields get a `destructive` border and a `destructive/20` ring via `aria-invalid`.
- `border` draws dividers and table rules; `input` draws control edges and, in dark, tints control fills (`bg-input/30`).
- Charts use `chart-1` to `chart-5`. In the neutral themes they are five greys: label series directly rather than relying on hue. In the accent themes they are five steps of the accent.
- The sidebar has its own set (`sidebar`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`) so it can contrast with the page.

Themes. Eight are live here: Light and Dark (the repo default) plus Blue, Emerald and Amber in light and dark. An accent theme changes only `primary`, `secondary`, the chart series and `sidebar-primary`, merged over neutral the way the repo's `buildRegistryTheme` does. All 24 source themes, with exact values, are in the Color themes section.

- In an app, dark mode is the `.dark` class on `<html>`. Here it is any theme whose id ends in `dark`. Both drive Tailwind's `dark:` variant.
- Use one accent per product. Keep `destructive` red in every theme; don't pick an accent that competes with it.

Contrast, checked in all eight themes with the source values kept exact:
- Text pairs pass 4.5:1, with two exceptions. `muted-foreground` on `muted` is 4.34:1 in the light themes: keep muted text off `muted` fills at small sizes. `sidebar-primary-foreground` on `sidebar-primary` is 3.45:1 in Blue dark, 3.48:1 in Emerald light and 3.08:1 in Amber light: use that pair for icons and large labels only.
- `border` and `input` are about 1.3:1 against `background`. Control edges are faint by design; focus and invalid states carry the signal.
- `ring` is 2.6:1 in the light themes, applied at 50% as a 3px halo with a solid `border-ring`. Don't rely on the halo alone for focus on custom controls.

## Type

- One family: `font-sans` is Inter (Google Fonts, or `@fontsource-variable/inter` as `'Inter Variable'`). `font-heading` inherits `font-sans`. `font-mono` is the platform monospace stack.
- Interface text is small. Controls, menus, tables and descriptions are `ui-sm` (14px); buttons, labels and tabs are `ui-sm-medium`; badges, kbd and menu labels are `ui-xs-medium` (12px); card titles are `ui-base`.
- Inputs are 16px on mobile and 14px from `md` up (`text-base md:text-sm`) so iOS doesn't zoom.
- Editorial pages use the Typography scale: `h1` (36px, 800, tight tracking, once per page), `h2` (30px, 600, with a bottom rule), `h3`, `h4`, then `p` at 16px on a 28px line. Open with `lead` in `muted-foreground`. For rendered markdown, use Typeset (its own section).
- Weight does the hierarchy work: 500 for interactive labels, 600 for headings, 800 only for `h1`.

## Space, shape and depth (Nova)

- Spacing is Tailwind's 4px unit (`spacing`). Nova is compact: controls are `h-8` (buttons, inputs, select triggers), with `h-6`, `h-7` and `h-9` for xs, sm and lg. Padding inside controls is `px-2.5`. Cards pad 16px (`--card-spacing`).
- Corners come from one token, `radius` (10px). Buttons, inputs, menus and popovers are `rounded-lg` (10px); cards and dialogs `rounded-xl` (14px); badges `rounded-4xl` (pill); tooltips `rounded-md`; checkboxes `rounded-[4px]`. Change `radius` and every corner follows.
- Cards and dialogs are separated by a hairline ring, `ring-1 ring-foreground/10`, not a border or a shadow. Menus and popovers add `shadow-md` to that ring. Shadows are Tailwind's defaults; nothing else casts one.
- Modal overlays are a 10% black scrim with a light blur (`bg-black/10 backdrop-blur-xs`).
- The other styles change these numbers, not the rules: Vega and Maia are `h-9`, Mira `h-7`, Sera `h-10` with uppercase buttons; Lyra and Sera are square; Maia, Luma and Rhea are pill-round. The Styles section has the full table.

## State and motion

- Focus: `focus-visible:border-ring` plus `focus-visible:ring-3 ring-ring/50`. Every focusable part shows it; never remove the outline without this replacement.
- Invalid: set `aria-invalid` on the control; the border turns `destructive` and the ring `destructive/20` (`/40` in dark). Pair it with a `FieldError` message.
- Disabled: `opacity-50` and no pointer events. Keep the label readable.
- Pressed buttons shift down 1px (`active:translate-y-px`).
- Motion is short and functional: popovers, menus, dialogs and tooltips fade and zoom from 95% over 100ms, sliding 8px from their side. Accordions and collapsibles animate height with `accordion-down` and `accordion-up`. Nothing loops except `Spinner`.
- Components expose state as data attributes (`data-open`, `data-checked`, `data-disabled`, `data-orientation`) and their part as `data-slot`. Style against those, not internal class names.

## Iconography

- Icons are [Lucide](https://lucide.dev): 24px grid, 2px stroke, round caps and joins, `currentColor`. Components size them to 16px (`size-4`); small buttons and badges to 12px.
- An icon inside a `Button`, `Badge` or `InputGroup` takes `data-icon="inline-start"` or `data-icon="inline-end"` so padding adjusts on that side.
- Icon-only buttons use `size="icon"` (or `icon-xs`, `icon-sm`, `icon-lg`) and an `sr-only` label.
- `Assets › Icons` holds the 17 Lucide glyphs the components themselves draw (chevrons, check, close, search, loaders, status icons). For anything else, import from `lucide-react`.
- There is no logo in this system. Set the product name in type.

## What's here

- **Components** (63 pages): every Base UI component, live in Nova, grouped Actions, Forms, Overlays, Menus & navigation, Feedback, Data display, Layout, and AI & chat. Each page has the component's composition tree, usage and API notes.
- **Styles** (8 pages): the same demos in each style.
- **Blocks** (29 pages): dashboard, 5 login, 5 signup, 16 sidebar layouts and the 2 `shadcn/create` showcase grids, each installable with `npx shadcn@latest add <name>`.
- **Charts** (7 pages): all 71 chart recipes by type: area, bar, line, pie, radar, radial, tooltip.
- **Guides** (21 sections): Styles, Color themes, Theming, Dark mode, Typeset, both form libraries, RTL, a new-project checklist, install for Next.js and Vite, CLI, `components.json`, Tailwind v4, React 19, monorepos, package imports, registries, the MCP server, skills, and a blocks-and-charts index.

## Building with it

- In an app: `npx shadcn@latest init`, then `npx shadcn@latest add <component>`. Components land in `components/ui/` and import from `@/components/ui/<name>`.
- Compose from parts, and pass behaviour through Base UI props. To render a part as another element, use Base UI's `render` prop (`<DialogTrigger render={<Button variant="outline" />}>`). Links that look like buttons use `buttonVariants()` on a plain `<a>`.
- Classes you pass to a component win over its style: the style rules sit in Tailwind's base layer, as in the repo.
- Using this system's files directly: load `tokens.css`, `components/bundle.css`, the libraries, then `components/bundle.js` (`window.ShadcnUI`). For another style, add `components/styles/style-<name>.css` and `class="style-<name>"`.
- Add a token the shadcn way: declare `--warning` and `--warning-foreground` under `:root` and `.dark`, expose them in `@theme inline` as `--color-warning`, then use `bg-warning text-warning-foreground`.

## Not synced

From shadcn-ui/ui `main` at `ba1503c`, read through the GF4E/ui fork. A weekly job rebuilds this system when `main` moves.
- Not included: the Radix and React Aria bases (the same components on other primitives), the legacy new-york-v4 component set, the six other base colours and 14 other accents as live themes (their values are in Color themes), 25 of the 26 font options, the Tabler, Hugeicons, Phosphor and Remix icon sets, the `preview-03` block (a placeholder in the source), and the docs site's own `surface`, `code` and `selection` tokens.
- Not tokens: the radius scale (derived from `radius` by `calc()`), the spacing steps (multiples of `spacing`) and Tailwind's shadows. They are described above and live in the stylesheet.
- No font files: Inter is a hosted Google font in the source. The logo marks in the repository (shadcn, Radix, Base UI, React Aria) were left out by choice.
- Built, not hand-written: the 64 `base/ui` sources bundled with esbuild into `components/bundle.js`, the eight style sheets compiled with Tailwind 4.3.0, and React 19.2.3, Recharts 3.8.0 and Sonner 2.0.7 shipped as library files. `DirectionProvider` is exported but has no page.
- Previews mount the repo's own examples. Component pages show the first sections of each example file. `CodeBlock` shows no syntax colours (shiki is not bundled). `MessageScroller` steps through its scripted chat with local state instead of the AI SDK. Blocks that read `shadcn/create` state get the repo's default config. Chart recipes come from the new-york-v4 set and render with the Base UI `Card` and `ChartContainer`.
