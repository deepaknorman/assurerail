import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { DvpService, type DvpInput } from "./dvp.service";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";

@Controller("venue/notes/:noteId")
export class DvpController {
  constructor(private readonly dvp: DvpService) {}

  /** Atomic DvP: sell `unitsMinor` of the Note to `buyerDid` against `priceMinor` settlement. */
  @Roles("ISSUER", "DESK")
  @Post("dvp")
  execute(@Param("noteId") noteId: string, @Body() body: DvpInput) {
    return this.dvp.execute(noteId, body);
  }

  @Roles(...ALL_ROLES)
  @Get("dvp")
  listDvp(@Param("noteId") noteId: string) {
    return this.dvp.listDvp(noteId);
  }

  @Roles(...ALL_ROLES)
  @Get("holdings")
  holdings(@Param("noteId") noteId: string) {
    return this.dvp.holdings(noteId);
  }
}
