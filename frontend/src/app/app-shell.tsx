import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Moon, Plus, Search, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransactionSheet } from "@/components/transaction-sheet";
import { manageNav, pageTitles, primaryNav } from "@/app/navigation";
import { useAuth } from "@/features/auth/auth-context";
export type ShellContext = { openTransaction: () => void };
export function AppShell() {
  const { profile } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const [dark, setDark] = useState(false),
    [addOpen, setAddOpen] = useState(false);
  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const activeMobile = primaryNav.some((x) => x.to === location.pathname)
    ? location.pathname
    : "/more";
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
          <div className="mt-auto rounded-2xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">Personal workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your insights will grow as you add transactions.
            </p>
          </div>
        </aside>
        <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-8">
          <header className="safe-top sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
              <button
                onClick={() => navigate("/")}
                aria-label="Spendova home"
                className="flex items-center gap-2 lg:hidden"
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
                <span className="hidden text-lg font-semibold min-[390px]:inline">
                  Spendova
                </span>
              </button>
              <div className="hidden max-w-sm flex-1 md:block">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10 sm:pl-10"
                    placeholder="Search Spendova"
                  />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={dark ? "Use light theme" : "Use dark theme"}
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun /> : <Moon />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Notifications">
                  <Bell />
                </Button>
                <button
                  onClick={() => navigate("/profile")}
                  aria-label="Open profile"
                  className="ml-1 rounded-full p-1 sm:ml-2"
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
            </div>
          </header>
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:py-8">
            <div className="mb-6 flex min-w-0 items-start justify-between gap-3 sm:mb-7">
              <div>
                <p className="text-sm text-muted-foreground">{todayLabel}</p>
                <h1 className="break-words text-2xl font-semibold sm:text-3xl">
                  {pageTitles[location.pathname] ?? "Spendova"}
                </h1>
              </div>
              {(location.pathname === "/" ||
                location.pathname === "/transactions") && (
                <Button
                  onClick={() => setAddOpen(true)}
                  className="rounded-full"
                >
                  <Plus />
                  <span className="hidden sm:inline">Add transaction</span>
                </Button>
              )}
            </div>
            <div
              key={location.pathname}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <Outlet
                context={
                  {
                    openTransaction: () => setAddOpen(true),
                  } satisfies ShellContext
                }
              />
            </div>
          </div>
        </main>
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-1 pt-2 backdrop-blur lg:hidden">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-current={activeMobile === to ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center gap-1 rounded-xl py-1 text-[10px] transition ${activeMobile === to ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
              <span>{label}</span>
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
