import { useState } from "react";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/features/auth/auth-context";
import { exportCurrentUserData } from "@/lib/api";

type NotificationPreferences = {
  bills: boolean;
  budgets: boolean;
  weekly: boolean;
};

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const preferenceKey = `spendova-notifications:${profile?.id ?? "anonymous"}`;
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    () => {
      try {
        return (
          JSON.parse(localStorage.getItem(preferenceKey) || "null") ?? {
            bills: false,
            budgets: false,
            weekly: false,
          }
        );
      } catch {
        return { bills: false, budgets: false, weekly: false };
      }
    },
  );
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  function setPreference(key: keyof NotificationPreferences, enabled: boolean) {
    const next = { ...preferences, [key]: enabled };
    setPreferences(next);
    localStorage.setItem(preferenceKey, JSON.stringify(next));
    setMessage(
      "Preference saved on this device. Scheduled notification delivery is not enabled yet.",
    );
  }

  async function exportData() {
    if (!profile) return;
    setExporting(true);
    setMessage("");
    try {
      const data = await exportCurrentUserData(profile);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `spendova-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Your Spendova data export was downloaded.");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Could not export your data",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile and region</CardTitle>
          <CardDescription>
            Your identity and primary money format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={profile?.display_name ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Primary currency</Label>
            <Input value={profile?.base_currency ?? "INR"} readOnly />
          </div>
          <Button onClick={() => navigate("/profile")}>Edit profile</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Notifications</CardTitle>
            <Badge variant="secondary">Preferences only</Badge>
          </div>
          <CardDescription>
            Choose what you want to receive. Scheduled email and push delivery
            will require the notification worker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            label="Bill reminders"
            checked={preferences.bills}
            onCheckedChange={(value) => setPreference("bills", value)}
          />
          <NotificationRow
            label="Budget alerts"
            checked={preferences.budgets}
            onCheckedChange={(value) => setPreference("budgets", value)}
          />
          <NotificationRow
            label="Weekly summary"
            checked={preferences.weekly}
            onCheckedChange={(value) => setPreference("weekly", value)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacy and data</CardTitle>
          <CardDescription>
            Download your information, review sign-in security, or end this
            session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={exporting || !profile}
            onClick={() => void exportData()}
          >
            <Download />
            {exporting ? "Preparing export…" : "Export my data"}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() =>
              window.open(
                "https://myaccount.google.com/security",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <ShieldCheck />
            Google account security
            <ExternalLink className="ml-auto size-4" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
          {message && (
            <p role="status" className="pt-3 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
