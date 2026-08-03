import { Body, Controller, Param, Post } from "@nestjs/common";
import { DemoService } from "./demo.service";
import { Roles } from "../auth/roles.decorator";

@Controller("venue/demo")
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  /** One-call end-to-end: mint → surveillance → atomic DvP, with the full trace. Issuer/admin only. */
  @Roles("ISSUER")
  @Post("run/:poolId")
  run(@Param("poolId") poolId: string, @Body() body: { buyerDid?: string }) {
    return this.demo.run(poolId, body?.buyerDid);
  }

  /** Model B — trustee-authorised receivables-pool primary issuance, with the full step-by-step trace. */
  @Roles("ISSUER")
  @Post("receivables/run/:poolId")
  runReceivables(@Param("poolId") poolId: string, @Body() body: { buyerDid?: string }) {
    return this.demo.runReceivablesModelB(poolId, body?.buyerDid);
  }
}
