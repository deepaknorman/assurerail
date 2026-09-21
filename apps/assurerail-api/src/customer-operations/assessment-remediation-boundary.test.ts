import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(__dirname,"../..");
const schema=readFileSync(resolve(root,"prisma/schema.prisma"),"utf8");
const migration=readFileSync(resolve(root,"prisma/migrations/20260917013000_assessment_remediation/migration.sql"),"utf8");
const service=readFileSync(resolve(__dirname,"assessment-processing.service.js"),"utf8");
const controller=readFileSync(resolve(__dirname,"assessment-processing.controllers.js"),"utf8");

test("remediation persistence retains tenant, source-run, evidence and reassessment lineage",()=>{
  assert.match(schema,/model AssessmentRemediationItem \{/);assert.match(schema,/@@unique\(\[sourceRunId, gapKey\]\)/);
  assert.match(migration,/ON DELETE RESTRICT/g);assert.match(migration,/AssessmentProcessingJob_reassessment/);
  assert.doesNotMatch(migration,/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("reassessment routes retain participant authority, step-up and automated Initial Assessment boundary",()=>{
  assert.match(controller,/engagements\/:engagementId\/runs/);assert.match(controller,/Get\)\("remediation"\)/);assert.match(controller,/remediation\/:itemId\/plan/);
  assert.match(service,/ENGAGEMENT_REMEDIATION_PLAN/);assert.match(service,/this\.engagements\.evidenceAuthority\(actor,\s*true\)/);
  assert.doesNotMatch(service,/this\.engagements\.participant\(actor,\s*true\)/);
  assert.match(service,/three included reassessments have been used/);assert.match(service,/included reassessment window has ended/);
  assert.match(service,/Initial Assessment is automatically released without expert review/);
  assert.match(service,/accepted scope has changed or was not confirmed; obtain a new quote/);
});
