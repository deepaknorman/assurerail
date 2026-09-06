// The issuer holds 100% of a Note at mint; DvP moves units to allow-listed buyers.
// Fictional `.invalid` identifiers are used only in isolated demonstration mode.
export const ISSUER_DID = "did:web:demo.assurerail.invalid:entity:issuer";

// Demo lenders/holders (readable institution seed form did:web:{ISO3}:institution:{gstin}-{slug}) and
// the demo regulator (SEBI — the natural fit for a securities rail). Format-correct, fictional GSTINs.
export const DEMO_BUYER_DIDS = [
  "did:web:IND:institution:27AAACH1925Q1ZK-hdfc-bank",
  "did:web:IND:institution:27AAACI1195H1ZN-icici-bank",
  "did:web:IND:institution:27AAACA5309Q1ZS-axis-bank",
];
export const DEMO_REGULATOR_DID = "did:web:demo.assurerail.invalid:regulator:observer";

// The demo trustee. In production a SEBI-registered debenture trustee stands here (e.g. IDBI
// Trusteeship — Receivables_Pool_Tokenisation_Path.md §5.3). Until one is engaged, a placeholder
// "Demo Trustee SPE" whose SIGNED authorisation gates each receivables-pool mint — so the demo shows
// the mint as the TRUSTEE's issuance act, not AssureRail's (§7.4 step 2 / §8.5.3). This is the one
// element the loan-pool demo has no equivalent for.
export const DEMO_TRUSTEE_DID = "did:web:demo.assurerail.invalid:entity:trustee";
