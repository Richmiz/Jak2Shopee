"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeferredValue, useState, type ReactNode } from "react";
import { Bell, Boxes, ChevronLeft, ChevronRight, History, LayoutDashboard, ListChecks, LogOut, Menu, Search, Settings2, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { useLanguage } from "@/components/i18n/language-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/workspace/status-badge";
import { products } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

type NavigationItem = { label: string; href: string; icon: LucideIcon; count?: number };

const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Import products", href: "/imports/new", icon: UploadCloud },
  { label: "Products", href: "/products", icon: Boxes },
  { label: "Review queue", href: "/reviews", icon: ListChecks, count: 3 },
  { label: "Processing history", href: "/jobs", icon: History },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3 px-1" aria-label="CatalogBridge dashboard">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-200 group-hover:-rotate-2 group-hover:scale-105"><Boxes className="size-5" aria-hidden="true" /></span>
      <span className={collapsed ? "sr-only" : undefined}><span className="block text-base font-black tracking-[-0.035em]">CatalogBridge</span><span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">JakMall → Shopee</span></span>
    </Link>
  );
}

type ProfileMenuPlacement = "sidebar" | "header" | "mobile";

function ProfileMenu({ email, collapsed = false, placement = "sidebar" }: { email: string; collapsed?: boolean; placement?: ProfileMenuPlacement }) {
  const { t } = useLanguage();
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2) || "OP";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("h-auto shrink-0 rounded-xl p-2", placement !== "header" && "mt-4", placement === "header" ? "size-10 justify-center" : collapsed ? "w-full justify-center" : "w-full justify-start gap-3")}>
          <Avatar className="size-9 rounded-xl"><AvatarFallback className="rounded-xl bg-primary/12 text-xs font-bold text-primary">{initials}</AvatarFallback></Avatar>
          <span className={collapsed ? "sr-only" : "min-w-0 flex-1 text-left"}><span className="block truncate text-sm font-semibold">{name}</span><span className="block truncate text-[10px] font-normal text-muted-foreground">{email}</span></span>
          {!collapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={placement === "header" ? "end" : placement === "sidebar" ? "end" : "start"}
        side={placement === "header" ? "bottom" : placement === "sidebar" ? "right" : "top"}
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(16rem,calc(100vw-1.5rem))] rounded-xl p-2 shadow-xl"
      >
        <DropdownMenuLabel><span className="block text-sm">{name}</span><span className="block truncate text-[10px] font-normal text-muted-foreground">{email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}><Button type="submit" variant="ghost" className="w-full justify-start text-rose-700 hover:bg-rose-50 hover:text-rose-800"><LogOut className="size-4" />{t("Log out")}</Button></form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navigation({ pathname, collapsed = false, onNavigate }: { pathname: string; collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <nav className="grid gap-1" aria-label={t("Workspace navigation")}>
      {navigation.map((item) => {
        const { href, icon: Icon, count } = item;
        const label = t(item.label);
        return (
        <Link key={href} href={href} onClick={onNavigate} title={collapsed ? label : undefined} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("relative flex h-11 items-center rounded-xl text-sm font-medium transition-[color,background-color,transform,box-shadow] duration-200", collapsed ? "justify-center px-0" : "gap-3 px-3", isActive(pathname, href) ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:translate-x-0.5 hover:bg-primary/[0.06] hover:text-foreground")}>
          <Icon className={cn("size-4", isActive(pathname, href) && "text-primary")} aria-hidden="true" /><span className={collapsed ? "sr-only" : "flex-1"}>{label}</span>
          {count ? <span className={cn("grid size-5 place-items-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800", collapsed && "absolute -right-1 -top-1 size-4 text-[9px]")}>{count}</span> : null}
        </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceSidebar({ pathname, userEmail, collapsed = false, profilePlacement = "sidebar", onCollapsedChange, onNavigate }: { pathname: string; userEmail: string; collapsed?: boolean; profilePlacement?: ProfileMenuPlacement; onCollapsedChange?: (collapsed: boolean) => void; onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("mb-5 flex shrink-0", collapsed ? "flex-col items-center gap-3" : "items-center justify-between")}>
        <Brand collapsed={collapsed} />
        {onCollapsedChange ? <Button variant="ghost" size="icon-sm" onClick={() => onCollapsedChange(!collapsed)} aria-label={t(collapsed ? "Expand sidebar" : "Collapse sidebar")} title={t(collapsed ? "Expand sidebar" : "Collapse sidebar")}>{collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</Button> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-width:thin]">
        <p className={cn("px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground", collapsed && "sr-only")}>{t("Menu")}</p>
        <Navigation pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <p className={cn("mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground", collapsed && "sr-only")}>{t("General")}</p>
        <Link href="/settings" onClick={onNavigate} title={collapsed ? t("Settings") : undefined} className={cn("mt-1 flex h-11 items-center rounded-xl text-sm font-medium transition-all duration-200", collapsed ? "justify-center px-0" : "gap-3 px-3", isActive(pathname, "/settings") ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground")}><Settings2 className="size-4" /><span className={collapsed ? "sr-only" : undefined}>{t("Settings")}</span></Link>
      </div>
      <ProfileMenu email={userEmail} collapsed={collapsed} placement={profilePlacement} />
    </div>
  );
}

function GlobalSearch() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const productMatches = deferredQuery ? products.filter((product) => product.name.toLowerCase().includes(deferredQuery) || product.sku.toLowerCase().includes(deferredQuery)).slice(0, 4) : [];
  const settingsItem: NavigationItem = { label: "Settings", href: "/settings", icon: Settings2 };
  const pageMatches = deferredQuery ? [...navigation, settingsItem].filter((item) => `${item.label} ${t(item.label)}`.toLowerCase().includes(deferredQuery)).slice(0, 3) : [];

  return (
    <div className="relative hidden min-w-0 flex-[1_1_34rem] md:block">
      <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-xl border-border/80 bg-white pl-10 !shadow-none focus-visible:shadow-sm" placeholder={t("Search products, jobs, SKUs...")} aria-label={t("Search workspace")} />
      {deferredQuery ? (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border bg-popover p-2 shadow-2xl">
          {productMatches.length || pageMatches.length ? <div className="space-y-1">
            {pageMatches.map((item) => { const { href, icon: Icon } = item; return <Link key={href} href={href} onClick={() => setQuery("")} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted"><span className="grid size-8 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></span>{t(item.label)}</Link>; })}
            {productMatches.map((product) => <Link key={product.id} href={`/products?selected=${product.id}`} onClick={() => setQuery("")} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"><span className={cn("grid size-8 place-items-center rounded-lg bg-gradient-to-br", product.accent)}><Boxes className="size-3.5 text-primary" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="block font-mono text-[10px] text-muted-foreground">{product.sku}</span></span><StatusBadge status={product.status} /></Link>)}
          </div> : <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("No matching products or pages.")}</p>}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children, userEmail }: { children: ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen w-full grid-cols-1 gap-4 bg-white p-3 transition-[grid-template-columns] duration-300 ease-out lg:grid-cols-[auto_minmax(0,1fr)] lg:p-4">
        <aside className={cn("sticky top-4 hidden h-[calc(100vh-2rem)] rounded-[28px] border border-black/[0.055] bg-[#fbfbfc] transition-[width,padding] duration-300 ease-out lg:block", sidebarCollapsed ? "w-[4.5rem] p-3" : "w-[clamp(13rem,18vw,16rem)] p-4")}><WorkspaceSidebar pathname={pathname} userEmail={userEmail} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} /></aside>

        <section className="min-w-0 rounded-[26px] bg-[#f4f5f8] p-3 md:p-4">
          <header className="relative z-30 flex h-[68px] items-center gap-3 rounded-2xl border border-black/[0.055] bg-white/85 px-3 shadow-[0_8px_28px_oklch(0_0_0/0.035)] backdrop-blur-xl sm:px-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label={t("Open navigation")}><Menu className="size-5" /></Button></SheetTrigger>
              <SheetContent side="left" className="w-[min(88vw,22rem)] border-0 bg-[#fbfbfc] p-4"><SheetHeader className="sr-only"><SheetTitle>{t("CatalogBridge navigation")}</SheetTitle><SheetDescription>{t("Navigate the product automation workspace.")}</SheetDescription></SheetHeader><WorkspaceSidebar pathname={pathname} userEmail={userEmail} profilePlacement="mobile" onNavigate={() => setMobileOpen(false)} /></SheetContent>
            </Sheet>
            <div className="lg:hidden"><Brand /></div>
            <GlobalSearch />
            <div className="flex-1" />
            <div className="flex rounded-xl border bg-muted/60 p-1" role="group" aria-label="Language">
              <Button type="button" variant="ghost" size="sm" aria-pressed={language === "en"} onClick={() => setLanguage("en")} className={cn("h-7 rounded-lg px-2.5 text-[10px] font-bold", language === "en" ? "bg-white text-foreground shadow-sm hover:bg-white" : "text-muted-foreground hover:text-foreground")}>ENG</Button>
              <Button type="button" variant="ghost" size="sm" aria-pressed={language === "id"} onClick={() => setLanguage("id")} className={cn("h-7 rounded-lg px-2.5 text-[10px] font-bold", language === "id" ? "bg-white text-foreground shadow-sm hover:bg-white" : "text-muted-foreground hover:text-foreground")}>IND</Button>
            </div>
            <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label={t("Notifications")} title={t("No new notifications")}><Bell className="size-4" /></Button>
            <div className="hidden sm:block"><ProfileMenu email={userEmail} collapsed placement="header" /></div>
          </header>

          <main className="mt-5 px-0.5 pb-1"><div key={pathname} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">{children}</div></main>
        </section>
      </div>
    </div>
  );
}
