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
    <main className="min-h-screen bg-[#dedee3] p-3 sm:p-6 lg:p-10">
      <section className="relative mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1480px] place-items-center overflow-hidden rounded-[30px] bg-[#f4f5f8] p-4 shadow-2xl ring-1 ring-black/[0.04] sm:min-h-[calc(100vh-3rem)] sm:p-8 lg:min-h-[calc(100vh-5rem)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_-30%,oklch(0.86_0.085_286),transparent_68%)]" />
        <div className="relative w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Boxes className="size-5" aria-hidden="true" /></span>
              <div><p className="font-black tracking-[-0.035em]">CatalogBridge</p><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">JakMall → Shopee</p></div>
            </div>
          </div>
          <Card className="rounded-3xl border-white/80 bg-white/95 shadow-xl shadow-slate-950/[0.08] ring-black/[0.06] backdrop-blur">
            <CardContent className="p-6 sm:p-8"><LoginForm /></CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
