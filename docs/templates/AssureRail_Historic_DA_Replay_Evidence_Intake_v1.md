# AssureRail historic conventional-DA replay evidence intake v1

**Use:** controlled intake for one completed domestic India conventional direct-assignment
transaction to satisfy the PR-09 historic replay gate

**Not for:** a live assignment, payment, title/register change, notice dispatch, matching,
tokenisation, credit decision or public capability claim

## 1. Authority and permitted use

| Field | Required response |
|---|---|
| Transaction reference / approved pseudonym | |
| Named data-owning institution | |
| Named accountable data owner | |
| Transferor owner and independent reviewer | |
| Transferee owner and independent reviewer | |
| Recordkeeper/source-system owner and reviewer | |
| Permitted replay purpose | Historic `REPLAY`, `OBSERVE_ONLY` only |
| Permission/NDA/data-use evidence reference and signer | |
| Permitted users/reviewers | |
| Approved secure transfer channel | |
| Redaction/pseudonymisation requirements | |
| Retention end date / legal hold | |
| Export restrictions | |
| Required return/destruction evidence | |

The data owner must be authorised to supply every included object or identify the separate owner and
permission basis. Do not place borrower PII, bank details, transaction bytes, credentials or
privileged advice in Git, an issue tracker, ordinary email or a synthetic fixture.

## 2. Route facts to confirm

| Dimension | Expected value or response |
|---|---|
| Transaction route | `DA` |
| Representation | `CONVENTIONAL` |
| Jurisdiction / market context | `IN` / `DOMESTIC` |
| Placement/listing | `BILATERAL` |
| Lifecycle leg | `INITIAL_TRANSFER_OR_ISSUE` |
| Transferor legal institution/reference | |
| Transferee legal institution/reference | |
| Servicer, collection account and source recordkeeper | |
| Historic execution/completion date | |
| Exact consideration | currency, integer units and scale |
| Transferred asset/pool manifest digest | |
| Applicable notice, registration and stamping route | |

If the completed transaction used materially different mechanics, stop and version the route map.
Do not coerce it into the existing route pack merely to obtain a passing replay.

## 3. Evidence manifest

Supply one row for every applicable object. `Not applicable` requires the route owner/reviewer and a
reason; it is not the default for missing evidence.

| Evidence family | Owner/provider | Source reference | Version | Digest | Signature/status | As-of/expiry | Redaction | Included |
|---|---|---|---|---|---|---|---|---:|
| Final pool/tape and manifest | | | | | | | | |
| Eligibility, diligence and exception record | | | | | | | | |
| Transferee credit/purchase decision | | | | | | | | |
| Conditions and waivers, if any | | | | | | | | |
| Executed assignment/transfer document | | | | | | | | |
| Stamping/registration evidence, if applicable | | | | | | | | |
| Exact consideration/payment evidence | | | | | | | | |
| Required notices and acknowledgements | | | | | | | | |
| Authoritative-record declaration | | | | | | | | |
| Authoritative/source record before snapshot | | | | | | | | |
| Authoritative/source record after acknowledgement | | | | | | | | |
| Historic completion decision/outcome | | | | | | | | |
| Reconciliation and known-break record | | | | | | | | |
| Servicing/lifecycle handoff | | | | | | | | |

## 4. Privacy and evidence handling

1. Prefer pseudonymised or least-disclosure material sufficient to reproduce the control outcome.
   The data owner retains the re-identification mapping wherever possible.
2. Inventory personal data, bank details, pricing, authentication material and privileged documents
   before transfer.
3. Use only the approved encrypted intake/object-store path and case-scoped access list.
4. Record malware scan/quarantine, byte or canonical digest, immutable version, classification,
   retention/legal hold and each access/export receipt.
5. The transferor and transferee validate that redaction has not removed a field needed for a fair
   comparison.

## 5. Operating separation

| Responsibility | Named person/institution | Must differ from |
|---|---|---|
| Replay-authorisation maker | | authorisation checker |
| Replay-authorisation checker | | maker |
| Transferor observation recorder | | transferor reconciler |
| Transferee observation recorder | | transferee reconciler |
| Recordkeeper observation recorder | | recordkeeper reconciler |
| Repair maker, if needed | | repair checker |
| Repair checker, if needed | | repair maker and post-repair reconciler |
| Final evidence-pack reviewer | | replay operator/maker |

Each operator needs an active institution membership, applicable mandate, route authority and
case-scoped step-up at the governed action time.

## 6. Acceptance sequence

1. Owners approve permitted use, redaction, retention and reviewers.
2. Rail verifies immutable objects, versions, signatures, digests, as-of/expiry and access.
3. Parties, mandates, function assignments and authoritative-record declaration are accepted.
4. Maker/checker allow-lists the exact historic case.
5. Rail creates the immutable observe-only saga and before snapshot.
6. Participant owners record each historical leg in order; different authorised people reconcile.
7. Every mismatch opens a completion-blocking break. Corrections are append-only and independently
   approved/reconciled.
8. Rail generates the JSON dossier and downloadable comparison workbook with matching stable digest.
9. Transferor, transferee/recordkeeper and an independent Rail reviewer accept or qualify the result.
10. Retain unresolved matters and complete the agreed return/destruction actions.

## 7. Acceptance record

| Decision | Name / institution | Result | Conditions / evidence reference | Date |
|---|---|---|---|---|
| Data-owner permission | | | | |
| Transferor review | | | | |
| Transferee review | | | | |
| Recordkeeper/source review | | | | |
| Security/privacy review | | | | |
| Product/domain acceptance | | | | |
| Final PR-09 historic replay decision | | | | |

Allowed final result: `ACCEPT`, `ACCEPT_WITH_ACTIONS` or `REJECT`. Missing evidence remains visible;
a synthetic fixture, successful API call or expected historic outcome cannot supply it.
