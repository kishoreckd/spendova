import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
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
import {
  completePasswordReset,
  requestPasswordReset,
  verifyPasswordReset,
} from "@/lib/api";
import { controlProps, errorMessage, notifySuccess } from "@/lib/forms";

type Step = "email" | "code" | "password";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordProblem(password: string) {
  if (!password) return "Enter a new password";
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 128) return "Use 128 characters or fewer";
  if (password.trim() !== password) return "Remove spaces at the start or end";
  if (!/[a-z]/i.test(password) || !/\d/.test(password))
    return "Use at least one letter and one number";
  return "";
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(
    (location.state as { email?: string } | null)?.email ?? "",
  );
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState<"send" | "verify" | "save" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"email" | "code" | "password" | "confirm", string>>
  >({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function focus(id: string) {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const clean = email.trim();
    if (!EMAIL_PATTERN.test(clean)) {
      setFieldErrors({
        email: clean
          ? "Enter a valid email, like name@example.com"
          : "Enter your email",
      });
      focus("reset-email");
      return;
    }
    setBusy("send");
    setFormError("");
    try {
      const result = await requestPasswordReset(clean);
      setDevelopmentCode(result.development_code);
      setResendIn(result.resend_after_seconds);
      setCode("");
      setFieldErrors({});
      if (step === "code") notifySuccess("New code sent", clean);
      setStep("code");
      focus("reset-code");
    } catch (reason) {
      setFormError(errorMessage(reason, "Could not send a code. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: "Enter the 6-digit code" });
      focus("reset-code");
      return;
    }
    setBusy("verify");
    setFormError("");
    try {
      const result = await verifyPasswordReset(email.trim(), code);
      setResetToken(result.reset_token);
      setFieldErrors({});
      setStep("password");
      focus("new-password");
    } catch (reason) {
      setFieldErrors({ code: errorMessage(reason, "That code didn't work") });
      focus("reset-code");
    } finally {
      setBusy(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(password);
    const mismatch =
      !problem && password !== confirm ? "Passwords don't match" : "";
    setFieldErrors({
      password: problem || undefined,
      confirm: mismatch || undefined,
    });
    if (problem || mismatch) {
      focus(problem ? "new-password" : "confirm-password");
      return;
    }
    setBusy("save");
    setFormError("");
    try {
      const result = await completePasswordReset(resetToken, password);
      notifySuccess("Password updated", "Sign in with your new password.");
      navigate("/sign-in", { replace: true, state: { email: result.email } });
    } catch (reason) {
      setFormError(
        errorMessage(reason, "Could not update your password. Try again."),
      );
    } finally {
      setBusy(null);
    }
  }

  const heading = {
    email: { icon: KeyRound, title: "Forgot password", description: "" },
    code: {
      icon: MailCheck,
      title: "Check your inbox",
      description: email.trim(),
    },
    password: {
      icon: ShieldCheck,
      title: "Set a new password",
      description: email.trim(),
    },
  }[step];
  const Icon = heading.icon;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#d9f5f0_0%,transparent_38%)] px-4 py-6 dark:bg-[radial-gradient(circle_at_top,#073f43_0%,transparent_42%)]">
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
            <Icon className="size-7" />
          </div>
          <CardTitle className="text-2xl">{heading.title}</CardTitle>
          {heading.description && (
            <CardDescription className="font-medium text-foreground">
              {heading.description}
            </CardDescription>
          )}
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {(["email", "code", "password"] as const).map((item, index) => (
              <span
                key={item}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  index <= ["email", "code", "password"].indexOf(step)
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-7 sm:px-8">
          {step === "email" && (
            <form noValidate className="space-y-4" onSubmit={sendCode}>
              <Field id="reset-email" label="Email" error={fieldErrors.email}>
                <Input
                  {...controlProps("reset-email", fieldErrors.email)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  className="h-11 rounded-xl sm:h-11"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors({});
                  }}
                />
              </Field>
              <FormAlert>{formError}</FormAlert>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl sm:h-11"
                loading={busy === "send"}
              >
                {busy === "send" ? "Sending…" : "Send code"}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form noValidate className="space-y-4" onSubmit={verify}>
              {developmentCode && (
                <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
                  <strong>Development code:</strong> {developmentCode}
                </div>
              )}
              <Field
                id="reset-code"
                label={<span className="sr-only">6-digit code</span>}
                error={fieldErrors.code}
              >
                <Input
                  {...controlProps("reset-code", fieldErrors.code)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  className="h-14 rounded-2xl text-center font-mono text-2xl tracking-[0.55em] sm:h-14"
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setFieldErrors({});
                  }}
                />
              </Field>
              <FormAlert>{formError}</FormAlert>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl sm:h-11"
                loading={busy === "verify"}
              >
                {busy === "verify" ? "Checking…" : "Verify code"}
              </Button>
              <div className="flex flex-col-reverse gap-1 min-[380px]:flex-row min-[380px]:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => {
                    setStep("email");
                    setFieldErrors({});
                    setFormError("");
                    focus("reset-email");
                  }}
                >
                  Change email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  disabled={resendIn > 0}
                  loading={busy === "send"}
                  onClick={() => void sendCode()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </Button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form noValidate className="space-y-4" onSubmit={save}>
              <Field
                id="new-password"
                label="New password"
                error={fieldErrors.password}
              >
                <div className="relative">
                  <Input
                    {...controlProps("new-password", fieldErrors.password)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    className="h-11 rounded-xl pr-11 sm:h-11"
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        password: undefined,
                      }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </Field>
              <Field
                id="confirm-password"
                label="Confirm password"
                error={fieldErrors.confirm}
              >
                <Input
                  {...controlProps("confirm-password", fieldErrors.confirm)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  className="h-11 rounded-xl sm:h-11"
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      confirm: undefined,
                    }));
                  }}
                />
              </Field>
              <FormAlert>{formError}</FormAlert>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl sm:h-11"
                loading={busy === "save"}
              >
                {busy === "save" ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}

          <Button
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => navigate("/sign-in")}
          >
            <ArrowLeft />
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
