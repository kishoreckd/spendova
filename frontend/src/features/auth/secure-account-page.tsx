import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { authApi } from "@/api/auth/api";
import type { TotpSetup } from "@/api/auth/types";
import { Field } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { controlProps, notifyError, notifySuccess } from "@/lib/forms";

type Step = "choose" | "totp" | "email" | "codes";

export default function SecureAccountPage() {
  const navigate = useNavigate();
  const { profile, sendEmailVerificationCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState<"totp" | "email" | "submit" | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qr, setQr] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const next = profile?.onboarding_completed ? "/" : "/onboarding";

  useEffect(() => {
    let current = true;
    if (setup)
      void QRCode.toDataURL(setup.otpauth_uri, { width: 220, margin: 1 })
        .then((url) => current && setQr(url))
        .catch(() => current && setQr(""));
    return () => {
      current = false;
    };
  }, [setup]);

  function finish(recoveryCodes: string[]) {
    setCodes(recoveryCodes);
    setStep("codes");
    notifySuccess("Two-step sign-in is on");
  }

  async function chooseTotp() {
    if (!password) {
      setError("Enter your password");
      document.getElementById("security-password")?.focus();
      return;
    }
    setBusy("totp");
    try {
      setSetup(await authApi.setupTotp(password));
      setError("");
      setStep("totp");
    } catch (reason) {
      notifyError(reason, "Couldn't start setup");
    } finally {
      setBusy(null);
    }
  }

  async function chooseEmail() {
    if (!password) {
      setError("Enter your password");
      document.getElementById("security-password")?.focus();
      return;
    }
    setBusy("email");
    try {
      if (profile?.email_verified) {
        finish((await authApi.enableEmailTwoFactor(password)).recovery_codes);
      } else {
        setDevelopmentCode(await sendEmailVerificationCode());
        setError("");
        setStep("email");
      }
    } catch (reason) {
      notifyError(reason, "Couldn't send a code");
    } finally {
      setBusy(null);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(
      new FormData(event.currentTarget).get("code") ?? "",
    ).trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      document.getElementById("code")?.focus();
      return;
    }
    setBusy("submit");
    setError("");
    try {
      if (step === "totp") {
        finish((await authApi.enableTotp(code)).recovery_codes);
      } else {
        await verifyEmailCode(code);
        finish((await authApi.enableEmailTwoFactor(password)).recovery_codes);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Incorrect code");
    } finally {
      setBusy(null);
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      notifySuccess("Backup codes copied");
    } catch (reason) {
      notifyError(reason, "Couldn't copy");
    }
  }

  const codeForm = (
    <form noValidate className="space-y-4" onSubmit={submitCode}>
      <Field
        id="code"
        label={step === "totp" ? "Authenticator code" : "Email code"}
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
          className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.4em] sm:h-12"
        />
      </Field>
      <Button
        type="submit"
        className="h-11 w-full rounded-xl sm:h-11"
        loading={busy === "submit"}
      >
        {busy === "submit" ? "Checking…" : "Turn on"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full rounded-xl"
        onClick={() => setStep("choose")}
      >
        Back
      </Button>
    </form>
  );

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#d9f5f0_0%,transparent_38%)] px-4 py-6 dark:bg-[radial-gradient(circle_at_top,#073f43_0%,transparent_42%)]">
      <Card className="w-full max-w-md rounded-3xl shadow-xl shadow-primary/5">
        <CardHeader className="items-center text-center">
          <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <CardTitle className="text-2xl">
            {step === "codes"
              ? "Save your backup codes"
              : "Secure your account"}
          </CardTitle>
          {step === "email" && (
            <CardDescription>
              Code sent to{" "}
              <span className="font-medium text-foreground">
                {profile?.email}
              </span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-7 sm:px-8">
          {step === "choose" && (
            <>
              <Field
                id="security-password"
                label="Current password"
                error={error}
              >
                <PasswordInput
                  {...controlProps("security-password", error)}
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                />
              </Field>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 rounded-2xl p-4 text-left"
                loading={busy === "totp"}
                disabled={busy !== null}
                onClick={() => void chooseTotp()}
              >
                <Smartphone className="size-5 text-primary" />
                <span className="font-medium">Authenticator app</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 rounded-2xl p-4 text-left"
                loading={busy === "email"}
                disabled={busy !== null}
                onClick={() => void chooseEmail()}
              >
                <Mail className="size-5 text-primary" />
                <span className="font-medium">Email code</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl"
                disabled={busy !== null}
                onClick={() => navigate(next, { replace: true })}
              >
                Skip for now
              </Button>
            </>
          )}
          {step === "totp" && setup && (
            <>
              {qr && (
                <img
                  src={qr}
                  width={220}
                  height={220}
                  alt="Authenticator QR code"
                  className="mx-auto rounded-xl bg-white p-2"
                />
              )}
              <code className="block break-all rounded-xl border p-3 text-center text-sm">
                {setup.secret}
              </code>
              {codeForm}
            </>
          )}
          {step === "email" && (
            <>
              {developmentCode && (
                <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
                  <strong>Development code:</strong> {developmentCode}
                </div>
              )}
              {codeForm}
            </>
          )}
          {step === "codes" && (
            <>
              <ul className="grid grid-cols-2 gap-2 rounded-2xl border p-4 font-mono text-sm">
                {codes.map((code) => (
                  <li key={code} className="text-center">
                    {code}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl sm:h-11"
                onClick={() => void copyCodes()}
              >
                <Copy /> Copy codes
              </Button>
              <Button
                className="h-11 w-full rounded-xl sm:h-11"
                onClick={() => navigate(next, { replace: true })}
              >
                I saved them
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
