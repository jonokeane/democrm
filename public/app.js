(function(){
"use strict";

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>(n<0?"-":"")+"$"+Math.abs(+n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const money0=n=>"$"+Math.round(+n||0).toLocaleString("en-US");
const r2=n=>Math.round((+n||0)*100)/100;
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const k=(x.getDay()+6)%7;return addDays(x,-k)};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmtD=d=>MON[d.getMonth()]+" "+d.getDate();
const fmtDY=d=>MON[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();
const range=(a,b)=>+a===+b?fmtDY(b):a.getMonth()===b.getMonth()?MON[a.getMonth()]+" "+a.getDate()+"–"+b.getDate()+", "+b.getFullYear():fmtD(a)+" – "+fmtD(b)+", "+b.getFullYear();
const hrs=h=>{const t=Math.round((+h||0)*60);return Math.floor(t/60)+":"+pad(t%60)};
const invNo=fri=>pad(fri.getMonth()+1)+pad(fri.getDate())+String(fri.getFullYear()).slice(2);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const toMin=t=>{if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const fmtTime=t=>{if(!t)return"";let [h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";h=h%12||12;return h+":"+pad(m)+" "+ap};
function toast(msg){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
const MARK=`<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4dabf7"/><stop offset=".55" stop-color="#5c7cfa"/><stop offset="1" stop-color="#9775fa"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#mk)"/><path d="M23.5 11v12.2a5.5 5.5 0 0 1-11 .3" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/><circle cx="29" cy="29" r="3.2" fill="#ffd43b"/></svg>`;
const PAY_METHODS=["Bank transfer (ACH)","Credit card","Check","Cash","Zelle","Venmo","Cash App","PayPal","Other"];

/* ---------- state ---------- */
const S={ready:false,authed:null,me:null,users:null,settings:null,clients:{},entries:[],invoices:[],notes:[],reminders:[],projects:{},deals:[],expenses:[],recurring:[],tasks:[],
  tab:"home",week:monday(new Date()),invFilter:"all",invClient:"",drawer:null,
  crmFilter:"active",crmQuery:"",DB:null,v:0};
try{const t=localStorage.getItem("jcrm-tab");if(t&&["home","clients","projects","time","invoices","overview","settings"].includes(t))S.tab=t}catch(e){}

const DEFAULT_SETTINGS={business:{name:"Jono CRM Demo Studio",address1:"",address2:"",phone:"",email:"",website:""},
  bank:{bankName:"",accountName:"",routing:"",account:""},
  apps:{cashapp:"",venmo:"",zelle:""},cardLink:"",terms:"Due on receipt",setAsideLow:0.25,setAsideHigh:0.30};
const set=()=>Object.assign({},DEFAULT_SETTINGS,S.settings||{},{business:Object.assign({},DEFAULT_SETTINGS.business,(S.settings||{}).business),bank:Object.assign({},DEFAULT_SETTINGS.bank,(S.settings||{}).bank),apps:Object.assign({},DEFAULT_SETTINGS.apps,(S.settings||{}).apps)});
const clientList=()=>Object.values(S.clients).sort((a,b)=>(a.order??99)-(b.order??99)||a.name.localeCompare(b.name));
const cname=id=>(S.clients[id]||{}).name||id;
const cidx=id=>{const l=clientList();const i=l.findIndex(c=>c.id===id);return "c"+((i<0?0:i)%4)};

/* ---------- demo storage ----------
   This demo has no server. All data lives in the visitor's own browser (localStorage), starting from
   the sample data in demo-data.js. api() answers the same calls the full app sends to its server. */
const DEMO_KEY="jcrm-demo-v1",SIGNED_KEY="jcrm-signed-in";
const DEMO_USER={username:"jordan",display:"Jordan Lee",admin:true};
const DEMO_USERS=[{username:"jordan",display:"Jordan Lee",admin:true},{username:"sam",display:"Sam Patel",admin:false}];
let MEM=null;
function applyOps(D,ops){ops.forEach(o=>{const [c,id]=o.path.split("/");D[c]=D[c]||{};
  if(o.op==="set")D[c][id]=JSON.parse(JSON.stringify(o.data));
  else if(o.op==="update")Object.assign(D[c][id]||(D[c][id]={}),JSON.parse(JSON.stringify(o.data)));
  else delete D[c][id]})}
function freshDemo(){return{db:window.JCRM_SEED(new Date()),seeded:iso(new Date()),changed:false}}
function saveDemo(){try{localStorage.setItem(DEMO_KEY,JSON.stringify(MEM))}catch(e){}}
function demoStore(){
  if(MEM)return MEM;
  let s=null;try{s=JSON.parse(localStorage.getItem(DEMO_KEY)||"null")}catch(e){}
  // Untouched sample data is rebuilt each day so its dates stay current. A visitor's own changes are kept until they reset.
  if(!s||!s.db||(!s.changed&&s.seeded!==iso(new Date())))s=freshDemo();
  MEM=s;saveDemo();return MEM;
}
async function api(url,opts={}){
  const m=opts.method||"GET";
  if(url==="/api/data"&&m==="GET"){const s=demoStore();return{db:JSON.parse(JSON.stringify(s.db)),v:1,user:DEMO_USER}}
  if(url==="/api/data"&&m==="POST"){const s=demoStore();applyOps(s.db,(opts.body||{}).ops||[]);s.changed=true;saveDemo();return{ok:true}}
  const e=new Error("That isn't available in the demo");e.status=400;throw e;
}
/* ---------- demo pop-ups ---------- */
function demoModal(title,html,actions){
  const L=$("#modal");
  L.innerHTML=`<div class="modal-scrim" data-modal-close></div><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-title">
    <div class="m-ico" aria-hidden="true">i</div><h2 id="m-title">${esc(title)}</h2><p>${html}</p>
    <div class="actions">${actions||`<button class="btn primary" data-modal-close>OK, got it</button>`}</div></div>`;
  const b=L.querySelector(".modal button");if(b)b.focus();
}
function closeModal(){$("#modal").innerHTML=""}
const demoOnly=what=>demoModal("This feature is not available in the demo version",`${esc(what)} is turned off in this demo of Jono CRM. In a live build it works for real.`);
document.addEventListener("click",e=>{if(e.target.closest("[data-modal-close]"))closeModal()});
function resetDemo(){MEM=freshDemo();saveDemo();closeModal();
  Object.assign(S,{drawer:null,editing:null,crmOpen:null,crmEdit:false,projOpen:null,projEdit:false,expEdit:null,cview:null,pview:null,crmQuery:"",crmFilter:"active",invFilter:"all",invClient:"",week:monday(new Date())});
  history.replaceState(null,"",location.pathname);load().then(()=>toast("Demo data reset"));}
function derive(){
  const D=S.DB,obj=c=>Object.entries(D[c]||{}).map(([id,d])=>Object.assign({id},d));
  S.settings=(D.settings||{}).main||null;
  S.clients={};obj("clients").forEach(c=>S.clients[c.id]=c);
  S.entries=obj("entries");S.invoices=obj("invoices");S.notes=obj("notes");S.reminders=obj("reminders");S.projects={};obj("projects").forEach(x=>S.projects[x.id]=x);S.deals=obj("deals");S.expenses=obj("expenses");S.recurring=obj("recurring");S.tasks=obj("tasks");
}
function applyLocal(ops){applyOps(S.DB,ops);derive()}
async function load(quiet){
  try{
    const j=await api("/api/data");S.DB=j.db;S.v=j.v;S.authed=true;S.me=j.user||S.me;derive();
    S.ready=true;S.loadError=null;$("#sync").textContent="Saved in this browser";S.users=DEMO_USERS;
    $("#me").innerHTML=S.me?`<button class="linkbtn me-btn" data-act="logout" title="Sign out">${esc(S.me.display)} · Sign out</button>`:"";
    const m=/^#c\/(.+)$/.exec(location.hash);S.crmOpen=m?decodeURIComponent(m[1]):null;if(S.crmOpen){S.tab="clients";S.crmEdit=S.crmOpen==="new"}
    const mp=/^#p\/(.+)$/.exec(location.hash);S.projOpen=mp?decodeURIComponent(mp[1]):null;if(S.projOpen){S.tab="projects";S.projEdit=S.projOpen==="new"}
    migrateContacts();runRecurring();
  }catch(e){if(e.status!==401){S.loadError=e.message;$("#sync").textContent="Couldn't load"}}
  render();
}
let signedIn=false;try{signedIn=sessionStorage.getItem(SIGNED_KEY)==="1"}catch(e){}
if(signedIn){render();load()}else{S.authed=false;render()}
// Pick up changes made on another device when you come back to this tab.
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.authed&&!S.drawer&&!S.editing&&!S.crmEdit)load(true)});

$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]");if(!b)return;S.tab=b.dataset.tab;S.drawer=null;if(S.crmOpen||S.projOpen){history.replaceState(null,"",location.pathname);S.crmOpen=null;S.crmEdit=false;S.projOpen=null;S.projEdit=false;S.projBackClient=null}try{localStorage.setItem("jcrm-tab",S.tab)}catch(e){}render();window.scrollTo(0,0)});

// write(fn): fn receives a recorder with the same doc()/collection() calls as before; every change it
// makes is sent to the server together, and only shows here once it is safely saved.
function recorder(ops){
  const ref=p=>({set:d=>{ops.push({op:"set",path:p,data:d});return Promise.resolve()},
    update:d=>{ops.push({op:"update",path:p,data:d});return Promise.resolve()},
    delete:()=>{ops.push({op:"delete",path:p});return Promise.resolve()}});
  return{doc:ref,collection:c=>({doc:id=>ref(c+"/"+id)})};
}
async function write(fn,okMsg){
  const ops=[];
  try{
    await fn(recorder(ops));if(!ops.length)return true;
    $("#sync").textContent="Saving…";
    await api("/api/data",{method:"POST",body:{ops}});
    applyLocal(ops);$("#sync").textContent="Saved in this browser";
    render();if(okMsg)toast(okMsg);return true;
  }catch(e){
    $("#sync").textContent="Not saved";
    if(e.status!==401)toast("Couldn't save: "+(e.message||"try again"));
    return false;
  }
}

/* ---------- render ---------- */
function render(){
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===S.tab));
  const m=$("#main");
  // keep focus/scroll of form fields
  const active=document.activeElement&&document.activeElement.id;
  const keep={};m.querySelectorAll("input[id],select[id],textarea[id]").forEach(el=>keep[el.id]=el.value);
  document.body.classList.toggle("signed-out",S.authed===false);
  document.body.classList.toggle("wide",S.tab==="projects"&&S.projView==="board"&&!S.projOpen);
  const pt=$("#page-title");if(pt)pt.textContent={home:"Home",clients:"Clients",projects:"Projects",time:"Log Time",invoices:"Invoices",overview:"Money & Taxes",settings:"Settings"}[S.tab]||"";
  if(S.authed===false){m.innerHTML=viewLogin();$("#layer").innerHTML="";bindLogin();return}
  if(S.loadError){m.innerHTML=`<div class="notice bad">Your data couldn't load (${esc(S.loadError)}). Refresh the page to try again.</div>`;return}
  if(!S.ready){m.innerHTML=`<div class="panel"><p class="muted">Loading the demo…</p></div>`;return}
  m.innerHTML=S.tab==="home"?viewHome():S.tab==="clients"?viewClients():S.tab==="projects"?viewProjects():S.tab==="time"?viewTime():S.tab==="invoices"?viewInvoices():S.tab==="overview"?viewMoney():viewSettings();
  Object.entries(keep).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&el.dataset.keep!=="no")el.value=v});
  if(active){const el=document.getElementById(active);if(el)el.focus()}
  bind();
  renderDrawer();
}

/* ---------- Log Time ---------- */
function weekEntries(){const a=iso(S.week),b=iso(addDays(S.week,6));return S.entries.filter(e=>e.date>=a&&e.date<=b)}
function entryAmount(e){if(e.kind==="flat")return +e.amount||0;const c=S.clients[e.clientId];return r2((+e.hours||0)*(c?+c.rate||0:0))}
function viewTime(){
  const cl=clientList().filter(c=>c.active!==false);
  const wk=weekEntries().sort((a,b)=>a.date.localeCompare(b.date)||(a.start||"").localeCompare(b.start||""));
  const end=addDays(S.week,6);
  const today=iso(new Date());
  const defDate=(today>=iso(S.week)&&today<=iso(end))?today:iso(S.week);
  const days=[];for(let i=0;i<7;i++){const d=addDays(S.week,i);const k=iso(d);const items=wk.filter(e=>e.date===k);if(items.length||i<5)days.push({d,k,items})}
  const byClient={};wk.forEach(e=>{const o=byClient[e.clientId]||(byClient[e.clientId]={hours:0,amount:0,unbilled:0,billedInv:null});o.hours+=e.kind==="flat"?0:+e.hours||0;o.amount+=entryAmount(e);if(!e.invoiceId)o.unbilled++;else o.billedInv=e.invoiceId});
  return `
  <section class="panel">
    <div class="weeknav">
      <button class="btn sm" data-act="wk" data-d="-7" aria-label="Previous week">‹ Prev</button>
      <div class="label">${esc(range(S.week,addDays(S.week,4)))}</div>
      <div class="row"><button class="btn sm ghost" data-act="wk" data-d="0">This week</button><button class="btn sm" data-act="wk" data-d="7" aria-label="Next week">Next ›</button></div>
    </div>
  </section>
  <section class="panel">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">${S.editing?"Edit time entry":"Log time"}</h2><button class="btn sm" data-act="edit-client" data-id="">+ New client</button></div>
    <form id="f-entry" class="row" autocomplete="off">
      <div class="field w-md"><label for="e-date">Date</label><input id="e-date" type="date" value="${defDate}" data-keep="${S.editing?"yes":"no"}" required></div>
      <div class="field w-md"><label for="e-client">Client</label><select id="e-client" required>${cl.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}<option value="__new">+ Add a new client…</option></select></div>
      <div class="field w-md"><label for="e-project">Project</label><select id="e-project" data-keep="no"><option value="">No project</option></select></div>
      <div class="field"><label>Type</label><div class="seg" id="e-kind"><button type="button" data-k="time" aria-pressed="${S.kind!=="flat"}">Hours</button><button type="button" data-k="flat" aria-pressed="${S.kind==="flat"}">Flat fee</button></div></div>
    </form>
    <div class="row" style="margin-top:10px">
      ${S.kind==="flat"?`<div class="field w-sm"><label for="e-amount">Amount ($)</label><input id="e-amount" form="f-entry" type="number" step="0.01" min="0" inputmode="decimal" placeholder="250.00"></div>`:
      `<div class="field w-sm"><label for="e-start">Start</label><input id="e-start" form="f-entry" type="time"></div>
       <div class="field w-sm"><label for="e-end">End</label><input id="e-end" form="f-entry" type="time"></div>`}
      <div class="field grow"><label for="e-task">Task / project</label><input id="e-task" form="f-entry" type="text" placeholder="e.g. Homepage design"></div>
      ${S.editing?`<button class="btn primary" type="submit" form="f-entry">Save changes</button><button class="btn ghost" type="button" data-act="cancel-edit">Cancel</button>`:`<button class="btn primary" type="submit" form="f-entry">Add</button>`}
    </div>
  </section>
  <section class="panel">
    <h2>This week's work</h2>
    ${wk.length?days.map(({d,items})=>`<div class="day"><div class="day-h"><span>${DOW[d.getDay()]}, ${fmtD(d)}</span><span class="num">${items.length?hrs(items.reduce((s,e)=>s+(e.kind==="flat"?0:+e.hours||0),0)):""}</span></div>
      ${items.length?items.map(e=>`<div class="entry${S.editing===e.id?" editing":""}"><span class="chip ${cidx(e.clientId)}">${esc(cname(e.clientId))}</span>
        <span class="task">${esc(e.task||"—")}${e.projectId&&S.projects[e.projectId]?` <span class="ptag">${esc(S.projects[e.projectId].name)}</span>`:""}${e.start?` <span class="muted small">${fmtTime(e.start)}–${fmtTime(e.end)}</span>`:""}${e.invoiceId?` <span class="billed">· invoiced</span>`:""}</span>
        <span class="hrs num">${e.kind==="flat"?money(e.amount):hrs(e.hours)}</span>
        <span class="x">${e.invoiceId?"":`<button class="btn sm ghost" data-act="edit-entry" data-id="${esc(e.id)}" aria-label="Edit entry">Edit</button><button class="btn sm ghost" data-act="del-entry" data-id="${esc(e.id)}" aria-label="Delete entry">✕</button>`}</span></div>`).join(""):`<div class="muted small">No time logged</div>`}</div>`).join(""):
      `<p class="muted">Nothing logged for this week yet. Add your first block of time above, and it'll show up here grouped by day.</p>`}
  </section>
  ${Object.keys(byClient).length?`<section class="panel"><h2>Ready to invoice</h2>
    ${Object.entries(byClient).map(([cid,o])=>`<div class="sumrow"><div><span class="chip ${cidx(cid)}">${esc(cname(cid))}</span> <span class="muted small num">${o.hours?hrs(o.hours)+" hrs":""}</span></div>
      <b class="num">${money(o.amount)}</b>
      ${o.unbilled?`<button class="btn sm accent" data-act="make-inv" data-c="${esc(cid)}">Create invoice</button>`:`<button class="btn sm" data-act="open-inv" data-id="${esc(o.billedInv)}">View invoice</button>`}</div>`).join("")}
  </section>`:""}`;
}

function buildInvoice(cid){
  const c=S.clients[cid];const a=iso(S.week),b=iso(addDays(S.week,6));
  const items=S.entries.filter(e=>e.clientId===cid&&e.date>=a&&e.date<=b&&!e.invoiceId).sort((x,y)=>x.date.localeCompare(y.date));
  const lines=[];const byDay={};
  items.forEach(e=>{
    if(e.kind==="flat"){lines.push({label:e.task||"Project fee",detail:fmtDY(parse(e.date)),hours:null,rate:null,amount:r2(e.amount)});return}
    const k=e.date;(byDay[k]||(byDay[k]={hours:0,tasks:[]})).hours+=+e.hours||0;if(e.task&&!byDay[k].tasks.includes(e.task))byDay[k].tasks.push(e.task)});
  const dayLines=Object.keys(byDay).sort().map(k=>{const d=parse(k);const h=r2(byDay[k].hours);return{label:DOW[d.getDay()]+", "+fmtD(d),detail:byDay[k].tasks.join(" · "),hours:h,rate:+c.rate||0,amount:r2(h*(+c.rate||0))}});
  const all=dayLines.concat(lines);
  const fri=addDays(S.week,4);const lastDate=items.length?parse(items[items.length-1].date):fri;
  const pEnd=lastDate>fri?lastDate:fri;
  const tasks=[...new Set(items.map(e=>{const pr=e.projectId&&S.projects[e.projectId];return pr&&e.task?pr.name+": "+e.task:pr?pr.name:e.task}).filter(Boolean))];
  return{id:invNo(fri)+"-"+cid,number:invNo(fri),clientId:cid,billTo:c.billTo||c.name,periodStart:iso(S.week),periodEnd:iso(pEnd),
    issued:iso(new Date()),lines:all,total:r2(all.reduce((s,l)=>s+l.amount,0)),hours:r2(dayLines.reduce((s,l)=>s+l.hours,0)),
    notes:tasks.map(t=>"- "+t).join("\n"),status:"draft",entryIds:items.map(e=>e.id),createdAt:new Date().toISOString()};
}

/* ---------- Invoices ---------- */
const sortInv=l=>l.slice().sort((a,b)=>(b.periodEnd||"").localeCompare(a.periodEnd||"")||cname(a.clientId).localeCompare(cname(b.clientId)));
const paySum=i=>r2((i.payments||[]).reduce((s,p)=>s+(+p.amount||0),0));
const dueOf=i=>r2((+i.total||0)-(+i.credit||0));
const received=i=>(i.status==="paid")?dueOf(i)+(+i.credit||0):paySum(i);
const balanceOf=i=>(i.status==="paid")?0:r2(dueOf(i)-paySum(i));
function statusOf(i){const s=i.status||"draft";return (s==="sent"||s==="draft")&&paySum(i)>0?"partial":s}
const STATUS_LABEL={draft:"Draft",sent:"Sent",partial:"Part paid",paid:"Paid",check:"Confirm"};
function viewInvoices(){
  let l=sortInv(S.invoices);
  if(S.invFilter==="unpaid")l=l.filter(i=>["sent","draft","partial"].includes(statusOf(i)));
  if(S.invFilter==="paid")l=l.filter(i=>statusOf(i)==="paid");
  if(S.invFilter==="check")l=l.filter(i=>statusOf(i)==="check");
  if(S.invClient)l=l.filter(i=>i.clientId===S.invClient);
  const out=S.invoices.filter(i=>["sent","partial"].includes(statusOf(i)));
  const checks=S.invoices.filter(i=>statusOf(i)==="check").length;
  return `
  ${out.length?`<div class="notice">${out.length} invoice${out.length>1?"s":""} waiting on payment · <b class="num">${money(out.reduce((s,i)=>s+balanceOf(i),0))}</b> outstanding.</div>`:""}
  ${checks?`<div class="notice bad">${checks} invoice${checks>1?"s need":" needs"} your confirmation before it counts as income. Filter by “Confirm” to review.</div>`:""}
  <section class="panel">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <div class="seg" id="inv-filter">${[["all","All"],["unpaid","Unpaid"],["paid","Paid"],["check","Confirm"]].map(([k,t])=>`<button data-f="${k}" aria-pressed="${S.invFilter===k}">${t}</button>`).join("")}</div>
      <div class="field" style="min-width:180px"><label for="inv-client" class="small">Client</label><select id="inv-client"><option value="">All clients</option>${clientList().map(c=>`<option value="${esc(c.id)}" ${S.invClient===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
    </div>
    <div class="list">${l.length?l.map(i=>`<button class="inv" data-act="open-inv" data-id="${esc(i.id)}">
      <span class="no num muted">#${esc(i.number)}</span>
      <span class="who"><b>${esc(cname(i.clientId))}</b><span class="muted small">${esc(range(parse(i.periodStart),parse(i.periodEnd)))}</span></span>
      <span class="pill ${statusOf(i)}">${STATUS_LABEL[statusOf(i)]}</span>
      <span class="amt num">${money(i.total)}</span></button>`).join(""):`<p class="muted">No invoices match. Invoices you create from Log Time land here.</p>`}</div>
  </section>`;
}

/* ---------- Overview ---------- */
function nextDeadline(){
  const now=new Date();const y=now.getFullYear();
  const c=[[y,0,15,"Q4 "+(y-1)],[y,3,15,"Q1 "+y],[y,5,15,"Q2 "+y],[y,8,15,"Q3 "+y],[y+1,0,15,"Q4 "+y]].map(([a,b,d,l])=>({d:new Date(a,b,d),l}));
  return c.find(x=>x.d>=new Date(now.getFullYear(),now.getMonth(),now.getDate()));
}
function viewOverview(){
  const st=set();const yr=String(new Date().getFullYear());
  const inv=S.invoices.filter(i=>(i.periodEnd||"").startsWith(yr));
  const counted=inv.filter(i=>statusOf(i)!=="check"&&statusOf(i)!=="draft");
  const billed=counted.reduce((s,i)=>s+(+i.total||0),0);
  const paid=counted.reduce((s,i)=>s+received(i),0);
  const outs=billed-paid;
  const lo=billed*(+st.setAsideLow||.25),hi=billed*(+st.setAsideHigh||.3);
  const dl=nextDeadline();
  const byC={};counted.forEach(i=>byC[i.clientId]=(byC[i.clientId]||0)+(+i.total||0));
  const cmax=Math.max(1,...Object.values(byC));
  const byM={};counted.forEach(i=>{const m=+i.periodEnd.slice(5,7)-1;byM[m]=(byM[m]||0)+(+i.total||0)});
  const months=Object.keys(byM).map(Number).sort((a,b)=>a-b);const mmax=Math.max(1,...Object.values(byM));
  return `
  <div class="stats">
    <div class="stat"><div class="k">Billed in ${yr}</div><div class="v num">${money0(billed)}</div><div class="s">${counted.length} invoices sent</div></div>
    <div class="stat"><div class="k">Received</div><div class="v num">${money0(paid)}</div><div class="s">${outs>0.005?money(outs)+" still outstanding":"Nothing outstanding"}</div></div>
    <div class="stat key"><div class="k">Set aside for taxes</div><div class="v num">${money0(lo)}–${money0(hi)}</div><div class="s">${Math.round(st.setAsideLow*100)}–${Math.round(st.setAsideHigh*100)}% of what you billed</div></div>
    <div class="stat"><div class="k">Next IRS payment</div><div class="v">${dl?fmtD(dl.d):"—"}</div><div class="s">${dl?dl.l+" estimated tax · IRS.gov/payments":""}</div></div>
  </div>
  <section class="panel"><h2>By client</h2><div class="bars">${Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="barrow"><span>${esc(cname(c))}</span><span class="track"><span class="fill" style="display:block;width:${(v/cmax*100).toFixed(1)}%"></span></span><span class="v num">${money0(v)}</span></div>`).join("")||`<p class="muted">No invoices yet.</p>`}</div></section>
  <section class="panel"><h2>By month</h2><div class="bars">${months.map(m=>`<div class="barrow"><span>${MON[m]} ${yr}</span><span class="track"><span class="fill" style="display:block;width:${(byM[m]/mmax*100).toFixed(1)}%"></span></span><span class="v num">${money0(byM[m])}</span></div>`).join("")||`<p class="muted">No invoices yet.</p>`}</div>
  <p class="muted small" style="margin:12px 0 0">Months are grouped by the week each invoice covers. Drafts and invoices marked “Confirm” aren't counted. This is an estimate, not tax advice: your accountant and your Schedule C are the final word.</p></section>`;
}

