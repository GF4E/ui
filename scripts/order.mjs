// Writes gen/order.json: each named example's sections in the order its default export renders them.
import fs from "node:fs"
import ts from "typescript"
const EX = "/home/claude/gf4e/ui/apps/v4/registry/bases/base/examples"
const out = {}
for (const f of (process.argv[2] || "").split(",").filter(Boolean)) {
  const src = fs.readFileSync(`${EX}/${f}-example.tsx`, "utf8")
  const sf = ts.createSourceFile("x.tsx", src, 99, true, 4)
  const fns = new Set(); let def
  sf.forEachChild((n) => { if (ts.isFunctionDeclaration(n) && n.name) { fns.add(n.name.text); if (n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) def = n } })
  const o = []
  if (def) for (const m of def.body.getText(sf).matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) if (fns.has(m[1]) && !o.includes(m[1])) o.push(m[1])
  out[f] = o
}
fs.writeFileSync("/home/claude/dsbuild/gen/order.json", JSON.stringify(out))
console.log("order for", Object.keys(out).join(", ") || "none")
