import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

// AssureRail's OWN Firebase project (`assurerail`). Config comes from NEXT_PUBLIC_FIREBASE_* (set in
// apps/assurerail/.env.local, gitignored) — same pattern as AssureLocker's apps/web, so the public-but-
// gitleaks-flagged apiKey is never committed to a tracked file. Security is enforced by Firebase rules
// + reCAPTCHA + server-side token verification, not by hiding this config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// getAuth() throws `auth/invalid-api-key` on an empty apiKey. That happens during `next build` static
// prerender when NEXT_PUBLIC_FIREBASE_* was not supplied at build time (e.g. a container image built
// without the public config). Guard so the build never crashes; auth is a no-op until the config is
// present (real deploys pass NEXT_PUBLIC_FIREBASE_* as build args — see the containerisation runbook).
export const firebaseConfigured = Boolean(firebaseConfig.apiKey);
export const firebaseApp: FirebaseApp | undefined = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : undefined;
export const auth: Auth = (firebaseApp ? getAuth(firebaseApp) : undefined) as Auth;

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
export type { User };