/* ---------- Settings ---------- */
function viewSettings(){
  const s=set();const b=s.business,k=s.bank;
  return `
  <section class="panel"><h2>Your business</h2>
    <form id="f-biz" class="row">
      <div class="field grow"><label for="s-name">Business name</label><input id="s-name" value="${esc(b.name)}"></div>
      <div class="field grow"><label for="s-a1">Street address</label><input id="s-a1" value="${esc(b.address1)}"></div>
      <div class="field grow"><label for="s-a2">City, state, ZIP</label><input id="s-a2" value="${esc(b.address2)}"></div>
      <div class="field w-md"><label for="s-phone">Phone</label><input id="s-phone" value="${esc(b.phone)}"></div>
      <div class="field grow"><label for="s-email">Email</label><input id="s-email" value="${esc(b.email)}"></div>
      <div class="field w-md"><label for="s-web">Website</label><input id="s-web" value="${esc(b.website)}"></div>
    </form>
  </section>
  <section class="panel"><h2>How clients pay you</h2>
    <p class="muted small" style="margin-top:-6px">These print in the “How to pay” box on every invoice.</p>
    <div class="row">
      <div class="field grow"><label for="s-bank">Bank</label><input id="s-bank" value="${esc(k.bankName)}"></div>
      <div class="field grow"><label for="s-acctname">Account name</label><input id="s-acctname" value="${esc(k.accountName)}"></div>
      <div class="field w-md"><label for="s-routing">Routing number</label><input id="s-routing" inputmode="numeric" value="${esc(k.routing)}"></div>
      <div class="field w-md"><label for="s-acct">Account number</label><input id="s-acct" inputmode="numeric" value="${esc(k.account)}"></div>
    </div>
    <h3 style="margin-top:16px">Payment apps</h3>
    <p class="muted small" style="margin:-4px 0 8px">Leave a field blank to hide it on invoices.</p>
    <div class="row">
      <div class="field w-md"><label for="s-cashapp">Cash App</label><input id="s-cashapp" placeholder="$cashtag" value="${esc(s.apps.cashapp)}"></div>
      <div class="field w-md"><label for="s-venmo">Venmo</label><input id="s-venmo" placeholder="@username" value="${esc(s.apps.venmo)}"></div>
      <div class="field w-md"><label for="s-zelle">Zelle</label><input id="s-zelle" placeholder="phone or email" value="${esc(s.apps.zelle)}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="field grow"><label for="s-card">Card / Cash App Pay link (optional)</label><input id="s-card" placeholder="Paste a card payment link" value="${esc(s.cardLink)}"></div>
      <div class="field w-md"><label for="s-terms">Payment terms</label><input id="s-terms" value="${esc(s.terms)}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="field w-sm"><label for="s-lo">Tax set-aside low %</label><input id="s-lo" type="number" step="1" min="0" max="60" value="${Math.round(s.setAsideLow*100)}"></div>
      <div class="field w-sm"><label for="s-hi">Tax set-aside high %</label><input id="s-hi" type="number" step="1" min="0" max="60" value="${Math.round(s.setAsideHigh*100)}"></div>
      <button class="btn primary" data-act="save-settings">Save settings</button>
    </div>
  </section>
  <section class="panel"><h2>Account</h2>
    <p class="muted small" style="margin-top:-6px">Signed in as <b>${esc(S.me?S.me.display:"")}</b>${S.me?" (username: "+esc(S.me.username)+")":""}. This is a demo account.</p>
    <h3 style="margin-top:12px">Google Calendar account</h3>
    <div class="row">
      <div class="field grow"><label for="s-cal">Reminders open Google Calendar signed in as</label><input id="s-cal" type="email" placeholder="you@example.com" value="${esc(calAccount())}" data-keep="no"></div>
      <button class="btn" data-act="save-cal">Save</button>
    </div>
    <h3 style="margin-top:12px">Change password</h3>
    <div class="row">
      <div class="field w-md"><label for="pw-cur">Current password</label><input id="pw-cur" type="password" autocomplete="current-password" data-keep="no"></div>
      <div class="field w-md"><label for="pw-new">New password</label><input id="pw-new" type="password" autocomplete="new-password" minlength="10" data-keep="no"></div>
      <button class="btn" data-act="change-pw">Update password</button>
    </div>
    <h3 style="margin-top:18px">Your data</h3>
    <p class="muted small" style="margin:-4px 0 8px">Everything you add or change in this demo is saved only in this browser. Nobody else sees it, and you can start over any time.</p>
    <div class="actions"><button class="btn" data-act="export">Download a copy (JSON)</button><button class="btn" data-act="demo-reset">Reset demo data</button><button class="btn ghost" data-act="logout">Sign out</button></div>
  </section>
  <section class="panel"><h2>Invoice emails</h2>
    <p class="small" style="margin-top:-6px"><span class="pill check">Sending is off in the demo</span> <span class="muted">You can change these settings, but no emails are sent.</span></p>
    <div class="row">
      <div class="field w-md"><label for="se-name">From name</label><input id="se-name" value="${esc(emailCfg().fromName)}"></div>
      <div class="field grow"><label for="se-from">From address</label><input id="se-from" type="email" value="${esc(emailCfg().fromEmail)}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="field grow"><label for="se-reply">Replies go to</label><input id="se-reply" type="email" value="${esc(emailCfg().replyTo)}" placeholder="the inbox you actually read"></div>
      <label class="row small" style="gap:6px;align-self:flex-end;padding-bottom:10px"><input type="checkbox" id="se-bcc" ${emailCfg().bcc?"checked":""}> Send me a copy</label>
      <div class="field grow"><label for="se-bccto">Copy to (blank = reply address)</label><input id="se-bccto" type="email" value="${esc(emailCfg().bccTo||"")}"></div>
    </div>
    <h3 style="margin-top:16px">Signature</h3>
    <div class="row">
      <div class="field w-md"><label for="se-sname">Name</label><input id="se-sname" value="${esc(emailCfg().sigName)}"></div>
      <div class="field grow"><label for="se-stitle">Title line</label><input id="se-stitle" value="${esc(emailCfg().sigTitle)}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="field w-md"><label for="se-sphone">Phone</label><input id="se-sphone" value="${esc(emailCfg().sigPhone)}"></div>
      <div class="field grow"><label for="se-semail">Email</label><input id="se-semail" type="email" value="${esc(emailCfg().sigEmail)}"></div>
    </div>
    <div class="sigprev" id="sig-preview">${sigHtml()}</div>
    <div class="actions" style="margin-top:10px"><button class="btn" data-act="save-email-settings">Save email settings</button></div>
  </section>${viewUsers()}`;
}

/* ---------- Invoice sheet ---------- */
/* The invoice is one letter-size page (816 x 1056 at 96dpi). If a long invoice is taller than that,
   it is laid out a little wider (so lines wrap less) and then shrunk to fit one page, down to 82%.
   Only invoices longer than that spill onto a second page. */
const PAGE_W=816,PAGE_H=1056,MAX_W=Math.round(816/0.82);
const sheetLayoutCache=new Map();
function layoutSheet(i){
  const key=JSON.stringify([i,set(),(S.clients[i.clientId]||{}).name]);
  if(sheetLayoutCache.has(key))return sheetLayoutCache.get(key);
  const host=document.createElement("div");host.style.cssText="position:fixed;left:-20000px;top:0;visibility:hidden";document.body.appendChild(host);
  const measure=w=>{host.innerHTML=sheetHTML(i,w,true);return host.firstElementChild.scrollHeight};
  let W=PAGE_W,h=measure(W);
  for(let k=0;k<4&&h>W*PAGE_H/PAGE_W&&W<MAX_W;k++){W=Math.min(MAX_W,Math.ceil(h*PAGE_W/PAGE_H)+2);h=measure(W)}
  host.remove();
  const out={W,H:Math.max(h,Math.round(W*PAGE_H/PAGE_W))};
  if(sheetLayoutCache.size>50)sheetLayoutCache.clear();
  if(!document.fonts||document.fonts.status==="loaded")sheetLayoutCache.set(key,out);
  return out;
}
function sheetHTML(i,width,measuring){
  const s=set(),b=s.business,k=s.bank;const c=S.clients[i.clientId]||{};
  const ps=parse(i.periodStart),pe=parse(i.periodEnd);
  const hasHours=i.lines.some(l=>l.hours!=null);
  const W=width||layoutSheet(i).W;
  const notes=String(i.notes||"").split("\n").map(x=>x.trim()).filter(Boolean);
  const bullets=notes.length>1&&notes.every(x=>/^[-•*]\s*/.test(x));
  return `<div class="sheet" style="width:${W}px;min-height:${measuring?0:Math.round(W*PAGE_H/PAGE_W)}px">
    <div class="top"><div class="bmark"><span class="bm-ico">${esc(initials(b.name))}</span><span class="bm-name">${esc(b.name)}</span></div>
      <div class="title"><h1>INVOICE</h1>
        <dl class="meta"><dt>Invoice no.</dt><dd>${esc(i.number)}</dd><dt>Issued</dt><dd>${esc(fmtDY(parse(i.issued||i.periodEnd)))}</dd><dt>Work period</dt><dd>${esc(range(ps,pe))}</dd><dt>Terms</dt><dd>${esc(s.terms)}</dd></dl></div></div>
    <div class="rule"></div>
    <div class="parties">
      <div class="party"><div class="lab">From</div><b>${esc(b.name)}</b><br>${[b.address1,b.address2,[b.phone,b.email].filter(Boolean).join(" · ")].filter(Boolean).map(esc).join("<br>")}</div>
      <div class="party"><div class="lab">Bill to</div><b>${esc(i.billTo||c.billTo||c.name)}</b>${c.contact?"<br>"+esc(c.contact):""}</div>
    </div>
    <table><thead><tr><th>Description</th>${hasHours?`<th class="r">Hours</th><th class="r">Rate</th>`:""}<th class="r">Amount</th></tr></thead><tbody>
      ${i.lines.map(l=>`<tr><td><div class="d">${esc(l.label)}</div>${l.detail?`<div class="t">${esc(l.detail)}</div>`:""}</td>${hasHours?`<td class="r">${l.hours!=null?hrs(l.hours):""}</td><td class="r">${l.rate?money(l.rate):""}</td>`:""}<td class="r">${money(l.amount)}</td></tr>`).join("")}
    </tbody></table>
    <div class="totals"><table>
      ${hasHours?`<tr><td>Total hours</td><td class="r">${hrs(i.hours||i.lines.reduce((s,l)=>s+(+l.hours||0),0))}</td></tr>`:""}
      <tr><td>Subtotal</td><td class="r">${money(i.total)}</td></tr>
      ${i.credit?`<tr><td>Credit applied</td><td class="r">-${money(i.credit)}</td></tr>`:""}
      ${i.status!=="paid"&&paySum(i)>0?(i.payments||[]).map(p=>`<tr><td>Payment received ${esc(fmtD(parse(p.date)))}</td><td class="r">-${money(p.amount)}</td></tr>`).join(""):""}
      <tr class="due"><td>${i.status!=="paid"&&paySum(i)>0?"BALANCE DUE":"AMOUNT DUE"}</td><td class="r">${money(i.status!=="paid"?balanceOf(i):dueOf(i))}</td></tr>
    </table></div>
    ${notes.length?`<div class="notes"><div class="lab">Projects worked on</div>${bullets?`<ul class="${notes.length<4?"one":""}">${notes.map(x=>`<li>- ${esc(x.replace(/^[-•*]\s*/,""))}</li>`).join("")}</ul>`:`<p>${esc(i.notes)}</p>`}</div>`:""}
    <div class="pay">
      <div><div class="lab">Pay by bank transfer (ACH) <span class="pref">Preferred method</span></div><div class="grid">
        <span class="k">Bank</span><span class="v">${esc(k.bankName)}</span>
        <span class="k">Account name</span><span class="v">${esc(k.accountName)}</span>
        <span class="k">Routing</span><span class="v">${esc(k.routing||"—")}</span>
        <span class="k">Account</span><span class="v">${esc(k.account||"—")}</span>
        <span class="k">Reference</span><span class="v">Invoice ${esc(i.number)}</span></div></div>
      <div><div class="lab">Other ways to pay</div><div class="grid">
        ${s.apps.zelle?`<span class="k">Zelle</span><span class="v">${esc(s.apps.zelle)}</span>`:""}
        ${s.apps.venmo?`<span class="k">Venmo</span><span class="v">${esc(s.apps.venmo)}</span>`:""}
        ${s.apps.cashapp?`<span class="k">Cash App</span><span class="v">${esc(s.apps.cashapp)}</span>`:""}
        ${s.cardLink?`<span class="k">Card</span><span class="v" style="word-break:break-all">${esc(s.cardLink)}</span>`:""}</div>
        ${!s.apps.zelle&&!s.apps.venmo&&!s.apps.cashapp&&!s.cardLink?`<div>Card payment available on request.</div>`:""}
        <div style="margin-top:8px;color:#55534e">Questions? ${esc(b.email)}${b.phone?" · "+esc(b.phone):""}</div></div>
    </div>
    <div class="foot-gap"></div><div class="foot"><span>Thank you for your business.</span><span>${esc(b.website)}</span></div>
  </div>`;
}
function initials(n){const w=String(n||"").replace(/[^A-Za-z0-9 ]/g," ").split(/\s+/).filter(Boolean);return (w.length>1?w[0][0]+w[1][0]:(w[0]||"?").slice(0,2)).toUpperCase()}
function emailText(i,noSig){
  const s=set(),c=S.clients[i.clientId]||{};const pe=parse(i.periodEnd),ps=parse(i.periodStart);
  const due=i.status!=="paid"?balanceOf(i):dueOf(i);const part=i.status!=="paid"&&paySum(i)>0;
  return{subject:`Invoice ${i.number} from ${s.business.name} – ${range(ps,pe)}`,
  body:`Hi${c.contactName?" "+c.contactName:""},

Attached is invoice ${i.number} for work completed ${range(ps,pe)}. ${part?`Thank you for the ${money(paySum(i))} already paid. The remaining balance is ${money(due)}.`:`The amount due is ${money(due)}.`}

Preferred method: bank transfer (ACH) to:
${s.bank.bankName}
Account name: ${s.bank.accountName}
Routing: ${s.bank.routing}
Account: ${s.bank.account}
Please reference invoice ${i.number}.
${[s.apps.zelle&&"Zelle: "+s.apps.zelle,s.apps.venmo&&"Venmo: "+s.apps.venmo,s.apps.cashapp&&"Cash App: "+s.apps.cashapp,s.cardLink&&"Card: "+s.cardLink].filter(Boolean).length?"\nYou can also pay by:\n"+[s.apps.zelle&&"Zelle: "+s.apps.zelle,s.apps.venmo&&"Venmo: "+s.apps.venmo,s.apps.cashapp&&"Cash App: "+s.apps.cashapp,s.cardLink&&"Card: "+s.cardLink].filter(Boolean).join("\n")+"\n":""}
Thank you!${noSig?"":"\n\n"+sigText()}`};
}

