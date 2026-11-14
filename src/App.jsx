import {Routes,Route,Navigate,NavLink,Outlet,useParams,useLocation,useNavigate} from "react-router-dom";
import {ROLES,useMe,useStore,signOut} from "./store";
import {Dashboard,Subs,Register,Audit,Users,Rescue,Passport} from "./pages";
import {Home,SignIn,SignUp,Brand} from "./public";
import {Icon} from "./icons";
const TABS={maintenance:[["","Dashboard","grid"],["submissions","Submissions","inbox"],["register","Assets","box"],["rescue","Ledger Rescue","scan"]],procurement:[["","Submissions","inbox"],["register","Assets","box"]],finance:[["","Verification","inbox"],["register","Assets","box"]],admin:[["","Documents","inbox"],["users","Users","users"],["register","Assets","box"]],auditor:[["","Assets","box"],["submissions","Submissions","inbox"],["audit","Audit trail","shield"]]};
function Guard({children}){const me=useMe(),{role}=useParams(),loc=useLocation();
 if(me===undefined)return <div className="main"><p className="sub">Loading…</p></div>;
 if(!me)return <Navigate to="/signin" state={{from:loc.pathname}} replace/>;
 if(role&&role!==me.role)return <Navigate to={`/${me.role}`} replace/>;
 return children}
function Shell({children}){const me=useMe(),st=useStore(),nav=useNavigate(),ini=me.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
 return <div className="app"><aside className="side"><Brand/>
 <nav>{TABS[me.role].map(([p,t,i])=><NavLink key={p} end to={`/${me.role}/${p}`}><Icon n={i}/>{t}</NavLink>)}</nav>
 <div className="me"><div className="av">{ini}</div><div style={{minWidth:0}}><b>{me.name}</b><small>{ROLES[me.role].label}</small></div>
 <button className="ico" title="Sign out" aria-label="Sign out" onClick={async()=>{await signOut();nav("/")}}><Icon n="out"/></button></div></aside>
 <main className="main">{st.offline&&<div className="bar bad">Can’t reach the server. Start it with: python3 server/server.py</div>}{children||<Outlet/>}</main></div>}
export default function App(){return <Routes>
 <Route path="/" element={<Home/>}/><Route path="/signin" element={<SignIn/>}/><Route path="/signup" element={<SignUp/>}/>
 <Route path="/asset/:id" element={<Guard><Shell><Passport/></Shell></Guard>}/>
 <Route path="/:role" element={<Guard><Shell/></Guard>}>
  <Route index element={<Dashboard/>}/><Route path="submissions" element={<Subs all/>}/><Route path="register" element={<Register/>}/>
  <Route path="audit" element={<Audit/>}/><Route path="users" element={<Users/>}/><Route path="rescue" element={<Rescue/>}/><Route path="asset/:id" element={<Passport/>}/></Route>
 <Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
