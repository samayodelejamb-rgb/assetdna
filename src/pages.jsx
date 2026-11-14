import {useState,useEffect} from "react";
import {Link,useParams} from "react-router-dom";
import {QRCodeSVG} from "qrcode.react";
import * as S from "./store";
import {useStore,useMe,ROLES,naira} from "./store";
const when=t=>new Date(t).toLocaleString([],{dateStyle:"medium",timeStyle:"short"});
const qr=id=>`${location.origin}/asset/${id}`;
const open=x=>x.status!=="Registered"&&x.status!=="Rejected";
function Chain({ev,bad}){return <div className="chain">{ev.map(e=><div key={e.i} className={"ev"+(bad>=0&&e.i>=bad?" bad":"")}><b>{e.action}</b> · {e.assetId} · {e.detail}<br/><small>{ROLES[e.actor]?.label||e.actor} · {when(e.ts)}</small><br/><code>#{e.i} {e.hash.slice(0,10)} ← {e.prev.slice(0,10)}</code></div>)}</div>}
function useBad(){const s=useStore(),[b,setB]=useState(-1);useEffect(()=>{S.verifyChain().then(setB)},[s.chain]);return b}
export function Dashboard(){const s=useStore(),r=useParams().role,nm=(useMe()?.name||"").split(" ")[0];
 const N={maintenance:[["Assets",s.assets.length],["Awaiting action",s.subs.filter(open).length],["Under maintenance",s.assets.filter(a=>a.status!=="Active").length]],
 procurement:[["My open submissions",s.subs.filter(x=>x.dept==="Procurement"&&open(x)).length],["Need my reply",s.subs.filter(x=>x.status==="Clarification").length]],
 finance:[["Awaiting verification",s.subs.filter(x=>x.status==="Accepted"&&!x.fin).length],["Total asset value",naira(s.assets.reduce((t,a)=>t+a.cost,0))]],
 admin:[["Documents to save",s.subs.filter(x=>x.status==="Accepted"&&x.fin&&!x.saved).length],["Pending approvals",s.users.filter(u=>u.status==="pending").length],["Users",s.users.length]],
 auditor:[["Recorded events",s.chain.length],["Assets",s.assets.length]]}[r];
 return <><h2>Welcome, {nm}</h2><p className="sub">{ROLES[r].label} dashboard</p><div className="stats">{N.map(([l,v])=><div className="card stat" key={l}><small>{l}</small><b>{v}</b></div>)}</div>
 {r==="procurement"&&<NewSub/>}{r==="auditor"?<Register/>:<Subs/>}</>}
function NewSub(){const [fs,setFs]=useState([]),[f,setF]=useState({name:"",location:"",cost:""});const k=n=>({value:f[n],onChange:e=>setF({...f,[n]:e.target.value})});
 return <div className="card"><b>New submission</b><input placeholder="Asset name" {...k("name")}/><input placeholder="Location" {...k("location")}/><input type="number" placeholder="Cost (₦)" {...k("cost")}/><small>Attach the purchase documents</small><input type="file" multiple onChange={e=>setFs([...e.target.files])}/>
 <button className="btn" onClick={async()=>{if(f.name&&f.location&&+f.cost){await S.submit(f,await Promise.all(fs.map(async x=>({name:x.name,data:await b64(x)}))));setF({name:"",location:"",cost:""});setFs([])}}}>Send to Maintenance / Works</button></div>}
export function Subs({all}){const s=useStore(),r=useParams().role;
 const pend=x=>r==="finance"?x.status==="Accepted"&&!x.fin:r==="admin"?x.status==="Accepted"&&x.fin&&!x.saved:true;
 const L=s.subs.filter(x=>(r!=="procurement"||x.dept==="Procurement")&&(all||pend(x)));
 return <>{all&&<h2>Submissions</h2>}{L.length?L.map(x=><SubCard key={x.id} x={x} r={r}/>):<p className="sub">Nothing waiting for you.</p>}</>}
function SubCard({x,r}){const [n,setN]=useState("");
 const B=(t,f,o)=><button className={"btn"+(o?" o":"")} onClick={async()=>{await f();setN("")}}>{t}</button>;
 const inp=p=><input value={n} onChange={e=>setN(e.target.value)} placeholder={p}/>;let a=null;
 if(r==="maintenance"){if(x.status==="Submitted")a=<>{inp("Note to sender (needed to ask or reject)")}{B("Accept",()=>S.decide(x.id,"accept"))}{B("Ask clarification",()=>n&&S.decide(x.id,"clar",n),1)}{B("Reject",()=>n&&S.decide(x.id,"rej",n),1)}</>;
  else if(x.status==="Accepted"&&x.fin&&x.saved)a=B("Register asset",()=>S.register(x.id))}
 else if(r==="finance"&&x.status==="Accepted"&&!x.fin)a=B("Verify cost",()=>S.verifyCost(x.id));
 else if(r==="admin"&&x.status==="Accepted"&&x.fin&&!x.saved)a=B("Save documents",()=>S.saveDocs(x.id));
 else if(r==="procurement"&&x.status==="Clarification")a=<>{inp("Your reply")}{B("Send reply",()=>n&&S.decide(x.id,"reply",n))}</>;
 if(!a&&x.assetId)a=<Link className="btn o" to={`/${r}/asset/${x.assetId}`}>Open passport</Link>;
 return <div className="card"><b>{x.name}</b> <span className={"tag "+(x.status==="Accepted"||x.status==="Registered"?"":x.status==="Rejected"?"b":"m")}>{x.status}</span><br/>
 <small>{x.id} · {x.dept} · {naira(x.cost)} · {x.location}</small>
 {x.status==="Accepted"&&<><br/><small>Finance {x.fin?"verified":"pending"} · Documents {x.saved?"saved":"pending"}</small></>}{x.note&&<><br/><small>Note: {x.note}</small></>}{x.docs?.length>0&&<><br/><small>Documents: {x.docs.map(d=><a key={d} href={`/api/docs/${x.id}/${encodeURIComponent(d)}`} target="_blank" rel="noreferrer" style={{marginRight:8}}>{d}</a>)}</small></>}<div>{a}</div></div>}
export function Register(){const s=useStore(),{role}=useParams(),[q,setQ]=useState("");
 const L=s.assets.filter(a=>Object.values(a).join(" ").toLowerCase().includes(q.toLowerCase()));
 return <><h2>Asset register</h2><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, ID, category or location"/>
 {L.map(a=><Link key={a.id} className="card" to={`/${role}/asset/${a.id}`}><b>{a.name}</b> <span className={"tag"+(a.status==="Active"?"":" m")}>{a.status}</span><br/><small>{a.id} · {a.category} · {a.location}</small></Link>)}
 {!L.length&&<p className="sub">No assets match. Clear the search or use Ledger Rescue.</p>}</>}
export function Passport(){const {id}=useParams(),role=useMe()?.role,s=useStore(),bad=useBad(),[v,setV]=useState(""),a=s.assets.find(x=>x.id===id);
 useEffect(()=>{if(role==="auditor"&&a)S.record(id,"auditor","Audit view","Passport opened")},[id]);
 if(!a)return <p className="sub">No asset with ID {id}.</p>;
 const ev=s.chain.filter(e=>e.assetId===id),last=[...ev].reverse().find(e=>e.action!=="Audit view"),m=role==="maintenance";
 return <><h2>{a.name}</h2><p className="sub">{a.id} · {a.status}</p>
 <div className={"bar"+(bad<0?"":" bad")}>{bad<0?"Chain verified: no record has been altered.":`Tamper detected at event #${bad}. Records from that point cannot be trusted.`}</div>
 <div className="card" style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"space-between"}}><div>Category: {a.category}<br/>Location: {a.location}<br/>Cost: {naira(a.cost)}<br/>Custodian: {a.custodian}<br/>Last handled by: {last?`${ROLES[last.actor]?.label||last.actor}, ${when(last.ts)}`:"-"}</div><QRCodeSVG value={qr(a.id)} size={120}/></div>
 {m?<div className="card"><input value={v} onChange={e=>setV(e.target.value)} placeholder="New location, or maintenance note"/>
 <button className="btn o" onClick={()=>v&&S.updateAsset(id,{location:v},"Moved","Now at "+v).then(()=>setV(""))}>Move asset</button>
 <button className="btn o" onClick={()=>v&&S.updateAsset(id,{status:"Under maintenance"},"Maintenance",v).then(()=>setV(""))}>Log maintenance</button>
 <button className="btn o" onClick={()=>S.updateAsset(id,{status:"Active"},"Returned to service","Marked active")}>Return to service</button></div>:<p className="sub">Read-only for your role.</p>}
 <h2 style={{marginTop:18}}>Chain of custody</h2><Chain ev={ev} bad={bad}/></>}
export function Audit(){const s=useStore(),bad=useBad();
 return <><h2>Audit trail</h2><p className="sub">Each event stores the hash of the one before it. Change any record and every hash after it stops matching.</p>
 <div className={"bar"+(bad<0?"":" bad")}>{bad<0?`All ${s.chain.length} events verify.`:`Chain broken at event #${bad}.`}</div>
 <button className="btn" disabled={S.tampered()} onClick={()=>S.tamper(true)}>Simulate tampering</button><button className="btn o" disabled={!S.tampered()} onClick={()=>S.tamper(false)}>Undo tampering</button>
 <div style={{marginTop:14}}><Chain ev={[...s.chain].reverse()} bad={bad}/></div></>}
export function Users(){const s=useStore();
 const B=(u,st,t,o)=><button className={"btn"+(o?" o":"")} onClick={()=>S.setUserStatus(u.email,st)}>{t}</button>;
 return <><h2>Users and roles</h2><p className="sub">New sign-ups wait here until you approve them.</p>
 {s.users.map(u=><div className="card" key={u.email} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><b>{u.name}</b><br/><small>{u.email} · {ROLES[u.role].label}</small></div>
 <div><span className={"tag"+(u.status==="active"?"":u.status==="pending"?" m":" b")}>{u.status==="active"?"Active":u.status==="pending"?"Pending approval":"Disabled"}</span> {u.role!=="admin"&&(u.status==="active"?B(u,"disabled","Disable",1):B(u,"active",u.status==="pending"?"Approve":"Enable"))}</div></div>)}</>}
const b64=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(String(x.result).split(",")[1]);x.readAsDataURL(f)});
export function Rescue(){const [d,setD]=useState(null),[busy,setBusy]=useState(false),[ids,setIds]=useState([]),[note,setNote]=useState("");
 const scan=async f=>{setBusy(true);setIds([]);setNote("");try{const r=await S.scanLedger(f?await b64(f):"");setD(r.drafts);setNote(r.simulated?"No readable rows were found, so these are sample rows.":"")}catch{}setBusy(false)};
 const ch=(i,k,v)=>setD(d.map((x,j)=>j===i?{...x,[k]:v}:x));
 return <><h2>Ledger Rescue</h2><p className="sub">Photograph a ledger page, check the drafted records, then create passports and QR labels. The page is read on the server with OCR.</p>
 <label className="btn">{busy?"Reading page…":"Photograph or upload ledger page"}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>e.target.files[0]&&scan(e.target.files[0])}/></label><button className="btn o" disabled={busy} onClick={()=>scan(null)}>Use sample page</button>{note&&<p className="sub" style={{marginTop:10}}>{note}</p>}
 {d&&<div className="card" style={{marginTop:12}}><p className="sub">Rows the reader was unsure about are highlighted. Check names, locations and costs before approving.</p><table><tbody>{d.map((x,i)=><tr key={i} style={x.conf<.8?{background:"var(--warnb)"}:null}><td><input value={x.name} onChange={e=>ch(i,"name",e.target.value)}/></td><td><input value={x.location} onChange={e=>ch(i,"location",e.target.value)}/></td><td><input type="number" value={x.cost} onChange={e=>ch(i,"cost",e.target.value)}/></td><td>{Math.round(x.conf*100)}%</td></tr>)}</tbody></table>
 <button className="btn" onClick={async()=>{setIds(await S.importDrafts(d));setD(null)}}>Approve {d.length} records and create passports</button></div>}
 {!!ids.length&&<><div className="bar" style={{marginTop:12}}>{ids.length} passports created. Print and attach these labels.</div><div className="labels">{ids.map(i=><div className="lab" key={i}><QRCodeSVG value={qr(i)} size={90}/><br/>{i}</div>)}</div></>}</>}
