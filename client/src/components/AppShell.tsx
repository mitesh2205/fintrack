import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Building2,
  PiggyBank,
  Moon,
  Sun,
  Menu,
  X,
  Sparkles,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Insights",
    href: "/insights",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    label: "Cards",
    href: "/card-breakdown",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    label: "Investments",
    href: "/investments",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: <ArrowLeftRight className="h-4 w-4" />,
  },
  {
    label: "Import",
    href: "/upload",
    icon: <Upload className="h-4 w-4" />,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: <PiggyBank className="h-4 w-4" />,
  },
];

function FinTrackLogo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Dollar sign in emerald circle */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: "hsl(160 84% 39%)" }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M12 2v2M12 20v2M8 6.5C8 5.12 9.79 4 12 4s4 1.12 4 2.5c0 1.67-1.79 2.5-4 2.5-2.21 0-4 .83-4 2.5S9.79 14 12 14s4 1.12 4 2.5-1.79 2.5-4 2.5-4-1.12-4-2.5"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-base font-semibold tracking-tight text-foreground">
        FinTrack
      </span>
    </div>
  );
}

interface SidebarContentProps {
  onNavClick?: () => void;
}

function SidebarContent({ onNavClick }: SidebarContentProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <FinTrackLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 nav-active-glow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span
                className={cn(
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="w-full justify-start gap-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>

        {/* Footer credit */}
        <p className="px-2 text-[11px] text-muted-foreground/60">
          Created by:
          <a
            href="https://miteshchhatbar.com"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            Mitesh Chhatbar
          </a>
        </p>
      </div>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-sidebar-border bg-sidebar flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <button
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center border-b border-border px-4 md:hidden glass-header z-30 sticky top-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Open menu"
            data-testid="hamburger-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <FinTrackLogo />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
