import { Controller, Get, Param, Post, Query } from "@nestjs/common";
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

  /**
   * Console note list. Returns a bounded page (default 200, max 500) so the query cost can never grow
   * unbounded with cumulative note count; pass ?limit=&offset= to page. The response stays a bare array
   * for backward compatibility with the console.
   */
  @Roles(...ALL_ROLES)
  @Get("notes")
  notes(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    const lim = limit ? Math.min(Math.max(Number(limit) || 200, 1), 500) : 200;
    const off = offset ? Math.max(Number(offset) || 0, 0) : 0;
    return this.repo.listNotesPage(lim, off);
  }
}
