import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
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

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } =
    useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function destination(profile: {
    email_verified: boolean;
    onboarding_completed: boolean;
  }) {
    if (!profile.email_verified) return "/verify-email";
    return profile.onboarding_completed ? "/" : "/onboarding";
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    try {
      if (mode === "sign-up") {
        const name = String(data.get("name") ?? "").trim();
        const developmentCode = await signUpWithEmail(name, email, password);
        navigate("/verify-email", {
          replace: true,
          state: { developmentCode },
        });
      } else {
        const profile = await signInWithEmail(email, password);
        navigate(destination(profile), { replace: true });
      }
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    setSubmitting(true);
    setError("");
    try {
      const profile = await signInWithGoogle();
      navigate(destination(profile), { replace: true });
    } catch (reason) {
      if (firebaseCode(reason) !== "auth/popup-closed-by-user")
        setError(friendlyError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function forgotPassword(event: FormEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const email = String(
      new FormData(form ?? undefined).get("email") ?? "",
    ).trim();
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    try {
      await resetPassword(email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (reason) {
      setError(friendlyError(reason));
    }
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
              See where your money goes—and where it can take you.
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
              <CardDescription>
                {mode === "sign-in"
                  ? "Sign in to your financial workspace."
                  : "Verify your email before entering Spendova."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 rounded-2xl bg-muted p-1.5">
                <Button
                  type="button"
                  variant={mode === "sign-in" ? "default" : "ghost"}
                  onClick={() => setMode("sign-in")}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={mode === "sign-up" ? "default" : "ghost"}
                  onClick={() => setMode("sign-up")}
                >
                  Sign up
                </Button>
              </div>
              <form className="space-y-4" onSubmit={submitEmail}>
                {mode === "sign-up" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" name="name" autoComplete="name" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    className="h-11 rounded-xl"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "sign-in" && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={forgotPassword}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    className="h-11 rounded-xl"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "sign-up" ? "new-password" : "current-password"
                    }
                    minLength={8}
                    required
                  />
                  {mode === "sign-up" && (
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters.
                    </p>
                  )}
                </div>
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={submitting}
                >
                  {submitting
                    ? "Please wait…"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                disabled={submitting}
                onClick={continueWithGoogle}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
                  <path
                    fill="#4285F4"
                    d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.6A10 10 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.3 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.3-1.9V7.5H3A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.5l3.3-2.6Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.5l3.3 2.6C7.1 7.7 9.4 5.9 12 5.9Z"
                  />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/demo")}
              >
                Preview sample dashboard
              </Button>
              {message && (
                <p
                  role="status"
                  className="rounded-lg bg-primary/10 p-3 text-sm text-primary"
                >
                  {message}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function firebaseCode(reason: unknown) {
  return typeof reason === "object" && reason && "code" in reason
    ? String(reason.code)
    : "";
}

function friendlyError(reason: unknown) {
  const code = firebaseCode(reason);
  if (code === "auth/email-already-in-use")
    return "An account already exists for this email. Sign in instead.";
  if (code === "auth/invalid-credential")
    return "The email or password is incorrect.";
  if (code === "auth/weak-password")
    return "Choose a stronger password with at least 8 characters.";
  if (code === "auth/operation-not-allowed")
    return "Email sign-in is not enabled in Firebase yet.";
  return reason instanceof Error
    ? reason.message
    : "Authentication could not be completed.";
}
