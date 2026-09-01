# AssureRail historic conventional-PTC replay evidence intake v1

**Use:** controlled intake for one completed domestic India conventional PTC transaction to satisfy
the PR-10 historic replay gate

**Not for:** live issuance, allotment, settlement, solicitation, trading, tokenisation or public
capability claims

## 1. Authority and permitted use

| Field | Required response |
|---|---|
| Transaction reference / approved pseudonym | |
| Named data-owning institution | |
| Named accountable data owner | |
| Trustee and named trustee reviewer | |
| Permitted replay purpose | Historic `REPLAY/SHADOW`, `OBSERVE_ONLY` only |
| Permission evidence reference and signer | |
| Permitted users/reviewers | |
| Approved secure transfer channel | |
| Redaction/pseudonymisation requirements | |
| Retention end date / legal hold | |
| Export restrictions | |
| Required destruction/return evidence | |

The data owner must have authority to provide the material. Trustee participation does not by itself
prove ownership of every source document. Do not send evidence through an unapproved channel or
place borrower PII in source control, issue trackers, test fixtures or ordinary email.

## 2. Route facts to confirm

| Dimension | Expected value or response |
|---|---|
| Transaction route | `PTC` |
| Representation | `CONVENTIONAL` |
| Jurisdiction | `IN` |
| Market context | `DOMESTIC` |
| Placement/listing | `PRIVATE_PLACEMENT` or approved route-specific correction |
| Lifecycle leg | `INITIAL_TRANSFER_OR_ISSUE` |
| Originator legal institution/reference | |
| Trustee legal institution/reference | |
| RTA/depository/register and legal record type | |
| Servicer and collection-account provider, if applicable | |
| Counsel, rating and assurance providers, if applicable | |
| Historic completion/issue/allotment date | |
| Exact consideration | Currency, integer units and scale |

Any correction to the expected route must be resolved as a route-pack/version decision before
replay. Do not force a transaction with different legal mechanics into the current pack.

## 3. Evidence manifest

Supply one row for every applicable object. Digests bind the exact bytes or canonical payload
provided; catalogue expectations and provider capability declarations are not achieved evidence.

| Role | Owner/provider | Source reference | Schema/version | Payload digest | Signature/status | As-of/expiry | Redaction | Included |
|---|---|---|---|---|---|---|---|---:|
| Programme/trust evidence | | | | | | | | |
| Trustee appointment | | | | | | | | |
| Pool-transfer evidence | | | | | | | | |
| Pool eligibility/composition | | | | | | | | |
| Executed transaction documents | | | | | | | | |
| Tranche/class definition | | | | | | | | |
| Subscription/commitment | | | | | | | | |
| Exact consideration evidence | | | | | | | | |
| Trustee transaction-control decision | | | | | | | | |
| Issue/allotment evidence | | | | | | | | |
| Authoritative-record declaration | | | | | | | | |
| Authoritative-record before snapshot | | | | | | | | |
| Authoritative-record after acknowledgement/snapshot | | | | | | | | |
| Required notice acknowledgement | | | | | | | | |
| Historic outcome/control total | | | | | | | | |
| Counsel opinion, if required | | | | | | | | |
| Rating/review, if required | | | | | | | | |
| Assurance appointment, if required | | | | | | | | |
| Assurance result, if required | | | | | | | | |
| Servicer appointment, if required | | | | | | | | |
| Collection-account evidence, if required | | | | | | | | |

## 4. Mandatory distinctions

- Trustee transaction control and the legally operative register acknowledgement must be supplied
  separately, even if one institution performs both functions.
- The trustee's decision is final for Rail transaction control; it cannot erase a depository/RTA/
  register discrepancy. Record both and open a break if they disagree.
- Assurance must identify the appointing party, provider, exact scope, qualifications, as-of time,
  expiry and signed result. It need not come from AssurePlane or use AssureLocker.
- Exact monetary values must use explicit currency, integer units and scale. Do not supply floats or
  formatted strings as the governing amount.
- Every document/payload must identify source, version, digest, signature/verification result,
  qualifications, as-of time and expiry where applicable.
- Missing, stale, ambiguous, partially verified or conflicting data is `REVIEW_REQUIRED` or a break;
  it is never silently mapped to passing or not applicable.

## 5. Privacy and evidence handling

1. Prefer pseudonymised or least-disclosure material sufficient to reproduce the transaction
   controls. Retain the data owner's mapping outside Rail where possible.
2. Identify personal data, bank details, authentication material, confidential pricing and legally
   privileged documents before transfer.
3. Use the approved encrypted intake/object-store path and access list. Do not commit evidence bytes,
   keys, tokens, credentials or personal data to Git.
4. Record malware scan/quarantine, digest, immutable version, classification, retention/legal hold
   and every access/export receipt.
5. Agree the data-owner/trustee validation of any redaction so that removed fields do not make the
   replay misleading.

## 6. Replay operators and separation

| Responsibility | Named person/institution | Must differ from |
|---|---|---|
| Case owner / replay-authorisation maker | | authorisation checker |
| Replay-authorisation checker | | maker |
| Leg observation recorder(s) | | leg reconciler |
| Repair maker, if needed | | repair checker |
| Repair checker, if needed | | repair maker and post-repair reconciler |
| Post-repair reconciler | | corrected-observation recorder and repair checker |
| Trustee outcome reviewer | | evidence provider where independence is required |
| Recordkeeper outcome reviewer | | Rail operator |
| Final evidence-pack reviewer | | replay operator/maker |

Each person must have an active institutional membership, applicable mandate, route authority and
case-scoped step-up at the time of the governed action.

## 7. Acceptance sequence

1. Data owner and trustee approve permitted use, redaction, retention and reviewers.
2. Rail intake verifies immutable objects, versions, signatures, digests, as-of/expiry and access.
3. Case parties, appointments and every material function performer are accepted.
4. Maker/checker allow-lists the exact historic case for replay.
5. Rail creates the immutable ordered saga and before snapshot.
6. Declared participant owners record each historic leg in sequence; a different authorised human
   reconciles every exact result.
7. Any mismatch opens a completion-blocking break. Repair, if justified by corrected evidence, is
   append-only and follows maker/checker plus third-person reconciliation.
8. Trustee control and authoritative record are compared independently; neither substitutes for the
   other.
9. Rail produces comparison and evidence-pack digests. Trustee, recordkeeper/data owner and an
   independent Rail reviewer sign the result.
10. Record accepted limitations, unresolved items, retention/return/destruction actions and whether
    PR-10 historic replay acceptance is granted.

## 8. Acceptance record

| Decision | Name / institution | Result | Conditions / evidence reference | Date |
|---|---|---|---|---|
| Data-owner permission | | | | |
| Trustee route/control review | | | | |
| Recordkeeper/register review | | | | |
| Rail operations review | | | | |
| Security/privacy review | | | | |
| Product/domain acceptance | | | | |
| Legal/regulatory perimeter acknowledgement | | | | |
| Final PR-10 historic replay decision | | | | |

Allowed final result: `ACCEPT`, `ACCEPT_WITH_ACTIONS` or `REJECT`. A synthetic fixture, a successful
API response or the absence of an open software error is not sufficient evidence for `ACCEPT`.
