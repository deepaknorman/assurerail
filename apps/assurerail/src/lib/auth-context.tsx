"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  auth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
} from "./firebase";
import { recaptchaToken } from "./recaptcha";
import { vpost } from "./venue";

export interface VenueUser {
  id: string;
  email: string;
  displayName: string | null;
  did: string | null;
  role: string;
  isAdmin: boolean;
  allowlisted: boolean;
  status: string; // PENDING | ACTIVE | SUSPENDED
  emailVerified?: boolean;
  firebaseUid?: string | null;
}

interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  venueUser: VenueUser | null;
  needsOnboarding: boolean;
  error: string;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string, register?: boolean) => Promise<void>;
  onboard: (did?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [venueUser, setVenueUser] = useState<VenueUser | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [error, setError] = useState("");

  // Exchange the Firebase ID token for the venue session (reCAPTCHA Enterprise-defended).
  const establish = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setVenueUser(null);
      setNeedsOnboarding(false);
      return;
    }
    const idToken = await u.getIdToken();
    const rc = await recaptchaToken("LOGIN");
    const res = await vpost<{ user: VenueUser; needsOnboarding: boolean }>("/venue/auth/session", { idToken, recaptchaToken: rc });
    setVenueUser(res.user);
    setNeedsOnboarding(res.needsOnboarding);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setError("");
      try {
        if (u) await establish();
        else {
          setVenueUser(null);
          setNeedsOnboarding(false);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [establish]);

  const loginGoogle = useCallback(async () => {
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const loginEmail = useCallback(async (email: string, password: string, register?: boolean) => {
    setError("");
    try {
      if (register) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const onboard = useCallback(async (did?: string) => {
    setError("");
    const res = await vpost<{ user: VenueUser }>("/venue/auth/onboard", { did });
    setVenueUser(res.user);
    setNeedsOnboarding(false);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setVenueUser(null);
    setNeedsOnboarding(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, firebaseUser, venueUser, needsOnboarding, error, loginGoogle, loginEmail, onboard, logout, refresh: establish }),
    [loading, firebaseUser, venueUser, needsOnboarding, error, loginGoogle, loginEmail, onboard, logout, establish],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
