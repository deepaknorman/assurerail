export const PRIVATE_UI_PREFIXES = [
  "/activity",
  "/admin",
  "/cases",
  "/console",
  "/institutions",
  "/internal",
  "/onboard",
  "/settings",
  "/workspace",
] as const;

export function isPrivateUiPath(pathname: string): boolean {
  return PRIVATE_UI_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function privateUiEnabled(value: string | undefined): boolean {
  return value === "yes";
}
