import { Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { LegacyRoomProxyService } from "./legacy-room-proxy.service";

@Public()
@Controller("internal/v1/legacy-room-proxy")
export class LegacyRoomProxyController {
  constructor(private readonly proxy: LegacyRoomProxyService) {}

  @Post()
  handle(@Req() req: Request, @Body() body: unknown) {
    return this.proxy.handle(req, body);
  }
}
