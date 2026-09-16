import { Body, Controller, Get, Header, Param, Post, Req } from "@nestjs/common";
import { billingActor } from "./engagement-billing.controllers";
import { AssessmentEngagementService } from "./assessment-engagement.service";
type Request = Parameters<typeof billingActor>[0];

@Controller("v1/rail/institutions/:institutionId/engagements")
export class AssessmentEngagementController {
  constructor(private readonly service: AssessmentEngagementService) {}
  @Get() @Header("Cache-Control", "no-store")
  list(@Req() req: Request, @Param("institutionId") id: string) { return this.service.list(billingActor(req,id)); }
  @Post() @Header("Cache-Control", "no-store")
  offer(@Req() req: Request, @Param("institutionId") id: string, @Body() body: Parameters<AssessmentEngagementService["offer"]>[1]) { return this.service.offer(billingActor(req,id),body); }
  @Post(":engagementId/accept")
  accept(@Req() req: Request, @Param("institutionId") id: string, @Param("engagementId") e: string, @Body() body: Parameters<AssessmentEngagementService["accept"]>[2]) { return this.service.accept(billingActor(req,id),e,body); }
  @Post(":engagementId/preparation")
  preparation(@Req() req: Request, @Param("institutionId") id: string, @Param("engagementId") e: string, @Body() body: Parameters<AssessmentEngagementService["choosePreparation"]>[2]) { return this.service.choosePreparation(billingActor(req,id),e,body); }
  @Get(":engagementId/stages/:stage/readiness") @Header("Cache-Control", "no-store")
  readiness(@Req() req: Request, @Param("institutionId") id: string, @Param("engagementId") e: string, @Param("stage") stage: string) { return this.service.readiness(billingActor(req,id),e,stage); }
}

@Controller("v1/rail/internal/engagements/institutions/:institutionId")
export class AssessmentEngagementInternalController {
  constructor(private readonly service: AssessmentEngagementService) {}
  @Post("design-partners")
  proposeDesignPartner(@Req() req: Request, @Param("institutionId") id: string, @Body() body: Parameters<AssessmentEngagementService["proposeDesignPartner"]>[2]) { return this.service.proposeDesignPartner(billingActor(req), id, body); }
  @Post("design-partners/:couponId/review")
  reviewDesignPartner(@Req() req: Request, @Param("institutionId") id: string, @Param("couponId") couponId: string, @Body() body: Parameters<AssessmentEngagementService["reviewDesignPartner"]>[3]) { return this.service.reviewDesignPartner(billingActor(req), id, couponId, body); }
  @Post(":engagementId/stages/:stage/invoice")
  invoice(@Req() req: Request, @Param("institutionId") id: string, @Param("engagementId") e: string, @Param("stage") stage: string, @Body() body: Parameters<AssessmentEngagementService["prepareInvoice"]>[4]) { return this.service.prepareInvoice(billingActor(req),id,e,stage,body); }
}
