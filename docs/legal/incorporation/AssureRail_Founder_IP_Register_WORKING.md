# AssureRail founder intellectual-property register

**Owner pending incorporation:** Deepak Norman, subject to the contributor and third-party rights
recorded here.

**Intended transferee:** the future AssureRail Private Limited or other final name approved for the
domestic Indian AssureRail company.

**Baseline date:** 6 September 2026

**Status:** working chain-of-title register; must be completed, evidence-backed and signed before the
post-incorporation assignment. This register records ownership; it does not prove ownership merely
by listing an asset.

## 1. Boundary rule

AssureRail IP consists of product-specific technology and materials for the end-to-end AssureRail
DA/PTC transaction infrastructure, including conventional and authorised-tokenised representations,
primary and secondary workflows, institutional participation, transaction cases, evidence rooms,
completion, lifecycle, integration, controls and related customer/operating surfaces.

AssurePool remains an AssureCLA product and AssurePlane remains an AssureCLA product. Their code and
product-specific evidence logic do not become AssureRail IP merely because AssureRail accepts them
through an adapter. AssureTransfer remains separately classified until the founder settles its
ownership and suite placement. AssureLocker has no role in AssureRail's incorporation or direct
Founder-to-AssureRail IP transfer.

## 2. Initial product-specific software inventory

The following source paths are presumptively AssureRail-specific, excluding generated artefacts,
third-party dependencies and secrets:

| Asset family | Initial source reference | Ownership evidence required | Status |
|---|---|---|---|
| AssureRail web application | `apps/assurerail/**`, excluding `.next`, build output, caches and third-party packages | Git history; contributor agreements | Inventory open |
| AssureRail API | `apps/assurerail-api/**`, excluding `dist`, runtime data, secrets and third-party packages | Git history; contributor agreements | Inventory open |
| Rail-owned database schema/migrations | `apps/assurerail-api/prisma/**` | Git history; schema provenance | Inventory open |
| Rail deployment/test utilities | `scripts/assurerail-*.sh`, `scripts/*assurerail*.mjs`, and other specifically identified Rail scripts | Git history; contributor agreements | Inventory open |
| AssureRail design specifications | AssureRail-specific files in `docs/design/**` | Git history; author provenance | Inventory open |
| AssureRail runbooks | AssureRail-specific files in `docs/runbooks/**` | Git history; author provenance | Inventory open |
| AssureRail QA/evidence specifications | AssureRail-specific files in `docs/qa/**`, excluding customer transaction evidence owned by or licensed from customers | Git history; data/evidence rights | Inventory open |
| AssureRail GTM and product content | AssureRail-specific files in `docs/gtm/**`, `docs/decks/**` and public content | Author/design/font/image provenance | Inventory open |
| AssureRail integrations in adjacent apps | e.g. `apps/api/src/co-lending/assurerail-room-proxy.client.ts` and `apps/web/src/lib/assurerail-api-url.ts` | Allocate adapter side to host product; license interface contract | Classification open |

Generated outputs, installed dependencies, customer data, secrets and cloud-provider infrastructure
are not copyright assets assigned merely because they sit below one of these paths. They require
their own transfer, licence, control or migration treatment.

## 3. Product and documentation families

The following are included when owned by the founder and sufficiently identified:

- neutral Rail contracts and transaction taxonomy;
- institution, admission, membership, mandate, appointment and entitlement models;
- provider-neutral intake, evidence, document and room models;
- transaction-case kernel, conditions, decisions, transition and replay mechanisms;
- external-action, settlement, acknowledgement and reconciliation mechanisms;
- conventional DA and PTC route implementations;
- primary and secondary venue workflow implementations;
- tokenised representation adapters and their Rail-specific connector/custody controls;
- customer workspaces, developer portal, customer operations and internal RBAC surfaces;
- operating-mode and production-readiness controls;
- AssureRail public website, sandbox, simulations, content and brand system; and
- Rail-specific tests, fixtures and evidence-pack formats.

Historic customer or trustee evidence is not owned by AssureRail merely because it is processed by
Rail. Rights in transaction inputs, signed documents, register acknowledgements and third-party
reports are governed by the relevant NDA, pilot, customer, trustee or provider agreement.

## 4. Brands and digital property

| Asset | Current registered/account holder | Intended treatment | Evidence/status |
|---|---|---|---|
| `AssureRail` word mark and logo | [●] | Assign applications/registrations and goodwill to AssureRail | Search/filing open |
| AssureRail domain names | [●] | Transfer registrant/control to AssureRail | Registrar export open |
| Social handles | [●] | Transfer where platform terms permit | Inventory open |
| App-store/developer identities | [●] | Re-register or transfer where permitted | Not yet applicable / confirm |

## 5. Contributor register

Each individual or entity that authored, designed, commissioned or materially modified AssureRail
must have a row. Git authorship is evidence of contribution, not conclusive evidence of ownership.

| Contributor | Engagement party | Employment/contract status | Work/commits | Existing IP clause | Confirmatory assignment needed | Status |
|---|---|---|---|---|---|---|
| Deepak Norman | Self/founder | Founder | [inventory ●] | Founder ownership subject to third-party rights | Post-incorporation deed | Open |
| Theo Manohar | [●] | [●] | [●] | [●] | [●] | Open |
| Other coder(s) | Founder | [contractor/agency ●] | [commit ranges ●] | [agreement reference ●] | Present direct assignment to Founder | Open |
| AI-assisted output | Applicable user/account holder | Tool terms and human contribution vary | [identify material assets ●] | Provider terms/version | Counsel review; retain prompts/provenance where material | Open |

