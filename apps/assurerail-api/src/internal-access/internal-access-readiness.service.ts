import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { evaluateInternalEnforcementCoverage } from "./internal-access-readiness";

@Injectable()
export class InternalAccessReadinessService implements OnApplicationBootstrap {
  private readonly log = new Logger(InternalAccessReadinessService.name);

  constructor(private readonly db: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (inspectPersistenceFlags(process.env).internalRbac !== "enforce") return;
    const assignments = await this.db.internalRoleAssignment.findMany({
      where: { status: "ACTIVE", scopeType: "GLOBAL" },
      include: { user: { select: { status: true, identityVerifiedAt: true } } },
    });
    const errors = evaluateInternalEnforcementCoverage(assignments);
    if (errors.length) throw new Error(`AssureRail internal RBAC enforcement coverage rejected:\n- ${errors.join("\n- ")}`);
    this.log.log("Internal RBAC enforcement coverage verified; legacy platform-admin bypasses disabled");
  }
}
