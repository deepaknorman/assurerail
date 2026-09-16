import { Body, Controller, Get, Header, Param, Post, Req } from "@nestjs/common";
import { billingActor } from "./engagement-billing.controllers";
import { ExecutionFeeInvoiceService } from "./execution-fee-invoice.service";
type Request = Parameters<typeof billingActor>[0];

@Controller("v1/rail/institutions/:institutionId/engagements/:engagementId/execution-fees")
export class ExecutionFeeInvoiceParticipantController {
  constructor(private readonly service: ExecutionFeeInvoiceService) {}

  @Get() @Header("Cache-Control", "no-store")
  list(@Req() req: Request, @Param("institutionId") institutionId: string, @Param("engagementId") engagementId: string) {
    return this.service.list(billingActor(req, institutionId), engagementId);
  }

  @Get(":executionInvoiceId/settlement-leg") @Header("Cache-Control", "no-store")
  settlementLeg(@Req() req: Request, @Param("institutionId") institutionId: string, @Param("engagementId") engagementId: string, @Param("executionInvoiceId") executionInvoiceId: string) {
    return this.service.settlementLeg(billingActor(req, institutionId), engagementId, executionInvoiceId);
  }
}

@Controller("v1/rail/internal/engagements/institutions/:institutionId/:engagementId/execution-fees")
export class ExecutionFeeInvoiceInternalController {
  constructor(private readonly service: ExecutionFeeInvoiceService) {}

  @Post()
  prepare(@Req() req: Request, @Param("institutionId") institutionId: string, @Param("engagementId") engagementId: string, @Body() body: Parameters<ExecutionFeeInvoiceService["prepare"]>[3]) {
    return this.service.prepare(billingActor(req), institutionId, engagementId, body);
  }

  @Post(":executionInvoiceId/review")
  review(@Req() req: Request, @Param("institutionId") institutionId: string, @Param("engagementId") engagementId: string, @Param("executionInvoiceId") executionInvoiceId: string, @Body() body: Parameters<ExecutionFeeInvoiceService["review"]>[4]) {
    return this.service.review(billingActor(req), institutionId, engagementId, executionInvoiceId, body);
  }
}
