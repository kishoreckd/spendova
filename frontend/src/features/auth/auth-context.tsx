/* oxlint-disable react/only-export-components -- the provider and hook intentionally share one context */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, trackEvent } from "@/lib/firebase";
import {
  confirmVerificationCode,
  sendVerificationCode,
  syncGoogleUser,
  updateCurrentUser,
  type SpendovaUser,
} from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  profile: SpendovaUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<SpendovaUser>;
  signInWithEmail: (email: string, password: string) => Promise<SpendovaUser>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  sendEmailVerificationCode: () => Promise<string | null>;
  verifyEmailCode: (code: string) => Promise<SpendovaUser>;
  signOut: () => Promise<void>;
  updateProfile: (values: Partial<SpendovaUser>) => Promise<SpendovaUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUser(user: User) {
  await user.getIdToken();
  return syncGoogleUser({
    email: user.email,
    name: user.displayName,
    photo_url: user.photoURL,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SpendovaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        setError(null);
        if (!firebaseUser) {
          setProfile(null);
          setLoading(false);
          return;
        }
        try {
          setProfile(await syncUser(firebaseUser));
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load your Spendova profile",
          );
        } finally {
          setLoading(false);
        }
      }),
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    try {
      const nextProfile = await syncUser(result.user);
      setUser(result.user);
      setProfile(nextProfile);
      void trackEvent("login_completed", { provider: "google" });
      return nextProfile;
    } catch (reason) {
      await firebaseSignOut(auth);
      throw reason;
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const nextProfile = await syncUser(result.user);
      setUser(result.user);
      setProfile(nextProfile);
      void trackEvent("login_completed", { provider: "password" });
      return nextProfile;
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateFirebaseProfile(result.user, { displayName: name });
      await result.user.getIdToken(true);
      const nextProfile = await syncUser(result.user);
      setUser(result.user);
      setProfile(nextProfile);
      const response = await sendVerificationCode();
      void trackEvent("signup_completed", { provider: "password" });
      return response.development_code;
    },
    [],
  );

  const sendEmailVerificationCode = useCallback(async () => {
    const response = await sendVerificationCode();
    return response.development_code;
  }, []);

  const verifyEmailCode = useCallback(async (code: string) => {
    const nextProfile = await confirmVerificationCode(code);
    setProfile(nextProfile);
    void trackEvent("email_verified");
    return nextProfile;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (values: Partial<SpendovaUser>) => {
    const updated = await updateCurrentUser(values);
    setProfile(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendEmailVerificationCode,
      verifyEmailCode,
      signOut,
      updateProfile,
    }),
    [
      user,
      profile,
      loading,
      error,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendEmailVerificationCode,
      verifyEmailCode,
      signOut,
      updateProfile,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
