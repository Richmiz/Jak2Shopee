"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t(eyebrow)}</p> : null}
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-foreground">{t(title)}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t(description)}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
