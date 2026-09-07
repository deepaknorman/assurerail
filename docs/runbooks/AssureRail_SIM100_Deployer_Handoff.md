# AssureRail SIM-100 deployer handoff

**Deployment requested:** no

**Runtime/schema/config change:** none

**Required action:** run the gate against the exact candidate commit before admitting a real
institution; do not copy the fixture database or keys into any environment.

## Candidate-build procedure

1. Confirm the checkout is the intended signed commit and the worktree is clean.
2. Run `bash scripts/assurerail-integrated-release-check.sh --full` on a build host with local
   PostgreSQL tooling.
3. Retain the command output with the build commit. The terminal line must state:
   `scenarios=200`, `parties=800`, `persisted-intakes=19`, `recovered-intake=verified`,
   `mid-saga-restart=verified`, `restore=verified` and `external-evidence=not-tested`.
4. Treat any corpus-digest change as a test-contract change requiring review.
5. Do not enable a feature flag, change `ASSURERAIL_OPERATING_MODE`, admit a participant or deploy
   merely because this gate passes.

## Expected persisted counts inside the disposable run

| Record/proof | Count |
|---|---:|
| scenario cases | 200 |
| active case-party rows | 800 |
| monitoring intake submissions | 19 |
| monitoring evidence versions | 19 |
| consumed one-use step-ups | 140 |
| reproducible case replay receipts | 1 |
| pending external instructions across restart/restore | 1 |
| mid-flight observe-only sagas across restart/restore | 1 |
| observed saga legs across restart/restore | 1 |

The lower count of accepted monitoring intakes is deliberate. Every adverse case must stop at its
assigned gate; only the 18 complete-topology, no-fault combinations may reach Rail review. The
nineteenth is the accepted-before-materialisation recovery probe and produces exactly one evidence
version under two concurrent retries.

## Rollback

There is no deployment or database migration to roll back. Reverting the code removes the gate, but
must not be used to avoid a failing candidate build. A gate failure is investigated and corrected;
external prerequisites remain open independently.
