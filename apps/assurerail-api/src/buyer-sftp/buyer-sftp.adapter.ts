import type { BuyerSftpProfile } from "./buyer-sftp.policy";

export type BuyerSftpTransportFile = Readonly<{ filename: string; content: Uint8Array; digest: string }>;
export type BuyerSftpTransportBatch = Readonly<{
  batchRef: string;
  remoteFolder: string;
  manifestFilename: string;
  manifestBytes: Uint8Array;
  manifestDigest: string;
  files: readonly BuyerSftpTransportFile[];
}>;

export type BuyerSftpUploadResult =
  | Readonly<{ outcome: "UPLOADED"; providerTransferRef: string }>
  | Readonly<{ outcome: "FAILED"; reasonCode: string; retriable: boolean }>
  | Readonly<{ outcome: "AMBIGUOUS"; reasonCode: string }>;

export type BuyerSftpInspectionResult =
  | Readonly<{ outcome: "PRESENT"; manifestDigest: string; providerTransferRef: string }>
  | Readonly<{ outcome: "ABSENT" }>
  | Readonly<{ outcome: "UNKNOWN"; reasonCode: string }>;

/** Provider-neutral boundary. Implementations resolve credentialKeyRef at call time and must verify
 * the configured host key before authentication. They must never return key material or passwords. */
export interface BuyerSftpTransportAdapter {
  upload(profile: BuyerSftpProfile, batch: BuyerSftpTransportBatch): Promise<BuyerSftpUploadResult>;
  inspect(profile: BuyerSftpProfile, remoteFolder: string, manifestDigest: string): Promise<BuyerSftpInspectionResult>;
}

/** Test-only adapter. It models a remote SFTP folder without sockets, credentials or external I/O. */
export class FakeBuyerSftpSandboxAdapter implements BuyerSftpTransportAdapter {
  private readonly remote = new Map<string, { manifestDigest: string; providerTransferRef: string }>();
  nextUploadOutcome: BuyerSftpUploadResult | null = null;
  nextInspectionOutcome: BuyerSftpInspectionResult | null = null;
  uploadCalls = 0;

  async upload(profile: BuyerSftpProfile, batch: BuyerSftpTransportBatch): Promise<BuyerSftpUploadResult> {
    if (profile.environment !== "SANDBOX") throw new Error("fake adapter accepts sandbox profiles only");
    this.uploadCalls += 1;
    const injected = this.nextUploadOutcome;
    this.nextUploadOutcome = null;
    if (injected) {
      if (injected.outcome === "UPLOADED") this.remote.set(batch.remoteFolder, { manifestDigest: batch.manifestDigest, providerTransferRef: injected.providerTransferRef });
      return injected;
    }
    const existing = this.remote.get(batch.remoteFolder);
    if (existing) {
      return existing.manifestDigest === batch.manifestDigest
        ? { outcome: "UPLOADED", providerTransferRef: existing.providerTransferRef }
        : { outcome: "FAILED", reasonCode: "REMOTE_FOLDER_CONFLICT", retriable: false };
    }
    const providerTransferRef = `fake_${batch.batchRef}`;
    this.remote.set(batch.remoteFolder, { manifestDigest: batch.manifestDigest, providerTransferRef });
    return { outcome: "UPLOADED", providerTransferRef };
  }

  async inspect(profile: BuyerSftpProfile, remoteFolder: string, manifestDigest: string): Promise<BuyerSftpInspectionResult> {
    if (profile.environment !== "SANDBOX") throw new Error("fake adapter accepts sandbox profiles only");
    const injected = this.nextInspectionOutcome;
    this.nextInspectionOutcome = null;
    if (injected) return injected;
    const existing = this.remote.get(remoteFolder);
    if (!existing) return { outcome: "ABSENT" };
    if (existing.manifestDigest !== manifestDigest) return { outcome: "UNKNOWN", reasonCode: "REMOTE_DIGEST_CONFLICT" };
    return { outcome: "PRESENT", manifestDigest: existing.manifestDigest, providerTransferRef: existing.providerTransferRef };
  }
}
