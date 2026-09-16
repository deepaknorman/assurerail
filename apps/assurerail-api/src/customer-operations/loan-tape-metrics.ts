/** Canonical CSV rows identify seller-scoped loan-party pairs and classify their billing unit.
 * The engagement supplies the seller scope, so seller_id is not repeated in each row.
 * Other layouts require an approved mapping; extraction alone never establishes coverage.
 */
export function loanTapeMetrics(
  tapes: {contentType:string;segments:{text:string}[]}[],
  expectedPrimaryPairCount: number,
  expectedLinkedPartyCount = 0,
) {
  const primaryPairs=new Set<string>(),linkedPairs=new Set<string>(),allPairs=new Set<string>();
  const loanBalances=new Map<string,bigint>();
  let invalidRecords=0,duplicateRecords=0,principal=0n,mappingRequired=false;
  for(const tape of tapes){
    if(tape.contentType!=="text/csv"||!tape.segments.length){mappingRequired=true;continue;}
    const rows=tape.segments.map(s=>JSON.parse(s.text) as string[]),headers=rows[0];
    const loanIndex=headers.indexOf("loan_id"),partyIndex=headers.indexOf("party_id"),roleIndex=headers.indexOf("party_role"),principalIndex=headers.indexOf("principal_minor");
    if(loanIndex<0||partyIndex<0||roleIndex<0||principalIndex<0||new Set(headers).size!==headers.length){mappingRequired=true;continue;}
    for(const row of rows.slice(1)){
      if(row.every(v=>v===""))continue;
      const loanId=row[loanIndex],partyId=row[partyIndex],partyRole=row[roleIndex],amount=row[principalIndex];
      if(row.length!==headers.length||!loanId||loanId.trim()!==loanId||loanId.length>160||!partyId||partyId.trim()!==partyId||partyId.length>160||!["BORROWER","CO_BORROWER","LINKED_PARTY"].includes(partyRole)||!/^[1-9][0-9]{0,29}$/.test(amount??"")){invalidRecords++;continue;}
      const balance=BigInt(amount),knownBalance=loanBalances.get(loanId),pair=`${loanId}\u0000${partyId}`;
      if(knownBalance!==undefined&&knownBalance!==balance){invalidRecords++;continue;}
      if(allPairs.has(pair)){duplicateRecords++;continue;}
      allPairs.add(pair);
      (partyRole==="LINKED_PARTY"?linkedPairs:primaryPairs).add(pair);
      if(knownBalance===undefined){loanBalances.set(loanId,balance);principal+=balance;}
    }
  }
  const countMismatch=primaryPairs.size!==expectedPrimaryPairCount||linkedPairs.size!==expectedLinkedPartyCount;
  const status=!tapes.length?"LOAN_TAPE_MISSING":mappingRequired?"TAPE_MAPPING_REQUIRED":invalidRecords||duplicateRecords?"RECORD_EXCEPTIONS":countMismatch?"QUOTED_COUNT_MISMATCH":"MATCHED";
  return {
    status,
    expectedPrimaryPairCount,
    parsedPrimaryPairCount:primaryPairs.size,
    expectedLinkedPartyCount,
    parsedLinkedPartyCount:linkedPairs.size,
    // Historical output names remain during the report-schema migration.
    expectedUniqueLoanCount:expectedPrimaryPairCount,
    parsedUniqueLoanCount:primaryPairs.size,
    parsedUniqueLoanCountActual:loanBalances.size,
    invalidRecords,
    duplicateRecords,
    parsedPrincipalMinor:principal.toString(),
    currency:"INR",
    currencyScale:2,
    coverageEstablished:status==="MATCHED",
  };
}
