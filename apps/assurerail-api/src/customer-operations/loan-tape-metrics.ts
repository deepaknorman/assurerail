/** The first canonical tape format is CSV with loan_id and principal_minor (INR paise).
 * Other layouts need an approved mapping; document extraction alone never establishes loan coverage.
 */
export function loanTapeMetrics(tapes:{contentType:string;segments:{text:string}[]}[],expectedCount:number){
  const ids=new Set<string>();let invalidRecords=0,duplicateRecords=0,principal=0n,mappingRequired=false;
  for(const tape of tapes){
    if(tape.contentType!=="text/csv"||!tape.segments.length){mappingRequired=true;continue;}
    const rows=tape.segments.map(s=>JSON.parse(s.text) as string[]),headers=rows[0];
    const idIndex=headers.indexOf("loan_id"),principalIndex=headers.indexOf("principal_minor");
    if(idIndex<0||principalIndex<0||new Set(headers).size!==headers.length){mappingRequired=true;continue;}
    for(const row of rows.slice(1)){
      if(row.every(v=>v===""))continue;
      const id=row[idIndex],amount=row[principalIndex];
      if(row.length!==headers.length||!id||id.trim()!==id||id.length>160||!/^[1-9][0-9]{0,29}$/.test(amount??"")){invalidRecords++;continue;}
      if(ids.has(id)){duplicateRecords++;continue;}
      ids.add(id);principal+=BigInt(amount);
    }
  }
  const status=!tapes.length?"LOAN_TAPE_MISSING":mappingRequired?"TAPE_MAPPING_REQUIRED":invalidRecords||duplicateRecords?"RECORD_EXCEPTIONS":ids.size!==expectedCount?"QUOTED_COUNT_MISMATCH":"MATCHED";
  return {status,expectedUniqueLoanCount:expectedCount,parsedUniqueLoanCount:ids.size,invalidRecords,duplicateRecords,parsedPrincipalMinor:principal.toString(),currency:"INR",currencyScale:2,coverageEstablished:status==="MATCHED"};
}
