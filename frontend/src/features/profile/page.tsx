import { useState } from "react";
import { BadgeCheck, Globe2, Landmark, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { controlProps, errorMessage, notifySuccess } from "@/lib/forms";

type ProfileErrors = Partial<
  Record<"name" | "country" | "currency" | "locale" | "timeZone", string>
>;
const fieldIds: Record<keyof ProfileErrors, string> = {
  name: "display-name",
  country: "country",
  currency: "currency",
  locale: "locale",
  timeZone: "timezone",
};

const countries = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["JP", "Japan"],
] as const;

const locales = [
  ["en-IN", "English (India)"],
  ["hi-IN", "Hindi (India)"],
  ["ta-IN", "Tamil (India)"],
  ["te-IN", "Telugu (India)"],
  ["kn-IN", "Kannada (India)"],
  ["ml-IN", "Malayalam (India)"],
  ["mr-IN", "Marathi (India)"],
  ["bn-IN", "Bengali (India)"],
  ["gu-IN", "Gujarati (India)"],
  ["pa-IN", "Punjabi (India)"],
  ["en-US", "English (United States)"],
  ["en-GB", "English (United Kingdom)"],
] as const;

const commonCurrencies = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
  "JPY",
];
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const currencies = (
  Intl.supportedValuesOf?.("currency") ?? commonCurrencies
).map((code) => [code, currencyNames.of(code) ?? code] as const);
const timeZones = Intl.supportedValuesOf?.("timeZone") ?? [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function withCurrent<T extends readonly [string, string]>(
  options: readonly T[],
  value: string,
): readonly (readonly [string, string])[] {
  return value && !options.some(([option]) => option === value)
    ? [[value, value], ...options]
    : options;
}

function withCurrentValue(options: readonly string[], value: string) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

function validateProfile(values: {
  name: string;
  country: string;
  currency: string;
  locale: string;
  timeZone: string;
}) {
  const errors: ProfileErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name";
  else if (values.name.trim().length > 120)
    errors.name = "Keep your name under 120 characters";
  if (values.country && !/^[A-Z]{2}$/.test(values.country))
    errors.country = "Use a two-letter code, like IN";
  if (
    !/^[A-Z]{3}$/.test(values.currency) ||
    !(Intl.supportedValuesOf?.("currency").includes(values.currency) ?? true)
  )
    errors.currency = "Enter a valid currency code, like INR or USD";
  try {
    if (!values.locale.trim()) throw new Error();
    Intl.getCanonicalLocales(values.locale.trim());
  } catch {
    errors.locale = "Enter a locale such as en-IN";
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: values.timeZone.trim() });
    if (!values.timeZone.trim()) throw new Error();
  } catch {
    errors.timeZone = "Enter a time zone such as Asia/Kolkata";
  }
  return errors;
}

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
  const [editingProfile, setEditingProfile] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<ProfileErrors>({});

  function edit(field: keyof ProfileErrors, apply: () => void) {
    apply();
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function save() {
    const nextErrors = validateProfile({
      name,
      country,
      currency,
      locale,
      timeZone,
    });
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document
        .getElementById(fieldIds[firstInvalid as keyof ProfileErrors])
        ?.focus();
      return false;
    }
    setSaving(true);
    setFormError("");
    try {
      await updateProfile({
        display_name: name.trim(),
        country_code: country.toUpperCase() || null,
        base_currency: currency.toUpperCase(),
        locale: locale.trim(),
        time_zone: timeZone.trim(),
      });
      notifySuccess(
        "Profile saved",
        "Money and dates now use your regional preferences.",
      );
      return true;
    } catch (reason) {
      setFormError(
        errorMessage(reason, "Could not save your profile. Please try again."),
      );
      return false;
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
          <Button variant="outline" onClick={() => setEditingProfile(true)}>
            <Pencil /> Edit profile
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regional preferences</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field
                id="country"
                label="Country code"
                optional
                hint="Two letters, like IN"
                error={errors.country}
              >
                <Select
                  value={country || null}
                  onValueChange={(value) =>
                    value && edit("country", () => setCountry(value))
                  }
                >
                  <SelectTrigger
                    {...controlProps("country", errors.country)}
                    className="w-full"
                  >
                    <SelectValue placeholder="Select country">
                      {
                        withCurrent(countries, country).find(
                          ([code]) => code === country,
                        )?.[1]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(countries, country).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="currency"
                label="Primary currency"
                hint="Three letters, like INR"
                error={errors.currency}
              >
                <Select
                  value={currency}
                  onValueChange={(value) =>
                    value && edit("currency", () => setCurrency(value))
                  }
                >
                  <SelectTrigger
                    {...controlProps("currency", errors.currency)}
                    className="w-full"
                  >
                    <SelectValue>
                      {currency} · {currencyNames.of(currency)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(currencies, currency).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {code} · {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="locale"
                label="Language and locale"
                hint="For example en-IN"
                error={errors.locale}
              >
                <Select
                  value={locale}
                  onValueChange={(value) =>
                    value && edit("locale", () => setLocale(value))
                  }
                >
                  <SelectTrigger
                    {...controlProps("locale", errors.locale)}
                    className="w-full"
                  >
                    <SelectValue>
                      {
                        withCurrent(locales, locale).find(
                          ([code]) => code === locale,
                        )?.[1]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(locales, locale).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="timezone"
                label="Time zone"
                hint="For example Asia/Kolkata"
                error={errors.timeZone}
              >
                <Select
                  value={timeZone}
                  onValueChange={(value) =>
                    value && edit("timeZone", () => setTimeZone(value))
                  }
                >
                  <SelectTrigger
                    {...controlProps("timezone", errors.timeZone)}
                    className="w-full"
                  >
                    <SelectValue>{timeZone}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrentValue(timeZones, timeZone).map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-3 border-t pt-5 sm:col-span-2">
                <FormAlert>{formError}</FormAlert>
                <div className="flex justify-end">
                  <Button loading={saving} onClick={() => void save()}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
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

      <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update the name shown across your Spendova workspace.
            </DialogDescription>
          </DialogHeader>
          <Field id="display-name" label="Display name" error={errors.name}>
            <Input
              {...controlProps("display-name", errors.name)}
              value={name}
              autoComplete="name"
              onChange={(event) =>
                edit("name", () => setName(event.target.value))
              }
            />
          </Field>
          <FormAlert>{formError}</FormAlert>
          <DialogFooter showCloseButton>
            <Button
              loading={saving}
              onClick={() =>
                void save().then((saved) => saved && setEditingProfile(false))
              }
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
