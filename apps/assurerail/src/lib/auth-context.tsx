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
import { currentInstitutionContext, rememberInstitutionContext, vpost } from "./venue";

export interface VenueUser {
  id: string;
  email: string;
  displayName: string | null;
  did: string | null;
  role: string;
  isAdmin: boolean;
  platformRole?: string | null; // SUPERADMIN | ADMIN | null
  entityDid?: string | null;
  entityRole?: string | null; // ORGADMIN | MANAGER | OPERATOR | null
  allowlisted: boolean;
  status: string; // PENDING | ACTIVE | SUSPENDED
  emailVerified?: boolean;
  firebaseUid?: string | null;
  identityProvider?: string | null;
  identitySubject?: string | null;
  identityVerifiedAt?: string | null;
}

interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  venueUser: VenueUser | null;
  needsOnboarding: boolean;
  activeInstitutionId: string | null;
  error: string;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string, register?: boolean) => Promise<void>;
  onboard: (subject?: string) => Promise<void>;
  selectInstitution: (institutionId: string | null) => Promise<void>;
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
  const [activeInstitutionId, setActiveInstitutionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Exchange the Firebase ID token for the venue session (reCAPTCHA Enterprise-defended).
  const establish = useCallback(async (requestedInstitutionId?: string | null) => {
    const u = auth.currentUser;
    if (!u) {
      setVenueUser(null);
      setNeedsOnboarding(false);
      setActiveInstitutionId(null);
      return;
    }
    const idToken = await u.getIdToken();
    const rc = await recaptchaToken("LOGIN");
    const requested = requestedInstitutionId === undefined
      ? currentInstitutionContext()
      : requestedInstitutionId;
    const exchange = (institutionId: string | null) => vpost<{
      user: VenueUser;
      needsOnboarding: boolean;
      session: { activeInstitutionId: string | null };
    }>("/venue/auth/session", {
      idToken,
      recaptchaToken: rc,
      activeInstitutionId: institutionId,
    }, { institutionId: null });
    let res;
    try {
      res = await exchange(requested);
    } catch (cause) {
      if (requestedInstitutionId !== undefined || !requested) throw cause;
      rememberInstitutionContext(null);
      res = await exchange(null);
    }
    setVenueUser(res.user);
    setNeedsOnboarding(res.needsOnboarding);
    const active = res.session.activeInstitutionId ?? null;
    rememberInstitutionContext(active);
    setActiveInstitutionId(active);
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
          setActiveInstitutionId(null);
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

  const onboard = useCallback(async (subject?: string) => {
    setError("");
    const res = await vpost<{ user: VenueUser }>("/venue/auth/onboard", { subject });
    setVenueUser(res.user);
    setNeedsOnboarding(false);
  }, []);

  const selectInstitution = useCallback(async (institutionId: string | null) => {
    setError("");
    await establish(institutionId);
  }, [establish]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setVenueUser(null);
    setNeedsOnboarding(false);
    setActiveInstitutionId(null);
    rememberInstitutionContext(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      firebaseUser,
      venueUser,
      needsOnboarding,
      activeInstitutionId,
      error,
      loginGoogle,
      loginEmail,
      onboard,
      selectInstitution,
      logout,
      refresh: () => establish(),
    }),
    [loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId, error, loginGoogle, loginEmail, onboard, selectInstitution, logout, establish],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
