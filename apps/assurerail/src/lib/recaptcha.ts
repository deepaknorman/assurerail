// reCAPTCHA Enterprise (score-based) client. Loads the enterprise script once and executes an action to
// mint a token the venue API verifies via the Assessment API. Fail-soft: if it can't load/execute it
// returns undefined and the server treats it per RECAPTCHA_ENFORCE.
// Public reCAPTCHA Enterprise site key — from NEXT_PUBLIC_RECAPTCHA_SITE_KEY (apps/assurerail/.env.local).
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

type Grecaptcha = { enterprise?: { ready: (cb: () => void) => void; execute: (k: string, o: { action: string }) => Promise<string> } };

let loaded: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (loaded) return loaded;
  loaded = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha?.enterprise) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("recaptcha failed to load"));
    document.head.appendChild(s);
  });
  return loaded;
}

export async function recaptchaToken(action: string): Promise<string | undefined> {
  try {
    await loadScript();
    const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha?.enterprise;
    if (!g) return undefined;
    return await new Promise<string | undefined>((resolve) => {
      g.ready(() => {
        g.execute(SITE_KEY, { action })
          .then(resolve)
          .catch(() => resolve(undefined));
      });
    });
  } catch {
    return undefined;
  }
}
