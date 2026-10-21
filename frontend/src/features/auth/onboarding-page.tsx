import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Landmark,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/auth/auth-context";
import { createAccountRecord, createRecurringIncome } from "@/lib/api";
import { trackEvent } from "@/lib/firebase";
import { localDateISO } from "@/lib/format";
import { controlProps, errorMessage, notifySuccess } from "@/lib/forms";

type StepErrors = Partial<
  Record<"country" | "currency" | "income" | "account", string>
>;

function isCurrencyCode(code: string) {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  return Intl.supportedValuesOf?.("currency").includes(code) ?? true;
}

function validateStep(
  step: number,
  values: {
    countryCode: string;
    currency: string;
    income: string;
    accountName: string;
  },
) {
  const errors: StepErrors = {};
  if (step === 1) {
    if (!/^[A-Z]{2}$/.test(values.countryCode))
      errors.country = "Enter a two-letter country code, like IN or US";
    if (!isCurrencyCode(values.currency))
      errors.currency = "Enter a valid currency code, like INR or USD";
  }
  if (step === 2 && values.income.trim()) {
    const income = values.income.replace(/,/g, "").trim();
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(income))
      errors.income = "Use numbers only, with up to 2 decimals";
  }
  if (step === 3 && values.accountName.trim().length > 80)
    errors.account = "Keep the name under 80 characters";
  return errors;
}

const steps = [
  {
    title: "Your region",
    description: "Set the currency used throughout Spendova.",
  },
  {
    title: "Monthly income",
    description: "Optional. This helps calculate available money and savings.",
  },
  {
    title: "First account",
    description:
      "Optional. Add a bank, cash account, or card later if you prefer.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [countryCode, setCountryCode] = useState("IN");
  const [currency, setCurrency] = useState("INR");
  const [income, setIncome] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<StepErrors>({});
  const navigate = useNavigate();
  const { updateProfile } = useAuth();

  function next() {
    const errors = validateStep(step, {
      countryCode,
      currency,
      income,
      accountName,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    if (step === 3) void complete(true);
    else setStep(step + 1);
  }

  async function complete(createSetup: boolean) {
    if (!createSetup) {
      const errors = validateStep(1, {
        countryCode,
        currency,
        income,
        accountName,
      });
      if (Object.keys(errors).length) {
        setStep(1);
        setFieldErrors(errors);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const cleanAccountName = accountName.trim();
      if (createSetup && cleanAccountName) {
        await createAccountRecord({
          name: cleanAccountName,
          account_type: "bank",
          currency,
          opening_balance: "0",
        });
        const monthlyIncome = income.replace(/,/g, "").trim();
        if (Number(monthlyIncome) > 0) {
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
          await createRecurringIncome({
            name: "Monthly income",
            amount: monthlyIncome,
            currency,
            next_due_on: localDateISO(nextMonth),
            destination: cleanAccountName,
          });
        }
      }
      await updateProfile({
        country_code: countryCode,
        base_currency: currency,
        locale: navigator.language,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarding_completed: true,
      });
      void trackEvent(
        createSetup ? "onboarding_completed" : "onboarding_skipped",
      );
      notifySuccess("You're all set", "Your Spendova workspace is ready.");
      navigate("/", { replace: true });
    } catch (reason) {
      setError(
        errorMessage(reason, "Could not complete setup. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/.12),transparent_35%)] px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <img
            src="/brand/spendova-logo-light.png"
            alt="Spendova"
            className="w-40 dark:hidden"
          />
          <img
            src="/brand/spendova-logo-dark.png"
            alt="Spendova"
            className="hidden w-40 dark:block"
          />
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => void complete(false)}
          >
            Skip for now
          </Button>
        </header>
        <div className="grid items-stretch gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <section className="hidden rounded-3xl bg-primary p-8 text-primary-foreground lg:flex lg:flex-col">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
              <Sparkles />
            </div>
            <h1 className="mt-8 text-3xl font-semibold">Make Spendova yours</h1>
            <p className="mt-3 max-w-md text-primary-foreground/75">
              A few optional details help build accurate budgets and cash-flow
              insights. Nothing is pre-filled into your account.
            </p>
            <div className="mt-10 space-y-5">
              {[
                { icon: WalletCards, text: "Use your preferred currency" },
                { icon: Landmark, text: "Connect accounts when you are ready" },
                { icon: Check, text: "Change every choice later in Settings" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="rounded-xl bg-white/15 p-2">
                    <Icon className="size-5" />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </section>
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="space-y-5 p-6 sm:p-8">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Step {step} of 3</span>
                <span>{Math.round((step / 3) * 100)}% complete</span>
              </div>
              <Progress value={(step / 3) * 100} />
              <div>
                <CardTitle className="text-2xl">
                  {steps[step - 1].title}
                </CardTitle>
                <CardDescription className="mt-2">
                  {steps[step - 1].description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6 sm:px-8 sm:pb-8">
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="country"
                    label="Country code"
                    hint="Two letters, like IN or US"
                    error={fieldErrors.country}
                  >
                    <Input
                      {...controlProps("country", fieldErrors.country)}
                      value={countryCode}
                      maxLength={2}
                      autoComplete="country"
                      placeholder="IN"
                      onChange={(event) => {
                        setCountryCode(event.target.value.toUpperCase());
                        setFieldErrors((current) => ({
                          ...current,
                          country: undefined,
                        }));
                      }}
                    />
                  </Field>
                  <Field
                    id="currency"
                    label="Primary currency"
                    hint="Three letters, like INR or USD"
                    error={fieldErrors.currency}
                  >
                    <Input
                      {...controlProps("currency", fieldErrors.currency)}
                      value={currency}
                      maxLength={3}
                      placeholder="INR"
                      onChange={(event) => {
                        setCurrency(event.target.value.toUpperCase());
                        setFieldErrors((current) => ({
                          ...current,
                          currency: undefined,
                        }));
                      }}
                    />
                  </Field>
                </div>
              )}
              {step === 2 && (
                <Field
                  id="income"
                  label="Monthly income"
                  optional
                  hint="Leave this blank if your income changes or you want to add it later."
                  error={fieldErrors.income}
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      {...controlProps("income", fieldErrors.income)}
                      className="pl-14"
                      value={income}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      onChange={(event) => {
                        setIncome(event.target.value);
                        setFieldErrors((current) => ({
                          ...current,
                          income: undefined,
                        }));
                      }}
                    />
                  </div>
                </Field>
              )}
              {step === 3 && (
                <Field
                  id="account"
                  label="Account name"
                  optional
                  hint="No sample balance will be added. Your opening balance starts at zero."
                  error={fieldErrors.account}
                >
                  <Input
                    {...controlProps("account", fieldErrors.account)}
                    value={accountName}
                    placeholder="e.g. Salary account"
                    onChange={(event) => setAccountName(event.target.value)}
                  />
                </Field>
              )}
              <FormAlert>{error}</FormAlert>
              <div className="flex items-center justify-between border-t pt-5">
                <Button
                  variant="ghost"
                  disabled={step === 1 || saving}
                  onClick={() => {
                    setFieldErrors({});
                    setStep(step - 1);
                  }}
                >
                  <ArrowLeft /> Back
                </Button>
                <Button loading={saving} onClick={next}>
                  {saving
                    ? "Saving…"
                    : step === 3
                      ? "Finish setup"
                      : "Continue"}
                  <ArrowRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
