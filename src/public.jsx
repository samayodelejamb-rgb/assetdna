import {useState,useEffect} from "react";
import {Link,Navigate,useLocation,useNavigate} from "react-router-dom";
import {ROLES,useMe,signIn,signUp,getConfig} from "./store";
import {Icon} from "./icons";
export const Brand=()=><Link to="/" style={{textDecoration:"none",color:"inherit"}}><div className="brand">Asset<span>DNA</span></div></Link>;
const FEATURES=[["scan","Asset passports","Every asset gets a QR label. Scan it to see what it is, where it is, its cost, its maintenance history and who last handled it."],["link","History nobody can quietly rewrite","Each action is stored with the hash of the one before it. Change one record and the chain visibly breaks."],["camera","Ledger Rescue","Photograph a page of the old ledger. The rows become draft records, staff correct them, and the labels are ready to print."],["grid","One portal for each office","Procurement, Works, Finance, Admin and Audit each get their own dashboard and only the actions their role allows."]];
const STEPS=[["Submit","Procurement sends the documents for a new asset."],["Review","Works accepts it, asks a question or rejects it."],["Verify","Finance confirms the cost."],["Save","Admin stores the verified documents."],["Register","Works adds the asset and its QR label."],["Audit","Auditors read the full trail at any time."]];
export function Home(){const me=useMe();
 return <div className="land"><div className="hero-w"><div className="in"><div className="lt"><Brand/><div>{me?<Link className="btn light" to={`/${me.role}`}>Open dashboard</Link>:<><Link className="btn ghost" to="/signin">Sign in</Link><Link className="btn light" to="/signup" style={{marginRight:0}}>Sign up</Link></>}</div></div>
 <div className="hero"><div><h1>Know what the university owns, where it is, and who touched it.</h1>
 <p className="lead">AssetDNA replaces the paper ledger with one shared register. Every asset carries a tamper-evident digital passport, and every change leaves a trail.</p>
 <Link className="btn light lg" to="/signup">Create an account</Link><Link className="btn ghost lg" to="/signin">Sign in</Link></div>
 <div className="pp"><small>AST-1001 · Active</small><h2>Diesel Generator 100kVA</h2><p className="sub">Works Yard · ₦4,200,000</p>
 <div className="chain"><div className="ev"><b>Registered</b><br/><code>#0 9f2c41ab07 ← 0000000000</code></div><div className="ev"><b>Maintenance</b> · Service started<br/><code>#5 c81d90e2f4 ← 9f2c41ab07</code></div><div className="ev"><b>Audit view</b><br/><code>#9 3be7a05d19 ← c81d90e2f4</code></div></div>
 <div className="bar" style={{margin:0}}>Chain verified</div></div></div></div></div>
 <div className="in"><section><h2>What you get</h2><div className="feat">{FEATURES.map(([i,t,d])=><div className="card" key={t}><div className="tile"><Icon n={i} size={20}/></div><b>{t}</b><p className="sub" style={{margin:"6px 0 0"}}>{d}</p></div>)}</div></section>
 <section><h2>How an asset gets on the register</h2><div className="steps">{STEPS.map(([t,d],i)=><div className="step" key={t}><small>Step {i+1}</small><br/><b>{t}</b><p className="sub" style={{margin:"4px 0 0"}}>{d}</p></div>)}</div></section></div>
 <div className="cta"><div className="in"><h2>Put your asset register on a platform built for it</h2><p>Same documents, same offices, one trusted record.</p><Link className="btn light lg" to="/signup" style={{marginRight:0}}>Create an account</Link></div></div>
 <div className="in foot">Built by Team Fly for Hack Global, with research at the Federal University of Agriculture, Abeokuta.</div></div>}
