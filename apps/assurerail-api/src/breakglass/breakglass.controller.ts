import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { BreakGlassService, type BreakGlassInput } from "./breakglass.service";
import { Roles } from "../auth/roles.decorator";

@Controller("venue/notes/:noteId/break-glass")
export class BreakGlassController {
  constructor(private readonly bg: BreakGlassService) {}

  /** Regulator requests T2 access (anchored, lawful-purpose gated). Regulator only. */
  @Roles("REGULATOR")
  @Post()
  request(@Param("noteId") noteId: string, @Body() body: BreakGlassInput) {
    return this.bg.request(noteId, body);
  }

  @Roles("REGULATOR", "TRUSTEE")
  @Get()
  list(@Param("noteId") noteId: string) {
    return this.bg.list(noteId);
  }
}
