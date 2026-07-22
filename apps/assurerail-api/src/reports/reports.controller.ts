import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";

@Controller("venue")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles(...ALL_ROLES)
  @Get("reports/portfolio")
  portfolio(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    const lim = limit ? Math.min(Math.max(Number(limit) || 50, 1), 500) : 50;
    const off = offset ? Math.max(Number(offset) || 0, 0) : 0;
    return this.reports.portfolio(lim, off);
  }

  @Roles(...ALL_ROLES)
  @Get("notes/:id/report")
  noteReport(@Param("id") id: string) {
    return this.reports.noteReport(id);
  }

  /** CSV download of a Note's holdings + trades. */
  @Roles(...ALL_ROLES)
  @Get("notes/:id/export.csv")
  async csv(@Param("id") id: string, @Res() res: Response) {
    const report = await this.reports.noteReport(id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="note-${id.replace(/[^\w.-]/g, "_")}.csv"`);
    res.send(this.reports.csv(report));
  }
}
