import {useState,useEffect} from "react";
import {Link,useParams} from "react-router-dom";
import {QRCodeSVG} from "qrcode.react";
import * as S from "./store";
import {useStore,useMe,ROLES,naira} from "./store";
const DEPTS=["Procurement","Central Stores","Transportation"],STATUS=["Active","Under maintenance","Disposed"];
const when=t=>new Date(t).toLocaleString([],{dateStyle:"medium",timeStyle:"short"});
const qr=id=>`${location.origin}/asset/${id}`;
const open=x=>x.status!=="Registered"&&x.status!=="Rejected";
const tg=s=>s==="Active"?"":s==="Disposed"?" b":" m";
const dl=(name,rows)=>{const t=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+t],{type:"text/csv"}));a.download=name;a.click();URL.revokeObjectURL(a.href)};
const b64=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(String(x.result).split(",")[1]);x.readAsDataURL(f)});
function Chain({ev,bad}){return <div className="chain">{ev.map(e=><div key={e.i} className={"ev"+(bad>=0&&e.i>=bad?" bad":"")}><b>{e.action}</b> · {e.assetId} · {e.detail}<br/><small>{ROLES[e.actor]?.label||e.actor} · {when(e.ts)}</small><br/><code>#{e.i} {e.hash.slice(0,10)} ← {e.prev.slice(0,10)}</code></div>)}</div>}
function useBad(){const s=useStore(),[b,setB]=useState(-1);useEffect(()=>{S.verifyChain().then(setB).catch(()=>{})},[s.chain]);return b}
export function Dashboard(){const s=useStore(),r=useParams().role,nm=(useMe()?.name||"").split(" ")[0],live=s.assets.filter(a=>a.status!=="Disposed");
 const N={maintenance:[["Assets",live.length],["Awaiting action",s.subs.filter(open).length],["Under maintenance",s.assets.filter(a=>a.status==="Under maintenance").length]],
 procurement:[["Open submissions",s.subs.filter(open).length],["Need a reply",s.subs.filter(x=>x.status==="Clarification").length],["Registered",s.subs.filter(x=>x.status==="Registered").length]],
 finance:[["Awaiting verification",s.subs.filter(x=>x.status==="Accepted"&&!x.fin).length],["Total asset value",naira(live.reduce((t,a)=>t+a.cost,0))]],
 admin:[["Documents to save",s.subs.filter(x=>x.status==="Accepted"&&x.fin&&!x.saved).length],["Pending approvals",s.users.filter(u=>u.status==="pending").length],["Users",s.users.length]],
 auditor:[["Recorded events",s.chain.length],["Assets",live.length]]}[r]||[];
 return <><h2>Welcome, {nm}</h2><p className="sub">{ROLES[r]?.label} dashboard</p><div className="stats">{N.map(([l,v])=><div className="card stat" key={l}><small>{l}</small><b>{v}</b></div>)}</div>
 {r==="procurement"&&<NewSub/>}{r==="auditor"?<Register/>:<Subs/>}</>}
function NewSub(){const [fs,setFs]=useState([]),[busy,setBusy]=useState(false),[f,setF]=useState({name:"",category:"",dept:"Procurement",location:"",cost:""}),k=n=>({value:f[n],onChange:e=>setF({...f,[n]:e.target.value})});
 const go=async()=>{if(!(f.name&&f.location&&+f.cost>0))return alert("Add the asset name, location and cost.");setBusy(true);try{await S.submit(f,await Promise.all(fs.map(async x=>({name:x.name,data:await b64(x)}))));setF({...f,name:"",category:"",location:"",cost:""});setFs([])}catch{}setBusy(false)};
 return <div className="card"><b>New submission</b><div className="two" style={{marginTop:8}}>
 <label className="f"><span>Asset name</span><input {...k("name")}/></label><label className="f"><span>Category</span><input placeholder="e.g. Power, ICT, Vehicle" {...k("category")}/></label>
 <label className="f"><span>Department</span><select {...k("dept")}>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></label><label className="f"><span>Location</span><input {...k("location")}/></label>
 <label className="f"><span>Cost (₦)</span><input type="number" min="1" {...k("cost")}/></label><label className="f"><span>Documents</span><input type="file" multiple onChange={e=>setFs([...e.target.files])}/></label></div>
 <button className="btn" disabled={busy} onClick={go}>{busy?"Sending…":"Send to Maintenance / Works"}</button></div>}
export function Subs({all}){const s=useStore(),r=useParams().role;
 const pend=x=>r==="finance"?x.status==="Accepted"&&!x.fin:r==="admin"?x.status==="Accepted"&&x.fin&&!x.saved:true;
 const L=s.subs.filter(x=>all||pend(x));
 return <>{all&&<h2>Submissions</h2>}{L.length?[...L].reverse().map(x=><SubCard key={x.id} x={x} r={r}/>):<p className="sub">Nothing waiting for you.</p>}</>}
function SubCard({x,r}){const [n,setN]=useState("");
 const B=(t,f,o)=><button className={"btn"+(o?" o":"")} onClick={async()=>{try{await f();setN("")}catch{}}}>{t}</button>;
 const inp=p=><input value={n} onChange={e=>setN(e.target.value)} placeholder={p}/>;let a=null;
 if(r==="maintenance"){if(x.status==="Submitted")a=<>{inp("Note to sender (needed to ask or reject)")}{B("Accept",()=>S.decide(x.id,"accept"))}{B("Ask clarification",()=>n&&S.decide(x.id,"clar",n),1)}{B("Reject",()=>n&&S.decide(x.id,"rej",n),1)}</>;
  else if(x.status==="Accepted"&&x.fin&&x.saved)a=B("Register asset",()=>S.register(x.id))}
 else if(r==="finance"&&x.status==="Accepted"&&!x.fin)a=B("Verify cost",()=>S.verifyCost(x.id));
 else if(r==="admin"&&x.status==="Accepted"&&x.fin&&!x.saved)a=B("Save documents",()=>S.saveDocs(x.id));
 else if(r==="procurement"&&x.status==="Clarification")a=<>{inp("Your reply")}{B("Send reply",()=>n&&S.decide(x.id,"reply",n))}</>;
 if(!a&&x.assetId)a=<Link className="btn o" to={`/${r}/asset/${x.assetId}`}>Open passport</Link>;
 return <div className="card"><b>{x.name}</b> <span className={"tag "+(x.status==="Accepted"||x.status==="Registered"?"":x.status==="Rejected"?"b":"m")}>{x.status}</span><br/>
 <small>{x.id} · {x.dept} · {x.category} · {naira(x.cost)} · {x.location}</small>
 {x.status==="Accepted"&&<><br/><small>Finance {x.fin?"verified":"pending"} · Documents {x.saved?"saved":"pending"}</small></>}{x.note&&<><br/><small>Note: {x.note}</small></>}
 {x.docs?.length>0&&<><br/><small>Documents: {x.docs.map(d=><a key={d} href={`/api/docs/${x.id}/${encodeURIComponent(d)}`} style={{marginRight:8}}>{d}</a>)}</small></>}<div>{a}</div></div>}
export function Register(){const s=useStore(),{role}=useParams(),[q,setQ]=useState(""),[st,setSt]=useState(""),[cat,setCat]=useState(""),cats=[...new Set(s.assets.map(a=>a.category))].sort();
 const L=s.assets.filter(a=>(!st||a.status===st)&&(!cat||a.category===cat)&&Object.values(a).join(" ").toLowerCase().includes(q.toLowerCase()));
 return <><h2>Asset register</h2><p className="sub">{L.length} of {s.assets.length} assets</p>
 <div className="filters"><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, ID, category or location" aria-label="Search"/>
 <select value={st} onChange={e=>setSt(e.target.value)} aria-label="Status"><option value="">All statuses</option>{STATUS.map(x=><option key={x}>{x}</option>)}</select>
 <select value={cat} onChange={e=>setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map(x=><option key={x}>{x}</option>)}</select></div>
 <div style={{margin:"6px 0 12px"}}><button className="btn o" onClick={()=>dl("assetdna-register.csv",[["ID","Name","Category","Location","Status","Cost","Custodian"],...L.map(a=>[a.id,a.name,a.category,a.location,a.status,a.cost,a.custodian])])}>Export CSV</button>
 {(role==="maintenance"||role==="admin")&&<Link className="btn o" to={`/${role}/labels`}>Print QR labels</Link>}</div>
 {L.map(a=><Link key={a.id} className="card" to={`/${role}/asset/${a.id}`}><b>{a.name}</b> <span className={"tag"+tg(a.status)}>{a.status}</span><br/><small>{a.id} · {a.category} · {a.location} · {naira(a.cost)}</small></Link>)}
 {!L.length&&<p className="sub">No assets match. Clear the filters or use Ledger Rescue to add records.</p>}</>}
export function Labels(){const s=useStore(),L=s.assets.filter(a=>a.status!=="Disposed");
 return <><div className="noprint"><h2>QR labels</h2><p className="sub">Print these and attach one to each asset. Scanning a label opens its passport.</p><button className="btn" onClick={()=>window.print()}>Print labels</button></div>
 <div className="labels" style={{marginTop:14}}>{L.map(a=><div className="lab" key={a.id}><QRCodeSVG value={qr(a.id)} size={110}/><br/><b>{a.id}</b><br/>{a.name}<br/><small style={{color:"#555"}}>{a.location}</small></div>)}</div></>}
export function Passport(){const {id}=useParams(),role=useMe()?.role,s=useStore(),bad=useBad(),[v,setV]=useState(""),a=s.assets.find(x=>x.id===id);
 useEffect(()=>{if(role==="auditor"&&a)S.record(id,"auditor","Audit view","Passport opened").catch(()=>{})},[id]);
 if(!a)return <p className="sub">No asset with ID {id}.</p>;
 const ev=s.chain.filter(e=>e.assetId===id),last=[...ev].reverse().find(e=>e.action!=="Audit view"),dead=a.status==="Disposed",run=f=>f().then(()=>setV("")).catch(()=>{});
 return <><h2>{a.name}</h2><p className="sub">{a.id} · <span className={"tag"+tg(a.status)}>{a.status}</span></p>
 <div className={"bar"+(bad<0?"":" bad")}>{bad<0?"Chain verified: no record has been altered.":`Tamper detected at event #${bad}. Records from that point cannot be trusted.`}</div>
 <div className="card" style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"space-between"}}><div>Category: {a.category}<br/>Location: {a.location}<br/>Cost: {naira(a.cost)}<br/>Custodian: {a.custodian}<br/>Last handled by: {last?`${ROLES[last.actor]?.label||last.actor}, ${when(last.ts)}`:"-"}</div><QRCodeSVG value={qr(a.id)} size={120}/></div>
 {role==="maintenance"&&!dead?<div className="card"><input value={v} onChange={e=>setV(e.target.value)} placeholder="New location, or maintenance note"/>
 <button className="btn o" onClick={()=>v&&run(()=>S.updateAsset(id,{location:v},"Moved","Now at "+v))}>Move asset</button>
 <button className="btn o" onClick={()=>v&&run(()=>S.updateAsset(id,{status:"Under maintenance"},"Maintenance",v))}>Log maintenance</button>
 <button className="btn o" onClick={()=>run(()=>S.updateAsset(id,{status:"Active"},"Returned to service","Marked active"))}>Return to service</button>
 <button className="btn o" onClick={()=>window.confirm("Mark this asset as disposed? This can't be undone.")&&run(()=>S.updateAsset(id,{status:"Disposed"},"Disposed",v||"Removed from the register"))}>Dispose</button></div>:<p className="sub">{dead?"This asset has been disposed and is read-only.":"Read-only for your role."}</p>}
 <h2 style={{marginTop:18}}>Chain of custody</h2><Chain ev={ev} bad={bad}/></>}
export function Audit(){const s=useStore(),bad=useBad();
 return <><h2>Audit trail</h2><p className="sub">Each event stores the hash of the one before it. Change any record and every hash after it stops matching.</p>
 <div className={"bar"+(bad<0?"":" bad")}>{bad<0?`All ${s.chain.length} events verify.`:`Chain broken at event #${bad}.`}</div>
 <button className="btn o" onClick={()=>dl("assetdna-audit-trail.csv",[["#","Time","Asset","Actor","Action","Detail","Hash"],...s.chain.map(e=>[e.i,e.ts,e.assetId,ROLES[e.actor]?.label||e.actor,e.action,e.detail,e.hash])])}>Export CSV</button>
 {s.demo&&<><button className="btn" disabled={s.tampered} onClick={()=>S.tamper(true)}>Simulate tampering</button><button className="btn o" disabled={!s.tampered} onClick={()=>S.tamper(false)}>Undo tampering</button></>}
 <div style={{marginTop:14}}><Chain ev={[...s.chain].reverse()} bad={bad}/></div></>}
function AddUser(){const [f,setF]=useState({name:"",email:"",role:"procurement",password:""}),[err,setErr]=useState(""),k=n=>({value:f[n],onChange:e=>setF({...f,[n]:e.target.value})});
 const go=async e=>{e.preventDefault();setErr("");try{await S.createUser(f);setF({name:"",email:"",role:"procurement",password:""})}catch(x){setErr(x.message)}};
 return <form className="card" onSubmit={go}><b>Add a user</b><div className="two" style={{marginTop:8}}><label className="f"><span>Full name</span><input {...k("name")}/></label><label className="f"><span>Email</span><input type="email" {...k("email")}/></label>
 <label className="f"><span>Role</span><select {...k("role")}>{Object.keys(ROLES).map(r=><option key={r} value={r}>{ROLES[r].label}</option>)}</select></label><label className="f"><span>Temporary password</span><input type="password" placeholder="8+ characters" {...k("password")}/></label></div>
 <p style={{color:"var(--bad)",margin:"0 0 6px",minHeight:20}}>{err}</p><button className="btn">Create account</button></form>}
export function Users(){const s=useStore(),me=useMe();
 const B=(u,st,t,o)=><button className={"btn"+(o?" o":"")} onClick={()=>S.setUserStatus(u.email,st).catch(()=>{})}>{t}</button>;
 const reset=u=>{const p=window.prompt(`New password for ${u.name} (8+ characters)`);if(p)S.resetPassword(u.email,p).then(()=>alert("Password updated.")).catch(()=>{})};
 return <><h2>Users and roles</h2><p className="sub">Approve sign-ups, add users and reset passwords.</p><AddUser/>
 {s.users.map(u=><div className="card" key={u.email} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><b>{u.name}</b><br/><small>{u.email} · {ROLES[u.role].label}</small></div>
 <div><span className={"tag"+(u.status==="active"?"":u.status==="pending"?" m":" b")}>{u.status==="active"?"Active":u.status==="pending"?"Pending approval":"Disabled"}</span> {u.email!==me.email&&(u.status==="active"?B(u,"disabled","Disable",1):B(u,"active",u.status==="pending"?"Approve":"Enable"))}{u.email!==me.email&&<button className="btn o" onClick={()=>reset(u)}>Reset password</button>}</div></div>)}</>}
export function Account(){const me=useMe(),[f,setF]=useState({current:"",next:"",again:""}),[msg,setMsg]=useState(""),[err,setErr]=useState(""),k=n=>({type:"password",value:f[n],onChange:e=>setF({...f,[n]:e.target.value})});
 const go=async e=>{e.preventDefault();setErr("");setMsg("");if(f.next!==f.again)return setErr("The new passwords don't match.");try{await S.changePassword(f.current,f.next);setMsg("Password changed.");setF({current:"",next:"",again:""})}catch(x){setErr(x.message)}};
 return <><h2>Account</h2><p className="sub">{me.name} · {me.email} · {ROLES[me.role].label}</p>
 <form className="card" style={{maxWidth:420}} onSubmit={go}><b>Change password</b><label className="f" style={{marginTop:8}}><span>Current password</span><input autoComplete="current-password" {...k("current")}/></label>
 <label className="f"><span>New password</span><input autoComplete="new-password" placeholder="8+ characters" {...k("next")}/></label><label className="f"><span>Repeat new password</span><input autoComplete="new-password" {...k("again")}/></label>
 <p style={{color:"var(--bad)",margin:"0 0 6px",minHeight:20}}>{err}</p>{msg&&<div className="bar">{msg}</div>}<button className="btn">Update password</button></form></>}
export function Rescue(){const [d,setD]=useState(null),[busy,setBusy]=useState(false),[ids,setIds]=useState([]),[note,setNote]=useState("");
 const scan=async f=>{setBusy(true);setIds([]);setNote("");try{const r=await S.scanLedger(f?await b64(f):"");setD(r.drafts);setNote(r.simulated?"No readable rows were found, so these are sample rows.":"")}catch{}setBusy(false)};
 const ch=(i,k,v)=>setD(d.map((x,j)=>j===i?{...x,[k]:v}:x));
 return <><h2>Ledger Rescue</h2><p className="sub">Photograph a ledger page, check the drafted records, then create passports and QR labels. The page is read on the server with OCR.</p>
 <label className="btn">{busy?"Reading page…":"Photograph or upload ledger page"}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>e.target.files[0]&&scan(e.target.files[0])}/></label><button className="btn o" disabled={busy} onClick={()=>scan(null)}>Use sample page</button>
 {note&&<p className="sub" style={{marginTop:10}}>{note}</p>}
 {d&&<div className="card" style={{marginTop:12}}><p className="sub">Rows the reader was unsure about are highlighted. Check names, locations and costs before approving.</p><div style={{overflowX:"auto"}}><table><thead><tr><th>Asset</th><th>Location</th><th>Cost (₦)</th><th>Read</th></tr></thead><tbody>{d.map((x,i)=><tr key={i} style={x.conf<.8?{background:"var(--warnb)"}:null}><td><input value={x.name} onChange={e=>ch(i,"name",e.target.value)}/></td><td><input value={x.location} onChange={e=>ch(i,"location",e.target.value)}/></td><td><input type="number" value={x.cost} onChange={e=>ch(i,"cost",e.target.value)}/></td><td>{Math.round(x.conf*100)}%</td></tr>)}</tbody></table></div>
 <button className="btn" onClick={async()=>{try{setIds(await S.importDrafts(d));setD(null)}catch{}}}>Approve {d.length} records and create passports</button></div>}
 {!!ids.length&&<><div className="bar" style={{marginTop:12}}>{ids.length} passports created. Print and attach these labels.</div><div className="labels">{ids.map(i=><div className="lab" key={i}><QRCodeSVG value={qr(i)} size={90}/><br/>{i}</div>)}</div></>}</>}
