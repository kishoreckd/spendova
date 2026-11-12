/* oxlint-disable react/only-export-components -- isolated browser-test auth fixture */
import type { ReactNode } from "react";

const profile = {
  id: "browser-test", email: "test@example.com", display_name: "Test User", photo_url: null,
  base_currency: "INR", country_code: "IN", locale: "en-IN", time_zone: "Asia/Kolkata",
  onboarding_completed: true, email_verified: true,
};
export function AuthProvider({ children }: { children: ReactNode }) { return children; }
export function useAuth() {
  return { user: {uid:"browser-test"}, profile, loading: false, error: null,
    signOut: async () => {}, retryProfile: async () => {}, updateProfile: async () => profile,
    signInWithEmail: async () => profile,
    signUpWithEmail: async () => null, sendEmailVerificationCode: async () => null, verifyEmailCode: async () => profile,
  };
}
