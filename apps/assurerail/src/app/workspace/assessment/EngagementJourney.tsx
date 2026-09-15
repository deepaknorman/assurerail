"use client";
import {useEffect,useRef,useState} from "react";
import {vget,vpost} from "@/lib/venue";
import {requestTotpStepUp} from "@/lib/institutions";
type Price={baseMinor:string;taxMinor:string;totalMinor:string};
type Engagement={id:string;status:string;quoteDigest:string;termsDigest:string;route:string|null;billingProfile:{legalName:string;billingEmail:string;address:string};quote:{initial:Price;committedPreparation:Price;standalonePreparation:Price};scope:{bookRef:string;assetFamily:string};stages:{stage:string;invoiceId:string|null;invoice:{status:string}|null}[]};
type Contract={id:string;contractRef:string;status:string;termsDigest:string;termsEvidenceRef:string};
type Run={id:string;status:string;stage:string;errorCode:string|null;result?:{analysis:{findings:{description:string;severity:string;quote:string;locator:string}[];qualification:string};qualifications:string[];extraction:{exceptions:{code:string;locator:string}[]}}};
const money=(s:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(s)/100);
export function EngagementJourney({institutionId,count,optionalServices}:{institutionId:string;count:number;optionalServices:string[]}){
  const base=`/v1/rail/institutions/${encodeURIComponent(institutionId)}`;
  const [contracts,setContracts]=useState<Contract[]>([]),[engagements,setEngagements]=useState<Engagement[]>([]),[contractId,setContractId]=useState("");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[code,setCode]=useState("");
  const [accepted,setAccepted]=useState(false),[authority,setAuthority]=useState(false),[mandate,setMandate]=useState(false),[route,setRoute]=useState("COMMITTED");
  const [form,setForm]=useState({bookRef:"",assetFamily:"VEHICLE_EV",asOfDate:"",legalName:"",billingEmail:"",address:"",stateCode:"",postalCode:"",gstRegistration:"REGISTERED",gstin:""});
  const [selected,setSelected]=useState(""),[runs,setRuns]=useState<Run[]>([]),[checkout,setCheckout]=useState<string|null>(null);
  const requestRef=useRef(crypto.randomUUID());
  const optionalServiceKey=optionalServices.join("|");
  useEffect(()=>{requestRef.current=crypto.randomUUID();},[contractId,count,optionalServiceKey]);
  const current=engagements.find(e=>e.id===selected);
  const field=(key:keyof typeof form,value:string)=>{requestRef.current=crypto.randomUUID();setForm(f=>({...f,[key]:value}));};
  async function load(){const [overview,list]=await Promise.all([vget<{contracts:Contract[]}>(`${base}/customer-operations/overview`),vget<Engagement[]>(`${base}/engagements`)]);setContracts(overview.contracts.filter(c=>c.status==="ACTIVE_SHADOW"));setEngagements(list);}
  useEffect(()=>{let alive=true;Promise.all([vget<{contracts:Contract[]}>(`${base}/customer-operations/overview`),vget<Engagement[]>(`${base}/engagements`)]).then(([overview,list])=>{if(alive){setContracts(overview.contracts.filter(c=>c.status==="ACTIVE_SHADOW"));setEngagements(list);}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[base]);
  useEffect(()=>{setRuns([]);setCheckout(null);setAccepted(false);setAuthority(false);if(!selected)return;let alive=true;vget<Run[]>(`${base}/engagements/${selected}/runs`).then(r=>{if(alive)setRuns(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[base,selected]);
  async function act(fn:()=>Promise<void>){setBusy(true);setError("");setMessage("");try{await fn();await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);setCode("");}}
  async function proof(purpose:string){return requestTotpStepUp({code,purpose,institutionId});}
  const stage=current?.route?"PREPARATION":"INITIAL";
  return <section className="engagement-journey"><h2>Start an engagement</h2><p>Save your billing details and book scope, review the complete quote, then accept with your authorised login.</p>
    <p className="assessment-notice">Test workspace: Razorpay test payments and shadow invoices. No live payment is requested here.</p>
    <fieldset disabled={busy} className="journey-form"><legend>Organisation and book</legend>
      <label>Accepted agreement<select value={contractId} onChange={e=>setContractId(e.target.value)}><option value="">Select your agreement</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contractRef}</option>)}</select></label>
      <label>Book reference<input maxLength={160} value={form.bookRef} onChange={e=>field("bookRef",e.target.value)}/></label>
      <label>Asset family<select value={form.assetFamily} onChange={e=>field("assetFamily",e.target.value)}>{[["VEHICLE_EV","EV vehicles"],["VEHICLE_OTHER","Other vehicles"],["HOUSING","Housing"],["GOLD","Gold-backed loans"],["EDUCATION","Education"],["MSME","MSME"],["OTHER","Other—scope review"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>Book as-of date<input type="date" value={form.asOfDate} onChange={e=>field("asOfDate",e.target.value)}/></label>
      <label>Billing legal name<input autoComplete="organization" maxLength={200} value={form.legalName} onChange={e=>field("legalName",e.target.value)}/></label>
      <label>Billing email<input type="email" autoComplete="email" value={form.billingEmail} onChange={e=>field("billingEmail",e.target.value)}/></label>
      <label>Billing address<input maxLength={600} autoComplete="street-address" value={form.address} onChange={e=>field("address",e.target.value)}/></label>
      <label>GST state code<input inputMode="numeric" maxLength={2} value={form.stateCode} onChange={e=>field("stateCode",e.target.value)}/></label>
      <label>Postal code<input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.postalCode} onChange={e=>field("postalCode",e.target.value)}/></label>
      <label>GST registration<select value={form.gstRegistration} onChange={e=>field("gstRegistration",e.target.value)}><option value="REGISTERED">Registered</option><option value="UNREGISTERED">Unregistered</option></select></label>
      {form.gstRegistration==="REGISTERED"&&<label>GSTIN<input maxLength={15} value={form.gstin} onChange={e=>field("gstin",e.target.value)}/></label>}
    </fieldset>
    <button className="btn btn-primary" disabled={busy||!contractId} onClick={()=>void act(async()=>{const result=await vpost<Engagement>(`${base}/engagements`,{contractId,requestRef:requestRef.current,uniqueLoanCount:count,bookRef:form.bookRef,assetFamily:form.assetFamily,asOfDate:form.asOfDate,billingProfile:form,optionalServices});setSelected(result.id);setMessage("Quote saved. Review the amounts and terms before accepting.");})}>Save scope and obtain quote</button>
    <h2>Your engagements</h2><label>Choose a book<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose an engagement</option>{engagements.map(e=><option key={e.id} value={e.id}>{e.scope.bookRef} — {e.status.replaceAll("_"," ")}</option>)}</select></label>
    {current&&<><table><caption>Accepted-scope stage pricing</caption><thead><tr><th>Stage</th><th>Fee</th><th>Tax</th><th>Total</th></tr></thead><tbody>{[["Initial Assessment",current.quote.initial],["Preparation: execute with us",current.quote.committedPreparation],["Preparation: standalone",current.quote.standalonePreparation]].map(([label,p])=>{const price=p as Price;return <tr key={label as string}><th>{label as string}</th><td>{money(price.baseMinor)}</td><td>{money(price.taxMinor)}</td><td>{money(price.totalMinor)}</td></tr>;})}</tbody></table>
      <p>Billing details saved with this quote: <strong>{current.billingProfile.legalName}</strong>, {current.billingProfile.address}; {current.billingProfile.billingEmail}. Editing the form above requires saving a new quote.</p>
      <p>Tax follows your organisation’s approved rate card. Execution and separately accepted ancillary work are additional.</p>
      <p>Agreement terms: <code>{current.termsDigest}</code>. Read the accepted agreement in <a href="/workspace/operations">Contracts and billing</a>.</p>
      <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label>
      {current.status==="OFFERED"?<><fieldset className="assessment-options"><legend>Acceptance</legend><label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> I accept the displayed quote and the referenced agreement. The automated Initial Assessment is unsigned and does not guarantee a sale or buyer approval.</label><label><input type="checkbox" checked={authority} onChange={e=>setAuthority(e.target.checked)}/> We have authority to supply and process this book’s loan records and evidence.</label></fieldset><button className="btn btn-primary" disabled={busy||!accepted||!authority||code.length!==6} onClick={()=>void act(async()=>{await vpost(`${base}/engagements/${current.id}/accept`,{quoteDigest:current.quoteDigest,dataAuthorityConfirmed:authority,termsAccepted:accepted,stepUpEvidenceId:await proof("ENGAGEMENT_ACCEPT")});setMessage("Accepted. Our billing team will prepare and independently issue the stage invoice; this is a payment control, not portfolio review.");})}>Accept Initial Assessment</button></>:<>
      <p>Current payment stage: {stage==="INITIAL"?"Initial Assessment":"Portfolio Preparation"}. {current.stages.find(s=>s.stage===stage)?.invoice?.status?.replaceAll("_"," ")??"Awaiting invoice preparation and commercial approval"}.</p>
      <div className="assessment-count"><button className="btn btn-primary" disabled={busy||current.stages.find(s=>s.stage===stage)?.invoice?.status!=="ISSUED_SHADOW"} onClick={()=>void act(async()=>{const r=await vpost<{checkoutUrl:string|null;status:string}>(`${base}/engagements/${current.id}/stages/${stage}/checkout`);setCheckout(r.checkoutUrl);setMessage(r.status.replaceAll("_"," "));})}>Open Razorpay test checkout</button><button className="btn" disabled={busy} onClick={()=>void act(async()=>{await vpost(`${base}/engagements/${current.id}/stages/${stage}/checkout/reconcile`);const r=await vget<{reason:string}>(`${base}/engagements/${current.id}/stages/${stage}/readiness`);setMessage(r.reason.replaceAll("_"," "));})}>Check payment</button></div>
      {checkout&&<a className="btn" href={checkout} target="_blank" rel="noopener noreferrer">Continue to Razorpay test payment</a>}
      <p><a href={`/workspace/assessment/${current.id}`}>Upload evidence, request a run and view released insights →</a></p>
      {!current.route&&runs.some(r=>r.stage==="INITIAL"&&r.status==="AUTO_RELEASED")&&<><h2>Choose Portfolio Preparation</h2><p>This is the first stage with qualified expert review and sign-off.</p><label>Preparation route<select value={route} onChange={e=>setRoute(e.target.value)}><option value="COMMITTED">Execute with AssureRail</option><option value="STANDALONE">Standalone preparation</option></select></label>{route==="COMMITTED"&&<label><input type="checkbox" checked={mandate} onChange={e=>setMandate(e.target.checked)}/> I accept the execution mandate and the 30% same-scope top-up only for voluntary switch or withdrawal. Failed closing alone does not trigger it.</label>}<button className="btn" disabled={busy||code.length!==6||(route==="COMMITTED"&&!mandate)} onClick={()=>void act(async()=>{await vpost(`${base}/engagements/${current.id}/preparation`,{route,quoteDigest:current.quoteDigest,mandateAndTopUpAccepted:mandate,stepUpEvidenceId:await proof("ENGAGEMENT_PREPARATION_ACCEPT")});})}>Accept preparation quote</button></>}
      </>}
    </>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
