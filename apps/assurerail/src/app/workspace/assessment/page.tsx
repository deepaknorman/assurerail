"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { userFacingError } from "@/lib/user-facing-error";
import { vpost } from "@/lib/venue";
import "./assessment.css";
import {EngagementJourney} from "./EngagementJourney";

export type AssessmentQuoteScope = {
  primaryPairCount:number;
  linkedPartyCount:number;
  sellerProposedConsiderationMinor:string;
  aggregateProgrammeConsiderationMinor:string;
};
type Quote = AssessmentQuoteScope & {
  quoteDigest:string;
  initialAssessmentMinor:string;
  committedFixedMinor:string;
  standaloneFixedMinor:string;
  committedPreparationBalanceMinor:string;
  standalonePreparationBalanceMinor:string;
  standalonePremiumMinor:string;
  committedLargeProgrammeSupplementMinor:string;
  standaloneLargeProgrammeSupplementMinor:string;
  standardFileConnectionMinor:string;
  includedAutomatedReassessments:number;
  reassessmentWindowDays:number;
};
const money = (minor:string) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(BigInt(minor))/100);
function croreToMinor(value:string){
  const match=value.trim().match(/^(0|[1-9][0-9]*)(?:\.([0-9]{1,4}))?$/);
  if(!match)return null;
  return (BigInt(match[1])*BigInt("1000000000")+BigInt((match[2]??"").padEnd(4,"0")||"0")*BigInt("100000")).toString();
}

