import {useSyncExternalStore} from "react";
export const ROLES={maintenance:{label:"Maintenance / Works"},procurement:{label:"Procurement"},finance:{label:"Finance (Bursary)"},admin:{label:"Admin"},auditor:{label:"Auditor"}};
export const naira=n=>"₦"+Number(n).toLocaleString();
const empty={assets:[],subs:[],chain:[],users:[],tampered:false,offline:false};
let state=empty,me=undefined;const subs=new Set(),ping=()=>subs.forEach(f=>f());
export const getState=()=>state,subscribe=f=>(subs.add(f),()=>subs.delete(f));
export const useStore=()=>useSyncExternalStore(subscribe,getState),useMe=()=>useSyncExternalStore(subscribe,()=>me);
async function api(path,body,quiet){
 const r=await fetch("/api"+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(r.status===401&&!path.startsWith("/auth/")){me=null;state=empty;ping();throw new Error("Signed out")}
 if(!r.ok){if(!quiet)alert(j.error||"Request failed");throw new Error(j.error||"Request failed")}return j}
export async function refresh(){if(!me)return;try{const n={...await api("/state"),offline:false};if(JSON.stringify(n)!==JSON.stringify(state)){state=n;ping()}}catch(e){if(e instanceof TypeError&&!state.offline){state={...state,offline:true};ping()}}}
async function loadMe(){try{me=(await api("/auth/me")).user}catch{me=null;state={...state,offline:true}}ping();refresh()}
export async function signIn(email,password){const j=await api("/auth/signin",{email,password},true);me=j.user;state={...state,offline:false};ping();await refresh();return j.user}
export const signUp=d=>api("/auth/signup",d,true);
export async function signOut(){try{await api("/auth/signout",{},true)}catch{}me=null;state=empty;ping()}
const act=async(p,b)=>{const j=await api(p,b);await refresh();return j};
export const submit=(d,files=[])=>act("/subs",{name:d.name,location:d.location,cost:+d.cost,files});
export const decide=(id,kind,note="")=>act(`/subs/${id}/decide`,{kind,note});
export const verifyCost=id=>act(`/subs/${id}/verify`,{});
export const saveDocs=id=>act(`/subs/${id}/save`,{});
export const register=id=>act(`/subs/${id}/register`,{});
export const importDrafts=async d=>(await act("/ledger/import",{drafts:d})).ids;
export const updateAsset=(id,patch,action,detail)=>act(`/assets/${id}`,{patch,action,detail});
export const setUserStatus=(email,status)=>act(`/users/${encodeURIComponent(email)}/status`,{status});
export const record=(assetId,actor,action,detail)=>act("/record",{assetId,action,detail});
export const verifyChain=async()=>(await api("/verify")).bad;
export const tampered=()=>state.tampered;
export const tamper=on=>act("/tamper",{on});
export const scanLedger=b64=>api("/ledger/scan",{image:b64});
loadMe();setInterval(refresh,4000);
