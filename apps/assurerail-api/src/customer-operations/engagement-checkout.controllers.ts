import { Controller, Header, HttpCode, Injectable, Param, Post, Req } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Public } from "../auth/public.decorator";
import { billingActor } from "./engagement-billing.controllers";
import { EngagementCheckoutService } from "./engagement-checkout.service";
type Request = Parameters<typeof billingActor>[0] & {rawBody?:Buffer};
@Controller("v1/rail/institutions/:institutionId/engagements/:engagementId/stages/:stage")
export class EngagementCheckoutController {
  constructor(private readonly service:EngagementCheckoutService) {}
  @Post("checkout") @Header("Cache-Control","no-store")
  create(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Param("stage") s:string) { return this.service.create(billingActor(req,id),e,s); }
  @Post("checkout/reconcile") @Header("Cache-Control","no-store")
  refresh(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Param("stage") s:string) { return this.service.refresh(billingActor(req,id),e,s); }
}
@Controller("v1/rail/payment-webhooks")
export class EngagementPaymentWebhookController {
  constructor(private readonly service:EngagementCheckoutService) {}
  @Public() @Post("razorpay") @HttpCode(200)
  webhook(@Req() req:Request) { return this.service.webhook(req.rawBody,req.header("x-razorpay-signature"),req.header("x-razorpay-event-id")); }
}
@Injectable()
export class EngagementPaymentWorker {
  private running=false;
  constructor(private readonly service:EngagementCheckoutService) {}
  @Interval(15000)
  async tick() { if(this.running)return; this.running=true; try { await this.service.processInbox(); } catch { /* Durable inbox remains retryable; never log provider payloads or keys. */ } finally {this.running=false;} }
}
