# AssureRail founder Initial Assessment demo kit

This kit contains invented EV-loan data only. It is safe for the approved AssureRail shadow demo
environment and must never be presented as a customer book.

## Included journey

1. Create an engagement using `demo-manifest.json`.
2. Upload `loan-tape-v1-with-gap.csv`. It contains 12 unique seller–loan–borrower pairs and one
   repeated pair, so the assessment returns a traceable duplicate-record gap.
3. Attach `loan-tape-v2-corrected.csv` as the replacement version of the same loan-tape evidence.
4. Run a same-scope reassessment and show the gap moving from `RECORD_EXCEPTIONS` to `MATCHED`.

The principal total is identical between versions. The correction removes one duplicated record; it
does not silently change corpus economics.

## Four test identities

Copy `accounts.example.json` to an absolute path outside the repository, replace all four passwords
and base32 TOTP secrets, and set file mode `600`. Add each secret to the presenter's authenticator or
password manager before the demo. The bootstrap accepts only `@example.test` accounts and a `demo-*`
institution ID. It creates or reuses only Firebase users carrying AssureRail's synthetic-demo custom
claim, then seeds:

- seller commercial administrator;
- seller data preparer;
- independent AssureRail invoice maker; and
- independent AssureRail invoice checker.

It also seeds the synthetic admitted NBFC, scoped seller memberships and mandates, separate internal
roles, an active shadow contract, and the approved demonstration rate card. It is idempotent and
refuses a conflicting institution, email, Firebase project, role or non-demo identity.

```bash
export ASSURERAIL_OPERATING_MODE=SHADOW
export ASSURERAIL_DEMO_DATA_CLASSIFICATION=SYNTHETIC_ONLY
export ASSURERAIL_FOUNDER_DEMO_BOOTSTRAP=apply
export ASSURERAIL_FOUNDER_DEMO_ACCOUNTS_FILE=/secure/absolute/path/founder-demo-accounts.json
export ASSURERAIL_FOUNDER_DEMO_TARGET='<firebase-project-id>:demo-nbfc-ev-001'
npm --prefix apps/assurerail-api run demo:bootstrap:founder
```

`FIREBASE_ADMIN_CONFIG` and `DATABASE_URL` must come from the approved demo-box secret path. The
bootstrap never prints passwords or TOTP secrets. Use `rotateExistingDemoPasswords: true` only for
an intentional password/TOTP rotation of identities that the bootstrap previously created.

The local database rehearsal uses fake Firebase identifiers and no network:

```bash
npm --prefix apps/assurerail-api run db:rehearse:founder-demo
```
