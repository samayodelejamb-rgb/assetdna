#!/usr/bin/env python3
"""AssetDNA API. Run: python3 server/server.py  (standard library only; Ledger Rescue OCR uses the `tesseract` binary if installed)."""
import base64,hashlib,hmac,json,secrets,mimetypes,os,re,sqlite3,subprocess,tempfile,threading
from datetime import datetime,timezone
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote
HERE=os.path.dirname(os.path.abspath(__file__));DB=os.environ.get("ASSETDNA_DB",os.path.join(HERE,"assetdna.db"))
UP=os.path.join(HERE,"uploads");DIST=os.path.normpath(os.path.join(HERE,"..","dist"));Z="0"*64;LOCK=threading.RLock()
ROLES={"maintenance":"Amina Yusuf","procurement":"Tunde Bello","finance":"Grace Obi","admin":"System Admin","auditor":"Chief Auditor"}
con=sqlite3.connect(DB,check_same_thread=False);con.row_factory=sqlite3.Row
if "email" not in [c["name"] for c in con.execute("pragma table_info(users)")]:con.execute("drop table if exists users")
con.executescript("""create table if not exists assets(id text primary key,name text,category text,location text,status text,cost integer,custodian text);
create table if not exists subs(id text primary key,dept text,name text,location text,cost integer,status text,note text,fin integer,saved integer,assetId text,docs text);
create table if not exists chain(i integer primary key,ts text,assetId text,actor text,action text,detail text,prev text,hash text);
create table if not exists users(email text primary key,name text,role text,pw text,status text);
create table if not exists sessions(token text primary key,email text);
create table if not exists meta(k text primary key,v text);""")
def q(sql,*a):return [dict(r) for r in con.execute(sql,a)]
def one(sql,*a):r=q(sql,*a);return r[0] if r else None
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def body(e):return json.dumps([e["i"],e["ts"],e["assetId"],e["actor"],e["action"],e["detail"],e["prev"]],separators=(",",":"),ensure_ascii=False)
def log(asset,actor,action,detail):
 last=one("select i,hash from chain order by i desc limit 1")
 e={"i":last["i"]+1 if last else 0,"ts":datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z"),"assetId":asset,"actor":actor,"action":action,"detail":detail,"prev":last["hash"] if last else Z}
 e["hash"]=sha(body(e));con.execute("insert into chain values(:i,:ts,:assetId,:actor,:action,:detail,:prev,:hash)",e)
def verify():
 p=Z
 for e in q("select * from chain order by i"):
  if e["prev"]!=p or e["hash"]!=sha(body(e)):return e["i"]
  p=e["hash"]
 return -1
def tamper(on):
 o=one("select v from meta where k='orig'")
 if on and not o and one("select 1 from chain where i=2"):
  con.execute("insert into meta values('orig',(select detail from chain where i=2))");con.execute("update chain set detail='Cost revised to ₦1' where i=2")
 elif not on and o:con.execute("update chain set detail=? where i=2",(o["v"],));con.execute("delete from meta where k='orig'")
def state():
 subs=q("select * from subs")
 for s in subs:s.update(fin=bool(s["fin"]),saved=bool(s["saved"]),docs=json.loads(s["docs"] or "[]"))
 return {"assets":q("select * from assets order by id"),"subs":subs,"chain":q("select * from chain order by i"),"users":q("select email,name,role,status from users order by rowid"),"tampered":bool(one("select 1 from meta where k='orig'"))}
def seed():
 if one("select 1 from assets"):return
 A=[("Diesel Generator 100kVA","Power","Works Yard","Active",4200000,"Maintenance / Works"),("Dell Latitude Laptop","ICT","ICT Resource Center","Active",650000,"ICT Resource Center"),("Toyota Hilux","Vehicle","Transport Unit","Under maintenance",28500000,"Transportation"),("Lab Microscope","Laboratory","Biology Lab 2","Active",1300000,"Biology Dept")]
 for i,a in enumerate(A):con.execute("insert into assets values(?,?,?,?,?,?,?)",(f"AST-{1001+i}",*a));log(f"AST-{1001+i}","maintenance","Registered","Accepted from "+a[5])
 for s in [("SUB-101","Diesel Generator 150kVA","Works Yard",5100000,"Submitted"),("SUB-102","Industrial Printer","Central Stores",920000,"Accepted")]:
  con.execute("insert into subs values(?,?,?,?,?,?,?,?,?,?,?)",(s[0],"Procurement",s[1],s[2],s[3],s[4],"",0,0,None,"[]"));log(s[0],"procurement","Submitted",s[1]+" with documents")
 log("SUB-102","maintenance","Accepted","Submission accepted by Works")
def hp(pw,salt=None):
 salt=salt or secrets.token_hex(8);return salt+"$"+hashlib.pbkdf2_hmac("sha256",pw.encode(),salt.encode(),120000).hex()
def seed_users():
 if not one("select 1 from users"):
  for r,n in ROLES.items():con.execute("insert into users values(?,?,?,?,?)",(f"{r}@funaab.edu.ng",n,r,hp("Demo@1234"),"active"))
class Err(Exception):
 def __init__(s,c,m):s.c,s.m=c,m
def need(role,want):
 if role!=want:raise Err(403,f"Only the {want} portal can do this.")
def ok(c):
 if not c:raise Err(409,"That action is not available for this submission.")
def sub(id):
 s=one("select * from subs where id=?",id)
 if not s:raise Err(404,"Submission not found.")
 return s
def add_asset(name,cat,loc,cost,cust,detail):
 aid="AST-%d"%(1001+one("select count(*) c from assets")["c"])
 con.execute("insert into assets values(?,?,?,?,?,?,?)",(aid,name,cat or "General",loc or "Unassigned","Active",int(cost),cust));log(aid,"maintenance","Registered",detail);return aid
SAMPLE=[("Office Desk (Executive)","Furniture","Registry",85000,.97),("Photocopier Canon IR","Office equipment","Bursary",1150000,.62),("Water Pump 5HP","Plant","Farm Annex",430000,.91),("Projector Epson","Audio-visual","Lecture Hall B",380000,.55),("Standby Inverter 5kVA","Power","Senate Building",1800000,.88)]
def scan(b64):
 L={}
 try:
  with tempfile.NamedTemporaryFile(delete=False) as f:f.write(base64.b64decode(b64));p=f.name
  tsv=subprocess.run(["tesseract",p,"stdout","--psm","6","tsv"],capture_output=True,text=True,timeout=90).stdout
  for r in tsv.splitlines()[1:]:
   c=r.split("\t")
   if len(c)==12 and c[0]=="5" and c[11].strip():L.setdefault(tuple(c[2:5]),[]).append((c[11].strip(),float(c[10])))
 except Exception:pass
 finally:
  try:os.unlink(p)
  except Exception:pass
 d=[]
 for w in L.values():
  m=re.match(r"^(.*?)[\s|.:\-]*[₦N]?\s*(\d{1,3}(?:,\d{3})+|\d{4,})\s*$"," ".join(x[0] for x in w));n=re.sub(r"[|_]+"," ",m[1]).strip(" .:-") if m else ""
  if len(n)>=3:d.append({"name":n,"category":"General","location":"","cost":int(m[2].replace(",","")),"conf":round(max(0,sum(x[1] for x in w)/len(w))/100,2)})
 return {"drafts":d,"simulated":False} if d else {"drafts":[dict(zip(("name","category","location","cost","conf"),r)) for r in SAMPLE],"simulated":True}
def handle(u,path,d):
 role=u["role"]
 m=re.fullmatch(r"/subs/(SUB-\d+)/(\w+)",path)
 if path=="/subs":
  need(role,"procurement");name,loc,cost=(d.get("name") or "").strip(),(d.get("location") or "").strip(),int(d.get("cost") or 0)
  if not(name and loc and cost>0):raise Err(400,"Name, location and cost are required.")
  id="SUB-%d"%(101+one("select count(*) c from subs")["c"]);names=[];os.makedirs(os.path.join(UP,id),exist_ok=True)
  for f in d.get("files") or []:
   n=re.sub(r"[^\w.\- ]","_",os.path.basename(f["name"]))[:80] or "file";open(os.path.join(UP,id,n),"wb").write(base64.b64decode(f["data"]));names.append(n)
  con.execute("insert into subs values(?,?,?,?,?,?,?,?,?,?,?)",(id,"Procurement",name,loc,cost,"Submitted","",0,0,None,json.dumps(names)));log(id,"procurement","Submitted",f"{name} with {len(names)} document(s)")
 elif m and m[2]=="decide":
  s=sub(m[1]);k=d.get("kind");note=(d.get("note") or "").strip()
  if k=="reply":need(role,"procurement");ok(s["status"]=="Clarification");new=("Submitted","Clarification answered",note,"")
  else:need(role,"maintenance");ok(s["status"]=="Submitted");new={"accept":("Accepted","Accepted","Submission accepted by Works",""),"clar":("Clarification","Clarification requested",note,note),"rej":("Rejected","Rejected",note,note)}.get(k)
  ok(new)
  if k!="accept" and not note:raise Err(400,"A note is required.")
  con.execute("update subs set status=?,note=? where id=?",(new[0],new[3],s["id"]));log(s["id"],"procurement" if k=="reply" else "maintenance",new[1],new[2])
 elif m and m[2]=="verify":
  need(role,"finance");s=sub(m[1]);ok(s["status"]=="Accepted" and not s["fin"]);con.execute("update subs set fin=1 where id=?",(s["id"],));log(s["id"],"finance","Cost verified","Acquisition cost confirmed")
 elif m and m[2]=="save":
  need(role,"admin");s=sub(m[1]);ok(s["status"]=="Accepted" and s["fin"] and not s["saved"]);con.execute("update subs set saved=1 where id=?",(s["id"],));log(s["id"],"admin","Documents saved","Verified documents stored permanently")
 elif m and m[2]=="register":
  need(role,"maintenance");s=sub(m[1]);ok(s["status"]=="Accepted" and s["fin"] and s["saved"])
  aid=add_asset(s["name"],"General",s["location"],s["cost"],s["dept"],"Registered from "+s["id"]);con.execute("update subs set status='Registered',assetId=? where id=?",(aid,s["id"]))
 elif (m:=re.fullmatch(r"/assets/(AST-\d+)",path)):
  need(role,"maintenance");p=d.get("patch") or {}
  if not one("select 1 from assets where id=?",m[1]):raise Err(404,"Asset not found.")
  for k in("location","status"):
   if k in p:con.execute(f"update assets set {k}=? where id=?",(str(p[k]),m[1]))
  log(m[1],"maintenance",d.get("action") or "Updated",d.get("detail") or "")
 elif (m:=re.fullmatch(r"/users/([^/]+)/status",path)):
  need(role,"admin");em=unquote(m[1]);t=one("select * from users where email=?",em);st=d.get("status")
  if not t or t["role"]=="admin" or st not in("active","disabled"):raise Err(400,"That account cannot be changed.")
  con.execute("update users set status=? where email=?",(st,em));log("USERS","admin","Access changed",t["name"]+(" disabled" if st=="disabled" else " approved" if t["status"]=="pending" else " reactivated"))
 elif path=="/record":log(d.get("assetId") or "",role,d.get("action") or "",d.get("detail") or "")
 elif path=="/tamper":need(role,"auditor");tamper(bool(d.get("on")))
 elif path=="/ledger/scan":need(role,"maintenance");return scan(d.get("image") or "")
 elif path=="/ledger/import":
  need(role,"maintenance");ids=[add_asset(x["name"],x.get("category"),x.get("location"),x["cost"],"Maintenance / Works","Imported by Ledger Rescue, verified by Works staff") for x in d.get("drafts") or []];return {"ids":ids}
 else:raise Err(404,"Not found.")
 return {"ok":True}
def session_user(h):
 m=re.search(r"assetdna_session=(\w+)",h.headers.get("Cookie",""))
 return m and one("select u.email,u.name,u.role from sessions t join users u on u.email=t.email where t.token=? and u.status='active'",m[1])
CK="assetdna_session=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d"
def auth(path,d,u):
 if path=="/auth/signup":
  name,em,pw,role=(d.get("name") or "").strip(),(d.get("email") or "").strip().lower(),d.get("password") or "",d.get("role")
  if len(name)<2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",em):raise Err(400,"Enter your name and a valid email address.")
  if role not in("maintenance","procurement","finance","auditor"):raise Err(400,"Choose your office.")
  if len(pw)<8:raise Err(400,"Password must be at least 8 characters.")
  if one("select 1 from users where email=?",em):raise Err(409,"An account with this email already exists.")
  con.execute("insert into users values(?,?,?,?,?)",(em,name,role,hp(pw),"pending"));log("USERS",role,"Account requested",name);return {"ok":True},None
 if path=="/auth/signin":
  t=one("select * from users where email=?",(d.get("email") or "").strip().lower())
  if not t or not hmac.compare_digest(hp(d.get("password") or "",t["pw"].split("$")[0]),t["pw"]):raise Err(401,"Wrong email or password.")
  if t["status"]=="pending":raise Err(403,"Your account is waiting for Admin approval.")
  if t["status"]!="active":raise Err(403,"This account has been disabled. Contact Admin.")
  tok=secrets.token_hex(24);con.execute("insert into sessions values(?,?)",(tok,t["email"]));log("SESSION",t["role"],"Signed in",t["name"])
  return {"user":{"email":t["email"],"name":t["name"],"role":t["role"]}},CK%(tok,604800)
 if path=="/auth/signout":
  if u:con.execute("delete from sessions where email=?",(u["email"],));log("SESSION",u["role"],"Signed out",u["name"])
  return {"ok":True},CK%("",0)
 raise Err(404,"Not found.")
class H(BaseHTTPRequestHandler):
 def log_message(s,*a):pass
 def out(s,code,obj=None,raw=None,ctype="application/json",ck=None):
  b=raw if raw is not None else json.dumps(obj).encode();s.send_response(code);s.send_header("Content-Type",ctype);s.send_header("Content-Length",str(len(b)))
  if ck:s.send_header("Set-Cookie",ck)
  s.end_headers();s.wfile.write(b)
 def do_GET(s):
  p=unquote(s.path.split("?")[0])
  with LOCK:
   u=session_user(s)
   if p=="/api/auth/me":return s.out(200,{"user":u})
   if p.startswith("/api/"):
    if not u:return s.out(401,{"error":"Please sign in."})
    if p=="/api/state":return s.out(200,state())
    if p=="/api/verify":return s.out(200,{"bad":verify()})
    m=re.fullmatch(r"/api/docs/(SUB-\d+)/([^/]+)",p)
    if m:
     f=os.path.join(UP,m[1],os.path.basename(m[2]))
     if os.path.isfile(f):return s.out(200,raw=open(f,"rb").read(),ctype=mimetypes.guess_type(f)[0] or "application/octet-stream")
    return s.out(404,{"error":"Not found."})
  f=os.path.normpath(os.path.join(DIST,p.lstrip("/")))
  if not f.startswith(DIST) or not os.path.isfile(f):f=os.path.join(DIST,"index.html")
  if os.path.isfile(f):return s.out(200,raw=open(f,"rb").read(),ctype=mimetypes.guess_type(f)[0] or "text/html")
  s.out(404,{"error":"Run the frontend with npm run dev, or npm run build first."})
 def do_POST(s):
  try:
   d=json.loads(s.rfile.read(int(s.headers.get("Content-Length") or 0)) or b"{}");p=s.path.split("?")[0]
   if not p.startswith("/api/"):raise Err(404,"Not found.")
   with LOCK:
    try:
     u=session_user(s)
     if p.startswith("/api/auth/"):r,ck=auth(p[4:],d,u)
     else:
      if not u:raise Err(401,"Please sign in.")
      r,ck=handle(u,p[4:],d),None
     con.commit()
    except Exception:con.rollback();raise
   s.out(200,r,ck=ck)
  except Err as e:s.out(e.c,{"error":e.m})
  except Exception as e:s.out(500,{"error":"Server error: %s"%e})
if __name__=="__main__":
 seed();seed_users();con.commit();port=int(os.environ.get("PORT",8000));print(f"AssetDNA API on http://localhost:{port}");ThreadingHTTPServer(("",port),H).serve_forever()
