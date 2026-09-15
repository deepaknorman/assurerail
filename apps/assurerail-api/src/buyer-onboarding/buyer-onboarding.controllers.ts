import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { BuyerOnboardingService } from "./buyer-onboarding.service";
type RailRequest = Request & {user?:{id?:string;session?:{id?:string;activeInstitutionId?:string|null}|null;activeInstitution?:{institutionId?:string}|null}};
function actor(req:RailRequest,institutionId?:string){
  if(!req.user?.id||!req.user.session?.id)throw new UnauthorizedException("approved authenticated session required");
  if(institutionId?(req.user.activeInstitution?.institutionId!==institutionId||req.user.session.activeInstitutionId!==institutionId):Boolean(req.user.session.activeInstitutionId||req.user.activeInstitution))throw new ForbiddenException("active institution context does not match this operation");
  return {actorUserId:req.user.id,actorSessionId:req.user.session.id,actingInstitutionId:institutionId??""};
}
@Controller("v1/rail/institutions/:institutionId/buyer-onboarding")
export class BuyerOnboardingController {
  constructor(private readonly service:BuyerOnboardingService){}
  @Get() overview(@Req() req:RailRequest,@Param("institutionId") id:string){return this.service.overview(actor(req,id));}
  @Post("provider-launch") @Header("Cache-Control","no-store") launch(@Req() req:RailRequest,@Param("institutionId") id:string,@Body() body:{stepUpEvidenceId:unknown}){return this.service.providerLaunch(actor(req,id),body);}
  @Post("profiles") create(@Req() req:RailRequest,@Param("institutionId") id:string,@Body() body:Parameters<BuyerOnboardingService["createProfile"]>[1]){return this.service.createProfile(actor(req,id),body);}
  @Post("profiles/:profileId") change(@Req() req:RailRequest,@Param("institutionId") id:string,@Param("profileId") profileId:string,@Body() body:Parameters<BuyerOnboardingService["changeProfile"]>[2]){return this.service.changeProfile(actor(req,id),profileId,body);}
}
@Controller("v1/rail/internal/buyer-onboarding/institutions/:institutionId")
export class BuyerMsaController {
  constructor(private readonly service:BuyerOnboardingService){}
  @Post("msa") propose(@Req() req:RailRequest,@Param("institutionId") id:string,@Body() body:Parameters<BuyerOnboardingService["proposeWorkspace"]>[2]){return this.service.proposeWorkspace(actor(req),id,body);}
  @Post("msa/verify") verify(@Req() req:RailRequest,@Param("institutionId") id:string,@Body() body:Parameters<BuyerOnboardingService["verifyWorkspace"]>[2]){return this.service.verifyWorkspace(actor(req),id,body);}
}
