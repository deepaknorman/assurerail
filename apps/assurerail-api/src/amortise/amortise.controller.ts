import { BadRequestException, Body, Controller, Param, Post } from "@nestjs/common";
import { AmortiseService } from "./amortise.service";
import { Roles } from "../auth/roles.decorator";

interface AmortiseBody {
  principalMinor?: string | number;
}

@Controller("venue")
export class AmortiseController {
  constructor(private readonly amortise: AmortiseService) {}

  /** Partial pro-rata amortisation — a governed action (burns supply); issuer/trustee only. */
  @Roles("ISSUER", "TRUSTEE")
  @Post("notes/:noteId/amortise")
  run(@Param("noteId") noteId: string, @Body() body: AmortiseBody) {
    if (body.principalMinor === undefined || body.principalMinor === null || `${body.principalMinor}`.trim() === "") {
      throw new BadRequestException("principalMinor is required");
    }
    return this.amortise.amortise(noteId, { principalMinor: String(body.principalMinor) });
  }
}
