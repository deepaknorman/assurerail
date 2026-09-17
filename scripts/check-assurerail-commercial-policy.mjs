#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const policy = JSON.parse(await read("config/assurerail-da-commercial-policy.json"));
const failures = [];
const required = (condition, message) => { if (!condition) failures.push(message); };
const minor = (value) => BigInt(value);
const max = (a, b) => a > b ? a : b;
const bps = (amount, rate) => (amount * BigInt(rate) + 5_000n) / 10_000n;

function executionFee(settledMinor) {
  const settled = minor(settledMinor);
  if (settled === 0n) return 0n;
  const boundary = minor(policy.execution.slabs[0].throughConsiderationMinor);
  const first = settled < boundary ? settled : boundary;
  const fee = bps(first, policy.execution.slabs[0].rateBps) + bps(settled - first, policy.execution.slabs[1].rateBps);
  return max(minor(policy.execution.minimumFeeMinor), fee);
}

function fixedFee(routeName, primaryPairs, linkedPairs, sellerCorpusMinor, programmeCorpusMinor) {
  const route = policy.fixedStages[routeName];
  const unitFee = BigInt(primaryPairs) * minor(route.primaryUnitFeeMinor) + BigInt(linkedPairs) * minor(route.linkedPartyFeeMinor);
  const base = max(minor(route.minimumFeeMinor), unitFee);
  const excess = max(0n, minor(programmeCorpusMinor) - minor(route.largeProgrammeThresholdMinor));
  const allocation = minor(programmeCorpusMinor) === 0n ? 0n : (bps(excess, route.largeProgrammeSupplementBps) * minor(sellerCorpusMinor)) / minor(programmeCorpusMinor);
  return base + allocation;
}

required(policy.phase.productionPriority === "CONVENTIONAL_DA", "Phase 1 must remain conventional DA");
required(policy.phase.deferred.includes("PTC"), "PTC must remain behind the Phase 2 gate");
required(policy.fixedStages.initialAssessment.humanReviewAtInitialAssessment !== true, "Initial Assessment cannot imply human review");
required(policy.documentAutomation.humanReviewAtInitialAssessment === false, "Initial Assessment must remain automated and unsigned");
required(policy.documentAutomation.humanExpertSignoffAtPortfolioPreparation === true, "Portfolio Preparation must require expert sign-off");
required(policy.execution.feeBasis === "SELLER_SHARE_OF_ACTUAL_PURCHASE_CONSIDERATION_SETTLED", "Execution basis drifted");
required(JSON.stringify(policy.execution.slabs) === JSON.stringify([{throughConsiderationMinor:"25000000000",rateBps:40},{throughConsiderationMinor:null,rateBps:30}]), "Execution slabs must be marginal 40/30 bps at ₹25cr");
required(policy.referral.basePercent === 8.5, "Referral base rate drifted");
required(policy.referral.basis === "COLLECTED_DISCOUNTED_ASSURERAIL_FEES_ACROSS_THREE_CORE_STAGES_ONLY", "Referral must use collected discounted fees");
required(policy.designPartnerProgramme.maximumSellerInstitutionsEver === 2 && policy.designPartnerProgramme.discountPercent === 30, "Design-partner lifetime cap or discount drifted");
required(policy.designPartnerProgramme.application === "MAKER_CHECKER_APPROVED_INVOICE_CREDIT_BEFORE_GST", "Design-partner discount must remain independently approved and pre-tax");
required(policy.designPartnerProgramme.standardRateCardRemainsUnchanged === true, "Design-partner offer cannot rewrite the standard rate card");
required(policy.cohortMinimumTreatment.cohortMinimums.fixedStageMinimumApplication === "ONCE_PER_COHORT_FOR_THE_ACCEPTED_ROUTE", "A formed analytical cohort must apply the fixed-stage floor once");
required(policy.cohortMinimumTreatment.cohortMinimums.executionMinimumApplication === "ALLOCATED_ONCE_AT_COHORT_FORMATION_ACROSS_EXPECTED_MEMBER_CLOSINGS", "A formed analytical cohort must allocate the execution floor once");
required(policy.cohortMinimumTreatment.allocation.reallocationAfterFormation === false, "A signed seller cannot inherit another cohort member's allocation");
required(policy.cohortMinimumTreatment.allocation.membershipOrScopeUnderfillRisk === "ASSURERAIL", "AssureRail must retain formed-cohort under-fill risk");
required(policy.cohortMinimumTreatment.allocation.designPartnerDiscountOrder === "AFTER_COHORT_ALLOCATION", "Design-partner credit must follow seller allocation");
required(policy.cohortMinimumTreatment.legalAndOperationalSeparation.legalCommingling === false, "Analytical cohort formation cannot imply legal commingling");
required(policy.additionalServices.routineThirdPartyServices.supplierCostBufferPercent === 25, "Third-party service buffer drifted");
required(policy.fixedStages.scopeReconciliation.customerCreditValidityMonths === 12, "Customer credit must remain valid for 12 months after formal closure");
required(policy.fixedStages.scopeReconciliation.workspaceInactivityRefreshDays === 90, "Workspace evidence refresh must remain at 90 inactive days");
required(executionFee("25000000000") === 100_000_000n, "₹25cr execution example must equal ₹10L");
required(executionFee("50000000000") === 175_000_000n, "₹50cr execution example must equal ₹17.5L");
required(executionFee("100000000000") === 325_000_000n, "₹100cr execution example must equal ₹32.5L");
required(executionFee("300000000000") === 925_000_000n, "₹300cr execution example must equal ₹92.5L");
required(fixedFee("committed", 3000, 0, "300000000000", "300000000000") === 350_000_000n, "₹300cr/3,000-pair committed fixed fee must equal ₹35L");
required(fixedFee("standalone", 3000, 0, "300000000000", "300000000000") === 455_000_000n, "₹300cr/3,000-pair standalone fixed fee must equal ₹45.5L");

