import { ThemeProvider } from "next-themes";
import { RouterProvider } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/app/router";
import { AuthProvider } from "@/features/auth/auth-context";
import { useIsDesktop } from "@/hooks/use-media-query";

export default function App() {
  const isDesktop = useIsDesktop();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="spendova-theme"
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      {/*
        Desktop: top-right under the 64px header, clear of the avatar and of
        the transaction panel's save buttons. Mobile: full-width at the top,
        where system notifications appear, away from the bottom navigation,
        floating add button, and bottom sheets. Swipe dismisses on touch.
      */}
      <Toaster
        position="top-right"
        closeButton={isDesktop}
        visibleToasts={3}
        duration={4000}
        offset={{
          top: "calc(env(safe-area-inset-top) + 4.75rem)",
          right: "1.5rem",
        }}
        mobileOffset={{
          top: "calc(env(safe-area-inset-top) + 0.5rem)",
          left: "0.75rem",
          right: "0.75rem",
        }}
      />
      <SpeedInsights />
    </ThemeProvider>
  );
}
