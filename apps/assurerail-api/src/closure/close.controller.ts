import { Body, Controller, Param, Post } from "@nestjs/common";
import { CloseService, type CloseInput } from "./close.service";
import { Roles } from "../auth/roles.decorator";

@Controller("venue/notes/:noteId")
export class CloseController {
  constructor(private readonly close: CloseService) {}

  /** Close / redeem the Note: burn tokens (supply → 0), zero holdings, anchor. Issuer/trustee-initiated. */
  @Roles("ISSUER", "TRUSTEE")
  @Post("close")
  redeem(@Param("noteId") noteId: string, @Body() body: CloseInput) {
    return this.close.close(noteId, body ?? {});
  }
}
