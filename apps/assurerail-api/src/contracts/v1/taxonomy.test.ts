import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSURERAIL_TAXONOMIES,
  OPERATING_MODE_TAXONOMY,
  RECONCILIATION_STATE_TAXONOMY,
  REPRESENTATION_TAXONOMY,
  assertAllowedTaxonomyTransition,
  assertTaxonomyValue,
} from "./taxonomy";

test("[PR01][TAXONOMY] every governed value has complete metadata and valid transition targets", () => {
  const ids = new Set<string>();
  for (const taxonomy of ASSURERAIL_TAXONOMIES) {
    assert.equal(taxonomy.version, "1.0.0");
    assert.ok(!ids.has(taxonomy.taxonomyId), `${taxonomy.taxonomyId} is duplicated`);
    ids.add(taxonomy.taxonomyId);
    const codes = new Set(taxonomy.terms.map((term) => term.code));
    assert.ok(codes.size > 0, `${taxonomy.taxonomyId} is empty`);
    for (const term of taxonomy.terms) {
      assert.ok(term.displayLabel.trim(), `${taxonomy.taxonomyId}.${term.code} needs a display label`);
      assert.ok(term.definition.trim(), `${taxonomy.taxonomyId}.${term.code} needs a definition`);
      assert.ok(term.owner.trim(), `${taxonomy.taxonomyId}.${term.code} needs an owner`);
      for (const target of term.allowedTransitions) {
        assert.ok(codes.has(target), `${taxonomy.taxonomyId}.${term.code} has unknown transition ${target}`);
      }
    }
  }
});

test("[PR01][TAXONOMY] missing, unknown and runtime-only DEMO values fail closed", () => {
  assert.throws(() => assertTaxonomyValue(REPRESENTATION_TAXONOMY, undefined, "representation"), /received missing/);
  assert.throws(() => assertTaxonomyValue(REPRESENTATION_TAXONOMY, "TRADITIONAL", "representation"), /known/);
  assert.throws(() => assertTaxonomyValue(OPERATING_MODE_TAXONOMY, "DEMO", "operatingMode"), /known/);
  assert.equal(assertTaxonomyValue(OPERATING_MODE_TAXONOMY, "SHADOW", "operatingMode"), "SHADOW");
});

test("[PR01][TAXONOMY] transition metadata is enforced rather than treated as documentation only", () => {
  assert.doesNotThrow(() => assertAllowedTaxonomyTransition(RECONCILIATION_STATE_TAXONOMY, "PENDING", "MATCHED"));
  assert.doesNotThrow(() => assertAllowedTaxonomyTransition(RECONCILIATION_STATE_TAXONOMY, "MATCHED", "MATCHED"));
  assert.throws(
    () => assertAllowedTaxonomyTransition(RECONCILIATION_STATE_TAXONOMY, "MATCHED", "REPAIR_IN_PROGRESS"),
    /forbids transition/,
  );
});
