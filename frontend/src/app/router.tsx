/* oxlint-disable react/only-export-components -- route configuration owns lazy route references */
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/common/loading-screen";
import { ProfileRecovery } from "@/features/auth/profile-recovery";
import { RouteError } from "@/components/common/route-error";
import { useAuth } from "@/features/auth/auth-context";
const Dashboard = lazy(() => import("@/features/dashboard/page"));
const Demo = lazy(() => import("@/features/dashboard/demo-page"));
const Reports = lazy(() => import("@/features/reports/page"));
const SignIn = lazy(() => import("@/features/auth/sign-in-page"));
const Onboarding = lazy(() => import("@/features/auth/onboarding-page"));
const VerifyEmail = lazy(() => import("@/features/auth/verify-email-page"));
const ForgotPassword = lazy(
  () => import("@/features/auth/forgot-password-page"),
);
const Transactions = lazy(() => import("@/features/transactions/page"));
const Planning = lazy(() => import("@/features/planning/page"));
const More = lazy(() => import("@/features/more/page"));
const Accounts = lazy(() => import("@/features/accounts/page"));
const Assets = lazy(() => import("@/features/assets/page"));
const Assistant = lazy(() => import("@/features/assistant/page"));
const Loans = lazy(() => import("@/features/loans/page"));
const Categories = lazy(() => import("@/features/categories/page"));
const Settings = lazy(() => import("@/features/settings/page"));
const Profile = lazy(() => import("@/features/profile/page"));
const suspense = (node: React.ReactNode) => (
  <Suspense fallback={<LoadingScreen />}>{node}</Suspense>
);
function needsEmailVerification(
  user: ReturnType<typeof useAuth>["user"],
  verified: boolean | undefined,
) {
  return !!user && !verified;
}
function ProtectedShell() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!profile) return <ProfileRecovery />;
  if (needsEmailVerification(user, profile?.email_verified))
    return <Navigate to="/verify-email" replace />;
  if (!profile?.onboarding_completed)
    return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}
function OnboardingRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!profile) return <ProfileRecovery />;
  if (needsEmailVerification(user, profile?.email_verified))
    return <Navigate to="/verify-email" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;
  return suspense(<Onboarding />);
}
function SignInRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (user && !profile) return <ProfileRecovery />;
  if (user) {
    return (
      <Navigate
        to={
          needsEmailVerification(user, profile?.email_verified)
            ? "/verify-email"
            : profile?.onboarding_completed
              ? "/"
              : "/onboarding"
        }
        replace
      />
    );
  }
  return suspense(<SignIn />);
}
function VerificationRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!profile) return <ProfileRecovery />;
  if (!needsEmailVerification(user, profile?.email_verified)) {
    return (
      <Navigate
        to={profile?.onboarding_completed ? "/" : "/onboarding"}
        replace
      />
    );
  }
  return suspense(<VerifyEmail />);
}
function FullPageLoading() {
  return (
    <main className="mx-auto min-h-dvh max-w-7xl p-6">
      <LoadingScreen />
    </main>
  );
}
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: "/sign-in", element: <SignInRoute /> },
      { path: "/demo", element: suspense(<Demo />) },
      { path: "/forgot-password", element: suspense(<ForgotPassword />) },
      { path: "/verify-email", element: <VerificationRoute /> },
      { path: "/onboarding", element: <OnboardingRoute /> },
      {
        element: <ProtectedShell />,
        children: [
          { index: true, element: suspense(<Dashboard />) },
          { path: "transactions", element: suspense(<Transactions />) },
          { path: "plan", element: suspense(<Planning />) },
          { path: "reports", element: suspense(<Reports />) },
          { path: "more", element: suspense(<More />) },
          { path: "accounts", element: suspense(<Accounts />) },
          { path: "assets", element: suspense(<Assets />) },
          { path: "loans", element: suspense(<Loans />) },
          { path: "assistant", element: suspense(<Assistant />) },
          { path: "categories", element: suspense(<Categories />) },
          { path: "settings", element: suspense(<Settings />) },
          { path: "profile", element: suspense(<Profile />) },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
