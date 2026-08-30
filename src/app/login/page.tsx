import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { getSession } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f3f7] p-4 sm:p-6 lg:p-10">
      <Card className="grid w-full max-w-5xl gap-0 overflow-hidden rounded-[2rem] border-0 bg-white p-0 !shadow-[0_28px_80px_oklch(0_0_0/0.13)] ring-1 ring-black/[0.04] lg:min-h-[620px] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section className="relative hidden overflow-hidden bg-[#111023] p-10 text-white lg:flex lg:flex-col xl:p-12" aria-label="CatalogBridge introduction">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_23%,oklch(0.59_0.24_286/0.9),transparent_34%),radial-gradient(circle_at_20%_100%,oklch(0.42_0.2_286/0.55),transparent_42%)]" />
          <div className="pointer-events-none absolute -right-28 top-8 size-80 rounded-full bg-primary/20 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"><Boxes className="size-5" aria-hidden="true" /></span>
            <div><p className="text-lg font-black tracking-[-0.035em]">CatalogBridge</p><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">JakMall → Shopee</p></div>
          </div>

          <div className="relative my-auto max-w-md">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Catalog operations</p>
            <h1 className="max-w-sm text-4xl font-black leading-[1.02] tracking-[-0.055em]">Reliable product listing automation.</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/65">Move product data from JakMall to Shopee with normalization, review controls, duplicate protection, retries, and clear operational status.</p>
          </div>
        </section>

        <section className="flex min-h-[580px] items-center justify-center p-6 sm:p-10 lg:min-h-0 lg:p-14 xl:p-16" aria-label="Sign in">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Boxes className="size-5" aria-hidden="true" /></span>
              <div><p className="font-black tracking-[-0.035em]">CatalogBridge</p><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">JakMall → Shopee</p></div>
            </div>
            <CardContent className="p-0"><LoginForm /></CardContent>
          </div>
        </section>
      </Card>
    </main>
  );
}
