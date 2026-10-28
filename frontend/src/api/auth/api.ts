import { apiFetch } from "../client";
import type {
  PasswordResetRequested,
  PasswordResetVerified,
  ProfileUpdate,
  SignInSync,
  SpendovaUser,
  VerificationCodeSent,
} from "./types";

export const authApi = {
  /** Creates the profile on first sign-in and keeps name and photo current afterwards. */
  syncSignIn: (body: SignInSync) =>
    apiFetch<SpendovaUser>("/auth/google", { method: "POST", body }),
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
  completePasswordReset: (resetToken: string, newPassword: string) =>
    apiFetch<{ email: string }>("/auth/password-reset/complete", {
      method: "POST",
      body: { reset_token: resetToken, new_password: newPassword },
    }),
};
