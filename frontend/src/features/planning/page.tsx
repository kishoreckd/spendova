import { useState } from "react";
import { Plus } from "lucide-react";
import { PageActions } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillFormDialog } from "./bill-form-dialog";
import { BudgetFormDialog } from "./budget-form-dialog";
import { BudgetsTab } from "./budgets-tab";
import { CommitmentsTab } from "./commitments-tab";
import { GoalsTab } from "./goals-tab";
import { PurchaseGoalCalculator } from "./purchase-goal-calculator";

type Tab = "budgets" | "goals" | "purchase" | "commitments";

export default function PlanningPage() {
  const [tab, setTab] = useState<Tab>("budgets");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="space-y-5"
    >
      <PageActions>
        {tab === "budgets" && (
          <Button aria-label="New budget" onClick={() => setBudgetOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">New budget</span>
          </Button>
        )}
        {tab === "goals" && (
          <Button
            aria-label="Plan a purchase"
            onClick={() => setTab("purchase")}
          >
            <Plus />
            <span className="hidden sm:inline">New goal</span>
          </Button>
        )}
        {tab === "commitments" && (
          <Button aria-label="Add commitment" onClick={() => setBillOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">Add commitment</span>
          </Button>
        )}
      </PageActions>

      <TabsList className="grid h-auto w-full grid-cols-4 sm:max-w-xl">
        <TabsTrigger value="budgets" className="px-1">
          Budgets
        </TabsTrigger>
        <TabsTrigger value="goals" className="px-1">
          Goals
        </TabsTrigger>
        <TabsTrigger value="purchase" className="px-1">
          Planner
        </TabsTrigger>
        <TabsTrigger value="commitments" className="px-1">
          Bills
        </TabsTrigger>
      </TabsList>

      <TabsContent value="budgets">
        <BudgetsTab onCreate={() => setBudgetOpen(true)} />
      </TabsContent>
      <TabsContent value="goals">
        <GoalsTab onCreate={() => setTab("purchase")} />
      </TabsContent>
      <TabsContent value="purchase">
        <PurchaseGoalCalculator onSaved={() => setTab("goals")} />
      </TabsContent>
      <TabsContent value="commitments">
        <CommitmentsTab onCreate={() => setBillOpen(true)} />
      </TabsContent>

      <BudgetFormDialog open={budgetOpen} onOpenChange={setBudgetOpen} />
      <BillFormDialog open={billOpen} onOpenChange={setBillOpen} />
    </Tabs>
  );
}
