import { useNavigate } from "react-router-dom";
import { DashboardContent } from "@/features/dashboard/dashboard-content";
import sampleDashboard from "@/features/dashboard/sample-dashboard.json";

export default function DemoPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <img
            src="/brand/spendova-logo-light.png"
            alt="Spendova"
            className="w-36 dark:hidden"
          />
          <img
            src="/brand/spendova-logo-dark.png"
            alt="Spendova"
            className="hidden w-36 dark:block"
          />
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => navigate("/sign-in")}
          >
            Sign in
          </button>
        </header>
        <DashboardContent
          sample
          {...sampleDashboard}
          onPrimaryAction={() => navigate("/sign-in")}
        />
      </div>
    </main>
  );
}
