import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { assertLegacyExternalEffectPathAllowed } from "./legacy-external-effect.guard";

test("[PR12][SAFETY] legacy external-effect paths remain usable only below live modes", () => {
  for (const operatingMode of ["DEMO", "REPLAY", "SHADOW", "SANDBOX"]) {
    assert.doesNotThrow(() => assertLegacyExternalEffectPathAllowed("legacy.test", {
      ASSURERAIL_OPERATING_MODE: operatingMode,
    }));
  }
});

test("[PR12][SAFETY] controlled-live and production reject every legacy direct external effect", () => {
  for (const operatingMode of ["CONTROLLED_LIVE", "PRODUCTION"]) {
    assert.throws(
      () => assertLegacyExternalEffectPathAllowed("legacy.test", { ASSURERAIL_OPERATING_MODE: operatingMode }),
      (error: unknown) => error instanceof ServiceUnavailableException
        && /case-scoped saga capability/.test(error.message),
    );
  }
});

test("[PR12][SAFETY] an undeclared optimised process fails closed as production", () => {
  assert.throws(
    () => assertLegacyExternalEffectPathAllowed("legacy.test", { NODE_ENV: "production" }),
    ServiceUnavailableException,
  );
});
