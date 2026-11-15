#!/usr/bin/env python3
"""AssetDNA API. Standard library only; PostgreSQL via psycopg when DATABASE_URL is set, otherwise a local SQLite file."""
import base64,hashlib,hmac,json,mimetypes,os,re,secrets,sqlite3,subprocess,tempfile,threading,time
from datetime import datetime,timezone
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote
HERE=os.path.dirname(os.path.abspath(__file__))
DATABASE_URL=os.environ.get("DATABASE_URL","");PG=DATABASE_URL.startswith(("postgres://","postgresql://"))
DB=os.environ.get("ASSETDNA_DB",os.path.join(HERE,"assetdna.db"));DEMO=os.environ.get("SEED_DEMO","0")=="1"
DIST=os.path.normpath(os.path.join(HERE,"..","dist"));Z="0"*64;LOCK=threading.RLock();WEEK=7*86400
ROLES={"maintenance":"Amina Yusuf","procurement":"Tunde Bello","finance":"Grace Obi","admin":"System Admin","auditor":"Chief Auditor"}
DEPTS=("Procurement","Central Stores","Transportation");STATUSES=("Active","Under maintenance","Disposed")
BIG="bigint" if PG else "integer";con=None
def connect():
 global con
 if PG:
  import psycopg;from psycopg.rows import dict_row
  con=psycopg.connect(DATABASE_URL,row_factory=dict_row)
 else:
  os.makedirs(os.path.dirname(DB) or ".",exist_ok=True);con=sqlite3.connect(DB,check_same_thread=False);con.row_factory=sqlite3.Row
def ready():
 try:con.execute("select 1")
 except Exception:
  try:con.close()
  except Exception:pass
  connect()
