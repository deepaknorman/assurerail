import { createHash } from "node:crypto";

export type BuyerPolicyScope = "LOAN" | "BORROWER" | "LINKED_PARTY" | "DOCUMENT" | "BOOK";
export type BuyerPolicyOutcome = "PASS" | "EXCLUDE" | "REMEDIATE" | "DISCLOSE" | "NOT_APPLICABLE";
export type BuyerPolicySeverity = Exclude<BuyerPolicyOutcome, "PASS" | "NOT_APPLICABLE">;
export type BuyerPolicyOperator = "EQ" | "NE" | "GTE" | "LTE" | "IN" | "CONTAINS_ALL" | "PRESENT" | "DATE_GTE_AS_OF";
export type PolicyValue = string | number | boolean | string[] | number[];

export type BuyerPolicyPredicate = {
  field: string;
  operator: BuyerPolicyOperator;
  value?: PolicyValue;
};

export type BuyerPolicyRow = {
  checkId: string;
  scope: BuyerPolicyScope;
  predicates: BuyerPolicyPredicate[];
  when?: BuyerPolicyPredicate[];
  severity: BuyerPolicySeverity;
  evidenceGap: BuyerPolicySeverity;
  sourceFields: string[];
  citation: {
    requirementRef: string;
    anchor: string;
    excerptDigest: string;
  };
};

export type BuyerPolicyDefinition = {
  policyId: string;
  buyerInstitutionId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string;
  approvedProfileDigest: string;
  rows: BuyerPolicyRow[];
};

export type AdmittedFact = {
  status: "PRESENT" | "UNKNOWN";
  value?: PolicyValue;
  sourceRefs: string[];
  aiRunReceiptRef?: string;
};

export type AdmittedPolicyRecord = {
  recordId: string;
  scope: BuyerPolicyScope;
  fields: Record<string, AdmittedFact>;
};

const FIELD = /^[a-z][a-z0-9_]{0,63}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const scopes = new Set<BuyerPolicyScope>(["LOAN", "BORROWER", "LINKED_PARTY", "DOCUMENT", "BOOK"]);
const operators = new Set<BuyerPolicyOperator>(["EQ", "NE", "GTE", "LTE", "IN", "CONTAINS_ALL", "PRESENT", "DATE_GTE_AS_OF"]);
const outcomes = new Set<BuyerPolicySeverity>(["EXCLUDE", "REMEDIATE", "DISCLOSE"]);

function bounded(value: unknown, label: string, maximum = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${label}: bounded value required`);
  return value.trim();
}

function validDate(value: string, label: string): string {
  if (!ISO_DATE.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new Error(`${label}: ISO date required`);
  return value;
}

function validateValue(value: unknown, label: string): asserts value is PolicyValue {
  if (["string", "boolean"].includes(typeof value)) {
    if (typeof value === "string" && (!value.length || value.length > 500)) throw new Error(`${label}: bounded string required`);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label}: finite number required`);
    return;
  }
  if (Array.isArray(value) && value.length <= 100 && value.length > 0) {
    const kind = typeof value[0];
    const invalidItem = value.some((item) =>
      typeof item !== kind
      || (typeof item === "number" && !Number.isFinite(item))
      || (typeof item === "string" && (!item.length || item.length > 500)),
    );
    if (!["string", "number"].includes(kind) || invalidItem) throw new Error(`${label}: homogeneous bounded array required`);
    if (new Set(value).size !== value.length) throw new Error(`${label}: duplicate set values are not permitted`);
    return;
  }
  throw new Error(`${label}: supported scalar or set required`);
}

function validatePredicate(predicate: BuyerPolicyPredicate, label: string): BuyerPolicyPredicate {
  if (!predicate || typeof predicate !== "object" || !FIELD.test(predicate.field) || !operators.has(predicate.operator)) throw new Error(`${label}: structured predicate required`);
  const noValue = predicate.operator === "PRESENT" || predicate.operator === "DATE_GTE_AS_OF";
  if (noValue && predicate.value !== undefined) throw new Error(`${label}: operator does not accept a literal value`);
  if (!noValue) {
    validateValue(predicate.value, `${label}.value`);
    if (["GTE", "LTE"].includes(predicate.operator) && typeof predicate.value !== "number") throw new Error(`${label}: numeric comparison value required`);
    if (["IN", "CONTAINS_ALL"].includes(predicate.operator) && !Array.isArray(predicate.value)) throw new Error(`${label}: set value required`);
  }
  return JSON.parse(JSON.stringify(predicate)) as BuyerPolicyPredicate;
}

