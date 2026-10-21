import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { controlProps, notifyError, notifySuccess } from "@/lib/forms";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, verifyEmailCode, sendEmailVerificationCode, signOut } =
    useAuth();
  const initialCode = (
    location.state as { developmentCode?: string | null } | null
  )?.developmentCode;
  const [developmentCode, setDevelopmentCode] = useState(initialCode ?? null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(
      new FormData(event.currentTarget).get("code") ?? "",
    ).trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      document.getElementById("code")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await verifyEmailCode(code);
      navigate(updated.onboarding_completed ? "/" : "/onboarding", {
        replace: true,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not verify the code",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setError("");
    setResending(true);
    try {
      const code = await sendEmailVerificationCode();
      setDevelopmentCode(code);
      notifySuccess("New code sent", profile?.email);
    } catch (reason) {
      notifyError(reason, "Couldn't send a new code");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#d9f5f0_0%,transparent_38%)] px-4 py-6 dark:bg-[radial-gradient(circle_at_top,#073f43_0%,transparent_42%)]">
      <div className="absolute left-1/2 top-8 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <Card className="w-full max-w-md rounded-3xl shadow-xl shadow-primary/5">
        <CardHeader className="items-center text-center">
          <img
            src="/brand/spendova-logo-light.png"
            alt="Spendova"
            className="mb-5 w-36 dark:hidden"
          />
          <img
            src="/brand/spendova-logo-dark.png"
            alt="Spendova"
            className="mb-5 hidden w-36 dark:block"
          />
          <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <CardTitle className="text-2xl">Check your inbox</CardTitle>
          <CardDescription>
            We sent a six-digit code to{" "}
            <span className="font-medium text-foreground">
              {profile?.email ?? "your email"}
            </span>
            . It expires in 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-7 sm:px-8">
          {developmentCode && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
              <strong>Development code:</strong> {developmentCode}
            </div>
          )}
          <form noValidate className="space-y-4" onSubmit={verify}>
            <Field
              id="code"
              label={<span className="sr-only">Verification code</span>}
              error={error}
            >
              <Input
                {...controlProps("code", error)}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="000000"
                onChange={() => setError("")}
                className="h-14 rounded-2xl text-center font-mono text-2xl tracking-[0.55em] sm:h-14"
              />
            </Field>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl sm:h-11"
              loading={saving}
            >
              {saving ? "Verifying…" : "Verify email"}
            </Button>
          </form>
          <div className="flex flex-col-reverse gap-1 min-[380px]:flex-row min-[380px]:justify-between">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => void signOut()}
            >
              Use another account
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl"
              loading={resending}
              onClick={() => void resend()}
            >
              Resend code
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
