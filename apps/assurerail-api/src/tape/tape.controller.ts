import { Controller, Get, Param } from "@nestjs/common";
import { TapeService } from "./tape.service";
import { buildAnonymisedStrat } from "./underlying";
import { config } from "../config";
import { Public } from "../auth/public.decorator";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";

@Controller()
export class TapeController {
  constructor(private readonly tape: TapeService) {}

  @Public()
  @Get("health")
  health() {
    return { ok: true, venue: "AssureRail", tapeSource: config.tapeSource, htsAdapter: config.htsAdapter };
  }

  /** Fetch + independently verify the frozen tape for a pool (the arm's-length interface). */
  @Roles(...ALL_ROLES)
  @Get("venue/tape/:poolId")
  async getTape(@Param("poolId") poolId: string) {
    const { tape, verification } = await this.tape.load(poolId);
    return {
      poolId: tape.poolId,
      tapeHash: tape.tapeHash,
      manifestHash: tape.manifestHash,
      aggregates: tape.aggregates,
      lock: tape.lock,
      verification, // ok / mintReady / reasons
    };
  }

  /** Anonymised loan-level "underlying" (T1.5) — strat tables, PII-free. Full T2 = regulator break-glass. */
  @Roles(...ALL_ROLES)
  @Get("venue/tape/:poolId/underlying")
  underlying(@Param("poolId") poolId: string) {
    return buildAnonymisedStrat(poolId);
  }
}
