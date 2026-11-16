import { apiFetch } from "../client";
import type {
  PasswordResetRequested,
  PasswordResetVerified,
  ProfileUpdate,
  LoginResponse,
  RecoveryCodes,
  SignInMethod,
  SpendovaUser,
  TotpSetup,
  TwoFactorChallenge,
  TwoFactorCodeSent,
  TwoFactorStatus,
  VerificationCodeSent,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse | TwoFactorChallenge>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    }),
  completeTwoFactor: (
    challengeToken: string,
    method: SignInMethod,
    code: string,
  ) =>
    apiFetch<LoginResponse>("/auth/login/2fa", {
      method: "POST",
      body: { challenge_token: challengeToken, method, code },
      skipRefresh: true,
    }),
  resendTwoFactorCode: (challengeToken: string) =>
    apiFetch<TwoFactorCodeSent>("/auth/login/2fa/resend", {
      method: "POST",
      body: { challenge_token: challengeToken },
      skipRefresh: true,
    }),
  twoFactorStatus: () => apiFetch<TwoFactorStatus>("/auth/2fa"),
  setupTotp: (password: string) =>
    apiFetch<TotpSetup>("/auth/2fa/totp/setup", {
      method: "POST",
      body: { password },
    }),
  enableTotp: (code: string) =>
    apiFetch<RecoveryCodes>("/auth/2fa/totp/enable", {
      method: "POST",
      body: { code },
    }),
  enableEmailTwoFactor: (password: string) =>
    apiFetch<RecoveryCodes>("/auth/2fa/email/enable", {
      method: "POST",
      body: { password },
    }),
  disableTwoFactor: (password: string) =>
    apiFetch<void>("/auth/2fa/disable", {
      method: "POST",
      body: { password },
    }),
  register: (name: string, email: string, password: string) =>
    apiFetch<LoginResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
      skipRefresh: true,
    }),
  logout: () =>
    apiFetch<void>("/auth/logout", { method: "POST", skipRefresh: true }),
  me: () => apiFetch<SpendovaUser>("/auth/me"),
  updateProfile: (body: ProfileUpdate) =>
    apiFetch<SpendovaUser>("/auth/me", { method: "PATCH", body }),
  sendVerificationCode: () =>
    apiFetch<VerificationCodeSent>("/auth/verification/send", {
      method: "POST",
    }),
  confirmVerificationCode: (code: string) =>
    apiFetch<SpendovaUser>("/auth/verification/confirm", {
      method: "POST",
      body: { code },
    }),
  requestPasswordReset: (email: string) =>
    apiFetch<PasswordResetRequested>("/auth/password-reset/request", {
      method: "POST",
      body: { email },
    }),
  verifyPasswordReset: (email: string, code: string) =>
    apiFetch<PasswordResetVerified>("/auth/password-reset/verify", {
      method: "POST",
      body: { email, code },
    }),
  verifyPasswordResetFactor: (
    email: string,
    method: "totp" | "recovery",
    code: string,
  ) =>
    apiFetch<PasswordResetVerified>("/auth/password-reset/verify-factor", {
      method: "POST",
      body: { email, method, code },
    }),
  completePasswordReset: (resetToken: string, newPassword: string) =>
    apiFetch<{ email: string }>("/auth/password-reset/complete", {
      method: "POST",
      body: { reset_token: resetToken, new_password: newPassword },
    }),
};
