import { useState } from "react";
import { useTheme } from "next-themes";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Moon, Plus, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransactionSheet } from "@/features/transactions/transaction-sheet";
import {
  greeting,
  manageNav,
  pageTitles,
  primaryNav,
} from "@/components/layout/navigation";
import { PageActionsSlot } from "@/components/layout/page-actions-context";
import { useAuth } from "@/features/auth/auth-context";
export type ShellContext = { openTransaction: () => void };

const ADD_TRANSACTION_ROUTES = new Set(["/", "/transactions", "/reports"]);

export function AppShell() {
  const { profile } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [addOpen, setAddOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const activeMobile = primaryNav.some((x) => x.to === location.pathname)
    ? location.pathname
    : "/more";
  const isHome = location.pathname === "/";
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const canAdd = ADD_TRANSACTION_ROUTES.has(location.pathname);
  return (
    <TooltipProvider>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card p-4 lg:flex lg:flex-col">
          <button
            onClick={() => navigate("/")}
            aria-label="Spendova home"
            className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition hover:bg-secondary"
          >
            <img
              src="/brand/spendova-icon-light.png"
              alt=""
              className="size-9 rounded-xl dark:hidden"
            />
            <img
              src="/brand/spendova-icon-dark.png"
              alt=""
              className="hidden size-9 rounded-xl dark:block"
            />
            <span className="text-xl font-semibold">Spendova</span>
          </button>
          <NavItems items={primaryNav.slice(0, 4)} />
          <Separator className="my-5" />
          <p className="px-3 text-xs uppercase tracking-wider text-muted-foreground">
            Manage
          </p>
          <NavItems items={manageNav} />
        </aside>
        <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-8">
          <header className="safe-top sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16 sm:px-6">
              <h1 className="min-w-0 flex-1 truncate text-lg font-semibold sm:text-2xl">
                {isHome ? (
                  <>
                    <span className="sm:hidden">
                      {firstName ? `Hi, ${firstName}` : "Overview"}
                    </span>
                    <span className="hidden sm:inline">
                      {greeting(profile?.display_name)}
                    </span>
                  </>
                ) : (
                  (pageTitles[location.pathname] ?? "Spendova")
                )}
              </h1>
              <div
                ref={setActionsSlot}
                className="flex shrink-0 items-center gap-2"
              />
              {canAdd && (
                <Button
                  onClick={() => setAddOpen(true)}
                  className="hidden rounded-full lg:inline-flex"
                >
                  <Plus />
                  Add transaction
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="hidden lg:inline-flex"
                aria-label={dark ? "Use light theme" : "Use dark theme"}
                onClick={() => setTheme(dark ? "light" : "dark")}
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
              <button
                onClick={() => navigate("/profile")}
                aria-label="Open profile"
                className="shrink-0 rounded-full p-0.5"
              >
                <Avatar className="size-9">
                  {profile?.photo_url && (
                    <AvatarImage
                      src={profile.photo_url}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <AvatarFallback>
                    {initials(profile?.display_name, profile?.email)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
            <div
              key={location.pathname}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <PageActionsSlot.Provider value={actionsSlot}>
                <Outlet
                  context={
                    {
                      openTransaction: () => setAddOpen(true),
                    } satisfies ShellContext
                  }
                />
              </PageActionsSlot.Provider>
            </div>
          </div>
        </main>
        {canAdd && (
          <Button
            size="icon-lg"
            aria-label="Add transaction"
            onClick={() => setAddOpen(true)}
            className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg shadow-primary/30 lg:hidden [&_svg:not([class*='size-'])]:size-6"
          >
            <Plus />
          </Button>
        )}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-1 pt-1.5 backdrop-blur lg:hidden">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-current={activeMobile === to ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] leading-tight transition ${activeMobile === to ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition ${activeMobile === to ? "bg-primary/12" : ""}`}
              >
                <Icon className="size-5" />
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </NavLink>
          ))}
        </nav>
        <TransactionSheet open={addOpen} onOpenChange={setAddOpen} />
      </div>
    </TooltipProvider>
  );
}
function initials(name?: string | null, email?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length) {
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  return email?.slice(0, 2).toUpperCase() ?? "SP";
}
function NavItems({ items }: { items: typeof primaryNav }) {
  return (
    <nav className="mt-3 space-y-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${isActive ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
