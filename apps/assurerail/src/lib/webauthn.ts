// Passkey (WebAuthn) client — @simplewebauthn/browser v8. Register a credential while signed in, list
// and remove them. The browser shows the platform biometric / security-key prompt.
import { startRegistration } from "@simplewebauthn/browser";
import { vget, vpost, vdelete } from "./venue";

export type Passkey = {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export function listPasskeys(): Promise<Passkey[]> {
  return vget<Passkey[]>("/venue/auth/webauthn/credentials");
}

export async function registerPasskey(name?: string): Promise<void> {
  const options = await vpost<Parameters<typeof startRegistration>[0]>("/venue/auth/webauthn/register/options");
  const attResp = await startRegistration(options);
  await vpost("/venue/auth/webauthn/register/verify", { response: attResp, name });
}

export async function deletePasskey(id: string): Promise<void> {
  await vdelete(`/venue/auth/webauthn/credentials/${id}`);
}