For work created before AssureRail incorporation, the required instrument is a present written
assignment of the contributor's transferable AssureRail-specific rights directly to the Founder.
No new Rail work should be commissioned through AssureLocker. If historic work may be owned or
controlled by AssureLocker, it must be isolated, replaced or separately cured before the Founder
assigns the clean Rail baseline.

## 6. Background, shared and excluded technology

| Component | Proposed owner | AssureRail right | AssureLocker right | Final status |
|---|---|---|---|---|
| AssureLocker identity/evidence background | AssureLocker | Provider-neutral API integration only after incorporation; no code in founding baseline | Ownership retained | Selected |
| Neutral contracts developed specifically for Rail | Founder, then AssureRail | Full ownership | No pre-incorporation right | Selected |
| Generic security/audit libraries used by several products | Founder/third party after provenance review | Include only if independently owned/licensed by Rail | No automatic right | Open |
| AssurePool product logic | AssureLocker/AssureCLA | Versioned provider API or narrow independent contract only | Ownership retained | Selected |
| AssurePlane product logic | AssureLocker/AssureCLA | Provider integration only after incorporation | Ownership retained | Selected |
| AssureTransfer | To be decided | Adapter/interface treatment pending | Pending | Open |
| AssurePlane bond-trustee assurance | AssureLocker/AssureCLA; build parked | No ownership merely by adjacent use | Ownership as later confirmed | Parked |

No shared item is to be described as exclusively owned by both companies. The incorporation
baseline must not depend on AssureLocker-owned source code. Any later provider interface or licence
must identify its owner and the permitted fields of use, rights, duration, termination, continuity
and exit treatment.

## 7. Third-party and open-source register

Attach machine-generated dependency inventories and manually identify material commercial services,
APIs, models, fonts, imagery and datasets. For each item retain:

- package/asset and version;
- licence and copyright notice;
- source URL or supplier contract;
- use within the product;
- attribution/source-disclosure obligations;
- copyleft or distribution implications;
- transfer/novation/consent conditions;
- security and maintenance status; and
- replacement/exit path.

## 8. Cloud, operational and security assets

The software assignment does not automatically transfer cloud subscriptions or operational control.
Before incorporation the Founder should control the Rail-specific accounts. Before investor closing,
record and transfer or make directly controllable by AssureRail:

- Azure subscriptions, resource groups and India-region deployments;
- Entra tenants/app registrations and customer identity configurations;
- Key Vaults, encryption/signing keys and managed identities;
- DNS, certificates, WAF/Front Door and monitoring;
- source-control organisation/repository administration;
- CI/CD identities, artefact registries and release signing;
- backups, logs, audit evidence and recovery materials;
- CRM/customer support integrations relevant to AssureRail; and
- vendor, subprocessor and support contracts.

The planned Azure primary/recovery locations remain subject to final architecture confirmation.
Future India-distributed HashSphere/HTS nodes are not current assets and must not be listed as
deployed or committed infrastructure.

## 9. Data and records boundary

- Customer and transaction data remain governed by customer/provider contracts and applicable law;
  assignment of software does not transfer ownership of that data.
- AssureRail should control its participant, case, operational, audit and regulatory records after
  incorporation, subject to retention and third-party rights.
- A later operator may process only the data required by an AssureRail-approved MSA and DPA, on
  documented instructions.
- Pre-incorporation demo, replay and pilot records require a documented migration/novation basis.
- Secrets never appear in this register; record only vault/account references and authorised
  custodians.

## 10. Baseline and change control

At each signed baseline record:

- repository URL and organisation owner;
- branch and full commit hash;
- signed tag or archive digest;
- inventory generation date/tool/version;
- included/excluded path manifest and digest;
- contributor/assignment status;
- open-source report;
- reviewer and founder approval; and
- differences since the preceding baseline.

No later commit is automatically covered unless the relevant contributor agreement captures future
work or a supplemental schedule records it.

### 10.1 Standalone extraction baseline — 6 September 2026

| Field | Record |
|---|---|
| Source repository | `deepaknorman/assurelocker` |
| Source branch | `codex/assurerail-pr01-neutral-taxonomy` |
| Selected source commit | `4d349a4feb93c50e75a4f12f4081eafb2992640f` |
| Filtered source-tip equivalent | `b6ddb3cbfa736960d36392551a8d8f6e91b52136` after extraction and public-site-key redaction, before standalone corrections |
| Technical evidence | `docs/qa/AssureRail_Standalone_Repository_Separation_Evidence.md` |
| Intended private remote | `deepaknorman/assurerail` — creation and access controls open |
| Assignment status | Founder-held pending direct post-incorporation assignment; not yet transferred |
| Contributor/title status | Open; Git attribution is not treated as conclusive title evidence |
| External gates | Open; repository extraction does not close replay, VAPT, licence or production gates |

The definitive target commit, signed tag, deterministic file manifest, CycloneDX SBOM and their
digests will be appended only after the private remote exists and a clean-clone verification passes.

## 11. Transfer-readiness certificate

The founder and counsel should sign a certificate at AssureRail incorporation confirming:

1. the final baseline and excluded paths;
2. completion or disclosure of contributor assignments;
3. third-party licence treatment;
4. customer/data rights and required novations;
5. cloud/domain/brand transfer steps;
6. encumbrances or prior licences;
7. valuation, consideration, tax/FEMA and stamp treatment; and
8. delivery and acceptance by AssureRail.
