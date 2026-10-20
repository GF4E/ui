import ts from "typescript"; import fs from "fs"; import path from "path";
const dir = process.argv[2];
const out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".tsx")).sort()) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const vals = [], types = [];
  sf.forEachChild(n => {
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) (n.isTypeOnly || e.isTypeOnly ? types : vals).push(e.name.text);
    } else if (n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) types.push(n.name.text);
      else if (n.name) vals.push(n.name.text);
      else if (ts.isVariableStatement(n)) n.declarationList.declarations.forEach(d => vals.push(d.name.getText()));
    }
  });
  out[f.replace(".tsx", "")] = { vals, types };
}
const seen = {};
for (const [f, { vals }] of Object.entries(out)) for (const v of vals) (seen[v] ??= []).push(f);
console.log(JSON.stringify(out));
console.error("COLLISIONS", JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([k, v]) => v.length > 1))));