export default function AssessmentCommercialPage() {
  const router=useRouter();const {loading,firebaseUser,needsOnboarding,activeInstitutionId}=useAuth();
  const [primaryCount,setPrimaryCount]=useState("750"),[linkedCount,setLinkedCount]=useState("0");
  const [sellerCrore,setSellerCrore]=useState("10"),[programmeCrore,setProgrammeCrore]=useState("10");
  const [route,setRoute]=useState<"COMMITTED"|"STANDALONE">("COMMITTED");
  const [quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [connection,setConnection]=useState(false),[api,setApi]=useState(false);
  const requestVersion=useRef(0);
  const enabled=process.env.NEXT_PUBLIC_ASSURERAIL_ENGAGEMENT_BILLING_ENABLED==="true";
  useEffect(()=>{if(!loading&&!firebaseUser)router.replace("/login");else if(!loading&&needsOnboarding)router.replace("/onboard");},[loading,firebaseUser,needsOnboarding,router]);
  useEffect(()=>{requestVersion.current++;setQuote(null);setError("");setBusy(false);},[activeInstitutionId]);
  const sellerMinor=croreToMinor(sellerCrore),programmeMinor=croreToMinor(programmeCrore);
  const validCounts=/^\d+$/.test(primaryCount)&&Number(primaryCount)>=1&&Number(primaryCount)<=1_000_000&&/^\d+$/.test(linkedCount)&&Number(linkedCount)<=1_000_000;
  const validScope=validCounts&&sellerMinor!==null&&sellerMinor!=="0"&&programmeMinor!==null&&BigInt(programmeMinor)>=BigInt(sellerMinor);
  const scope:AssessmentQuoteScope={
    primaryPairCount:Number(primaryCount),
    linkedPartyCount:Number(linkedCount),
    sellerProposedConsiderationMinor:sellerMinor??"0",
    aggregateProgrammeConsiderationMinor:programmeMinor??"0",
  };
  function changed(setter:(value:string)=>void,value:string){requestVersion.current++;setter(value);setQuote(null);setBusy(false);}
  async function calculate() {
    if(!activeInstitutionId||!validScope)return;
    const version=++requestVersion.current;setBusy(true);setError("");setQuote(null);
    try {const result=await vpost<Quote>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/engagement-billing/quote-preview`,scope);if(version===requestVersion.current)setQuote(result);}
    catch(e){if(version===requestVersion.current)setError(userFacingError(e,"We couldn’t calculate this quote. Check the book size and loan counts, then try again."));}
    finally{if(version===requestVersion.current)setBusy(false);}
  }
  if(loading||!firebaseUser||needsOnboarding)return <><VenueHeader/><main className="assessment-plan"><p>Loading your workspace…</p></main></>;
  if(!enabled)return <><VenueHeader/><main className="assessment-plan"><h1>Assessment planning</h1><p>This workspace capability is not enabled.</p><Link href="/workspace/operations">Customer operations</Link></main></>;
  if(!activeInstitutionId)return <><VenueHeader/><main className="assessment-plan"><h1>Select your organisation</h1><p>Choose an approved institution before planning an assessment.</p><Link href="/institutions">Your institutions</Link></main></>;
  return <><VenueHeader/><main className="assessment-plan">
    <p className="assessment-eyebrow">Your portfolio journey</p><h1>Know the scope. See the cost.</h1>
    <p>Start with an Initial Assessment. Use the findings to decide how to prepare your portfolio and whether to execute with AssureRail.</p>
    <p className="assessment-notice" role="status">Initial Assessment applications are open for approved NBFC portfolios. This test workspace uses shadow invoices and Razorpay test checkout. Live transfer, funds movement and settlement services remain subject to separate institutional activation.</p>
    <section><h2>1. Size your assessment</h2>
      <div className="journey-form">
        <label htmlFor="primary-count">Unique loan–borrower pairs <abbr title="Count each distinct loan and borrower or co-borrower pair once for this seller. Reassessing the same agreed pair does not add another unit." tabIndex={0}>ⓘ</abbr><input id="primary-count" type="number" min={1} max={1000000} step={1} value={primaryCount} onChange={e=>changed(setPrimaryCount,e.target.value)}/></label>
        <label htmlFor="linked-count">Separate linked parties <abbr title="Count each distinct loan and linked party pair that is not already a borrower or co-borrower unit." tabIndex={0}>ⓘ</abbr><input id="linked-count" type="number" min={0} max={1000000} step={1} value={linkedCount} onChange={e=>changed(setLinkedCount,e.target.value)}/></label>
        <label htmlFor="seller-consideration">This seller’s proposed consideration (₹ crore)<input id="seller-consideration" inputMode="decimal" value={sellerCrore} onChange={e=>changed(setSellerCrore,e.target.value)}/></label>
        <label htmlFor="programme-consideration">Aggregate accepted programme consideration (₹ crore) <abbr title="Include all accepted sellers in the programme. It cannot be lower than this seller’s proposed consideration." tabIndex={0}>ⓘ</abbr><input id="programme-consideration" inputMode="decimal" value={programmeCrore} onChange={e=>changed(setProgrammeCrore,e.target.value)}/></label>
      </div>
      {!validScope&&<p role="alert">Enter whole-number counts and valid consideration amounts; the programme amount must include at least this seller’s amount.</p>}
      <button className="btn btn-primary" disabled={busy||!validScope} onClick={()=>void calculate()}>{busy?"Calculating…":"Calculate stage fees"}</button>
      {error&&<p role="alert">{error}</p>}
    </section>
    <section><h2>2. Explore your preparation route</h2><p>You choose after the automated, unsigned Initial Assessment. Qualified expert review and section sign-off begin in Portfolio Preparation.</p>
    <fieldset className="assessment-options"><legend>Preparation route</legend>
      <label><input type="radio" name="route" checked={route==="COMMITTED"} onChange={()=>setRoute("COMMITTED")}/> Execute with AssureRail — ₹500 per loan–borrower pair, ₹250 per linked party; ₹8 lakh seller minimum</label>
      <label><input type="radio" name="route" checked={route==="STANDALONE"} onChange={()=>setRoute("STANDALONE")}/> Standalone preparation — ₹650 per loan–borrower pair, ₹325 per linked party; ₹10.4 lakh seller minimum</label>
    </fieldset>
    {quote&&<table><caption>Stage fees for {quote.primaryPairCount.toLocaleString("en-IN")} loan–borrower pairs and {quote.linkedPartyCount.toLocaleString("en-IN")} linked parties, before tax</caption><thead><tr><th scope="col">Stage</th><th scope="col">Amount</th><th scope="col">Payment timing</th></tr></thead><tbody>
      <tr><th scope="row">Initial Assessment</th><td>{money(quote.initialAssessmentMinor)}</td><td>30% of the complete standalone fixed quote, upfront</td></tr>
      <tr><th scope="row">Portfolio Preparation</th><td>{money(route==="COMMITTED"?quote.committedPreparationBalanceMinor:quote.standalonePreparationBalanceMinor)}</td><td>Remaining accepted-route balance, before preparation</td></tr>
      <tr><th scope="row">Large-programme supplement</th><td>{money(route==="COMMITTED"?quote.committedLargeProgrammeSupplementMinor:quote.standaloneLargeProgrammeSupplementMinor)}</td><td>Included above; allocated above ₹100 crore by proposed consideration</td></tr>
      <tr><th scope="row">Combined fixed stages</th><td>{money(route==="COMMITTED"?quote.committedFixedMinor:quote.standaloneFixedMinor)}</td><td>Initial payment counted once</td></tr>
      <tr><th scope="row">Execution</th><td>Separate success fee</td><td>On this seller’s actual purchase consideration settled</td></tr>
    </tbody></table>}
    <p>{quote
      ? `The unsigned Initial Assessment is automated. This quote includes ${quote.includedAutomatedReassessments} automated same-book reassessments within ${quote.reassessmentWindowDays} days.`
      : "The unsigned Initial Assessment is automated. The included reassessment allowance and window are stated in your accepted quote."} Every count or corpus variance is recalculated before the next gated release.</p>
    {route==="STANDALONE"?<p>If you later execute with us, the paid standalone premium{quote?` (${money(quote.standalonePremiumMinor)})`:""} can reduce eligible execution fees. The credit is capped at fees earned and is not a cash refund.</p>:<p>The accepted same-scope premium may become payable if you voluntarily move execution elsewhere or withdraw the mandate. A failed deal or buyer rejection alone does not trigger a top-up.</p>}
    </section>
    <section><h2>3. Select any additional help</h2><p>Optional requests only. No service is purchased by selecting it here.</p><fieldset className="assessment-options"><legend>Buyer system onboarding</legend>
      <label><input type="checkbox" checked={connection} onChange={e=>setConnection(e.target.checked)}/> Secure point-to-point file setup — ₹50,000 per connection <abbr title="One agreed SFTP or FTPS connection, including mapping, setup, testing and buyer validation. Reusing the accepted connection does not create another setup charge." tabIndex={0}>ⓘ</abbr></label>
      <label><input type="checkbox" checked={api} onChange={e=>setApi(e.target.checked)}/> Request an API integration quote <abbr title="APIs are scoped and priced on request. They are not a prerequisite for standard file onboarding." tabIndex={0}>ⓘ</abbr></label>
    </fieldset><p>Standard exports remain within core scope. Ongoing technical support, monitoring and third-party expenses require separate accepted scope.</p></section>
    <section><h2>Execution fee explained</h2><p>For each seller, the marginal schedule is 40 bps on the first ₹25 crore of cumulative actual purchase consideration settled and 30 bps above ₹25 crore, subject to a ₹5 lakh seller minimum. <abbr title="One basis point (bps) is 0.01%. Each rate applies only to its slice. Multiple closings for the same seller use that seller’s cumulative settled consideration, so slabs do not restart." tabIndex={0}>What are bps?</abbr></p><p>No successful close means no success fee. Each seller receives its own quote and mandate; no sale, price or buyer approval is guaranteed.</p><Link className="btn" href="/workspace/operations">View contracts and billing operations</Link></section>
    <EngagementJourney key={activeInstitutionId} institutionId={activeInstitutionId} quoteScope={scope} optionalServices={[...(connection?["SECURE_FILE"]:[]),...(api?["API_QUOTE"]:[])]}/>
  </main></>;
}