def ex(sql,*a):return con.execute(sql.replace("?","%s") if PG else sql,a)
def q(sql,*a):return [dict(r) for r in ex(sql,*a).fetchall()]
def one(sql,*a):r=q(sql,*a);return r[0] if r else None
USERS="create table if not exists users(email text primary key,name text,role text,pw text,status text)"
DDL=[f"create table if not exists assets(id text primary key,name text,category text,location text,status text,cost {BIG},custodian text)",
f'create table if not exists subs(id text primary key,dept text,name text,location text,cost {BIG},status text,note text,fin integer,saved integer,"assetId" text,docs text,category text)',
'create table if not exists chain(i integer primary key,ts text,"assetId" text,actor text,action text,detail text,prev text,hash text)',USERS,
f"create table if not exists sessions(token text primary key,email text,created {BIG})","create table if not exists meta(k text primary key,v text)",
"create table if not exists docs(sub text,name text,mime text,data text,primary key(sub,name))",f"create table if not exists attempts(k text,t {BIG})"]
def init():
 connect()
 for d in DDL:ex(d)
 con.commit()
 for m in ("alter table subs add column category text",f"alter table sessions add column created {BIG}"):
  try:ex(m);con.commit()
  except Exception:con.rollback()
 try:ex("select email,pw,status from users limit 1");con.rollback()
 except Exception:con.rollback();ex("drop table if exists users");ex(USERS);con.commit()
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def body(e):return json.dumps([e["i"],e["ts"],e["assetId"],e["actor"],e["action"],e["detail"],e["prev"]],separators=(",",":"),ensure_ascii=False)
def log(asset,actor,action,detail):
 last=one("select i,hash from chain order by i desc limit 1")
 e={"i":last["i"]+1 if last else 0,"ts":datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z"),"assetId":asset,"actor":actor,"action":action,"detail":detail,"prev":last["hash"] if last else Z}
 e["hash"]=sha(body(e));ex("insert into chain values(?,?,?,?,?,?,?,?)",e["i"],e["ts"],asset,actor,action,detail,e["prev"],e["hash"])
def verify():
 p=Z
 for e in q("select * from chain order by i"):
  if e["prev"]!=p or e["hash"]!=sha(body(e)):return e["i"]
  p=e["hash"]
 return -1
def tamper(on):
 o=one("select v from meta where k='orig'")
 if on and not o and one("select 1 from chain where i=2"):
  ex("insert into meta values('orig',(select detail from chain where i=2))");ex("update chain set detail='Cost revised to ₦1' where i=2")
 elif not on and o:ex("update chain set detail=? where i=2",o["v"]);ex("delete from meta where k='orig'")
def state():
 subs=q("select * from subs order by length(id),id")
 for s in subs:s.update(fin=bool(s["fin"]),saved=bool(s["saved"]),docs=json.loads(s["docs"] or "[]"),category=s["category"] or "General")
 return {"assets":q("select * from assets order by length(id),id"),"subs":subs,"chain":q("select * from chain order by i"),"users":q("select email,name,role,status from users order by name"),"tampered":bool(one("select 1 from meta where k='orig'")),"demo":DEMO}
def hp(pw,salt=None):
 salt=salt or secrets.token_hex(8);return salt+"$"+hashlib.pbkdf2_hmac("sha256",pw.encode(),salt.encode(),120000).hex()
def seed():
 if not DEMO or one("select 1 from assets"):return
 A=[("Diesel Generator 100kVA","Power","Works Yard","Active",4200000,"Maintenance / Works"),("Dell Latitude Laptop","ICT","ICT Resource Center","Active",650000,"ICT Resource Center"),("Toyota Hilux","Vehicle","Transport Unit","Under maintenance",28500000,"Transportation"),("Lab Microscope","Laboratory","Biology Lab 2","Active",1300000,"Biology Dept")]
 for i,a in enumerate(A):ex("insert into assets values(?,?,?,?,?,?,?)",f"AST-{1001+i}",*a);log(f"AST-{1001+i}","maintenance","Registered","Accepted from "+a[5])
 for s in [("SUB-101","Diesel Generator 150kVA","Works Yard",5100000,"Submitted","Power"),("SUB-102","Industrial Printer","Central Stores",920000,"Accepted","Office equipment")]:
  ex("insert into subs values(?,?,?,?,?,?,?,?,?,?,?,?)",s[0],"Procurement",s[1],s[2],s[3],s[4],"",0,0,None,"[]",s[5]);log(s[0],"procurement","Submitted",s[1]+" with documents")
 log("SUB-102","maintenance","Accepted","Submission accepted by Works")
def seed_users():
 if DEMO and not one("select 1 from users"):
  for r,n in ROLES.items():ex("insert into users values(?,?,?,?,?)",f"{r}@funaab.edu.ng",n,r,hp("Demo@1234"),"active")
 em,pw=os.environ.get("ADMIN_EMAIL","").strip().lower(),os.environ.get("ADMIN_PASSWORD","")
 if em and len(pw)>=8 and not one("select 1 from users where email=?",em):ex("insert into users values(?,?,?,?,?)",em,os.environ.get("ADMIN_NAME","Administrator"),"admin",hp(pw),"active")
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
 ex("insert into assets values(?,?,?,?,?,?,?)",aid,name,cat or "General",loc or "Unassigned","Active",int(cost),cust);log(aid,"maintenance","Registered",detail);return aid
SAMPLE=[("Office Desk (Executive)","Furniture","Registry",85000,.97),("Photocopier Canon IR","Office equipment","Bursary",1150000,.62),("Water Pump 5HP","Plant","Farm Annex",430000,.91),("Projector Epson","Audio-visual","Lecture Hall B",380000,.55),("Standby Inverter 5kVA","Power","Senate Building",1800000,.88)]
def scan(b64):
 L={};p=None
 try:
  with tempfile.NamedTemporaryFile(delete=False) as f:f.write(base64.b64decode(b64));p=f.name
  tsv=subprocess.run(["tesseract",p,"stdout","--psm","6","tsv"],capture_output=True,text=True,timeout=90).stdout
  for r in tsv.splitlines()[1:]:
   c=r.split("\t")
   if len(c)==12 and c[0]=="5" and c[11].strip():L.setdefault(tuple(c[2:5]),[]).append((c[11].strip(),float(c[10])))
 except Exception:pass
 finally:
  if p:
   try:os.unlink(p)
   except Exception:pass
 d=[]
 for w in L.values():
  m=re.match(r"^(.*?)[\s|.:\-]*[₦N]?\s*(\d{1,3}(?:,\d{3})+|\d{4,})\s*$"," ".join(x[0] for x in w));n=re.sub(r"[|_]+"," ",m[1]).strip(" .:-") if m else ""
  if len(n)>=3:d.append({"name":n,"category":"General","location":"","cost":int(m[2].replace(",","")),"conf":round(max(0,sum(x[1] for x in w)/len(w))/100,2)})
 return {"drafts":d,"simulated":False} if d else {"drafts":[dict(zip(("name","category","location","cost","conf"),r)) for r in SAMPLE],"simulated":True}
def clean(v,n):return re.sub(r"\s+"," ",str(v or "")).strip()[:n]
def handle(u,path,d):
 role=u["role"];m=re.fullmatch(r"/subs/(SUB-\d+)/(\w+)",path)
 if path=="/subs":
  need(role,"procurement");name,loc,cat,dept=clean(d.get("name"),120),clean(d.get("location"),120),clean(d.get("category"),60) or "General",d.get("dept") or "Procurement"
  try:cost=int(d.get("cost") or 0)
  except (TypeError,ValueError):cost=0
  if not(name and loc and cost>0):raise Err(400,"Name, location and cost are required.")
  if dept not in DEPTS:raise Err(400,"Choose a department.")
  files=d.get("files") or []
  if len(files)>10:raise Err(400,"Attach at most 10 documents.")
  id="SUB-%d"%(101+one("select count(*) c from subs")["c"]);names=[]
  for f in files:
   n=re.sub(r"[^\w.\- ]","_",os.path.basename(str(f.get("name") or "file")))[:80] or "file";raw=f.get("data") or ""
   if n in names:n=f"{len(names)+1}_{n}"
   if len(raw)>11_000_000:raise Err(413,"Each document must be under 8 MB.")
   try:base64.b64decode(raw,validate=True)
   except Exception:raise Err(400,"A document could not be read.")
   ex("insert into docs values(?,?,?,?)",id,n,mimetypes.guess_type(n)[0] or "application/octet-stream",raw);names.append(n)
  ex("insert into subs values(?,?,?,?,?,?,?,?,?,?,?,?)",id,dept,name,loc,cost,"Submitted","",0,0,None,json.dumps(names),cat);log(id,"procurement","Submitted",f"{name} with {len(names)} document(s)")
 elif m and m[2]=="decide":
  s=sub(m[1]);k=d.get("kind");note=clean(d.get("note"),500)
  if k=="reply":need(role,"procurement");ok(s["status"]=="Clarification");new=("Submitted","Clarification answered",note,"")
  else:need(role,"maintenance");ok(s["status"]=="Submitted");new={"accept":("Accepted","Accepted","Submission accepted by Works",""),"clar":("Clarification","Clarification requested",note,note),"rej":("Rejected","Rejected",note,note)}.get(k)
  ok(new)
  if k!="accept" and not note:raise Err(400,"A note is required.")
  ex("update subs set status=?,note=? where id=?",new[0],new[3],s["id"]);log(s["id"],"procurement" if k=="reply" else "maintenance",new[1],new[2])
 elif m and m[2]=="verify":
  need(role,"finance");s=sub(m[1]);ok(s["status"]=="Accepted" and not s["fin"]);ex("update subs set fin=1 where id=?",s["id"]);log(s["id"],"finance","Cost verified","Acquisition cost confirmed")
 elif m and m[2]=="save":
  need(role,"admin");s=sub(m[1]);ok(s["status"]=="Accepted" and s["fin"] and not s["saved"]);ex("update subs set saved=1 where id=?",s["id"]);log(s["id"],"admin","Documents saved","Verified documents stored permanently")
 elif m and m[2]=="register":
  need(role,"maintenance");s=sub(m[1]);ok(s["status"]=="Accepted" and s["fin"] and s["saved"])
  aid=add_asset(s["name"],s["category"],s["location"],s["cost"],s["dept"],"Registered from "+s["id"]);ex('update subs set status=\'Registered\',"assetId"=? where id=?',aid,s["id"])
 elif (m:=re.fullmatch(r"/assets/(AST-\d+)",path)):
  need(role,"maintenance");p=d.get("patch") or {};a=one("select * from assets where id=?",m[1])
  if not a:raise Err(404,"Asset not found.")
  if a["status"]=="Disposed":raise Err(409,"This asset has been disposed and can no longer be changed.")
  if "status" in p and p["status"] not in STATUSES:raise Err(400,"Unknown status.")
  if "location" in p and not clean(p["location"],120):raise Err(400,"Location can't be empty.")
  for k in("location","status"):
   if k in p:ex(f"update assets set {k}=? where id=?",clean(p[k],120),m[1])
  log(m[1],"maintenance",clean(d.get("action"),60) or "Updated",clean(d.get("detail"),300))
 elif path=="/users":
  need(role,"admin");name,em,pw,r=clean(d.get("name"),80),clean(d.get("email"),120).lower(),d.get("password") or "",d.get("role")
  if len(name)<2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",em):raise Err(400,"Enter a name and a valid email address.")
  if r not in ROLES:raise Err(400,"Choose a role.")
  if len(pw)<8 or len(pw)>200:raise Err(400,"Password must be at least 8 characters.")
  if one("select 1 from users where email=?",em):raise Err(409,"An account with this email already exists.")
  ex("insert into users values(?,?,?,?,?)",em,name,r,hp(pw),"active");log("USERS","admin","Account created",name)
 elif (m:=re.fullmatch(r"/users/([^/]+)/password",path)):
  need(role,"admin");em=unquote(m[1]);t=one("select * from users where email=?",em);pw=d.get("password") or ""
  if not t:raise Err(404,"User not found.")
  if len(pw)<8 or len(pw)>200:raise Err(400,"Password must be at least 8 characters.")
  ex("update users set pw=? where email=?",hp(pw),em);ex("delete from sessions where email=?",em);log("USERS","admin","Password reset",t["name"])
 elif (m:=re.fullmatch(r"/users/([^/]+)/status",path)):
  need(role,"admin");em=unquote(m[1]);t=one("select * from users where email=?",em);st=d.get("status")
  if not t or t["email"]==u["email"] or st not in("active","disabled"):raise Err(400,"That account cannot be changed.")
  ex("update users set status=? where email=?",st,em)
  if st=="disabled":ex("delete from sessions where email=?",em)
  log("USERS","admin","Access changed",t["name"]+(" disabled" if st=="disabled" else " approved" if t["status"]=="pending" else " reactivated"))
 elif path=="/record":
  if role!="auditor" or d.get("action")!="Audit view":raise Err(403,"Not allowed.")
  log(clean(d.get("assetId"),20),role,"Audit view","Passport opened")
 elif path=="/tamper":
  need(role,"auditor")
  if not DEMO:raise Err(403,"Tamper simulation is only available in demo mode.")
  tamper(bool(d.get("on")))
 elif path=="/ledger/scan":need(role,"maintenance");return scan(d.get("image") or "")
 elif path=="/ledger/import":
  need(role,"maintenance");rows=d.get("drafts") or []
  if not rows or len(rows)>200:raise Err(400,"Send between 1 and 200 rows.")
  ids=[]
  for x in rows:
   n=clean(x.get("name"),120)
   try:c=int(x.get("cost"))
   except (TypeError,ValueError):c=-1
   if not n or c<0:raise Err(400,"Every row needs a name and a cost.")
   ids.append(add_asset(n,clean(x.get("category"),60),clean(x.get("location"),120),c,"Maintenance / Works","Imported by Ledger Rescue, verified by Works staff"))
  return {"ids":ids}
 else:raise Err(404,"Not found.")
 return {"ok":True}
def session_user(h):
 m=re.search(r"assetdna_session=(\w+)",h.headers.get("Cookie",""))
 return m and one("select u.email,u.name,u.role,t.token from sessions t join users u on u.email=t.email where t.token=? and t.created>? and u.status='active'",m[1],int(time.time())-WEEK)
def cookie(tok,age,secure):return f"assetdna_session={tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}"+("; Secure" if secure else "")
def start(t,secure):
 tok=secrets.token_hex(24);ex("insert into sessions values(?,?,?)",tok,t["email"],int(time.time()));log("SESSION",t["role"],"Signed in",t["name"])
 return {"user":{"email":t["email"],"name":t["name"],"role":t["role"]}},cookie(tok,WEEK,secure)
def auth(path,d,u,ip,secure):
 if path=="/auth/signup":
  name,em,pw,role=clean(d.get("name"),80),clean(d.get("email"),120).lower(),d.get("password") or "",d.get("role");first=not one("select 1 from users")
  if first:role="admin"
  if len(name)<2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",em):raise Err(400,"Enter your name and a valid email address.")
  if not first and role not in("maintenance","procurement","finance","auditor"):raise Err(400,"Choose your office.")
  if len(pw)<8 or len(pw)>200:raise Err(400,"Password must be at least 8 characters.")
  if one("select 1 from users where email=?",em):raise Err(409,"An account with this email already exists.")
  if first:
   ex("insert into users values(?,?,?,?,?)",em,name,"admin",hp(pw),"active");log("USERS","admin","Administrator account created",name);return start({"email":em,"name":name,"role":"admin"},secure)
  ex("insert into users values(?,?,?,?,?)",em,name,role,hp(pw),"pending");log("USERS",role,"Account requested",name);return {"ok":True},None
 if path=="/auth/signin":
  em=clean(d.get("email"),120).lower();key=em+"|"+ip;now=int(time.time());ex("delete from attempts where t<?",now-900)
  if one("select count(*) c from attempts where k=?",key)["c"]>=8:raise Err(429,"Too many attempts. Try again in a few minutes.")
  t=one("select * from users where email=?",em)
  if not t or not hmac.compare_digest(hp(d.get("password") or "",t["pw"].split("$")[0]),t["pw"]):
   ex("insert into attempts values(?,?)",key,now);con.commit();raise Err(401,"Wrong email or password.")
  if t["status"]=="pending":raise Err(403,"Your account is waiting for Admin approval.")
  if t["status"]!="active":raise Err(403,"This account has been disabled. Contact Admin.")
  ex("delete from attempts where k=?",key);return start(t,secure)
 if path=="/auth/password":
  if not u:raise Err(401,"Please sign in.")
  t=one("select pw from users where email=?",u["email"]);new=d.get("password") or ""
  if not hmac.compare_digest(hp(d.get("current") or "",t["pw"].split("$")[0]),t["pw"]):raise Err(401,"Your current password is wrong.")
  if len(new)<8 or len(new)>200:raise Err(400,"New password must be at least 8 characters.")
  ex("update users set pw=? where email=?",hp(new),u["email"]);ex("delete from sessions where email=? and token<>?",u["email"],u["token"]);log("SESSION",u["role"],"Password changed",u["name"]);return {"ok":True},None
 if path=="/auth/signout":
  if u:ex("delete from sessions where email=?",u["email"]);log("SESSION",u["role"],"Signed out",u["name"])
  return {"ok":True},cookie("",0,secure)
 raise Err(404,"Not found.")
class H(BaseHTTPRequestHandler):
 def log_message(s,*a):pass
 def out(s,code,obj=None,raw=None,ctype="application/json",ck=None,extra=None):
  b=raw if raw is not None else json.dumps(obj).encode();s.send_response(code);s.send_header("Content-Type",ctype);s.send_header("Content-Length",str(len(b)))
  for k,v in {"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"same-origin",**(extra or {})}.items():s.send_header(k,v)
  if ck:s.send_header("Set-Cookie",ck)
  s.end_headers();s.wfile.write(b)
 def https(s):return s.headers.get("X-Forwarded-Proto","")=="https"
 def ip(s):return (s.headers.get("X-Forwarded-For","").split(",")[0].strip() or s.client_address[0])
 def do_GET(s):
  p=unquote(s.path.split("?")[0])
  if p.startswith("/api/"):
   with LOCK:
    try:
     ready();u=session_user(s)
     if p=="/api/config":r=(200,{"demo":DEMO,"setup":not one("select 1 from users")})
     elif p=="/api/auth/me":r=(200,{"user":u and {k:u[k] for k in("email","name","role")}})
     elif not u:r=(401,{"error":"Please sign in."})
     elif p=="/api/state":r=(200,state())
     elif p=="/api/verify":r=(200,{"bad":verify()})
     elif (m:=re.fullmatch(r"/api/docs/(SUB-\d+)/([^/]+)",p)):
      f=one("select mime,data from docs where sub=? and name=?",m[1],m[2]);con.rollback()
      if f:return s.out(200,raw=base64.b64decode(f["data"]),ctype=f["mime"],extra={"Content-Disposition":'attachment; filename="%s"'%re.sub(r'[^\w.\- ]','_',m[2])})
      r=(404,{"error":"Not found."})
     else:r=(404,{"error":"Not found."})
     con.rollback()
    except Exception as e:
     try:con.rollback()
     except Exception:pass
     r=(500,{"error":"Server error."})
   return s.out(*r)
  f=os.path.normpath(os.path.join(DIST,p.lstrip("/")))
  if not f.startswith(DIST) or not os.path.isfile(f):f=os.path.join(DIST,"index.html")
  if os.path.isfile(f):return s.out(200,raw=open(f,"rb").read(),ctype=mimetypes.guess_type(f)[0] or "text/html")
  s.out(404,{"error":"Run the frontend with npm run dev, or npm run build first."})
 def do_POST(s):
  try:
   n=int(s.headers.get("Content-Length") or 0)
   if n>40_000_000:raise Err(413,"Request too large.")
   d=json.loads(s.rfile.read(n) or b"{}");p=s.path.split("?")[0]
   if not p.startswith("/api/") or not isinstance(d,dict):raise Err(404,"Not found.")
   with LOCK:
    try:
     ready();u=session_user(s)
     if p.startswith("/api/auth/"):r,ck=auth(p[4:],d,u,s.ip(),s.https())
     else:
      if not u:raise Err(401,"Please sign in.")
      r,ck=handle(u,p[4:],d),None
     con.commit()
    except Exception:
     try:con.rollback()
     except Exception:pass
     raise
   s.out(200,r,ck=ck)
  except Err as e:s.out(e.c,{"error":e.m})
  except Exception as e:print("error:",repr(e),flush=True);s.out(500,{"error":"Server error."})
if __name__=="__main__":
 init();seed();seed_users();con.commit();port=int(os.environ.get("PORT",8000))
 print(f"AssetDNA API on http://localhost:{port} ({'PostgreSQL' if PG else 'SQLite'}, demo={'on' if DEMO else 'off'})",flush=True);ThreadingHTTPServer(("",port),H).serve_forever()
