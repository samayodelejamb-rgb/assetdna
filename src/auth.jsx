import {createContext,useContext,useState} from "react";
import {getState,record,ROLES} from "./store";
const C=createContext(null);export const useAuth=()=>useContext(C);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("assetdna:session"))}catch{return null}});
 const login=async(role,username,password)=>{const u=getState().users.find(x=>x.role===role&&x.username===username);
  if(!u||password!=="demo")throw new Error("Wrong username or password.");
  if(!u.active)throw new Error("This account is deactivated. Ask Admin to reactivate it.");
  const s={role,name:u.name,username};localStorage.setItem("assetdna:session",JSON.stringify(s));setUser(s);await record("SESSION",role,"Signed in",ROLES[role].label+" portal")};
 const logout=async()=>{const r=user.role;localStorage.removeItem("assetdna:session");setUser(null);await record("SESSION",r,"Signed out",ROLES[r].label+" portal")};
 return <C.Provider value={{user,login,logout}}>{children}</C.Provider>}
