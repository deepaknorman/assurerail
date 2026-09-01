# AssureRail PR-18 customer-workspace evidence

**Date:** 2 September 2026
**Scope:** internal software evidence only; no customer, trustee or production acceptance

## Executed checks

| Check | Result |
|---|---|
| `npm run check:pr18 --workspace=@code/assurerail` | Passed |
| `npm run build --workspace=@code/assurerail` | Passed after allowing the existing `next/font` build to fetch Google font assets |
| Next.js route/type generation | Passed for `/workspace`, `/workspace/cases/[caseId]` and `/workspace/opportunities/[opportunityId]` |
| Static boundary assertions | Passed: five evidence states, explicit unavailable state, server-authority wording, source/as-of/expiry/qualification, break escalation, no-order-book disclaimer and legacy-console label |

The first sandboxed build attempt failed only because outbound access to Google Fonts was blocked.
The same build completed when the configured font fetch was permitted. No source change was made to
work around that environmental restriction.

## Open evidence

- accessibility testing with representative users and assistive technology;
- browser/device regression beyond the production Next.js build;
- real participant role/mandate acceptance across the complete access matrix;
- customer and trustee usability acceptance;
- controlled-live operational rehearsal; and
- external legal or regulatory approval of any venue function.

All remain open and do not become passed because the views compile.
