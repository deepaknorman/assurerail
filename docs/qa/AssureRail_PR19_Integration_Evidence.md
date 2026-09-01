# AssureRail PR-19 integration evidence

**Date:** 2 September 2026
**Scope:** internal software/structural evidence only

## Executed evidence

| Check | Result |
|---|---|
| API compile/typecheck | Passed |
| Full API test suite | 281 passed, 0 failed, 0 skipped |
| PR-19 conformance tests | Passed: explicit non-evidence label, exact pass, missing review and wrong-result fail |
| Runtime tests | Passed: off by default, exact shadow dependencies and non-live restriction |
| AssureRail web production build | Passed; `/workspace/developer` generated |
| Shell syntax | Passed for `scripts/assurerail-pr19-db-rehearsal.sh` |
| Disposable PostgreSQL rehearsal | 25 migrations applied; schema parity passed; restrictive history and uniqueness exercised; backup/restore returned `1|2|1|1` |

The rehearsal used structural data only. Its `PASSED_SOFTWARE` row is not real certification.

## Open external gates

- customer-selected client/Vault provisioning and rotation rehearsal;
- receiver-controlled webhook challenge and failure/replay rehearsal;
- real connector conformance and independent certification;
- schema/version acceptance by integration counterparties;
- volume, SLA and provider-outage evidence;
- customer exit-package acceptance; and
- security review of each real endpoint and credential boundary.

These remain open and block corresponding activation claims.
