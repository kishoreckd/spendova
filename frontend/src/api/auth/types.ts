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

export type LoginResponse = {
  access_token: string;
  expires_in_seconds: number;
  account: SpendovaUser;
  development_code: string | null;
};

export type TwoFactorMethod = "totp" | "email";
export type SignInMethod = TwoFactorMethod | "recovery";

export type TwoFactorChallenge = {
  two_factor_required: true;
  challenge_token: string;
  method: TwoFactorMethod;
  expires_in_seconds: number;
  development_code: string | null;
};

export type TwoFactorStatus = {
  enabled: boolean;
  method: TwoFactorMethod | null;
  recovery_codes_left: number;
};

export type TotpSetup = { secret: string; otpauth_uri: string };
export type RecoveryCodes = { recovery_codes: string[] };
export type TwoFactorCodeSent = {
  sent: boolean;
  development_code: string | null;
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