function AuthShell({children}){return <div className="auth"><div className="aside"><Brand/><div><h2>Every asset. One trusted record.</h2><p>Scan a label and see the full story of an asset, with a history that can’t be quietly changed.</p></div><small>Team Fly · Hack Global</small></div><div className="form">{children}</div></div>}
const DEMO=["maintenance","procurement","finance","admin","auditor"],offline="Can’t reach the server. Start it with: python3 server/server.py";
const Err=({t})=><p style={{color:"var(--bad)",minHeight:22,margin:"4px 0 8px"}}>{t}</p>;
export function SignIn(){const me=useMe(),nav=useNavigate(),loc=useLocation(),[e,setE]=useState(""),[p,setP]=useState(""),[err,setErr]=useState(""),[busy,setBusy]=useState(false),[demo,setDemo]=useState(false),[setup,setSetup]=useState(false);
 useEffect(()=>{getConfig().then(c=>{setDemo(!!c.demo);setSetup(!!c.setup)})},[]);
 if(me)return <Navigate to={loc.state?.from||`/${me.role}`} replace/>;
 const go=async ev=>{ev.preventDefault();setBusy(true);setErr("");try{const u=await signIn(e.trim(),p);nav(loc.state?.from||`/${u.role}`,{replace:true})}catch(x){setErr(x instanceof TypeError?offline:x.message)}setBusy(false)};
 return <AuthShell><form className="gate" onSubmit={go}><h2>Welcome back</h2><p className="sub">Sign in to your office’s portal.</p>
 {setup&&<div className="bar">No accounts exist yet. <Link to="/signup">Create the administrator account</Link></div>}
 <label className="f"><span>Email</span><input type="email" value={e} onChange={x=>setE(x.target.value)} autoComplete="username"/></label>
 <label className="f"><span>Password</span><input type="password" value={p} onChange={x=>setP(x.target.value)} autoComplete="current-password"/></label>
 <Err t={err}/><button className="btn lg" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><Link to="/signup">Create an account</Link>
 {demo&&<details style={{marginTop:18}}><summary className="sub">Demo accounts (password Demo@1234)</summary>{DEMO.map(r=><button type="button" key={r} className="btn o" onClick={()=>{setE(r+"@funaab.edu.ng");setP("Demo@1234")}}>{ROLES[r].label}</button>)}</details>}</form></AuthShell>}
export function SignUp(){const me=useMe(),[f,setF]=useState({name:"",email:"",role:"procurement",password:""}),[err,setErr]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[setup,setSetup]=useState(false);
 useEffect(()=>{getConfig().then(c=>setSetup(!!c.setup))},[]);
 if(me)return <Navigate to={`/${me.role}`} replace/>;
 const k=n=>({value:f[n],onChange:x=>setF({...f,[n]:x.target.value})});
 const go=async ev=>{ev.preventDefault();setBusy(true);setErr("");try{await signUp(f);setDone(true)}catch(x){setErr(x instanceof TypeError?offline:x.message)}setBusy(false)};
 if(done)return <AuthShell><div className="gate"><h2>Request sent</h2><p className="sub">An Admin has to approve your account before you can sign in.</p><Link className="btn lg" to="/signin">Go to sign in</Link></div></AuthShell>;
 return <AuthShell><form className="gate" onSubmit={go}><h2>{setup?"Set up AssetDNA":"Create an account"}</h2><p className="sub">{setup?"No accounts exist yet. The first account becomes the Administrator.":"Choose your office. An Admin approves new accounts."}</p>
 <label className="f"><span>Full name</span><input {...k("name")}/></label><label className="f"><span>Email</span><input type="email" {...k("email")}/></label>
 {!setup&&<label className="f"><span>Office</span><select {...k("role")}>{["procurement","maintenance","finance","auditor"].map(r=><option key={r} value={r}>{ROLES[r].label}</option>)}</select></label>}
 <label className="f"><span>Password</span><input type="password" placeholder="At least 8 characters" {...k("password")}/></label>
 <Err t={err}/><button className="btn lg" disabled={busy}>{busy?"Sending…":setup?"Create administrator account":"Request account"}</button><Link to="/signin">I already have an account</Link></form></AuthShell>}
