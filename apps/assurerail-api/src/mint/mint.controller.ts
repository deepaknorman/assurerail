import { Controller, Get, Param, Post } from "@nestjs/common";
import { MintService } from "./mint.service";
import { MintRepository } from "./note.repository";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";

@Controller("venue")
export class MintController {
  constructor(
    private readonly mint: MintService,
    private readonly repo: MintRepository,
  ) {}

  /** Mint an AssurePool Note from a pool's tape (verified + mint-ready + k-anon). Issuer only. */
  @Roles("ISSUER")
  @Post("mint/:poolId")
  doMint(@Param("poolId") poolId: string) {
    return this.mint.mint(poolId);
  }

  @Roles(...ALL_ROLES)
  @Get("notes")
  notes() {
    return this.repo.listNotes();
  }
}