function normalizeDefinition(input: BuyerPolicyDefinition): BuyerPolicyDefinition {
  const policyId = bounded(input.policyId, "policyId");
  const buyerInstitutionId = bounded(input.buyerInstitutionId, "buyerInstitutionId");
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new Error("positive policy version required");
  const effectiveFrom = validDate(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = validDate(input.effectiveTo, "effectiveTo");
  if (effectiveFrom > effectiveTo || Date.parse(`${effectiveTo}T00:00:00.000Z`) - Date.parse(`${effectiveFrom}T00:00:00.000Z`) > 366 * 86_400_000) throw new Error("policy validity must be ordered and no longer than 366 days");
  if (!SHA256.test(input.approvedProfileDigest)) throw new Error("approved buyer-profile digest required");
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 500) throw new Error("one to 500 buyer-policy rows required");
  const rows = input.rows.map((row, index) => {
    const checkId = bounded(row.checkId, `rows[${index}].checkId`, 100);
    if (!scopes.has(row.scope) || !outcomes.has(row.severity) || !outcomes.has(row.evidenceGap)) throw new Error(`${checkId}: valid scope and outcomes required`);
    if (!Array.isArray(row.predicates) || !row.predicates.length || row.predicates.length > 20) throw new Error(`${checkId}: one to 20 predicates required`);
    const predicates = row.predicates.map((predicate, predicateIndex) => validatePredicate(predicate, `${checkId}.predicates[${predicateIndex}]`));
    const when = row.when?.map((predicate, predicateIndex) => validatePredicate(predicate, `${checkId}.when[${predicateIndex}]`));
    if (when && (!when.length || when.length > 10)) throw new Error(`${checkId}: one to 10 when predicates required`);
    const usedFields = new Set([...predicates, ...(when ?? [])].map((predicate) => predicate.field));
    if (!Array.isArray(row.sourceFields) || !row.sourceFields.length || row.sourceFields.some((field) => !FIELD.test(field)) || new Set(row.sourceFields).size !== row.sourceFields.length || [...usedFields].some((field) => !row.sourceFields.includes(field))) throw new Error(`${checkId}: sourceFields must cover every predicate field`);
    const citation = {
      requirementRef: bounded(row.citation?.requirementRef, `${checkId}.citation.requirementRef`),
      anchor: bounded(row.citation?.anchor, `${checkId}.citation.anchor`),
      excerptDigest: bounded(row.citation?.excerptDigest, `${checkId}.citation.excerptDigest`),
    };
    if (!SHA256.test(citation.excerptDigest)) throw new Error(`${checkId}: citation excerpt digest required`);
    return { checkId, scope: row.scope, predicates, ...(when ? { when } : {}), severity: row.severity, evidenceGap: row.evidenceGap, sourceFields: [...row.sourceFields].sort(), citation };
  }).sort((left, right) => left.checkId.localeCompare(right.checkId));
  if (new Set(rows.map((row) => row.checkId)).size !== rows.length) throw new Error("buyer-policy check IDs must be unique");
  return { policyId, buyerInstitutionId, version: input.version, effectiveFrom, effectiveTo, approvedProfileDigest: input.approvedProfileDigest, rows };
}

const hash = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export function compileBuyerPolicy(input: BuyerPolicyDefinition) {
  const definition = normalizeDefinition(input);
  return {
    schema: "assurerail-buyer-policy/1" as const,
    ...definition,
    policyDigest: hash({ schema: "assurerail-buyer-policy/1", ...definition }),
    signedByBuyerRequired: true as const,
    buyerDecisionReplaced: false as const,
  };
}

function compare(predicate: BuyerPolicyPredicate, value: PolicyValue, asOf: string): boolean {
  switch (predicate.operator) {
    case "PRESENT": return true;
    case "DATE_GTE_AS_OF": return typeof value === "string" && ISO_DATE.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value && value >= asOf;
    case "EQ": return JSON.stringify(value) === JSON.stringify(predicate.value);
    case "NE": return JSON.stringify(value) !== JSON.stringify(predicate.value);
    case "GTE": return typeof value === "number" && value >= (predicate.value as number);
    case "LTE": return typeof value === "number" && value <= (predicate.value as number);
    case "IN": return !Array.isArray(value) && (predicate.value as PolicyValue[]).includes(value as never);
    case "CONTAINS_ALL": return Array.isArray(value) && (predicate.value as PolicyValue[]).every((item) => (value as PolicyValue[]).includes(item));
  }
}

function evaluatePredicates(predicates: BuyerPolicyPredicate[], record: AdmittedPolicyRecord, asOf: string) {
  const facts = predicates.map((predicate) => ({ predicate, fact: record.fields[predicate.field] }));
  const missing = facts.filter(({ fact }) => !fact || fact.status === "UNKNOWN" || fact.value === undefined);
  if (missing.length) return { state: "UNKNOWN" as const, missingFields: missing.map(({ predicate }) => predicate.field) };
  return { state: facts.every(({ predicate, fact }) => compare(predicate, fact.value!, asOf)) ? "TRUE" as const : "FALSE" as const, missingFields: [] };
}

