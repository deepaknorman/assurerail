import { ForbiddenException, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { sha256Digest } from "../contracts/v1";
import type { ActivationManifestV1 } from "../runtime/activation-manifest";
import { isLiveCapabilityImplemented } from "../runtime/live-capability-registry";
import { assertRuntimeEnvironment } from "../runtime/runtime-profile";
import { PrismaService } from "../store/prisma.service";

@Injectable()
export class OperationalActivationGuardService implements OnApplicationBootstrap {
  constructor(private readonly db: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const runtime = assertRuntimeEnvironment(process.env);
    if (!runtime.liveExternalActionsRequired) return;
    await this.assertCurrentActivation();
  }

  async assertCurrentActivation() {
    const runtime = assertRuntimeEnvironment(process.env);
    const manifestId = runtime.activation.manifestId;
    const manifestDigest = runtime.activation.manifestDigest;
    if (!runtime.liveExternalActionsRequired || !manifestId || !manifestDigest) {
      throw new ForbiddenException("a signed live activation manifest is not active for this process");
    }
    const activation = await this.db.deploymentActivation.findUnique({
      where: { manifestId },
      include: { gateBindings: { include: { readinessGate: true, readinessDecision: true } } },
    });
    const now = new Date();
    if (!activation || activation.status !== "APPROVED" || activation.manifestDigest !== manifestDigest
      || activation.environment !== process.env.ASSURERAIL_ENVIRONMENT
      || activation.operatingMode !== runtime.operatingMode
      || activation.buildCommit !== process.env.ASSURERAIL_BUILD_COMMIT
      || activation.expiresAt <= now) {
      throw new ForbiddenException("durable deployment activation is missing, revoked, expired or does not match this process");
    }
    if (sha256Digest(activation.manifest) !== manifestDigest) {
      throw new ForbiddenException("durable deployment activation manifest bytes no longer match its approved digest");
    }
    const manifest = activation.manifest as unknown as ActivationManifestV1;
    if (!Array.isArray(manifest.gates) || manifest.gates.length !== activation.gateBindings.length) {
      throw new ForbiddenException("durable deployment activation has an incomplete gate binding set");
    }
    for (const binding of activation.gateBindings) {
      const manifestGate = manifest.gates.find((gate) => gate.code === binding.gateCode);
      if (binding.readinessGate.status !== "ACCEPTED"
        || binding.readinessGate.currentDecisionId !== binding.readinessDecisionId
        || !binding.readinessGate.expiresAt || binding.readinessGate.expiresAt <= now
        || binding.readinessDecision.decision !== "ACCEPT" || binding.readinessDecision.expiresAt <= now
        || binding.evidenceDigest !== binding.readinessDecision.evidenceDigest
        || !manifestGate || manifestGate.scopeKey !== binding.scopeKey
        || manifestGate.decisionRef !== binding.readinessDecisionId
        || manifestGate.evidenceDigest !== binding.evidenceDigest) {
        throw new ForbiddenException(`deployment activation blocked by changed or expired readiness gate ${binding.gateCode}`);
      }
    }
    return activation;
  }

  async requireCapability(capabilityId: string) {
    if (!isLiveCapabilityImplemented(capabilityId)) {
      throw new ForbiddenException(`capability ${capabilityId} is not implemented as a controlled-live command in this build`);
    }
    const runtime = assertRuntimeEnvironment(process.env);
    if (!runtime.activation.capabilityIds.includes(capabilityId)) {
      throw new ForbiddenException(`capability ${capabilityId} is not allow-listed by the signed activation manifest`);
    }
    return this.assertCurrentActivation();
  }
}
