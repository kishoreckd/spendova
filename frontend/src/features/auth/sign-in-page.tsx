import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/common/form-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { controlProps } from "@/lib/forms";

type Mode = "sign-in" | "sign-up";
type SignInErrors = Partial<Record<"name" | "email" | "password", string>>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignIn(
  mode: Mode,
  values: { name: string; email: string; password: string },
) {
  const errors: SignInErrors = {};
  if (mode === "sign-up" && !values.name) errors.name = "Enter your name";
  if (!values.email) errors.email = "Enter your email";
  else if (!EMAIL_PATTERN.test(values.email))
    errors.email = "Enter a valid email, like name@example.com";
  if (!values.password) errors.password = "Enter your password";
  else if (mode === "sign-up" && values.password.length < 8)
    errors.password = "Use at least 8 characters";
  return errors;
}

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledEmail =
    (location.state as { email?: string } | null)?.email ?? "";
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [submitting, setSubmitting] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignInErrors>({});

  function clearField(field: keyof SignInErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setFieldErrors({});
  }

  function destination(profile: {
    email_verified: boolean;
    onboarding_completed: boolean;
  }) {
    if (!profile.email_verified) return "/verify-email";
    return profile.onboarding_completed ? "/" : "/onboarding";
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
    const errors = validateSignIn(mode, values);
    setFieldErrors(errors);
    setError("");
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setSubmitting("email");
    try {
      if (mode === "sign-up") {
        const developmentCode = await signUpWithEmail(
          values.name,
          values.email,
          values.password,
        );
        navigate("/verify-email", {
          replace: true,
          state: { developmentCode },
        });
      } else {
        const profile = await signInWithEmail(values.email, values.password);
        navigate(destination(profile), { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in");
    } finally {
      setSubmitting(null);
    }
  }

  function forgotPassword() {
    const email =
      (document.getElementById("email") as HTMLInputElement | null)?.value ??
      "";
    navigate("/forgot-password", { state: { email } });
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="grid min-h-dvh lg:grid-cols-[1.08fr_.92fr]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#062f36_0%,#075e60_52%,#09a58e_100%)] p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 left-10 size-80 rounded-full bg-cyan-300/10 blur-3xl" />
          <img
            src="/brand/spendova-logo-dark.png"
            alt="Spendova"
            className="relative w-44"
          />
          <div className="relative my-auto max-w-xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-emerald-100">
              Money with a plan
            </p>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
              See where your money goesâ€”and where it can take you.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/80">
              Track spending, plan meaningful purchases, and make confident
              decisions from one private workspace.
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <ChartNoAxesCombined className="mb-4 size-6 text-emerald-200" />
                <p className="text-sm text-emerald-50/70">Monthly clarity</p>
                <p className="mt-1 text-2xl font-semibold">One view</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <ShieldCheck className="mb-4 size-6 text-emerald-200" />
                <p className="text-sm text-emerald-50/70">
                  Your financial data
                </p>
                <p className="mt-1 text-2xl font-semibold">Private</p>
              </div>
            </div>
          </div>
          <p className="relative text-xs text-emerald-50/60">
            Built for thoughtful personal finance.
          </p>
        </aside>
        <section className="flex items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
          <Card className="w-full max-w-[440px] border-0 bg-transparent shadow-none">
            <CardHeader>
              <img
                src="/brand/spendova-logo-light.png"
                alt="Spendova"
                className="mb-6 w-40 dark:hidden lg:hidden"
              />
              <img
                src="/brand/spendova-logo-dark.png"
                alt="Spendova"
                className="mb-6 hidden w-40 dark:block lg:dark:hidden"
              />
              <CardTitle className="text-2xl">
                {mode === "sign-in" ? "Welcome back" : "Create your account"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 rounded-2xl bg-muted p-1.5">
                <Button
                  type="button"
                  variant={mode === "sign-in" ? "default" : "ghost"}
                  onClick={() => switchMode("sign-in")}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={mode === "sign-up" ? "default" : "ghost"}
                  onClick={() => switchMode("sign-up")}
                >
                  Sign up
                </Button>
              </div>
              <form noValidate className="space-y-4" onSubmit={submitEmail}>
                {mode === "sign-up" && (
                  <Field id="name" label="Full name" error={fieldErrors.name}>
                    <Input
                      {...controlProps("name", fieldErrors.name)}
                      className="h-11 rounded-xl sm:h-11"
                      name="name"
                      autoComplete="name"
                      onChange={() => clearField("name")}
                    />
                  </Field>
                )}
                <Field id="email" label="Email" error={fieldErrors.email}>
                  <Input
                    {...controlProps("email", fieldErrors.email)}
                    className="h-11 rounded-xl sm:h-11"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    defaultValue={prefilledEmail}
                    onChange={() => clearField("email")}
                  />
                </Field>
                <Field
                  id="password"
                  label="Password"
                  error={fieldErrors.password}
                  action={
                    mode === "sign-in" && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={forgotPassword}
                      >
                        Forgot password?
                      </button>
                    )
                  }
                >
                  <Input
                    {...controlProps("password", fieldErrors.password)}
                    className="h-11 rounded-xl sm:h-11"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "sign-up" ? "new-password" : "current-password"
                    }
                    onChange={() => clearField("password")}
                  />
                </Field>
                <FormAlert>{error}</FormAlert>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl sm:h-11"
                  loading={submitting === "email"}
                  disabled={submitting === "google"}
                >
                  {submitting === "email"
                    ? mode === "sign-in"
                      ? "Signing inâ€¦"
                      : "Creating accountâ€¦"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </form>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/demo")}
              >
                Preview sample dashboard
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