function validateRecords(records: AdmittedPolicyRecord[]): AdmittedPolicyRecord[] {
  if (!Array.isArray(records) || !records.length || records.length > 1_000_000) throw new Error("one to 1000000 admitted records required");
  if (new Set(records.map((record) => `${record.scope}:${record.recordId}`)).size !== records.length) throw new Error("admitted record IDs must be unique within scope");
  return records.map((record) => {
    const recordId = bounded(record.recordId, "recordId");
    if (!scopes.has(record.scope) || !record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) throw new Error(`${recordId}: valid scope and fields required`);
    const fields = Object.fromEntries(Object.entries(record.fields).map(([field, fact]) => {
      if (!FIELD.test(field) || !fact || !["PRESENT", "UNKNOWN"].includes(fact.status) || !Array.isArray(fact.sourceRefs) || fact.sourceRefs.some((ref) => typeof ref !== "string" || !ref.trim() || ref.length > 300) || new Set(fact.sourceRefs).size !== fact.sourceRefs.length) throw new Error(`${recordId}.${field}: valid admitted fact required`);
      if (fact.status === "PRESENT") validateValue(fact.value, `${recordId}.${field}.value`);
      if (fact.status === "UNKNOWN" && fact.value !== undefined) throw new Error(`${recordId}.${field}: unknown fact cannot carry a value`);
      if (fact.aiRunReceiptRef !== undefined) bounded(fact.aiRunReceiptRef, `${recordId}.${field}.aiRunReceiptRef`);
      return [field, { ...fact, sourceRefs: [...fact.sourceRefs].sort() }];
    }));
    return { recordId, scope: record.scope, fields };
  });
}

export function evaluateCompiledBuyerPolicy(compiled: ReturnType<typeof compileBuyerPolicy>, rawRecords: AdmittedPolicyRecord[], asOf: string) {
  const evaluationDate = validDate(asOf, "asOf");
  if (evaluationDate < compiled.effectiveFrom || evaluationDate > compiled.effectiveTo) throw new Error("buyer policy is not effective on the evaluation date");
  const records = validateRecords(rawRecords);
  const results = records.map((record) => {
    const checks = compiled.rows.filter((row) => row.scope === record.scope).map((row) => {
      const when = row.when ? evaluatePredicates(row.when, record, evaluationDate) : { state: "TRUE" as const, missingFields: [] as string[] };
      const evaluation = when.state === "TRUE" ? evaluatePredicates(row.predicates, record, evaluationDate) : null;
      const outcome: BuyerPolicyOutcome = when.state === "FALSE" ? "NOT_APPLICABLE" : when.state === "UNKNOWN" ? row.evidenceGap : evaluation?.state === "UNKNOWN" ? row.evidenceGap : evaluation?.state === "TRUE" ? "PASS" : row.severity;
      const consumedFields = [...new Set([...row.predicates, ...(row.when ?? [])].map((predicate) => predicate.field))].sort();
      return {
        checkId: row.checkId,
        outcome,
        citation: row.citation,
        missingFields: [...new Set([...(when.missingFields ?? []), ...(evaluation?.missingFields ?? [])])].sort(),
        sourceRefs: [...new Set(consumedFields.flatMap((field) => record.fields[field]?.sourceRefs ?? []))].sort(),
        aiRunReceiptRefs: [...new Set(consumedFields.map((field) => record.fields[field]?.aiRunReceiptRef).filter((value): value is string => Boolean(value)))].sort(),
      };
    });
    const outcome: BuyerPolicyOutcome = !checks.length || checks.every((check) => check.outcome === "NOT_APPLICABLE") ? "NOT_APPLICABLE"
      : checks.some((check) => check.outcome === "EXCLUDE") ? "EXCLUDE"
      : checks.some((check) => check.outcome === "REMEDIATE") ? "REMEDIATE"
        : checks.some((check) => check.outcome === "DISCLOSE") ? "DISCLOSE" : "PASS";
    return { recordId: record.recordId, scope: record.scope, outcome, checks };
  });
  const counts = Object.fromEntries(["PASS", "EXCLUDE", "REMEDIATE", "DISCLOSE", "NOT_APPLICABLE"].map((outcome) => [outcome, results.filter((record) => record.outcome === outcome).length])) as Record<BuyerPolicyOutcome, number>;
  const evaluatedRecordCount = results.length - counts.NOT_APPLICABLE;
  const canonical = { schema: "assurerail-buyer-policy-evaluation/1", policyDigest: compiled.policyDigest, asOf: evaluationDate, results };
  return {
    ...canonical,
    evaluationDigest: hash(canonical),
    counts,
    buyerReadyFraction: { numerator: counts.PASS, denominator: evaluatedRecordCount },
    qualification: "BUYER_POLICY_CHECKLIST_NOT_BUYER_DECISION" as const,
  };
}
