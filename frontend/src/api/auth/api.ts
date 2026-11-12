import { apiFetch } from "../client";
import type {
  PasswordResetRequested,
  PasswordResetVerified,
  ProfileUpdate,
  LoginResponse,
  SpendovaUser,
  VerificationCodeSent,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipRefresh: true,
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
  completePasswordReset: (resetToken: string, newPassword: string) =>
    apiFetch<{ email: string }>("/auth/password-reset/complete", {
      method: "POST",
      body: { reset_token: resetToken, new_password: newPassword },
    }),
};