/* ---------- Drawer ---------- */
function renderDrawer(){
  const L=$("#layer");const d=S.drawer;
  if(!d){L.innerHTML="";return}
  if(d.type==="inv"){
    const saved=d.draft||S.invoices.find(x=>x.id===d.id);if(!saved){S.drawer=null;L.innerHTML="";return}
    const i=d.notes!=null&&d.notes!==(saved.notes||"")?Object.assign({},saved,{notes:d.notes}):saved;const dirty=i!==saved;
    const isDraft=!!d.draft;const st=statusOf(i);
    const w=Math.min(816,(document.documentElement.clientWidth||816)-32);const sc=w/816;
    L.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Invoice ${esc(i.number)}">
      <div class="drawer-h"><h2>Invoice ${esc(i.number)} · ${esc(cname(i.clientId))}</h2><button class="btn sm ghost" data-act="close" aria-label="Close">✕ Close</button></div>
      <div class="drawer-b">
        ${isDraft?`<div class="notice">Review the invoice, edit the project notes if you like, then save it. Saving marks these hours as invoiced.</div>`:""}
        <div class="actions">
          ${isDraft?`<button class="btn accent" data-act="save-draft">Save invoice</button>`:`
          <button class="btn primary" data-act="pdf" id="b-pdf">Download PDF</button>
          <button class="btn accent" data-act="send-open">Email invoice</button>
          <button class="btn" data-act="copy-email">Copy email text</button>
          ${st==="draft"?`<button class="btn" data-act="mark" data-s="sent">Mark as sent</button>`:""}
          ${st==="check"?`<button class="btn" data-act="mark" data-s="paid">Confirm: I was paid</button>`:""}
          ${st!=="paid"?`<button class="btn" data-act="pay-open">Record payment</button>`:`<button class="btn" data-act="mark" data-s="sent">Mark unpaid</button>`}
          <button class="btn danger ghost" data-act="del-inv-ask">Delete</button>`}
        </div>
        ${d.confirmDel?`<div class="notice bad row" style="justify-content:space-between">Delete this invoice? Its hours go back to “ready to invoice.” <span class="row"><button class="btn sm danger" data-act="del-inv">Delete invoice</button><button class="btn sm" data-act="del-cancel">Keep it</button></span></div>`:""}
        ${st==="partial"&&!isDraft?`<div class="notice">Part paid: ${(i.payments||[]).map(p=>esc(money(p.amount))+" on "+esc(fmtDY(parse(p.date)))+(p.via?" ("+esc(p.via)+")":"")).join(", ")}. <b>Balance ${esc(money(balanceOf(i)))}</b></div>`:""}
        ${st==="paid"&&!isDraft?`<div class="notice">Paid${i.paidDate?" "+esc(fmtDY(parse(i.paidDate))):""}${i.paidVia?" · "+esc(i.paidVia):""}</div>`:""}
        ${st==="check"&&i.statusNote?`<div class="notice bad">${esc(i.statusNote)}</div>`:""}
        ${d.pay?`<section class="panel"><h2>Record payment</h2><div class="row">
          <div class="field w-sm"><label for="p-amt">Amount ($)</label><input id="p-amt" type="number" step="0.01" min="0" inputmode="decimal" value="${balanceOf(i).toFixed(2)}"></div>
          <div class="field w-md"><label for="p-date">Date received</label><input id="p-date" type="date" value="${iso(new Date())}"></div>
          <div class="field grow"><label for="p-via">How they paid</label><select id="p-via">${PAY_METHODS.map(m=>`<option>${esc(m)}</option>`).join("")}</select></div>
          <button class="btn primary" data-act="pay-save">Save payment</button></div>
          </section>`:""}
        ${(i.emails||[]).length&&!isDraft?`<div class="notice">Emailed ${(i.emails||[]).map(m=>esc(fmtD(parse(m.date)))+" to "+esc(m.to.join(", "))).join("; ")}.</div>`:""}
                ${d.email?`<section class="panel"><h2>Email</h2><div class="field"><label for="m-subj">Subject</label><input id="m-subj" readonly value="${esc(emailText(i).subject)}"></div>
          <div class="field" style="margin-top:8px"><label for="m-body">Message</label><textarea id="m-body" readonly rows="14">${esc(emailText(i).body)}</textarea></div>
          <div class="actions" style="margin-top:8px"><button class="btn sm" data-act="copy" data-t="m-subj">Copy subject</button><button class="btn sm" data-act="copy" data-t="m-body">Copy message</button></div></section>`:""}
        <div class="field"><label for="i-notes">Projects worked on (prints on the invoice)</label><textarea id="i-notes" rows="4">${esc(d.notes!=null?d.notes:(i.notes||""))}</textarea>
          <div class="row notes-bar" style="margin-top:6px;align-items:center">${isDraft?`<span class="muted small">Changes show on the invoice below and are kept when you click Save invoice.</span>`
            :`<button class="btn sm ${dirty?"accent":""}" data-act="save-notes" ${dirty?"":"disabled"}>${dirty?"Save changes":"Saved"}</button>${dirty?`<button class="btn sm ghost" data-act="notes-undo">Undo</button><span class="small" style="color:var(--warn)">Not saved yet: the preview shows your edits.</span>`:`<span class="muted small">Edit the list and the invoice below updates as you type.</span>`}`}</div></div>
        ${(()=>{const L=layoutSheet(i);const s2=w/L.W;return `<div class="sheet-wrap" style="width:${w}px;height:${Math.round(L.H*s2)}px"><div id="sheet-host" style="transform:scale(${s2});transform-origin:0 0;width:${L.W}px">${sheetHTML(i,L.W)}</div></div>${L.W>PAGE_W?`<p class="muted small" style="text-align:center;margin:0">${L.H>L.W*PAGE_H/PAGE_W+1?`Very long invoice: the PDF will run onto ${Math.ceil(L.H/(L.W*PAGE_H/PAGE_W))} pages.`:`Long invoice: shrunk to ${Math.round(PAGE_W/L.W*100)}% so it fits on one page.`}</p>`:""}`})()}
      </div></aside>`;
  } else if(d.type==="csv"){renderCsvDrawer(L)}
  else if(d.type==="task"){renderTaskDrawer(L,d)}
  else if(d.type==="crm"||d.type==="crm-edit"){renderCrmDrawer(L,d)}
}

/* ---------- events ---------- */
function bind(){
  const f=$("#f-entry");
  if(f)f.addEventListener("submit",async ev=>{ev.preventDefault();
    const date=$("#e-date").value,clientId=$("#e-client").value,task=$("#e-task").value.trim();
    if(!date||!clientId){toast("Pick a date and client.");return}
    const editing=S.editing?S.entries.find(x=>x.id===S.editing):null;
    const pe=$("#e-project");let doc={date,clientId,task,projectId:pe&&pe.value||null,createdAt:editing&&editing.createdAt||new Date().toISOString(),invoiceId:null};
    if(S.kind==="flat"){const a=+$("#e-amount").value;if(!(a>0)){toast("Enter the flat fee amount.");return}Object.assign(doc,{kind:"flat",amount:r2(a),hours:null,start:null,end:null})}
    else{const s=$("#e-start").value,e=$("#e-end").value;
      if(!s||!e){toast("Enter a start and end time.");return}
      let m=toMin(e)-toMin(s);if(m<0)m+=1440;if(!(m>0)){toast("End time must be after start time.");return}
      Object.assign(doc,{kind:"time",start:s,end:e,hours:r2(m/60),amount:null})}
    const id=editing?editing.id:uid();
    const ok=await write(db=>db.collection("entries").doc(id).set(doc),(editing?"Updated ":"Logged ")+(doc.kind==="flat"?money(doc.amount):hrs(doc.hours)+" hrs")+" for "+cname(clientId));
    if(ok){const wasEditing=!!editing;S.editing=null;if(wasEditing)S.entryProject="";["e-task","e-start","e-end","e-amount"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});if(wasEditing)render()}
  });
  const ec=$("#e-client");if(ec)fillProjects(ec.value,S.entryProject||"");
  if(ec)ec.addEventListener("change",()=>{if(ec.value==="__new"){ec.value=(clientList().find(c=>c.active!==false)||{}).id||"";S.drawer={type:"crm-edit",id:"",fresh:{status:"client",active:true}};renderDrawer()}});
  const kind=$("#e-kind");if(kind)kind.addEventListener("click",e=>{const b=e.target.closest("button[data-k]");if(!b)return;S.kind=b.dataset.k;render()});
  const ifl=$("#inv-filter");if(ifl)ifl.addEventListener("click",e=>{const b=e.target.closest("button[data-f]");if(!b)return;S.invFilter=b.dataset.f;render()});
  const ic=$("#inv-client");if(ic)ic.addEventListener("change",()=>{S.invClient=ic.value;render()});
}
let notesTimer=null;
document.addEventListener("input",e=>{if(!(e.target&&e.target.id==="i-notes"&&S.drawer))return;S.drawer.notes=e.target.value;
  clearTimeout(notesTimer);notesTimer=setTimeout(()=>{const ta=$("#i-notes");if(!ta)return;const pos=[ta.selectionStart,ta.selectionEnd],sc=$(".drawer-b").scrollTop;
    renderDrawer();const t=$("#i-notes");if(t){t.focus();try{t.setSelectionRange(pos[0],pos[1])}catch(err){}}const db=$(".drawer-b");if(db)db.scrollTop=sc},250)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#modal").innerHTML){closeModal();return}if(e.key==="Escape"&&S.drawer){S.drawer=S.drawer.back||null;renderDrawer()}});
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
  if(a==="wk"){S.editing=null;const d=+b.dataset.d;S.week=d?addDays(S.week,d):monday(new Date());render();return}
  if(a==="close"){S.drawer=S.drawer&&S.drawer.back||null;renderDrawer();return}
  if(a==="edit-entry"){const en=S.entries.find(x=>x.id===b.dataset.id);if(!en||en.invoiceId)return;S.editing=en.id;S.kind=en.kind==="flat"?"flat":"time";render();
    const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??""};sv("e-date",en.date);sv("e-client",en.clientId);fillProjects(en.clientId,en.projectId||"");sv("e-task",en.task);
    if(en.kind==="flat")sv("e-amount",en.amount);else{sv("e-start",en.start);sv("e-end",en.end)}
    const f=$("#f-entry");if(f)f.scrollIntoView({behavior:"smooth",block:"center"});const t=$("#e-start")||$("#e-amount");if(t)t.focus();return}
  if(a==="cancel-edit"){S.editing=null;render();["e-task","e-start","e-end","e-amount"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});return}
  if(a==="del-entry"){if(S.editing===b.dataset.id)S.editing=null;await write(db=>db.doc("entries/"+b.dataset.id).delete(),"Entry removed");return}
  if(a==="make-inv"){const inv=buildInvoice(b.dataset.c);if(S.invoices.some(x=>x.id===inv.id)){inv.id=inv.id+"-"+uid().slice(-4)}S.drawer={type:"inv",draft:inv};renderDrawer();return}
  if(a==="open-inv"){const back=S.drawer&&S.drawer.type==="crm"?S.drawer:null;S.drawer={type:"inv",id:b.dataset.id,back};renderDrawer();return}
  const D=S.drawer;const cur=D&&D.type==="inv"?(D.draft||S.invoices.find(x=>x.id===D.id)):null;
  if(a==="save-draft"&&D&&D.draft){const inv=Object.assign({},D.draft,{notes:$("#i-notes").value});const ids=inv.entryIds||[];
    b.disabled=true;
    const cl=S.clients[inv.clientId]||{};const promote=["prospect","lead"].includes(cl.status);
    const ok=await write(async db=>{await db.doc("invoices/"+inv.id).set(inv);for(const id of ids){await db.doc("entries/"+id).update({invoiceId:inv.id})}if(promote)await db.doc("clients/"+inv.clientId).update({status:"client",active:true})},"Invoice "+inv.number+" saved"+(promote?" · "+cl.name+" is now a client":""));
    if(ok){S.drawer={type:"inv",id:inv.id};renderDrawer()}else b.disabled=false;return}
  if(a==="notes-undo"&&D){D.notes=null;renderDrawer();return}
  if(a==="save-notes"&&cur){const ok=await write(db=>db.doc("invoices/"+cur.id).update({notes:$("#i-notes").value}),"Notes saved");if(ok){D.notes=null;renderDrawer()}return}
  if(a==="mark"&&cur){const s=b.dataset.s;const patch={status:s};if(s==="sent"){patch.sentDate=cur.sentDate||iso(new Date());patch.paidDate=null;patch.paidVia=null;patch.payments=[]}
    if(s==="paid"&&!cur.paidVia){patch.paidDate=cur.paidDate||null;patch.paidVia="Bank transfer (ACH)"}
    await write(db=>db.doc("invoices/"+cur.id).update(patch),s==="paid"?"Marked as paid":"Marked as sent");renderDrawer();return}
  if(a==="pay-open"){D.pay=!D.pay;renderDrawer();return}
  if(a==="pay-save"&&cur){const amt=r2(+$("#p-amt").value);if(!(amt>0)){toast("Enter the amount you received.");return}
    const pay={date:$("#p-date").value||iso(new Date()),amount:amt,via:$("#p-via").value};
    const pays=(cur.payments||[]).concat([pay]);const sum=r2(pays.reduce((s,p)=>s+p.amount,0));
    const patch=sum>=dueOf(cur)-0.005?{status:"paid",payments:pays,paidDate:pay.date,paidVia:pays.length>1?[...new Set(pays.map(p=>p.via))].join(" + "):pay.via}:{status:cur.status==="draft"?"sent":cur.status,payments:pays,sentDate:cur.sentDate||iso(new Date())};
    const ok=await write(db=>db.doc("invoices/"+cur.id).update(patch),"Payment recorded");if(ok){D.pay=false;renderDrawer()}return}
  if(a==="copy-email"){D.email=!D.email;renderDrawer();return}
  if(a==="send-open"&&cur){demoOnly("Emailing invoices");return}
  if(a==="send-go"&&cur){demoOnly("Emailing invoices");return}
  if(a==="save-email-settings"){const v=id=>$(id).value.trim();
    const em={fromName:v("#se-name"),fromEmail:v("#se-from"),replyTo:v("#se-reply"),bcc:$("#se-bcc").checked,bccTo:v("#se-bccto"),
      sigName:v("#se-sname"),sigTitle:v("#se-stitle"),sigPhone:v("#se-sphone"),sigEmail:v("#se-semail")};
    if(em.fromEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.fromEmail)){toast("Check the From address.");return}
    await write(db=>db.doc("settings/main").set(Object.assign({},S.settings||{},{email:em})),"Email settings saved");return}
  if(a==="copy"){const el=document.getElementById(b.dataset.t);try{await navigator.clipboard.writeText(el.value);toast("Copied")}catch(err){el.focus();el.select();toast("Press Ctrl/Cmd+C to copy")}return}
  if(a==="del-inv-ask"){D.confirmDel=true;renderDrawer();return}
  if(a==="del-cancel"){D.confirmDel=false;renderDrawer();return}
  if(a==="del-inv"&&cur){const ids=S.entries.filter(x=>x.invoiceId===cur.id).map(x=>x.id);
    const ok=await write(async db=>{for(const id of ids){await db.doc("entries/"+id).update({invoiceId:null})}await db.doc("invoices/"+cur.id).delete()},"Invoice deleted");
    if(ok){S.drawer=null;renderDrawer()}return}
  if(a==="pdf"&&cur){const c2=await saveNotesFirst(cur);if(c2)await makePDF(c2,b);return}
  if(a==="edit-client"){S.drawer={type:"crm-edit",id:b.dataset.id,fresh:b.dataset.id?null:{status:"client",active:true}};renderDrawer();return}
  if(a==="save-settings"){const v=id=>$(id).value.trim();
    const lo=Math.max(0,Math.min(60,+v("#s-lo")||25))/100,hi=Math.max(lo*100,Math.min(60,+v("#s-hi")||30))/100;
    const doc={business:{name:v("#s-name"),address1:v("#s-a1"),address2:v("#s-a2"),phone:v("#s-phone"),email:v("#s-email"),website:v("#s-web")},
      bank:{bankName:v("#s-bank"),accountName:v("#s-acctname"),routing:v("#s-routing"),account:v("#s-acct")},apps:{cashapp:v("#s-cashapp"),venmo:v("#s-venmo"),zelle:v("#s-zelle")},cardLink:v("#s-card"),terms:v("#s-terms")||"Due on receipt",setAsideLow:lo,setAsideHigh:hi};
    await write(db=>db.doc("settings/main").set(Object.assign({},S.settings||{},doc)),"Settings saved");return}
  if(a==="change-pw"){demoOnly("Changing passwords");return}
  if(a==="logout"){try{sessionStorage.removeItem(SIGNED_KEY)}catch(err){}S.authed=false;S.ready=false;S.DB=null;S.me=null;S.users=null;S.drawer=null;history.replaceState(null,"",location.pathname);S.crmOpen=null;S.projOpen=null;render();return}
  if(a==="demo-cal"){demoOnly("Google Calendar sync");return}
  if(a==="demo-reset"){demoModal("Reset the demo data?","This clears everything you added or changed and puts back the original sample clients, invoices and expenses.",`<button class="btn danger-solid" data-act="demo-reset-go">Reset demo data</button><button class="btn" data-modal-close>Cancel</button>`);return}
  if(a==="demo-reset-go"){resetDemo();return}
  if(a==="export"){saveBlob(new Blob([JSON.stringify(S.DB,null,2)],{type:"application/json"}),"Jono CRM demo data "+iso(new Date())+".json");return}
  if(crmAction(a,b,e))return;
  if(projAction(a,b,e))return;
  if(extrasAction(a,b,e))return;
});

/* ---------- PDF ---------- */
function saveBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
const pdfName=inv=>`Invoice ${inv.number} - ${cname(inv.clientId)}.pdf`;
async function buildPdf(inv){
  const host=document.createElement("div");const L=layoutSheet(inv);host.style.cssText="position:fixed;left:-10000px;top:0;width:"+L.W+"px;background:#fff";host.innerHTML=sheetHTML(inv,L.W);document.body.appendChild(host);
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const canvas=await html2canvas(host.firstElementChild,{scale:2,backgroundColor:"#ffffff",useCORS:true,logging:false});
    const pdf=new window.jspdf.jsPDF({unit:"pt",format:"letter"});
    const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
    const imgH=canvas.height*pw/canvas.width;const data=canvas.toDataURL("image/jpeg",0.92);
    pdf.addImage(data,"JPEG",0,0,pw,imgH);let y=ph;while(imgH-y>2){pdf.addPage();pdf.addImage(data,"JPEG",0,-y,pw,imgH);y+=ph}
    return pdf.output("blob");
  }finally{host.remove()}
}
async function makePDF(inv,btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent="Building PDF…";
  const host=document.createElement("div");const L=layoutSheet(inv);host.style.cssText="position:fixed;left:-10000px;top:0;width:"+L.W+"px;background:#fff";host.innerHTML=sheetHTML(inv,L.W);document.body.appendChild(host);
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const canvas=await html2canvas(host.firstElementChild,{scale:2,backgroundColor:"#ffffff",useCORS:true,logging:false});
    const pdf=new window.jspdf.jsPDF({unit:"pt",format:"letter"});
    const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
    const imgH=canvas.height*pw/canvas.width;
    let y=0;const data=canvas.toDataURL("image/jpeg",0.95);
    pdf.addImage(data,"JPEG",0,0,pw,imgH);
    y=ph;while(imgH-y>2){pdf.addPage();pdf.addImage(data,"JPEG",0,-y,pw,imgH);y+=ph}
    const blob=pdf.output("blob");
    saveBlob(blob,pdfName(inv));toast("PDF downloaded")
  }catch(err){toast("Couldn't build the PDF. Try again.")}
  finally{host.remove();btn.disabled=false;btn.textContent=old}
}
/* =====================================================================
   CLIENTS (CRM): every current, past and potential client, with notes.
   A contact and a Ledger client are the same record (clients/<id>),
   so invoices and hours show up on the contact automatically.
   ===================================================================== */
const CRM_ST=[["prospect","Prospect","Someone you might pitch"],["lead","Lead","You're talking or quoting"],["client","Client","Doing paid work for them"],["past","Past client","No current work"],["dnc","Do not contact","Don't reach out"]];
const stLabel=k=>(CRM_ST.find(x=>x[0]===k)||[,"No status"])[1];
const ST_ORDER={client:0,lead:1,prospect:2,past:3,dnc:4};
const NOTE_KINDS=[["note","Note"],["call","Call"],["meeting","Meeting"],["email","Email"],["text","Text"]];
const SOURCES=["Referral","Past relationship","Website","Instagram","Facebook","LinkedIn","Google search","Fiverr","Cold outreach","Event / networking","CSV import"];
const SOCIALS=[["linkedin","LinkedIn"],["instagram","Instagram"],["facebook","Facebook"],["other","Other link"]];
const today=()=>iso(new Date());
const statusKey=c=>c.status||(c.active===false?"past":"client");
const href=u=>{u=String(u||"").trim();if(!u)return"";return /^https?:\/\//i.test(u)?u:"https://"+u};
const prettyUrl=u=>String(u||"").replace(/^https?:\/\//i,"").replace(/^www\./i,"").replace(/\/$/,"");
const telHref=p=>"tel:"+String(p||"").replace(/[^\d+]/g,"");
// US numbers always show as (123) 456-7890, however they were typed; anything else (extensions, international) is left as typed.
const fmtPhone=p=>{const raw=String(p||"").trim();let d=raw.replace(/\D/g,"");if(d.length===11&&d[0]==="1")d=d.slice(1);
  return d.length===10?"("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6):raw};
const pname=c=>[c.firstName,c.lastName].filter(Boolean).join(" ");
const PREFIXES=["Dr.","Mr.","Mrs.","Ms.","Miss","Mx.","Prof.","Rev.","Hon."];
const TITLES=["MD","DO","NP","PA-C","DC","DPM","DDS","DMD","OD","PharmD","PhD","DPT","PT","RN","BSN","APRN","CRNA","LAc","ND","LMT","LCSW","LPC","PsyD","CPA","Esq.","JD","MBA","Jr.","Sr.","II","III"];
// "Dr. Jane Doe, MD": the name with its prefix and title, for display
const fullName=c=>{const n=pname(c);if(!n)return"";return [c.prefix,n].filter(Boolean).join(" ")+(c.title?", "+c.title:"")};
const dname=c=>c.company||pname(c)||c.name||"Untitled";
S.crmSort=(()=>{try{return JSON.parse(localStorage.getItem("jcrm-sort"))||{key:"status",dir:1}}catch(e){return{key:"status",dir:1}}})();
S.crmOpen=null;S.crmEdit=false;

/* Records made before the contact fields existed get them filled in once, from what was there. */
async function migrateContacts(){
  const ops=[];
  Object.values(S.clients).forEach(c=>{
    if(c.company!==undefined)return;
    const p=(c.contacts||[]).find(x=>x&&(x.name||x.email||x.phone))||{};
    const parts=String(p.name||"").trim().split(/\s+/).filter(Boolean);
    const data={company:c.name||"",firstName:parts[0]||"",lastName:parts.slice(1).join(" "),
      email:c.email||p.email||"",email2:c.email2||"",phone:c.phone||"",cell:c.cell||p.phone||"",
      contacts:(c.contacts||[]).filter(x=>x!==p&&x&&(x.name||x.email||x.phone))};
    ops.push({op:"update",path:"clients/"+c.id,data});
  });
  if(!ops.length)return;
  try{await api("/api/data",{method:"POST",body:{ops}});applyLocal(ops);render()}catch(e){/* try again next load */}
}

function crmStats(id){
  const inv=S.invoices.filter(i=>i.clientId===id);
  const counted=inv.filter(i=>!["draft","check"].includes(statusOf(i)));
  const billed=r2(counted.reduce((t,i)=>t+(+i.total||0),0));
  const got=r2(counted.reduce((t,i)=>t+received(i),0));
  const owed=r2(inv.filter(i=>["sent","partial"].includes(statusOf(i))).reduce((t,i)=>t+balanceOf(i),0));
  const lastInv=inv.map(i=>i.issued||i.periodEnd||"").sort().pop()||"";
  const notes=S.notes.filter(n=>n.clientId===id);
  const lastAct=[lastInv,...notes.map(n=>n.date||""),...S.entries.filter(e=>e.clientId===id).map(e=>e.date||"")].sort().pop()||"";
  return{inv,billed,got,owed,lastInv,lastAct,noteCount:notes.length};
}
function ago(d){if(!d)return"—";const days=Math.round((parse(today())-parse(d))/864e5);
  if(days<=0)return days===0?"Today":fmtD(parse(d));if(days===1)return"Yesterday";if(days<7)return days+" days ago";return fmtDY(parse(d))}

/* ---------- navigation (#c/<id> so the browser's back button works) ---------- */
let navDepth=0; // in-app page visits, so Back never leaves the app
function openContact(id){if(id)navDepth++;location.hash=id?"c/"+encodeURIComponent(id):""}
function syncRoute(){
  const m=/^#c\/(.+)$/.exec(location.hash);const id=m?decodeURIComponent(m[1]):null;
  if(id!==S.crmOpen){S.crmOpen=id;S.crmEdit=id==="new";S.drawer=null;if(id&&S.tab!=="clients"){S.tab="clients"}render();window.scrollTo(0,0)}
}
window.addEventListener("hashchange",syncRoute);

/* ---------- list ---------- */
const COLS=[["company","Company / name"],["contact","Contact"],["status","Status"],["phone","Phone"],["email","Email"],["billed","Billed","r"],["owed","Owed","r"],["last","Last activity","r"]];
function viewClients(){
  if(S.crmOpen)return viewContact();
  const all=Object.values(S.clients);
  const inSet=(c,k)=>k==="all"||(k==="followup"?!!followUp(c):k==="active"?["prospect","lead","client"].includes(statusKey(c)):statusKey(c)===k);
  const filters=[["followup","Follow-up due"],["active","Active"],["client","Clients"],["lead","Leads"],["prospect","Prospects"],["past","Past"],["dnc","Do not contact"],["all","All"]];
  const q=S.crmQuery.trim().toLowerCase();
  let l=all.filter(c=>inSet(c,S.crmFilter));
  if(q)l=l.filter(c=>[c.name,c.company,c.prefix,c.firstName,c.lastName,c.title,c.billTo,c.industry,c.source,c.email,c.email2,c.phone,c.cell,c.website,c.address,...(c.contacts||[]).flatMap(x=>[x.name,x.email,x.phone,x.role])].filter(Boolean).join(" ").toLowerCase().includes(q));
  const rows=l.map(c=>({c,st:crmStats(c.id)}));
  const {key,dir}=S.crmSort;
  const val=({c,st})=>key==="company"?dname(c).toLowerCase():key==="contact"?pname(c).toLowerCase():key==="status"?ST_ORDER[statusKey(c)]:key==="phone"?String(c.phone||c.cell||"").replace(/\D/g,""):key==="email"?(c.email||"").toLowerCase():key==="billed"?st.billed:key==="owed"?st.owed:st.lastAct||"";
  rows.sort((a,b)=>{const x=val(a),y=val(b);
    const empty=v=>v===""||v==null;if(empty(x)!==empty(y))return empty(x)?1:-1; // blanks always last
    const r=typeof x==="number"?x-y:String(x).localeCompare(String(y));
    return (r*dir)||(b.st.lastAct||"").localeCompare(a.st.lastAct||"")||dname(a.c).localeCompare(dname(b.c))});
  const owed=all.reduce((t,c)=>t+crmStats(c.id).owed,0);
  return `
  <section class="panel">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <h2 style="margin:0">Clients &amp; contacts</h2>
      <div class="row" style="gap:8px"><button class="btn" data-act="csv-open">Import CSV</button><button class="btn primary" data-act="crm-new">+ New contact</button></div>
    </div>
    <div class="field" style="margin-bottom:12px"><label for="crm-q" class="sr">Search</label><input id="crm-q" type="search" placeholder="Search names, companies, email, phone…" value="${esc(S.crmQuery)}" data-keep="no" autocomplete="off"></div>
    <div class="seg seg-wrap" id="crm-filter">${filters.map(([k,t])=>`<button data-f="${k}" aria-pressed="${S.crmFilter===k}">${t} <span class="cnt">${all.filter(c=>inSet(c,k)).length}</span></button>`).join("")}</div>
  </section>
  ${owed>0.005?`<div class="notice">Clients owe you <b class="num">${money(owed)}</b> on open invoices.</div>`:""}
  <section class="panel" style="padding:6px 10px">
    <div class="crm-head" role="row">${COLS.map(([k,t,r])=>`<button class="sorth ${r||""}" data-sort="${k}" aria-sort="${key===k?(dir>0?"ascending":"descending"):"none"}">${t}<span class="arr">${key===k?(dir>0?"▲":"▼"):""}</span></button>`).join("")}</div>
    <div class="list">${rows.length?rows.map(({c,st})=>`<button class="crow" data-act="crm-open" data-id="${esc(c.id)}">
      <span class="who"><b>${esc(dname(c))}</b>${S.crmFilter==="followup"&&followUp(c)?`<span class="small fu">${esc(followUp(c).why)}</span>`:`<span class="muted small">${esc(c.industry||"")}</span>`}</span>
      <span class="small ell">${c.company&&pname(c)?esc(fullName(c)):`<span class="muted">—</span>`}</span>
      <span><span class="pill st-${statusKey(c)}">${esc(stLabel(statusKey(c)))}</span></span>
      <span class="small ell num">${esc(fmtPhone(c.phone||c.cell))||`<span class="muted">—</span>`}</span>
      <span class="small ell">${esc(c.email||"")||`<span class="muted">—</span>`}</span>
      <span class="num r">${st.billed?money0(st.billed):`<span class="muted">—</span>`}</span>
      <span class="num r ${st.owed>0.005?"owed":""}">${st.owed>0.005?money0(st.owed):`<span class="muted">—</span>`}</span>
      <span class="small r muted">${esc(ago(st.lastAct))}</span></button>`).join(""):
      `<p class="muted" style="padding:10px 6px">${q?"No one matches that search.":"Nobody here yet. Add a contact or import a CSV to get started."}</p>`}</div>
  </section>`;
}

/* ---------- contact page ---------- */
function viewContact(){
  const isNew=S.crmOpen==="new";
  const c=isNew?{status:"prospect",active:false}:S.clients[S.crmOpen];
  if(!c)return `<a class="back" href="#">← All contacts</a><section class="panel"><p class="muted">That contact doesn't exist anymore.</p></section>`;
  const back=`<a class="back" href="#">← All contacts</a>`;
  if(S.crmEdit)return back+`<section class="panel"><h2>${isNew?"New contact":"Edit details"}</h2>${contactForm(S.crmForm||c,"page")}</section>`;
  const st=crmStats(c.id),sk=statusKey(c);
  const notes=S.notes.filter(n=>n.clientId===c.id).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.createdAt||"").localeCompare(a.createdAt||""));
  const D=S.cview||(S.cview={});if(D.id!==c.id){for(const k in D)delete D[k];D.id=c.id}
  const ed=D.noteEdit?S.notes.find(n=>n.id===D.noteEdit):null;
  const socials=SOCIALS.filter(([k])=>c.socials&&c.socials[k]);
  const field=(label,v,cls="")=>`<div class="cf ${cls}"><div class="k">${label}</div><div class="v">${v||`<span class="muted">—</span>`}</div></div>`;
  const rems=S.reminders.filter(r=>r.clientId===c.id&&!r.done).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  const doneCount=S.reminders.filter(r=>r.clientId===c.id&&r.done).length;
  const invs=sortInv(st.inv);
  const extras=[c.industry&&`<span><b>Industry</b> ${esc(c.industry)}</span>`,c.source&&`<span><b>Source</b> ${esc(c.source)}</span>`,
    socials.length&&`<span>${socials.map(([k,t])=>`<a href="${esc(href(c.socials[k]))}" target="_blank" rel="noopener">${t}</a>`).join(" · ")}</span>`].filter(Boolean);
  const people=(c.contacts||[]).filter(x=>x&&(x.name||x.email||x.phone));
  return back+`
  <section class="panel ctop">
    <div class="ctop-h">
      <div><h1>${esc(c.company?dname(c):fullName(c)||dname(c))}</h1>${c.company&&pname(c)?`<div class="muted">${esc(fullName(c))}</div>`:""}</div>
      <div class="row" style="gap:8px;align-items:center">
        <label class="sr" for="c-status">Status</label>
        <select id="c-status" class="stsel st-${sk}" data-keep="no" disabled title="Click Edit details to change">${CRM_ST.map(([k,t])=>`<option value="${k}" ${sk===k?"selected":""}>${t}</option>`).join("")}</select>
        <button class="btn" data-act="crm-edit">Edit details</button>
      </div>
    </div>
    <div class="cgrid">
      ${field("Prefix",esc(c.prefix))}${field("First name",esc(c.firstName))}${field("Last name",esc(c.lastName))}
      ${field("Title",esc(c.title))}${field("Company",esc(c.company))}
      ${field("Website",c.website?`<a href="${esc(href(c.website))}" target="_blank" rel="noopener">${esc(prettyUrl(c.website))}</a>`:"")}
      ${field("Business address",c.address?`<span style="white-space:pre-line">${esc(c.address)}</span>`:"","wide")}
      ${field("Email",c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:"")}
      ${field("Secondary email",c.email2?`<a href="mailto:${esc(c.email2)}">${esc(c.email2)}</a>`:"")}
      ${field("Phone",c.phone?`<a href="${esc(telHref(c.phone))}">${esc(fmtPhone(c.phone))}</a>`:"")}
      ${field("Cell phone",c.cell?`<a href="${esc(telHref(c.cell))}">${esc(fmtPhone(c.cell))}</a>`:"")}
    </div>
    ${extras.length?`<div class="cextra small">${extras.join("")}</div>`:""}
    ${people.length?`<div class="cextra small"><b>Other people</b> ${people.map(x=>esc([x.name,x.role&&"("+x.role+")",x.email,x.phone&&fmtPhone(x.phone)].filter(Boolean).join(" ")) ).join(" · ")}</div>`:""}
  </section>
  <div class="crm-grid">
    <section class="panel">
      <h2>Notes</h2>
      <form id="f-note" autocomplete="off">
        <div class="row">
          <div class="field w-md"><label for="n-date">Date</label><input id="n-date" type="date" value="${esc(ed?ed.date:today())}" data-keep="no"></div>
          <div class="field w-md"><label for="n-kind">Type</label><select id="n-kind">${NOTE_KINDS.map(([k,t])=>`<option value="${k}" ${(ed?ed.kind:"note")===k?"selected":""}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="field" style="margin-top:8px"><label for="n-text">${ed?"Edit note":"What happened?"}</label><textarea id="n-text" rows="3" placeholder="e.g. Called about the second payment. Check coming Friday." data-keep="no">${esc(ed?ed.text:(D.draftNote||""))}</textarea></div>
        <div class="actions" style="margin-top:8px">${ed?`<button class="btn primary" type="submit">Save changes</button><button class="btn ghost" type="button" data-act="note-cancel">Cancel</button>`:`<button class="btn primary" type="submit">Add note</button>`}</div>
      </form>
      <div class="timeline">${notes.length?notes.map(n=>`<div class="note${D.noteEdit===n.id?" editing":""}">
        <div class="note-h"><span class="chip">${esc((NOTE_KINDS.find(k=>k[0]===n.kind)||[,"Note"])[1])}</span><span class="muted small">${esc(n.date?fmtDY(parse(n.date)):"")}</span>
          <span class="x"><button class="btn sm ghost" data-act="note-edit" data-id="${esc(n.id)}">Edit</button>${D.noteDel===n.id?`<button class="btn sm danger" data-act="note-del" data-id="${esc(n.id)}">Delete?</button>`:`<button class="btn sm ghost" data-act="note-del-ask" data-id="${esc(n.id)}" aria-label="Delete note">✕</button>`}</span></div>
        <p>${esc(n.text)}</p></div>`).join(""):`<p class="muted small">No notes yet. Log calls, meetings and anything worth remembering here.</p>`}</div>
    </section>
    <section class="panel">
      <h2>Reminders</h2>
      <form id="f-rem" autocomplete="off">
        <div class="row">
          <div class="field w-md"><label for="r-date">Date</label><input id="r-date" type="date" value="${esc(D.remDate||iso(addDays(new Date(),3)))}" data-keep="no"></div>
          <div class="field w-sm"><label for="r-time">Time</label><input id="r-time" type="time" value="${esc(D.remTime??"10:00")}" data-keep="no"></div>
        </div>
        <div class="field" style="margin-top:8px"><label for="r-text">Reminder</label><input id="r-text" value="${esc(D.remText??("Follow up with "+(pname(c)||dname(c))))}" data-keep="no"></div>
        <div class="actions" style="margin-top:8px"><button class="btn accent" type="submit">Add to Google Calendar</button></div>
        <p class="muted small" style="margin:8px 0 0">Saves the reminder here. In a live build it also opens Google Calendar so you get an alert.</p>
      </form>
      <div class="timeline">${rems.length?rems.map(r=>`<div class="note rem${r.date<today()?" overdue":""}">
        <div class="note-h"><b class="small">${esc(fmtDY(parse(r.date)))}${r.time?" · "+esc(fmtTime(r.time)):""}</b>
          <span class="x"><button class="btn sm ghost" data-act="demo-cal">Calendar</button><button class="btn sm ghost" data-act="rem-done" data-id="${esc(r.id)}">Done</button></span></div>
        <p>${esc(r.text)}</p></div>`).join(""):`<p class="muted small">No upcoming reminders.</p>`}
        ${doneCount?`<p class="muted small" style="margin-top:8px">${doneCount} completed</p>`:""}</div>
    </section>
  </div>
  <div class="stats mini">
    <div class="stat"><div class="k">Billed</div><div class="v num">${money0(st.billed)}</div><div class="s">${st.inv.length} invoice${st.inv.length===1?"":"s"}</div></div>
    <div class="stat"><div class="k">Received</div><div class="v num">${money0(st.got)}</div></div>
    <div class="stat ${st.owed>0.005?"key":""}"><div class="k">Owed</div><div class="v num">${money0(st.owed)}</div></div>
    <div class="stat"><div class="k">Last activity</div><div class="v sm">${esc(ago(st.lastAct))}</div></div>
  </div>
  ${(()=>{const pl=projList().filter(x=>x.clientId===c.id).sort((a,b)=>((a.status==="done")-(b.status==="done"))||(a.due||"9999").localeCompare(b.due||"9999"));
    return `<section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Projects</h2><button class="btn sm" data-act="proj-new" data-client="${esc(c.id)}">+ New project</button></div>
    <div class="list">${pl.length?pl.map(x=>projRow(x,false)).join(""):`<p class="muted small">No projects yet.</p>`}</div></section>`})()}
  ${viewDeals(c)}
  <details class="panel fold" id="c-inv" ${D.invOpen?"open":""}>
    <summary><h2>Invoices &amp; billing</h2><span class="muted small">${st.inv.length} invoice${st.inv.length===1?"":"s"}${st.owed>0.005?` · <b class="owed">${money(st.owed)} owed</b>`:""}</span><span class="chev" aria-hidden="true">▾</span></summary>
    <div class="fold-b">
      <dl class="kv" style="margin-bottom:12px">
        <dt>Bill to</dt><dd>${esc(c.billTo||dname(c))}</dd>
        <dt>Rate</dt><dd>${c.rate?money(c.rate)+"/hr":"Flat fee"}</dd>
        <dt>Log Time</dt><dd>${c.active!==false?"Shown in the client list":"Hidden"}</dd>
      </dl>
      ${c.active!==false?`<div style="margin-bottom:10px"><button class="btn sm accent" data-act="crm-log" data-id="${esc(c.id)}">Log time for ${esc(dname(c))}</button></div>`:""}
      <div class="list">${invs.length?invs.map(i=>`<button class="inv" data-act="open-inv" data-id="${esc(i.id)}">
        <span class="no num muted">#${esc(i.number)}</span><span class="who"><b>${esc(range(parse(i.periodStart),parse(i.periodEnd)))}</b></span>
        <span class="pill ${statusOf(i)}">${STATUS_LABEL[statusOf(i)]}</span><span class="amt num">${money(i.total)}</span></button>`).join(""):`<p class="muted small">No invoices yet.</p>`}</div>
    </div>
  </details>
  <div class="row" style="justify-content:flex-end">${D.confirmDel?(()=>{const busy=st.inv.length||S.entries.some(e=>e.clientId===c.id);
    return busy?`<span class="notice bad">${esc(dname(c))} has invoices or logged hours, so it can't be deleted. Set the status to “Past client” instead.</span><button class="btn sm" data-act="crm-del-cancel">OK</button>`
    :`<span class="notice bad">Delete ${esc(dname(c))} and its notes and reminders? This can't be undone.</span><button class="btn sm danger" data-act="crm-del">Delete</button><button class="btn sm" data-act="crm-del-cancel">Keep</button>`})()
    :`<button class="btn sm danger ghost" data-act="crm-del-ask">Delete contact</button>`}</div>`;
}

function gcalUrl(r,c,link){
  const d=parse(r.date);let dates;
  const fmt=x=>""+x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate());
  if(r.time){const [h,m]=r.time.split(":").map(Number);const s=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,m),e=new Date(s.getTime()+30*60000);
    const t=x=>fmt(x)+"T"+pad(x.getHours())+pad(x.getMinutes())+"00";dates=t(s)+"/"+t(e)}
  else dates=fmt(d)+"/"+fmt(addDays(d,1));
  const info=[dname(c),c.company&&fullName(c),c.phone&&"Phone: "+fmtPhone(c.phone),c.cell&&"Cell: "+fmtPhone(c.cell),c.email&&"Email: "+c.email].filter(Boolean);
  const details=info.join("\n")+"\n\nOpen in Jono CRM: "+(link||location.origin+"/#c/"+encodeURIComponent(c.id));
  const p=new URLSearchParams({action:"TEMPLATE",text:r.text,dates,details,ctz:Intl.DateTimeFormat().resolvedOptions().timeZone||"America/New_York"});
  const acct=calAccount();if(acct)p.set("authuser",acct);
  return "https://calendar.google.com/calendar/render?"+p.toString();
}
function calAccount(){const s=S.settings||{};return ((s.calendar||{})[S.me&&S.me.username]||"").trim()}

/* ---------- the edit form (page, or a quick drawer from Log Time) ---------- */
function contactForm(c,where){
  c=Object.assign({contacts:[],socials:{}},c);const sk=statusKey(c);
  const industries=[...new Set(Object.values(S.clients).map(x=>x.industry).filter(Boolean))].sort();
  const people=(c.contacts&&c.contacts.length)?c.contacts:[];
  // A dropdown with a blank choice; a value from an import that isn't in the list is kept as its own choice.
  const pick=(id,label,opts,v)=>{const l=v&&!opts.includes(v)?[v,...opts]:opts;return `<div class="field w-sm"><label for="${id}">${label}</label><select id="${id}"><option value=""></option>${l.map(o=>`<option ${o===v?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`};
  const inp=(id,label,v,attrs="",cls="grow")=>`<div class="field ${cls}"><label for="${id}">${label}</label><input id="${id}" value="${esc(v||"")}" ${attrs}></div>`;
  return `<form id="f-crm" data-where="${where}" autocomplete="off" class="stack">
    <div class="row">${pick("k-prefix","Prefix",PREFIXES,c.prefix)}${inp("k-first","First name",c.firstName)}${inp("k-last","Last name",c.lastName)}${pick("k-title","Title",TITLES,c.title)}</div>
    <div class="row">${inp("k-company","Company",c.company)}
      <div class="field w-md"><label for="k-status">Status</label><select id="k-status">${CRM_ST.map(([k,t])=>`<option value="${k}" ${sk===k?"selected":""}>${t}</option>`).join("")}</select></div></div>
    <div class="field"><label for="k-addr">Business address</label><textarea id="k-addr" rows="2" style="min-height:0">${esc(c.address||"")}</textarea></div>
    <div class="row">${inp("k-web","Website",c.website,'inputmode="url" placeholder="example.com"')}${inp("k-email","Email",c.email,'type="email" inputmode="email"')}${inp("k-email2","Secondary email",c.email2,'type="email" inputmode="email"')}</div>
    <div class="row">${inp("k-phone","Phone",c.phone,'inputmode="tel"')}${inp("k-cell","Cell phone",c.cell,'inputmode="tel"')}</div>
    <details class="more" ${where==="page"?"open":""}><summary>More details</summary><div class="stack" style="margin-top:12px">
      <div class="row">
        <div class="field grow"><label for="k-ind">Industry</label><input id="k-ind" list="ind-list" value="${esc(c.industry||"")}" placeholder="e.g. Medical, Consulting"><datalist id="ind-list">${industries.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div>
        <div class="field grow"><label for="k-src">Lead / referral source</label><input id="k-src" list="src-list" value="${esc(c.source||"")}"><datalist id="src-list">${SOURCES.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div>
      </div>
      <div class="row">${SOCIALS.map(([k,t])=>`<div class="field grow" style="flex-basis:140px"><label for="k-so-${k}">${t}</label><input id="k-so-${k}" value="${esc((c.socials||{})[k]||"")}" placeholder="link"></div>`).join("")}</div>
      <h3 style="margin:4px 0 0">Other people</h3>
      <div id="k-people" class="stack">${people.map((x,i)=>`<div class="row person-row">
        <div class="field grow" style="flex-basis:140px"><label for="kp-n-${i}">Name</label><input id="kp-n-${i}" class="kp-n" value="${esc(x.name||"")}"></div>
        <div class="field w-md"><label for="kp-r-${i}">Role</label><input id="kp-r-${i}" class="kp-r" value="${esc(x.role||"")}"></div>
        <div class="field grow" style="flex-basis:160px"><label for="kp-e-${i}">Email</label><input id="kp-e-${i}" class="kp-e" value="${esc(x.email||"")}"></div>
        <div class="field w-md"><label for="kp-p-${i}">Phone</label><input id="kp-p-${i}" class="kp-p" value="${esc(x.phone||"")}"></div>
        <button class="btn sm ghost" type="button" data-act="kp-del" data-i="${i}" aria-label="Remove person">✕</button></div>`).join("")}</div>
      <div><button class="btn sm" type="button" data-act="kp-add">+ Add person</button></div>
      <h3 style="margin:4px 0 0">Invoicing</h3>
      <div class="row">
        ${inp("k-billto","Bill-to name (on invoices)",c.billTo,`placeholder="${esc(c.company||"Full business name")}"`)}
        <div class="field w-sm"><label for="k-rate">Hourly rate ($)</label><input id="k-rate" type="number" step="1" min="0" value="${esc(c.rate||"")}" placeholder="Flat fee"></div>
      </div>
      <div class="row">${inp("k-greet","Invoice email greeting",c.contactName,'placeholder="First name"',"w-md")}${inp("k-line","Line under bill-to (optional)",c.contact,'placeholder="Email or address"')}</div>
      <label class="row small" style="gap:8px"><input id="k-active" type="checkbox" ${c.active!==false?"checked":""}> Show in the Log Time client list</label>
    </div></details>
    <div class="actions"><button class="btn primary" type="submit">${c.id?"Save changes":"Add contact"}</button><button class="btn ghost" type="button" data-act="crm-cancel">Cancel</button></div>
  </form>`;
}
function gatherCrm(){
  const v=id=>{const el=$(id);return el?el.value.trim():""};
  const contacts=[...document.querySelectorAll("#k-people .person-row")].map(r=>({name:r.querySelector(".kp-n").value.trim(),role:r.querySelector(".kp-r").value.trim(),email:r.querySelector(".kp-e").value.trim(),phone:r.querySelector(".kp-p").value.trim()}));
  return{prefix:v("#k-prefix"),title:v("#k-title"),firstName:v("#k-first"),lastName:v("#k-last"),company:v("#k-company"),status:v("#k-status"),address:v("#k-addr"),website:v("#k-web"),email:v("#k-email"),email2:v("#k-email2"),phone:v("#k-phone"),cell:v("#k-cell"),
    industry:v("#k-ind"),source:v("#k-src"),socials:Object.fromEntries(SOCIALS.map(([k])=>[k,v("#k-so-"+k)]).filter(x=>x[1])),contacts,
    billTo:v("#k-billto"),rate:+v("#k-rate")||0,contactName:v("#k-greet"),contact:v("#k-line"),active:$("#k-active")?$("#k-active").checked:true};
}
function newId(base,taken){const slug=String(base||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||uid();let id=slug,n=2;while(S.clients[id]||(taken&&taken.has(id)))id=slug+"-"+(n++);return id}
async function saveCrm(form){
  const where=form.dataset.where;const f=gatherCrm();
  f.contacts=f.contacts.filter(x=>x.name||x.email||x.phone).map(x=>Object.assign(x,{phone:fmtPhone(x.phone)}));
  f.phone=fmtPhone(f.phone);f.cell=fmtPhone(f.cell);
  const display=f.company||[f.firstName,f.lastName].filter(Boolean).join(" ");
  if(!display){toast("Add a name or company.");$("#k-first").focus();return}
  f.name=display;
  if(!f.contactName&&f.firstName)f.contactName=f.firstName;
  if(!f.billTo)f.billTo=display;
  const editId=where==="page"?(S.crmOpen==="new"?"":S.crmOpen):"";
  const id=editId||newId(display);
  const prev=S.clients[id]||{};
  const doc=Object.assign({},prev,f,{order:prev.order??Object.keys(S.clients).length,createdAt:prev.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
  delete doc.id;
  const ok=await write(db=>db.doc("clients/"+id).set(doc),editId?"Saved":"Added "+display);
  if(!ok)return;
  if(where==="drawer"){S.drawer=null;renderDrawer();setTimeout(()=>{const el=$("#e-client");if(el&&doc.active){el.value=id;fillProjects(id,"")}},50);return}
  S.crmEdit=false;S.crmForm=null;
  if(!editId)openContact(id);else{render();window.scrollTo(0,0)}
}
function renderCrmDrawer(L,d){
  if(d.type!=="crm-edit"){S.drawer=null;L.innerHTML="";return}
  L.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="New contact" style="width:min(100%,680px)">
    <div class="drawer-h"><h2>${d.id?"Edit contact":"New client"}</h2><button class="btn sm ghost" data-act="close">✕ Close</button></div>
    <div class="drawer-b">${contactForm(d.form||(d.id?S.clients[d.id]:Object.assign({},d.fresh||{})),"drawer")}</div></aside>`;
}

/* ---------- CSV import ---------- */
const CSV_FIELDS=[["","Don't import"],["fullName","Full name (split into first + last)"],["prefix","Prefix (Dr., Mr., Ms.…)"],["firstName","First name"],["title","Title (MD, DO, NP…)"],["lastName","Last name"],["company","Company"],["status","Status"],
  ["address","Business address"],["street","Street"],["city","City"],["state","State"],["zip","ZIP / postal code"],["website","Website"],["email","Email"],["email2","Secondary email"],
  ["phone","Phone"],["cell","Cell phone"],["industry","Industry"],["source","Lead source"],["linkedin","LinkedIn"],["instagram","Instagram"],["facebook","Facebook"],["note","Note (added to their notes)"]];
function guessField(h){
  const s=String(h||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const rules=[[/^(full )?name$|^contact( name)?$|^full name$/,"fullName"],[/prefix|salutation|honorific/,"prefix"],[/credential|suffix|degree/,"title"],[/first/,"firstName"],[/last|surname/,"lastName"],[/company|organi[sz]ation|business( name)?|account( name)?/,"company"],
    [/status|stage|lifecycle|type/,"status"],[/(e ?mail|email).*(2|second|secondary|other|alt|personal)|^(second|secondary|other|alt)\w* e ?mail/,"email2"],[/e ?mail/,"email"],
    [/cell|mobile/,"cell"],[/phone|tel/,"phone"],[/web|url|site/,"website"],[/street|address( line)? ?1?$|^address$/,"street"],[/city|town/,"city"],[/state|province|region/,"state"],
    [/zip|postal|post code/,"zip"],[/industry|sector/,"industry"],[/source|referr|lead/,"source"],[/linkedin/,"linkedin"],[/instagram/,"instagram"],[/facebook/,"facebook"],[/note|comment|description/,"note"]];
  for(const [re,f] of rules)if(re.test(s))return f;return "";
}
function parseCSV(text){
  text=text.replace(/^﻿/,"");const rows=[];let row=[],cell="",q=false;
  const delim=(()=>{const first=text.split(/\r?\n/)[0]||"";const c={",":0,";":0,"\t":0};for(const ch of first)if(ch in c)c[ch]++;return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]})();
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;else if(ch===delim){row.push(cell);cell=""}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(x=>x.trim()!==""))rows.push(row);row=[]}
    else cell+=ch}
  row.push(cell);if(row.some(x=>x.trim()!==""))rows.push(row);
  return rows;
}
function statusFrom(v){const s=String(v||"").toLowerCase();if(!s)return"";
  if(/do ?not|dnc|unsub|opt.?out/.test(s))return"dnc";if(/past|former|inactive|churn/.test(s))return"past";if(/client|customer|won|active/.test(s))return"client";if(/lead|opportun|qualified/.test(s))return"lead";if(/prospect|subscriber|new/.test(s))return"prospect";return""}
function csvBuild(){
  const C=S.csv;const map=C.map;const out=[];const taken=new Set();
  const exEmails=new Set(Object.values(S.clients).flatMap(c=>[c.email,c.email2]).filter(Boolean).map(x=>x.toLowerCase()));
  const exNames=new Set(Object.values(S.clients).map(c=>(dname(c)+"|"+pname(c)).toLowerCase()));
  let dup=0,empty=0;
  C.rows.forEach(r=>{
    const g=k=>{const i=map.indexOf(k);return i<0?"":String(r[i]??"").trim()};
    const all=k=>map.map((m,i)=>m===k?String(r[i]??"").trim():"").filter(Boolean);
    let first=g("firstName"),last=g("lastName");
    if(!first&&!last&&g("fullName")){const p=g("fullName").split(/\s+/);first=p[0]||"";last=p.slice(1).join(" ")}
    const company=g("company");
    const cityLine=[g("city"),[g("state"),g("zip")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const address=g("address")||[g("street"),cityLine].filter(Boolean).join("\n");
    const rec={prefix:g("prefix"),title:g("title"),firstName:first,lastName:last,company,address,website:g("website"),email:g("email"),email2:g("email2"),phone:fmtPhone(g("phone")),cell:fmtPhone(g("cell")),industry:g("industry"),source:g("source")||"CSV import",
      socials:Object.fromEntries(["linkedin","instagram","facebook"].map(k=>[k,g(k)]).filter(x=>x[1])),contacts:[]};
    rec.status=statusFrom(g("status"))||C.defStatus;
    const display=company||[first,last].filter(Boolean).join(" ")||rec.email;
    if(!display){empty++;return}
    const isDup=(rec.email&&exEmails.has(rec.email.toLowerCase()))||exNames.has((display+"|"+[first,last].filter(Boolean).join(" ")).toLowerCase());
    if(isDup&&C.skipDup){dup++;return}
    const id=newId(display,taken);taken.add(id);
    Object.assign(rec,{name:display,billTo:company||display,contactName:first,contact:"",rate:0,active:rec.status==="client",order:Object.keys(S.clients).length+out.length,createdAt:new Date().toISOString(),importedAt:new Date().toISOString()});
    out.push({id,rec,notes:all("note")});
  });
  return{out,dup,empty};
}
function renderCsvDrawer(L){
  const C=S.csv;
  let body;
  if(!C.rows){
    body=`<p>Pick a CSV file exported from a spreadsheet, HubSpot, Outlook or anywhere else. The first row should be the column names.</p>
      <div class="drop"><input id="csv-file" type="file" accept=".csv,text/csv,.txt"><p class="muted small" style="margin:8px 0 0">Nothing is saved until you review the matches and click Import.</p></div>
      ${C.error?`<div class="notice bad">${esc(C.error)}</div>`:""}`;
  }else{
    const b=csvBuild();
    body=`<div class="notice"><b>${esc(C.fileName)}</b>: ${C.rows.length} row${C.rows.length===1?"":"s"}, ${C.header.length} column${C.header.length===1?"":"s"}. Match each column to a field, or leave it as “Don't import”.</div>
      <div class="maptable">${C.header.map((h,i)=>{const samples=C.rows.slice(0,3).map(r=>r[i]).filter(x=>x&&x.trim());return `<div class="maprow">
        <div><b>${esc(h||"(no name)")}</b><div class="muted small ell">${samples.length?samples.map(esc).join(" · "):"(empty)"}</div></div>
        <span class="arrow" aria-hidden="true">→</span>
        <select data-col="${i}" aria-label="Field for ${esc(h)}">${CSV_FIELDS.map(([k,t])=>`<option value="${k}" ${C.map[i]===k?"selected":""}>${t}</option>`).join("")}</select></div>`}).join("")}</div>
      <div class="row" style="margin-top:14px">
        <div class="field w-md"><label for="csv-status">Status for everyone${C.map.includes("status")?" (when the status column is blank)":""}</label><select id="csv-status">${CRM_ST.map(([k,t])=>`<option value="${k}" ${C.defStatus===k?"selected":""}>${t}</option>`).join("")}</select></div>
        <label class="row small" style="gap:8px;align-self:center"><input type="checkbox" id="csv-dup" ${C.skipDup?"checked":""}> Skip people who are already in your contacts (same email or name)</label>
      </div>
      <h3 style="margin-top:16px">Preview</h3>
      ${b.out.length?`<div class="prev">${b.out.slice(0,6).map(({rec})=>`<div class="prevrow"><b>${esc(rec.name)}</b><span class="muted small">${esc([rec.company&&[rec.firstName,rec.lastName].filter(Boolean).join(" "),rec.email,rec.phone||rec.cell].filter(Boolean).join(" · "))}</span><span class="pill st-${rec.status}">${esc(stLabel(rec.status))}</span></div>`).join("")}${b.out.length>6?`<p class="muted small">…and ${b.out.length-6} more</p>`:""}</div>`:`<p class="muted small">No rows to import yet. Match at least a name, company or email column.</p>`}
      <p class="small">${b.out.length} new contact${b.out.length===1?"":"s"} will be added${b.dup?`, ${b.dup} already in your contacts will be skipped`:""}${b.empty?`, ${b.empty} row${b.empty===1?"":"s"} with no name, company or email will be skipped`:""}.</p>
      <div class="actions"><button class="btn primary" data-act="csv-import" ${b.out.length?"":"disabled"}>Import ${b.out.length} contact${b.out.length===1?"":"s"}</button><button class="btn ghost" data-act="csv-reset">Choose a different file</button></div>`;
  }
  L.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Import contacts" style="width:min(100%,760px)">
    <div class="drawer-h"><h2>Import contacts from CSV</h2><button class="btn sm ghost" data-act="close">✕ Close</button></div>
    <div class="drawer-b">${body}</div></aside>`;
  const f=$("#csv-file");if(f)f.addEventListener("change",async()=>{const file=f.files[0];if(!file)return;
    try{const rows=parseCSV(await file.text());if(rows.length<2)throw new Error("That file has no rows under the header.");
      const header=rows[0].map(h=>h.trim());const w=header.length;
      S.csv=Object.assign(S.csv,{fileName:file.name,header,rows:rows.slice(1).map(r=>{const x=r.slice(0,w);while(x.length<w)x.push("");return x}),map:header.map(guessField),error:null});
      // Don't map two columns to the same single field (except notes)
      const seen=new Set();S.csv.map=S.csv.map.map(k=>{if(!k||k==="note")return k;if(seen.has(k))return"";seen.add(k);return k});
    }catch(err){S.csv.error=err.message||"Couldn't read that file."}
    renderDrawer()});
  L.querySelectorAll("select[data-col]").forEach(s=>s.addEventListener("change",()=>{S.csv.map[+s.dataset.col]=s.value;renderDrawer()}));
  const ds=$("#csv-status");if(ds)ds.addEventListener("change",()=>{S.csv.defStatus=ds.value;renderDrawer()});
  const dp=$("#csv-dup");if(dp)dp.addEventListener("change",()=>{S.csv.skipDup=dp.checked;renderDrawer()});
}
async function csvImport(btn){
  const {out}=csvBuild();if(!out.length)return;btn.disabled=true;btn.textContent="Importing…";
  const ops=[];out.forEach(({id,rec,notes})=>{ops.push({op:"set",path:"clients/"+id,data:rec});
    notes.forEach(t=>ops.push({op:"set",path:"notes/"+uid()+Math.random().toString(36).slice(2,5),data:{clientId:id,date:today(),kind:"note",text:t,createdAt:new Date().toISOString()}}))});
  let done=0;
  try{for(let i=0;i<ops.length;i+=400){const chunk=ops.slice(i,i+400);await api("/api/data",{method:"POST",body:{ops:chunk}});applyLocal(chunk);done+=chunk.length}
    S.drawer=null;S.csv=null;S.crmFilter="all";render();toast("Imported "+out.length+" contact"+(out.length===1?"":"s"));
  }catch(e){toast("Import stopped: "+e.message+(done?" (some contacts were added)":""));btn.disabled=false;btn.textContent="Try again";if(done)render()}
}

/* ---------- events ---------- */
function crmAction(a,b){
  const D=S.cview||{};
  if(a==="crm-new"){S.crmForm=null;openContact("new");return true}
  if(a==="crm-open"){openContact(b.dataset.id);return true}
  if(a==="crm-edit"){S.crmEdit=true;S.crmForm=null;render();window.scrollTo(0,0);setTimeout(()=>{const n=$("#k-first");if(n)n.focus()},30);return true}
  if(a==="crm-cancel"){if(S.drawer){S.drawer=null;renderDrawer();return true}S.crmForm=null;if(S.crmOpen==="new")openContact("");else{S.crmEdit=false;render()}return true}
  if(a==="kp-add"||a==="kp-del"){const f=gatherCrm();if(a==="kp-add")f.contacts.push({});else f.contacts.splice(+b.dataset.i,1);
    if(S.drawer&&S.drawer.type==="crm-edit"){S.drawer.form=f;renderDrawer()}else{S.crmForm=f;render()}
    if(a==="kp-add"){const rows=document.querySelectorAll("#k-people .kp-n");const last=rows[rows.length-1];if(last)last.focus()}return true}
  if(a==="note-edit"){D.noteEdit=b.dataset.id;D.noteDel=null;render();const t=$("#n-text");if(t){t.focus();t.scrollIntoView({block:"center",behavior:"smooth"})}return true}
  if(a==="note-cancel"){D.noteEdit=null;render();return true}
  if(a==="note-del-ask"){D.noteDel=b.dataset.id;render();return true}
  if(a==="note-del"){write(db=>db.doc("notes/"+b.dataset.id).delete(),"Note deleted").then(()=>{D.noteDel=null;render()});return true}
  if(a==="rem-done"){write(db=>db.doc("reminders/"+b.dataset.id).update({done:true,doneAt:new Date().toISOString()}),"Marked done");return true}
  if(a==="crm-del-ask"){D.confirmDel=true;render();return true}
  if(a==="crm-del-cancel"){D.confirmDel=false;render();return true}
  if(a==="crm-del"){const id=S.crmOpen;const ns=S.notes.filter(n=>n.clientId===id).map(n=>"notes/"+n.id).concat(S.reminders.filter(r=>r.clientId===id).map(r=>"reminders/"+r.id));
    write(async db=>{for(const p of ns)await db.doc(p).delete();await db.doc("clients/"+id).delete()},"Deleted").then(ok=>{if(ok)openContact("")});return true}
  if(a==="crm-log"){const id=b.dataset.id;S.tab="time";S.editing=null;S.week=monday(new Date());try{localStorage.setItem("jcrm-tab","time")}catch(e){}
    history.replaceState(null,"",location.pathname);S.crmOpen=null;render();const el=$("#e-client");if(el){el.value=id;fillProjects(id,"")}const t=$("#e-start");if(t)t.focus();window.scrollTo(0,0);return true}
  if(a==="csv-open"){S.csv={defStatus:"prospect",skipDup:true};S.drawer={type:"csv"};renderDrawer();return true}
  if(a==="csv-reset"){S.csv={defStatus:S.csv.defStatus,skipDup:S.csv.skipDup};renderDrawer();return true}
  if(a==="csv-import"){csvImport(b);return true}
  if(a==="add-user"){demoOnly("Adding users");return true}
  if(a==="user-remove"){demoOnly("Removing users");return true}
  if(a==="user-reset"){demoOnly("Resetting passwords");return true}
  if(a==="save-cal"){demoOnly("Connecting Google Calendar");return true}
  return false;
}
document.addEventListener("input",e=>{
  if(e.target.id==="crm-q"){S.crmQuery=e.target.value;const pos=e.target.selectionStart;render();const q=$("#crm-q");if(q){q.focus();try{q.setSelectionRange(pos,pos)}catch(err){}}}
  const D=S.cview;if(!D)return;
  if(e.target.id==="n-text"&&!D.noteEdit)D.draftNote=e.target.value;
  if(e.target.id==="r-date")D.remDate=e.target.value;if(e.target.id==="r-time")D.remTime=e.target.value;if(e.target.id==="r-text")D.remText=e.target.value;
});
document.addEventListener("click",e=>{
  const f=e.target.closest("#crm-filter button[data-f]");if(f){S.crmFilter=f.dataset.f;render();return}
  const h=e.target.closest(".crm-head button[data-sort]");if(h){const k=h.dataset.sort;
    S.crmSort=S.crmSort.key===k?{key:k,dir:-S.crmSort.dir}:{key:k,dir:["billed","owed","last"].includes(k)?-1:1};
    try{localStorage.setItem("jcrm-sort",JSON.stringify(S.crmSort))}catch(err){}render();return}
  const back=e.target.closest("a.back");if(back){e.preventDefault();if(navDepth>0&&/^#c\//.test(location.hash)){navDepth--;history.back()}else openContact("");return}
});
document.addEventListener("toggle",e=>{if(e.target.id==="c-inv"&&S.cview)S.cview.invOpen=e.target.open},true);
document.addEventListener("submit",async e=>{
  if(e.target.id==="f-crm"){e.preventDefault();await saveCrm(e.target);return}
  if(e.target.id==="f-note"){e.preventDefault();const D=S.cview;const id=S.crmOpen;if(!D||!id)return;
    const text=$("#n-text").value.trim();if(!text){toast("Write the note first.");$("#n-text").focus();return}
    const doc={clientId:id,date:$("#n-date").value||today(),kind:$("#n-kind").value,text};
    if(D.noteEdit){const prev=S.notes.find(n=>n.id===D.noteEdit)||{};const nid=D.noteEdit;const keep=Object.assign({},prev,doc,{updatedAt:new Date().toISOString()});delete keep.id;
      const ok=await write(db=>db.doc("notes/"+nid).set(keep),"Note updated");if(ok){D.noteEdit=null;render()}}
    else{const ok=await write(db=>db.doc("notes/"+uid()).set(Object.assign(doc,{createdAt:new Date().toISOString(),by:S.me&&S.me.username})),"Note added");if(ok){D.draftNote="";render()}}
    return}
  if(e.target.id==="f-rem"){e.preventDefault();const D=S.cview;const c=S.clients[S.crmOpen];if(!D||!c)return;
    const r={clientId:c.id,date:$("#r-date").value||today(),time:$("#r-time").value||"",text:$("#r-text").value.trim()||("Follow up with "+dname(c)),done:false,createdAt:new Date().toISOString(),by:S.me&&S.me.username};
    const ok=await write(db=>db.doc("reminders/"+uid()).set(r),"Reminder saved");if(ok){D.remText=null;D.remDate=null;D.remTime=null;render();
      demoModal("Reminder saved","Your reminder was added to this contact and the Home page. Sending it to Google Calendar is not available in the demo version.")}}
  if(e.target.id==="f-user"){e.preventDefault();demoOnly("Adding users")}
});

/* ---------- users (Settings) ---------- */
function viewUsers(){
  if(!S.me||!S.me.admin)return"";
  const l=S.users;
  return `<section class="panel"><h2>Users</h2>
    <p class="muted small" style="margin-top:-6px">Everyone you add signs in with their own username and password and sees the same clients, hours and invoices.</p>
    ${l?`<div class="list">${l.map(u=>`<div class="sumrow"><div><b>${esc(u.display)}</b> <span class="muted small">@${esc(u.username)}${u.admin?" · admin":""}${u.username===S.me.username?" · you":""}</span></div><span></span>
      <span class="row" style="gap:4px">${u.username===S.me.username?"":`<button class="btn sm" data-act="user-reset" data-u="${esc(u.username)}">Reset password</button><button class="btn sm ${S.userDel===u.username?"danger":"ghost danger"}" data-act="user-remove" data-u="${esc(u.username)}">${S.userDel===u.username?"Confirm remove":"Remove"}</button>`}</span></div>`).join("")}</div>`:`<p class="muted small">Loading users…</p>`}
    <form id="f-user" class="row" style="margin-top:12px" autocomplete="off">
      <div class="field w-md"><label for="u-name">Username</label><input id="u-name" data-keep="no" autocapitalize="off"></div>
      <div class="field w-md"><label for="u-display">Display name</label><input id="u-display" data-keep="no"></div>
      <div class="field w-md"><label for="u-pw">Temporary password</label><input id="u-pw" type="text" data-keep="no" minlength="10"></div>
      <label class="row small" style="gap:6px;align-self:center"><input type="checkbox" id="u-admin"> Admin</label>
      <button class="btn" type="submit">Add user</button>
    </form></section>`;
}
/* ---------- sign in ---------- */
function viewLogin(){
  return `<section class="login">
    <div class="login-card">
      <div class="login-brand">${MARK}<div><b>Jono CRM</b><span>Demo version</span></div></div>
      <h1>Welcome back</h1>
      <p class="muted">Clients, projects, time, invoices and taxes, all in one place.</p>
      <form id="f-login" autocomplete="off">
        <div class="field"><label for="l-user">Username</label><input id="l-user" value="demo" readonly tabindex="-1" data-keep="no"></div>
        <div class="field" style="margin-top:10px"><label for="l-pw">Password</label><input id="l-pw" type="password" value="demo-password" readonly tabindex="-1" data-keep="no"></div>
        <button class="btn primary big" type="submit">Click here to sign in to the demo Jono CRM</button>
        <p class="muted small" id="l-msg" role="status" style="margin:12px 0 0">No account needed. Anything you add stays in your own browser.</p>
      </form>
    </div>
    <a class="credit login-credit" href="https://jonokeane.com" target="_blank" rel="noopener"><b>Built by JonoKeane</b><span>Create a platform that matches your needs!</span></a>
  </section>`;
}
function bindLogin(){
  const f=$("#f-login");if(!f)return;
  $("#sync").textContent="";$("#me").textContent="";
  setTimeout(()=>{const b=f.querySelector("button");if(b)b.focus()},30);
  f.addEventListener("submit",async ev=>{ev.preventDefault();const btn=f.querySelector("button");btn.disabled=true;btn.textContent="Signing in…";
    try{sessionStorage.setItem(SIGNED_KEY,"1")}catch(e){}
    await load();window.scrollTo(0,0)});
}

/* =====================================================================
   PROJECTS: a client's bigger jobs, broken into components to check off.
   Time logged against a project (Log Time → Project) rolls up here, and
   invoicing that time shows up as "invoiced".
   ===================================================================== */
const PR_ST=[["active","Active"],["hold","On hold"],["done","Done"]];
const prLabel=k=>(PR_ST.find(x=>x[0]===k)||[,"Active"])[1];
S.projOpen=null;S.projEdit=false;S.projFilter="open";
const projList=()=>Object.values(S.projects||{});
function projStats(p){
  const comps=p.components||[];const done=comps.filter(x=>x.done).length;
  const ents=S.entries.filter(e=>e.projectId===p.id);
  const hours=r2(ents.reduce((t,e)=>t+(e.kind==="flat"?0:+e.hours||0),0));
  const value=r2(ents.reduce((t,e)=>t+entryAmount(e),0));
  const invoiced=r2(ents.filter(e=>e.invoiceId).reduce((t,e)=>t+entryAmount(e),0));
  const pct=comps.length?Math.round(done/comps.length*100):(p.status==="done"?100:0);
  const nextDue=comps.filter(x=>!x.done&&x.due).map(x=>x.due).sort()[0]||"";
  return{comps,done,total:comps.length,pct,ents,hours,value,invoiced,nextDue};
}
const bar=(pct)=>`<span class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></span>`;

/* ---------- navigation (#p/<id>) ---------- */
function openProject(id,clientId){if(id==="new")S.projNewClient=clientId||"";if(id)navDepth++;location.hash=id?"p/"+encodeURIComponent(id):"";}
function syncProjRoute(){
  const m=/^#p\/(.+)$/.exec(location.hash);const id=m?decodeURIComponent(m[1]):null;
  if(id!==S.projOpen){S.projOpen=id;S.projEdit=id==="new";S.projForm=null;S.drawer=null;if(id)S.tab="projects";render();window.scrollTo(0,0)}
}
window.addEventListener("hashchange",syncProjRoute);

/* ---------- list ---------- */
function projRow(p,showClient){const st=projStats(p);const late=p.status!=="done"&&p.due&&p.due<today();
  return `<button class="prow" data-act="proj-open" data-id="${esc(p.id)}">
    <span class="who"><b>${esc(p.name)}</b>${showClient?`<span class="muted small">${esc(S.clients[p.clientId]?dname(S.clients[p.clientId]):"No client")}</span>`:""}</span>
    <span><span class="pill pr-${p.status||"active"}">${esc(prLabel(p.status))}</span></span>
    <span class="prog">${bar(st.pct)}<span class="small muted num">${st.total?st.done+"/"+st.total:"—"}</span></span>
    <span class="small r ${late?"late":"muted"}">${p.due?(late?"Overdue · ":"Due ")+esc(fmtD(parse(p.due))):"No due date"}</span>
    <span class="small r num">${st.hours?hrs(st.hours)+" hrs":`<span class="muted">—</span>`}</span></button>`}
function viewProjects(){
  if(S.projOpen)return viewProject();
  if(S.projView==="board")return viewBoard();
  const all=projList();const inSet=(p,k)=>k==="all"||(k==="open"?p.status!=="done":(p.status||"active")===k);
  const filters=[["open","Open"],["active","Active"],["hold","On hold"],["done","Done"],["all","All"]];
  const l=all.filter(p=>inSet(p,S.projFilter)).sort((a,b)=>((a.status==="done")-(b.status==="done"))||((a.due||"9999")).localeCompare(b.due||"9999")||a.name.localeCompare(b.name));
  return `<section class="panel">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><div class="row" style="align-items:center;gap:12px"><h2 style="margin:0">Projects</h2>${viewToggle()}</div><div class="row" style="gap:8px"><button class="btn" data-act="task-new">+ Task</button><button class="btn primary" data-act="proj-new">+ New project</button></div></div>
    <div class="seg seg-wrap" id="proj-filter">${filters.map(([k,t])=>`<button data-f="${k}" aria-pressed="${S.projFilter===k}">${t} <span class="cnt">${all.filter(p=>inSet(p,k)).length}</span></button>`).join("")}</div>
  </section>
  <section class="panel" style="padding:6px 10px"><div class="list">${l.length?l.map(p=>projRow(p,true)).join(""):`<p class="muted" style="padding:10px 6px">${all.length?"No projects here.":"No projects yet. Create one for any job with several parts, like a website build, and break it into components you can check off."}</p>`}</div></section>`;
}

/* ---------- project page ---------- */
function viewProject(){
  const isNew=S.projOpen==="new";
  const backTo=`<a class="back pback" href="#">← ${S.projBackClient?"Back":"All projects"}</a>`;
  if(isNew||S.projEdit){
    const p=S.projForm||(isNew?{name:"",clientId:S.projNewClient||"",status:"active",components:[]}:S.projects[S.projOpen]);
    if(!p)return backTo+`<section class="panel"><p class="muted">That project doesn't exist anymore.</p></section>`;
    return backTo+`<section class="panel"><h2>${isNew?"New project":"Edit project"}</h2>${projForm(p,isNew)}</section>`;
  }
  const p=S.projects[S.projOpen];if(!p)return backTo+`<section class="panel"><p class="muted">That project doesn't exist anymore.</p></section>`;
  const c=S.clients[p.clientId];const st=projStats(p);const P=S.pview||(S.pview={});if(P.id!==p.id){for(const k in P)delete P[k];P.id=p.id}
  const late=p.status!=="done"&&p.due&&p.due<today();
  const left=p.budget?r2(p.budget-st.value):null;
  const field=(label,v,cls="")=>`<div class="cf ${cls}"><div class="k">${label}</div><div class="v">${v||`<span class="muted">—</span>`}</div></div>`;
  return backTo+`
  <section class="panel ctop">
    <div class="ctop-h">
      <div><h1>${esc(p.name)}</h1>${c?`<a class="small" href="#c/${esc(encodeURIComponent(c.id))}">${esc(dname(c))}</a>`:`<span class="muted small">No client</span>`}</div>
      <div class="row" style="gap:8px;align-items:center">
        <select class="stsel pr-${p.status||"active"}" disabled aria-label="Status">${PR_ST.map(([k,t])=>`<option ${p.status===k?"selected":""}>${t}</option>`).join("")}</select>
        <button class="btn" data-act="proj-edit">Edit details</button>
      </div>
    </div>
    <div class="cgrid">
      ${field("Start",p.start?esc(fmtDY(parse(p.start))):"")}${field("Due",p.due?`<span class="${late?"late":""}">${esc(fmtDY(parse(p.due)))}${late?" · overdue":""}</span>`:"")}${field("Budget / quote",p.budget?money(p.budget):"")}
      ${p.description?field("Description",`<span style="white-space:pre-line">${esc(p.description)}</span>`,"wide"):""}
    </div>
    <div class="pprog">${bar(st.pct)}<span class="small"><b>${st.done} of ${st.total}</b> components done${st.total?" · "+st.pct+"%":""}</span></div>
  </section>
  <div class="crm-grid">
    <section class="panel">
      <h2>Components</h2>
      <div class="comps" id="comps">${st.comps.map((x,i)=>P.editComp===x.id?`<form class="comp editing" data-cid="${esc(x.id)}" id="f-comp-edit">
          <input id="ce-name" value="${esc(x.name)}" aria-label="Component name" class="grow">
          <input id="ce-due" type="date" value="${esc(x.due||"")}" aria-label="Due date">
          <button class="btn sm primary" type="submit">Save</button><button class="btn sm ghost" type="button" data-act="comp-cancel">Cancel</button></form>`
        :`<div class="comp${x.done?" done":""}">
          <label class="ck"><input type="checkbox" data-comp="${esc(x.id)}" ${x.done?"checked":""}><span>${esc(x.name)}</span></label>
          <span class="small ${!x.done&&x.due&&x.due<today()?"late":"muted"}">${x.done?(x.doneDate?"Done "+esc(fmtD(parse(x.doneDate))):"Done"):(x.due?"Due "+esc(fmtD(parse(x.due))):"")}</span>
          <span class="x">
            <button class="btn sm ghost" data-act="comp-up" data-i="${i}" ${i===0?"disabled":""} aria-label="Move up">↑</button>
            <button class="btn sm ghost" data-act="comp-down" data-i="${i}" ${i===st.comps.length-1?"disabled":""} aria-label="Move down">↓</button>
            ${!x.done&&x.due?`<button class="btn sm ghost" data-act="demo-cal" title="Add to Google Calendar">Calendar</button>`:""}
            <button class="btn sm ghost" data-act="comp-edit" data-cid="${esc(x.id)}">Edit</button>
            ${P.delComp===x.id?`<button class="btn sm danger" data-act="comp-del" data-cid="${esc(x.id)}">Delete?</button>`:`<button class="btn sm ghost" data-act="comp-del-ask" data-cid="${esc(x.id)}" aria-label="Delete">✕</button>`}
          </span></div>`).join("")||`<p class="muted small">No components yet. Add the pieces of this job below, like “Homepage design” or “Launch”.</p>`}</div>
      <form id="f-comp" class="row" style="margin-top:12px" autocomplete="off">
        <div class="field grow"><label for="c-new">Add a component</label><input id="c-new" placeholder="e.g. Product pages" data-keep="no"></div>
        <div class="field w-md"><label for="c-due">Due (optional)</label><input id="c-due" type="date" data-keep="no"></div>
        <button class="btn" type="submit">Add</button>
      </form>
    </section>
    <section class="panel">
      <h2>Time &amp; money</h2>
      <div class="stats mini" style="grid-template-columns:1fr 1fr">
        <div class="stat"><div class="k">Hours logged</div><div class="v num">${hrs(st.hours)}</div></div>
        <div class="stat"><div class="k">Value of work</div><div class="v num">${money0(st.value)}</div></div>
        <div class="stat"><div class="k">Invoiced</div><div class="v num">${money0(st.invoiced)}</div><div class="s">${st.value-st.invoiced>0.005?money(st.value-st.invoiced)+" not yet invoiced":""}</div></div>
        <div class="stat ${left!=null&&left<0?"key":""}"><div class="k">Budget left</div><div class="v num">${left==null?"—":money0(left)}</div><div class="s">${p.budget?"of "+money0(p.budget):"No budget set"}</div></div>
      </div>
      ${c&&c.active!==false?`<div style="margin-top:12px"><button class="btn accent" data-act="proj-log">Log time on this project</button></div>`:c?`<p class="muted small" style="margin-top:12px">${esc(dname(c))} is hidden from Log Time. Turn on “Show in the Log Time client list” in their details to log hours here.</p>`:""}
    </section>
  </div>
  <details class="panel fold" ${P.timeOpen?"open":""} id="p-time">
    <summary><h2>Time entries</h2><span class="muted small">${st.ents.length} entr${st.ents.length===1?"y":"ies"}</span><span class="chev" aria-hidden="true">▾</span></summary>
    <div class="fold-b">${st.ents.length?st.ents.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="sumrow"><div><b class="small">${esc(fmtDY(parse(e.date)))}</b> <span class="small">${esc(e.task||"")}</span></div>
      <span class="num">${e.kind==="flat"?money(e.amount):hrs(e.hours)+" hrs"}</span><span class="small ${e.invoiceId?"billed":"muted"}">${e.invoiceId?"Invoiced":"Not invoiced"}</span></div>`).join(""):`<p class="muted small">No time logged on this project yet.</p>`}</div>
  </details>
  <div class="row" style="justify-content:flex-end">${P.confirmDel?`<span class="notice bad">Delete this project? Its time entries stay in Log Time, just without a project.</span><button class="btn sm danger" data-act="proj-del">Delete</button><button class="btn sm" data-act="proj-del-cancel">Keep</button>`:`<button class="btn sm danger ghost" data-act="proj-del-ask">Delete project</button>`}</div>`;
}

function projForm(p,isNew){
  const clients=Object.values(S.clients).sort((a,b)=>dname(a).localeCompare(dname(b)));
  return `<form id="f-proj" class="stack" autocomplete="off">
    <div class="row">
      <div class="field grow"><label for="pj-name">Project name</label><input id="pj-name" value="${esc(p.name||"")}" placeholder="e.g. Website redesign" required></div>
      <div class="field grow"><label for="pj-client">Client</label><select id="pj-client"><option value="">Choose a client…</option>${clients.map(c=>`<option value="${esc(c.id)}" ${p.clientId===c.id?"selected":""}>${esc(dname(c))}</option>`).join("")}</select></div>
      <div class="field w-md"><label for="pj-status">Status</label><select id="pj-status">${PR_ST.map(([k,t])=>`<option value="${k}" ${(p.status||"active")===k?"selected":""}>${t}</option>`).join("")}</select></div>
    </div>
    <div class="row">
      <div class="field w-md"><label for="pj-start">Start date</label><input id="pj-start" type="date" value="${esc(p.start||(isNew?today():""))}"></div>
      <div class="field w-md"><label for="pj-due">Due date</label><input id="pj-due" type="date" value="${esc(p.due||"")}"></div>
      <div class="field w-md"><label for="pj-budget">Budget / quote ($)</label><input id="pj-budget" type="number" min="0" step="1" value="${esc(p.budget||"")}" placeholder="Optional"></div>
    </div>
    <div class="field"><label for="pj-desc">Description</label><textarea id="pj-desc" rows="3">${esc(p.description||"")}</textarea></div>
    ${isNew?`<div class="field"><label for="pj-comps">Components (one per line, optional)</label><textarea id="pj-comps" rows="5" placeholder="Homepage design&#10;Product pages&#10;Contact form&#10;Launch"></textarea></div>`:""}
    <div class="actions"><button class="btn primary" type="submit">${isNew?"Create project":"Save changes"}</button><button class="btn ghost" type="button" data-act="proj-cancel">Cancel</button></div>
  </form>`;
}

async function saveProj(){
  const v=id=>($(id)||{value:""}).value.trim();
  const isNew=S.projOpen==="new";
  const f={name:v("#pj-name"),clientId:v("#pj-client"),status:v("#pj-status")||"active",start:v("#pj-start"),due:v("#pj-due"),budget:+v("#pj-budget")||0,description:v("#pj-desc")};
  if(!f.name){toast("Give the project a name.");$("#pj-name").focus();return}
  if(!f.clientId){toast("Pick the client this project is for.");$("#pj-client").focus();return}
  const id=isNew?uid():S.projOpen;const prev=S.projects[id]||{};
  const doc=Object.assign({},prev,f,{updatedAt:new Date().toISOString()});delete doc.id;
  if(isNew){doc.createdAt=new Date().toISOString();doc.by=S.me&&S.me.username;
    doc.components=v("#pj-comps").split(/\n/).map(x=>x.trim()).filter(Boolean).map(name=>({id:uid()+Math.random().toString(36).slice(2,5),name,done:false}))}
  if(f.status==="done"&&prev.status!=="done")doc.doneDate=today();
  const ok=await write(db=>db.doc("projects/"+id).set(doc),isNew?"Project created":"Saved");
  if(!ok)return;S.projForm=null;S.projEdit=false;
  if(isNew){history.replaceState(null,"","#p/"+encodeURIComponent(id));S.projOpen=id;render()}else render();
}
async function setComps(p,comps,msg){return write(db=>db.doc("projects/"+p.id).update({components:comps,updatedAt:new Date().toISOString()}),msg)}

/* Project picker in Log Time: the chosen client's open projects. */
function fillProjects(clientId,selected){
  const el=$("#e-project");if(!el)return;
  const l=projList().filter(p=>p.clientId===clientId&&(p.status!=="done"||p.id===selected)).sort((a,b)=>a.name.localeCompare(b.name));
  el.innerHTML=`<option value="">No project</option>`+l.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  el.value=l.some(p=>p.id===selected)?selected:"";el.disabled=!l.length;S.entryProject=el.value;
}

/* ---------- events ---------- */
function projAction(a,b){
  const P=S.pview||{};const p=S.projOpen&&S.projects[S.projOpen];
  if(a==="proj-new"){S.projBackClient=null;S.projForm=null;openProject("new",b.dataset.client||"");if(b.dataset.client)S.projBackClient=b.dataset.client;return true}
  if(a==="proj-open"){S.projBackClient=S.tab==="clients"?S.crmOpen:null;openProject(b.dataset.id);return true}
  if(a==="proj-edit"){S.projEdit=true;S.projForm=null;render();window.scrollTo(0,0);return true}
  if(a==="proj-cancel"){S.projForm=null;if(S.projOpen==="new"){if(navDepth>0){navDepth--;history.back()}else openProject("")}else{S.projEdit=false;render()}return true}
  if(a==="proj-del-ask"){P.confirmDel=true;render();return true}
  if(a==="proj-del-cancel"){P.confirmDel=false;render();return true}
  if(a==="proj-del"&&p){const ids=S.entries.filter(e=>e.projectId===p.id).map(e=>e.id);
    write(async db=>{for(const id of ids)await db.doc("entries/"+id).update({projectId:null});await db.doc("projects/"+p.id).delete()},"Project deleted").then(ok=>{if(ok)openProject("")});return true}
  if(a==="proj-log"&&p){S.tab="time";S.editing=null;S.week=monday(new Date());try{localStorage.setItem("jcrm-tab","time")}catch(e){}
    history.replaceState(null,"",location.pathname);S.projOpen=null;render();const el=$("#e-client");if(el){el.value=p.clientId;fillProjects(p.clientId,p.id)}
    const t=$("#e-start");if(t)t.focus();window.scrollTo(0,0);return true}
  if(!p)return false;
  const comps=(p.components||[]).map(x=>Object.assign({},x));
  if(a==="comp-up"||a==="comp-down"){const i=+b.dataset.i,j=a==="comp-up"?i-1:i+1;if(j<0||j>=comps.length)return true;[comps[i],comps[j]]=[comps[j],comps[i]];setComps(p,comps);return true}
  if(a==="comp-edit"){P.editComp=b.dataset.cid;P.delComp=null;render();const n=$("#ce-name");if(n){n.focus();n.select()}return true}
  if(a==="comp-cancel"){P.editComp=null;render();return true}
  if(a==="comp-del-ask"){P.delComp=b.dataset.cid;render();return true}
  if(a==="comp-del"){setComps(p,comps.filter(x=>x.id!==b.dataset.cid),"Component removed").then(()=>{P.delComp=null;render()});return true}
  return false;
}
document.addEventListener("click",e=>{
  const f=e.target.closest("#proj-filter button[data-f]");if(f){S.projFilter=f.dataset.f;render();return}
  const back=e.target.closest("a.pback");if(back){e.preventDefault();
    if(S.projBackClient&&S.projOpen!=="new"){const c=S.projBackClient;S.projBackClient=null;openContact(c);S.tab="clients";return}
    if(navDepth>0&&/^#p\//.test(location.hash)){navDepth--;history.back()}else openProject("");return}
});
document.addEventListener("change",e=>{
  const cb=e.target.closest("input[data-comp]");
  if(cb){const p=S.projects[S.projOpen];if(!p)return;const comps=(p.components||[]).map(x=>x.id===cb.dataset.comp?Object.assign({},x,{done:cb.checked,doneDate:cb.checked?today():null}):x);
    const all=comps.length&&comps.every(x=>x.done);
    setComps(p,comps,cb.checked?(all?"All components done. Mark the project Done in Edit details when you're ready.":"Checked off"):"Unchecked");return}
  if(e.target.id==="e-client"&&e.target.value!=="__new"){fillProjects(e.target.value,"")}
  if(e.target.id==="e-project"){S.entryProject=e.target.value}
});
document.addEventListener("toggle",e=>{if(e.target.id==="p-time"&&S.pview)S.pview.timeOpen=e.target.open},true);
document.addEventListener("submit",async e=>{
  if(e.target.id==="f-proj"){e.preventDefault();await saveProj();return}
  const p=S.projOpen&&S.projects[S.projOpen];if(!p)return;
  if(e.target.id==="f-comp"){e.preventDefault();const name=$("#c-new").value.trim();if(!name){$("#c-new").focus();return}
    const comps=(p.components||[]).concat([{id:uid()+Math.random().toString(36).slice(2,5),name,due:$("#c-due").value||"",done:false}]);
    if(await setComps(p,comps)){const n=$("#c-new");if(n)n.focus()}return}
  if(e.target.id==="f-comp-edit"){e.preventDefault();const cid=e.target.dataset.cid;const name=$("#ce-name").value.trim();if(!name)return;
    const comps=(p.components||[]).map(x=>x.id===cid?Object.assign({},x,{name,due:$("#ce-due").value||""}):x);
    if(await setComps(p,comps,"Saved")){S.pview.editComp=null;render()}}
});


/* =====================================================================
   HOME, FOLLOW-UPS, DEALS, EXPENSES
   ===================================================================== */
const COLD_DAYS=21; // a lead with no activity for this long, and nothing scheduled, needs a follow-up
const DEAL_ST=[["quoted","Quoted"],["negotiating","Negotiating"],["won","Won"],["lost","Lost"]];
const dealLabel=k=>(DEAL_ST.find(x=>x[0]===k)||[,"Quoted"])[1];
const openDeal=d=>d.stage==="quoted"||d.stage==="negotiating"||!d.stage;
const daysUntil=d=>Math.round((parse(d)-parse(today()))/864e5);
const relDay=d=>{const n=daysUntil(d);return n===0?"Today":n===1?"Tomorrow":n===-1?"Yesterday":n<0?(-n)+" days ago":n<7?DOW[parse(d).getDay()]:fmtD(parse(d))};

/* ---------- follow-ups ---------- */
function followUp(c){
  const rem=S.reminders.filter(r=>r.clientId===c.id&&!r.done);
  const due=rem.filter(r=>r.date<=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(due)return{why:(due.date<today()?"Overdue: ":"Today: ")+due.text,date:due.date,rem:due};
  if(statusKey(c)==="lead"&&!rem.length){const last=crmStats(c.id).lastAct;
    const d=last?Math.round((parse(today())-parse(last))/864e5):null;
    if(d===null||d>=COLD_DAYS)return{why:d===null?"Lead with no activity yet":"Lead gone quiet: no activity in "+d+" days",date:last||""}}
  return null;
}

/* ---------- Home ---------- */
function viewHome(){
  const t=today(),soon=iso(addDays(new Date(),14));
  const wk=monday(new Date()),wa=iso(wk),wb=iso(addDays(wk,6));
  const week=S.entries.filter(e=>e.date>=wa&&e.date<=wb);
  const wHours=week.reduce((s,e)=>s+(e.kind==="flat"?0:+e.hours||0),0),wAmt=week.reduce((s,e)=>s+entryAmount(e),0);
  const byC={};week.forEach(e=>{const o=byC[e.clientId]||(byC[e.clientId]={h:0,a:0,un:0});o.h+=e.kind==="flat"?0:+e.hours||0;o.a+=entryAmount(e);if(!e.invoiceId)o.un++});
  const rems=S.reminders.filter(r=>!r.done&&r.date<=soon).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  const later=S.reminders.filter(r=>!r.done&&r.date>soon).length;
  const unpaid=sortInv(S.invoices.filter(i=>["sent","partial"].includes(statusOf(i)))).reverse();
  const owed=unpaid.reduce((s,i)=>s+balanceOf(i),0);
  const drafts=S.invoices.filter(i=>statusOf(i)==="draft").length;
  const dueItems=[];
  projList().filter(p=>p.status!=="done").forEach(p=>{
    if(p.due&&p.due<=soon)dueItems.push({date:p.due,kind:"Project",name:p.name,p});
    (p.components||[]).filter(x=>!x.done&&x.due&&x.due<=soon).forEach(x=>dueItems.push({date:x.due,kind:"Component",name:x.name,p,x}))});
  (S.tasks||[]).filter(x=>x.stage!=="done"&&x.due&&x.due<=soon).forEach(x=>dueItems.push({date:x.due,kind:"Task",name:x.name,t:x}));
  dueItems.sort((a,b)=>a.date.localeCompare(b.date));
  const fus=Object.values(S.clients).map(c=>({c,f:followUp(c)})).filter(x=>x.f&&!x.f.rem);
  const deals=S.deals.filter(openDeal);const pipe=deals.reduce((s,d)=>s+(+d.value||0),0);
  const hour=new Date().getHours();const hi=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const cl=id=>S.clients[id];
  const cLink=id=>cl(id)?`<a href="#c/${esc(encodeURIComponent(id))}">${esc(dname(cl(id)))}</a>`:"";
  return `
  <div class="home-h"><h1>${hi}${S.me?", "+esc(S.me.display):""}</h1><span class="muted">${esc(DOW[new Date().getDay()])}, ${esc(fmtDY(new Date()))}</span></div>
  <div class="stats">
    <a class="stat link" href="#" data-go="time"><div class="k">This week</div><div class="v num">${hrs(wHours)}</div><div class="s">${money(wAmt)} of work logged</div></a>
    <a class="stat link ${owed>0.005?"key":""}" href="#" data-go="invoices" data-filter="unpaid"><div class="k">Owed to you</div><div class="v num">${money0(owed)}</div><div class="s">${unpaid.length} unpaid invoice${unpaid.length===1?"":"s"}</div></a>
    <a class="stat link" href="#" data-go="clients" data-filter="followup"><div class="k">Follow-ups</div><div class="v num">${rems.filter(r=>r.date<=t).length+fus.length}</div><div class="s">due today or overdue</div></a>
    <div class="stat"><div class="k">Open pipeline</div><div class="v num">${money0(pipe)}</div><div class="s">${deals.length} open deal${deals.length===1?"":"s"}</div></div>
  </div>
  <div class="home-grid">
    <section class="panel">
      <h2>Reminders &amp; follow-ups</h2>
      ${rems.length||fus.length?`<div class="hlist">${rems.map(r=>{const c=cl(r.clientId);return `<div class="hrow ${r.date<t?"over":r.date===t?"today":""}">
          <span class="when">${esc(relDay(r.date))}${r.time?`<span class="muted small"> ${esc(fmtTime(r.time))}</span>`:""}</span>
          <span class="what">${esc(r.text)}<span class="muted small">${c?" · "+cLink(c.id):""}</span></span>
          <span class="x">${c?`<button class="btn sm ghost" data-act="demo-cal">Calendar</button>`:""}<button class="btn sm ghost" data-act="rem-done" data-id="${esc(r.id)}">Done</button></span></div>`}).join("")}
        ${fus.map(({c,f})=>`<div class="hrow cold"><span class="when">Follow up</span><span class="what">${cLink(c.id)}<span class="muted small"> · ${esc(f.why)}</span></span><span class="x"><a class="btn sm ghost" href="#c/${esc(encodeURIComponent(c.id))}">Open</a></span></div>`).join("")}</div>`
        :`<p class="muted small">Nothing due in the next two weeks.</p>`}
      ${later?`<p class="muted small" style="margin:8px 0 0">${later} more reminder${later===1?"":"s"} after ${esc(fmtD(parse(soon)))}.</p>`:""}
    </section>
    <section class="panel">
      <h2>Due soon</h2>
      ${dueItems.length?`<div class="hlist">${dueItems.map(d=>`<div class="hrow ${d.date<t?"over":d.date===t?"today":""}">
          <span class="when">${esc(relDay(d.date))}</span>
          <span class="what">${d.t?`<a href="#" data-act="task-open" data-id="${esc(d.t.id)}">${esc(d.name)}</a><span class="muted small"> · Task · ${esc(forLabel(d.t.clientId))}</span>`
            :`<a href="#p/${esc(encodeURIComponent(d.p.id))}">${esc(d.name)}</a><span class="muted small"> · ${d.kind==="Component"?esc(d.p.name)+" · ":""}${cl(d.p.clientId)?esc(dname(cl(d.p.clientId))):""}</span>`}</span>
          <span class="x"><button class="btn sm ghost" data-act="demo-cal">Calendar</button></span></div>`).join("")}</div>`
        :`<p class="muted small">No project or task deadlines in the next two weeks.</p>`}
    </section>
    <section class="panel">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Unpaid invoices</h2>${drafts?`<a class="small" href="#" data-go="invoices" data-filter="all">${drafts} draft${drafts===1?"":"s"} not sent</a>`:""}</div>
      ${unpaid.length?`<div class="list">${unpaid.map(i=>{const age=i.sentDate?Math.round((parse(t)-parse(i.sentDate))/864e5):null;return `<button class="inv" data-act="open-inv" data-id="${esc(i.id)}">
          <span class="no num muted">#${esc(i.number)}</span><span class="who"><b>${esc(cname(i.clientId))}</b><span class="muted small">${age!=null?"Sent "+(age===0?"today":age+" day"+(age===1?"":"s")+" ago"):""}</span></span>
          <span class="pill ${statusOf(i)}">${STATUS_LABEL[statusOf(i)]}</span><span class="amt num">${money(balanceOf(i))}</span></button>`}).join("")}</div>`
        :`<p class="muted small">Everything's paid up.</p>`}
    </section>
    <section class="panel">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">This week's hours</h2><a class="small" href="#" data-go="time">Log time</a></div>
      ${Object.keys(byC).length?Object.entries(byC).sort((a,b)=>b[1].a-a[1].a).map(([cid,o])=>`<div class="sumrow"><div><span class="chip ${cidx(cid)}">${esc(cname(cid))}</span>${o.un?` <span class="muted small">${o.un} not invoiced</span>`:""}</div><span class="num muted">${o.h?hrs(o.h)+" hrs":""}</span><b class="num">${money(o.a)}</b></div>`).join("")
        :`<p class="muted small">No time logged this week yet.</p>`}
    </section>
    ${deals.length?`<section class="panel span2"><h2>Pipeline</h2><div class="pipe">${DEAL_ST.slice(0,2).map(([k,t])=>{const l=deals.filter(d=>(d.stage||"quoted")===k);return `<div><h3>${t} · ${money0(l.reduce((s,d)=>s+(+d.value||0),0))}</h3>
        ${l.map(d=>`<a class="deal" href="#c/${esc(encodeURIComponent(d.clientId))}"><b>${esc(d.name)}</b><span class="muted small">${cl(d.clientId)?esc(dname(cl(d.clientId))):""}${d.date?" · "+esc(fmtD(parse(d.date))):""}</span><span class="num">${money0(d.value)}</span></a>`).join("")||`<p class="muted small">None</p>`}</div>`}).join("")}</div></section>`:""}
  </div>`;
}
function dueCalUrl(d){
  const c=S.clients[d.p.clientId]||{id:"",name:""};
  const r={date:d.date,time:"",text:(d.kind==="Component"?d.name+" due ("+d.p.name+")":d.p.name+" due")};
  return gcalUrl(r,c,location.origin+"/#p/"+encodeURIComponent(d.p.id));
}
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(!g)return;e.preventDefault();
  const tab=g.dataset.go;if(tab==="invoices"&&g.dataset.filter)S.invFilter=g.dataset.filter;if(tab==="clients"&&g.dataset.filter)S.crmFilter=g.dataset.filter;
  S.tab=tab;try{localStorage.setItem("jcrm-tab",tab)}catch(err){}history.replaceState(null,"",location.pathname);S.crmOpen=null;S.projOpen=null;render();window.scrollTo(0,0);
});

/* ---------- deals (on the contact page) ---------- */
function viewDeals(c){
  const D=S.cview||{};const l=S.deals.filter(d=>d.clientId===c.id).sort((a,b)=>(openDeal(b)-openDeal(a))||(b.date||"").localeCompare(a.date||""));
  const open=l.filter(openDeal).reduce((s,d)=>s+(+d.value||0),0);
  return `<section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Deals</h2>${open?`<span class="small muted">Open: <b class="num">${money(open)}</b></span>`:""}</div>
    ${l.length?`<div class="list">${l.map(d=>`<div class="drow">
      <span class="who"><b>${esc(d.name)}</b><span class="muted small">${d.date?"Quoted "+esc(fmtD(parse(d.date))):""}${d.closed?" · closed "+esc(fmtD(parse(d.closed))):""}</span></span>
      <span class="num">${money(d.value)}</span>
      <select class="stsel dl-${d.stage||"quoted"}" data-deal="${esc(d.id)}" aria-label="Stage">${DEAL_ST.map(([k,t])=>`<option value="${k}" ${(d.stage||"quoted")===k?"selected":""}>${t}</option>`).join("")}</select>
      ${D.dealDel===d.id?`<button class="btn sm danger" data-act="deal-del" data-id="${esc(d.id)}">Delete?</button>`:`<button class="btn sm ghost" data-act="deal-del-ask" data-id="${esc(d.id)}" aria-label="Delete deal">✕</button>`}</div>`).join("")}</div>`:`<p class="muted small">No deals yet. When you quote a job, add it here to track it.</p>`}
    <form id="f-deal" class="row" style="margin-top:12px" autocomplete="off">
      <div class="field grow"><label for="d-name">What you quoted</label><input id="d-name" placeholder="e.g. Website redesign" data-keep="no"></div>
      <div class="field w-sm"><label for="d-val">Value ($)</label><input id="d-val" type="number" min="0" step="1" inputmode="decimal" data-keep="no"></div>
      <div class="field w-md"><label for="d-date">Quoted on</label><input id="d-date" type="date" value="${today()}" data-keep="no"></div>
      <button class="btn" type="submit">Add deal</button>
    </form></section>`;
}

/* ---------- expenses ---------- */
const EXP_CATS=[["advertising","Advertising & marketing"],["mileage","Mileage (business driving)"],["contract","Contract labor"],["software","Software & subscriptions"],["equipment","Equipment & computers"],
  ["office","Office expense & supplies"],["phone","Phone & internet"],["legal","Legal & professional fees"],["insurance","Insurance"],["travel","Travel"],["meals","Meals (50% deductible)"],
  ["education","Education & training"],["fees","Bank & payment fees"],["rent","Rent / coworking"],["other","Other"]];
const catLabel=k=>(EXP_CATS.find(x=>x[0]===k)||[,"Other"])[1];
// IRS business mileage rate by date (2026 changed on July 1). Settings can override.
function mileRate(date){const o=(S.settings||{}).mileageRate;if(o)return +o;
  if(date>="2026-07-01")return 0.76;if(date>="2026-01-01")return 0.725;if(date>="2025-01-01")return 0.70;return 0.67}
const deductible=x=>x.category==="meals"?r2((+x.amount||0)*0.5):(+x.amount||0);
S.expYear=String(new Date().getFullYear());
function viewMoney(){
  const st=set();const yr=S.expYear;
  const inv=S.invoices.filter(i=>(i.periodEnd||"").startsWith(yr));
  const counted=inv.filter(i=>statusOf(i)!=="check"&&statusOf(i)!=="draft");
  const billed=counted.reduce((s,i)=>s+(+i.total||0),0),paid=counted.reduce((s,i)=>s+received(i),0);
  const exps=S.expenses.filter(x=>(x.date||"").startsWith(yr)).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||"").localeCompare(a.createdAt||""));
  const spent=exps.reduce((s,x)=>s+(+x.amount||0),0),ded=r2(exps.reduce((s,x)=>s+deductible(x),0));
  const profit=r2(billed-ded);const base=Math.max(0,profit);
  const lo=base*(+st.setAsideLow||.25),hi=base*(+st.setAsideHigh||.3);
  const dl=nextDeadline();
  const byC={};counted.forEach(i=>byC[i.clientId]=(byC[i.clientId]||0)+(+i.total||0));const cmax=Math.max(1,...Object.values(byC));
  const byM={};counted.forEach(i=>{const m=+i.periodEnd.slice(5,7)-1;byM[m]=(byM[m]||0)+(+i.total||0)});
  const exM={};exps.forEach(x=>{const m=+x.date.slice(5,7)-1;exM[m]=(exM[m]||0)+deductible(x)});
  const months=[...new Set([...Object.keys(byM),...Object.keys(exM)].map(Number))].sort((a,b)=>a-b);const mmax=Math.max(1,...Object.values(byM),...Object.values(exM));
  const byCat={};exps.forEach(x=>byCat[x.category]=(byCat[x.category]||0)+(+x.amount||0));const catmax=Math.max(1,...Object.values(byCat));
  const years=[...new Set([String(new Date().getFullYear()),...S.invoices.map(i=>(i.periodEnd||"").slice(0,4)),...S.expenses.map(x=>(x.date||"").slice(0,4))].filter(Boolean))].sort().reverse();
  const E=S.expEdit?S.expenses.find(x=>x.id===S.expEdit):null;const cat=S.expCat||(E?E.category:"software");
  const clients=Object.values(S.clients).sort((a,b)=>dname(a).localeCompare(dname(b)));
  return `
  ${years.length>1?`<div class="seg" id="exp-year">${years.map(y=>`<button data-y="${y}" aria-pressed="${y===yr}">${y}</button>`).join("")}</div>`:""}
  <div class="stats">
    <div class="stat"><div class="k">Billed in ${yr}</div><div class="v num">${money0(billed)}</div><div class="s">${money0(paid)} received</div></div>
    <div class="stat"><div class="k">Expenses</div><div class="v num">${money0(ded)}</div><div class="s">${exps.length} logged${spent!==ded?" · "+money0(spent)+" spent":""}</div></div>
    <div class="stat"><div class="k">Profit</div><div class="v num">${money0(profit)}</div><div class="s">billed minus deductible expenses</div></div>
    <div class="stat key"><div class="k">Set aside for taxes</div><div class="v num">${money0(lo)}–${money0(hi)}</div><div class="s">${Math.round(st.setAsideLow*100)}–${Math.round(st.setAsideHigh*100)}% of profit</div></div>
    <div class="stat"><div class="k">Next IRS payment</div><div class="v">${dl?fmtD(dl.d):"—"}</div><div class="s">${dl?dl.l+" estimated tax · IRS.gov/payments":""}</div></div>
  </div>
  <section class="panel"><h2>${E?"Edit expense":"Log an expense"}</h2>
    <form id="f-exp" class="stack" autocomplete="off">
      <div class="row">
        <div class="field w-md"><label for="x-date">Date</label><input id="x-date" type="date" value="${esc(E?E.date:(S.expKeep&&S.expKeep.d)||today())}" data-keep="no"></div>
        <div class="field w-md" style="flex-basis:220px"><label for="x-cat">Category</label><select id="x-cat" data-keep="no">${EXP_CATS.map(([k,t])=>`<option value="${k}" ${cat===k?"selected":""}>${t}</option>`).join("")}</select></div>
        <div class="field grow"><label for="x-vendor">${cat==="mileage"?"Trip (where / why)":"Vendor / description"}</label><input id="x-vendor" data-keep="no" value="${esc(E?E.vendor||"":(S.expKeep&&S.expKeep.v)||"")}" placeholder="${cat==="mileage"?"e.g. Client office for a photo shoot":"e.g. Adobe Creative Cloud"}"></div>
      </div>
      <div class="row">
        ${cat==="mileage"?`<div class="field w-sm"><label for="x-miles">Miles</label><input id="x-miles" data-keep="no" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(E?E.miles||"":"")}"></div>
          <div class="field w-md"><label>Deduction</label><div class="calc num" id="x-calc">—</div></div>`
        :`<div class="field w-sm"><label for="x-amt">Amount ($)</label><input id="x-amt" data-keep="no" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(E?E.amount||"":"")}"></div>`}
        <div class="field w-md" style="flex-basis:200px"><label for="x-client">For a client (optional)</label><select id="x-client" data-keep="no"><option value="">—</option>${clients.map(c=>`<option value="${esc(c.id)}" ${(E?E.clientId:(S.expKeep&&S.expKeep.c))===c.id?"selected":""}>${esc(dname(c))}</option>`).join("")}</select></div>
        ${!E&&cat!=="mileage"?`<div class="field w-md"><label for="x-rep">Repeats</label><select id="x-rep" data-keep="no"><option value="">Doesn't repeat</option><option value="monthly" ${S.expRep==="monthly"?"selected":""}>Every month</option><option value="yearly" ${S.expRep==="yearly"?"selected":""}>Every year</option></select></div>`:""}
        <div class="actions" style="align-self:flex-end">${E?`<button class="btn primary" type="submit">Save changes</button><button class="btn ghost" type="button" data-act="exp-cancel">Cancel</button>`:`<button class="btn primary" type="submit">Add expense</button>`}</div>
      </div>
      ${cat==="mileage"?`<p class="muted small" style="margin:0">Uses the IRS business rate for the trip's date: 72.5¢/mile through Jun 30, 2026 and 76¢ from Jul 1. Keep a note of the trip's purpose.</p>`:cat==="meals"?`<p class="muted small" style="margin:0">Business meals are generally 50% deductible, so half counts toward your expenses.</p>`:""}
    </form>
  </section>
  ${viewRecurring()}
  <section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Expenses in ${yr}</h2>${exps.length?`<button class="btn sm" data-act="exp-csv">Download CSV</button>`:""}</div>
    ${exps.length?`<div class="list">${exps.map(x=>`<div class="xrow${S.expEdit===x.id?" editing":""}">
      <span class="muted small num">${esc(fmtD(parse(x.date)))}</span>
      <span class="who"><b>${esc(x.vendor||catLabel(x.category))}${x.recurringId?` <span class="rep" title="Repeating expense">↻</span>`:""}</b><span class="muted small">${esc(catLabel(x.category))}${x.miles?" · "+esc(x.miles)+" mi":""}${x.clientId&&S.clients[x.clientId]?" · "+esc(dname(S.clients[x.clientId])):""}</span></span>
      <span class="num r">${money(x.amount)}</span>
      <span class="x"><button class="btn sm ghost" data-act="exp-edit" data-id="${esc(x.id)}">Edit</button>${S.expDel===x.id?`<button class="btn sm danger" data-act="exp-del" data-id="${esc(x.id)}">Delete?</button>`:`<button class="btn sm ghost" data-act="exp-del-ask" data-id="${esc(x.id)}" aria-label="Delete">✕</button>`}</span></div>`).join("")}</div>`
      :`<p class="muted small">No expenses logged for ${yr}. Software subscriptions, equipment, and business driving add up, and each one lowers the tax you owe.</p>`}
  </section>
  ${exps.length?`<section class="panel"><h2>By category</h2><div class="bars">${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="barrow"><span>${esc(catLabel(k))}</span><span class="track"><span class="fill exp" style="display:block;width:${(v/catmax*100).toFixed(1)}%"></span></span><span class="v num">${money0(v)}</span></div>`).join("")}</div></section>`:""}
  <section class="panel"><h2>Income by client</h2><div class="bars">${Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="barrow"><span>${esc(cname(c))}</span><span class="track"><span class="fill" style="display:block;width:${(v/cmax*100).toFixed(1)}%"></span></span><span class="v num">${money0(v)}</span></div>`).join("")||`<p class="muted">No invoices yet.</p>`}</div></section>
  <section class="panel"><h2>By month</h2>
    <div class="legend small"><span><i class="sw inc"></i>Billed</span><span><i class="sw exp"></i>Expenses</span></div>
    <div class="bars">${months.map(m=>`<div class="barrow two"><span>${MON[m]} ${yr}</span><span class="track2"><span class="track"><span class="fill" style="display:block;width:${((byM[m]||0)/mmax*100).toFixed(1)}%"></span></span><span class="track"><span class="fill exp" style="display:block;width:${((exM[m]||0)/mmax*100).toFixed(1)}%"></span></span></span><span class="v num">${money0(byM[m]||0)}<br><span class="muted">−${money0(exM[m]||0)}</span></span></div>`).join("")||`<p class="muted">Nothing yet.</p>`}</div>
    <p class="muted small" style="margin:12px 0 0">Income is grouped by the week each invoice covers. Drafts and invoices marked “Confirm” aren't counted. This is an estimate, not tax advice: your accountant and your Schedule C are the final word.</p></section>`;
}
function expCalc(){const el=$("#x-calc");if(!el)return;const m=+($("#x-miles")||{}).value||0;const d=($("#x-date")||{}).value||today();el.textContent=m?money(r2(m*mileRate(d)))+" at "+Math.round(mileRate(d)*1000)/10+"¢/mi":"—"}
function expCsv(){
  const yr=S.expYear;const rows=S.expenses.filter(x=>(x.date||"").startsWith(yr)).sort((a,b)=>a.date.localeCompare(b.date));
  const q=v=>{v=String(v??"");return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const lines=[["Date","Category","Vendor / description","Amount","Deductible amount","Miles","Client"].join(",")].concat(rows.map(x=>[x.date,catLabel(x.category),x.vendor||"",(+x.amount||0).toFixed(2),deductible(x).toFixed(2),x.miles||"",x.clientId&&S.clients[x.clientId]?dname(S.clients[x.clientId]):""].map(q).join(",")));
  saveBlob(new Blob([lines.join("\n")],{type:"text/csv"}),"Jono CRM expenses "+yr+".csv");
}

/* ---------- events ---------- */
function extrasAction(a,b){
  const D=S.cview||{};
  if(a==="deal-del-ask"){D.dealDel=b.dataset.id;render();return true}
  if(a==="deal-del"){write(db=>db.doc("deals/"+b.dataset.id).delete(),"Deal removed");return true}
  if(a==="exp-edit"){S.expEdit=b.dataset.id;S.expDel=null;S.expCat=null;render();window.scrollTo({top:0,behavior:"smooth"});return true}
  if(a==="exp-cancel"){S.expEdit=null;S.expCat=null;S.expKeep=null;render();return true}
  if(a==="exp-del-ask"){S.expDel=b.dataset.id;render();return true}
  if(a==="exp-del"){write(db=>db.doc("expenses/"+b.dataset.id).delete(),"Expense deleted").then(()=>{S.expDel=null});return true}
  if(a==="exp-csv"){expCsv();return true}
  return false;
}
document.addEventListener("click",e=>{const y=e.target.closest("#exp-year button[data-y]");if(y){S.expYear=y.dataset.y;S.expEdit=null;render()}});
document.addEventListener("input",e=>{if(e.target.id==="x-miles"||e.target.id==="x-date")expCalc()});
document.addEventListener("change",e=>{
  if(e.target.id==="x-cat"){const E=S.expEdit&&S.expenses.find(x=>x.id===S.expEdit);
    // switching category keeps what's typed in the other fields
    S.expKeep={v:($("#x-vendor")||{}).value,d:($("#x-date")||{}).value,c:($("#x-client")||{}).value};S.expCat=e.target.value;
    render();
    if(E){const v=$("#x-vendor"),d=$("#x-date"),c=$("#x-client");if(v)v.value=S.expKeep.v;if(d)d.value=S.expKeep.d;if(c)c.value=S.expKeep.c}
    S.expKeep=null;expCalc();return}
  const ds=e.target.closest("select[data-deal]");
  if(ds){const d=S.deals.find(x=>x.id===ds.dataset.deal);if(!d)return;const k=ds.value;const c=S.clients[d.clientId];
    const patch={stage:k,closed:k==="won"||k==="lost"?today():null};const promote=k==="won"&&c&&["prospect","lead"].includes(statusKey(c));
    write(async db=>{await db.doc("deals/"+d.id).update(patch);if(promote)await db.doc("clients/"+c.id).update({status:"client",active:true})},
      "Deal "+dealLabel(k).toLowerCase()+(promote?" · "+dname(c)+" is now a client":""));}
});
document.addEventListener("submit",async e=>{
  if(e.target.id==="f-deal"){e.preventDefault();const id=S.crmOpen;if(!id)return;const name=$("#d-name").value.trim();const value=+$("#d-val").value||0;
    if(!name){toast("Describe what you quoted.");$("#d-name").focus();return}
    await write(db=>db.doc("deals/"+uid()).set({clientId:id,name,value:r2(value),stage:"quoted",date:$("#d-date").value||today(),createdAt:new Date().toISOString(),by:S.me&&S.me.username}),"Deal added");return}
  if(e.target.id==="f-exp"){e.preventDefault();
    const cat=$("#x-cat").value,date=$("#x-date").value||today(),vendor=$("#x-vendor").value.trim();
    let amount,miles=null;
    if(cat==="mileage"){miles=+$("#x-miles").value||0;if(!(miles>0)){toast("Enter the miles driven.");$("#x-miles").focus();return}amount=r2(miles*mileRate(date))}
    else{amount=r2(+$("#x-amt").value||0);if(!(amount>0)){toast("Enter the amount.");$("#x-amt").focus();return}}
    const doc={date,category:cat,vendor,amount,miles,rate:cat==="mileage"?mileRate(date):null,clientId:$("#x-client").value||null};
    const id=S.expEdit||uid();const prev=S.expenses.find(x=>x.id===id);
    const full=Object.assign({},prev||{},doc,prev?{updatedAt:new Date().toISOString()}:{createdAt:new Date().toISOString(),by:S.me&&S.me.username});delete full.id;
    const rep=!prev&&cat!=="mileage"&&$("#x-rep")?$("#x-rep").value:"";
    if(rep){full.recurringId=id}
    const ok=await write(async db=>{await db.doc("expenses/"+id).set(full);
      if(rep)await db.doc("recurring/"+id).set({category:cat,vendor,amount,clientId:full.clientId,freq:rep,day:+date.slice(8,10),start:date,last:date,active:true,createdAt:new Date().toISOString(),by:S.me&&S.me.username})},
      (prev?"Updated ":"Logged ")+money(amount)+(cat==="mileage"?" for "+miles+" mi":"")+(rep?" · repeats every "+(rep==="monthly"?"month":"year"):""));
    if(ok){S.expEdit=null;S.expCat=cat;S.expKeep=null;S.expRep="";render();if(rep)runRecurring();const v=$("#x-vendor");if(v)v.focus()}}
});


/* ---------- invoice email text and signature (sending is turned off in the demo) ---------- */
function sigText(){const g=emailCfg();return [g.sigName,g.sigTitle,[g.sigPhone,g.sigEmail].filter(Boolean).join(" | ")].filter(Boolean).join("\n")}
// Same look as the Outlook signature; the server builds the real one from the saved settings.
function sigHtml(g){g=g||emailCfg();const e=esc;return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#141416"><tr><td style="padding-bottom:6px">
  ${g.sigName?`<div style="font-size:15px;font-weight:700">${e(g.sigName)}</div>`:""}${g.sigTitle?`<div style="font-size:13px;color:#55534e">${e(g.sigTitle)}</div>`:""}</td></tr>
  <tr><td style="border-top:2px solid #3b5bfd;padding-top:8px;font-size:13px">${g.sigPhone?`<span style="color:#3b5bfd">&#9742;</span> <span style="color:#141416">${e(g.sigPhone)}</span>`:""}${g.sigPhone&&g.sigEmail?` <span style="color:#3b5bfd">|</span> `:""}${g.sigEmail?`<span style="color:#3b5bfd">&#9993;</span> <a href="mailto:${e(g.sigEmail)}" style="color:#1a5fd0">${e(g.sigEmail)}</a>`:""}</td></tr></table>`}
function emailCfg(){return Object.assign({sigName:"",sigTitle:"",sigPhone:"",sigEmail:"",fromName:"",fromEmail:"",replyTo:"",bcc:true,bccTo:""},(S.settings||{}).email||{})}
async function checkEmail(){S.emailOK=false}
document.addEventListener("input",e=>{const d=S.drawer;if(!d||d.type!=="inv")return;
  if(e.target.id==="s-to")d.sendTo=e.target.value;if(e.target.id==="s-cc")d.sendCc=e.target.value;if(e.target.id==="s-subj")d.sendSubj=e.target.value;if(e.target.id==="s-body")d.sendBody=e.target.value});
document.addEventListener("input",e=>{if(!/^se-s/.test(e.target.id||""))return;const v=id=>($(id)||{value:""}).value.trim();
  const el=$("#sig-preview");if(el)el.innerHTML=sigHtml({sigName:v("#se-sname"),sigTitle:v("#se-stitle"),sigPhone:v("#se-sphone"),sigEmail:v("#se-semail")})});
// Downloading or emailing an invoice saves any unsaved "Projects worked on" edits first, so what goes out matches the screen.
async function saveNotesFirst(inv){const D=S.drawer;if(!D||D.draft||D.notes==null||D.notes===(inv.notes||""))return inv;
  const notes=D.notes;const ok=await write(db=>db.doc("invoices/"+inv.id).update({notes}),"Notes saved");if(!ok)return null;D.notes=null;
  return S.invoices.find(x=>x.id===inv.id)||Object.assign({},inv,{notes})}

/* ---------- repeating expenses ---------- */
const dim=(y,m)=>new Date(y,m+1,0).getDate();
function nextDue(r,from){const d=parse(from);let y=d.getFullYear(),m=d.getMonth();
  if(r.freq==="yearly")y++;else{m++;if(m>11){m=0;y++}}
  return iso(new Date(y,m,Math.min(r.day||1,dim(y,m))))}
// Logs any repeating expenses that have come due since they were last logged (catching up missed months).
let recurringRunning=false;
async function runRecurring(){
  if(recurringRunning)return;recurringRunning=true;
  try{
    const t=today();const ops=[];
    S.recurring.filter(r=>r.active!==false).forEach(r=>{let last=r.last||r.start,n=0;
      for(let d=nextDue(r,last);d<=t&&n<36;d=nextDue(r,d),n++){
        ops.push({op:"set",path:"expenses/rec-"+r.id+"-"+d,data:{date:d,category:r.category,vendor:r.vendor,amount:r.amount,miles:null,rate:null,clientId:r.clientId||null,recurringId:r.id,createdAt:new Date().toISOString(),auto:true}});last=d}
      if(last!==(r.last||r.start))ops.push({op:"update",path:"recurring/"+r.id,data:{last}})});
    if(!ops.length)return;
    await api("/api/data",{method:"POST",body:{ops}});applyLocal(ops);render();
    const n=ops.filter(o=>o.path.startsWith("expenses/")).length;toast("Logged "+n+" repeating expense"+(n===1?"":"s"));
  }catch(e){}finally{recurringRunning=false}
}
function viewRecurring(){
  const l=S.recurring.slice().sort((a,b)=>(b.active!==false)-(a.active!==false)||(a.vendor||"").localeCompare(b.vendor||""));
  if(!l.length)return"";
  const active=l.filter(r=>r.active!==false);const monthly=active.reduce((s,r)=>s+(r.freq==="yearly"?(+r.amount||0)/12:(+r.amount||0)),0);
  return `<section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Repeating expenses</h2>${active.length?`<span class="small muted">About <b class="num">${money(monthly)}</b> a month</span>`:""}</div>
    <div class="list">${l.map(r=>{const on=r.active!==false;return `<div class="xrow">
      <span class="small muted">${on?"Next "+esc(fmtD(parse(nextDue(r,r.last||r.start)))):"Stopped"}</span>
      <span class="who"><b>${esc(r.vendor||catLabel(r.category))}</b><span class="muted small">${esc(catLabel(r.category))} · every ${r.freq==="yearly"?"year":"month"} on the ${ordinal(r.day)}</span></span>
      <span class="num r">${S.recEdit===r.id?`<input id="rec-amt" type="number" step="0.01" min="0" value="${esc(r.amount)}" style="width:90px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg)">`:money(r.amount)}</span>
      <span class="x">${S.recEdit===r.id?`<button class="btn sm primary" data-act="rec-save" data-id="${esc(r.id)}">Save</button><button class="btn sm ghost" data-act="rec-cancel">Cancel</button>`
        :on?`<button class="btn sm ghost" data-act="rec-edit" data-id="${esc(r.id)}">Change amount</button><button class="btn sm ghost" data-act="rec-stop" data-id="${esc(r.id)}">Stop</button>`
        :`<button class="btn sm ghost" data-act="rec-resume" data-id="${esc(r.id)}">Resume</button><button class="btn sm ghost danger" data-act="rec-del" data-id="${esc(r.id)}">Remove</button>`}</span></div>`}).join("")}</div>
    <p class="muted small" style="margin:10px 0 0">Each one is logged automatically on its date the next time you open the app. Changing an amount or stopping only affects future months.</p></section>`;
}
const ordinal=n=>{n=+n||1;const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
document.addEventListener("change",e=>{if(e.target.id==="x-rep")S.expRep=e.target.value});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-act^='rec-']");if(!b)return;const a=b.dataset.act,id=b.dataset.id;
  if(a==="rec-edit"){S.recEdit=id;render();const el=$("#rec-amt");if(el){el.focus();el.select()}return}
  if(a==="rec-cancel"){S.recEdit=null;render();return}
  if(a==="rec-save"){const v=r2(+$("#rec-amt").value);if(!(v>0)){toast("Enter the new amount.");return}if(await write(db=>db.doc("recurring/"+id).update({amount:v}),"Amount updated for future months"))S.recEdit=null;render();return}
  if(a==="rec-stop"){write(db=>db.doc("recurring/"+id).update({active:false}),"Stopped. Past entries are kept.");return}
  if(a==="rec-resume"){const r=S.recurring.find(x=>x.id===id);let last=r.last||r.start;while(nextDue(r,last)<=today())last=nextDue(r,last);
    write(db=>db.doc("recurring/"+id).update({active:true,last}),"Resumed from the next due date");return}
  if(a==="rec-del"){write(db=>db.doc("recurring/"+id).delete(),"Removed. Past entries are kept.");return}
});
/* =====================================================================
   PROJECT BOARD (kanban): project components + standalone tasks as cards.
   A component's stage lives on the component; "done" stays in sync with its checkbox.
   Standalone tasks live in tasks/<id>, tagged to a client or to the studio team.
   ===================================================================== */
const STAGES=[["todo","To do","var(--ink-3)"],["doing","In progress","var(--accent)"],["waiting","Waiting on client","var(--warn)"],["payment","Need payment","var(--sky)"],["done","Done this week","var(--ok)"]];
const stageName=k=>(STAGES.find(s=>s[0]===k)||[,"To do"])[1];
S.projView=(()=>{try{return localStorage.getItem("jcrm-projview")||"board"}catch(e){return"board"}})();
S.bClient="";S.bProject="";S.bWeek=false;S.bShowOld=false;
const compStage=x=>x.done?"done":(x.stage&&x.stage!=="done"?x.stage:"todo");
const weekStart=()=>iso(monday(new Date()));

function boardItems(){
  const out=[];
  projList().filter(p=>p.status!=="done").forEach(p=>(p.components||[]).forEach(x=>out.push({kind:"comp",id:x.id,p,x,name:x.name,due:x.due||"",stage:compStage(x),doneDate:x.doneDate||"",stageAt:x.stageAt||"",clientId:p.clientId})));
  (S.tasks||[]).forEach(t=>out.push({kind:"task",id:t.id,t,name:t.name,due:t.due||"",stage:t.stage||"todo",doneDate:t.doneDate||"",stageAt:t.stageAt||"",clientId:t.clientId||""}));
  return out;
}
const forLabel=id=>id?(S.clients[id]?dname(S.clients[id]):"Client"):"Studio team";
function viewBoard(){
  const all=boardItems();const t=today(),ws=weekStart(),wk=iso(addDays(new Date(),7));
  let l=all.filter(i=>(!S.bClient||(S.bClient==="__me"?!i.clientId:i.clientId===S.bClient))&&(!S.bProject||(S.bProject==="__tasks"?i.kind==="task":i.p&&i.p.id===S.bProject))&&(!S.bWeek||i.stage==="done"||(i.due&&i.due<=wk)));
  // Chips only for who has open work: an open project (even one with no tasks yet) or an unfinished task.
  const clientsUsed=[...new Set([...all.filter(i=>i.stage!=="done").map(i=>i.clientId),...projList().filter(p=>p.status!=="done").map(p=>p.clientId)])];
  if(S.bClient&&!clientsUsed.includes(S.bClient==="__me"?"":S.bClient))clientsUsed.push(S.bClient==="__me"?"":S.bClient); // keep the selected one so it can be cleared
  const projs=projList().filter(p=>p.status!=="done").sort((a,b)=>a.name.localeCompare(b.name));
  const cols=STAGES.map(([k,label,color])=>{
    let items=l.filter(i=>i.stage===k);let older=0;
    if(k==="done"){const recent=items.filter(i=>(i.doneDate||"")>=ws);older=items.length-recent.length;if(!S.bShowOld)items=recent;items.sort((a,b)=>(b.doneDate||"").localeCompare(a.doneDate||""))}
    else items.sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")||a.name.localeCompare(b.name));
    return `<div class="kcol" data-stage="${k}"><div class="kcolh"><span><i class="dot" style="background:${color}"></i>${label}</span><span class="n">${items.length}</span></div>
      <div class="kdrop" data-stage="${k}">${items.map(i=>card(i,t)).join("")}${k!=="done"?`<form class="kadd" data-stage="${k}"><input placeholder="+ Add task" aria-label="Add a task to ${esc(label)}" data-keep="no"></form>`:""}</div>
      ${k==="done"&&older?`<button class="linkbtn small" data-act="b-old" style="padding:6px 8px">${S.bShowOld?"Show this week only":"Show older ("+older+")"}</button>`:""}</div>`}).join("");
  return `<section class="panel" style="padding:14px 16px">
    <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
      <div class="row" style="align-items:center;gap:12px"><h2 style="margin:0">Projects</h2>${viewToggle()}</div>
      <div class="row" style="gap:8px"><button class="btn" data-act="task-new">+ Task</button><button class="btn primary" data-act="proj-new">+ New project</button></div>
    </div>
    <div class="kfilters">
      <span class="small muted b">Show:</span>
      <button class="chip ${!S.bClient?"on":""}" data-bc="">All</button>
      ${clientsUsed.includes("")?`<button class="chip me ${S.bClient==="__me"?"on":""}" data-bc="__me">Studio team</button>`:""}
      ${clientsUsed.filter(Boolean).sort((a,b)=>forLabel(a).localeCompare(forLabel(b))).map(id=>`<button class="chip ${S.bClient===id?"on":""}" data-bc="${esc(id)}">${esc(forLabel(id))}</button>`).join("")}
      <select id="b-proj" aria-label="Project" data-keep="no"><option value="">All projects &amp; tasks</option><option value="__tasks" ${S.bProject==="__tasks"?"selected":""}>Standalone tasks only</option>${projs.map(p=>`<option value="${esc(p.id)}" ${S.bProject===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select>
      <button class="chip ${S.bWeek?"on":""}" data-act="b-week" style="margin-left:auto">Due in the next 7 days</button>
    </div>
  </section>
  <div class="kboard">${cols}</div>
  <p class="muted small" style="margin:0">Drag cards between columns, or use ⋯ on a card. Project cards are that project's components; dropping one in Done checks it off.</p>`;
}
function card(i,t){
  const late=i.stage!=="done"&&i.due&&i.due<t,soon=i.stage!=="done"&&i.due&&!late&&i.due<=iso(addDays(new Date(),1));
  const waitDays=i.stageAt&&(i.stage==="waiting"||i.stage==="payment")?Math.max(0,Math.round((parse(t)-parse(i.stageAt))/864e5)):null;
  const tagCls=i.clientId?cidx(i.clientId):"me";
  return `<div class="kcard ${i.stage==="done"?"isdone":""}" draggable="true" data-kind="${i.kind}" data-id="${esc(i.id)}" ${i.p?`data-pid="${esc(i.p.id)}"`:""} tabindex="0">
    <div class="kc-h"><b>${esc(i.name)}</b><button class="kmenu-btn" data-act="k-menu" aria-label="Move or edit">⋯</button></div>
    <div><span class="chip ${tagCls}">${esc(forLabel(i.clientId))}</span> <span class="small muted">${i.p?esc(i.p.name):"Task"}</span></div>
    <div class="kc-m small">${i.stage==="done"?`<span>Done ${i.doneDate?esc(fmtD(parse(i.doneDate))):""}</span>`
      :waitDays!=null?`<span class="wtag">${i.stage==="payment"?"Awaiting payment":"Waiting"} ${waitDays===0?"since today":waitDays+" day"+(waitDays===1?"":"s")}</span>`
      :i.due?`<span class="${late?"late":soon?"soon":""}">${late?"Overdue · ":"Due "}${esc(relDay(i.due))}</span>`:`<span class="muted">No due date</span>`}
      ${i.due&&(waitDays!=null)?`<span class="${late?"late":"muted"}">Due ${esc(fmtD(parse(i.due)))}</span>`:""}</div>
    ${S.kMenu===i.kind+":"+i.id?`<div class="kmenu">${STAGES.filter(s=>s[0]!==i.stage).map(([k,l])=>`<button data-act="k-move" data-stage="${k}">→ ${l}</button>`).join("")}
      <hr>${i.kind==="task"?`<button data-act="task-edit">Edit task</button>`:`<button data-act="k-open">Open project</button>`}</div>`:""}
  </div>`;
}
function viewToggle(){return `<div class="seg" id="proj-view"><button data-v="list" aria-pressed="${S.projView!=="board"}">List</button><button data-v="board" aria-pressed="${S.projView==="board"}">Board</button></div>`}

/* ---------- moving cards ---------- */
async function moveCard(kind,id,stage){
  const now=today();
  if(kind==="task"){const tk=S.tasks.find(x=>x.id===id);if(!tk||tk.stage===stage)return;
    return write(db=>db.doc("tasks/"+id).update({stage,stageAt:now,doneDate:stage==="done"?now:null}),"Moved to "+stageName(stage))}
  const p=projList().find(p=>(p.components||[]).some(x=>x.id===id));if(!p)return;
  const comps=(p.components||[]).map(x=>x.id!==id?x:Object.assign({},x,{stage,stageAt:now,done:stage==="done",doneDate:stage==="done"?(x.done?x.doneDate:now):null}));
  if(compStage(p.components.find(x=>x.id===id))===stage)return;
  return write(db=>db.doc("projects/"+p.id).update({components:comps,updatedAt:new Date().toISOString()}),"Moved to "+stageName(stage));
}
let dragging=null;
document.addEventListener("dragstart",e=>{const c=e.target.closest&&e.target.closest(".kcard");if(!c)return;dragging={kind:c.dataset.kind,id:c.dataset.id};c.classList.add("dragging");try{e.dataTransfer.setData("text/plain",c.dataset.id);e.dataTransfer.effectAllowed="move"}catch(err){}});
document.addEventListener("dragend",e=>{document.querySelectorAll(".kcard.dragging").forEach(c=>c.classList.remove("dragging"));document.querySelectorAll(".kdrop.over").forEach(d=>d.classList.remove("over"));dragging=null});
document.addEventListener("dragover",e=>{const d=e.target.closest&&e.target.closest(".kcol");if(!d||!dragging)return;e.preventDefault();document.querySelectorAll(".kdrop.over").forEach(x=>x!==d.querySelector(".kdrop")&&x.classList.remove("over"));d.querySelector(".kdrop").classList.add("over")});
document.addEventListener("drop",e=>{const d=e.target.closest&&e.target.closest(".kcol");if(!d||!dragging)return;e.preventDefault();const g=dragging;dragging=null;moveCard(g.kind,g.id,d.dataset.stage)});

/* ---------- task drawer ---------- */
function renderTaskDrawer(L,d){
  const tk=d.id?S.tasks.find(x=>x.id===d.id):null;const v=tk||{name:"",clientId:d.clientId??"",due:"",stage:d.stage||"todo"};
  const clients=Object.values(S.clients).filter(c=>statusKey(c)!=="dnc").sort((a,b)=>dname(a).localeCompare(dname(b)));
  L.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Task" style="width:min(100%,520px)">
    <div class="drawer-h"><h2>${tk?"Edit task":"New task"}</h2><button class="btn sm ghost" data-act="close">✕ Close</button></div>
    <div class="drawer-b"><form id="f-task" class="stack" autocomplete="off">
      <div class="field"><label for="t-name">Task</label><input id="t-name" value="${esc(v.name)}" placeholder="e.g. Update the studio website copy" required data-keep="no"></div>
      <div class="field"><label for="t-for">For</label><select id="t-for" data-keep="no"><option value="">Studio team</option>${clients.map(c=>`<option value="${esc(c.id)}" ${v.clientId===c.id?"selected":""}>${esc(dname(c))}</option>`).join("")}</select></div>
      <div class="row"><div class="field w-md"><label for="t-due">Due (optional)</label><input id="t-due" type="date" value="${esc(v.due||"")}" data-keep="no"></div>
        <div class="field w-md"><label for="t-stage">Column</label><select id="t-stage" data-keep="no">${STAGES.map(([k,l])=>`<option value="${k}" ${v.stage===k?"selected":""}>${l.replace(" this week","")}</option>`).join("")}</select></div></div>
      <div class="actions"><button class="btn primary" type="submit">${tk?"Save":"Add task"}</button><button class="btn ghost" type="button" data-act="close">Cancel</button>
        ${tk?(d.confirmDel?`<button class="btn danger" type="button" data-act="task-del" style="margin-left:auto">Delete?</button>`:`<button class="btn ghost danger" type="button" data-act="task-del-ask" style="margin-left:auto">Delete</button>`):""}</div>
      <p class="muted small" style="margin:0">To add a step to a client project instead, open the project and add a component.</p>
    </form></div></aside>`;
  setTimeout(()=>{const n=$("#t-name");if(n&&!tk)n.focus()},30);
}
async function saveTask(){
  const d=S.drawer;const name=$("#t-name").value.trim();if(!name){toast("Name the task.");$("#t-name").focus();return}
  const prev=d.id?S.tasks.find(x=>x.id===d.id):null;const stage=$("#t-stage").value;
  const doc=Object.assign({},prev||{},{name,clientId:$("#t-for").value,due:$("#t-due").value||"",stage,updatedAt:new Date().toISOString()});delete doc.id;
  if(!prev){doc.createdAt=new Date().toISOString();doc.by=S.me&&S.me.username}
  if(!prev||prev.stage!==stage){doc.stageAt=today();doc.doneDate=stage==="done"?today():null}
  const ok=await write(db=>db.doc("tasks/"+(d.id||uid())).set(doc),prev?"Task saved":"Task added");if(ok){S.drawer=null;renderDrawer()}
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const v=e.target.closest("#proj-view button[data-v]");if(v){S.projView=v.dataset.v;try{localStorage.setItem("jcrm-projview",S.projView)}catch(err){}render();return}
  const c=e.target.closest(".kfilters [data-bc]");if(c){S.bClient=c.dataset.bc;render();return}
  const b=e.target.closest("[data-act]");const a=b&&b.dataset.act;
  if(a==="b-week"){S.bWeek=!S.bWeek;render();return}
  if(a==="b-old"){S.bShowOld=!S.bShowOld;render();return}
  if(a==="task-new"){S.drawer={type:"task",id:"",clientId:S.bClient&&S.bClient!=="__me"?S.bClient:""};renderDrawer();return}
  if(a==="task-edit"){const k=b.closest(".kcard");S.kMenu=null;S.drawer={type:"task",id:k.dataset.id};render();return}
  if(a==="task-del-ask"){S.drawer.confirmDel=true;renderDrawer();return}
  if(a==="task-del"){const id=S.drawer.id;write(db=>db.doc("tasks/"+id).delete(),"Task deleted").then(ok=>{if(ok){S.drawer=null;renderDrawer()}});return}
  if(a==="k-menu"){e.stopPropagation();const k=b.closest(".kcard");const key=k.dataset.kind+":"+k.dataset.id;S.kMenu=S.kMenu===key?null:key;render();return}
  if(a==="k-move"){const k=b.closest(".kcard");S.kMenu=null;moveCard(k.dataset.kind,k.dataset.id,b.dataset.stage).then(()=>render());return}
  if(a==="k-open"){const k=b.closest(".kcard");S.kMenu=null;openProject(k.dataset.pid);return}
  // clicking the card itself opens it
  const kc=e.target.closest(".kcard");
  if(kc&&!e.target.closest(".kmenu,.kmenu-btn")){S.kMenu=null;if(kc.dataset.kind==="task"){S.drawer={type:"task",id:kc.dataset.id};render()}else openProject(kc.dataset.pid);return}
  if(S.kMenu&&!e.target.closest(".kmenu")){S.kMenu=null;render()}
});
document.addEventListener("keydown",e=>{const kc=e.target.closest&&e.target.closest(".kcard");if(kc&&e.key==="Enter"&&e.target===kc){kc.click()}});
document.addEventListener("change",e=>{if(e.target.id==="b-proj"){S.bProject=e.target.value;render()}});
document.addEventListener("submit",async e=>{
  if(e.target.id==="f-task"){e.preventDefault();await saveTask();return}
  const f=e.target.closest(".kadd");if(f){e.preventDefault();const inp=f.querySelector("input");const name=inp.value.trim();if(!name)return;
    const pid=S.bProject&&S.bProject!=="__tasks"?S.bProject:"";
    if(pid){const p=S.projects[pid];const comps=(p.components||[]).concat([{id:uid()+Math.random().toString(36).slice(2,5),name,due:"",done:false,stage:f.dataset.stage,stageAt:today()}]);
      await write(db=>db.doc("projects/"+pid).update({components:comps,updatedAt:new Date().toISOString()}),"Added to "+p.name)}
    else await write(db=>db.doc("tasks/"+uid()).set({name,clientId:S.bClient&&S.bClient!=="__me"?S.bClient:"",due:"",stage:f.dataset.stage,stageAt:today(),createdAt:new Date().toISOString(),by:S.me&&S.me.username}),"Task added");
    const again=document.querySelector(`.kadd[data-stage="${f.dataset.stage}"] input`);if(again)again.focus()}
});

document.addEventListener("click",e=>{const b=e.target.closest("[data-act='task-open']");if(!b)return;e.preventDefault();S.drawer={type:"task",id:b.dataset.id};renderDrawer()});

})();
