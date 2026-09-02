import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("[AR28][PERIMETER] product layer remains mirror-only, no-dispatch and externally gated", () => {
  const product = source("src/tokenised-product/tokenised-product.ts");
  const service = source("src/tokenised-product/tokenised-product.service.ts");
  assert.match(product, /TOKEN_LEGAL_FINALITY/);
  assert.match(product, /CONTROLLED_LIVE_ACCEPTANCE/);
  assert.match(service, /operatingBoundary: "OBSERVE_ONLY"/);
  assert.match(service, /authorityMode: "MIRROR"/);
  assert.match(service, /dispatchPermitted: false/);
  assert.doesNotMatch(service, /externalInstruction\.(create|update)|egress\.|fetch\(|vault\.|mint\(|burn\(/);
});

test("[AR28][ACCESS] list and pack are institution and evidence-authority scoped", () => {
  const service = source("src/tokenised-product/tokenised-product.service.ts");
  assert.match(service, /parties: \{ some: \{ institutionId: actor\.actingInstitutionId, status: "ACTIVE"/);
  assert.match(service, /VIEW_EVIDENCE authority is required/);
  assert.match(service, /throw new NotFoundException\("tokenised route case not found"\)/);
});
