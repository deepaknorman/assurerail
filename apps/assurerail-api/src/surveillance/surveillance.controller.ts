import { Controller, Get, Param, Post } from "@nestjs/common";
import { SurveillanceService } from "./surveillance.service";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";

@Controller("venue/notes/:noteId/surveillance")
export class SurveillanceController {
  constructor(private readonly surveillance: SurveillanceService) {}

  /** Pull legacy Note surveillance from the configured source provider, anchor each cycle, mirror it. */
  @Roles("ISSUER", "DESK", "TRUSTEE")
  @Post("sync")
  sync(@Param("noteId") noteId: string) {
    return this.surveillance.sync(noteId);
  }

  @Roles(...ALL_ROLES)
  @Get()
  list(@Param("noteId") noteId: string) {
    return this.surveillance.list(noteId);
  }
}
