// The issuer holds 100% of a Note at mint; DvP moves units to allow-listed buyers.
// DID follows AssureLocker's grammar: did:web:{iso3}.id.assurelocker.com:{user|entity}:{id}
// (the venue's tokenising entity — the "entity" type, per DidService.buildDid).
export const ISSUER_DID = "did:web:ind.id.assurelocker.com:entity:assurerail-tokenco";

// Demo lenders/holders (readable institution seed form did:web:{ISO3}:institution:{gstin}-{slug}) and
// the demo regulator (SEBI — the natural fit for a securities rail). Format-correct, fictional GSTINs.
export const DEMO_BUYER_DIDS = [
  "did:web:IND:institution:27AAACH1925Q1ZK-hdfc-bank",
  "did:web:IND:institution:27AAACI1195H1ZN-icici-bank",
  "did:web:IND:institution:27AAACA5309Q1ZS-axis-bank",
];
export const DEMO_REGULATOR_DID = "did:web:ind.id.assurelocker.com:regulator:sebi-001";
