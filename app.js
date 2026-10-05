const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={profiles:[],profile:null,view:"overview",data:{},logs:[],live:null};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString("en-US");
const pct=(a,b)=>b?Math.round(a/b*100):0;
function toast(msg,ok=true){const d=document.createElement("div");d.className="toast "+(ok?"ok":"err");d.textContent=msg;$("#toast").append(d);setTimeout(()=>d.remove(),3200)}
async function api(path,{method="GET",body,query=""}={}){
  const r=await fetch("/api/nextdns?path="+encodeURIComponent(path)+(query?"&"+query:""),{method,headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});
  const t=await r.text(); let j={}; try{j=JSON.parse(t)}catch{}
  if(!r.ok) throw new Error(j?.errors?.[0]?.detail||j?.error||t||("HTTP "+r.status));
  return j;
}
async function streamLogs(){
  if(state.live) state.live.close();
  if(!state.profile)return;
  const u="/api/nextdns?path="+encodeURIComponent(`profiles/${state.profile}/logs/stream`);
  const es=new EventSource(u); state.live=es;
  es.onmessage=e=>{try{const x=JSON.parse(e.data);state.logs.unshift(x);state.logs=state.logs.slice(0,300); if(state.view==="logs")renderLogs()}catch{}};
  es.onerror=()=>{$("#liveBadge")?.replaceChildren(document.createTextNode("RECONNECTING"));setTimeout(()=>{if(state.view==="logs")streamLogs()},4000)};
}
async function loadProfiles(){
  try{
    const j=await api("profiles"); state.profiles=j.data||[];
    $("#profileSelect").innerHTML=state.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)}</option>`).join("");
    if(!state.profiles.length){$("#profileSelect").innerHTML="<option>No profiles</option>";return}
    state.profile=state.profile&&state.profiles.some(p=>p.id===state.profile)?state.profile:state.profiles[0].id;
    $("#profileSelect").value=state.profile; $("#apiStatus").textContent="API connected";$("#statusDot").classList.add("ok");
    await loadView();
  }catch(e){$("#apiStatus").textContent="API error";toast(e.message,false)}
}
async function profile(){return (await api("profiles/"+state.profile)).data}
async function analytics(kind,q="from=-1d&limit=12"){
  return (await api(`profiles/${state.profile}/analytics/${kind}`,{query:q})).data||[];
}
function statCard(label,val,sub,cls=""){return `<div class="card"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${val}</div><div class="stat-sub">${sub}</div></div>`}
function bars(items,labelKey,valueKey,limit=8){
  items=(items||[]).slice(0,limit);const max=Math.max(...items.map(x=>Number(x[valueKey]||0)),1);
  return `<div class="bar-list">${items.map(x=>`<div class="bar-row"><span>${esc(x[labelKey])}</span><div class="bar"><i style="width:${pct(x[valueKey],max)}%"></i></div><b>${fmt(x[valueKey])}</b></div>`).join("")}</div>`
}
async function renderOverview(){
  const [st,dom,dev,pro,enc]=await Promise.all([analytics("status"),analytics("domains"),analytics("devices"),analytics("protocols"),analytics("encryption")]);
  const total=st.reduce((a,x)=>a+Number(x.queries||0),0),blocked=st.filter(x=>x.status==="blocked").reduce((a,x)=>a+Number(x.queries||0),0);
  const p=await profile(); state.data.profile=p;
  $("#appContent").innerHTML=`<div class="grid stats">
  ${statCard("Queries / 24h",fmt(total),"All DNS requests","cyan")}
  ${statCard("Blocked",fmt(blocked),`${pct(blocked,total)}% of traffic`,"bad")}
  ${statCard("Protection rate",pct(blocked,total)+"%","Filtering activity","good")}
  ${statCard("Encrypted",pct(enc.filter(x=>x.encrypted).reduce((a,x)=>a+Number(x.queries||0),0),enc.reduce((a,x)=>a+Number(x.queries||0),0))+"%","DNS encryption","violet")}
  </div>
  <div class="grid two">
    <div class="card"><div class="section-head"><h2>Top domains</h2><span class="pill">24H</span></div>${bars(dom,"domain","queries")}</div>
    <div class="card"><div class="section-head"><h2>Protocols</h2><span class="pill">TRAFFIC</span></div>${bars(pro,"protocol","queries")}</div>
  </div>
  <div class="grid two">
    <div class="card"><div class="section-head"><h2>Devices</h2><span class="pill">${dev.length}</span></div>${bars(dev,"name","queries")}</div>
    <div class="card"><div class="section-head"><h2>Security posture</h2><span class="pill">${esc(p.name||state.profile)}</span></div>
      ${toggleRows(p.security||{})}
    </div>
  </div>`;
}
function toggleRows(o){return Object.entries(o).filter(([k,v])=>typeof v==="boolean").slice(0,8).map(([k,v])=>`<div class="toggle"><span>${esc(k)}</span><b class="${v?"good":"bad"}">${v?"ON":"OFF"}</b></div>`).join("")}
async function renderAnalytics(){
  const kinds=["status","domains","reasons","devices","protocols","queryTypes","ipVersions","dnssec","encryption"];
  const out=await Promise.all(kinds.map(k=>analytics(k,"from=-7d&limit=10")));
  const total=(out[0]||[]).reduce((a,x)=>a+Number(x.queries||0),0);
  $("#appContent").innerHTML=`<div class="card"><div class="section-head"><h2>7-day traffic intelligence</h2><span class="pill">AUTO REFRESH MANUALLY</span></div>
    <div class="grid three">
      <div><div class="stat-label">Total queries</div><div class="stat-value">${fmt(total)}</div></div>
      <div><div class="stat-label">Blocked</div><div class="stat-value bad">${fmt((out[0]||[]).find(x=>x.status==="blocked")?.queries||0)}</div></div>
      <div><div class="stat-label">Unique domains</div><div class="stat-value cyan">${fmt((out[1]||[]).length)}</div></div>
    </div></div>
    <div class="grid two">${[
      ["Status",out[0],"status"],["Top domains",out[1],"domain"],["Block reasons",out[2],"name"],["Devices",out[3],"name"],
      ["Protocols",out[4],"protocol"],["Query types",out[5],"name"],["IP versions",out[6],"version"],["DNSSEC",out[7],"validated"],["Encryption",out[8],"encrypted"]
    ].map(([t,d,k])=>`<div class="card"><div class="section-head"><h2>${t}</h2></div>${bars(d,k,"queries",7)}</div>`).join("")}</div>`;
}
async function renderLogs(){
  const q=new URLSearchParams({from:"-6h",limit:"100",raw:"0"}); const j=await api(`profiles/${state.profile}/logs`,{query:q.toString()});
  state.logs=j.data||[];
  $("#appContent").innerHTML=`<div class="card"><div class="section-head"><h2>Live DNS logs <span class="pill" id="liveBadge">● LIVE</span></h2><button class="btn" id="clearLogBtn">Clear local view</button></div>
  <div class="log-tools"><input id="logSearch" placeholder="Search domain…"><select id="logStatus"><option value="">All statuses</option><option>blocked</option><option>allowed</option><option>default</option><option>error</option></select><button class="btn primary" id="applyLog">Filter</button></div>
  <div id="logTable" class="log-stream"></div></div>`;
  $("#clearLogBtn").onclick=()=>{state.logs=[];renderLogRows()};
  $("#applyLog").onclick=renderLogRows; renderLogRows(); streamLogs();
}
function renderLogRows(){
  const s=($("#logSearch")?.value||"").toLowerCase(), st=$("#logStatus")?.value||"";
  const rows=state.logs.filter(x=>(!s||String(x.domain).toLowerCase().includes(s))&&(!st||x.status===st)).slice(0,300);
  $("#logTable").innerHTML=rows.length?rows.map(x=>`<div class="log-row"><span class="muted">${new Date(x.timestamp).toLocaleTimeString()}</span><span class="domain">${esc(x.domain)}</span><span class="status ${esc(x.status)}">${esc(x.status)}</span><span>${esc(x.protocol||"—")}</span></div>`).join(""):`<div class="empty">No logs found.</div>`;
}
async function renderDevices(){
  const d=await analytics("devices","from=-7d&limit=100");
  $("#appContent").innerHTML=`<div class="card"><div class="section-head"><h2>Known devices</h2><span class="pill">${d.length} DEVICES</span></div><table><thead><tr><th>Device</th><th>Model</th><th>ID</th><th>Queries</th></tr></thead><tbody>${d.map(x=>`<tr><td>${esc(x.name||"Unidentified")}</td><td>${esc(x.model||"—")}</td><td class="domain">${esc(x.id)}</td><td>${fmt(x.queries)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function renderLists(){
  const p=await profile(); const allow=p.allowlist||[],deny=p.denylist||[];
  const list=(title,arr,type)=>`<div class="card"><div class="section-head"><h2>${title}</h2><span class="pill">${arr.length}</span></div><div class="form-row"><input class="text" id="${type}Input" placeholder="example.com"><button class="btn primary" data-add="${type}">Add</button></div><div style="margin-top:12px"><table><tbody>${arr.map(x=>`<tr><td class="domain">${esc(x.id)}</td><td>${x.active?"<span class='good'>ACTIVE</span>":"<span class='muted'>OFF</span>"}</td><td style="text-align:right"><button class="btn danger" data-del="${type}" data-id="${esc(x.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div></div>`;
  $("#appContent").innerHTML=`<div class="grid two">${list("Allowlist",allow,"allowlist")}${list("Denylist",deny,"denylist")}</div>`;
  $$("[data-add]").forEach(b=>b.onclick=async()=>{const type=b.dataset.add,v=$("#"+type+"Input").value.trim();if(!v)return;try{await api(`profiles/${state.profile}/${type}`,{method:"POST",body:{id:v,active:true}});toast("Domain added");renderLists()}catch(e){toast(e.message,false)}});
  $$("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete "+b.dataset.id+"?"))return;try{await api(`profiles/${state.profile}/${b.dataset.del}/${encodeURIComponent(b.dataset.id)}`,{method:"DELETE"});toast("Domain deleted");renderLists()}catch(e){toast(e.message,false)}});
}
async function renderSection(section){
  const p=await profile(), obj=p[section]||{};
  const title=section==="parentalControl"?"Parental Control":section[0].toUpperCase()+section.slice(1);
  $("#appContent").innerHTML=`<div class="card"><div class="section-head"><h2>${title}</h2><button class="btn primary" id="saveSection">Save changes</button></div>
  <div class="grid two">${Object.entries(obj).map(([k,v])=>typeof v==="boolean"?`<label class="toggle"><span>${esc(k)}</span><input type="checkbox" data-key="${esc(k)}" ${v?"checked":""}></label>`:`<div class="card"><div class="stat-label">${esc(k)}</div><div class="code">${esc(JSON.stringify(v,null,2))}</div></div>`).join("")}</div></div>`;
  $("#saveSection").onclick=async()=>{const patch={};$$("[data-key]").forEach(i=>patch[i.dataset.key]=i.checked);try{await api(`profiles/${state.profile}/${section}`,{method:"PATCH",body:patch});toast("Settings saved");renderSection(section)}catch(e){toast(e.message,false)}};
}
async function renderSettings(){
  const p=await profile();
  $("#appContent").innerHTML=`<div class="card"><div class="section-head"><h2>Complete profile object</h2><div class="actions"><button class="btn" id="reloadJson">Reload</button><button class="btn primary" id="saveJson">PATCH profile</button></div></div>
  <p class="muted tiny">Advanced mode. Edit only properties supported by the NextDNS API.</p><textarea class="text" id="jsonEditor">${esc(JSON.stringify(p,null,2))}</textarea></div>`;
  $("#reloadJson").onclick=renderSettings;
  $("#saveJson").onclick=async()=>{try{const body=JSON.parse($("#jsonEditor").value);delete body.id;await api(`profiles/${state.profile}`,{method:"PATCH",body});toast("Profile updated");renderSettings()}catch(e){toast(e.message,false)}};
}
const views={overview:renderOverview,analytics:renderAnalytics,logs:renderLogs,devices:renderDevices,lists:renderLists,security:()=>renderSection("security"),privacy:()=>renderSection("privacy"),parental:()=>renderSection("parentalControl"),performance:()=>renderSection("settings")};
async function loadView(){
  $("#viewTitle").textContent=({parental:"Parental",performance:"Performance"}[state.view]||state.view[0].toUpperCase()+state.view.slice(1));
  try{await (views[state.view]||renderSettings)();$("#lastSync").textContent="Synced "+new Date().toLocaleTimeString()}catch(e){$("#appContent").innerHTML=`<div class="card"><div class="empty">Unable to load this section.<br><br><span class="bad">${esc(e.message)}</span></div></div>`;toast(e.message,false)}
}
$$(".nav-item").forEach(b=>b.onclick=()=>{$$(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.view=b.dataset.view;loadView()});
$("#profileSelect").onchange=()=>{state.profile=$("#profileSelect").value;loadView()};
$("#refreshBtn").onclick=loadProfiles;
$("#themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.theme=document.body.classList.contains("light")?"light":"dark"};
if(localStorage.theme==="light")document.body.classList.add("light");
loadProfiles();
