"use client";

import { useActionState } from "react";
import { CircleDashed } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm() {
  const { t } = useLanguage();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div>
      <div className="mb-8"><h1 className="text-3xl font-black tracking-[-0.05em]">{t("Welcome back")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("Sign in to continue to CatalogBridge.")}</p></div>
      <form action={formAction} className="space-y-5">
        {state.error ? <div id="login-error" role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{t(state.error)}</div> : null}
        <div className="space-y-2"><Label htmlFor="email">{t("Email")}</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="operator@company.com" aria-describedby={state.error ? "login-error" : undefined} required autoFocus /></div>
        <div className="space-y-2"><Label htmlFor="password">{t("Password")}</Label><Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" aria-describedby={state.error ? "login-error" : undefined} minLength={6} required /></div>
        <Button type="submit" className="h-11 w-full rounded-xl shadow-md shadow-primary/20" disabled={pending}>{pending ? <CircleDashed className="size-4 animate-spin" /> : null}{pending ? t("Signing in…") : t("Sign in")}</Button>
      </form>
    </div>
  );
}
