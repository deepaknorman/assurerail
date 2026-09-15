import { BadRequestException, Body, Controller, Get, Header, Injectable, Param, Post, Req } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { billingActor } from "./engagement-billing.controllers";
import { AssessmentProcessingService } from "./assessment-processing.service";
type Request = Parameters<typeof billingActor>[0];
@Controller("v1/rail/institutions/:institutionId/engagements/:engagementId/runs")
export class AssessmentProcessingController {
  constructor(private readonly service:AssessmentProcessingService) {}
  @Get() @Header("Cache-Control","no-store")
  list(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string){return this.service.list(billingActor(req,id),e);}
  @Post()
  request(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Body() body:Parameters<AssessmentProcessingService["request"]>[2]){return this.service.request(billingActor(req,id),e,body);}
  @Post("upload/:stage")
  upload(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Param("stage") stage:string){
    const actor=billingActor(req,id),encoded=req.header("x-assurerail-document-metadata");
    if(req.header("content-type")?.split(";")[0]!=="application/octet-stream"||!encoded||encoded.length>12000)throw new BadRequestException("raw document and bounded metadata required");
    let metadata;try{metadata=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))throw new Error();}catch{throw new BadRequestException("invalid upload metadata");}
    return this.service.upload(actor,e,stage,req,metadata);
  }
}
@Controller("v1/rail/internal/engagements/institutions/:institutionId/:engagementId/runs/:runId")
export class AssessmentProcessingInternalController {
  constructor(private readonly service:AssessmentProcessingService) {}
  @Get() @Header("Cache-Control","no-store")
  report(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Param("runId") r:string){return this.service.internalReport(billingActor(req),id,e,r);}
  @Post("review")
  review(@Req() req:Request,@Param("institutionId") id:string,@Param("engagementId") e:string,@Param("runId") r:string,@Body() body:Parameters<AssessmentProcessingService["review"]>[4]){return this.service.review(billingActor(req),id,e,r,body);}
}
@Injectable()
export class AssessmentProcessingWorker {
  private running=false;
  constructor(private readonly service:AssessmentProcessingService){}
  @Interval(15000)
  async tick(){if(this.running)return;this.running=true;try{await this.service.runNext();}catch{/* Durable jobs retain their state for inspection. */}finally{this.running=false;}}
}
