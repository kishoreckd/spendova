/* oxlint-disable react/only-export-components -- provider and hook share a context */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/api/auth/api";
import type {
  LoginResponse,
  ProfileUpdate,
  SpendovaUser,
} from "@/api/auth/types";
import { ApiError, refreshAccessToken, waitForRefresh } from "@/api/client";
import {
  clearSession,
  getAccessToken,
  getSessionEpoch,
  onSessionCleared,
  startSession,
} from "@/lib/session";
import { queryClient } from "@/lib/query-client";

type AuthContextValue = {
  user: { uid: string } | null;
  profile: SpendovaUser | null;
  loading: boolean;
  error: string | null;
  retryProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<SpendovaUser>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  sendEmailVerificationCode: () => Promise<string | null>;
  verifyEmailCode: (code: string) => Promise<SpendovaUser>;
  signOut: () => Promise<void>;
  updateProfile: (values: ProfileUpdate) => Promise<SpendovaUser>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SpendovaUser | null>(null);
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const dropProfile = useCallback(() => {
    ++generation.current;
    queryClient.clear();
    setProfile(null);
    setUser(null);
    setLoading(false);
  }, []);
  const restore = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      await refreshAccessToken();
      const next = await authApi.me();
      if (requestId !== generation.current) return;
      startSession(getAccessToken()!, next.id);
      setProfile(next);
      setUser({ uid: next.id });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) return;
      if (requestId === generation.current) {
        if (getAccessToken()) setUser({ uid: "pending" });
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load your profile",
        );
      }
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const unsubscribe = onSessionCleared(dropProfile);
    // oxlint-disable-next-line react/set-state-in-effect -- restore the external HttpOnly-cookie session on mount
    void restore();
    return () => {
      unsubscribe();
    };
  }, [restore, dropProfile]);
  const acceptLogin = useCallback((result: LoginResponse) => {
    queryClient.clear();
    startSession(result.access_token, result.account.id);
    setProfile(result.account);
    setUser({ uid: result.account.id });
    setError(null);
    setLoading(false);
  }, []);
  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const requestId = ++generation.current;
      const result = await authApi.login(email, password);
      if (requestId !== generation.current)
        throw new Error("Sign-in changed. Please try again.");
      acceptLogin(result);
      return result.account;
    },
    [acceptLogin],
  );
  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const requestId = ++generation.current;
      const result = await authApi.register(name, email, password);
      if (requestId !== generation.current)
        throw new Error("Sign-in changed. Please try again.");
      acceptLogin(result);
      return result.development_code;
    },
    [acceptLogin],
  );
  const sendEmailVerificationCode = useCallback(
    async () => (await authApi.sendVerificationCode()).development_code,
    [],
  );
  const verifyEmailCode = useCallback(async (code: string) => {
    const epoch = getSessionEpoch();
    const next = await authApi.confirmVerificationCode(code);
    if (epoch === getSessionEpoch()) setProfile(next);
    return next;
  }, []);
  const updateProfile = useCallback(async (values: ProfileUpdate) => {
    const epoch = getSessionEpoch();
    const next = await authApi.updateProfile(values);
    if (epoch === getSessionEpoch()) setProfile(next);
    return next;
  }, []);
  const signOut = useCallback(async () => {
    await waitForRefresh();
    await authApi.logout();
    clearSession();
    setError(null);
  }, []);
  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      retryProfile: restore,
      signInWithEmail,
      signUpWithEmail,
      sendEmailVerificationCode,
      verifyEmailCode,
      updateProfile,
      signOut,
    }),
    [
      user,
      profile,
      loading,
      error,
      restore,
      signInWithEmail,
      signUpWithEmail,
      sendEmailVerificationCode,
      verifyEmailCode,
      updateProfile,
      signOut,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
