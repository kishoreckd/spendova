import { useState } from "react";
import type { FormEvent } from "react";
import { authApi } from "@/api/auth/api";
import type {
  SignInMethod,
  SpendovaUser,
  TwoFactorChallenge,
} from "@/api/auth/types";
import { Field } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { controlProps, notifyError, notifySuccess } from "@/lib/forms";

const LABELS: Record<SignInMethod, string> = {
  totp: "Authenticator code",
  email: "Email code",
  recovery: "Backup code",
};

export function TwoFactorStep({
  challenge,
  onDone,
  onCancel,
}: {
  challenge: TwoFactorChallenge;
  onDone: (profile: SpendovaUser) => void;
  onCancel: () => void;
}) {
  const { completeTwoFactor } = useAuth();
  const [method, setMethod] = useState<SignInMethod>(challenge.method);
  const [developmentCode, setDevelopmentCode] = useState(
    challenge.development_code,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(
      new FormData(event.currentTarget).get("code") ?? "",
    ).trim();
    const valid =
      method === "recovery"
        ? /^[a-z0-9]{5}-?[a-z0-9]{5}$/i.test(code)
        : /^\d{6}$/.test(code);
    if (!valid) {
      setError(
        method === "recovery"
          ? "Enter a backup code, like abcde-12345"
          : "Enter the 6-digit code",
      );
      document.getElementById("code")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      onDone(await completeTwoFactor(challenge.challenge_token, method, code));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in");
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const result = await authApi.resendTwoFactorCode(
        challenge.challenge_token,
      );
      setDevelopmentCode(result.development_code);
      notifySuccess("New code sent");
    } catch (reason) {
      notifyError(reason, "Couldn't send a new code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-4">
      {developmentCode && method === "email" && (
        <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
          <strong>Development code:</strong> {developmentCode}
        </div>
      )}
      <form noValidate className="space-y-4" onSubmit={submit}>
        <Field id="code" label={LABELS[method]} error={error}>
          <Input
            {...controlProps("code", error)}
            key={method}
            name="code"
            inputMode={method === "recovery" ? "text" : "numeric"}
            autoComplete="one-time-code"
            maxLength={method === "recovery" ? 11 : 6}
            autoFocus
            placeholder={method === "recovery" ? "xxxxx-xxxxx" : "000000"}
            onChange={() => setError("")}
            className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.3em] sm:h-12"
          />
        </Field>
        <Button
          type="submit"
          className="h-11 w-full rounded-xl sm:h-11"
          loading={saving}
        >
          {saving ? "Checking…" : "Continue"}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-1">
        <Button variant="ghost" className="rounded-xl" onClick={onCancel}>
          Back
        </Button>
        {method === "email" && (
          <Button
            variant="ghost"
            className="rounded-xl"
            loading={resending}
            onClick={() => void resend()}
          >
            Resend code
          </Button>
        )}
        <Button
          variant="ghost"
          className="rounded-xl"
          onClick={() => {
            setError("");
            setMethod(method === "recovery" ? challenge.method : "recovery");
          }}
        >
          {method === "recovery"
            ? LABELS[challenge.method]
            : "Use a backup code"}
        </Button>
      </div>
    </div>
  );
}
