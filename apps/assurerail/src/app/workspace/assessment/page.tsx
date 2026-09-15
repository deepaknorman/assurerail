"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vpost } from "@/lib/venue";
import "./assessment.css";
import {EngagementJourney} from "./EngagementJourney";

type Quote = { quoteDigest:string; initialAssessmentMinor:string; committedFixedMinor:string; standaloneFixedMinor:string; committedPreparationBalanceMinor:string; standalonePreparationBalanceMinor:string; standalonePremiumMinor:string; standardFileConnectionMinor:string; uniqueLoanCount:number };
const money = (minor:string) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(BigInt(minor))/100);
export default function AssessmentCommercialPage() {
  const router=useRouter();const {loading,firebaseUser,needsOnboarding,activeInstitutionId}=useAuth();
  const [count,setCount]=useState("750"),[route,setRoute]=useState<"COMMITTED"|"STANDALONE">("COMMITTED");
  const [quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [connection,setConnection]=useState(false),[api,setApi]=useState(false);
  const requestVersion=useRef(0);
  const enabled=process.env.NEXT_PUBLIC_ASSURERAIL_ENGAGEMENT_BILLING_ENABLED==="true";
  useEffect(()=>{if(!loading&&!firebaseUser)router.replace("/login");else if(!loading&&needsOnboarding)router.replace("/onboard");},[loading,firebaseUser,needsOnboarding,router]);
  useEffect(()=>{requestVersion.current++;setQuote(null);setError("");setBusy(false);},[activeInstitutionId]);
  async function calculate() {
    if(!activeInstitutionId)return;
    const version=++requestVersion.current;setBusy(true);setError("");setQuote(null);
    try {const result=await vpost<Quote>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/engagement-billing/quote-preview`,{uniqueLoanCount:Number(count)});if(version===requestVersion.current)setQuote(result);}
    catch(e){if(version===requestVersion.current)setError((e as Error).message);}
    finally{if(version===requestVersion.current)setBusy(false);}
  }
  if(loading||!firebaseUser||needsOnboarding)return <><VenueHeader/><main className="assessment-plan"><p>Loading your workspace…</p></main></>;
  if(!enabled)return <><VenueHeader/><main className="assessment-plan"><h1>Assessment planning</h1><p>This workspace capability is not enabled.</p><Link href="/workspace/operations">Customer operations</Link></main></>;
  if(!activeInstitutionId)return <><VenueHeader/><main className="assessment-plan"><h1>Select your organisation</h1><p>Choose an approved institution before planning an assessment.</p><Link href="/institutions">Your institutions</Link></main></>;
  return <><VenueHeader/><main className="assessment-plan">
    <p className="assessment-eyebrow">Your portfolio journey</p><h1>Know the scope. See the cost.</h1>
    <p>Start with an Initial Assessment. Use the findings to decide how to prepare your portfolio and whether to execute with AssureRail.</p>
    <p className="assessment-notice" role="status">Plan your fees below, then save and accept a scoped engagement. Paid stages require an independently issued invoice and verified payment. This release uses Razorpay test checkout.</p>
    <section><h2>1. Size your assessment</h2><label htmlFor="loan-count">Unique loan accounts <abbr title="Count each loan account once. Correcting documents or rerunning the same agreed portfolio does not increase the count." tabIndex={0}>ⓘ</abbr></label>
    <div className="assessment-count"><input id="loan-count" type="number" min={1} max={1000000} step={1} value={count} onChange={e=>{requestVersion.current++;setCount(e.target.value);setQuote(null);setBusy(false);}}/><button className="btn btn-primary" disabled={busy||!/^\d+$/.test(count)||Number(count)<1||Number(count)>1000000} onClick={()=>void calculate()}>{busy?"Calculating…":"Calculate stage fees"}</button></div>
    {error&&<p role="alert">{error}</p>}</section>
    <section><h2>2. Explore your preparation route</h2><p>You choose after the automated Initial Assessment. Qualified expert review and sign-off begin in Portfolio Preparation.</p>
    <fieldset className="assessment-options"><legend>Preparation route</legend>
      <label><input type="radio" name="route" checked={route==="COMMITTED"} onChange={()=>setRoute("COMMITTED")}/> Execute with AssureRail — ₹500 per loan; ₹5 lakh minimum</label>
      <label><input type="radio" name="route" checked={route==="STANDALONE"} onChange={()=>setRoute("STANDALONE")}/> Standalone preparation — ₹650 per loan; ₹6.5 lakh minimum</label>
    </fieldset>
    {quote&&<table><caption>Stage fees for {quote.uniqueLoanCount.toLocaleString("en-IN")} loan accounts, before tax</caption><thead><tr><th scope="col">Stage</th><th scope="col">Amount</th><th scope="col">Payment timing</th></tr></thead><tbody>
      <tr><th scope="row">Initial Assessment</th><td>{money(quote.initialAssessmentMinor)}</td><td>Upfront before the initial work</td></tr>
      <tr><th scope="row">Portfolio Preparation</th><td>{money(route==="COMMITTED"?quote.committedPreparationBalanceMinor:quote.standalonePreparationBalanceMinor)}</td><td>Remaining fixed balance, before preparation</td></tr>
      <tr><th scope="row">Combined fixed stages</th><td>{money(route==="COMMITTED"?quote.committedFixedMinor:quote.standaloneFixedMinor)}</td><td>Initial payment counted once</td></tr>
      <tr><th scope="row">Execution</th><td>Separate success fee</td><td>On actual purchase consideration successfully settled</td></tr>
    </tbody></table>}
    <p>The unsigned Initial Assessment includes one automated report and up to three automated same-book reassessments within 30 days. Added loans or changed scope require a new quote.</p>
    {route==="STANDALONE"?<p>If you later execute with us, the paid 30% premium{quote?` (${money(quote.standalonePremiumMinor)})`:""} can reduce the execution fee. The credit is capped at eligible fees earned; it is not a cash refund.</p>:<p>The accepted same-scope premium may become payable if you voluntarily move execution elsewhere or withdraw the mandate. A failed deal alone does not trigger a top-up.</p>}
    </section>
    <section><h2>3. Select any additional help</h2><p>Optional requests only. No service is purchased by selecting it here.</p><fieldset className="assessment-options"><legend>Buyer system onboarding</legend>
      <label><input type="checkbox" checked={connection} onChange={e=>setConnection(e.target.checked)}/> Secure point-to-point file setup — ₹50,000 per connection <abbr title="One agreed SFTP or FTPS connection, including mapping, setup, testing and buyer validation. Reusing the accepted connection does not create another setup charge." tabIndex={0}>ⓘ</abbr></label>
      <label><input type="checkbox" checked={api} onChange={e=>setApi(e.target.checked)}/> Request an API integration quote <abbr title="APIs are scoped and priced on request. They are not a prerequisite for standard file onboarding." tabIndex={0}>ⓘ</abbr></label>
    </fieldset><p>Standard exports remain within core scope. Ongoing technical support, monitoring and third-party expenses require separate accepted scope.</p></section>
    <section><h2>Execution fee explained</h2><p>The marginal schedule is 50 bps on the first ₹10 crore, 40 bps on the next ₹40 crore, 35 bps from ₹50–100 crore and 30 bps above ₹100 crore. <abbr title="One basis point (bps) is 0.01%. Each rate applies only to its slice of consideration, cumulatively across agreed programme closings." tabIndex={0}>What are bps?</abbr></p><p>The ₹5 lakh success-fee minimum remains a proposal requiring explicit acceptance. No close means no success fee. No sale, price or buyer approval is guaranteed.</p><Link className="btn" href="/workspace/operations">View contracts and billing operations</Link></section>
    <EngagementJourney key={activeInstitutionId} institutionId={activeInstitutionId} count={Number(count)} optionalServices={[...(connection?["SECURE_FILE"]:[]),...(api?["API_QUOTE"]:[])]}/>
  </main></>;
}