const activeSurfaces = [
  "apps/assurerail/src/app/workspace/assessment/page.tsx",
  "apps/assurerail/src/lib/public-content.ts",
  "docs/gtm/AssureRail_Pilot_Pricing_And_Commercial_Schedule_DRAFT.md",
  "docs/design/NBFC_Engagement_Billing_Workflow_2026-09-15.md",
];
const forbidden = [
  { pattern: /50\s*\/\s*40\s*\/\s*35\s*\/\s*30\s*bps/i, label: "retired 50/40/35/30 schedule" },
  { pattern: /50 basis points on the first ₹10 crore/i, label: "retired first ₹10cr 50 bps schedule" },
  { pattern: /₹5 lakh minimum[^\n]*₹6\.5 lakh minimum/i, label: "retired fixed-stage minima" },
];
for (const path of activeSurfaces) {
  const body = await read(path);
  for (const rule of forbidden) if (rule.pattern.test(body)) failures.push(`${path}: ${rule.label}`);
}

const publicSurfaces = [
  "apps/assurerail/src/lib/generated/commercial-policy.ts",
  "apps/assurerail/src/lib/public-content.ts",
  "apps/assurerail/src/components/PublicSite.tsx",
  "apps/assurerail/src/lib/public-capability.ts",
];
for (const path of publicSurfaces) {
  const body = await read(path);
  if (/\b60\s*bps\b|0\.60%|60 basis points/i.test(body)) failures.push(`${path}: internal 60 bps benchmark exposed publicly`);
  if (/human[- ]reviewed initial assessment|expert[- ]reviewed initial assessment/i.test(body)) failures.push(`${path}: Initial Assessment wrongly implies human or expert review`);
}

if (failures.length) {
  console.error(failures.map((item) => `POLICY FAIL: ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Commercial policy ${policy.policyVersion}: PASS`);
}
