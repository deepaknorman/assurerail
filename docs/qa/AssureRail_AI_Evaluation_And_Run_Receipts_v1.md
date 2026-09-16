# AssureRail AI evaluation and run receipts v1

Status: offline gate and Initial Assessment receipt contract implemented on 17 September 2026.

## Boundary

This gate measures the loan-document automation used by Initial Assessment. It does not establish
legal, credit or professional assurance and does not replace the qualified expert review in
Portfolio Preparation. No customer document is committed to the repository. The v1 fixture is a
synthetic, redacted facsimile of an EV loan agreement, security schedule and repayment extract.

The harness reports:

- exact numeric fidelity, including source and locator;
- exact citation grounding against the admitted source segment;
- required page/location coverage;
- critical-gap recall and a separate false-clean count;
- expected abstention on illegible evidence;
- changed-source detection;
- resistance to instructions embedded in evidence;
- repeat-output digest agreement;
- run cost in minor currency units; and
- exception count.

All v1 accuracy and safety rates use a 10,000-basis-point gate. Cost and exception ceilings are
fixture-specific. These are an offline regression gate, not a claim of production accuracy. A
representative, permissioned and independently labelled document set is still required before any
accuracy, throughput or unit-cost claim may be made.

Run the narrow gate from the repository root:

```bash
bash scripts/assurerail-ai-evaluation-check.sh
```

## Receipt contract

Every completed automated Initial Assessment result now contains `aiRunReceipt` using schema
`assurerail.ai-run-receipt.v0`. The receipt binds:

- source evidence-version digests, exact locations and extracted character counts;
- provider, model, fallback use, prompt version and deterministic rule version;
- analysis input and output digests;
- citation digests and page/location coverage;
- abstentions and deterministic check dispositions;
- second-pass OCR corrections and any explicit overrides;
- token usage, configured cost status and exception count; and
- a canonical payload digest and receipt ID.

The receipt is persisted inside the existing assessment result. The assessment `resultDigest`
therefore binds the receipt to the released result without a new database table or migration. If no
signing key is configured, the receipt carries a canonical SHA-256 digest and declares its outer
assessment-result binding. For a signed receipt, inject both of the following through the approved
secret-management path:

- `ASSURERAIL_AI_RECEIPT_HMAC_KEY`: at least 32 characters; never log or persist it;
- `ASSURERAIL_AI_RECEIPT_HMAC_KEY_REF`: the non-secret vault/key-version reference.

Partial signing configuration fails closed. HMAC verification covers the canonical receipt payload;
the signature and key reference are emitted, while the key is not.

Checks that need labelled truth or repeat runs are expressly recorded as `NOT_MEASURED` in an
individual production receipt. The offline evaluation gate supplies those measurements. An empty
finding set is never treated as evidence that a portfolio is eligible.

## Known v1 limitations

- The committed fixture is synthetic because no permissioned customer evidence is available.
- Model prices are not embedded. Runtime estimated cost remains `NOT_CONFIGURED` until an approved,
  versioned price source exists; the offline harness can still enforce an observed run-cost ceiling.
- Reproducibility currently compares exact output digests. Semantic equivalence scoring is deferred
  until a reviewed label ontology exists.
- Critical-gap labels in the harness are fixture annotations. They are not emitted to customers and
  do not turn the automated assessment into a legal or credit opinion.
