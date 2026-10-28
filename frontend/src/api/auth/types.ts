export type SpendovaUser = {
  id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  base_currency: string;
  country_code: string | null;
  locale: string;
  time_zone: string;
  onboarding_completed: boolean;
  email_verified: boolean;
};

export type ProfileUpdate = Partial<
  Pick<
    SpendovaUser,
    | "display_name"
    | "base_currency"
    | "country_code"
    | "locale"
    | "time_zone"
    | "onboarding_completed"
  >
>;

export type SignInSync = {
  email: string | null;
  name: string | null;
  photo_url: string | null;
};

export type VerificationCodeSent = {
  sent: boolean;
  expires_in_seconds: number;
  development_code: string | null;
};

export type PasswordResetRequested = {
  sent: boolean;
  expires_in_seconds: number;
  resend_after_seconds: number;
  development_code: string | null;
};

export type PasswordResetVerified = {
  reset_token: string;
  expires_in_seconds: number;
};
