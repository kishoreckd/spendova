import { useState } from "react";
import {
  BadgeCheck,
  Globe2,
  Landmark,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useAuth } from "@/features/auth/auth-context";

export function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [country, setCountry] = useState(profile?.country_code ?? "");
  const [currency, setCurrency] = useState(profile?.base_currency ?? "INR");
  const [locale, setLocale] = useState(profile?.locale ?? navigator.language);
  const [timeZone, setTimeZone] = useState(
    profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await updateProfile({
        display_name: name.trim(),
        country_code: country.toUpperCase() || null,
        base_currency: currency.toUpperCase(),
        locale,
        time_zone: timeZone,
      });
      setMessage("Your profile and regional preferences were saved.");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Could not save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary via-teal-600 to-cyan-600" />
        <CardContent className="flex flex-col gap-5 p-6 pt-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="-mt-12 size-24 border-4 border-card bg-card text-2xl shadow-sm">
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
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">
                  {profile?.display_name ?? "Spendova user"}
                </h2>
                {profile?.email_verified && (
                  <Badge variant="secondary">
                    <BadgeCheck className="size-3.5" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/settings")}>
            <Settings2 /> Account settings
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
              <CardDescription>
                How your identity appears throughout Spendova.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={profile?.email ?? ""}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Managed by your sign-in provider
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Regional preferences</CardTitle>
              <CardDescription>
                Used for money formatting, dates, and future reminders.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">Country code</Label>
                <Input
                  id="country"
                  maxLength={2}
                  value={country}
                  placeholder="IN"
                  onChange={(event) =>
                    setCountry(event.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Primary currency</Label>
                <Input
                  id="currency"
                  maxLength={3}
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">Language and locale</Label>
                <Input
                  id="locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Time zone</Label>
                <Input
                  id="timezone"
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                {message ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {message}
                  </p>
                ) : (
                  <span />
                )}
                <Button
                  disabled={saving || !name.trim() || currency.length !== 3}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Google authentication</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your identity and profile photo are protected by your Google
                account.
              </p>
              <Badge className="mt-4" variant="secondary">
                Email verified
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Your personal Spendova setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction
                icon={Landmark}
                label="Manage accounts"
                onClick={() => navigate("/accounts")}
              />
              <QuickAction
                icon={Globe2}
                label="Currency and preferences"
                onClick={() => navigate("/settings")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Landmark;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition hover:bg-muted"
    >
      <span className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="size-4" />
      </span>
      {label}
    </button>
  );
}
