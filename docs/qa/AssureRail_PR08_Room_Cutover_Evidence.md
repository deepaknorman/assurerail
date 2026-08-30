# AssureRail PR-08 verification evidence

**Date:** 31 August 2026
**Result:** implementation checks passed; commit not deployed; live use not tested or approved

## 1. Automated results

| Check | Result | Meaning |
|---|---:|---|
| AssureRail API typecheck | passed | PR-08 Rail controllers, services, worker and generated client compile |
| Central API typecheck | passed | compatibility client/controller and AssurePool adapter compile |
| AssureRail complete test suite | 174/174 passed, 0 skipped | existing PR-00–07 regression plus PR-08 flag, endpoint, connector and completion comparisons |
| Central focused tests | 34/34 passed, 0 skipped | transfer-room golden behaviour and on-book fail-closed/lock behaviour |
| Rail Prisma validate/generate | passed | additive Rail schema is internally valid |
| Central data Prisma validate/generate | passed | additive AssurePool receipt model is valid |
| Rail PR-08 disposable DB rehearsal | passed | 14 migrations, constraints, one-writer/idempotency, upgrade retention and backup/restore |
| AssurePool PR-08 disposable DB rehearsal | passed | 154 migrations, receipt identities and backup/restore |
| Shell syntax for both rehearsal scripts | passed | scripts parse under Bash |

The Rail database rehearsal result was:

```text
PASS models=4 one-writer=enforced idempotency=enforced history=restrictive upgrade=retained restore=1-completion
```

The AssurePool database rehearsal result was:

```text
PASS receipt=present identities=unique restore=1-receipt
```

Both rehearsals used disposable local PostgreSQL databases. No configured application database,
customer environment or deployed box was mutated.

## 2. Controls directly evidenced

- room write capability defaults to legacy and case allocation remains a separate database gate;
- room authority uses expected-version concurrency and different maker/checker identities;
- a case with Rail-native room history cannot be returned lossily to legacy;
- Rail room create/invite/accept/message/close command identities reject changed replay;
- Rail access remains case/institution/grant scoped and passive-source views retain redaction;
- compatibility actions are signed, timestamped, inbox-persisted and mapped through one governed
  external-subject identity;
- fallback to legacy occurs only on Rail's explicit authority response;
- source-completion shadow mode writes evidence without external mutation;
- source object, version, manifest, state and lock comparison is exact and identifies each mismatch;
- live on-book TODO behaviour now throws rather than returning false success;
- a confirmed lock is first conditionally claimed as `COMPLETION_PENDING`, preventing release/race;
- final acknowledgement identity/digest are idempotent and reconciliation requires a different
  authorised human; and
- compatibility route usage is exposed with bounded Prometheus labels.

## 3. Evidence deliberately not claimed

This report is not evidence of a deployed migration, a real Vault or connector exchange, live CBS
permanence, legal DA completion, customer acceptance, production capacity, recovery from a real
provider ambiguity or permission to operate. The external completion path remains structurally
gated and the current live on-book adapter is unavailable. Those are PR-09/PR-12 and external
acceptance dependencies.
