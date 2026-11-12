import { ImportPreviewDialog } from "./import-preview-dialog";
import type { ImportPreview } from "./transaction-import";
import { PreferencesCard } from "./preferences-card";
import { useState } from "react";
import {
  CalendarRange,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { localDateISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/forms";

type StatementPeriod = "1-month" | "3-months" | "6-months" | "custom";

function monthsBefore(dateText: string, months: number) {
  const date = new Date(`${dateText}T12:00:00`);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}
export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme = "system", setTheme } = useTheme();
  const [busy, setBusy] = useState<
    "excel" | "template" | "import" | "signout" | null
  >(null);
  const [importPreview, setImportPreview] = useState<{
    preview: ImportPreview;
    batchId: string;
  } | null>(null);
  const [statementPeriod, setStatementPeriod] =
    useState<StatementPeriod>("3-months");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(localDateISO());

  async function exportExcel() {
    if (!profile) return;
    if (statementPeriod === "custom" && customFrom && customFrom > customTo) {
      notifyError("Start date must be before the end date", "Check date range");
      return;
    }
    setBusy("excel");
    try {
      const { downloadExcelExport } =
        await import("@/features/settings/excel-export");
      const today = localDateISO();
      const ranges = {
        "1-month": {
          from: monthsBefore(today, 1),
          to: today,
          label: "Last 1 month",
        },
        "3-months": {
          from: monthsBefore(today, 3),
          to: today,
          label: "Last 3 months",
        },
        "6-months": {
          from: monthsBefore(today, 6),
          to: today,
          label: "Last 6 months",
        },
        custom: {
          from: customFrom || undefined,
          to: customTo,
          label: customFrom
            ? `${customFrom} to ${customTo}`
            : `First transaction to ${customTo}`,
        },
      } as const;
      const result = await downloadExcelExport(
        profile,
        ranges[statementPeriod],
      );
      notifySuccess(
        "Excel file downloaded",
        `${result.transactions.toLocaleString()} transactions included`,
      );
    } catch (reason) {
      notifyError(reason, "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function downloadTemplate() {
    if (!profile) return;
    setBusy("template");
    try {
      const { downloadTransactionTemplate } =
        await import("@/features/settings/transaction-import");
      await downloadTransactionTemplate(profile.base_currency);
      notifySuccess("Import template downloaded");
    } catch (reason) {
      notifyError(reason, "Could not download template");
    } finally {
      setBusy(null);
    }
  }

  async function importTransactions(file: File) {
    setBusy("import");
    try {
      const { prepareTransactionImport, importBatchId } =
        await import("./transaction-import");
      const preview = await prepareTransactionImport(file);
      setImportPreview({
        preview,
        batchId: await importBatchId(preview.entries),
      });
    } catch (reason) {
      notifyError(reason, "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function logOut() {
    setBusy("signout");
    try {
      await signOut();
    } catch (reason) {
      notifyError(reason, "Couldn't sign out");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <Card className="lg:col-span-2">
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:bg-muted/50 sm:p-5"
          >
            <Avatar className="size-12">
              {profile?.photo_url && (
                <AvatarImage
                  src={profile.photo_url}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback>
                {(profile?.display_name ?? profile?.email ?? "SP")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {profile?.display_name ?? "Your profile"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {profile?.email} · {profile?.base_currency}
              </p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={theme}
            onValueChange={(value) => setTheme(value as string)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="light">
                <Sun /> Light
              </TabsTrigger>
              <TabsTrigger value="dark">
                <Moon /> Dark
              </TabsTrigger>
              <TabsTrigger value="system">
                <Monitor /> Auto
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" /> Export bank
            statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs
            value={statementPeriod}
            onValueChange={(value) =>
              setStatementPeriod(value as StatementPeriod)
            }
          >
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="1-month">1 month</TabsTrigger>
              <TabsTrigger value="3-months">3 months</TabsTrigger>
              <TabsTrigger value="6-months">6 months</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          {statementPeriod === "custom" && (
            <div className="grid gap-4 rounded-xl border bg-muted/25 p-4 sm:grid-cols-2">
              <Field id="statement-from" label="Start date" optional>
                <Input
                  id="statement-from"
                  type="date"
                  max={customTo}
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </Field>
              <Field id="statement-to" label="End date">
                <Input
                  id="statement-to"
                  type="date"
                  min={customFrom || undefined}
                  max={localDateISO()}
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </Field>
            </div>
          )}
          <div className="flex justify-end border-t pt-4">
            <Button
              loading={busy === "excel"}
              disabled={!profile || (busy !== null && busy !== "excel")}
              onClick={() => void exportExcel()}
            >
              <FileSpreadsheet />
              {busy === "excel" ? "Preparing…" : "Download Excel statement"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" /> Import transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="font-medium">1. Get the template</p>
            <Button
              className="mt-4 w-full"
              variant="outline"
              loading={busy === "template"}
              disabled={!profile || (busy !== null && busy !== "template")}
              onClick={() => void downloadTemplate()}
            >
              <Download /> Download Excel template
            </Button>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">2. Upload completed template</p>
            <Input
              className="mt-4"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy !== null}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTransactions(file);
                event.target.value = "";
              }}
            />
            {busy === "import" && (
              <p className="mt-2 text-sm text-muted-foreground">Validating…</p>
            )}
          </div>
        </CardContent>
      </Card>

      {importPreview && (
        <ImportPreviewDialog
          key={importPreview.batchId}
          {...importPreview}
          onClose={() => setImportPreview(null)}
        />
      )}
      <PreferencesCard />

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() =>
              navigate("/forgot-password", { state: { email: profile?.email } })
            }
          >
            <ShieldCheck />
            Change password
          </Button>
          <Button
            variant="destructive"
            className="w-full justify-start"
            loading={busy === "signout"}
            onClick={() => void logOut()}
          >
            <LogOut />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
