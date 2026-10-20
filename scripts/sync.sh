#!/usr/bin/env bash
# Rebuilds the shadcn/ui design system from a checkout of shadcn-ui/ui at /home/claude/gf4e/ui.
# Run from anywhere: bash /home/claude/dsbuild/scripts/sync.sh <short-sha>
# Output: out/project (the system's files) and gen/check.txt. Publishing is done by the agent (see SYNC.md).
set -euo pipefail
SHA="${1:?usage: sync.sh <short-sha>}"
D=/home/claude/dsbuild
R=/home/claude/gf4e/ui
UI=$R/apps/v4/registry/bases/base/ui
cd "$D"
[ -d node_modules ] || npm ci --no-audit --no-fund --loglevel=error
mkdir -p gen out/project/components out/project/assets/Icons
# hand-written files (README, cover) come from static/; everything else is rebuilt
rm -rf out/project && mkdir -p out/project/components/Cover out/project/assets/Icons
cp static/README.md out/project/README.md
cp static/Cover.preview.html out/project/components/Cover/preview.html
rm -rf gen/previews gen/probe gen/pages gen/render-*.json gen/sections.json gen/order.json gen/card-order.json

echo "== source"
node scripts/exports.mjs "$UI" > exports.json 2> gen/collisions.txt; cat gen/collisions.txt
./node_modules/.bin/esbuild "$R/apps/v4/registry/themes.ts" --format=esm --outfile=gen/themes.mjs --log-level=error
node --input-type=module -e 'import { THEMES } from "/home/claude/dsbuild/gen/themes.mjs"; import fs from "fs"; fs.writeFileSync("/home/claude/dsbuild/gen/themes.json", JSON.stringify(THEMES, null, 1))'

echo "== build"
node scripts/build.mjs libs
node scripts/build.mjs bundle
node scripts/build.mjs pages
node scripts/build.mjs css
node scripts/icons.mjs > /dev/null
SHA="$SHA" node scripts/tokens.mjs > gen/contrast.txt

echo "== previews"
node scripts/build.mjs previews 2>/dev/null
node scripts/render.mjs measure > gen/measure.txt
BROKEN=$(node -e 'const r=require("/home/claude/dsbuild/gen/render-measure.json"); console.log(Object.entries(r).filter(([k,v])=>v.errors.length).map(([k])=>k).join(","))')
if [ -n "$BROKEN" ]; then
  echo "probing sections of: $BROKEN"
  node scripts/order.mjs "$BROKEN"
  node scripts/build.mjs probe "$BROKEN" 2>/dev/null
  node scripts/render.mjs probe > gen/probe.txt
fi
node scripts/select.mjs
rm -rf gen/previews && node scripts/build.mjs previews --sections gen/sections.json 2>/dev/null
node scripts/render.mjs measure > gen/measure.txt
node scripts/render.mjs pages > gen/pages.txt

echo "== types"
node -e '
const fs=require("fs"); const c=JSON.parse(fs.readFileSync("tsconfig.dts.json")); const UI=process.argv[1];
c.files=fs.readdirSync(UI).filter(f=>f.endsWith(".tsx")).map(f=>UI+"/"+f); fs.writeFileSync("tsconfig.dts.json", JSON.stringify(c,null,1))' "$UI"
rm -rf dts && ./node_modules/.bin/tsc -p tsconfig.dts.json > gen/tsc.txt 2>&1 || true

echo "== assemble"
node scripts/assemble.mjs
node scripts/build.mjs bundle
node scripts/assemble-pages.mjs
SHA="$SHA" node scripts/tokens.mjs > gen/contrast.txt
node scripts/docs.mjs > /dev/null

echo "== check"
node scripts/render.mjs check > gen/check.txt
node -e 'const r=require("/home/claude/dsbuild/gen/render-check.json"); const bad=Object.entries(r).filter(([k,v])=>v.errors.length); if(bad.length){console.log("RENDER ERRORS:", bad.map(([k,v])=>k+": "+v.errors[0]).join("\n")); process.exit(1)} console.log("all", Object.keys(r).length, "cards render in light and dark")'
