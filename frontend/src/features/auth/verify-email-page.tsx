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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-context";

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
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
    setMessage("");
    try {
      const code = await sendEmailVerificationCode();
      setDevelopmentCode(code);
      setMessage("A new verification code was sent.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not send a new code",
      );
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
          <form className="space-y-4" onSubmit={verify}>
            <div className="space-y-2">
              <Label htmlFor="code" className="sr-only">
                Verification code
              </Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                placeholder="000000"
                className="h-14 rounded-2xl text-center font-mono text-2xl tracking-[0.55em]"
                required
              />
            </div>
            <Button className="h-11 w-full rounded-xl" disabled={saving}>
              {saving ? "Verifying…" : "Verify email"}
            </Button>
          </form>
          {message && (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
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
