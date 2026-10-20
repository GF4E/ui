// Style pages: the repo's own base docs demos inside a container with class="style-<name>".
// A non-default style's page links that style's stylesheet after bundle.css.
import * as React from "react"

import { STYLES } from "@/registry/styles"
import BadgeDemo from "@/examples/base/badge-demo"
import ButtonDemo from "@/examples/base/button-demo"
import CardDemo from "@/examples/base/card-demo"
import CheckboxDemo from "@/examples/base/checkbox-demo"
import { InputDemo } from "@/examples/base/input-demo"
import { SwitchDemo } from "@/examples/base/switch-demo"

export function Panel({ name, title, description }: { name: string; title: string; description: string }) {
  return (
    <section className={`style-${name} grid gap-4 rounded-xl bg-muted p-6 dark:bg-background`}>
      <header className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <code className="text-xs text-muted-foreground">style-{name}</code>
        <p className="text-sm text-muted-foreground">{description}{name === "nova" ? " (default)" : ""}</p>
      </header>
      <div className="grid grid-cols-[1fr_1fr_minmax(0,24rem)] items-start gap-6">
        <div className="grid gap-6 rounded-xl bg-card p-6 text-card-foreground">
          <ButtonDemo />
          <BadgeDemo />
          <SwitchDemo />
        </div>
        <div className="grid gap-6 rounded-xl bg-card p-6 text-card-foreground">
          <InputDemo />
          <CheckboxDemo />
        </div>
        <CardDemo />
      </div>
    </section>
  )
}

export function StylePage({ name }: { name: string }) {
  const s = STYLES.find((x) => x.name === name)!
  return (
    <div className="grid p-4">
      <Panel name={s.name} title={s.title} description={s.description} />
    </div>
  )
}
