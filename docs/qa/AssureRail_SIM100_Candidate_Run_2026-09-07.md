# SIM-100 candidate-build run — 7 Sep 2026 (local build host, LC_ALL=C)

**Candidate commit:** `c9e3ed71b5153507092d4313e2bd7a055ad07b8d` (= deployed to the demo box this date)
**Procedure:** `bash scripts/assurerail-integrated-release-check.sh --full` per
`docs/runbooks/AssureRail_SIM100_Deployer_Handoff.md`. Full log retained by the deployer.
**Note:** counts exceed the handoff's stated minima because the PTC-preparation scenario
family (8 scenarios, +1 intake) had been registered into the matrix after the handoff was
written — 208 total scenarios, 20 intakes.

```
[SIM-100] VERIFY {"cases":200,"parties":800,"evidenceVersions":20,"intakes":20,"monitoringIntakes":19,"ptcPreparationIntakes":1,"pendingInstructions":1,"consumedStepUps":140,"replayReceipts":1,"executingSagas":1,"observedSagaLegs":1}
[SIM-100-DB] PASS scenarios=208 parties=800 persisted-intakes=20 ptc-prep=8/8 recovered-intake=verified mid-saga-restart=verified restore=verified external-evidence=not-tested
[ARAIL-INTEGRATED] PASS mode=--full external-evidence=not-tested external-gates=remain-open deployment=not-performed
```
