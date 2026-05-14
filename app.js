const SUPABASE_URL  = "https://qyxdjdwgvwtrpnvfndnu.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5eGRqZHdndnd0cnBudmZuZG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQyMTksImV4cCI6MjA5NDA4MDIxOX0.nNEp-TRiLySqsJ4gWbA4trIBLt5msRV5Upc21DsNlIg";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
const MANUAL_STATUSES = ["Draft","Under Review","Signings","Signed"];

function genId(prefix) {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,"");
  return `${prefix}-${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}
async function logActivity(module, action, recordId, details) {
  try {
    await sb.from("activity_logs").insert({user_name:currentUser||"system",module,action,record_id:recordId||null,details:details||null});
  } catch(e) { /* silent */ }
}
async function insertNotif(recipient, module, recordId, message) {
  if (!recipient || recipient === currentUser) return;
  try {
    await sb.from("notifications").insert({recipient,module,record_id:recordId||null,message,is_read:false});
  } catch(e) { /* silent */ }
}
function sortBy(rows, col, dir) {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    let av = a[col] ?? "", bv = b[col] ?? "";
    const na = parseFloat(av), nb = parseFloat(bv);
    if (!isNaN(na) && !isNaN(nb) && String(av) !== "" && String(bv) !== "") return dir==='asc'?na-nb:nb-na;
    return dir==='asc' ? String(av).localeCompare(String(bv),'id') : String(bv).localeCompare(String(av),'id');
  });
}
function updateSortTh(theadId, col, dir) {
  document.querySelectorAll('#'+theadId+' th[data-col]').forEach(th=>{
    const a=th.querySelector('.sa'); if(a) a.remove();
    if(th.dataset.col===col){const s=document.createElement('span');s.className='sa';s.textContent=dir==='asc'?' ↑':' ↓';th.appendChild(s);}
  });
}
// Sort state per module
let agrSort={col:null,dir:'asc'}, ipSort={col:null,dir:'asc'}, rrSort={col:null,dir:'asc'};
let bmSort={col:null,dir:'asc'}, ldSort={col:null,dir:'asc'}, dpSort={col:null,dir:'asc'}, logSort={col:'ts',dir:'desc'};
function sortAgrBy(c){agrSort.dir=agrSort.col===c?(agrSort.dir==='asc'?'desc':'asc'):'asc';agrSort.col=c;applyFilters();}
function sortIPBy(c){ipSort.dir=ipSort.col===c?(ipSort.dir==='asc'?'desc':'asc'):'asc';ipSort.col=c;applyIPFilters();}
function sortRRBy(c){rrSort.dir=rrSort.col===c?(rrSort.dir==='asc'?'desc':'asc'):'asc';rrSort.col=c;applyRRFilters();}
function sortBMBy(c){bmSort.dir=bmSort.col===c?(bmSort.dir==='asc'?'desc':'asc'):'asc';bmSort.col=c;applyBMFilters();}
function sortLDBy(c){ldSort.dir=ldSort.col===c?(ldSort.dir==='asc'?'desc':'asc'):'asc';ldSort.col=c;applyLeadsFilters();}
function sortDPBy(c){dpSort.dir=dpSort.col===c?(dpSort.dir==='asc'?'desc':'asc'):'asc';dpSort.col=c;applyDPFilters();}
function sortLogBy(c){logSort.dir=logSort.col===c?(logSort.dir==='asc'?'desc':'asc'):'asc';logSort.col=c;applyLogFilters();}
function mapAgr(r) { return {rowIndex:r.id,id:r.id,title:r.title||"",partner:r.partner||"",pic:r.pic||"",brand:r.brand||"",revenue:r.revenue||"",type:r.type||"",start:r.start_date||"",end:r.end_date||"",status:r.status||"Draft",link:r.link||"",emailLink:r.email_link||"",notes:r.notes||"",lastUpdate:r.last_updated?new Date(r.last_updated).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"",lastBy:r.last_updated_by||"",addedBy:r.submitted_by||""}; }
function mapIP(r) { return {rowIndex:r.id,id:r.id,name:r.name||"",category:r.category||"",liveStatus:r.live_status||"Active",revenue:r.revenue_stream||"",agreements:r.related_agreement||"",royaltyType:r.royalty_type||"",pct:r.percentage||"",fixed:r.fixed_amount||"",termin:r.termin||"",pph:r.pph_tax_rate||"",notes:r.notes||"",pic:r.pic||"",ipStatus:"",addedBy:r.added_by||""}; }
function mapRR(r) { return {rowIndex:r.id,id:r.id,name:r.nama||"",tipe:r.tipe||"",ip:r.related_ip||"",royaltyType:r.royalty_type||"",pct:r.percentage||"",fixed:r.fixed_amount||"",termin:r.termin||"",pks:r.pks||"",notes:r.notes||"",pic:r.pic||"",addedBy:r.added_by||""}; }
function mapBM(r) { return {rowIndex:r.id,id:r.id,name:r.name||"",category:r.category||"",liveStatus:r.live_status||"Active",revenue:r.revenue_stream||"",agreements:r.related_agreement||"",apparel:r.apparel_rate!=null?r.apparel_rate:"",accessories:r.accessories_rate!=null?r.accessories_rate:"",collectible:r.collectible_rate!=null?r.collectible_rate:"",preloved:r.preloved_rate!=null?r.preloved_rate:"",wellness:r.wellness_rate!=null?r.wellness_rate:"",others:r.others_rate!=null?r.others_rate:"",notes:r.notes||"",pic:r.pic||"",addedBy:r.added_by||""}; }
function mapLD(r) { return {rowIndex:r.id,id:r.id,name:r.lead_name||"",category:r.category||"",stage:r.stage||"",pic:r.pic||"",revenue:r.revenue_stream||"",contact:r.contact||"",notes:r.notes||"",priority:r.priority||"",date:r.date_added?new Date(r.date_added).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"",by:r.added_by||"",lastUpdate:r.last_updated?new Date(r.last_updated).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"",lastBy:r.last_updated_by||"",addedBy:r.added_by||""}; }
function mapDP(r) { return {rowIndex:r.id,id:r.id,name:r.partner_name||"",type:r.type||"",channel:r.channel||"",region:r.region||"",pic:r.pic||"",contactPerson:r.contact_person||"",contactInfo:r.contact_info||"",agreements:r.related_agreement||"",liveStatus:r.live_status||"Active",notes:r.notes||"",addedBy:r.added_by||""}; }
function mapPB(r) { return {rowIndex:r.id,id:r.id,eventDate:r.event_date||"",eventName:r.event_name||"",location:r.location||"",ipRelated:r.ip_related||"",manpower:r.manpower||"",suratJalanUrl:r.surat_jalan_url||"",deliveryStatus:r.delivery_status||"",eventStatus:r.event_status||"",reinboundStatus:r.reinbound_status||"",reinboundQty:r.reinbound_qty!=null?r.reinbound_qty:"",srDeadline:r.sr_deadline||"",actualSales:r.actual_sales!=null?r.actual_sales:"",paymentMethod:r.payment_method||"",idPesananJubelio:r.id_pesanan_jubelio||"",notes:r.notes||"",dateAdded:r.date_added||"",addedBy:r.added_by||"",lastUpdated:r.last_updated||"",lastUpdatedBy:r.last_updated_by||""}; }

let currentUser = "";
let allRows = [], acBrands = [], acTypes = [], acPics = [];
let allIPRows = [], acAgrOptions = [], acIPCategories = ["Musician","Brand","Filmmaker"];
let acAgrLinks = {}; // agrId -> driveLink
let allRRRows = [], acRRTipes = [], acRRIPs = [];

function fmtDate(val) {
  if (!val) return "—";
  const s = String(val);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) { const d = new Date(iso[0]+"T00:00:00"); return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); }
  return s;
}

function parseDate(val) {
  if (!val || val === "—") return null;
  let d = new Date(val); if (!isNaN(d)) return d;
  const m = String(val).match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (m) { d = new Date(`${m[2]} ${m[1]}, ${m[3]}`); if (!isNaN(d)) return d; }
  return null;
}

function autoStatus(row) {
  const endDate = parseDate(row.end); if (!endDate) return "";
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((endDate - now) / (1000*60*60*24));
  if (diff < 0) return "Expired";
  if (diff <= 30) return "Near Expiring";
  if (row.status === "Signed") return "Active";
  return "";
}

function pillClass(s) {
  return {"Draft":"p-draft","Under Review":"p-review","Signings":"p-signings","Signed":"p-signed","Active":"p-active","Near Expiring":"p-near","Expired":"p-expired","Inactive":"p-inactive","In Progress":"p-signings","No Agreement":"p-review"}[s]||"p-draft";
}

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  const err   = document.getElementById("loginErr");
  const btn   = document.getElementById("loginBtn");
  if (!email || !pass) { err.textContent = "Email dan password wajib diisi."; return; }
  err.textContent = "";
  btn.disabled = true; btn.textContent = "Memuat...";
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false; btn.textContent = "Masuk →";
  if (error) { err.textContent = "Login gagal: " + (error.message || "Periksa email & password."); return; }
  enterApp(data.user);
}

function enterApp(user) {
  const name = user.user_metadata?.name || user.email.split("@")[0];
  currentUser = name;
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("userName").textContent = name;
  document.getElementById("greetName").textContent = name.split(" ")[0];
  document.getElementById("greetDate").textContent = new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  loadStats();
  preloadAutocomplete();
  logActivity("Auth","login",null,"Login berhasil");
  loadNotifications();
  if (notifPollTimer) clearInterval(notifPollTimer);
  notifPollTimer = setInterval(loadNotifications, 60000);
  const _pg = location.hash.slice(1).split('/')[0];
  if (['agreement','ipmaster','recipients','brandmaster','salesreport','leads','distpartner','popupbooth','activitylog','jubsales','mesign','collections','designermaster','dsgworkflow'].includes(_pg))
    showPage(_pg, document.getElementById('nav-'+_pg));
}

async function doLogout() {
  await logActivity("Auth","logout",null,"Logout");
  await sb.auth.signOut();
  history.replaceState(null, "", location.pathname);
  if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
  currentUser = ""; allRows = [];
  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "grid";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginErr").textContent = "";
}

function showPage(name, el) {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".sb-item").forEach(i=>i.classList.remove("active"));
  document.getElementById("page-"+name).classList.add("active");
  if (el) el.classList.add("active");
  const labels = {home:"Internal Tools",agreement:"Agreement Tracker",ipmaster:"IP Master",recipients:"Royalty Recipients",brandmaster:"Brand Master",salesreport:"Account Report",leads:"Leads Management",distpartner:"Distribution Partner",popupbooth:"Pop Up Booth",activitylog:"Activity Log",jubsales:"Jubelio Offline Sales",mesign:"Inbound/Outbound Note",collections:"Collection Development",designermaster:"Designer Master",dsgworkflow:"Designer Workflow"};
  document.getElementById("topbarPage").textContent = labels[name]||name;
  history.replaceState(null, "", name==="home" ? location.pathname : "#"+name);
  if (name==="agreement") loadStats();
  if (name==="ipmaster") { loadIPMaster(); loadStats(); }
  if (name==="recipients") loadRecipients();
  if (name==="brandmaster") loadBrandMaster();
  if (name==="salesreport") loadSalesReport();
  if (name==="leads") loadLeads();
  if (name==="distpartner") loadDistPartner();
  if (name==="popupbooth") loadPopupBooth();
  if (name==="activitylog") loadActivityLog();
  if (name==="jubsales") loadJubSales();
  if (name==="mesign") loadMekariEsign();
  if (name==="po") loadPO();
  if (name==="collections") { loadCollections(); setupAC("col-ip","ac-col-ip",()=>allIPRows.map(r=>r.name).filter(Boolean)); setupAC("col-pic","ac-col-pic",()=>[...new Set(allColRows.map(r=>r.pic).filter(Boolean))]); }
  if (name==="designermaster") { loadDesignerMaster(); const cats=[...new Set([...DSG_CATEGORIES_DEFAULT,...allDsgRows.map(r=>r.category).filter(Boolean)])]; setupAC("dsg-category","ac-dsg-category",()=>cats); }
  if (name==="dsgworkflow") loadDsgWorkflow();
  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebar-overlay");
  if (!sb) return;
  const open = sb.classList.toggle("open");
  if (ov) ov.classList.toggle("active", open);
}
function closeMobileSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebar-overlay");
  if (sb) sb.classList.remove("open");
  if (ov) ov.classList.remove("active");
}

function switchTab(name, el) {
  document.querySelectorAll("#page-agreement .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("tab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("tab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadAgreements();
}

function switchIpTab(name, el) {
  document.querySelectorAll("#page-ipmaster .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("iptab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("iptab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadIPMaster();
}

function switchRRTab(name, el) {
  document.querySelectorAll("#page-recipients .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("rrtab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("rrtab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadRecipients();
}

function setupAC(inpId, lstId, getOpts, getRichOpts) {
  const inp = document.getElementById(inpId), lst = document.getElementById(lstId);
  if (!inp || !lst) return;
  inp.addEventListener("input",  () => renderAC(lst, inp, getOpts(), getRichOpts?getRichOpts():null));
  inp.addEventListener("focus",  () => { if (getOpts().length) renderAC(lst, inp, getOpts(), getRichOpts?getRichOpts():null); });
  document.addEventListener("click", e => { if (!inp.contains(e.target)&&!lst.contains(e.target)) lst.style.display="none"; });
}

function renderAC(lst, inp, opts, richOpts) {
  const q = inp.value.toLowerCase();
  let html = "";
  if (richOpts) {
    const m = richOpts.filter(o=>o.label.toLowerCase().includes(q)||o.id.toLowerCase().includes(q));
    html = m.map(o=>`<div class="ac-item" onclick="pickAC('${o.id.replace(/'/g,"\\'")}','${inp.id}','${lst.id}')"><div>${o.id}</div><div class="ac-item-sub">${o.label}</div></div>`).join("");
  } else {
    const m = opts.filter(o=>o.toLowerCase().includes(q));
    html = m.map(o=>`<div class="ac-item" onclick="pickAC('${o.replace(/'/g,"\\'")}','${inp.id}','${lst.id}')">${o}</div>`).join("");
  }
  if (inp.value.trim()&&!opts.includes(inp.value.trim())) {
    html += `<div class="ac-add" onclick="pickAC('${inp.value.trim().replace(/'/g,"\\'")}','${inp.id}','${lst.id}')">+ Tambah "${inp.value.trim()}"</div>`;
  }
  if (!html) { lst.style.display="none"; return; }
  lst.innerHTML=html; lst.style.display="block";
}

function pickAC(val, inpId, lstId) {
  document.getElementById(inpId).value = val;
  document.getElementById(lstId).style.display = "none";
  if (inpId==="rr-tipe") togglePKS();
}

setupAC("f-brand","ac-brand",()=>acBrands);
setupAC("f-type","ac-type",()=>acTypes);
setupAC("f-pic","ac-pic",()=>acPics);
setupAC("ip-agreements","ac-ip-agr",()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);
setupAC("ip-category","ac-ip-category",()=>acIPCategories);
setupAC("ip-pic","ac-ip-pic",()=>acPics);
setupAC("rr-tipe","ac-rr-tipe",()=>acRRTipes);
setupAC("rr-ip","ac-rr-ip",()=>acRRIPs);
setupAC("rr-pic","ac-rr-pic",()=>acPics);

// ── AGREEMENT ──
function computeStats(rows) {
  const count = fn=>rows.filter(fn).length;
  document.getElementById("s-total").textContent    = rows.length;
  document.getElementById("s-draft").textContent    = count(r=>r.status==="Draft");
  document.getElementById("s-review").textContent   = count(r=>r.status==="Under Review");
  document.getElementById("s-signings").textContent = count(r=>r.status==="Signings");
  document.getElementById("s-signed").textContent   = count(r=>r.status==="Signed");
  document.getElementById("s-near").textContent     = count(r=>autoStatus(r)==="Near Expiring");
  document.getElementById("s-expired").textContent  = count(r=>autoStatus(r)==="Expired");
}

async function loadStats() {
  try {
    const {data,error} = await sb.from("agreements").select("*").order("id");
    if (error) throw error;
    const rows = (data||[]).map(mapAgr);
    computeStats(rows);
    acAgrOptions = rows.map(r=>({id:r.id,label:[r.partner,r.type].filter(Boolean).join(" — ")}));
    acAgrLinks = {}; rows.forEach(r=>{ if(r.id&&r.link) acAgrLinks[r.id]=r.link; });
    if(!acBrands.length) { acBrands=[...new Set(rows.map(r=>r.brand).filter(Boolean))]; acTypes=[...new Set(rows.map(r=>r.type).filter(Boolean))]; acPics=[...new Set(rows.map(r=>r.pic).filter(Boolean))]; }
  } catch(e) {}
}

async function submitAgreement() {
  const req = [["f-title","Agreement Title"],["f-partner","Partner / Client"],["f-pic","PIC"],["f-brand","Related IP / Brand"],["f-revenue","Revenue Stream"],["f-type","Agreement Type"],["f-status","Status"]];
  for (const [id,label] of req) { if (!document.getElementById(id).value.trim()) { showFeedback(label+" wajib diisi.","err"); document.getElementById(id).focus(); return; } }
  const btn = document.getElementById("submitBtn");
  btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id = genId("AGR");
    const row = {id,title:document.getElementById("f-title").value.trim(),partner:document.getElementById("f-partner").value.trim(),pic:document.getElementById("f-pic").value.trim(),brand:document.getElementById("f-brand").value.trim(),revenue:document.getElementById("f-revenue").value,type:document.getElementById("f-type").value.trim(),status:document.getElementById("f-status").value,start_date:document.getElementById("f-start").value||null,end_date:document.getElementById("f-end").value||null,link:document.getElementById("f-link").value.trim(),email_link:document.getElementById("f-email-link").value.trim(),notes:document.getElementById("f-notes").value.trim(),submitted_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser};
    const {error} = await sb.from("agreements").insert(row);
    if (error) throw error;
    showFeedback("✓ Agreement tersimpan — ID: "+id,"ok");
    logActivity("Agreement","create",id,row.title+" — "+row.partner);
    insertNotif(row.pic,"Agreement",id,`${currentUser} menambahkan kamu sebagai PIC di Agreement: ${row.title}`);
    if (!acBrands.includes(row.brand)) acBrands.push(row.brand);
    if (!acTypes.includes(row.type))   acTypes.push(row.type);
    if (!acPics.includes(row.pic))     acPics.push(row.pic);
    clearForm(); loadStats();
  } catch(e) { showFeedback("Gagal: "+(e.message||e),"err"); }
  btn.disabled=false; btn.textContent="Submit Agreement";
}

function clearForm() {
  ["f-title","f-partner","f-pic","f-brand","f-type","f-start","f-end","f-link","f-email-link","f-notes"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("f-status").value=""; document.getElementById("f-revenue").value="";
}

function showFeedback(msg,type) {
  const el=document.getElementById("feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok") setTimeout(()=>el.className="feedback",6000);
}

async function loadAgreements() {
  document.getElementById("tableBody").innerHTML=`<tr><td class="empty-td" colspan="16">Memuat data...</td></tr>`;
  try {
    const {data,error} = await sb.from("agreements").select("*").order("id");
    if (error) throw error;
    allRows=(data||[]).map(mapAgr);
    acTypes=[...new Set(allRows.map(r=>r.type).filter(Boolean))];
    acPics=[...new Set(allRows.map(r=>r.pic).filter(Boolean))];
    acAgrOptions=allRows.map(r=>({id:r.id,label:[r.partner,r.type].filter(Boolean).join(" — ")}));
    acAgrLinks={}; allRows.forEach(r=>{if(r.id&&r.link)acAgrLinks[r.id]=r.link;});
    const agrBrands=[...new Set(allRows.map(r=>r.brand).filter(Boolean))];
    const ipBM=[...new Set([...allIPRows.map(r=>r.name),...allBMRows.map(r=>r.name)].filter(Boolean))];
    acBrands = ipBM.length ? [...new Set([...ipBM,...agrBrands])] : agrBrands;
    populateFilterDropdowns(); applyFilters(); computeStats(allRows);
  } catch(e) { document.getElementById("tableBody").innerHTML=`<tr><td class="empty-td" colspan="14">Gagal: ${e.message}</td></tr>`; }
}

function populateFilterDropdowns() {
  const setOpts=(id,vals)=>{const sel=document.getElementById(id);if(!sel)return;const cur=sel.value;while(sel.options.length>1)sel.remove(1);vals.forEach(v=>{const o=document.createElement("option");o.value=o.textContent=v;sel.appendChild(o);});if(cur)sel.value=cur;};
  setOpts("fil-brand",acBrands); setOpts("fil-pic",acPics); setOpts("fil-type",acTypes);
}

function applyFilters() {
  const q=( document.getElementById("searchBox").value||"").toLowerCase();
  const fStatus=document.getElementById("fil-status").value,fAuto=document.getElementById("fil-auto").value,fRev=document.getElementById("fil-revenue").value,fBrand=document.getElementById("fil-brand").value,fPic=document.getElementById("fil-pic").value,fType=document.getElementById("fil-type").value;
  ["fil-status","fil-auto","fil-revenue","fil-brand","fil-pic","fil-type"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);});
  const filtered=allRows.filter(r=>{
    const as=autoStatus(r);
    if(q&&![r.title,r.partner,r.brand,r.pic,r.type].some(v=>(v||"").toLowerCase().includes(q)))return false;
    if(fStatus&&r.status!==fStatus)return false; if(fAuto&&as!==fAuto)return false;
    if(fRev&&r.revenue!==fRev)return false; if(fBrand&&r.brand!==fBrand)return false;
    if(fPic&&r.pic!==fPic)return false; if(fType&&r.type!==fType)return false;
    return true;
  });
  computeStats(filtered); renderTable(filtered);
}

function clearFilters() {
  ["fil-status","fil-auto","fil-revenue","fil-brand","fil-pic","fil-type"].forEach(id=>{const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}});
  document.getElementById("searchBox").value=""; computeStats(allRows); renderTable(allRows);
}

function renderTable(rows) {
  rows=sortBy(rows,agrSort.col,agrSort.dir);
  updateSortTh('agr-thead',agrSort.col,agrSort.dir);
  document.getElementById("tcount").textContent=rows.length+" entri";
  const body=document.getElementById("tableBody");
  if(!rows.length){body.innerHTML=`<tr><td class="empty-td" colspan="16">Tidak ada data.</td></tr>`;return;}
  body.innerHTML=rows.map(r=>{const as=autoStatus(r);return`<tr>
    <td class="td-id">${r.id||"—"}</td><td class="td-title">${r.title||"—"}</td><td>${r.partner||"—"}</td><td>${r.pic||"—"}</td><td>${r.brand||"—"}</td>
    <td><span class="pill p-draft">${r.revenue||"—"}</span></td><td style="color:var(--g600);font-size:11px">${r.type||"—"}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--g400)">${fmtDate(r.start)}</td><td style="font-family:var(--mono);font-size:10px;color:var(--g400)">${fmtDate(r.end)}</td>
    <td><select class="pill status-inline ${pillClass(r.status)}" onchange="updateStatus(this,'${r.rowIndex}')">${MANUAL_STATUSES.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></td>
    <td>${as?`<span class="pill ${pillClass(as)}">${as}</span>`:"—"}</td>
    <td class="td-link">${r.link?`<a href="${r.link}" target="_blank">Drive ↗</a>`:"—"}</td>
    <td class="td-link">${r.emailLink?`<a href="${r.emailLink}" target="_blank">Email ↗</a>`:"—"}</td>
    <td style="color:var(--g600);font-size:11px;max-width:160px;">${r.notes||"—"}</td>
    <td class="td-audit">${r.lastUpdate||"—"}${r.lastBy?`<br><span style="color:var(--g400);font-size:9px">${r.lastBy}</span>`:""}</td>
    <td><button class="btn-icon" onclick="openAgrEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteAgreement('${r.rowIndex}')">Del</button></td>
  </tr>
  <tr id="agr-edit-row-${r.rowIndex}" style="display:none"><td colspan="16" style="padding:0 12px 12px;">
    <div class="edit-row-form">
      <div class="edit-row-grid">
        <div class="fg full"><label>Agreement Title</label><input type="text" id="agr-e-title-${r.rowIndex}" value="${r.title||""}"></div>
        <div class="fg"><label>Partner / Client</label><input type="text" id="agr-e-partner-${r.rowIndex}" value="${r.partner||""}"></div>
        <div class="fg"><label>PIC</label><input type="text" id="agr-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
        <div class="fg"><label>Related IP / Brand</label><input type="text" id="agr-e-brand-${r.rowIndex}" value="${r.brand||""}"></div>
        <div class="fg"><label>Revenue Stream</label><select id="agr-e-revenue-${r.rowIndex}"><option value="" ${!r.revenue?"selected":""}>—</option><option ${r.revenue==="SD&Y"?"selected":""}>SD&Y</option><option ${r.revenue==="Lagaa"?"selected":""}>Lagaa</option><option ${r.revenue==="Marte"?"selected":""}>Marte</option><option ${r.revenue==="Distribution"?"selected":""}>Distribution</option></select></div>
        <div class="fg"><label>Agreement Type</label><input type="text" id="agr-e-type-${r.rowIndex}" value="${r.type||""}"></div>
        <div class="fg"><label>Status</label><select id="agr-e-status-${r.rowIndex}">${MANUAL_STATUSES.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></div>
        <div class="fg"><label>Start Date</label><input type="text" id="agr-e-start-${r.rowIndex}" value="${r.start||""}" placeholder="e.g. 01 Jan 2025"></div>
        <div class="fg"><label>End Date</label><input type="text" id="agr-e-end-${r.rowIndex}" value="${r.end||""}" placeholder="e.g. 31 Dec 2025"></div>
        <div class="fg full"><label>Link Agreement</label><input type="url" id="agr-e-link-${r.rowIndex}" value="${r.link||""}"></div>
        <div class="fg full"><label>Email Chain</label><input type="url" id="agr-e-email-${r.rowIndex}" value="${r.emailLink||""}"></div>
        <div class="fg full"><label>Notes</label><input type="text" id="agr-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
      </div>
      <div class="edit-row-btns">
        <button class="btn-save" onclick="saveAgrEdit('${r.rowIndex}')">Simpan</button>
        <button class="btn-cancel" onclick="closeAgrEdit('${r.rowIndex}')">Batal</button>
      </div>
    </div>
  </td></tr>`;}).join("");
}

function openAgrEdit(rowIndex){document.querySelectorAll("[id^='agr-edit-row-']").forEach(el=>el.style.display="none");document.getElementById("agr-edit-row-"+rowIndex).style.display="table-row";}
function closeAgrEdit(rowIndex){document.getElementById("agr-edit-row-"+rowIndex).style.display="none";}

async function saveAgrEdit(rowIndex) {
  try {
    const {error}=await sb.from("agreements").update({title:document.getElementById("agr-e-title-"+rowIndex).value.trim(),partner:document.getElementById("agr-e-partner-"+rowIndex).value.trim(),pic:document.getElementById("agr-e-pic-"+rowIndex).value.trim(),brand:document.getElementById("agr-e-brand-"+rowIndex).value.trim(),revenue:document.getElementById("agr-e-revenue-"+rowIndex).value,type:document.getElementById("agr-e-type-"+rowIndex).value.trim(),status:document.getElementById("agr-e-status-"+rowIndex).value,start_date:document.getElementById("agr-e-start-"+rowIndex).value.trim()||null,end_date:document.getElementById("agr-e-end-"+rowIndex).value.trim()||null,link:document.getElementById("agr-e-link-"+rowIndex).value.trim(),email_link:document.getElementById("agr-e-email-"+rowIndex).value.trim(),notes:document.getElementById("agr-e-notes-"+rowIndex).value.trim(),last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal simpan: "+error.message);return;}
    logActivity("Agreement","edit",rowIndex,"Data diperbarui");
    const _ar=allRows.find(r=>r.rowIndex===rowIndex);
    if(_ar?.addedBy) insertNotif(_ar.addedBy,"Agreement",rowIndex,`${currentUser} mengedit Agreement: ${_ar.title}`);
    closeAgrEdit(rowIndex); loadAgreements();
  } catch(e){alert("Koneksi gagal.");}
}

async function deleteAgreement(rowIndex) {
  if (!confirm("Hapus agreement ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("agreements").delete().eq("id",rowIndex);
    if(error){alert("Gagal hapus: "+error.message);return;}
    logActivity("Agreement","delete",rowIndex,"Dihapus");
    loadAgreements();
  } catch(e) { alert("Koneksi gagal."); }
}

async function updateStatus(sel, rowIndex) {
  const newStatus=sel.value; sel.className=`pill status-inline ${pillClass(newStatus)}`;
  try {
    const {error}=await sb.from("agreements").update({status:newStatus,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal update: "+error.message);return;}
    logActivity("Agreement","status_change",rowIndex,"Status → "+newStatus);
    const row=allRows.find(r=>r.rowIndex===rowIndex);
    if(row){row.status=newStatus;row.lastBy=currentUser;row.lastUpdate=new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});}
    applyFilters();
  } catch(e){alert("Koneksi gagal.");}
}

// ── IP MASTER ──
function computeIPStatusLocal(relatedAgreements) {
  const agrs=(relatedAgreements||"").split(",").map(s=>s.trim()).filter(Boolean);
  if(!agrs.length) return "No Agreement";
  let best="In Progress";
  for(const agrId of agrs){
    const agr=allRows.find(r=>r.id===agrId);
    if(!agr||agr.status!=="Signed") continue;
    const st=autoStatus(agr);
    if(st==="Active") return "Active";
    if(st==="Near Expiring"&&best!=="Active") best="Near Expiring";
    if(st==="Expired"&&best!=="Active"&&best!=="Near Expiring") best="Expired";
  }
  return best;
}

async function submitIP() {
  const name=document.getElementById("ip-name").value.trim(), category=document.getElementById("ip-category").value.trim(), liveStatus=document.getElementById("ip-live-status").value;
  if(!name){showIPFeedback("IP / Brand Name wajib diisi.","err");return;}
  if(!category){showIPFeedback("Category wajib diisi.","err");return;}
  const revenues=[...document.querySelectorAll("#ip-revenue-checks input:checked")].map(c=>c.value);
  if(!revenues.length){showIPFeedback("Pilih minimal satu Revenue Stream.","err");return;}
  const dupIP = await checkDuplicate(name, "ip");
  if (dupIP) { showIPFeedback(`"${name}" sudah ada di ${dupIP}. Nama tidak boleh duplikat.`, "err"); return; }
  const btn=document.getElementById("ipSubmitBtn"); btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id=genId("IP");
    const {error}=await sb.from("ip_master").insert({id,name,category,live_status:liveStatus||"Active",pic:document.getElementById("ip-pic").value.trim(),revenue_stream:revenues.join(", "),related_agreement:document.getElementById("ip-agreements").value.trim(),royalty_type:document.getElementById("ip-royalty-type").value,percentage:document.getElementById("ip-pct").value.trim()||null,fixed_amount:document.getElementById("ip-fixed").value.trim()||null,termin:document.getElementById("ip-termin").value,pph_tax_rate:document.getElementById("ip-pph").value.trim()||null,notes:document.getElementById("ip-notes").value.trim(),added_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser});
    if(error)throw error;
    showIPFeedback("✓ IP tersimpan — ID: "+id,"ok");
    logActivity("IP Master","create",id,name+" ("+category+")");
    insertNotif(document.getElementById("ip-pic").value.trim(),"IP Master",id,`${currentUser} menambahkan kamu sebagai PIC di IP Master: ${name}`);
    if(!acRRIPs.includes(name))acRRIPs.push(name);
    if(!acIPCategories.includes(category))acIPCategories.push(category);
    clearIPForm(); loadIPMaster();
  } catch(e){showIPFeedback("Gagal: "+(e.message||e),"err");}
  btn.disabled=false; btn.textContent="Simpan IP";
}

function clearIPForm() {
  ["ip-name","ip-category","ip-pic","ip-agreements","ip-notes","ip-pct","ip-fixed","ip-pph"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("ip-royalty-type").value=""; document.getElementById("ip-termin").value=""; document.getElementById("ip-live-status").value="";
  document.querySelectorAll("#ip-revenue-checks input").forEach(c=>c.checked=false);
}

function showIPFeedback(msg,type) {
  const el=document.getElementById("ip-feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok")setTimeout(()=>el.className="feedback",6000);
}

async function loadIPMaster() {
  document.getElementById("ipTableBody").innerHTML=`<tr><td class="empty-td" colspan="15">Memuat...</td></tr>`;
  try {
    if(!allRows.length){const {data:ad}=await sb.from("agreements").select("*");allRows=(ad||[]).map(mapAgr);acAgrOptions=allRows.map(r=>({id:r.id,label:[r.partner,r.type].filter(Boolean).join(" — ")}));acAgrLinks={};allRows.forEach(r=>{if(r.id&&r.link)acAgrLinks[r.id]=r.link;});}
    const {data,error}=await sb.from("ip_master").select("*").order("id");
    if(error)throw error;
    allIPRows=(data||[]).map(r=>{const m=mapIP(r);m.ipStatus=computeIPStatusLocal(m.agreements);return m;});
    acRRIPs=allIPRows.map(r=>r.name).filter(Boolean);
    const cats=[...new Set(allIPRows.map(r=>r.category).filter(Boolean))];
    cats.forEach(c=>{if(!acIPCategories.includes(c))acIPCategories.push(c);});
    const catSel=document.getElementById("ip-fil-category");
    if(catSel){while(catSel.options.length>1)catSel.remove(1);acIPCategories.forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c;catSel.appendChild(o);});}
    computeIPStats(allIPRows); populateRRFilterDropdowns(); applyIPFilters();
  } catch(e){document.getElementById("ipTableBody").innerHTML=`<tr><td class="empty-td" colspan="15">Gagal: ${e.message}</td></tr>`;}
}

function computeIPStats(rows) {
  document.getElementById("ip-s-total").textContent       = rows.length;
  document.getElementById("ip-s-active").textContent      = rows.filter(r=>r.ipStatus==="Active").length;
  document.getElementById("ip-s-near").textContent        = rows.filter(r=>r.ipStatus==="Near Expiring").length;
  document.getElementById("ip-s-expired").textContent     = rows.filter(r=>r.ipStatus==="Expired").length;
  document.getElementById("ip-s-inprog").textContent      = rows.filter(r=>r.ipStatus==="In Progress").length;
  document.getElementById("ip-s-noagr").textContent       = rows.filter(r=>r.ipStatus==="No Agreement").length;
  document.getElementById("ip-s-live-active").textContent  = rows.filter(r=>r.liveStatus==="Active").length;
  document.getElementById("ip-s-live-inactive").textContent= rows.filter(r=>r.liveStatus==="Inactive").length;
}

function applyIPFilters() {
  const q=(document.getElementById("ipSearch").value||"").toLowerCase();
  const fAgrSt=document.getElementById("ip-fil-agrstatus").value, fLiveSt=document.getElementById("ip-fil-livestatus").value;
  const fRev=document.getElementById("ip-fil-revenue").value, fCat=document.getElementById("ip-fil-category").value, fRoy=document.getElementById("ip-fil-royalty").value;
  ["ip-fil-agrstatus","ip-fil-livestatus","ip-fil-revenue","ip-fil-category","ip-fil-royalty"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);});
  const filtered=allIPRows.filter(r=>{
    if(q&&!(r.name||"").toLowerCase().includes(q))return false;
    if(fAgrSt&&r.ipStatus!==fAgrSt)return false;
    if(fLiveSt&&r.liveStatus!==fLiveSt)return false;
    if(fRev&&!(r.revenue||"").includes(fRev))return false;
    if(fCat&&r.category!==fCat)return false;
    if(fRoy&&r.royaltyType!==fRoy)return false;
    return true;
  });
  computeIPStats(filtered); renderIPTable(filtered);
}

function clearIPFilters() {
  ["ip-fil-agrstatus","ip-fil-livestatus","ip-fil-revenue","ip-fil-category","ip-fil-royalty"].forEach(id=>{const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}});
  document.getElementById("ipSearch").value=""; computeIPStats(allIPRows); renderIPTable(allIPRows);
}

function ipAgrStatusPill(s) {
  const map={"Active":"p-active","Near Expiring":"p-near","Expired":"p-expired","In Progress":"p-signings","No Agreement":"p-review"};
  return `<span class="pill ${map[s]||"p-draft"}">${s||"—"}</span>`;
}

function renderIPTable(rows) {
  rows=sortBy(rows,ipSort.col,ipSort.dir);
  updateSortTh('ip-thead',ipSort.col,ipSort.dir);
  document.getElementById("ip-tcount").textContent=rows.length+" entri";
  const body=document.getElementById("ipTableBody");
  if(!rows.length){body.innerHTML=`<tr><td class="empty-td" colspan="15">Belum ada data.</td></tr>`;return;}
  body.innerHTML=rows.map(r=>{
    const streams=(r.revenue||"").split(",").map(s=>s.trim()).filter(Boolean);
    const agrs=(r.agreements||"").split(",").map(s=>s.trim()).filter(Boolean);
    return`<tr>
      <td class="td-id">${r.id||"—"}</td>
      <td style="font-weight:500">${r.name||"—"}</td>
      <td><span class="pill p-draft">${r.category||"—"}</span></td>
      <td style="font-size:11px;color:var(--g600)">${r.pic||"—"}</td>
      <td>${streams.map(s=>`<span class="pill" style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;margin-right:3px">${s}</span>`).join("")||"—"}</td>
      <td>${agrs.length?agrs.map(a=>{const opt=acAgrOptions.find?acAgrOptions.find(o=>o.id===a):null;const lnk=acAgrLinks[a];return lnk?`<a href="${lnk}" target="_blank" class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px;text-decoration:none" title="${opt?opt.label:""}">${a} ↗</a>`:`<span class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px" title="${opt?opt.label:""}">${a}</span>`;}).join(""):`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
      <td>${ipAgrStatusPill(r.ipStatus)}</td>
      <td>
        <select class="pill live-toggle ${r.liveStatus==="Active"?"p-active":"p-inactive"}" onchange="updateLiveStatus(this,'${r.rowIndex}')">
          <option ${r.liveStatus==="Active"?"selected":""}>Active</option>
          <option ${r.liveStatus==="Inactive"?"selected":""}>Inactive</option>
        </select>
      </td>
      <td>${r.royaltyType?`<span class="pill ${r.royaltyType==="Post-Sales"?"p-active":r.royaltyType==="Advance"?"p-near":"p-signings"}">${r.royaltyType}</span>`:"—"}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.pct?r.pct+"%":"—"}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.fixed?"Rp "+Number(r.fixed).toLocaleString("id-ID"):"—"}</td>
      <td style="font-size:11px">${r.termin||"—"}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.pph?r.pph+"%":"—"}</td>
      <td style="color:var(--g600);font-size:11px">${r.notes||"—"}</td>
      <td><button class="btn-icon" onclick="openIPEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteIP('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="ip-edit-row-${r.rowIndex}" style="display:none"><td colspan="15" style="padding:0 12px 12px;">
      <div class="edit-row-form">
        <div class="edit-row-grid">
          <div class="fg"><label>IP / Brand Name</label><input type="text" id="ip-e-name-${r.rowIndex}" value="${r.name||""}"></div>
          <div class="fg"><label>Category</label><input type="text" id="ip-e-category-${r.rowIndex}" value="${r.category||""}"></div>
          <div class="fg"><label>Live Status</label><select id="ip-e-live-${r.rowIndex}"><option ${r.liveStatus==="Active"?"selected":""}>Active</option><option ${r.liveStatus==="Inactive"?"selected":""}>Inactive</option></select></div>
          <div class="fg"><label>Revenue Stream</label><input type="text" id="ip-e-revenue-${r.rowIndex}" value="${r.revenue||""}" placeholder="SD&Y, Lagaa, Distribution"></div>
          <div class="fg"><label>Related Agreement</label><input type="text" id="ip-e-agr-${r.rowIndex}" value="${r.agreements||""}"></div>
          <div class="fg"><label>Royalty Type</label><select id="ip-e-roytype-${r.rowIndex}"><option value="" ${!r.royaltyType?"selected":""}>—</option><option ${r.royaltyType==="Post-Sales"?"selected":""}>Post-Sales</option><option ${r.royaltyType==="Advance"?"selected":""}>Advance</option><option ${r.royaltyType==="Both"?"selected":""}>Both</option></select></div>
          <div class="fg"><label>Percentage (%)</label><input type="number" id="ip-e-pct-${r.rowIndex}" value="${r.pct||""}" step="0.1"></div>
          <div class="fg"><label>Fixed Amount</label><input type="number" id="ip-e-fixed-${r.rowIndex}" value="${r.fixed||""}"></div>
          <div class="fg"><label>Termin</label><select id="ip-e-termin-${r.rowIndex}"><option value="" ${!r.termin?"selected":""}>—</option><option ${r.termin==="Per Bulan"?"selected":""}>Per Bulan</option><option ${r.termin==="Per Quarter"?"selected":""}>Per Quarter</option><option ${r.termin==="Per Tahun"?"selected":""}>Per Tahun</option><option ${r.termin==="Per Akhir Project"?"selected":""}>Per Akhir Project</option></select></div>
          <div class="fg"><label>PPh Tax Rate (%)</label><input type="number" id="ip-e-pph-${r.rowIndex}" value="${r.pph||""}" step="0.1"></div>
          <div class="fg"><label>Notes</label><input type="text" id="ip-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
          <div class="fg"><label>PIC</label><input type="text" id="ip-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveIPEdit('${r.rowIndex}')">Simpan</button>
          <button class="btn-cancel" onclick="closeIPEdit('${r.rowIndex}')">Batal</button>
        </div>
      </div>
    </td></tr>`;
  }).join("");
}

function openIPEdit(rowIndex) { document.querySelectorAll("[id^='ip-edit-row-']").forEach(el=>el.style.display="none"); document.getElementById("ip-edit-row-"+rowIndex).style.display="table-row"; }
function closeIPEdit(rowIndex) { document.getElementById("ip-edit-row-"+rowIndex).style.display="none"; }

async function deleteIP(rowIndex) {
  if (!confirm("Hapus IP/Brand ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("ip_master").delete().eq("id",rowIndex);
    if(error){alert("Gagal hapus: "+error.message);return;}
    logActivity("IP Master","delete",rowIndex,"Dihapus");
    loadIPMaster();
  } catch(e) { alert("Koneksi gagal."); }
}

async function updateLiveStatus(sel, rowIndex) {
  const newStatus=sel.value;
  sel.className=`pill live-toggle ${newStatus==="Active"?"p-active":"p-inactive"}`;
  try {
    const {error}=await sb.from("ip_master").update({live_status:newStatus,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal update: "+error.message);return;}
    logActivity("IP Master","status_change",rowIndex,"Live Status → "+newStatus);
    const row=allIPRows.find(r=>r.rowIndex===rowIndex);
    if(row)row.liveStatus=newStatus;
    computeIPStats(allIPRows);
  } catch(e){alert("Koneksi gagal.");}
}

async function saveIPEdit(rowIndex) {
  try {
    const {error}=await sb.from("ip_master").update({name:document.getElementById("ip-e-name-"+rowIndex).value.trim(),category:document.getElementById("ip-e-category-"+rowIndex).value.trim(),live_status:document.getElementById("ip-e-live-"+rowIndex).value,pic:document.getElementById("ip-e-pic-"+rowIndex).value.trim(),revenue_stream:document.getElementById("ip-e-revenue-"+rowIndex).value.trim(),related_agreement:document.getElementById("ip-e-agr-"+rowIndex).value.trim(),royalty_type:document.getElementById("ip-e-roytype-"+rowIndex).value,percentage:document.getElementById("ip-e-pct-"+rowIndex).value.trim()||null,fixed_amount:document.getElementById("ip-e-fixed-"+rowIndex).value.trim()||null,termin:document.getElementById("ip-e-termin-"+rowIndex).value,pph_tax_rate:document.getElementById("ip-e-pph-"+rowIndex).value.trim()||null,notes:document.getElementById("ip-e-notes-"+rowIndex).value.trim(),last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal simpan: "+error.message);return;}
    logActivity("IP Master","edit",rowIndex,"Data diperbarui");
    const _ir=allIPRows.find(r=>r.rowIndex===rowIndex);
    if(_ir?.addedBy) insertNotif(_ir.addedBy,"IP Master",rowIndex,`${currentUser} mengedit IP Master: ${_ir.name}`);
    closeIPEdit(rowIndex); loadIPMaster();
  } catch(e){alert("Koneksi gagal.");}
}

// ── ROYALTY RECIPIENTS ──
function togglePKS() { const tipe=document.getElementById("rr-tipe").value.trim().toLowerCase(); document.getElementById("rr-pks-wrap").style.display=tipe==="collaborator"?"flex":"none"; }

async function submitRR() {
  const req=[["rr-name","Nama Penerima"],["rr-tipe","Tipe"],["rr-ip","Related IP"],["rr-royalty-type","Royalty Type"],["rr-termin","Termin"]];
  for(const [id,label]of req){if(!document.getElementById(id).value.trim()){showRRFeedback(label+" wajib diisi.","err");document.getElementById(id).focus();return;}}
  const btn=document.getElementById("rrSubmitBtn"); btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const tipe=document.getElementById("rr-tipe").value.trim();
    const id=genId("RR");
    const {error}=await sb.from("royalty_recipients").insert({id,nama:document.getElementById("rr-name").value.trim(),tipe,related_ip:document.getElementById("rr-ip").value.trim(),royalty_type:document.getElementById("rr-royalty-type").value,percentage:document.getElementById("rr-pct").value.trim()||null,fixed_amount:document.getElementById("rr-fixed").value.trim()||null,termin:document.getElementById("rr-termin").value,pks:document.getElementById("rr-pks").value.trim(),notes:document.getElementById("rr-notes").value.trim(),pic:document.getElementById("rr-pic").value.trim(),added_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser});
    if(error)throw error;
    showRRFeedback("✓ Penerima tersimpan — ID: "+id,"ok");
    logActivity("Royalty Recipients","create",id,document.getElementById("rr-name").value.trim()+" ("+tipe+")");
    insertNotif(document.getElementById("rr-pic").value.trim(),"Royalty Recipients",id,`${currentUser} menambahkan kamu sebagai PIC di Royalty Recipients: ${document.getElementById("rr-name").value.trim()}`);
    if(!acRRTipes.includes(tipe))acRRTipes.push(tipe);
    clearRRForm();
  } catch(e){showRRFeedback("Gagal: "+(e.message||e),"err");}
  btn.disabled=false; btn.textContent="Simpan Penerima";
}

function clearRRForm() {
  ["rr-name","rr-tipe","rr-ip","rr-pct","rr-fixed","rr-pks","rr-notes","rr-pic"].forEach(id=>document.getElementById(id).value="");
  const pksEl = document.getElementById("rr-pks"); if(pksEl) pksEl.dataset.driveLink="";
  document.getElementById("rr-royalty-type").value=""; document.getElementById("rr-termin").value="";
}

function showRRFeedback(msg,type) {
  const el=document.getElementById("rr-feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok")setTimeout(()=>el.className="feedback",6000);
}

async function loadRecipients() {
  document.getElementById("rrTableBody").innerHTML=`<tr><td class="empty-td" colspan="11">Memuat...</td></tr>`;
  try {
    const {data,error}=await sb.from("royalty_recipients").select("*").order("id");
    if(error)throw error;
    allRRRows=(data||[]).map(mapRR);
    acRRTipes=[...new Set(allRRRows.map(r=>r.tipe).filter(Boolean))];
    computeRRStats(allRRRows); populateRRFilterDropdowns(); applyRRFilters();
  } catch(e){document.getElementById("rrTableBody").innerHTML=`<tr><td class="empty-td" colspan="11">Gagal: ${e.message}</td></tr>`;}
}

function computeRRStats(rows) {
  document.getElementById("rr-s-total").textContent     = rows.length;
  document.getElementById("rr-s-postsales").textContent = rows.filter(r=>r.royaltyType==="Post-Sales").length;
  document.getElementById("rr-s-advance").textContent   = rows.filter(r=>r.royaltyType==="Advance"||r.royaltyType==="Both").length;
}

function populateRRFilterDropdowns() {
  const setOpts=(id,vals)=>{const sel=document.getElementById(id);if(!sel)return;const cur=sel.value;while(sel.options.length>1)sel.remove(1);vals.forEach(v=>{const o=document.createElement("option");o.value=o.textContent=v;sel.appendChild(o);});if(cur)sel.value=cur;};
  setOpts("rr-fil-tipe",acRRTipes); setOpts("rr-fil-ip",acRRIPs);
}

function applyRRFilters() {
  const q=(document.getElementById("rrSearch").value||"").toLowerCase();
  const fTipe=document.getElementById("rr-fil-tipe").value,fIP=document.getElementById("rr-fil-ip").value,fType=document.getElementById("rr-fil-type").value,fTermin=document.getElementById("rr-fil-termin").value;
  ["rr-fil-tipe","rr-fil-ip","rr-fil-type","rr-fil-termin"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);});
  const filtered=allRRRows.filter(r=>{
    if(q&&![r.name,r.ip,r.tipe].some(v=>(v||"").toLowerCase().includes(q)))return false;
    if(fTipe&&r.tipe!==fTipe)return false; if(fIP&&r.ip!==fIP)return false;
    if(fType&&r.royaltyType!==fType)return false; if(fTermin&&r.termin!==fTermin)return false;
    return true;
  });
  computeRRStats(filtered); renderRRTable(filtered);
}

function clearRRFilters() {
  ["rr-fil-tipe","rr-fil-ip","rr-fil-type","rr-fil-termin"].forEach(id=>{const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}});
  document.getElementById("rrSearch").value=""; computeRRStats(allRRRows); renderRRTable(allRRRows);
}

function renderRRTable(rows) {
  rows=sortBy(rows,rrSort.col,rrSort.dir);
  updateSortTh('rr-thead',rrSort.col,rrSort.dir);
  document.getElementById("rr-tcount").textContent=rows.length+" entri";
  const body=document.getElementById("rrTableBody");
  if(!rows.length){body.innerHTML=`<tr><td class="empty-td" colspan="12">Belum ada data.</td></tr>`;return;}
  body.innerHTML=rows.map(r=>`<tr>
    <td class="td-id">${r.id||"—"}</td><td style="font-weight:500">${r.name||"—"}</td>
    <td><span class="pill p-draft">${r.tipe||"—"}</span></td>
    <td style="font-size:11px;color:var(--g600)">${r.pic||"—"}</td>
    <td>${r.ip?`<span class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB">${r.ip}</span>`:"—"}</td>
    <td><span class="pill ${r.royaltyType==="Post-Sales"?"p-active":r.royaltyType==="Advance"?"p-near":"p-signings"}">${r.royaltyType||"—"}</span></td>
    <td>${r.pct?r.pct+"%":"—"}</td><td>${r.fixed?"Rp "+Number(r.fixed).toLocaleString("id-ID"):"—"}</td>
    <td style="font-size:11px">${r.termin||"—"}</td>
    <td>${r.pks?(()=>{const isId=r.pks.startsWith("AGR-");const agrId=isId?r.pks:Object.keys(acAgrLinks).find(k=>acAgrLinks[k]===r.pks);const href=isId?(acAgrLinks[r.pks]||""):r.pks;return href?`<a href="${href}" target="_blank" class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;text-decoration:none">${agrId||"PKS"} ↗</a>`:`<span class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB">${agrId||r.pks}</span>`;})():"—"}</td>
    <td style="color:var(--g600);font-size:11px">${r.notes||"—"}</td>
    <td><button class="btn-icon" onclick="openRREdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteRR('${r.rowIndex}')">Del</button></td>
  </tr>
  <tr id="rr-edit-row-${r.rowIndex}" style="display:none"><td colspan="12" style="padding:0 12px 12px;">
    <div class="edit-row-form">
      <div class="edit-row-grid">
        <div class="fg"><label>Nama</label><input type="text" id="rr-e-name-${r.rowIndex}" value="${r.name||""}"></div>
        <div class="fg"><label>Tipe</label><input type="text" id="rr-e-tipe-${r.rowIndex}" value="${r.tipe||""}"></div>
        <div class="fg"><label>Related IP</label><input type="text" id="rr-e-ip-${r.rowIndex}" value="${r.ip||""}"></div>
        <div class="fg"><label>Royalty Type</label><select id="rr-e-type-${r.rowIndex}"><option ${r.royaltyType==="Post-Sales"?"selected":""}>Post-Sales</option><option ${r.royaltyType==="Advance"?"selected":""}>Advance</option><option ${r.royaltyType==="Both"?"selected":""}>Both</option></select></div>
        <div class="fg"><label>Percentage (%)</label><input type="number" id="rr-e-pct-${r.rowIndex}" value="${r.pct||""}" step="0.1"></div>
        <div class="fg"><label>Fixed Amount</label><input type="number" id="rr-e-fixed-${r.rowIndex}" value="${r.fixed||""}"></div>
        <div class="fg"><label>Termin</label><select id="rr-e-termin-${r.rowIndex}"><option ${r.termin==="Per Bulan"?"selected":""}>Per Bulan</option><option ${r.termin==="Per Quarter"?"selected":""}>Per Quarter</option><option ${r.termin==="Per Tahun"?"selected":""}>Per Tahun</option><option ${r.termin==="Per Akhir Project"?"selected":""}>Per Akhir Project</option></select></div>
        <div class="fg"><label>Link PKS</label><input type="url" id="rr-e-pks-${r.rowIndex}" value="${r.pks||""}"></div>
        <div class="fg"><label>Notes</label><input type="text" id="rr-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
        <div class="fg"><label>PIC</label><input type="text" id="rr-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
      </div>
      <div class="edit-row-btns"><button class="btn-save" onclick="saveRREdit('${r.rowIndex}')">Simpan</button><button class="btn-cancel" onclick="closeRREdit('${r.rowIndex}')">Batal</button></div>
    </div>
  </td></tr>`).join("");
}

function openRREdit(rowIndex){document.querySelectorAll("[id^='rr-edit-row-']").forEach(el=>el.style.display="none");document.getElementById("rr-edit-row-"+rowIndex).style.display="table-row";}
function closeRREdit(rowIndex){document.getElementById("rr-edit-row-"+rowIndex).style.display="none";}

async function deleteRR(rowIndex) {
  if (!confirm("Hapus penerima royalty ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("royalty_recipients").delete().eq("id",rowIndex);
    if(error){alert("Gagal hapus: "+error.message);return;}
    logActivity("Royalty Recipients","delete",rowIndex,"Dihapus");
    loadRecipients();
  } catch(e) { alert("Koneksi gagal."); }
}

async function saveRREdit(rowIndex) {
  try {
    const {error}=await sb.from("royalty_recipients").update({nama:document.getElementById("rr-e-name-"+rowIndex).value.trim(),tipe:document.getElementById("rr-e-tipe-"+rowIndex).value.trim(),related_ip:document.getElementById("rr-e-ip-"+rowIndex).value.trim(),royalty_type:document.getElementById("rr-e-type-"+rowIndex).value,percentage:document.getElementById("rr-e-pct-"+rowIndex).value.trim()||null,fixed_amount:document.getElementById("rr-e-fixed-"+rowIndex).value.trim()||null,termin:document.getElementById("rr-e-termin-"+rowIndex).value,pks:document.getElementById("rr-e-pks-"+rowIndex).value.trim(),notes:document.getElementById("rr-e-notes-"+rowIndex).value.trim(),pic:document.getElementById("rr-e-pic-"+rowIndex).value.trim(),last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal simpan: "+error.message);return;}
    logActivity("Royalty Recipients","edit",rowIndex,"Data diperbarui");
    const _rr=allRRRows.find(r=>r.rowIndex===rowIndex);
    if(_rr?.addedBy) insertNotif(_rr.addedBy,"Royalty Recipients",rowIndex,`${currentUser} mengedit Royalty Recipients: ${_rr.name}`);
    closeRREdit(rowIndex); loadRecipients();
  } catch(e){alert("Koneksi gagal.");}
}

// ── BRAND MASTER ──
const BM_NORMAL = {apparel:30, accessories:25, collectible:20, preloved:20, wellness:20, others:30};
let allBMRows = [], acBMCategories = ["Musician","Brand","Filmmaker"];

function switchBMTab(name, el) {
  document.querySelectorAll("#page-brandmaster .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("bmtab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("bmtab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadBrandMaster();
}

function isNego(r) {
  return ["apparel","accessories","collectible","preloved","wellness","others"].some(k => {
    const v = parseFloat(r[k]);
    return !isNaN(v) && v !== BM_NORMAL[k];
  });
}

function rateCell(val, normalVal) {
  const v = val !== "" && val !== undefined && val !== null ? parseFloat(val) : null;
  const display = v !== null ? v+"%" : normalVal+"%";
  const isNonStd = v !== null && v !== normalVal;
  return isNonStd
    ? `<span style="background:#fff3e0;color:#8a4000;border:1px solid #ffcc80;border-radius:99px;padding:2px 8px;font-family:var(--mono);font-size:10px;white-space:nowrap;">⚠ ${display}</span>`
    : `<span style="font-family:var(--mono);font-size:11px;color:var(--g600)">${display}</span>`;
}

async function submitBM() {
  const name = document.getElementById("bm-name").value.trim();
  const category = document.getElementById("bm-category").value.trim();
  const liveStatus = document.getElementById("bm-live-status").value;
  if (!name)       { showBMFeedback("IP / Brand Name wajib diisi.","err"); return; }
  if (!category)   { showBMFeedback("Category wajib diisi.","err"); return; }
  // liveStatus always has default "Active"
  const revenues = [...document.querySelectorAll("#bm-revenue-checks input:checked")].map(c=>c.value);
  // Duplicate check
  const dupBM = await checkDuplicate(name, "bm");
  if (dupBM) { showBMFeedback(`"${name}" sudah ada di ${dupBM}. Nama tidak boleh duplikat.`, "err"); return; }
  const btn = document.getElementById("bmSubmitBtn");
  btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id=genId("BM");
    const {error}=await sb.from("brand_master").insert({id,name,category,live_status:liveStatus||"Active",pic:document.getElementById("bm-pic").value.trim(),revenue_stream:revenues.join(", "),related_agreement:document.getElementById("bm-agreements").value.trim(),apparel_rate:parseFloat(document.getElementById("bm-apparel").value)||BM_NORMAL.apparel,accessories_rate:parseFloat(document.getElementById("bm-accessories").value)||BM_NORMAL.accessories,collectible_rate:parseFloat(document.getElementById("bm-collectible").value)||BM_NORMAL.collectible,preloved_rate:parseFloat(document.getElementById("bm-preloved").value)||BM_NORMAL.preloved,wellness_rate:parseFloat(document.getElementById("bm-wellness").value)||BM_NORMAL.wellness,others_rate:parseFloat(document.getElementById("bm-others").value)||BM_NORMAL.others,notes:document.getElementById("bm-notes").value.trim(),added_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser});
    if(error)throw error;
    showBMFeedback("✓ Brand tersimpan — ID: "+id,"ok");
    logActivity("Brand Master","create",id,name+" ("+category+")");
    insertNotif(document.getElementById("bm-pic").value.trim(),"Brand Master",id,`${currentUser} menambahkan kamu sebagai PIC di Brand Master: ${name}`);
    if (!acBMCategories.includes(category)) acBMCategories.push(category);
    clearBMForm(); loadBrandMaster();
  } catch(e) { showBMFeedback("Gagal: "+(e.message||e),"err"); }
  btn.disabled=false; btn.textContent="Simpan Brand";
}

function clearBMForm() {
  ["bm-name","bm-category","bm-pic","bm-agreements","bm-notes","bm-apparel","bm-accessories","bm-collectible","bm-preloved","bm-wellness","bm-others"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("bm-live-status").value="Active";
  document.querySelectorAll("#bm-revenue-checks input").forEach(c=>c.checked=false);
}

function showBMFeedback(msg,type) {
  const el=document.getElementById("bm-feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok") setTimeout(()=>el.className="feedback",6000);
}

async function loadBrandMaster() {
  document.getElementById("bmTableBody").innerHTML=`<tr><td class="empty-td" colspan="15">Memuat...</td></tr>`;
  try {
    const {data,error}=await sb.from("brand_master").select("*").order("id");
    if(error)throw error;
    allBMRows=(data||[]).map(mapBM);
    const cats=[...new Set(allBMRows.map(r=>r.category).filter(Boolean))];
    cats.forEach(c=>{if(!acBMCategories.includes(c))acBMCategories.push(c);});
    const catSel=document.getElementById("bm-fil-category");
    if(catSel){while(catSel.options.length>1)catSel.remove(1);acBMCategories.forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c;catSel.appendChild(o);});}
    computeBMStats(allBMRows); applyBMFilters();
  } catch(e) {
    document.getElementById("bmTableBody").innerHTML=`<tr><td class="empty-td" colspan="14">Gagal: ${e.message}</td></tr>`;
  }
}

function computeBMStats(rows) {
  const nego = rows.filter(r=>isNego(r));
  document.getElementById("bm-s-total").textContent  = rows.length;
  document.getElementById("bm-s-normal").textContent = rows.length - nego.length;
  document.getElementById("bm-s-nego").textContent   = nego.length;
  document.getElementById("bm-s-live").textContent   = rows.filter(r=>r.liveStatus==="Active").length;
}

function applyBMFilters() {
  const q        = (document.getElementById("bmSearch").value||"").toLowerCase();
  const fLive    = document.getElementById("bm-fil-livestatus").value;
  const fRate    = document.getElementById("bm-fil-rate").value;
  const fRevenue = document.getElementById("bm-fil-revenue").value;
  const fCat     = document.getElementById("bm-fil-category").value;
  ["bm-fil-livestatus","bm-fil-rate","bm-fil-revenue","bm-fil-category"].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);
  });
  const filtered = allBMRows.filter(r=>{
    if(q      && !(r.name||"").toLowerCase().includes(q)) return false;
    if(fLive  && r.liveStatus!==fLive) return false;
    if(fRate  === "normal" && isNego(r)) return false;
    if(fRate  === "nego"   && !isNego(r)) return false;
    if(fRevenue && !(r.revenue||"").includes(fRevenue)) return false;
    if(fCat   && r.category!==fCat) return false;
    return true;
  });
  computeBMStats(filtered); renderBMTable(filtered);
}

function clearBMFilters() {
  ["bm-fil-livestatus","bm-fil-rate","bm-fil-revenue","bm-fil-category"].forEach(id=>{
    const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}
  });
  document.getElementById("bmSearch").value="";
  computeBMStats(allBMRows); renderBMTable(allBMRows);
}

function renderBMTable(rows) {
  rows=sortBy(rows,bmSort.col,bmSort.dir);
  updateSortTh('bm-thead',bmSort.col,bmSort.dir);
  document.getElementById("bm-tcount").textContent = rows.length+" entri";
  const body = document.getElementById("bmTableBody");
  if (!rows.length) { body.innerHTML=`<tr><td class="empty-td" colspan="15">Belum ada data.</td></tr>`; return; }
  body.innerHTML = rows.map(r=>{
    const streams = (r.revenue||"").split(",").map(s=>s.trim()).filter(Boolean);
    const agrs    = (r.agreements||"").split(",").map(s=>s.trim()).filter(Boolean);
    const hasNego = isNego(r);
    return `<tr>
      <td class="td-id">${r.id||"—"}</td>
      <td style="font-weight:500">${r.name||"—"}${hasNego?` <span title="Ada rate nego" style="color:#8a4000;font-size:10px">⚠</span>`:""}</td>
      <td><span class="pill p-draft">${r.category||"—"}</span></td>
      <td><span class="pill ${r.liveStatus==="Active"?"p-active":"p-inactive"}">${r.liveStatus||"—"}</span></td>
      <td style="font-size:11px;color:var(--g600)">${r.pic||"—"}</td>
      <td>${streams.map(s=>`<span class="pill" style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;margin-right:3px">${s}</span>`).join("")||"—"}</td>
      <td>${agrs.length?agrs.map(a=>{const lnk=acAgrLinks[a];return lnk?`<a href="${lnk}" target="_blank" class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px;text-decoration:none">${a} ↗</a>`:`<span class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px">${a}</span>`;}).join(""):"—"}</td>
      <td>${rateCell(r.apparel,   BM_NORMAL.apparel)}</td>
      <td>${rateCell(r.accessories,BM_NORMAL.accessories)}</td>
      <td>${rateCell(r.collectible,BM_NORMAL.collectible)}</td>
      <td>${rateCell(r.preloved,  BM_NORMAL.preloved)}</td>
      <td>${rateCell(r.wellness,  BM_NORMAL.wellness)}</td>
      <td>${rateCell(r.others,    BM_NORMAL.others)}</td>
      <td style="color:var(--g600);font-size:11px">${r.notes||"—"}</td>
      <td><button class="btn-icon" onclick="openBMEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteBM('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="bm-edit-row-${r.rowIndex}" style="display:none"><td colspan="15" style="padding:0 12px 12px;">
      <div class="edit-row-form">
        <div class="edit-row-grid">
          <div class="fg"><label>Brand Name</label><input type="text" id="bm-e-name-${r.rowIndex}" value="${r.name||""}"></div>
          <div class="fg"><label>Category</label><input type="text" id="bm-e-cat-${r.rowIndex}" value="${r.category||""}"></div>
          <div class="fg"><label>Live Status</label><select id="bm-e-live-${r.rowIndex}"><option ${r.liveStatus==="Active"?"selected":""}>Active</option><option ${r.liveStatus==="Inactive"?"selected":""}>Inactive</option></select></div>
          <div class="fg"><label>Revenue Stream</label><input type="text" id="bm-e-rev-${r.rowIndex}" value="${r.revenue||""}" placeholder="SD&Y, Lagaa, Distribution"></div>
          <div class="fg"><label>Related Agreement</label><input type="text" id="bm-e-agr-${r.rowIndex}" value="${r.agreements||""}"></div>
          <div class="fg"><label>Apparel % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 30</span></label><input type="number" id="bm-e-apparel-${r.rowIndex}" value="${r.apparel||""}" step="0.1" placeholder="30"></div>
          <div class="fg"><label>Accessories % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 25</span></label><input type="number" id="bm-e-acc-${r.rowIndex}" value="${r.accessories||""}" step="0.1" placeholder="25"></div>
          <div class="fg"><label>Collectible % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 20</span></label><input type="number" id="bm-e-col-${r.rowIndex}" value="${r.collectible||""}" step="0.1" placeholder="20"></div>
          <div class="fg"><label>Preloved % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 20</span></label><input type="number" id="bm-e-pre-${r.rowIndex}" value="${r.preloved||""}" step="0.1" placeholder="20"></div>
          <div class="fg"><label>Wellness % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 20</span></label><input type="number" id="bm-e-wel-${r.rowIndex}" value="${r.wellness||""}" step="0.1" placeholder="20"></div>
          <div class="fg"><label>Others % <span style="color:var(--g400);font-size:9px;text-transform:none;letter-spacing:0;">normal: 30</span></label><input type="number" id="bm-e-oth-${r.rowIndex}" value="${r.others||""}" step="0.1" placeholder="30"></div>
          <div class="fg"><label>Notes</label><input type="text" id="bm-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
          <div class="fg"><label>PIC</label><input type="text" id="bm-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveBMEdit('${r.rowIndex}')">Simpan</button>
          <button class="btn-cancel" onclick="closeBMEdit('${r.rowIndex}')">Batal</button>
        </div>
      </div>
    </td></tr>`;
  }).join("");
}

function openBMEdit(rowIndex) { document.querySelectorAll("[id^='bm-edit-row-']").forEach(el=>el.style.display="none"); document.getElementById("bm-edit-row-"+rowIndex).style.display="table-row"; }
function closeBMEdit(rowIndex) { document.getElementById("bm-edit-row-"+rowIndex).style.display="none"; }

async function deleteBM(rowIndex) {
  if (!confirm("Hapus brand ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("brand_master").delete().eq("id",rowIndex);
    if(error){alert("Gagal hapus: "+error.message);return;}
    logActivity("Brand Master","delete",rowIndex,"Dihapus");
    loadBrandMaster();
  } catch(e) { alert("Koneksi gagal."); }
}

async function saveBMEdit(rowIndex) {
  try {
    const {error}=await sb.from("brand_master").update({name:document.getElementById("bm-e-name-"+rowIndex).value.trim(),category:document.getElementById("bm-e-cat-"+rowIndex).value.trim(),live_status:document.getElementById("bm-e-live-"+rowIndex).value,revenue_stream:document.getElementById("bm-e-rev-"+rowIndex).value.trim(),related_agreement:document.getElementById("bm-e-agr-"+rowIndex).value.trim(),apparel_rate:parseFloat(document.getElementById("bm-e-apparel-"+rowIndex).value)||BM_NORMAL.apparel,accessories_rate:parseFloat(document.getElementById("bm-e-acc-"+rowIndex).value)||BM_NORMAL.accessories,collectible_rate:parseFloat(document.getElementById("bm-e-col-"+rowIndex).value)||BM_NORMAL.collectible,preloved_rate:parseFloat(document.getElementById("bm-e-pre-"+rowIndex).value)||BM_NORMAL.preloved,wellness_rate:parseFloat(document.getElementById("bm-e-wel-"+rowIndex).value)||BM_NORMAL.wellness,others_rate:parseFloat(document.getElementById("bm-e-oth-"+rowIndex).value)||BM_NORMAL.others,notes:document.getElementById("bm-e-notes-"+rowIndex).value.trim(),pic:document.getElementById("bm-e-pic-"+rowIndex).value.trim(),last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal simpan: "+error.message);return;}
    logActivity("Brand Master","edit",rowIndex,"Data diperbarui");
    const _bm=allBMRows.find(r=>r.rowIndex===rowIndex);
    if(_bm?.addedBy) insertNotif(_bm.addedBy,"Brand Master",rowIndex,`${currentUser} mengedit Brand Master: ${_bm.name}`);
    closeBMEdit(rowIndex); loadBrandMaster();
  } catch(e) { alert("Koneksi gagal."); }
}

setupAC("bm-category","ac-bm-category",()=>acBMCategories);
setupAC("bm-pic","ac-bm-pic",()=>acPics);
setupAC("bm-agreements","ac-bm-agr",()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);
// PKS autocomplete - special: picking sets hidden drive link
setupACPKS("rr-pks","ac-rr-pks");

// ── SALES REPORT ──
const SR_MONTHS = [
  {idx:0, label:"Jun 2026", year:2026, month:5},
  {idx:1, label:"Jul 2026", year:2026, month:6},
  {idx:2, label:"Agu 2026", year:2026, month:7},
  {idx:3, label:"Sep 2026", year:2026, month:8},
  {idx:4, label:"Okt 2026", year:2026, month:9},
  {idx:5, label:"Nov 2026", year:2026, month:10},
  {idx:6, label:"Des 2026", year:2026, month:11}
];

let srBrands = [];       // [{id, name, revenue, source, startDate}]
let srReports = {};      // key: "brandId_monthIdx" -> {link, notes, by, date}
let srFiltered = [];
let srModalContext = null; // {brandId, monthIdx}
let srSDContext = null;    // {brandId}

async function loadSalesReport() {
  document.getElementById("sr-loading").style.display = "block";
  document.getElementById("sr-table").style.display = "none";
  try {
    const [bmRes,ipRes,rrRes,rptRes,sdRes,dpRes] = await Promise.all([
      sb.from("brand_master").select("*"),
      sb.from("ip_master").select("*"),
      sb.from("royalty_recipients").select("*"),
      sb.from("sr_reports").select("*"),
      sb.from("sr_startdates").select("*"),
      sb.from("dist_partners").select("*")
    ]);
    const seen={};
    srBrands=[];
    const addBrand=(id,name,revenue,source,pic,relatedIP)=>{if(!seen[id]){seen[id]=true;srBrands.push({id,name:name.trim(),revenue:revenue||"",source,pic:pic||"",relatedIP:relatedIP||""});}};
    (bmRes.data||[]).filter(r=>r.live_status==="Active").forEach(r=>addBrand(r.id,r.name,r.revenue_stream,"BM",r.pic,""));
    (ipRes.data||[]).filter(r=>r.live_status==="Active").forEach(r=>addBrand(r.id,r.name,r.revenue_stream,"IP",r.pic,""));
    (rrRes.data||[]).forEach(r=>addBrand(r.id,r.nama,r.revenue_stream||"","CR",r.pic,r.related_ip||""));
    (dpRes.data||[]).filter(r=>r.live_status==="Active"&&(r.type||"").toLowerCase().includes("consignment"))
      .forEach(r=>addBrand(r.id,r.partner_name,"Distribution","DP",r.pic||"",""));
    srReports={};
    (rptRes.data||[]).forEach(r=>{srReports[r.brand_id+"_"+r.month_index]={link:r.link||"",notes:r.notes||"",by:r.submitted_by||""};});
    const sdMap={};
    (sdRes.data||[]).forEach(r=>{sdMap[r.brand_id]=r.start_date;});
    srBrands.forEach(b=>{if(sdMap[b.id])b.startDate=sdMap[b.id];});
    populateSRPicFilter();
    applySRFilters();
  } catch(e) {
    document.getElementById("sr-loading").textContent = "Gagal memuat: "+e.message;
  }
}

function populateSRPicFilter() {
  const pics = [...new Set(srBrands.map(b=>b.pic).filter(Boolean))].sort();
  const sel = document.getElementById("sr-fil-pic");
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua PIC</option>` + pics.map(p=>`<option value="${p}">${p}</option>`).join("");
  if (cur && pics.includes(cur)) sel.value = cur;
}

function applySRFilters() {
  const q       = (document.getElementById("srSearch").value||"").toLowerCase();
  const fRev    = document.getElementById("sr-fil-revenue").value;
  const fMonth  = document.getElementById("sr-fil-month").value;
  const fStatus = document.getElementById("sr-fil-status").value;
  const fPic    = document.getElementById("sr-fil-pic").value;
  const fSrc    = document.getElementById("sr-fil-source").value;
  ["sr-fil-revenue","sr-fil-month","sr-fil-status","sr-fil-source","sr-fil-pic"].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);
  });

  const now = new Date();
  const curMonth = now.getMonth(); // 0-based

  srFiltered = srBrands.filter(b=>{
    if(q    && !(b.name||"").toLowerCase().includes(q)) return false;
    if(fRev && !(b.revenue||"").includes(fRev)) return false;
    if(fPic && (b.pic||"") !== fPic) return false;
    if(fSrc && b.source !== fSrc) return false;
    if(fStatus) {
      const checkMonth = fMonth !== "" ? parseInt(fMonth) : curMonth;
      const mIdx = SR_MONTHS.findIndex(m=>m.month===checkMonth);
      if(mIdx < 0) return true;
      const key = b.id+"_"+mIdx;
      const due = isCellDue(b, mIdx);
      const done = !!srReports[key];
      if(fStatus==="missing"  && (!due || done)) return false;
      if(fStatus==="complete" && (!due || !done)) return false;
    }
    return true;
  });

  computeSRStats();
  renderSRGrid();
}

function isCellDue(brand, monthIdx) {
  if (!brand.startDate) return true; // no start date = due from Jun
  const m = SR_MONTHS[monthIdx];
  const startDate = new Date(brand.startDate);
  const cellDate  = new Date(m.year, m.month, 1);
  return cellDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1);
}

function computeSRStats() {
  const now = new Date();
  const curMonth = now.getMonth();
  const curMIdx  = SR_MONTHS.findIndex(m=>m.month===curMonth);
  const mIdx = curMIdx >= 0 ? curMIdx : 0;

  let complete=0, missing=0, totalDue=0, totalDone=0;
  srFiltered.forEach(b=>{
    const key = b.id+"_"+mIdx;
    const due  = isCellDue(b, mIdx);
    if(due) {
      totalDue++;
      if(srReports[key]) { totalDone++; complete++; }
      else missing++;
    }
    // total across all months
    SR_MONTHS.forEach((m,i)=>{
      if(isCellDue(b,i)) {
        if(srReports[b.id+"_"+i]) totalDone++;
      }
    });
  });

  document.getElementById("sr-s-total").textContent    = srFiltered.length;
  document.getElementById("sr-s-complete").textContent = complete;
  document.getElementById("sr-s-missing").textContent  = missing;
  const rate = totalDue > 0 ? Math.round((totalDone/totalDue)*100) : 0;
  document.getElementById("sr-s-rate").textContent     = rate+"%";
}

function renderSRGrid() {
  document.getElementById("sr-loading").style.display = "none";
  const table = document.getElementById("sr-table");
  table.style.display = "table";

  // Filter months if month filter active
  const fMonth = document.getElementById("sr-fil-month").value;
  const months = fMonth !== "" ? SR_MONTHS.filter(m=>m.month===parseInt(fMonth)) : SR_MONTHS;

  // Header
  const thead = document.getElementById("sr-thead");
  thead.innerHTML = `<tr>
    <th style="min-width:180px;position:sticky;left:0;background:var(--off);z-index:2;">Brand</th>
    <th style="min-width:90px;white-space:nowrap;">PIC</th>
    <th style="min-width:60px;white-space:nowrap;">Start</th>
    ${months.map(m=>`<th style="min-width:90px;text-align:center;">${m.label}</th>`).join("")}
  </tr>`;

  // Body
  const tbody = document.getElementById("sr-tbody");
  if (!srFiltered.length) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="${months.length+3}">Tidak ada brand yang cocok.</td></tr>`;
    return;
  }

  tbody.innerHTML = srFiltered.map(b=>{
    const srcLabel  = {BM:"Brand Master",IP:"IP Master",CR:"Collaborator",DP:"Consignment"}[b.source]||b.source;
    const startLabel = b.startDate
      ? `<button class="btn-icon" onclick="openSDModal('${b.id}','${b.name.replace(/'/g,"\\'")}')">✏ ${fmtDate(b.startDate)}</button>`
      : `<button class="btn-icon" onclick="openSDModal('${b.id}','${b.name.replace(/'/g,"\\'")}')">+ Set</button>`;
    const cells = months.map(m=>{
      const due  = isCellDue(b, m.idx);
      const key  = b.id+"_"+m.idx;
      const rep  = srReports[key];
      if (!due) {
        return `<td style="background:var(--g100);text-align:center;">—</td>`;
      }
      if (rep) {
        return `<td style="background:#edf8ee;text-align:center;cursor:pointer;" onclick="openSRModal('${b.id}','${b.name.replace(/'/g,"\'")}',${m.idx},'${srcLabel}')">
          <a href="${rep.link}" target="_blank" onclick="event.stopPropagation()" style="font-family:var(--mono);font-size:10px;color:#1a5c25;text-decoration:underline;">✅ Lihat</a>
        </td>`;
      }
      return `<td style="background:#fdf0f0;text-align:center;cursor:pointer;" onclick="openSRModal('${b.id}','${b.name.replace(/'/g,"\'")}',${m.idx},'${srcLabel}')">
        <span style="font-size:11px;color:#7a1f1f;font-family:var(--mono);">🔴 +</span>
      </td>`;
    }).join("");

    const revStreams = (b.revenue||"").split(",").map(s=>s.trim()).filter(Boolean);
    const revBadge  = revStreams.map(s=>`<span class="pill" style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;font-size:9px;padding:1px 6px;">${s}</span>`).join(" ");

    return `<tr>
      <td style="position:sticky;left:0;background:var(--white);z-index:1;border-right:1px solid var(--g100);">
        <div style="font-weight:500;font-size:12px;">${b.name}</div>
        ${b.source==="CR"&&b.relatedIP?`<div style="font-size:10px;color:var(--g600);margin-top:1px;">${b.relatedIP}</div>`:""}
        <div style="margin-top:2px;">${revBadge}</div>
        <div style="font-size:10px;color:var(--g400);font-family:var(--mono);">${srcLabel}</div>
      </td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--g600);white-space:nowrap;">${b.pic||"—"}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--g400);white-space:nowrap;">${startLabel}</td>
      ${cells}
    </tr>`;
  }).join("");
}

function clearSRFilters() {
  ["sr-fil-revenue","sr-fil-month","sr-fil-status","sr-fil-source","sr-fil-pic"].forEach(id=>{
    const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}
  });
  document.getElementById("srSearch").value="";
  applySRFilters();
}

// ── MODAL: Submit Report ──
function openSRModal(brandId, brandName, monthIdx, srcLabel) {
  srModalContext = {brandId, monthIdx};
  const m   = SR_MONTHS[monthIdx];
  const key = brandId+"_"+monthIdx;
  const rep = srReports[key];
  document.getElementById("sr-modal-title").textContent = brandName;
  document.getElementById("sr-modal-sub").textContent   = (srcLabel ? srcLabel+" · " : "") + m.label;
  document.getElementById("sr-modal-link").value  = rep ? rep.link  : "";
  document.getElementById("sr-modal-notes").value = rep ? rep.notes : "";
  document.getElementById("sr-modal-clear").style.display = rep ? "inline-flex" : "none";
  document.getElementById("sr-modal-feedback").className = "feedback";
  const modal = document.getElementById("sr-modal");
  modal.style.display = "flex";
}

function closeSRModal() {
  document.getElementById("sr-modal").style.display = "none";
  srModalContext = null;
}

async function submitSRReport() {
  if (!srModalContext) return;
  const link = document.getElementById("sr-modal-link").value.trim();
  if (!link) { showSRModalFeedback("Link wajib diisi.","err"); return; }
  const btn = document.getElementById("sr-modal-btn");
  btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const notes=document.getElementById("sr-modal-notes").value.trim();
    const key=srModalContext.brandId+"_"+srModalContext.monthIdx;
    const isUpdate=!!srReports[key];
    if(isUpdate) {
      const {error}=await sb.from("sr_reports").update({link,notes,submitted_by:currentUser,submitted_at:new Date().toISOString()}).eq("brand_id",srModalContext.brandId).eq("month_index",String(srModalContext.monthIdx));
      if(error)throw error;
    } else {
      const {error}=await sb.from("sr_reports").insert({brand_id:srModalContext.brandId,month_index:String(srModalContext.monthIdx),link,notes,submitted_by:currentUser});
      if(error)throw error;
    }
    srReports[key]={link,notes,by:currentUser};
    logActivity("Sales Report",isUpdate?"update":"submit",srModalContext.brandId,srModalContext.brandName+" — bulan "+(srModalContext.monthIdx+1));
    closeSRModal(); applySRFilters();
  } catch(e) { showSRModalFeedback("Gagal: "+(e.message||e),"err"); }
  btn.disabled=false; btn.textContent="Submit";
}

async function clearSRReport() {
  if (!srModalContext) return;
  if (!confirm("Hapus link report ini?")) return;
  try {
    const {error}=await sb.from("sr_reports").delete().eq("brand_id",srModalContext.brandId).eq("month_index",String(srModalContext.monthIdx));
    if(error)throw error;
    logActivity("Sales Report","delete",srModalContext.brandId,srModalContext.brandName+" — bulan "+(srModalContext.monthIdx+1));
    delete srReports[srModalContext.brandId+"_"+srModalContext.monthIdx];
    closeSRModal(); applySRFilters();
  } catch(e) { showSRModalFeedback("Gagal: "+(e.message||e),"err"); }
}

function showSRModalFeedback(msg,type) {
  const el=document.getElementById("sr-modal-feedback"); el.textContent=msg; el.className="feedback "+type;
}

// ── MODAL: Set Start Date ──
function openSDModal(brandId, brandName) {
  srSDContext = {brandId};
  document.getElementById("sr-sd-brand").textContent = brandName;
  const brand = srBrands.find(b=>b.id===brandId);
  document.getElementById("sr-sd-date").value = brand && brand.startDate ? brand.startDate : "";
  document.getElementById("sr-sd-feedback").className = "feedback";
  document.getElementById("sr-startdate-modal").style.display = "flex";
}

function closeSDModal() {
  document.getElementById("sr-startdate-modal").style.display = "none";
  srSDContext = null;
}

async function saveStartDate() {
  if (!srSDContext) return;
  const date = document.getElementById("sr-sd-date").value;
  if (!date) { document.getElementById("sr-sd-feedback").textContent="Pilih tanggal dulu."; document.getElementById("sr-sd-feedback").className="feedback err"; return; }
  try {
    const brand=srBrands.find(b=>b.id===srSDContext.brandId);
    const {error}=await sb.from("sr_startdates").upsert({brand_id:srSDContext.brandId,brand_name:brand?brand.name:"",start_date:date,set_by:currentUser,set_at:new Date().toISOString()},{onConflict:"brand_id"});
    if(error)throw error;
    logActivity("Sales Report","set_startdate",srSDContext.brandId,(brand?brand.name:srSDContext.brandId)+" → "+date);
    if(brand)brand.startDate=date;
    closeSDModal(); applySRFilters();
  } catch(e) { document.getElementById("sr-sd-feedback").textContent="Gagal: "+(e.message||e); document.getElementById("sr-sd-feedback").className="feedback err"; }
}

// Close modals on backdrop click
document.getElementById("sr-modal").addEventListener("click", function(e) { if(e.target===this) closeSRModal(); });
document.getElementById("sr-startdate-modal").addEventListener("click", function(e) { if(e.target===this) closeSDModal(); });

// ── PRELOAD AUTOCOMPLETE ON LOGIN ──
async function preloadAutocomplete() {
  try {
    const [agrRes,ipRes,bmRes] = await Promise.all([
      sb.from("agreements").select("*"),
      sb.from("ip_master").select("*"),
      sb.from("brand_master").select("*")
    ]);
    if (!agrRes.error) {
      const rows=(agrRes.data||[]).map(mapAgr);
      acAgrOptions=rows.map(r=>({id:r.id,label:[r.partner,r.type].filter(Boolean).join(" — ")}));
      acAgrLinks={};
      rows.forEach(r=>{if(r.id&&r.link)acAgrLinks[r.id]=r.link;});
      acBrands=[...new Set(rows.map(r=>r.brand).filter(Boolean))];
      acTypes=[...new Set(rows.map(r=>r.type).filter(Boolean))];
      acPics=[...new Set(rows.map(r=>r.pic).filter(Boolean))];
    }
    if (!ipRes.error) {
      allIPRows=(ipRes.data||[]).map(r=>{const m=mapIP(r);m.ipStatus=computeIPStatusLocal(m.agreements);return m;});
      const ipNames=allIPRows.map(r=>r.name).filter(Boolean);
      acRRIPs=[...new Set([...acRRIPs,...ipNames])];
      ipNames.forEach(n=>{if(!acBrands.includes(n))acBrands.push(n);});
      allIPRows.map(r=>r.category).filter(Boolean).forEach(c=>{if(!acIPCategories.includes(c))acIPCategories.push(c);});
    }
    if (!bmRes.error) {
      allBMRows=(bmRes.data||[]).map(mapBM);
      const bmNames=allBMRows.map(r=>r.name).filter(Boolean);
      bmNames.forEach(n=>{if(!acBrands.includes(n))acBrands.push(n);});
      acRRIPs=[...new Set([...acRRIPs,...bmNames])];
      allBMRows.map(r=>r.category).filter(Boolean).forEach(c=>{if(!acIPCategories.includes(c))acIPCategories.push(c);if(!acBMCategories.includes(c))acBMCategories.push(c);});
    }
  } catch(e) { console.warn("Preload autocomplete failed:", e); }
}

// ── PKS AUTOCOMPLETE (special: stores drive link) ──
function setupACPKS(inpId, lstId) {
  const inp = document.getElementById(inpId), lst = document.getElementById(lstId);
  if (!inp || !lst) return;
  const render = () => {
    const q = inp.value.toLowerCase();
    const m = acAgrOptions.filter(o=>o.label.toLowerCase().includes(q)||o.id.toLowerCase().includes(q));
    if (!m.length) { lst.style.display="none"; return; }
    lst.innerHTML = m.map(o=>`<div class="ac-item" onclick="pickPKS('${o.id.replace(/'/g,"\'")}','${(o.label||"").replace(/'/g,"\'")}')">
      <div>${o.id}</div><div class="ac-item-sub">${o.label}${acAgrLinks[o.id]?' · Drive ↗':' · No Drive link'}</div>
    </div>`).join("");
    lst.style.display="block";
  };
  inp.addEventListener("input", render);
  inp.addEventListener("focus", ()=>{ if(acAgrOptions.length) render(); });
  document.addEventListener("click", e=>{ if(!inp.contains(e.target)&&!lst.contains(e.target)) lst.style.display="none"; });
}

function pickPKS(agrId, label) {
  const inp = document.getElementById("rr-pks");
  const lst = document.getElementById("ac-rr-pks");
  inp.value = agrId;
  inp.dataset.driveLink = acAgrLinks[agrId] || "";
  lst.style.display="none";
  // show drive link hint
  const hint = inp.parentElement.nextElementSibling;
  if (hint && acAgrLinks[agrId]) {
    hint.innerHTML = `<span style="color:var(--g600)">Drive: </span><a href="${acAgrLinks[agrId]}" target="_blank" style="color:var(--black);text-decoration:underline;font-size:11px;">Lihat dokumen ↗</a>`;
  }
}

// ── LEADS TRACKER ──
let allLeadsRows = [], acLeadsCategories = ["Musician","Brand","Filmmaker"];

function stagePillClass(s) {
  return {"New":"p-draft","Contacted":"p-review","Meeting":"p-signings","Proposal":"p-near","Negotiation":"p-near","Won":"p-active","Lost":"p-expired","On Hold":"p-inactive"}[s]||"p-draft";
}

function switchLeadsTab(name, el) {
  document.querySelectorAll("#page-leads .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("ldtab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("ldtab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadLeads();
}

async function submitLead() {
  const name=document.getElementById("ld-name").value.trim();
  const category=document.getElementById("ld-category").value.trim();
  const stage=document.getElementById("ld-stage").value;
  if (!name)     { showLdFeedback("Lead Name wajib diisi.","err"); return; }
  if (!category) { showLdFeedback("Category wajib diisi.","err"); return; }
  if (!stage)    { showLdFeedback("Stage wajib dipilih.","err"); return; }
  const revenues=[...document.querySelectorAll("#ld-revenue-checks input:checked")].map(c=>c.value);
  const btn=document.getElementById("ldSubmitBtn"); btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id=genId("LD");
    const {error}=await sb.from("leads").insert({id,lead_name:name,category,stage,pic:document.getElementById("ld-pic").value.trim(),contact:document.getElementById("ld-contact").value.trim(),revenue_stream:revenues.join(", "),notes:document.getElementById("ld-notes").value.trim(),priority:document.getElementById("ld-priority").value,added_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser});
    if(error)throw error;
    showLdFeedback("✓ Lead tersimpan — ID: "+id,"ok");
    logActivity("Leads Tracker","create",id,name+" ("+category+") — "+stage);
    insertNotif(document.getElementById("ld-pic").value.trim(),"Leads Tracker",id,`${currentUser} menambahkan kamu sebagai PIC di Leads: ${name}`);
    if (!acLeadsCategories.includes(category)) acLeadsCategories.push(category);
    clearLeadForm(); loadLeads();
  } catch(e) { showLdFeedback("Gagal: "+(e.message||e),"err"); }
  btn.disabled=false; btn.textContent="Simpan Lead";
}

function clearLeadForm() {
  ["ld-name","ld-category","ld-pic","ld-contact","ld-notes"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("ld-stage").value=""; document.getElementById("ld-priority").value="";
  document.querySelectorAll("#ld-revenue-checks input").forEach(c=>c.checked=false);
}

function showLdFeedback(msg,type) {
  const el=document.getElementById("ld-feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok") setTimeout(()=>el.className="feedback",6000);
}

async function loadLeads() {
  document.getElementById("ldTableBody").innerHTML=`<tr><td class="empty-td" colspan="12">Memuat...</td></tr>`;
  try {
    const {data,error}=await sb.from("leads").select("*").order("id");
    if(error)throw error;
    allLeadsRows=(data||[]).map(mapLD);
    const cats=[...new Set(allLeadsRows.map(r=>r.category).filter(Boolean))];
    cats.forEach(c=>{if(!acLeadsCategories.includes(c))acLeadsCategories.push(c);});
    const catSel=document.getElementById("ld-fil-category");
    if(catSel){while(catSel.options.length>1)catSel.remove(1);acLeadsCategories.forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c;catSel.appendChild(o);});}
    const pics=[...new Set(allLeadsRows.map(r=>r.pic).filter(Boolean))];
    const picSel=document.getElementById("ld-fil-pic");
    if(picSel){while(picSel.options.length>1)picSel.remove(1);pics.forEach(p=>{const o=document.createElement("option");o.value=o.textContent=p;picSel.appendChild(o);});}
    computeLeadsStats(allLeadsRows); applyLeadsFilters();
  } catch(e){document.getElementById("ldTableBody").innerHTML=`<tr><td class="empty-td" colspan="11">Gagal: ${e.message}</td></tr>`;}
}

const LD_PIPELINE_STAGES=["New","Contacted","Meeting","Proposal","Negotiation"];
const LD_STAGES=["New","Contacted","Meeting","Proposal","Negotiation","Won","Lost","On Hold"];

function computeLeadsStats(rows) {
  document.getElementById("ld-s-total").textContent    = rows.length;
  document.getElementById("ld-s-pipeline").textContent = rows.filter(r=>LD_PIPELINE_STAGES.includes(r.stage)).length;
  document.getElementById("ld-s-won").textContent      = rows.filter(r=>r.stage==="Won").length;
  document.getElementById("ld-s-lost").textContent     = rows.filter(r=>r.stage==="Lost").length;
  document.getElementById("ld-s-onhold").textContent   = rows.filter(r=>r.stage==="On Hold").length;
}

function applyLeadsFilters() {
  const q     =(document.getElementById("ldSearch").value||"").toLowerCase();
  const fStage=document.getElementById("ld-fil-stage").value;
  const fCat  =document.getElementById("ld-fil-category").value;
  const fRev  =document.getElementById("ld-fil-revenue").value;
  const fPic      =document.getElementById("ld-fil-pic").value;
  const fPriority =document.getElementById("ld-fil-priority").value;
  ["ld-fil-stage","ld-fil-category","ld-fil-revenue","ld-fil-pic","ld-fil-priority"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);});
  const filtered=allLeadsRows.filter(r=>{
    if(q        &&![r.name,r.contact,r.notes,r.pic].some(v=>(v||"").toLowerCase().includes(q)))return false;
    if(fStage   &&r.stage!==fStage)return false;
    if(fCat     &&r.category!==fCat)return false;
    if(fRev     &&!(r.revenue||"").includes(fRev))return false;
    if(fPic     &&r.pic!==fPic)return false;
    if(fPriority&&r.priority!==fPriority)return false;
    return true;
  });
  computeLeadsStats(filtered); renderLeadsTable(filtered);
}

function clearLeadsFilters() {
  ["ld-fil-stage","ld-fil-category","ld-fil-revenue","ld-fil-pic","ld-fil-priority"].forEach(id=>{const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}});
  document.getElementById("ldSearch").value="";
  computeLeadsStats(allLeadsRows); renderLeadsTable(allLeadsRows);
}

function renderLeadsTable(rows) {
  rows=sortBy(rows,ldSort.col,ldSort.dir);
  updateSortTh('ld-thead',ldSort.col,ldSort.dir);
  document.getElementById("ld-tcount").textContent=rows.length+" entri";
  const body=document.getElementById("ldTableBody");
  if(!rows.length){body.innerHTML=`<tr><td class="empty-td" colspan="12">Belum ada data.</td></tr>`;return;}
  const priorityPill=p=>p==="High"?`<span class="pill p-expired">${p}</span>`:p==="Medium"?`<span class="pill p-near">${p}</span>`:p==="Low"?`<span class="pill p-draft">${p}</span>`:"—";
  body.innerHTML=rows.map(r=>{
    const streams=(r.revenue||"").split(",").map(s=>s.trim()).filter(Boolean);
    return`<tr>
      <td class="td-id">${r.id||"—"}</td>
      <td style="font-weight:500">${r.name||"—"}</td>
      <td><span class="pill p-draft">${r.category||"—"}</span></td>
      <td><select class="pill status-inline ${stagePillClass(r.stage)}" onchange="updateLeadStage(this,'${r.rowIndex}')">${LD_STAGES.map(s=>`<option ${s===r.stage?"selected":""}>${s}</option>`).join("")}</select></td>
      <td style="font-size:12px">${r.pic||"—"}</td>
      <td>${streams.map(s=>`<span class="pill" style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;margin-right:3px">${s}</span>`).join("")||"—"}</td>
      <td style="font-size:11px;color:var(--g600)">${r.contact||"—"}</td>
      <td style="font-size:11px;color:var(--g600);max-width:200px;">${r.notes||"—"}</td>
      <td>${priorityPill(r.priority)}</td>
      <td class="td-audit">${r.date||"—"}</td>
      <td class="td-audit">${r.by||"—"}</td>
      <td><button class="btn-icon" onclick="openLeadEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteLead('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="ld-edit-row-${r.rowIndex}" style="display:none"><td colspan="12" style="padding:0 12px 12px;">
      <div class="edit-row-form">
        <div class="edit-row-grid">
          <div class="fg"><label>Lead Name</label><input type="text" id="ld-e-name-${r.rowIndex}" value="${r.name||""}"></div>
          <div class="fg"><label>Category</label><input type="text" id="ld-e-cat-${r.rowIndex}" value="${r.category||""}"></div>
          <div class="fg"><label>Stage</label><select id="ld-e-stage-${r.rowIndex}">${LD_STAGES.map(s=>`<option ${s===r.stage?"selected":""}>${s}</option>`).join("")}</select></div>
          <div class="fg"><label>PIC</label><input type="text" id="ld-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
          <div class="fg"><label>Contact</label><input type="text" id="ld-e-contact-${r.rowIndex}" value="${r.contact||""}"></div>
          <div class="fg"><label>Revenue Stream</label><input type="text" id="ld-e-revenue-${r.rowIndex}" value="${r.revenue||""}" placeholder="SD&Y, Lagaa, Distribution"></div>
          <div class="fg"><label>Notes</label><input type="text" id="ld-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
          <div class="fg"><label>Priority</label><select id="ld-e-priority-${r.rowIndex}"><option value="" ${!r.priority?"selected":""}>—</option><option ${r.priority==="Low"?"selected":""}>Low</option><option ${r.priority==="Medium"?"selected":""}>Medium</option><option ${r.priority==="High"?"selected":""}>High</option></select></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveLeadEdit('${r.rowIndex}')">Simpan</button>
          <button class="btn-cancel" onclick="closeLeadEdit('${r.rowIndex}')">Batal</button>
        </div>
      </div>
    </td></tr>`;
  }).join("");
}

function openLeadEdit(rowIndex){document.querySelectorAll("[id^='ld-edit-row-']").forEach(el=>el.style.display="none");document.getElementById("ld-edit-row-"+rowIndex).style.display="table-row";}
function closeLeadEdit(rowIndex){document.getElementById("ld-edit-row-"+rowIndex).style.display="none";}

async function deleteLead(rowIndex) {
  if (!confirm("Hapus lead ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("leads").delete().eq("id",rowIndex);
    if(error){alert("Gagal hapus: "+error.message);return;}
    logActivity("Leads Tracker","delete",rowIndex,"Dihapus");
    loadLeads();
  } catch(e) { alert("Koneksi gagal."); }
}

async function updateLeadStage(sel,rowIndex) {
  const newStage=sel.value;
  sel.className=`pill status-inline ${stagePillClass(newStage)}`;
  try {
    const {error}=await sb.from("leads").update({stage:newStage,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal update: "+error.message);return;}
    logActivity("Leads Tracker","stage_change",rowIndex,"Stage → "+newStage);
    const row=allLeadsRows.find(r=>r.rowIndex===rowIndex);
    if(row)row.stage=newStage;
    computeLeadsStats(allLeadsRows);
  } catch(e){alert("Koneksi gagal.");}
}

async function saveLeadEdit(rowIndex) {
  try {
    const {error}=await sb.from("leads").update({lead_name:document.getElementById("ld-e-name-"+rowIndex).value.trim(),category:document.getElementById("ld-e-cat-"+rowIndex).value.trim(),stage:document.getElementById("ld-e-stage-"+rowIndex).value,pic:document.getElementById("ld-e-pic-"+rowIndex).value.trim(),contact:document.getElementById("ld-e-contact-"+rowIndex).value.trim(),revenue_stream:document.getElementById("ld-e-revenue-"+rowIndex).value.trim(),notes:document.getElementById("ld-e-notes-"+rowIndex).value.trim(),priority:document.getElementById("ld-e-priority-"+rowIndex).value,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error){alert("Gagal simpan: "+error.message);return;}
    logActivity("Leads Tracker","edit",rowIndex,"Data diperbarui");
    const _ld=allLeadsRows.find(r=>r.rowIndex===rowIndex);
    if(_ld?.addedBy) insertNotif(_ld.addedBy,"Leads Tracker",rowIndex,`${currentUser} mengedit Leads: ${_ld.name}`);
    closeLeadEdit(rowIndex); loadLeads();
  } catch(e){alert("Koneksi gagal.");}
}

setupAC("ld-category","ac-ld-category",()=>acLeadsCategories);
setupAC("ld-pic","ac-ld-pic",()=>acPics);

// ── DISTRIBUTION PARTNER ──
let allDPRows = [], acDPTypes = ["Consignment","Bulk Purchase"], acDPChannels = ["Online Store","Physical Store","Marketplace","Pop-up"];

function switchDPTab(name, el) {
  document.querySelectorAll("#page-distpartner .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("dptab-new").style.display  = name==="new"  ? "block":"none";
  document.getElementById("dptab-list").style.display = name==="list" ? "block":"none";
  if (name==="list") loadDistPartner();
}

function setupACMulti(inpId, lstId, getOpts) {
  const inp=document.getElementById(inpId), lst=document.getElementById(lstId);
  if(!inp||!lst) return;
  const render=()=>{
    const parts=inp.value.split(",");
    const q=parts[parts.length-1].trim().toLowerCase();
    const selected=parts.slice(0,-1).map(s=>s.trim()).filter(Boolean);
    const m=getOpts().filter(o=>o.toLowerCase().includes(q)&&!selected.map(s=>s.toLowerCase()).includes(o.toLowerCase()));
    let html=m.map(o=>`<div class="ac-item" onclick="pickACMulti('${o.replace(/'/g,"\\'")}','${inpId}','${lstId}')">${o}</div>`).join("");
    const newVal=parts[parts.length-1].trim();
    if(newVal&&!getOpts().map(o=>o.toLowerCase()).includes(newVal.toLowerCase()))
      html+=`<div class="ac-add" onclick="pickACMulti('${newVal.replace(/'/g,"\\'")}','${inpId}','${lstId}')">+ Tambah "${newVal}"</div>`;
    if(!html){lst.style.display="none";return;}
    lst.innerHTML=html; lst.style.display="block";
  };
  inp.addEventListener("input", render);
  inp.addEventListener("focus", ()=>{ if(getOpts().length) render(); });
  document.addEventListener("click", e=>{ if(!inp.contains(e.target)&&!lst.contains(e.target)) lst.style.display="none"; });
}

function pickACMulti(val, inpId, lstId) {
  const inp=document.getElementById(inpId);
  const parts=inp.value.split(",").map(s=>s.trim()).filter(Boolean);
  if(!parts.map(s=>s.toLowerCase()).includes(val.toLowerCase())) parts.push(val);
  inp.value=parts.join(", ");
  document.getElementById(lstId).style.display="none";
}

async function submitDP() {
  const name=document.getElementById("dp-name").value.trim();
  const type=document.getElementById("dp-type").value.trim();
  if(!name){ showDPFeedback("Partner Name wajib diisi.","err"); return; }
  if(!type){ showDPFeedback("Type wajib diisi.","err"); return; }
  const btn=document.getElementById("dpSubmitBtn"); btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id=genId("DP");
    const now=new Date().toISOString();
    const {error}=await sb.from("dist_partners").insert({
      id,
      partner_name:    name,
      type,
      channel:         document.getElementById("dp-channel").value.trim(),
      region:          document.getElementById("dp-region").value.trim(),
      pic:             document.getElementById("dp-pic").value.trim(),
      contact_person:  document.getElementById("dp-contact-person").value.trim(),
      contact_info:    document.getElementById("dp-contact-info").value.trim(),
      live_status:     document.getElementById("dp-live-status").value||"Active",
      related_agreement:document.getElementById("dp-agreements").value.trim(),
      notes:           document.getElementById("dp-notes").value.trim(),
      added_by:        currentUser,
      date_added:      now,
      last_updated:    now,
      last_updated_by: currentUser
    });
    if(error) throw error;
    showDPFeedback("✓ Partner tersimpan — ID: "+id,"ok");
    logActivity("Distribution Partner","create",id,name+" ("+type+")");
    insertNotif(document.getElementById("dp-pic").value.trim(),"Distribution Partner",id,`${currentUser} menambahkan kamu sebagai PIC di Distribution Partner: ${name}`);
    type.split(",").map(s=>s.trim()).filter(Boolean).forEach(t=>{ if(!acDPTypes.includes(t)) acDPTypes.push(t); });
    const ch=document.getElementById("dp-channel").value.trim();
    ch.split(",").map(s=>s.trim()).filter(Boolean).forEach(c=>{ if(!acDPChannels.includes(c)) acDPChannels.push(c); });
    clearDPForm(); loadDistPartner();
  } catch(e){ showDPFeedback("Gagal: "+(e.message||e),"err"); }
  btn.disabled=false; btn.textContent="Simpan Partner";
}

function clearDPForm() {
  ["dp-name","dp-type","dp-channel","dp-region","dp-pic","dp-contact-person","dp-contact-info","dp-agreements","dp-notes"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("dp-live-status").value="Active";
}

function showDPFeedback(msg,type) {
  const el=document.getElementById("dp-feedback"); el.textContent=msg; el.className="feedback "+type;
  if(type==="ok") setTimeout(()=>el.className="feedback",6000);
}

async function loadDistPartner() {
  document.getElementById("dpTableBody").innerHTML=`<tr><td class="empty-td" colspan="11">Memuat...</td></tr>`;
  try {
    const {data,error}=await sb.from("dist_partners").select("*").order("id");
    if(error) throw error;
    allDPRows=(data||[]).map(mapDP);
    const types=[...new Set(allDPRows.flatMap(r=>(r.type||"").split(",").map(s=>s.trim())).filter(Boolean))];
    types.forEach(t=>{ if(!acDPTypes.includes(t)) acDPTypes.push(t); });
    const channels=[...new Set(allDPRows.flatMap(r=>(r.channel||"").split(",").map(s=>s.trim())).filter(Boolean))];
    channels.forEach(c=>{ if(!acDPChannels.includes(c)) acDPChannels.push(c); });
    const pics=[...new Set(allDPRows.map(r=>r.pic).filter(Boolean))];
    const chSel=document.getElementById("dp-fil-channel");
    if(chSel){while(chSel.options.length>1)chSel.remove(1);acDPChannels.forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c;chSel.appendChild(o);});}
    const picSel=document.getElementById("dp-fil-pic");
    if(picSel){while(picSel.options.length>1)picSel.remove(1);pics.forEach(p=>{const o=document.createElement("option");o.value=o.textContent=p;picSel.appendChild(o);});}
    computeDPStats(allDPRows); applyDPFilters();
  } catch(e){ document.getElementById("dpTableBody").innerHTML=`<tr><td class="empty-td" colspan="11">Gagal: ${e.message}</td></tr>`; }
}

function computeDPStats(rows) {
  document.getElementById("dp-s-total").textContent   = rows.length;
  document.getElementById("dp-s-active").textContent  = rows.filter(r=>r.liveStatus==="Active").length;
  document.getElementById("dp-s-consign").textContent = rows.filter(r=>(r.type||"").toLowerCase().includes("consignment")).length;
  document.getElementById("dp-s-bulk").textContent    = rows.filter(r=>(r.type||"").toLowerCase().includes("bulk purchase")).length;
}

function applyDPFilters() {
  const q      =(document.getElementById("dpSearch").value||"").toLowerCase();
  const fType  =document.getElementById("dp-fil-type").value;
  const fCh    =document.getElementById("dp-fil-channel").value;
  const fLive  =document.getElementById("dp-fil-livestatus").value;
  const fPic   =document.getElementById("dp-fil-pic").value;
  ["dp-fil-type","dp-fil-channel","dp-fil-livestatus","dp-fil-pic"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("active-filter",!!el.value);});
  const filtered=allDPRows.filter(r=>{
    if(q    &&![r.name,r.region,r.contactPerson,r.contactInfo,r.notes].some(v=>(v||"").toLowerCase().includes(q))) return false;
    if(fType&&!(r.type||"").toLowerCase().includes(fType.toLowerCase())) return false;
    if(fCh  &&!(r.channel||"").toLowerCase().includes(fCh.toLowerCase())) return false;
    if(fLive&&r.liveStatus!==fLive) return false;
    if(fPic &&r.pic!==fPic) return false;
    return true;
  });
  computeDPStats(filtered); renderDPTable(filtered);
}

function clearDPFilters() {
  ["dp-fil-type","dp-fil-channel","dp-fil-livestatus","dp-fil-pic"].forEach(id=>{const el=document.getElementById(id);if(el){el.value="";el.classList.remove("active-filter");}});
  document.getElementById("dpSearch").value="";
  computeDPStats(allDPRows); renderDPTable(allDPRows);
}

function renderDPTable(rows) {
  rows=sortBy(rows,dpSort.col,dpSort.dir);
  updateSortTh('dp-thead',dpSort.col,dpSort.dir);
  document.getElementById("dp-tcount").textContent=rows.length+" entri";
  const body=document.getElementById("dpTableBody");
  if(!rows.length){body.innerHTML=`<tr><td class="empty-td" colspan="12">Belum ada data.</td></tr>`;return;}
  body.innerHTML=rows.map(r=>{
    const types=(r.type||"").split(",").map(s=>s.trim()).filter(Boolean);
    const channels=(r.channel||"").split(",").map(s=>s.trim()).filter(Boolean);
    const agrs=(r.agreements||"").split(",").map(s=>s.trim()).filter(Boolean);
    return`<tr>
      <td class="td-id">${r.id||"—"}</td>
      <td style="font-weight:500">${r.name||"—"}</td>
      <td>${types.map(t=>{const cls=t.toLowerCase().includes("consignment")?"p-signings":t.toLowerCase().includes("bulk")?"p-active":"p-draft";return`<span class="pill ${cls}" style="margin-right:3px">${t}</span>`;}).join("")||"—"}</td>
      <td>${channels.map(c=>`<span class="pill p-draft" style="margin-right:3px">${c}</span>`).join("")||"—"}</td>
      <td style="font-size:12px">${r.region||"—"}</td>
      <td style="font-size:12px">${r.pic||"—"}</td>
      <td style="font-size:11px;color:var(--g600)">${r.contactPerson?`${r.contactPerson}${r.contactInfo?`<br><span style="font-size:10px;font-family:var(--mono)">${r.contactInfo}</span>`:""}` :"—"}</td>
      <td>${agrs.length?agrs.map(a=>{const opt=acAgrOptions.find?acAgrOptions.find(o=>o.id===a):null;const link=acAgrLinks[a];return link?`<a href="${link}" target="_blank" class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px;text-decoration:none" title="${opt?opt.label:""}">${a} ↗</a>`:`<span class="pill" style="background:#E6F1FB;color:#0C447C;border:0.5px solid #85B7EB;margin-right:3px" title="${opt?opt.label:""}">${a}</span>`;}).join(""):`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
      <td>
        <select class="pill live-toggle ${r.liveStatus==="Active"?"p-active":"p-inactive"}" onchange="updateDPLiveStatus(this,'${r.rowIndex}')">
          <option ${r.liveStatus==="Active"?"selected":""}>Active</option>
          <option ${r.liveStatus==="Inactive"?"selected":""}>Inactive</option>
        </select>
      </td>
      <td><span class="pill" style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC">Distribution</span></td>
      <td style="font-size:11px;color:var(--g600)">${r.notes||"—"}</td>
      <td><button class="btn-icon" onclick="openDPEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b;" onclick="deleteDP('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="dp-edit-row-${r.rowIndex}" style="display:none"><td colspan="12" style="padding:0 12px 12px;">
      <div class="edit-row-form">
        <div class="edit-row-grid">
          <div class="fg"><label>Partner Name</label><input type="text" id="dp-e-name-${r.rowIndex}" value="${r.name||""}"></div>
          <div class="fg"><label>Type</label><input type="text" id="dp-e-type-${r.rowIndex}" value="${r.type||""}" placeholder="Consignment, Bulk Purchase"></div>
          <div class="fg"><label>Channel</label><input type="text" id="dp-e-channel-${r.rowIndex}" value="${r.channel||""}" placeholder="Online Store, Marketplace"></div>
          <div class="fg"><label>Region</label><input type="text" id="dp-e-region-${r.rowIndex}" value="${r.region||""}"></div>
          <div class="fg"><label>PIC</label><input type="text" id="dp-e-pic-${r.rowIndex}" value="${r.pic||""}"></div>
          <div class="fg"><label>Contact Person</label><input type="text" id="dp-e-cperson-${r.rowIndex}" value="${r.contactPerson||""}"></div>
          <div class="fg"><label>Contact Info</label><input type="text" id="dp-e-cinfo-${r.rowIndex}" value="${r.contactInfo||""}"></div>
          <div class="fg"><label>Live Status</label><select id="dp-e-live-${r.rowIndex}"><option ${r.liveStatus==="Active"?"selected":""}>Active</option><option ${r.liveStatus==="Inactive"?"selected":""}>Inactive</option></select></div>
          <div class="fg"><label>Related Agreement</label><input type="text" id="dp-e-agr-${r.rowIndex}" value="${r.agreements||""}"></div>
          <div class="fg"><label>Notes</label><input type="text" id="dp-e-notes-${r.rowIndex}" value="${r.notes||""}"></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveDPEdit('${r.rowIndex}')">Simpan</button>
          <button class="btn-cancel" onclick="closeDPEdit('${r.rowIndex}')">Batal</button>
        </div>
      </div>
    </td></tr>`;
  }).join("");
}

function openDPEdit(rowIndex){document.querySelectorAll("[id^='dp-edit-row-']").forEach(el=>el.style.display="none");document.getElementById("dp-edit-row-"+rowIndex).style.display="table-row";}
function closeDPEdit(rowIndex){document.getElementById("dp-edit-row-"+rowIndex).style.display="none";}

async function deleteDP(rowIndex) {
  if (!confirm("Hapus distribution partner ini? Tindakan tidak dapat dibatalkan.")) return;
  try {
    const {error}=await sb.from("dist_partners").delete().eq("id",rowIndex);
    if(error) throw error;
    logActivity("Distribution Partner","delete",rowIndex,"Dihapus");
    loadDistPartner();
  } catch(e){ alert("Gagal hapus: "+(e.message||e)); }
}

async function updateDPLiveStatus(sel, rowIndex) {
  const newStatus=sel.value;
  sel.className=`pill live-toggle ${newStatus==="Active"?"p-active":"p-inactive"}`;
  try {
    const {error}=await sb.from("dist_partners").update({live_status:newStatus,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
    if(error) throw error;
    logActivity("Distribution Partner","status_change",rowIndex,"Live Status → "+newStatus);
    const row=allDPRows.find(r=>r.rowIndex===rowIndex);
    if(row) row.liveStatus=newStatus;
    computeDPStats(allDPRows);
  } catch(e){alert("Gagal update: "+(e.message||e));}
}

async function saveDPEdit(rowIndex) {
  try {
    const {error}=await sb.from("dist_partners").update({
      partner_name:     document.getElementById("dp-e-name-"+rowIndex).value.trim(),
      type:             document.getElementById("dp-e-type-"+rowIndex).value.trim(),
      channel:          document.getElementById("dp-e-channel-"+rowIndex).value.trim(),
      region:           document.getElementById("dp-e-region-"+rowIndex).value.trim(),
      pic:              document.getElementById("dp-e-pic-"+rowIndex).value.trim(),
      contact_person:   document.getElementById("dp-e-cperson-"+rowIndex).value.trim(),
      contact_info:     document.getElementById("dp-e-cinfo-"+rowIndex).value.trim(),
      live_status:      document.getElementById("dp-e-live-"+rowIndex).value,
      related_agreement:document.getElementById("dp-e-agr-"+rowIndex).value.trim(),
      notes:            document.getElementById("dp-e-notes-"+rowIndex).value.trim(),
      last_updated:     new Date().toISOString(),
      last_updated_by:  currentUser
    }).eq("id",rowIndex);
    if(error) throw error;
    logActivity("Distribution Partner","edit",rowIndex,"Data diperbarui");
    const _dp=allDPRows.find(r=>r.rowIndex===rowIndex);
    if(_dp?.addedBy) insertNotif(_dp.addedBy,"Distribution Partner",rowIndex,`${currentUser} mengedit Distribution Partner: ${_dp.name}`);
    closeDPEdit(rowIndex); loadDistPartner();
  } catch(e){alert("Gagal simpan: "+(e.message||e));}
}

setupACMulti("dp-type","ac-dp-type",()=>acDPTypes);
setupACMulti("dp-channel","ac-dp-channel",()=>acDPChannels);
setupAC("dp-pic","ac-dp-pic",()=>acPics);
setupAC("dp-agreements","ac-dp-agr",()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);

// ── POP UP BOOTH ──
let allPBRows = [];
let pbSort = {col:null,dir:'asc'};
function sortPBBy(c){pbSort.dir=pbSort.col===c?(pbSort.dir==='asc'?'desc':'asc'):'asc';pbSort.col=c;applyPBFilters();}

function getManpowerOptions() {
  const names = new Set();
  allPBRows.forEach(r=>{ if(r.manpower) r.manpower.split(",").map(n=>n.trim()).filter(Boolean).forEach(n=>names.add(n)); });
  return Array.from(names).sort();
}

function showPBJubelioInfo(sidId, hintId) {
  const sid = (document.getElementById(sidId)?.value||"").trim();
  const hint = document.getElementById(hintId);
  if (!hint) return;
  if (!sid) { hint.innerHTML=""; return; }
  const info = (window._jubOrderMap||{})[sid];
  if (!info) { hint.innerHTML=`<span style="color:var(--g400);font-size:11px">Tidak ditemukan di Jubelio Offline Sales.</span>`; return; }
  const gt = info.grand_total!=null ? `Rp ${Number(info.grand_total).toLocaleString("id-ID")}` : "—";
  hint.innerHTML=`<div style="background:var(--off);border:1px solid var(--g100);border-radius:6px;padding:8px 10px;margin-top:4px;font-size:12px;display:grid;gap:3px">
    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px"><span style="color:var(--g400);font-family:var(--mono);font-size:10px;padding-top:1px">ID</span><span style="font-family:var(--mono);font-size:11px">${sid}</span></div>
    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px"><span style="color:var(--g400);font-family:var(--mono);font-size:10px;padding-top:1px">Grand Total</span><span style="font-weight:600">${gt}</span></div>
    ${info.note?`<div style="display:grid;grid-template-columns:80px 1fr;gap:4px"><span style="color:var(--g400);font-family:var(--mono);font-size:10px;padding-top:1px">Note</span><span style="color:var(--g600)">${info.note.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</span></div>`:""}
  </div>`;
}

function calcPBSRDeadline(eventDate) {
  if (!eventDate) return "";
  const d = new Date(eventDate+"T00:00:00"); d.setDate(d.getDate()+7);
  return d.toISOString().slice(0,10);
}

function showPBSJInfo(sidId, hintId) {
  const sid = (document.getElementById(sidId)?.value||"").trim();
  const hint = document.getElementById(hintId);
  if (!hint) return;
  if (!sid) { hint.innerHTML=""; return; }
  const info = (window._mekariMap||{})[sid];
  if (!info) { hint.innerHTML=`<span style="color:var(--g400);font-size:11px">Tidak ditemukan di Inbound/Outbound Note.</span>`; return; }
  const dt = info.email_date ? new Date(info.email_date).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
  hint.innerHTML=`<div style="background:var(--off);border:1px solid var(--g100);border-radius:6px;padding:8px 10px;margin-top:4px;font-size:12px;display:grid;gap:3px">
    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px"><span style="color:var(--g400);font-family:var(--mono);font-size:10px">Subject</span><span>${(info.subject||"").replace(/</g,"&lt;")}</span></div>
    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px"><span style="color:var(--g400);font-family:var(--mono);font-size:10px">Tanggal</span><span>${dt}</span></div>
  </div>`;
}

function switchPBTab(name, el) {
  document.querySelectorAll("#page-popupbooth .tab-btn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("pbtab-new").style.display = name==="new" ? "block" : "none";
  document.getElementById("pbtab-list").style.display = name==="list" ? "block" : "none";
  if (name==="list") loadPopupBooth();
}

async function loadPopupBooth() {
  const tbody = document.getElementById("pbTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="13">Memuat...</td></tr>`;
  try {
    if (!allIPRows.length) {
      const {data} = await sb.from("ip_master").select("*");
      if (data) allIPRows = data.map(mapIP);
    }
    const [{data,error},{data:jubData},{data:mekData}] = await Promise.all([
      sb.from("popup_booths").select("*").order("event_date",{ascending:false}),
      sb.from("jubelio_offline_sales_orders").select("salesorder_id,grand_total,note"),
      sb.from("mekari_esign_completions").select("message_id,subject,email_date").order("email_date",{ascending:false})
    ]);
    if (error) throw error;
    allPBRows = (data||[]).map(mapPB);
    window._jubOrderMap = {};
    (jubData||[]).forEach(r=>{ if(r.salesorder_id!=null) window._jubOrderMap[String(r.salesorder_id).trim()] = {grand_total:r.grand_total,note:r.note||""}; });
    window._mekariMap = {};
    allMekariRows = (mekData||[]).map(mapMekari);
    allMekariRows.forEach(r=>{ window._mekariMap[r.id] = {subject:r.subject,email_date:r.emailDate}; });
    setupACMulti("pb-iprelated","ac-pb-iprelated",()=>allIPRows.filter(r=>r.liveStatus==="Active").map(r=>r.name).filter(Boolean));
    setupACMulti("pb-manpower","ac-pb-manpower",()=>getManpowerOptions());
    setupAC("pb-id-pesanan","ac-pb-idpesanan",()=>Object.keys(window._jubOrderMap||{}));
    setupAC("pb-sj","ac-pb-sj",()=>allMekariRows.map(r=>r.id),()=>allMekariRows.map(r=>({id:r.id,label:`${r.subject} (${fmtDate(r.emailDate)})`})));
    renderPBStats(allPBRows);
    populatePBIPFilter();
    applyPBFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="14">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderPBStats(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = rows.filter(r=>{ if(!r.srDeadline||r.eventStatus==="Done"||r.eventStatus==="Cancelled") return false; return new Date(r.srDeadline+"T00:00:00") < today; });
  const totalGT = rows.reduce((a,r)=>{ const info = r.idPesananJubelio?(window._jubOrderMap||{})[r.idPesananJubelio.trim()]:null; return a+(info?.grand_total!=null?Number(info.grand_total):0); },0);
  document.getElementById("pb-s-total").textContent = rows.length;
  document.getElementById("pb-s-upcoming").textContent = rows.filter(r=>{ if(!r.eventDate)return false; const d=new Date(r.eventDate+"T00:00:00"); return d>=today&&r.eventStatus!=="Done"&&r.eventStatus!=="Cancelled"; }).length;
  document.getElementById("pb-s-done").textContent = rows.filter(r=>r.eventStatus==="Done").length;
  document.getElementById("pb-s-cancelled").textContent = rows.filter(r=>r.eventStatus==="Cancelled").length;
  document.getElementById("pb-s-overdue").textContent = overdue.length;
  document.getElementById("pb-s-reinbound").textContent = rows.filter(r=>r.reinboundStatus==="Not Yet").length;
  document.getElementById("pb-s-grandtotal").textContent = totalGT ? "Rp "+totalGT.toLocaleString("id-ID") : "—";
}

function applyPBFilters() {
  const status   = (document.getElementById("pb-fil-status")?.value)||"";
  const reinb    = (document.getElementById("pb-fil-reinbound")?.value)||"";
  const ip       = (document.getElementById("pb-fil-ip")?.value)||"";
  const q        = ((document.getElementById("pbSearch")?.value)||"").toLowerCase();
  let rows = allPBRows;
  if (status==="Planned") rows = rows.filter(r=>!r.eventStatus||r.eventStatus==="Planned");
  else if (status==="Overdue") {
    const today=new Date(); today.setHours(0,0,0,0);
    rows = rows.filter(r=>r.srDeadline&&r.eventStatus!=="Done"&&r.eventStatus!=="Cancelled"&&new Date(r.srDeadline+"T00:00:00")<today);
  } else if (status) rows = rows.filter(r=>r.eventStatus===status);
  if (reinb==="none") rows = rows.filter(r=>!r.reinboundStatus);
  else if (reinb) rows = rows.filter(r=>r.reinboundStatus===reinb);
  if (ip) rows = rows.filter(r=>(r.ipRelated||"").toLowerCase().includes(ip.toLowerCase()));
  if (q) rows = rows.filter(r=>(r.eventName||"").toLowerCase().includes(q)||(r.location||"").toLowerCase().includes(q)||(r.ipRelated||"").toLowerCase().includes(q)||(r.manpower||"").toLowerCase().includes(q));
  renderPBTable(rows);
}
function populatePBIPFilter() {
  const sel = document.getElementById("pb-fil-ip");
  if (!sel) return;
  const ips = new Set();
  allPBRows.forEach(r=>{ (r.ipRelated||"").split(",").map(s=>s.trim()).filter(Boolean).forEach(s=>ips.add(s)); });
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua IP</option>`+Array.from(ips).sort().map(ip=>`<option value="${ip.replace(/"/g,'&quot;')}"${cur===ip?"selected":""}>${ip}</option>`).join("");
}

function renderPBTable(rows) {
  rows = sortBy(rows, pbSort.col, pbSort.dir);
  updateSortTh("pb-thead", pbSort.col, pbSort.dir);
  const tbody = document.getElementById("pbTableBody");
  document.getElementById("pb-tcount").textContent = rows.length+" entri";
  if (!rows.length) { tbody.innerHTML=`<tr><td class="empty-td" colspan="13">Tidak ada data.</td></tr>`; return; }
  const _today = new Date(); _today.setHours(0,0,0,0);
  tbody.innerHTML = rows.map(r => {
    const esPill = `<span class="pill ${r.eventStatus==="Done"?"p-active":r.eventStatus==="Cancelled"?"p-expired":"p-draft"}" style="font-size:11px">${r.eventStatus||"Planned"}</span>`;
    const reinPill = r.reinboundStatus ? `<span class="pill ${r.reinboundStatus==="Done"?"p-active":r.reinboundStatus==="Not Yet"?"p-near":r.reinboundStatus==="Sold Out"?"p-expired":"p-draft"}" style="font-size:11px">${r.reinboundStatus}</span>${(r.reinboundQty!==""&&r.reinboundQty!=null)?" ("+r.reinboundQty+")":""}` : "—";
    const jubInfo = r.idPesananJubelio ? (window._jubOrderMap||{})[r.idPesananJubelio.trim()] : null;
    const grandTotal = jubInfo?.grand_total!=null ? `Rp ${Number(jubInfo.grand_total).toLocaleString("id-ID")}` : "—";
    const mekInfo = r.suratJalanUrl ? (window._mekariMap||{})[r.suratJalanUrl.trim()] : null;
    const sjCell = mekInfo ? `<span style="font-size:11px;display:block;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(mekInfo.subject||"").replace(/"/g,"&quot;")}">${mekInfo.subject||r.suratJalanUrl}</span>` : (r.suratJalanUrl?"<span style='font-size:10px;color:var(--g400)'>"+r.suratJalanUrl.slice(0,18)+"…</span>":"—");
    const idPesananCell = r.idPesananJubelio
      ? `<div><a href="https://v2.jubelio.com/warehouse/orders/done/${encodeURIComponent(r.idPesananJubelio)}?view=true" target="_blank" style="font-family:var(--mono);font-size:11px;color:#3C3489;text-decoration:none">${r.idPesananJubelio}</a>${jubInfo?.note?`<div style="font-size:10px;color:var(--g400);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${jubInfo.note.replace(/"/g,'&quot;')}">${jubInfo.note}</div>`:""}` + `</div>`
      : `<span style="background:#fdecea;color:#c0392b;padding:2px 6px;border-radius:4px;font-size:11px">Belum diisi</span>`;
    const pm = r.paymentMethod ? r.paymentMethod.split(",").map(p=>`<span class="pill p-signings" style="font-size:10px;margin-right:2px">${p.trim()}</span>`).join("") : "—";
    const isOverdue = r.srDeadline && r.eventStatus!=="Done" && r.eventStatus!=="Cancelled" && new Date(r.srDeadline+"T00:00:00") < _today;
    return `<tr>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.eventDate)}</td>
      <td><strong>${r.eventName||"—"}</strong></td>
      <td style="font-size:12px">${r.location||"—"}</td>
      <td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.ipRelated||""}">${r.ipRelated||"—"}</td>
      <td style="font-size:11px;max-width:160px;color:var(--g600)">${r.manpower||"—"}</td>
      <td>${sjCell}</td>
      <td><span class="pill ${r.deliveryStatus==="Delivered"?"p-active":"p-draft"}" style="font-size:11px">${r.deliveryStatus||"Pending"}</span></td>
      <td>${esPill}</td>
      <td style="font-size:12px;white-space:nowrap">${reinPill}</td>
      <td style="white-space:nowrap;font-size:12px${isOverdue?";background:#fdecea;color:#c0392b;font-weight:500":""}">${r.srDeadline?fmtDate(r.srDeadline):"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${grandTotal}</td>
      <td style="font-size:11px">${pm}</td>
      <td>${idPesananCell}</td>
      <td><button class="btn-icon" onclick="openPBEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b" onclick="deletePB('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="pb-edit-row-${r.rowIndex}" style="display:none">
      <td colspan="13" style="padding:0 12px 12px">
        <div class="edit-row-form">
          <div class="edit-row-grid">
            <div class="fg"><label>Tanggal Event</label><input type="date" id="pbe-eventdate-${r.rowIndex}" value="${r.eventDate}"></div>
            <div class="fg"><label>Nama Event</label><input type="text" id="pbe-eventname-${r.rowIndex}" value="${(r.eventName||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>Lokasi</label><input type="text" id="pbe-location-${r.rowIndex}" value="${(r.location||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>IP Related</label><input type="text" id="pbe-iprelated-${r.rowIndex}" value="${(r.ipRelated||'').replace(/"/g,'&quot;')}" placeholder="Pisahkan dengan koma"></div>
            <div class="fg"><label>Event Status</label><select id="pbe-eventstatus-${r.rowIndex}"><option value="">Planned</option><option ${r.eventStatus==="Done"?"selected":""}>Done</option><option ${r.eventStatus==="Cancelled"?"selected":""}>Cancelled</option></select></div>
            <div class="fg"><label>Reinbound Status</label><select id="pbe-reinbound-${r.rowIndex}"><option value="">—</option><option ${r.reinboundStatus==="Done"?"selected":""}>Done</option><option ${r.reinboundStatus==="Not Yet"?"selected":""}>Not Yet</option><option ${r.reinboundStatus==="Sold Out"?"selected":""}>Sold Out</option></select></div>
            <div class="fg"><label>Reinbound Qty</label><input type="number" id="pbe-reinboundqty-${r.rowIndex}" value="${r.reinboundQty!=null?r.reinboundQty:''}" min="0"></div>
            <div class="fg full"><label>Payment Method</label><div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0"><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-jpos-${r.rowIndex}" ${(r.paymentMethod||"").includes("Jubelio POS")?"checked":""}> Jubelio POS</label><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-qris-${r.rowIndex}" ${(r.paymentMethod||"").includes("QRIS Xendit")?"checked":""}> QRIS Xendit</label><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-cons-${r.rowIndex}" ${(r.paymentMethod||"").includes("Consignment")?"checked":""}> Consignment</label></div></div>
            <div class="fg" style="position:relative"><label>Manpower</label><input type="text" id="pbe-manpower-${r.rowIndex}" value="${(r.manpower||'').replace(/"/g,'&quot;')}" placeholder="Ketik nama, pisahkan dengan koma" autocomplete="off"><div class="ac-list" id="ac-pbe-manpower-${r.rowIndex}"></div></div>
            <div class="fg" style="position:relative"><label>Surat Jalan</label><input type="text" id="pbe-sj-${r.rowIndex}" value="${(r.suratJalanUrl||'').replace(/"/g,'&quot;')}" placeholder="Pilih dari Inbound/Outbound Note" autocomplete="off" oninput="showPBSJInfo('pbe-sj-${r.rowIndex}','pbe-sj-hint-${r.rowIndex}')"><div class="ac-list" id="ac-pbe-sj-${r.rowIndex}"></div><div id="pbe-sj-hint-${r.rowIndex}"></div></div>
            <div class="fg" style="position:relative"><label>ID Pesanan Jubelio</label><input type="text" id="pbe-idpesanan-${r.rowIndex}" value="${(r.idPesananJubelio||'').replace(/"/g,'&quot;')}" placeholder="Pilih dari Jubelio Offline Sales" autocomplete="off" oninput="showPBJubelioInfo('pbe-idpesanan-${r.rowIndex}','pbe-jubelio-hint-${r.rowIndex}')"><div class="ac-list" id="ac-pbe-idpesanan-${r.rowIndex}"></div><div id="pbe-jubelio-hint-${r.rowIndex}"></div></div>
            <div class="fg full"><label>Notes</label><textarea id="pbe-notes-${r.rowIndex}" rows="2" style="resize:vertical">${(r.notes||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea></div>
          </div>
          <div class="edit-row-btns">
            <button class="btn-save" onclick="savePBEdit('${r.rowIndex}')">Simpan</button>
            <button class="btn-cancel" onclick="closePBEdit('${r.rowIndex}')">Batal</button>
            <button class="btn-delete" onclick="deletePB('${r.rowIndex}')">Hapus</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function openPBEdit(rowIdx) {
  document.querySelectorAll("[id^='pb-edit-row-']").forEach(el=>{ if(el.id!=="pb-edit-row-"+rowIdx) el.style.display="none"; });
  const row = document.getElementById("pb-edit-row-"+rowIdx);
  if (!row) return;
  const shown = row.style.display==="table-row";
  row.style.display = shown ? "none" : "table-row";
  if (!shown) {
    setupACMulti("pbe-manpower-"+rowIdx,"ac-pbe-manpower-"+rowIdx,()=>getManpowerOptions());
    setupAC("pbe-idpesanan-"+rowIdx,"ac-pbe-idpesanan-"+rowIdx,()=>Object.keys(window._jubOrderMap||{}));
    setupAC("pbe-sj-"+rowIdx,"ac-pbe-sj-"+rowIdx,()=>allMekariRows.map(r=>r.id),()=>allMekariRows.map(r=>({id:r.id,label:`${r.subject} (${fmtDate(r.emailDate)})`})));
    const orig = allPBRows.find(r=>r.rowIndex===rowIdx);
    if (orig?.idPesananJubelio) showPBJubelioInfo("pbe-idpesanan-"+rowIdx,"pbe-jubelio-hint-"+rowIdx);
    if (orig?.suratJalanUrl) showPBSJInfo("pbe-sj-"+rowIdx,"pbe-sj-hint-"+rowIdx);
  }
}
function closePBEdit(rowIdx) { const r=document.getElementById("pb-edit-row-"+rowIdx); if(r) r.style.display="none"; }

async function savePBEdit(rowIdx) {
  const btn = document.querySelector(`#pb-edit-row-${rowIdx} .btn-save`);
  if (btn) { btn.disabled=true; btn.textContent="Menyimpan..."; }
  try {
    const orig = allPBRows.find(r=>r.rowIndex===rowIdx);
    const sjUrl = document.getElementById(`pbe-sj-${rowIdx}`)?.value.trim()||null;
    const pm = [
      document.getElementById(`pbe-pm-jpos-${rowIdx}`)?.checked?"Jubelio POS":"",
      document.getElementById(`pbe-pm-qris-${rowIdx}`)?.checked?"QRIS Xendit":"",
      document.getElementById(`pbe-pm-cons-${rowIdx}`)?.checked?"Consignment":""
    ].filter(Boolean).join(", ");
    const manpower = document.getElementById(`pbe-manpower-${rowIdx}`)?.value.trim()||null;
    const eventDate = document.getElementById(`pbe-eventdate-${rowIdx}`).value;
    const srDeadline = calcPBSRDeadline(eventDate);
    const nm = document.getElementById(`pbe-eventname-${rowIdx}`).value.trim();
    if (!nm) { if(btn){btn.disabled=false;btn.textContent="Simpan";} alert("Nama Event wajib diisi."); return; }
    const rqVal  = document.getElementById(`pbe-reinboundqty-${rowIdx}`).value;
    const {error} = await sb.from("popup_booths").update({
      event_name:nm, event_date:eventDate||null,
      location:document.getElementById(`pbe-location-${rowIdx}`).value.trim()||null,
      ip_related:document.getElementById(`pbe-iprelated-${rowIdx}`).value.trim()||null,
      manpower,
      surat_jalan_url:sjUrl, delivery_status:sjUrl?"Delivered":null,
      event_status:document.getElementById(`pbe-eventstatus-${rowIdx}`).value||null,
      reinbound_status:document.getElementById(`pbe-reinbound-${rowIdx}`).value||null,
      reinbound_qty:rqVal?parseInt(rqVal):null, sr_deadline:srDeadline||null,
      payment_method:pm||null,
      id_pesanan_jubelio:document.getElementById(`pbe-idpesanan-${rowIdx}`)?.value.trim()||null,
      notes:document.getElementById(`pbe-notes-${rowIdx}`).value.trim()||null,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",rowIdx);
    if (error) throw error;
    closePBEdit(rowIdx);
    logActivity("Pop Up Booth","edit",rowIdx,nm);
    if (orig?.addedBy) insertNotif(orig.addedBy,"Pop Up Booth",rowIdx,`${currentUser} mengedit Pop Up Booth: ${nm}`);
    await loadPopupBooth();
  } catch(e) {
    if(btn){btn.disabled=false;btn.textContent="Simpan";}
    alert("Gagal menyimpan: "+(e.message||e));
  }
}

async function deletePB(rowIdx) {
  if (!confirm("Hapus event ini? Tindakan tidak bisa dibatalkan.")) return;
  try {
    const {error} = await sb.from("popup_booths").delete().eq("id",rowIdx);
    if (error) throw error;
    logActivity("Pop Up Booth","delete",rowIdx,"Dihapus");
    await loadPopupBooth();
  } catch(e) { alert("Gagal menghapus: "+(e.message||e)); }
}

function clearPBForm() {
  ["pb-eventdate","pb-eventname","pb-location","pb-iprelated","pb-notes","pb-reinboundqty","pb-sj","pb-id-pesanan"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  ["pb-eventstatus","pb-reinbound"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  ["pb-pm-jpos","pb-pm-qris","pb-pm-cons"].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});
  const sjHint=document.getElementById("pb-sj-hint");if(sjHint)sjHint.textContent="";
  const mptxt=document.getElementById("pb-manpower"); if(mptxt) mptxt.value="";
  const jubHint=document.getElementById("pb-jubelio-hint"); if(jubHint) jubHint.textContent="";
  const fb=document.getElementById("pb-feedback"); if(fb) fb.textContent="";
}

async function submitPB() {
  const eventName = document.getElementById("pb-eventname").value.trim();
  const eventDate = document.getElementById("pb-eventdate").value;
  if (!eventName) { document.getElementById("pb-feedback").innerHTML='<span class="fb-err">Nama Event wajib diisi.</span>'; return; }
  if (!eventDate) { document.getElementById("pb-feedback").innerHTML='<span class="fb-err">Tanggal Event wajib diisi.</span>'; return; }
  const btn = document.getElementById("pbSubmitBtn");
  btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id = genId("PB");
    const sjUrl = document.getElementById("pb-sj")?.value.trim()||null;
    const pm = [
      document.getElementById("pb-pm-jpos")?.checked?"Jubelio POS":"",
      document.getElementById("pb-pm-qris")?.checked?"QRIS Xendit":"",
      document.getElementById("pb-pm-cons")?.checked?"Consignment":""
    ].filter(Boolean).join(", ");
    const manpower = document.getElementById("pb-manpower")?.value.trim()||null;
    const srDeadline = calcPBSRDeadline(eventDate);
    const rqVal  = document.getElementById("pb-reinboundqty").value;
    const row = {
      id, event_name:eventName, event_date:eventDate,
      location:document.getElementById("pb-location").value.trim()||null,
      ip_related:document.getElementById("pb-iprelated").value.trim()||null,
      manpower,
      surat_jalan_url:sjUrl,
      delivery_status:sjUrl?"Delivered":null,
      event_status:document.getElementById("pb-eventstatus").value||null,
      reinbound_status:document.getElementById("pb-reinbound").value||null,
      reinbound_qty:rqVal?parseInt(rqVal):null,
      sr_deadline:srDeadline||null,
      payment_method:pm||null,
      id_pesanan_jubelio:document.getElementById("pb-id-pesanan")?.value.trim()||null,
      notes:document.getElementById("pb-notes").value.trim()||null,
      date_added:new Date().toISOString().slice(0,10),
      added_by:currentUser,
      last_updated:new Date().toISOString(),
      last_updated_by:currentUser
    };
    const {error} = await sb.from("popup_booths").insert(row);
    if (error) throw error;
    document.getElementById("pb-feedback").innerHTML=`<span class="fb-ok">✓ Pop Up Booth tersimpan — ID: ${id}</span>`;
    logActivity("Pop Up Booth","create",id,eventName);
    clearPBForm();
  } catch(e) {
    document.getElementById("pb-feedback").innerHTML=`<span class="fb-err">Gagal: ${e.message||e}</span>`;
  } finally {
    btn.disabled=false; btn.textContent="Simpan";
  }
}

// ── NOTIFICATIONS ──
let notifPollTimer = null;

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const {data} = await sb.from("notifications").select("*").eq("recipient",currentUser).order("created_at",{ascending:false}).limit(50);
    const all = data || [];
    const unreadCount = all.filter(n=>!n.is_read).length;
    const badge = document.getElementById("notif-badge");
    if (badge) { badge.textContent = unreadCount > 9 ? "9+" : unreadCount; badge.style.display = unreadCount ? "flex" : "none"; }
    renderNotifDropdown(all);
  } catch(e) { /* silent */ }
}

function renderNotifDropdown(items) {
  const list = document.getElementById("notif-list");
  if (!list) return;
  if (!items.length) { list.innerHTML = `<div class="notif-empty">Tidak ada notifikasi</div>`; return; }
  list.innerHTML = items.map(n => {
    const dt = new Date(n.created_at).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    return `<div class="notif-item ${n.is_read?"read":"unread"}" onclick="handleNotif(${n.id},'${n.module}','${n.record_id||""}')">
      <div class="notif-msg">${n.message}</div>
      <div class="notif-time">${dt}</div>
    </div>`;
  }).join("");
}

async function handleNotif(id, module, recordId) {
  await sb.from("notifications").update({is_read:true}).eq("id",id);
  document.getElementById("notif-dropdown").style.display = "none";
  const pageMap = {"Agreement":"agreement","IP Master":"ipmaster","Royalty Recipients":"recipients","Brand Master":"brandmaster","Sales Report":"salesreport","Account Report":"salesreport","Leads Tracker":"leads","Leads Management":"leads","Distribution Partner":"distpartner","Pop Up Booth":"popupbooth","Jubelio Offline Sales":"jubsales"};
  const page = pageMap[module];
  if (page) {
    showPage(page, document.getElementById("nav-"+page));
    // Switch to list tab after a brief delay so the page renders first
    setTimeout(() => {
      const listBtn = document.querySelector("#page-"+page+" .tab-bar .tab-btn:nth-child(2)");
      if (listBtn) listBtn.click();
    }, 80);
  }
  loadNotifications();
}

async function markAllNotifRead() {
  await sb.from("notifications").update({is_read:true}).eq("recipient",currentUser).eq("is_read",false);
  loadNotifications();
}

function toggleNotifDropdown() {
  const dd = document.getElementById("notif-dropdown");
  if (!dd) return;
  const isOpen = dd.style.display === "block";
  dd.style.display = isOpen ? "none" : "block";
  if (!isOpen) loadNotifications();
}

document.addEventListener("click", e => {
  const wrap = document.getElementById("notif-wrap");
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById("notif-dropdown");
    if (dd) dd.style.display = "none";
  }
});

// ── ACTIVITY LOG ──
let allLogRows = [];

async function loadActivityLog() {
  const tbody = document.getElementById("logTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="6">Memuat...</td></tr>`;
  try {
    const {data,error} = await sb.from("activity_logs").select("*").order("ts",{ascending:false}).limit(500);
    if(error) throw error;
    allLogRows = data||[];
    applyLogFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="6">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function applyLogFilters() {
  const mod = document.getElementById("log-fil-module").value;
  const act = document.getElementById("log-fil-action").value;
  const q   = (document.getElementById("logSearch").value||"").toLowerCase();
  let rows = allLogRows;
  if(mod) rows = rows.filter(r=>r.module===mod);
  if(act) rows = rows.filter(r=>r.action===act);
  if(q)   rows = rows.filter(r=>(r.user_name||"").toLowerCase().includes(q)||(r.details||"").toLowerCase().includes(q)||(r.record_id||"").toLowerCase().includes(q));
  renderLogTable(rows);
}

function clearLogFilters() {
  document.getElementById("log-fil-module").value="";
  document.getElementById("log-fil-action").value="";
  document.getElementById("logSearch").value="";
  applyLogFilters();
}

function renderLogTable(rows) {
  rows=sortBy(rows,logSort.col,logSort.dir);
  updateSortTh('log-thead',logSort.col,logSort.dir);
  const tbody = document.getElementById("logTableBody");
  document.getElementById("log-tcount").textContent = rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="6">Tidak ada data.</td></tr>`;return;}
  const actionPill={login:"p-active",logout:"p-inactive",create:"p-signed",edit:"p-signings",delete:"p-expired",status_change:"p-review",stage_change:"p-review",submit:"p-signed",update:"p-signings",set_startdate:"p-near"};
  tbody.innerHTML = rows.map(r=>{
    const dt = r.ts ? new Date(r.ts).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
    const pc = actionPill[r.action]||"p-draft";
    return `<tr>
      <td style="white-space:nowrap;font-size:12px;font-family:var(--mono)">${dt}</td>
      <td><strong>${r.user_name||"—"}</strong></td>
      <td style="font-size:12px">${r.module||"—"}</td>
      <td><span class="pill ${pc}" style="font-size:11px">${r.action||"—"}</span></td>
      <td style="font-size:11px;font-family:var(--mono);color:var(--g400)">${r.record_id||"—"}</td>
      <td style="font-size:12px">${r.details||"—"}</td>
    </tr>`;
  }).join("");
}

// ── JUBELIO OFFLINE SALES ──
let allJubRows = [];
let jubSort = {col:null,dir:'asc'};
function sortJubBy(c){jubSort.dir=jubSort.col===c?(jubSort.dir==='asc'?'desc':'asc'):'asc';jubSort.col=c;applyJubFilters();}

function mapJub(r) {
  return {
    rowIndex:r.id, id:r.id,
    salesorderId:r.salesorder_id!=null?String(r.salesorder_id):"",
    shippingFullName:r.shipping_full_name||"",
    transactionDate:r.transaction_date||"",
    internalStatus:r.internal_status||"",
    grandTotal:r.grand_total!=null?r.grand_total:"",
    locationName:r.location_name||"",
    note:r.note||""
  };
}

async function loadJubSales() {
  const tbody = document.getElementById("jubTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;
  try {
    const [{data:jubData,error:jubErr},{data:pbData}] = await Promise.all([
      sb.from("jubelio_offline_sales_orders").select("*").order("transaction_date",{ascending:false}),
      sb.from("popup_booths").select("id_pesanan_jubelio,event_name")
    ]);
    if (jubErr) throw jubErr;
    allJubRows = (jubData||[]).map(mapJub);
    // Build map: salesorder_id → event_name
    window._jubMappedToMap = {};
    (pbData||[]).forEach(r=>{
      if (r.id_pesanan_jubelio!=null && String(r.id_pesanan_jubelio).trim()) {
        window._jubMappedToMap[String(r.id_pesanan_jubelio).trim()] = r.event_name||"";
      }
    });
    renderJubStats(allJubRows);
    applyJubFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function getJubMappedTo(row) {
  const sid = row.salesorderId!=null ? String(row.salesorderId).trim() : "";
  if (!sid) return null;
  const m = window._jubMappedToMap||{};
  return sid in m ? (m[sid]||"(Event)") : null;
}

function renderJubStats(rows) {
  const mapped = rows.filter(r=>getJubMappedTo(r)!==null).length;
  const unmapped = rows.length - mapped;
  const totalSales = rows.reduce((a,r)=>a+(r.grandTotal!==""&&r.grandTotal!=null?Number(r.grandTotal):0),0);
  document.getElementById("jub-s-total").textContent = rows.length;
  document.getElementById("jub-s-mapped").textContent = mapped;
  document.getElementById("jub-s-unmapped").textContent = unmapped;
  document.getElementById("jub-s-total-sales").textContent = totalSales ? "Rp "+totalSales.toLocaleString("id-ID") : "—";
}

function applyJubFilters() {
  const mapFil  = document.getElementById("jub-fil-mapped")?.value||"";
  const locFil  = document.getElementById("jub-fil-location")?.value||"";
  const q = (document.getElementById("jubSearch")?.value||"").toLowerCase();
  let rows = allJubRows;
  if (mapFil==="mapped") rows = rows.filter(r=>getJubMappedTo(r)!==null);
  else if (mapFil==="unmapped") rows = rows.filter(r=>getJubMappedTo(r)===null);
  if (locFil==="!Gudang Marte") rows = rows.filter(r=>r.locationName!=="Gudang Marte");
  else if (locFil) rows = rows.filter(r=>r.locationName===locFil);
  if (q) rows = rows.filter(r=>(r.salesorderId||"").toLowerCase().includes(q)||(r.shippingFullName||"").toLowerCase().includes(q)||(r.internalStatus||"").toLowerCase().includes(q)||(r.locationName||"").toLowerCase().includes(q));
  renderJubStats(rows);
  renderJubTable(rows);
}

function clearJubFilters() {
  const mf=document.getElementById("jub-fil-mapped"); if(mf) mf.value="";
  const lf=document.getElementById("jub-fil-location"); if(lf) lf.value="";
  const s=document.getElementById("jubSearch"); if(s) s.value="";
  applyJubFilters();
}

function renderJubTable(rows) {
  rows = sortBy(rows, jubSort.col, jubSort.dir);
  updateSortTh("jub-thead", jubSort.col, jubSort.dir);
  const tbody = document.getElementById("jubTableBody");
  document.getElementById("jub-tcount").textContent = rows.length+" entri";
  if (!rows.length) { tbody.innerHTML=`<tr><td class="empty-td" colspan="8">Tidak ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => {
    const mappedTo = getJubMappedTo(r);
    const mappedCell = mappedTo !== null
      ? `<span class="pill p-active" style="font-size:11px">Mapped to ${(mappedTo).replace(/</g,"&lt;")}</span>`
      : `<span style="color:#c0392b;font-size:11px;font-weight:500">Unmapped</span>`;
    const gt = (r.grandTotal!==""&&r.grandTotal!=null) ? `Rp ${Number(r.grandTotal).toLocaleString("id-ID")}` : "—";
    const sidCell = r.salesorderId
      ? `<a href="https://v2.jubelio.com/sales/transactions/orders/detail/${r.salesorderId}" target="_blank" style="font-family:var(--mono);font-size:12px;color:#3C3489;text-decoration:none">${r.salesorderId}</a>`
      : "—";
    const locPill = r.locationName
      ? `<span class="pill ${r.locationName==="Gudang Marte"?"p-signings":"p-draft"}" style="font-size:11px">${r.locationName}</span>`
      : "—";
    return `<tr>
      <td>${sidCell}</td>
      <td>${r.shippingFullName||"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.transactionDate)}</td>
      <td>${locPill}</td>
      <td><span class="pill p-draft" style="font-size:11px">${r.internalStatus||"—"}</span></td>
      <td style="white-space:nowrap;font-size:12px">${gt}</td>
      <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.note||'').replace(/"/g,'&quot;')}">${r.note||"—"}</td>
      <td>${mappedCell}</td>
    </tr>`;
  }).join("");
}


// ── MEKARI ESIGN ──
let allMekariRows = [];
let mekariSort = {col:null,dir:'asc'};
function sortMekariBy(c){mekariSort.dir=mekariSort.col===c?(mekariSort.dir==='asc'?'desc':'asc'):'asc';mekariSort.col=c;applyMekariFilters();}

function mapMekari(r) {
  return {
    rowIndex:r.message_id, id:r.message_id,
    subject:r.subject||"",
    emailDate:r.email_date||"",
    syncedAt:r.synced_at||""
  };
}

function getMekariMappedTo(row) {
  const mid = row.id!=null ? String(row.id).trim() : "";
  if (!mid) return null;
  const m = window._mekariMappedToMap||{};
  return mid in m ? (m[mid]||"(Event)") : null;
}

async function loadMekariEsign() {
  const tbody = document.getElementById("mekariTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="4">Memuat...</td></tr>`;
  try {
    const [{data:mekData,error:mekErr},{data:pbData}] = await Promise.all([
      sb.from("mekari_esign_completions").select("*").order("email_date",{ascending:false}),
      sb.from("popup_booths").select("surat_jalan_url,event_name")
    ]);
    if (mekErr) throw mekErr;
    allMekariRows = (mekData||[]).map(mapMekari);
    // Build map: message_id → event_name
    window._mekariMappedToMap = {};
    (pbData||[]).forEach(r=>{
      if (r.surat_jalan_url!=null && String(r.surat_jalan_url).trim()) {
        window._mekariMappedToMap[String(r.surat_jalan_url).trim()] = r.event_name||"";
      }
    });
    renderMekariStats(allMekariRows);
    applyMekariFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="4">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderMekariStats(rows) {
  const mapped = rows.filter(r=>getMekariMappedTo(r)!==null).length;
  document.getElementById("mek-s-total").textContent = rows.length;
  document.getElementById("mek-s-mapped").textContent = mapped;
  document.getElementById("mek-s-unmapped").textContent = rows.length - mapped;
}

function applyMekariFilters() {
  const mapFil = document.getElementById("mek-fil-mapped")?.value||"";
  const q = (document.getElementById("mekariSearch")?.value||"").toLowerCase();
  let rows = allMekariRows;
  if (mapFil==="mapped") rows = rows.filter(r=>getMekariMappedTo(r)!==null);
  else if (mapFil==="unmapped") rows = rows.filter(r=>getMekariMappedTo(r)===null);
  if (q) rows = rows.filter(r=>(r.subject||"").toLowerCase().includes(q)||(r.id||"").toLowerCase().includes(q));
  renderMekariTable(rows);
}

function clearMekariFilters() {
  const mf=document.getElementById("mek-fil-mapped"); if(mf) mf.value="";
  const s=document.getElementById("mekariSearch"); if(s) s.value="";
  applyMekariFilters();
}

function renderMekariTable(rows) {
  rows = sortBy(rows, mekariSort.col, mekariSort.dir);
  updateSortTh("mekari-thead", mekariSort.col, mekariSort.dir);
  const tbody = document.getElementById("mekariTableBody");
  document.getElementById("mek-tcount").textContent = rows.length+" entri";
  if (!rows.length) { tbody.innerHTML=`<tr><td class="empty-td" colspan="4">Tidak ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => {
    const mappedTo = getMekariMappedTo(r);
    const mappedCell = mappedTo !== null
      ? `<span class="pill p-active" style="font-size:11px">Mapped to ${(mappedTo).replace(/</g,"&lt;")}</span>`
      : `<span style="color:#c0392b;font-size:11px;font-weight:500">Unmapped</span>`;
    const dt = r.emailDate ? new Date(r.emailDate).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;word-break:break-all;max-width:220px">${(r.id||"—").replace(/</g,"&lt;")}</td>
      <td style="font-size:13px">${(r.subject||"—").replace(/</g,"&lt;")}</td>
      <td style="white-space:nowrap;font-size:12px">${dt}</td>
      <td>${mappedCell}</td>
    </tr>`;
  }).join("");
}

// ── PURCHASE ORDERS ──
let allPORows=[], allPOItems=[];
let poSort={col:null,dir:'asc'};
let _poSyncCooldown=0;
function sortPOBy(c){poSort.dir=poSort.col===c?(poSort.dir==='asc'?'desc':'asc'):'asc';poSort.col=c;applyPOFilters();}

function mapPO(r){
  return {
    id:r.purchaseorder_id,rowIndex:r.purchaseorder_id,
    purchaseorderId:r.purchaseorder_id,
    purchaseorderNo:r.purchaseorder_no||"",
    status:r.status||"",
    supplierName:r.supplier_name||"",
    transactionDate:r.transaction_date||"",
    locationName:r.location_name||"",
    grandTotal:r.grand_total!=null?Number(r.grand_total):null,
    note:r.note||"",
    syncedAt:r.synced_at||""
  };
}
function mapPOItem(r){
  return {
    id:r.purchaseorder_detail_id,purchaseorderId:r.purchaseorder_id,
    itemCode:r.item_code||"",itemName:r.item_name||"",
    qty:r.qty!=null?Number(r.qty):null,unit:r.unit||"",
    price:r.price!=null?Number(r.price):null,
    amount:r.amount!=null?Number(r.amount):null
  };
}

async function loadPO(){
  const tbody=document.getElementById("poTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="11">Memuat...</td></tr>`;
  try {
    const [{data:poData,error:poErr},{data:itemData}]=await Promise.all([
      sb.from("jubelio_purchase_orders").select("*").order("transaction_date",{ascending:false}),
      sb.from("jubelio_purchase_order_items").select("*").order("purchaseorder_detail_id",{ascending:true})
    ]);
    if(poErr) throw poErr;
    allPORows=(poData||[]).map(mapPO);
    allPOItems=(itemData||[]).map(mapPOItem);
    // attach totalQty to each PO row for sorting
    const qtyByPO={};
    allPOItems.forEach(i=>{qtyByPO[i.purchaseorderId]=(qtyByPO[i.purchaseorderId]||0)+(i.qty||0);});
    allPORows.forEach(r=>{r.totalQty=qtyByPO[r.id]||0;});
    renderPOStats(allPORows);
    applyPOFilters();
    const lastSync=allPORows.reduce((mx,r)=>r.syncedAt>mx?r.syncedAt:mx,"");
    const se=document.getElementById("po-sync-status");
    if(se&&lastSync) se.textContent=`Terakhir sync: ${relTime(lastSync)}`;
  } catch(e){
    if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderPOStats(rows){
  const rowIds=new Set(rows.map(r=>r.id));
  const filteredItems=allPOItems.filter(i=>rowIds.has(i.purchaseorderId));
  const active=rows.filter(r=>r.status==="ACTIVE").length;
  const totalItems=filteredItems.length;
  const totalQty=filteredItems.reduce((s,i)=>s+(i.qty||0),0);
  const totalVal=rows.reduce((s,r)=>s+(r.grandTotal||0),0);
  document.getElementById("po-s-total").textContent=rows.length;
  document.getElementById("po-s-active").textContent=active;
  document.getElementById("po-s-items").textContent=totalItems;
  document.getElementById("po-s-qty").textContent=totalQty?totalQty.toLocaleString("id-ID"):"—";
  document.getElementById("po-s-value").textContent=totalVal?"Rp "+Math.round(totalVal).toLocaleString("id-ID"):"—";
}

function applyPOFilters(){
  const status=document.getElementById("po-fil-status")?.value||"";
  const dateFrom=document.getElementById("po-fil-from")?.value||"";
  const dateTo=document.getElementById("po-fil-to")?.value||"";
  const q=(document.getElementById("poSearch")?.value||"").toLowerCase();
  let rows=allPORows;
  if(status) rows=rows.filter(r=>r.status===status);
  if(dateFrom) rows=rows.filter(r=>r.transactionDate&&r.transactionDate.slice(0,10)>=dateFrom);
  if(dateTo)   rows=rows.filter(r=>r.transactionDate&&r.transactionDate.slice(0,10)<=dateTo);
  if(q) rows=rows.filter(r=>(r.purchaseorderNo||"").toLowerCase().includes(q)||(r.supplierName||"").toLowerCase().includes(q)||(r.locationName||"").toLowerCase().includes(q)||(r.note||"").toLowerCase().includes(q));
  renderPOStats(rows);
  renderPOTable(rows);
}

function clearPOFilters(){
  ["po-fil-status","po-fil-from","po-fil-to"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("poSearch");if(s)s.value="";
  applyPOFilters();
}

function renderPOTable(rows){
  rows=sortBy(rows,poSort.col,poSort.dir);
  updateSortTh("po-thead",poSort.col,poSort.dir);
  const tbody=document.getElementById("poTableBody");
  document.getElementById("po-tcount").textContent=rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="11">Tidak ada data.</td></tr>`;return;}
  const sPill=s=>{
    const c=s==="ACTIVE"?"p-signings":s==="COMPLETED"?"p-active":s==="CANCELLED"?"p-inactive":"p-draft";
    return `<span class="pill ${c}" style="font-size:11px">${s||"—"}</span>`;
  };
  tbody.innerHTML=rows.flatMap(r=>{
    const items=allPOItems.filter(i=>i.purchaseorderId===r.id);
    const gt=r.grandTotal!=null?`Rp ${Math.round(r.grandTotal).toLocaleString("id-ID")}`:"—";
    const dt=r.transactionDate?new Date(r.transactionDate).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—";
    const hasItems=items.length>0;
    const totalQty=items.reduce((s,it)=>s+(it.qty||0),0);
    const main=`<tr>
      <td style="text-align:center;cursor:${hasItems?"pointer":"default"};color:var(--g400);user-select:none" onclick="${hasItems?`togglePOItems(${r.id})`:""}" id="po-toggle-${r.id}">${hasItems?"▶":""}</td>
      <td><a href="https://v2.jubelio.com/purchase/orders/detail/${r.id}" target="_blank" style="font-family:var(--mono);font-size:12px;color:#3C3489;text-decoration:none">${r.purchaseorderNo||r.id}</a></td>
      <td style="font-size:13px">${r.supplierName||"—"}</td>
      <td>${sPill(r.status)}</td>
      <td style="white-space:nowrap;font-size:12px">${dt}</td>
      <td style="font-size:12px">${r.locationName||"—"}</td>
      <td style="white-space:nowrap;font-size:12px;font-weight:600">${gt}</td>
      <td style="font-size:12px;text-align:right;font-weight:600">${totalQty?totalQty.toLocaleString("id-ID"):"—"}</td>
      <td style="font-size:12px;color:var(--g400)">${items.length} item${items.length!==1?"s":""}</td>
      <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--g600)" title="${(r.note||"").replace(/"/g,"&quot;")}">${r.note||"—"}</td>
      <td style="font-size:11px;color:var(--g400);white-space:nowrap">${relTime(r.syncedAt)}</td>
    </tr>`;
    const detail=`<tr id="po-items-${r.id}" style="display:none;background:var(--off)">
      <td></td>
      <td colspan="10" style="padding:8px 12px 14px">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
            <th style="padding:4px 8px;text-align:left">Item Code</th>
            <th style="padding:4px 8px;text-align:left">Nama</th>
            <th style="padding:4px 8px;text-align:right">Qty</th>
            <th style="padding:4px 8px;text-align:left">Satuan</th>
            <th style="padding:4px 8px;text-align:right">Harga Satuan</th>
            <th style="padding:4px 8px;text-align:right">Total</th>
          </tr></thead>
          <tbody>${items.map(it=>`<tr style="border-top:1px solid var(--g100)">
            <td style="padding:4px 8px;font-family:var(--mono);font-size:10px">${it.itemCode||"—"}</td>
            <td style="padding:4px 8px">${it.itemName||"—"}</td>
            <td style="padding:4px 8px;text-align:right">${it.qty!=null?Number(it.qty).toLocaleString("id-ID"):"—"}</td>
            <td style="padding:4px 8px">${it.unit||"—"}</td>
            <td style="padding:4px 8px;text-align:right">${it.price!=null?"Rp "+Math.round(it.price).toLocaleString("id-ID"):"—"}</td>
            <td style="padding:4px 8px;text-align:right;font-weight:600">${it.amount!=null?"Rp "+Math.round(it.amount).toLocaleString("id-ID"):"—"}</td>
          </tr>`).join("")}
          </tbody>
        </table>
      </td>
    </tr>`;
    return [main,detail];
  }).join("");
}

function togglePOItems(poId){
  const row=document.getElementById(`po-items-${poId}`);
  const tog=document.getElementById(`po-toggle-${poId}`);
  if(!row) return;
  const open=row.style.display==="table-row";
  row.style.display=open?"none":"table-row";
  if(tog) tog.textContent=open?"▶":"▼";
}

async function syncPONow(){
  const btn=document.getElementById("po-sync-btn");
  const se=document.getElementById("po-sync-status");
  const now=Date.now();
  if(now<_poSyncCooldown){
    const rem=Math.ceil((_poSyncCooldown-now)/1000);
    if(se) se.textContent=`Tunggu ${rem}s lagi sebelum sync ulang.`;
    return;
  }
  if(btn){btn.disabled=true;btn.textContent="⟳ Syncing...";}
  if(se) se.textContent="Menghubungi Jubelio...";
  try {
    const r=await fetch("https://qyxdjdwgvwtrpnvfndnu.supabase.co/functions/v1/sync-jubelio-purchase-orders",{method:"POST"});
    const j=await r.json();
    if(!r.ok||!j.ok) throw new Error(j.error||`HTTP ${r.status}`);
    _poSyncCooldown=Date.now()+60000;
    if(se) se.textContent=`✓ ${j.headersUpserted||0} PO, ${j.itemsUpserted||0} items diperbarui`;
    await loadPO();
  } catch(e){
    _poSyncCooldown=Date.now()+15000;
    if(se) se.textContent=`✗ Gagal: ${e.message||e}`;
  } finally {
    if(btn){btn.disabled=false;btn.textContent="⟳ Sync dari Jubelio";}
    setTimeout(()=>{
      const s2=document.getElementById("po-sync-status");
      const lastSync=allPORows.reduce((mx,r)=>r.syncedAt>mx?r.syncedAt:mx,"");
      if(s2&&lastSync) s2.textContent=`Terakhir sync: ${relTime(lastSync)}`;
    },8000);
  }
}

// ── DESIGNER MASTER ──
let allDsgRows = [];
let dsgSort = {col:null,dir:'asc'};
const DSG_CATEGORIES_DEFAULT = ["Graphic Designer","Illustrator","3D Artist","Motion Designer","Photographer"];
function sortDsgBy(c){dsgSort.dir=dsgSort.col===c?(dsgSort.dir==='asc'?'desc':'asc'):'asc';dsgSort.col=c;applyDsgFilters();}

function mapDsg(r) {
  return {
    rowIndex:r.id, id:r.id,
    name:r.name||"", category:r.category||"",
    email:r.email||"", phone:r.phone||"",
    portfolioUrl:r.portfolio_url||"", status:r.status||"Active",
    notes:r.notes||"", dateAdded:r.date_added||"", addedBy:r.added_by||""
  };
}

async function loadDesignerMaster() {
  const tbody = document.getElementById("dsgTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;
  try {
    const {data,error} = await sb.from("designer_master").select("*").order("name",{ascending:true});
    if (error) throw error;
    allDsgRows = (data||[]).map(mapDsg);
    renderDsgStats(allDsgRows);
    populateDsgCategoryFilter();
    applyDsgFilters();
    // Refresh AC options
    const cats = [...new Set([...DSG_CATEGORIES_DEFAULT,...allDsgRows.map(r=>r.category).filter(Boolean)])];
    setupAC("dsg-category","ac-dsg-category",()=>cats);
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderDsgStats(rows) {
  document.getElementById("dsg-s-total").textContent = rows.length;
  document.getElementById("dsg-s-active").textContent = rows.filter(r=>r.status==="Active").length;
  document.getElementById("dsg-s-inactive").textContent = rows.filter(r=>r.status==="Inactive").length;
}

function populateDsgCategoryFilter() {
  const sel = document.getElementById("dsg-fil-category");
  if (!sel) return;
  const cats = [...new Set([...DSG_CATEGORIES_DEFAULT,...allDsgRows.map(r=>r.category).filter(Boolean)])].sort();
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua Kategori</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
  if (cur) sel.value = cur;
}

function applyDsgFilters() {
  const status = document.getElementById("dsg-fil-status")?.value||"";
  const cat    = document.getElementById("dsg-fil-category")?.value||"";
  const q      = (document.getElementById("dsgSearch")?.value||"").toLowerCase();
  let rows = allDsgRows;
  if (status) rows = rows.filter(r=>r.status===status);
  if (cat)    rows = rows.filter(r=>r.category===cat);
  if (q)      rows = rows.filter(r=>(r.name||"").toLowerCase().includes(q)||(r.email||"").toLowerCase().includes(q)||(r.category||"").toLowerCase().includes(q));
  renderDsgStats(rows);
  renderDsgTable(rows);
}

function clearDsgFilters() {
  ["dsg-fil-status","dsg-fil-category"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("dsgSearch"); if(s) s.value="";
  applyDsgFilters();
}

function renderDsgTable(rows) {
  rows = sortBy(rows, dsgSort.col, dsgSort.dir);
  updateSortTh("dsg-thead", dsgSort.col, dsgSort.dir);
  const tbody = document.getElementById("dsgTableBody");
  document.getElementById("dsg-tcount").textContent = rows.length+" entri";
  if (!rows.length) { tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Tidak ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => `<tr>
    <td><strong>${r.name||"—"}</strong></td>
    <td><span class="pill p-draft" style="font-size:11px">${r.category||"—"}</span></td>
    <td style="font-size:12px">${r.email ? `<a href="mailto:${r.email}" style="color:var(--black)">${r.email}</a>` : "—"}</td>
    <td style="font-size:12px">${r.phone||"—"}</td>
    <td style="font-size:12px">${r.portfolioUrl ? `<a href="${r.portfolioUrl}" target="_blank" style="color:#3C3489;text-decoration:none">↗ Portfolio</a>` : "—"}</td>
    <td><span class="pill ${r.status==="Active"?"p-active":"p-inactive"}" style="font-size:11px">${r.status}</span></td>
    <td><button class="btn-icon" onclick="openDsgEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b" onclick="deleteDsg('${r.rowIndex}')">Del</button></td>
  </tr>
  <tr id="dsg-edit-row-${r.rowIndex}" style="display:none">
    <td colspan="7" style="padding:0 12px 12px">
      <div class="edit-row-form">
        <div class="edit-row-grid">
          <div class="fg"><label>Nama</label><input type="text" id="dsge-name-${r.rowIndex}" value="${(r.name||'').replace(/"/g,'&quot;')}"></div>
          <div class="fg" style="position:relative"><label>Kategori</label><input type="text" id="dsge-category-${r.rowIndex}" value="${(r.category||'').replace(/"/g,'&quot;')}" autocomplete="off"><div class="ac-list" id="ac-dsge-cat-${r.rowIndex}"></div></div>
          <div class="fg"><label>Email</label><input type="email" id="dsge-email-${r.rowIndex}" value="${(r.email||'').replace(/"/g,'&quot;')}"></div>
          <div class="fg"><label>Phone</label><input type="text" id="dsge-phone-${r.rowIndex}" value="${(r.phone||'').replace(/"/g,'&quot;')}"></div>
          <div class="fg"><label>Portfolio URL</label><input type="url" id="dsge-portfolio-${r.rowIndex}" value="${(r.portfolioUrl||'').replace(/"/g,'&quot;')}"></div>
          <div class="fg"><label>Status</label><select id="dsge-status-${r.rowIndex}"><option ${r.status==="Active"?"selected":""}>Active</option><option ${r.status==="Inactive"?"selected":""}>Inactive</option></select></div>
          <div class="fg full"><label>Notes</label><textarea id="dsge-notes-${r.rowIndex}" rows="2" style="resize:vertical">${(r.notes||'').replace(/</g,'&lt;')}</textarea></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveDsgEdit('${r.rowIndex}')">Simpan</button>
          <button class="btn-cancel" onclick="closeDsgEdit('${r.rowIndex}')">Batal</button>
          <button class="btn-delete" onclick="deleteDsg('${r.rowIndex}')">Hapus</button>
        </div>
      </div>
    </td>
  </tr>`).join("");
  // Setup AC for each edit row
  rows.forEach(r=>{
    const cats=[...new Set([...DSG_CATEGORIES_DEFAULT,...allDsgRows.map(x=>x.category).filter(Boolean)])];
    setupAC("dsge-category-"+r.rowIndex,"ac-dsge-cat-"+r.rowIndex,()=>cats);
  });
}

function openDsgEdit(rowIdx) {
  document.querySelectorAll("[id^='dsg-edit-row-']").forEach(el=>{if(el.id!=="dsg-edit-row-"+rowIdx)el.style.display="none";});
  const row=document.getElementById("dsg-edit-row-"+rowIdx); if(!row)return;
  row.style.display=row.style.display==="table-row"?"none":"table-row";
}
function closeDsgEdit(rowIdx){const r=document.getElementById("dsg-edit-row-"+rowIdx);if(r)r.style.display="none";}

async function saveDsgEdit(rowIdx) {
  const btn=document.querySelector(`#dsg-edit-row-${rowIdx} .btn-save`);
  if(btn){btn.disabled=true;btn.textContent="Menyimpan...";}
  try {
    const nm=document.getElementById(`dsge-name-${rowIdx}`).value.trim();
    if(!nm){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Nama wajib diisi.");return;}
    const {error}=await sb.from("designer_master").update({
      name:nm, category:document.getElementById(`dsge-category-${rowIdx}`).value.trim()||null,
      email:document.getElementById(`dsge-email-${rowIdx}`).value.trim()||null,
      phone:document.getElementById(`dsge-phone-${rowIdx}`).value.trim()||null,
      portfolio_url:document.getElementById(`dsge-portfolio-${rowIdx}`).value.trim()||null,
      status:document.getElementById(`dsge-status-${rowIdx}`).value,
      notes:document.getElementById(`dsge-notes-${rowIdx}`).value.trim()||null,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",rowIdx);
    if(error)throw error;
    closeDsgEdit(rowIdx);
    logActivity("Designer Master","edit",rowIdx,nm);
    await loadDesignerMaster();
  } catch(e){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Gagal: "+(e.message||e));}
}

async function deleteDsg(rowIdx) {
  if(!confirm("Hapus designer ini?"))return;
  try {
    const {error}=await sb.from("designer_master").delete().eq("id",rowIdx);
    if(error)throw error;
    logActivity("Designer Master","delete",rowIdx,"Dihapus");
    await loadDesignerMaster();
  } catch(e){alert("Gagal: "+(e.message||e));}
}

function switchDsgTab(tab,btn) {
  document.getElementById("dsgtab-new").style.display=tab==="new"?"block":"none";
  document.getElementById("dsgtab-list").style.display=tab==="list"?"block":"none";
  document.querySelectorAll("#page-designermaster .tab-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  if(tab==="list")loadDesignerMaster();
}

async function submitDesigner() {
  const nm=document.getElementById("dsg-name").value.trim();
  if(!nm){document.getElementById("dsg-feedback").innerHTML='<span class="fb-err">Nama wajib diisi.</span>';return;}
  const btn=document.getElementById("dsgSubmitBtn"); btn.disabled=true; btn.textContent="Menyimpan...";
  try {
    const id=genId("DSG");
    const {error}=await sb.from("designer_master").insert({
      id, name:nm,
      category:document.getElementById("dsg-category").value.trim()||null,
      email:document.getElementById("dsg-email").value.trim()||null,
      phone:document.getElementById("dsg-phone").value.trim()||null,
      portfolio_url:document.getElementById("dsg-portfolio").value.trim()||null,
      status:document.getElementById("dsg-status").value||"Active",
      notes:document.getElementById("dsg-notes").value.trim()||null,
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    document.getElementById("dsg-feedback").innerHTML=`<span class="fb-ok">✓ Designer tersimpan — ID: ${id}</span>`;
    logActivity("Designer Master","create",id,nm);
    clearDsgForm();
  } catch(e){
    document.getElementById("dsg-feedback").innerHTML=`<span class="fb-err">Gagal: ${e.message||e}</span>`;
  } finally {btn.disabled=false;btn.textContent="Simpan";}
}

function clearDsgForm() {
  ["dsg-name","dsg-category","dsg-email","dsg-phone","dsg-portfolio","dsg-notes"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("dsg-status");if(s)s.value="Active";
}

// ── COLLECTIONS ──
let allColRows = [], allColItems = [];
let colSort = {col:null,dir:'asc'};
const SKU_CATEGORIES_DEFAULT = ["T-Shirt","Shirt","Hoodie","Jacket","Dress","Pants","Shorts","Tote Bag","Bag Charm","Keychain","Poster","Sticker","Cap","Accessories","Others"];
function sortColBy(c){colSort.dir=colSort.col===c?(colSort.dir==='asc'?'desc':'asc'):'asc';colSort.col=c;applyColFilters();}
function slugifyCol(name){return(name||"").toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-");}

function mapCol(r) {
  return {
    rowIndex:r.id, id:r.id,
    collectionName:r.collection_name||"", ipRelated:r.ip_related||"",
    releaseDate:r.release_date||"", priority:r.priority||"",
    moodboardUrl:r.moodboard_url||"", status:r.status||"Draft",
    pic:r.pic||"", notes:r.notes||"", dateAdded:r.date_added||"", addedBy:r.added_by||""
  };
}

function mapCI(r) {
  return {
    rowIndex:r.id, id:r.id, collectionId:r.collection_id,
    skuName:r.sku_name||"", category:r.category||"", designer:r.designer||"",
    deadline:r.deadline||"", designPreviewUrl:r.design_preview_url||"",
    approvalStatus:r.approval_status||"Pending", notes:r.notes||"",
    samplingStatus:r.sampling_status||"Not Started", samplingNotes:r.sampling_notes||"",
    productionStatus:r.production_status||"Not Started", productionNotes:r.production_notes||""
  };
}

let allColStages = [];
let allColNotes = [];
const COL_STAGE_NAMES = ["inbound","photoshoot","kol","offline_activation"];
const COL_STAGE_LABELS = {inbound:"Inbound",photoshoot:"Photoshoot",kol:"KOL",offline_activation:"Offline Activation"};

function mapCS(r) {
  return {rowIndex:r.id,id:r.id,collectionId:r.collection_id,stage:r.stage,status:r.status||"Not Started",notes:r.notes||""};
}
function mapCN(r) {
  return {id:r.id,collectionId:r.collection_id,content:r.content||"",author:r.author||"",mentions:r.mentions||"",createdAt:r.created_at||""};
}

function relTime(ts) {
  if(!ts) return "—";
  const diff=Date.now()-new Date(ts);
  const m=Math.floor(diff/60000);
  if(m<1) return "baru saja";
  if(m<60) return `${m}m lalu`;
  const h=Math.floor(m/60);
  if(h<24) return `${h}j lalu`;
  const d=Math.floor(h/24);
  if(d<7) return `${d}h lalu`;
  return fmtDate(ts.slice(0,10));
}

function highlightMentions(text) {
  return (text||"").replace(/</g,"&lt;").replace(/@([\w.]+)/g,'<span style="color:#3C3489;font-weight:600">@$1</span>');
}

async function loadCollections() {
  const tbody=document.getElementById("colTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="8">Memuat...</td></tr>`;
  try {
    const fetches=[
      sb.from("collections").select("*").order("release_date",{ascending:false}),
      sb.from("collection_items").select("*").order("date_added",{ascending:true}),
      sb.from("designer_workflow").select("id,collection_id,designer").not("collection_id","is",null),
      sb.from("collection_stages").select("*")
    ];
    if(!allDsgRows.length) fetches.push(sb.from("designer_master").select("*").order("name"));
    const results=await Promise.all(fetches);
    const [{data,error},{data:ciData},{data:dwCheck},{data:csData}]=results;
    if(error)throw error;
    allColRows=(data||[]).map(mapCol);
    allColItems=(ciData||[]).map(mapCI);
    allColStages=(csData||[]).map(mapCS);
    if(results[4]?.data) allDsgRows=results[4].data.map(mapDsg);
    setupAC("col-ip","ac-col-ip",()=>allIPRows.map(r=>r.name).filter(Boolean));
    setupAC("col-pic","ac-col-pic",()=>[...new Set(allColRows.map(r=>r.pic).filter(Boolean))]);
    // Auto-create DW projects + stage placeholders for any collection missing them (background)
    ensureDWProjects(allColRows, dwCheck||[]);
    ensureColStages(allColRows, csData||[]);
    // Restore collection detail from URL slug
    const hashParts=location.hash.slice(1).split("/");
    if(hashParts[0]==="collections"&&hashParts[1]){
      const slug=hashParts[1];
      const col=allColRows.find(r=>slugifyCol(r.collectionName)===slug);
      if(col){openCollectionDetail(col.id);return;}
    }
    renderColStats(allColRows,allColItems);
    applyColFilters();
  } catch(e){
    if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="8">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

async function ensureDWProjects(cols, existingDW) {
  // One DW project per (collection_id, designer) pair
  const existingKeys=new Set(existingDW.map(r=>`${r.collection_id}|${r.designer||""}`));
  for(const col of cols){
    if(!col.id) continue;
    // Find unique designers assigned to SKUs in this collection
    const designers=[...new Set(
      allColItems.filter(i=>i.collectionId===col.id&&i.designer).map(i=>i.designer)
    )];
    // If no designers yet, create one placeholder with designer=""
    const targets=designers.length?designers:[""];
    for(const designer of targets){
      const key=`${col.id}|${designer}`;
      if(existingKeys.has(key)) continue;
      try{
        const dwId=genId("DW");
        const {error}=await sb.from("designer_workflow").insert({
          id:dwId, collection_id:col.id,
          project_name:col.collectionName,
          designer:designer||null,
          payment_status:"Not Paid", locked:true,
          deliverables_status:"Pending",
          date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
          last_updated:new Date().toISOString(), last_updated_by:currentUser
        });
        if(!error){
          existingKeys.add(key);
          allDwRows.push({
            rowIndex:dwId,id:dwId,
            designer:designer||"",collectionId:col.id,
            collectionName:col.collectionName,projectName:col.collectionName,
            deliverablesUrl:"",agreementId:"",
            deliverablesStatus:"Pending",deadline:"",
            paymentStatus:"Not Paid",locked:true,
            notes:"",dateAdded:new Date().toISOString().slice(0,10),addedBy:currentUser
          });
        }
      }catch(e){/* silent */}
    }
  }
}

async function ensureDWForCollection(colId) {
  const col=allColRows.find(r=>r.id===colId);
  if(!col) return;
  const {data}=await sb.from("designer_workflow")
    .select("id,collection_id,designer").eq("collection_id",colId);
  await ensureDWProjects([col], data||[]);
}

function computeColDeliverableStatus(colId, designer) {
  const skus=designer
    ?allColItems.filter(i=>i.collectionId===colId&&i.designer===designer)
    :allColItems.filter(i=>i.collectionId===colId);
  if(!skus.length) return null;
  const approved=skus.filter(i=>i.approvalStatus==="Approved").length;
  if(approved===0) return "Not Approved";
  if(approved===skus.length) return "Approved";
  return "Partially Approved";
}

function computeColDeadline(colId, designer) {
  const skus=designer
    ?allColItems.filter(i=>i.collectionId===colId&&i.designer===designer&&i.deadline)
    :allColItems.filter(i=>i.collectionId===colId&&i.deadline);
  if(!skus.length) return null;
  return skus.map(i=>i.deadline).sort().pop(); // latest deadline
}

async function ensureColStages(cols, existingStages) {
  const existingKeys=new Set(existingStages.map(s=>`${s.collection_id}|${s.stage}`));
  for(const col of cols){
    if(!col.id) continue;
    for(const stage of COL_STAGE_NAMES){
      const key=`${col.id}|${stage}`;
      if(existingKeys.has(key)) continue;
      try{
        const id=genId("CS");
        const {error}=await sb.from("collection_stages").insert({
          id,collection_id:col.id,stage,status:"Not Started",
          last_updated:new Date().toISOString(),last_updated_by:currentUser
        });
        if(!error){
          existingKeys.add(key);
          allColStages.push({rowIndex:id,id,collectionId:col.id,stage,status:"Not Started",notes:""});
        }
      }catch(e){/* silent */}
    }
  }
}

function getPipelineStatuses(colId) {
  const items=allColItems.filter(i=>i.collectionId===colId);
  const stages=allColStages.filter(s=>s.collectionId===colId);
  // Design: from DW approval
  const dwRows=allDwRows.filter(r=>r.collectionId===colId&&r.locked);
  let design="not-started";
  if(dwRows.length){
    const dlStats=dwRows.map(r=>computeColDeliverableStatus(r.collectionId,r.designer));
    if(dlStats.every(s=>s==="Approved")) design="done";
    else if(dlStats.some(s=>s&&s!=="Not Approved")) design="in-progress";
    else design="not-started";
  } else if(items.some(i=>i.designer)) design="in-progress";
  // Sampling
  let sampling="not-started";
  if(items.length){
    if(items.every(i=>i.samplingStatus==="Done")) sampling="done";
    else if(items.some(i=>i.samplingStatus==="In Progress"||i.samplingStatus==="Done")) sampling="in-progress";
  }
  // Production
  let production="not-started";
  if(items.length){
    if(items.every(i=>i.productionStatus==="Done")) production="done";
    else if(items.some(i=>i.productionStatus==="In Progress"||i.productionStatus==="Done")) production="in-progress";
  }
  const getStage=s=>stages.find(r=>r.stage===s)?.status||"Not Started";
  const stageToKey=s=>s==="Done"?"done":s==="In Progress"?"in-progress":"not-started";
  const inbound=stageToKey(getStage("inbound"));
  const mkt=["photoshoot","kol","offline_activation"].map(s=>getStage(s));
  let marketing="not-started";
  if(mkt.every(s=>s==="Done")) marketing="done";
  else if(mkt.some(s=>s==="In Progress"||s==="Done")) marketing="in-progress";
  return {design,sampling,production,inbound,marketing};
}

function renderPipelineBarHTML(colId) {
  const ps=getPipelineStatuses(colId);
  const stages=[["design","Design"],["sampling","Sampling"],["production","Production"],["inbound","Inbound"],["marketing","Marketing"]];
  const dot=s=>s==="done"?"●":s==="in-progress"?"◐":"○";
  const clr=s=>s==="done"?"#1a5c25":s==="in-progress"?"#1a4a8a":"#aaa";
  const lbl=s=>s==="done"?"Done":s==="in-progress"?"In Progress":"Not Started";
  return stages.map((([k,l],i)=>`
    ${i>0?`<div style="flex:1;height:1px;background:var(--g200);min-width:12px;max-width:32px;margin-top:-10px"></div>`:""}
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:20px;line-height:1;color:${clr(ps[k])}">${dot(ps[k])}</span>
      <span style="font-size:9px;font-family:var(--mono);text-transform:uppercase;color:${clr(ps[k])};white-space:nowrap">${l}</span>
    </div>`
  )).join("")
}

function renderColStats(rows,items) {
  document.getElementById("col-s-total").textContent=rows.length;
  document.getElementById("col-s-draft").textContent=rows.filter(r=>r.status==="Draft").length;
  document.getElementById("col-s-inprogress").textContent=rows.filter(r=>r.status==="In Progress").length;
  document.getElementById("col-s-done").textContent=rows.filter(r=>r.status==="Done").length;
  document.getElementById("col-s-skus").textContent=items.length;
}

function applyColFilters() {
  const status=document.getElementById("col-fil-status")?.value||"";
  const priority=document.getElementById("col-fil-priority")?.value||"";
  const q=(document.getElementById("colSearch")?.value||"").toLowerCase();
  let rows=allColRows;
  if(status) rows=rows.filter(r=>r.status===status);
  if(priority) rows=rows.filter(r=>r.priority===priority);
  if(q) rows=rows.filter(r=>(r.collectionName||"").toLowerCase().includes(q)||(r.ipRelated||"").toLowerCase().includes(q));
  renderColStats(rows, allColItems.filter(i=>rows.some(r=>r.id===i.collectionId)));
  renderColTable(rows);
}

function clearColFilters() {
  ["col-fil-status","col-fil-priority"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("colSearch");if(s)s.value="";
  applyColFilters();
}

function renderColTable(rows) {
  rows=sortBy(rows,colSort.col,colSort.dir);
  updateSortTh("col-thead",colSort.col,colSort.dir);
  const tbody=document.getElementById("colTableBody");
  if(!tbody) return;
  document.getElementById("col-tcount").textContent=rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="8">Tidak ada data.</td></tr>`;return;}
  const prioColor={High:"p-expired",Medium:"p-near",Low:"p-draft"};
  tbody.innerHTML=rows.map(r=>{
    const items=allColItems.filter(i=>i.collectionId===r.id);
    const approved=items.filter(i=>i.approvalStatus==="Approved").length;
    const revision=items.filter(i=>i.approvalStatus==="Revision").length;
    const pending=items.filter(i=>i.approvalStatus==="Pending").length;
    const skuBadge=items.length
      ? `<span style="font-size:11px">${items.length} SKU</span>${approved?` <span class="pill p-active" style="font-size:10px">${approved}✓</span>`:""}${revision?` <span class="pill p-near" style="font-size:10px">${revision} rev</span>`:""}${pending?` <span class="pill p-draft" style="font-size:10px">${pending} pend</span>`:""}`
      : `<span style="color:var(--g400);font-size:11px">—</span>`;
    const mbCell=r.moodboardUrl?`<a href="${r.moodboardUrl}" target="_blank" onclick="event.stopPropagation()" style="color:#3C3489;font-size:12px;text-decoration:none">↗ Lihat</a>`:"—";
    return `<tr style="cursor:pointer" onclick="openCollectionDetail('${r.id}')">
      <td><strong>${r.collectionName||"—"}</strong></td>
      <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.ipRelated||"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.releaseDate)}</td>
      <td>${r.priority?`<span class="pill ${prioColor[r.priority]||"p-draft"}" style="font-size:11px">${r.priority}</span>`:"—"}</td>
      <td style="white-space:nowrap">${skuBadge}</td>
      <td style="font-size:11px;white-space:nowrap">${items.length?`${approved}/${items.length} approved`:"—"}</td>
      <td>${mbCell}</td>
      <td><span class="pill ${r.status==="Done"?"p-active":r.status==="In Progress"?"p-signings":"p-draft"}" style="font-size:11px">${r.status}</span></td>
    </tr>`;
  }).join("");
}

function openCollectionDetail(colId) {
  const col=allColRows.find(r=>r.id===colId);
  if(!col) return;
  document.getElementById("col-list-view").style.display="none";
  document.getElementById("col-detail-view").style.display="block";
  history.replaceState(null,"",`#collections/${slugifyCol(col.collectionName)}`);
  renderColDetail(col, allColItems.filter(i=>i.collectionId===colId));
}

function closeCollectionDetail() {
  document.getElementById("col-detail-view").style.display="none";
  document.getElementById("col-list-view").style.display="block";
  history.replaceState(null,"","#collections");
}

function toggleColEditPanel() {
  const panel=document.getElementById("col-dp-edit-panel");
  if(!panel) return;
  panel.style.display=panel.style.display==="none"?"block":"none";
}

// ── helpers for collection detail boxes ──
function cdStageBox(icon, title, badgeHTML, contentHTML) {
  return `<div style="border:1px solid var(--g100);border-radius:8px;margin-bottom:16px;overflow:hidden">
    <div style="padding:10px 16px;background:var(--off);border-bottom:1px solid var(--g100);display:flex;align-items:center;gap:8px">
      <span>${icon}</span>
      <span style="font-family:var(--mono);font-size:11px;text-transform:uppercase;font-weight:600">${title}</span>
      ${badgeHTML||""}
    </div>
    <div style="padding:16px">${contentHTML}</div>
  </div>`;
}
function cdStageBadge(status, id="") {
  const c=status==="Done"?"p-active":status==="In Progress"?"p-signings":"p-draft";
  return `<span class="pill ${c}" style="font-size:9px;margin-left:auto"${id?` id="${id}"`:""}>${status}</span>`;
}
function refreshStageHeaderBadge(colId, stage) {
  const el=document.getElementById(`col-${stage}-badge-${colId}`);
  if(!el) return;
  const items=allColItems.filter(i=>i.collectionId===colId);
  const ps=getPipelineStatuses(colId);
  let s;
  if(stage==="sampling") s=items.length?(items.every(i=>i.samplingStatus==="Done")?"Done":items.some(i=>i.samplingStatus!=="Not Started")?"In Progress":"Not Started"):"Not Started";
  else if(stage==="production") s=items.length?(items.every(i=>i.productionStatus==="Done")?"Done":items.some(i=>i.productionStatus!=="Not Started")?"In Progress":"Not Started"):"Not Started";
  else if(stage==="inbound"){const st=allColStages.find(r=>r.collectionId===colId&&r.stage==="inbound");s=st?.status||"Not Started";}
  else if(stage==="marketing") s=ps.marketing==="done"?"Done":ps.marketing==="in-progress"?"In Progress":"Not Started";
  const c=s==="Done"?"p-active":s==="In Progress"?"p-signings":"p-draft";
  el.className=`pill ${c}`;
  el.style.cssText="font-size:9px;margin-left:auto";
  el.textContent=s;
}
function cdSkuStatusSelect(itemId, colId, stageKey, currentVal) {
  const opts=["Not Started","In Progress","Done"];
  const clr=currentVal==="Done"?"#edf8ee;color:#1a5c25;border-color:#90d4a0":currentVal==="In Progress"?"#e8f0fc;color:#1a4a8a;border-color:#a8c4f0":"#f0efe9;color:#5a5850;border-color:#d4d3cb";
  return `<select onchange="updateSKUStageStatus('${itemId}','${colId}','${stageKey}',this.value)" style="font-size:11px;padding:2px 8px;border:1px solid;border-radius:99px;background:${clr}">${opts.map(o=>`<option${currentVal===o?" selected":""}>${o}</option>`).join("")}</select>`;
}

function renderColDetail(col, items) {
  const prioColor={High:"p-expired",Medium:"p-near",Low:"p-draft"};
  const statusColor=col.status==="Done"?"p-active":col.status==="In Progress"?"p-signings":"p-draft";
  const skuCats=[...new Set([...SKU_CATEGORIES_DEFAULT,...allColItems.map(i=>i.category).filter(Boolean)])];
  // DW rows for this collection (for preview links + design card)
  const colDwRows=allDwRows.filter(r=>r.collectionId===col.id&&r.locked);

  // ── SKU rows (master list) ──
  const skuRows=items.map(i=>{
    // Preview: pull from DW deliverables link for this SKU's designer
    const dwLink=colDwRows.find(r=>r.designer===i.designer)?.deliverablesUrl||"";
    return `<tr id="ci-row-${i.id}" style="border-top:1px solid var(--g100)">
    <td style="padding:8px 10px"><strong style="font-size:13px">${i.skuName}</strong></td>
    <td style="padding:8px 10px">${i.category?`<span class="pill p-signings" style="font-size:10px">${i.category}</span>`:`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
    <td style="padding:8px 10px;color:var(--g600)">${i.designer||"—"}</td>
    <td style="padding:8px 10px;white-space:nowrap">${fmtDate(i.deadline)}</td>
    <td style="padding:8px 10px">${dwLink?`<a href="${dwLink}" target="_blank" style="color:#3C3489;text-decoration:none">↗ Design</a>`:`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
    <td style="padding:8px 10px">
      <select onchange="updateSKUApproval('${i.id}','${col.id}',this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--g100);border-radius:4px;background:var(--white)">
        <option${i.approvalStatus==="Pending"?" selected":""}>Pending</option>
        <option${i.approvalStatus==="Revision"?" selected":""}>Revision</option>
        <option${i.approvalStatus==="Approved"?" selected":""}>Approved</option>
      </select>
    </td>
    <td style="padding:8px 10px;white-space:nowrap">
      <button class="btn-icon" style="font-size:11px" onclick="openSKUEdit('${i.id}')">Edit</button>
      <button class="btn-icon" style="color:#c0392b;font-size:11px" onclick="deleteSKU('${i.id}','${col.id}')">Del</button>
    </td>
  </tr>
  <tr id="ci-edit-${i.id}" style="display:none;border-top:1px solid var(--g100)">
    <td colspan="7" style="padding:8px 10px 12px">
      <div class="edit-row-form" style="background:var(--off)">
        <div class="edit-row-grid">
          <div class="fg"><label style="font-size:11px">Nama SKU *</label><input type="text" id="cie-name-${i.id}" value="${(i.skuName||"").replace(/"/g,"&quot;")}"></div>
          <div class="fg" style="position:relative"><label style="font-size:11px">Kategori</label><input type="text" id="cie-cat-${i.id}" value="${(i.category||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-cie-cat-${i.id}"></div></div>
          <div class="fg" style="position:relative"><label style="font-size:11px">Designer</label><input type="text" id="cie-dsg-${i.id}" value="${(i.designer||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-cie-dsg-${i.id}"></div></div>
          <div class="fg"><label style="font-size:11px">Deadline</label><input type="date" id="cie-deadline-${i.id}" value="${i.deadline||""}"></div>
          <div class="fg full"><label style="font-size:11px">Design Preview URL</label><input type="url" id="cie-preview-${i.id}" value="${(i.designPreviewUrl||"").replace(/"/g,"&quot;")}" placeholder="https://drive.google.com/..."></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveSKUEdit('${i.id}','${col.id}')">Simpan</button>
          <button class="btn-cancel" onclick="closeSKUEdit('${i.id}')">Batal</button>
        </div>
      </div>
    </td>
  </tr>`;}).join("");


  // ── Sampling rows ──
  const samplingContent=items.length?`
    <table style="width:100%">
      <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
        <th style="padding:6px 10px;text-align:left">SKU</th>
        <th style="padding:6px 10px;text-align:left">Status</th>
        <th style="padding:6px 10px;text-align:left">Notes</th>
      </tr></thead>
      <tbody>${items.map(i=>`<tr style="border-top:1px solid var(--g100)">
        <td style="padding:8px 10px"><strong style="font-size:13px">${i.skuName}</strong>${i.category?` <span class="pill p-signings" style="font-size:9px">${i.category}</span>`:""}</td>
        <td style="padding:8px 10px">${cdSkuStatusSelect(i.id,col.id,"sampling",i.samplingStatus)}</td>
        <td style="padding:8px 10px"><input type="text" value="${(i.samplingNotes||"").replace(/"/g,"&quot;")}" placeholder="Notes..." style="font-size:11px;padding:3px 8px;border:1px solid var(--g100);border-radius:4px;width:100%;min-width:140px" onblur="saveSkuStageNote('${i.id}','${col.id}','sampling',this.value)"></td>
      </tr>`).join("")}</tbody>
    </table>`:`<div style="color:var(--g400);font-size:12px">Belum ada SKU.</div>`;

  // ── Production rows ──
  const productionContent=items.length?`
    <table style="width:100%">
      <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
        <th style="padding:6px 10px;text-align:left">SKU</th>
        <th style="padding:6px 10px;text-align:left">Status</th>
        <th style="padding:6px 10px;text-align:left">Notes</th>
      </tr></thead>
      <tbody>${items.map(i=>`<tr style="border-top:1px solid var(--g100)">
        <td style="padding:8px 10px"><strong style="font-size:13px">${i.skuName}</strong>${i.category?` <span class="pill p-signings" style="font-size:9px">${i.category}</span>`:""}</td>
        <td style="padding:8px 10px">${cdSkuStatusSelect(i.id,col.id,"production",i.productionStatus)}</td>
        <td style="padding:8px 10px"><input type="text" value="${(i.productionNotes||"").replace(/"/g,"&quot;")}" placeholder="Notes..." style="font-size:11px;padding:3px 8px;border:1px solid var(--g100);border-radius:4px;width:100%;min-width:140px" onblur="saveSkuStageNote('${i.id}','${col.id}','production',this.value)"></td>
      </tr>`).join("")}</tbody>
    </table>`:`<div style="color:var(--g400);font-size:12px">Belum ada SKU.</div>`;

  // ── Marketing sub-boxes ──
  const mktSubBox=(stage)=>{
    const s=allColStages.find(r=>r.collectionId===col.id&&r.stage===stage)||{stage,status:"Not Started",notes:""};
    const selClr=s.status==="Done"?"#edf8ee;color:#1a5c25;border-color:#90d4a0":s.status==="In Progress"?"#e8f0fc;color:#1a4a8a;border-color:#a8c4f0":"#f0efe9;color:#5a5850;border-color:#d4d3cb";
    return `<div style="border:1px solid var(--g100);border-radius:6px;padding:12px">
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:10px">${COL_STAGE_LABELS[stage]}</div>
      <select onchange="updateColStageStatus('${col.id}','${stage}',this.value)" style="font-size:11px;padding:3px 8px;border:1px solid;border-radius:4px;width:100%;margin-bottom:8px;background:${selClr}">
        <option${s.status==="Not Started"?" selected":""}>Not Started</option>
        <option${s.status==="In Progress"?" selected":""}>In Progress</option>
        <option${s.status==="Done"?" selected":""}>Done</option>
      </select>
      <textarea placeholder="Notes..." rows="2" style="font-size:11px;padding:6px 8px;border:1px solid var(--g100);border-radius:4px;width:100%;resize:vertical;box-sizing:border-box" onblur="saveColStageNote('${col.id}','${stage}',this.value)">${(s.notes||"").replace(/</g,"&lt;")}</textarea>
    </div>`;
  };
  const inboundS=allColStages.find(r=>r.collectionId===col.id&&r.stage==="inbound")||{status:"Not Started",notes:""};
  const inboundSelClr=inboundS.status==="Done"?"#edf8ee;color:#1a5c25;border-color:#90d4a0":inboundS.status==="In Progress"?"#e8f0fc;color:#1a4a8a;border-color:#a8c4f0":"#f0efe9;color:#5a5850;border-color:#d4d3cb";

  // ── Pipeline bar ──
  const ps=getPipelineStatuses(col.id);
  const pipeStages=[["design","Design"],["sampling","Sampling"],["production","Production"],["inbound","Inbound"],["marketing","Marketing"]];
  const pdot=s=>s==="done"?"●":s==="in-progress"?"◐":"○";
  const pclr=s=>s==="done"?"#1a5c25":s==="in-progress"?"#1a4a8a":"#aaa";

  document.getElementById("col-detail-content").innerHTML=`<div style="width:100%">
    <!-- Header (full-width) -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--g100)">
      <button class="btn-ghost" onclick="closeCollectionDetail()" style="white-space:nowrap">← Kembali</button>
      <div style="flex:1">
        <div style="font-size:20px;font-weight:700;font-family:var(--syne)">${col.collectionName}</div>
        <div style="font-size:11px;color:var(--g400);margin-top:2px">Ditambahkan ${col.dateAdded?fmtDate(col.dateAdded):"—"} · ${col.addedBy||"—"}${col.pic?` · PIC: <strong>${col.pic}</strong>`:""}</div>
      </div>
      <span class="pill ${statusColor}">${col.status}</span>
      <button class="btn-icon" onclick="toggleColEditPanel()" style="padding:6px 12px">✏ Edit</button>
      <button class="btn-icon" onclick="deleteCol('${col.id}')" style="color:#c0392b;padding:6px 12px">Hapus</button>
    </div>
    <!-- Edit panel -->
    <div id="col-dp-edit-panel" style="display:none;margin-bottom:16px">
      <div class="form-card">
        <div class="form-sec">Edit Collection</div>
        <div class="form-grid">
          <div class="fg"><label>Nama Collection</label><input type="text" id="col-dp-name" value="${(col.collectionName||"").replace(/"/g,"&quot;")}"></div>
          <div class="fg" style="position:relative"><label>IP Related</label><input type="text" id="col-dp-ip" value="${(col.ipRelated||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-col-dp-ip"></div></div>
          <div class="fg"><label>Release Date</label><input type="date" id="col-dp-releasedate" value="${col.releaseDate||""}"></div>
          <div class="fg"><label>Priority</label><select id="col-dp-priority"><option value="">—</option><option${col.priority==="High"?" selected":""}>High</option><option${col.priority==="Medium"?" selected":""}>Medium</option><option${col.priority==="Low"?" selected":""}>Low</option></select></div>
          <div class="fg"><label>Status</label><select id="col-dp-status"><option${col.status==="Draft"?" selected":""}>Draft</option><option${col.status==="In Progress"?" selected":""}>In Progress</option><option${col.status==="Done"?" selected":""}>Done</option></select></div>
          <div class="fg" style="position:relative"><label>PIC</label><input type="text" id="col-dp-pic" value="${(col.pic||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-col-dp-pic"></div></div>
          <div class="fg full"><label>Moodboard URL</label><input type="url" id="col-dp-moodboard" value="${(col.moodboardUrl||"").replace(/"/g,"&quot;")}" placeholder="https://drive.google.com/..."></div>
          <div class="fg full"><label>Notes</label><textarea id="col-dp-notes" rows="2" style="resize:vertical">${(col.notes||"").replace(/</g,"&lt;")}</textarea></div>
        </div>
        <div class="edit-row-btns">
          <button class="btn-save" onclick="saveColDetailEdit('${col.id}')">Simpan</button>
          <button class="btn-cancel" onclick="toggleColEditPanel()">Batal</button>
        </div>
      </div>
    </div>
    <!-- Metadata cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      <div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">IP Related</div><div style="font-weight:600;font-size:13px">${col.ipRelated||"—"}</div></div>
      <div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">Release Date</div><div style="font-weight:600;font-size:13px">${fmtDate(col.releaseDate)||"—"}</div></div>
      <div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">Priority</div><div>${col.priority?`<span class="pill ${prioColor[col.priority]||"p-draft"}">${col.priority}</span>`:"—"}</div></div>
      <div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">PIC</div><div style="font-weight:600;font-size:13px">${col.pic||"—"}</div></div>
      ${col.moodboardUrl?`<div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">Moodboard</div><a href="${col.moodboardUrl}" target="_blank" style="color:#3C3489;font-weight:600;text-decoration:none;font-size:13px">↗ Lihat</a></div>`:""}
      ${colDwRows.some(r=>r.deliverablesUrl)?`<div class="stat-card" style="text-align:left;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">Design Files</div>${colDwRows.filter(r=>r.deliverablesUrl).map(r=>`<div style="margin-bottom:2px"><a href="${r.deliverablesUrl}" target="_blank" style="color:#3C3489;font-weight:600;text-decoration:none;font-size:12px">↗ ${r.designer||"File"}</a></div>`).join("")}</div>`:""}
    </div>
    ${col.notes?`<div class="form-card" style="margin-bottom:16px;padding:12px 14px"><div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:4px">Notes</div><div style="font-size:13px">${col.notes.replace(/</g,"&lt;")}</div></div>`:""}
    <!-- Two-column body: left = stages, right = notes/activity -->
    <div style="display:flex;gap:20px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <!-- Pipeline bar -->
        <div id="col-pipeline-${col.id}" style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:20px;padding:14px 20px;background:var(--off);border-radius:8px;overflow-x:auto">
          ${pipeStages.map(([k,l],i)=>`${i>0?`<div style="width:32px;flex-shrink:0;height:1px;background:var(--g200)"></div>`:""}
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px">
            <span style="font-size:20px;line-height:1;color:${pclr(ps[k])}">${pdot(ps[k])}</span>
            <span style="font-size:9px;font-family:var(--mono);text-transform:uppercase;color:${pclr(ps[k])};white-space:nowrap">${l}</span>
          </div>`).join("")}
        </div>
        <!-- SKU Master List -->
        ${cdStageBox("📋","SKUs & Design",`<span style="font-size:11px;color:var(--g400);font-family:var(--mono);margin-left:auto">${items.length} items</span>`,`
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;padding:12px;background:var(--off);border-radius:6px;margin-bottom:14px">
            <div class="fg" style="min-width:160px;flex:2"><label style="font-size:11px">Nama SKU *</label><input type="text" id="ci-dp-name-${col.id}" placeholder="Nama item/SKU"></div>
            <div class="fg" style="min-width:130px;flex:1.5;position:relative"><label style="font-size:11px">Kategori</label><input type="text" id="ci-dp-cat-${col.id}" placeholder="T-Shirt, Bag Charm..." autocomplete="off"><div class="ac-list" id="ac-ci-dp-cat-${col.id}"></div></div>
            <div class="fg" style="min-width:140px;flex:1.5;position:relative"><label style="font-size:11px">Designer</label><input type="text" id="ci-dp-dsg-${col.id}" placeholder="Pilih dari designer master" autocomplete="off"><div class="ac-list" id="ac-ci-dp-${col.id}"></div></div>
            <div class="fg" style="min-width:120px;flex:1"><label style="font-size:11px">Deadline</label><input type="date" id="ci-dp-deadline-${col.id}"></div>
            <div style="padding-bottom:2px"><button class="btn-primary" style="padding:6px 14px;font-size:12px" onclick="addCollectionItem('${col.id}')">+ Tambah</button></div>
          </div>
          ${items.length?`<div class="table-wrap" style="max-height:400px;overflow-y:auto"><table style="width:100%">
            <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
              <th style="padding:6px 10px;text-align:left">SKU</th><th style="padding:6px 10px;text-align:left">Kategori</th>
              <th style="padding:6px 10px;text-align:left">Designer</th><th style="padding:6px 10px;text-align:left">Deadline</th>
              <th style="padding:6px 10px;text-align:left">Design File</th><th style="padding:6px 10px;text-align:left">Approval</th><th style="padding:6px 10px;text-align:left">Aksi</th>
            </tr></thead>
            <tbody>${skuRows}</tbody>
          </table></div>`:`<div style="color:var(--g400);font-size:12px">Belum ada SKU. Tambah di atas.</div>`}`)}
        <!-- Sampling -->
        ${cdStageBox("🧵","Sampling",cdStageBadge(items.length?items.every(i=>i.samplingStatus==="Done")?"Done":items.some(i=>i.samplingStatus!=="Not Started")?"In Progress":"Not Started":"Not Started",`col-sampling-badge-${col.id}`),samplingContent)}
        <!-- Production -->
        ${cdStageBox("🏭","Production",cdStageBadge(items.length?items.every(i=>i.productionStatus==="Done")?"Done":items.some(i=>i.productionStatus!=="Not Started")?"In Progress":"Not Started":"Not Started",`col-production-badge-${col.id}`),productionContent)}
        <!-- Inbound -->
        ${cdStageBox("📦","Inbound",cdStageBadge(inboundS.status,`col-inbound-badge-${col.id}`),`
          <select onchange="updateColStageStatus('${col.id}','inbound',this.value)" style="font-size:12px;padding:4px 8px;border:1px solid;border-radius:4px;width:200px;margin-bottom:10px;background:${inboundSelClr}">
            <option${inboundS.status==="Not Started"?" selected":""}>Not Started</option>
            <option${inboundS.status==="In Progress"?" selected":""}>In Progress</option>
            <option${inboundS.status==="Done"?" selected":""}>Done</option>
          </select>
          <textarea placeholder="Notes..." rows="2" style="font-size:12px;padding:8px;border:1px solid var(--g100);border-radius:4px;width:100%;resize:vertical;box-sizing:border-box" onblur="saveColStageNote('${col.id}','inbound',this.value)">${(inboundS.notes||"").replace(/</g,"&lt;")}</textarea>`)}
        <!-- Marketing -->
        ${cdStageBox("📣","Marketing",cdStageBadge(ps.marketing==="done"?"Done":ps.marketing==="in-progress"?"In Progress":"Not Started",`col-marketing-badge-${col.id}`),`
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
            ${mktSubBox("photoshoot")}${mktSubBox("kol")}${mktSubBox("offline_activation")}
          </div>`)}
      </div>
      <!-- Right sidebar: Notes + Activity -->
      <div style="width:280px;flex-shrink:0;position:sticky;top:20px;max-height:calc(100vh - 80px);overflow-y:auto;display:flex;flex-direction:column;gap:12px">
        <!-- Notes panel -->
        <div style="border:1px solid var(--g100);border-radius:8px;overflow:hidden">
          <div style="padding:10px 14px;background:var(--off);border-bottom:1px solid var(--g100);font-family:var(--mono);font-size:11px;text-transform:uppercase;font-weight:600">📝 Catatan</div>
          <div style="padding:12px">
            <div style="position:relative">
              <textarea id="col-note-input-${col.id}" rows="3" placeholder="Tulis catatan...&#10;@nama untuk mention" style="width:100%;font-size:12px;padding:8px;border:1px solid var(--g100);border-radius:6px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
              <div id="col-note-drop-${col.id}" style="display:none;position:absolute;left:0;right:0;bottom:100%;background:var(--white);border:1px solid var(--g100);border-radius:6px;z-index:200;box-shadow:0 4px 12px rgba(0,0,0,.08)"></div>
            </div>
            <div style="text-align:right;margin-top:6px">
              <button id="col-note-btn-${col.id}" class="btn-primary" style="padding:5px 16px;font-size:12px" onclick="addColNote('${col.id}')">Kirim</button>
            </div>
          </div>
          <div id="col-notes-list-${col.id}" style="border-top:1px solid var(--g100)">
            <div style="padding:12px;color:var(--g400);font-size:12px;text-align:center">Memuat...</div>
          </div>
        </div>
        <!-- Activity panel -->
        <div style="border:1px solid var(--g100);border-radius:8px;overflow:hidden">
          <div style="padding:10px 14px;background:var(--off);border-bottom:1px solid var(--g100);font-family:var(--mono);font-size:11px;text-transform:uppercase;font-weight:600">📋 Aktivitas</div>
          <div id="col-activity-list-${col.id}" style="">
            <div style="padding:12px;color:var(--g400);font-size:12px;text-align:center">Memuat...</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // Setup autocompletes
  setupAC("col-dp-ip","ac-col-dp-ip",()=>allIPRows.map(x=>x.name).filter(Boolean));
  setupAC("col-dp-pic","ac-col-dp-pic",()=>[...new Set(allColRows.map(r=>r.pic).filter(Boolean))]);
  setupAC(`ci-dp-cat-${col.id}`,`ac-ci-dp-cat-${col.id}`,()=>skuCats);
  setupAC(`ci-dp-dsg-${col.id}`,`ac-ci-dp-${col.id}`,()=>allDsgRows.filter(d=>d.status==="Active").map(d=>d.name));
  items.forEach(i=>{
    setupAC(`cie-cat-${i.id}`,`ac-cie-cat-${i.id}`,()=>skuCats);
    setupAC(`cie-dsg-${i.id}`,`ac-cie-dsg-${i.id}`,()=>allDsgRows.filter(d=>d.status==="Active").map(d=>d.name));
  });
  loadColSidebar(col.id);
  setupNoteAC(col.id);
}

async function addCollectionItem(colId) {
  const nm=document.getElementById(`ci-dp-name-${colId}`)?.value.trim();
  if(!nm){alert("Nama SKU wajib diisi.");return;}
  try {
    const id=genId("CI");
    const {error}=await sb.from("collection_items").insert({
      id, collection_id:colId,
      sku_name:nm,
      category:document.getElementById(`ci-dp-cat-${colId}`)?.value.trim()||null,
      designer:document.getElementById(`ci-dp-dsg-${colId}`)?.value.trim()||null,
      deadline:document.getElementById(`ci-dp-deadline-${colId}`)?.value||null,
      approval_status:"Pending",
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    [`ci-dp-name-${colId}`,`ci-dp-cat-${colId}`,`ci-dp-dsg-${colId}`,`ci-dp-deadline-${colId}`].forEach(eid=>{const el=document.getElementById(eid);if(el)el.value="";});
    logActivity("Collections","create",id,`SKU: ${nm}`);
    const {data}=await sb.from("collection_items").select("*").eq("collection_id",colId);
    allColItems=allColItems.filter(i=>i.collectionId!==colId).concat((data||[]).map(mapCI));
    const col=allColRows.find(r=>r.id===colId);
    if(col) renderColDetail(col, allColItems.filter(i=>i.collectionId===colId));
    applyColFilters();
    // Auto-create DW project for any new designer assignment
    ensureDWForCollection(colId);
  } catch(e){alert("Gagal: "+(e.message||e));}
}

async function pushToDesignerWorkflow(colId) {
  const existing=allDwRows.find(r=>r.collectionId===colId);
  if(existing){alert("Collection ini sudah ada projectnya di Designer Workflow.");return;}
  const col=allColRows.find(r=>r.id===colId);
  if(!col)return;
  try {
    const id=genId("DW");
    const {error}=await sb.from("designer_workflow").insert({
      id, collection_id:colId,
      payment_status:"Not Paid", locked:true,
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    logActivity("Designer Workflow","create",id,`Pushed from: ${col.collectionName}`);
    // Add to local cache so repeat-push detection works without full reload
    allDwRows.push({rowIndex:id,id,designer:"",collectionId:colId,collectionName:col.collectionName,
      deliverablesUrl:"",agreementId:"",paymentStatus:"Not Paid",locked:true,notes:"",
      dateAdded:new Date().toISOString().slice(0,10),addedBy:currentUser});
    alert(`✓ Project "${col.collectionName}" berhasil dibuat di Designer Workflow!`);
  } catch(e){alert("Gagal: "+(e.message||e));}
}

function openSKUEdit(itemId) {
  document.querySelectorAll("[id^='ci-edit-']").forEach(el=>{if(el.id!=="ci-edit-"+itemId)el.style.display="none";});
  const row=document.getElementById("ci-edit-"+itemId);if(!row)return;
  row.style.display=row.style.display==="table-row"?"none":"table-row";
}
function closeSKUEdit(itemId){const r=document.getElementById("ci-edit-"+itemId);if(r)r.style.display="none";}

// DW deliverables link inline edit (from collection detail)
function openDwLinkEdit(dwId){const d=document.getElementById(`dw-link-display-${dwId}`);const e=document.getElementById(`dw-link-edit-${dwId}`);if(d)d.style.display="none";if(e)e.style.display="inline";}
function closeDwLinkEdit(dwId){const d=document.getElementById(`dw-link-display-${dwId}`);const e=document.getElementById(`dw-link-edit-${dwId}`);if(d)d.style.display="inline";if(e)e.style.display="none";}
async function saveDwLinkInline(dwId, colId) {
  const url=document.getElementById(`dw-link-input-${dwId}`)?.value.trim()||null;
  try {
    const {error}=await sb.from("designer_workflow").update({
      deliverables_url:url, last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",dwId);
    if(error)throw error;
    const dw=allDwRows.find(r=>r.id===dwId);
    if(dw) dw.deliverablesUrl=url||"";
    closeDwLinkEdit(dwId);
    const disp=document.getElementById(`dw-link-display-${dwId}`);
    if(disp) disp.innerHTML=url
      ?`<a href="${url}" target="_blank" style="font-size:11px;color:#3C3489;text-decoration:none">↗ Lihat</a> <button class="btn-icon" style="font-size:10px" onclick="openDwLinkEdit('${dwId}')">✏</button>`
      :`<button class="btn-icon" style="font-size:10px" onclick="openDwLinkEdit('${dwId}')">+ Tambah link</button>`;
  } catch(e){alert("Gagal: "+(e.message||e));}
}

// SKU stage status inline update (sampling / production)
async function updateSKUStageStatus(itemId, colId, stage, status) {
  const field=stage==="sampling"?"sampling_status":"production_status";
  try {
    await sb.from("collection_items").update({[field]:status,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",itemId);
    const item=allColItems.find(i=>i.id===itemId);
    if(item){if(stage==="sampling")item.samplingStatus=status;else item.productionStatus=status;}
    // Update pipeline bar + header badge
    const pipeEl=document.getElementById(`col-pipeline-${colId}`);
    if(pipeEl) pipeEl.innerHTML=renderPipelineBarHTML(colId);
    refreshStageHeaderBadge(colId, stage);
  } catch(e){/* silent */}
}
function renderPipelineBarHTML(colId) {
  const ps=getPipelineStatuses(colId);
  const pipeStages=[["design","Design"],["sampling","Sampling"],["production","Production"],["inbound","Inbound"],["marketing","Marketing"]];
  const pdot=s=>s==="done"?"●":s==="in-progress"?"◐":"○";
  const pclr=s=>s==="done"?"#1a5c25":s==="in-progress"?"#1a4a8a":"#aaa";
  return pipeStages.map(([k,l],i)=>`${i>0?`<div style="width:32px;flex-shrink:0;height:1px;background:var(--g200)"></div>`:""}
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px">
      <span style="font-size:20px;line-height:1;color:${pclr(ps[k])}">${pdot(ps[k])}</span>
      <span style="font-size:9px;font-family:var(--mono);text-transform:uppercase;color:${pclr(ps[k])};white-space:nowrap">${l}</span>
    </div>`).join("");
}

// SKU stage notes save on blur
async function saveSkuStageNote(itemId, colId, stage, notes) {
  const field=stage==="sampling"?"sampling_notes":"production_notes";
  try {
    await sb.from("collection_items").update({[field]:notes,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",itemId);
    const item=allColItems.find(i=>i.id===itemId);
    if(item){if(stage==="sampling")item.samplingNotes=notes;else item.productionNotes=notes;}
  } catch(e){/* silent */}
}

// ── COLLECTION SIDEBAR (notes + activity) ──────────────────────────────────

async function loadColSidebar(colId) {
  const itemIds=allColItems.filter(i=>i.collectionId===colId).map(i=>i.id);
  const [notesRes, actRes]=await Promise.all([
    sb.from("collection_notes").select("*").eq("collection_id",colId).order("created_at",{ascending:false}).limit(50),
    sb.from("activity_logs").select("*").in("record_id",[colId,...itemIds]).order("ts",{ascending:false}).limit(30)
  ]);
  renderNotesList(colId, (notesRes.data||[]).map(mapCN));
  renderActivityList(colId, actRes.data||[]);
}

async function addColNote(colId) {
  const ta=document.getElementById(`col-note-input-${colId}`);
  const content=ta?.value.trim();
  if(!content) return;
  const btn=document.getElementById(`col-note-btn-${colId}`);
  if(btn){btn.disabled=true;btn.textContent="...";}
  const mentions=(content.match(/@([\w.]+)/g)||[]).join(",");
  const {error}=await sb.from("collection_notes").insert({
    id:genId("CN"), collection_id:colId, content, author:currentUser,
    mentions, created_at:new Date().toISOString()
  });
  if(!error){
    ta.value="";
    await loadColSidebar(colId);
  } else {
    alert("Gagal menyimpan catatan.");
  }
  if(btn){btn.disabled=false;btn.textContent="Kirim";}
}

function renderNotesList(colId, notes) {
  const el=document.getElementById(`col-notes-list-${colId}`);
  if(!el) return;
  if(!notes.length){
    el.innerHTML=`<div style="padding:12px;color:var(--g400);font-size:12px;text-align:center">Belum ada catatan</div>`;
    return;
  }
  el.innerHTML=notes.map(n=>`
    <div style="padding:10px 12px;border-top:1px solid var(--g100)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;color:var(--black)">${(n.author||"Anonim").replace(/</g,"&lt;")}</span>
        <span style="font-size:10px;color:var(--g400);white-space:nowrap">${relTime(n.createdAt)}</span>
      </div>
      <div style="font-size:12px;line-height:1.5;color:var(--black);white-space:pre-wrap">${highlightMentions(n.content)}</div>
    </div>`).join("");
}

function renderActivityList(colId, activity) {
  const el=document.getElementById(`col-activity-list-${colId}`);
  if(!el) return;
  if(!activity.length){
    el.innerHTML=`<div style="padding:12px;color:var(--g400);font-size:12px;text-align:center">Belum ada aktivitas</div>`;
    return;
  }
  el.innerHTML=activity.map(a=>`
    <div style="padding:8px 12px;border-top:1px solid var(--g100);display:flex;gap:8px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--black);line-height:1.4">
          <span style="font-weight:600">${(a.user_name||"System").replace(/</g,"&lt;")}</span>
          <span style="color:var(--g600)"> ${(a.action||"").replace(/</g,"&lt;")} </span>
          <span style="color:var(--g400)">${(a.details||"").replace(/</g,"&lt;")}</span>
        </div>
        <div style="font-size:10px;color:var(--g400);margin-top:2px">${relTime(a.ts)}</div>
      </div>
    </div>`).join("");
}

function setupNoteAC(colId) {
  const ta=document.getElementById(`col-note-input-${colId}`);
  const drop=document.getElementById(`col-note-drop-${colId}`);
  if(!ta||!drop) return;
  ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addColNote(colId);}});
  ta.addEventListener("input",()=>{
    const val=ta.value;
    const cur=ta.selectionStart;
    const before=val.slice(0,cur);
    const m=before.match(/@([\w.]*)$/);
    if(!m){drop.style.display="none";return;}
    const q=(m[1]||"").toLowerCase();
    const picsArr=[...new Set(allColRows.map(r=>r.pic).filter(Boolean))];
    const dsgsArr=allDsgRows.filter(d=>d.status==="Active").map(d=>d.name);
    const names=[...new Set([...picsArr,...dsgsArr])].filter(n=>n.toLowerCase().includes(q)).slice(0,6);
    if(!names.length){drop.style.display="none";return;}
    drop.style.display="block";
    drop.innerHTML=names.map(n=>`<div onclick="insertMention('${colId}','${n.replace(/'/g,"\\'")}');event.stopPropagation()" style="padding:8px 12px;cursor:pointer;font-size:12px;hover:background:var(--off)" onmouseenter="this.style.background='var(--off)'" onmouseleave="this.style.background=''">${n}</div>`).join("");
  });
  document.addEventListener("click",e=>{if(!ta.contains(e.target)&&!drop.contains(e.target))drop.style.display="none";},{passive:true});
}

function insertMention(colId, name) {
  const ta=document.getElementById(`col-note-input-${colId}`);
  const drop=document.getElementById(`col-note-drop-${colId}`);
  if(!ta) return;
  const val=ta.value;
  const cur=ta.selectionStart;
  const before=val.slice(0,cur);
  const after=val.slice(cur);
  const newBefore=before.replace(/@([\w.]*)$/,`@${name} `);
  ta.value=newBefore+after;
  const newCur=newBefore.length;
  ta.setSelectionRange(newCur,newCur);
  ta.focus();
  if(drop) drop.style.display="none";
}

// Collection-level stage status update
async function updateColStageStatus(colId, stage, status) {
  const s=allColStages.find(r=>r.collectionId===colId&&r.stage===stage);
  if(!s) return;
  try {
    await sb.from("collection_stages").update({status,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",s.id);
    s.status=status;
    const pipeEl=document.getElementById(`col-pipeline-${colId}`);
    if(pipeEl) pipeEl.innerHTML=renderPipelineBarHTML(colId);
    refreshStageHeaderBadge(colId, stage);
    if(stage!=="inbound") refreshStageHeaderBadge(colId,"marketing");
  } catch(e){/* silent */}
}

// Collection-level stage notes save on blur
async function saveColStageNote(colId, stage, notes) {
  const s=allColStages.find(r=>r.collectionId===colId&&r.stage===stage);
  if(!s) return;
  try {
    await sb.from("collection_stages").update({notes,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",s.id);
    s.notes=notes;
  } catch(e){/* silent */}
}

async function saveSKUEdit(itemId, colId) {
  const btn=document.querySelector(`#ci-edit-${itemId} .btn-save`);
  if(btn){btn.disabled=true;btn.textContent="Menyimpan...";}
  try {
    const nm=document.getElementById(`cie-name-${itemId}`)?.value.trim();
    if(!nm){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Nama SKU wajib diisi.");return;}
    const cat=document.getElementById(`cie-cat-${itemId}`)?.value.trim()||null;
    const dsg=document.getElementById(`cie-dsg-${itemId}`)?.value.trim()||null;
    const dl=document.getElementById(`cie-deadline-${itemId}`)?.value||null;
    const pv=document.getElementById(`cie-preview-${itemId}`)?.value.trim()||null;
    const {error}=await sb.from("collection_items").update({
      sku_name:nm, category:cat, designer:dsg, deadline:dl, design_preview_url:pv,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",itemId);
    if(error)throw error;
    const idx=allColItems.findIndex(i=>i.id===itemId);
    if(idx>-1) allColItems[idx]={...allColItems[idx],skuName:nm,category:cat||"",designer:dsg||"",deadline:dl||"",designPreviewUrl:pv||""};
    logActivity("Collections","edit",itemId,`SKU: ${nm}`);
    const col=allColRows.find(r=>r.id===colId);
    if(col) renderColDetail(col, allColItems.filter(i=>i.collectionId===colId));
    applyColFilters();
    // Auto-create DW project if designer changed to someone new
    ensureDWForCollection(colId);
  } catch(e){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Gagal: "+(e.message||e));}
}

async function updateSKUApproval(itemId, colId, status) {
  try {
    const {error}=await sb.from("collection_items").update({
      approval_status:status, last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",itemId);
    if(error)throw error;
    const idx=allColItems.findIndex(i=>i.id===itemId);
    if(idx>-1) allColItems[idx].approvalStatus=status;
    const col=allColRows.find(r=>r.id===colId);
    if(col) renderColDetail(col, allColItems.filter(i=>i.collectionId===colId));
    applyColFilters();
  } catch(e){alert("Gagal update status: "+(e.message||e));}
}

async function deleteSKU(itemId, colId) {
  if(!confirm("Hapus SKU ini?"))return;
  try {
    const {error}=await sb.from("collection_items").delete().eq("id",itemId);
    if(error)throw error;
    allColItems=allColItems.filter(i=>i.id!==itemId);
    const col=allColRows.find(r=>r.id===colId);
    if(col) renderColDetail(col, allColItems.filter(i=>i.collectionId===colId));
    applyColFilters();
  } catch(e){alert("Gagal: "+(e.message||e));}
}

async function saveColDetailEdit(colId) {
  const btn=document.querySelector("#col-dp-edit-panel .btn-save");
  if(btn){btn.disabled=true;btn.textContent="Menyimpan...";}
  try {
    const nm=document.getElementById("col-dp-name")?.value.trim();
    if(!nm){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Nama wajib diisi.");return;}
    const {error}=await sb.from("collections").update({
      collection_name:nm,
      ip_related:document.getElementById("col-dp-ip")?.value.trim()||null,
      release_date:document.getElementById("col-dp-releasedate")?.value||null,
      priority:document.getElementById("col-dp-priority")?.value||null,
      status:document.getElementById("col-dp-status")?.value||"Draft",
      pic:document.getElementById("col-dp-pic")?.value.trim()||null,
      moodboard_url:document.getElementById("col-dp-moodboard")?.value.trim()||null,
      notes:document.getElementById("col-dp-notes")?.value.trim()||null,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",colId);
    if(error)throw error;
    logActivity("Collections","edit",colId,nm);
    const {data}=await sb.from("collections").select("*").eq("id",colId);
    if(data?.[0]){
      const updated=mapCol(data[0]);
      const idx=allColRows.findIndex(r=>r.id===colId);
      if(idx>-1) allColRows[idx]=updated;
      history.replaceState(null,"",`#collections/${slugifyCol(updated.collectionName)}`);
      renderColDetail(updated, allColItems.filter(i=>i.collectionId===colId));
      // Re-ensure DW projects (in case they were deleted or new designers added)
      ensureDWForCollection(colId);
    }
    applyColFilters();
  } catch(e){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Gagal: "+(e.message||e));}
}

async function deleteCol(rowIdx) {
  if(!confirm("Hapus collection ini? Semua SKU di dalamnya juga akan terhapus."))return;
  try {
    const {error}=await sb.from("collections").delete().eq("id",rowIdx);
    if(error)throw error;
    logActivity("Collections","delete",rowIdx,"Dihapus");
    allColRows=allColRows.filter(r=>r.id!==rowIdx);
    allColItems=allColItems.filter(i=>i.collectionId!==rowIdx);
    closeCollectionDetail();
    applyColFilters();
  } catch(e){alert("Gagal: "+(e.message||e));}
}

function switchColTab(tab,btn) {
  document.getElementById("coltab-new").style.display=tab==="new"?"block":"none";
  document.getElementById("coltab-list").style.display=tab==="list"?"block":"none";
  document.getElementById("col-detail-view").style.display="none";
  document.getElementById("col-list-view").style.display="block";
  document.querySelectorAll("#page-collections .tab-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  if(tab==="list")loadCollections();
}

async function submitCollection() {
  const nm=document.getElementById("col-name").value.trim();
  if(!nm){document.getElementById("col-feedback").innerHTML='<span class="fb-err">Nama collection wajib diisi.</span>';return;}
  const btn=document.getElementById("colSubmitBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try {
    const id=genId("COL");
    const {error}=await sb.from("collections").insert({
      id, collection_name:nm,
      ip_related:document.getElementById("col-ip").value.trim()||null,
      release_date:document.getElementById("col-releasedate").value||null,
      priority:document.getElementById("col-priority").value||null,
      status:document.getElementById("col-status").value||"Draft",
      pic:document.getElementById("col-pic")?.value.trim()||null,
      moodboard_url:document.getElementById("col-moodboard").value.trim()||null,
      notes:document.getElementById("col-notes").value.trim()||null,
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    logActivity("Collections","create",id,nm);
    // DW + stage placeholders auto-created
    const newCol={rowIndex:id,id,collectionName:nm,ipRelated:"",releaseDate:"",priority:"",moodboardUrl:"",status:document.getElementById("col-status")?.value||"Draft",pic:"",notes:"",dateAdded:new Date().toISOString().slice(0,10),addedBy:currentUser};
    allColRows.push(newCol);
    ensureDWProjects([newCol],[]);
    ensureColStages([newCol],[]);
    document.getElementById("col-feedback").innerHTML=`<span class="fb-ok">✓ Collection tersimpan — ID: ${id}. Buka tab Semua untuk menambah SKU.</span>`;
    clearColForm();
  } catch(e){
    document.getElementById("col-feedback").innerHTML=`<span class="fb-err">Gagal: ${e.message||e}</span>`;
  } finally {btn.disabled=false;btn.textContent="Simpan Collection";}
}

function clearColForm() {
  ["col-name","col-ip","col-pic","col-releasedate","col-moodboard","col-notes"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const p=document.getElementById("col-priority");if(p)p.value="";
  const s=document.getElementById("col-status");if(s)s.value="Draft";
}

// ── DESIGNER WORKFLOW ──
let allDwRows = [];
let dwSort = {col:null,dir:'asc'};
function sortDwBy(c){dwSort.dir=dwSort.col===c?(dwSort.dir==='asc'?'desc':'asc'):'asc';dwSort.col=c;applyDwFilters();}

function mapDw(r) {
  return {
    rowIndex:r.id, id:r.id,
    designer:r.designer||"", collectionId:r.collection_id||null,
    collectionName:"", // populated after join
    projectName:r.project_name||"",
    deliverablesUrl:r.deliverables_url||"", agreementId:r.agreement_id||"",
    deliverablesStatus:r.deliverables_status||"Pending",
    deadline:r.deadline||"",
    paymentStatus:r.payment_status||"Not Paid", locked:!!r.locked,
    notes:r.notes||"", dateAdded:r.date_added||"", addedBy:r.added_by||""
  };
}

async function loadDsgWorkflow() {
  const tbody=document.getElementById("dwTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;
  try {
    const fetches=[sb.from("designer_workflow").select("*").order("date_added",{ascending:false})];
    if(!allColRows.length) fetches.push(sb.from("collections").select("id,collection_name"));
    if(!allColItems.length) fetches.push(sb.from("collection_items").select("*"));
    if(!allDsgRows.length) fetches.push(sb.from("designer_master").select("*").order("name"));
    const results=await Promise.all(fetches);
    const {data,error}=results[0];
    if(error)throw error;
    // Load auxiliary data if fetched
    results.slice(1).forEach(res=>{
      if(!res?.data?.length) return;
      const d=res.data[0];
      if("collection_name" in d) allColRows=res.data.map(r=>({rowIndex:r.id,id:r.id,collectionName:r.collection_name||""}));
      else if("collection_id" in d) allColItems=res.data.map(mapCI);
      else if("portfolio_url" in d) allDsgRows=res.data.map(mapDsg);
    });
    allDwRows=(data||[]).map(r=>{
      const row=mapDw(r);
      const col=allColRows.find(c=>c.id===r.collection_id);
      row.collectionName=col?col.collectionName:"";
      // For CD entries, projectName defaults to collection name if not set
      if(row.locked&&!row.projectName&&row.collectionName) row.projectName=row.collectionName;
      return row;
    });
    renderDwStats(allDwRows);
    applyDwFilters();
    // Setup form ACs
    setupAC("dw-designer","ac-dw-designer",()=>allDsgRows.map(d=>d.name).filter(Boolean));
    setupAC("dw-agreement","ac-dw-agreement",()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);
  } catch(e){
    if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderDwStats(rows) {
  const today=new Date().toISOString().slice(0,10);
  // Deliverables status (compute for CD rows, use stored for manual)
  const getDlStatus=r=>r.locked&&r.collectionId?computeColDeliverableStatus(r.collectionId,r.designer):r.deliverablesStatus;
  const getDlDeadline=r=>r.locked&&r.collectionId?computeColDeadline(r.collectionId,r.designer):r.deadline;
  const isLate=r=>{
    const dl=getDlDeadline(r);
    if(!dl||dl>=today) return false;
    const st=getDlStatus(r);
    if(r.locked) return st!=="Approved";
    return st!=="Completed";
  };
  document.getElementById("dw-s-total").textContent=rows.length;
  document.getElementById("dw-s-inprogress").textContent=rows.filter(r=>getDlStatus(r)==="In Progress").length;
  document.getElementById("dw-s-pending").textContent=rows.filter(r=>getDlStatus(r)==="Pending"||getDlStatus(r)==="Not Approved"||!getDlStatus(r)).length;
  document.getElementById("dw-s-completed").textContent=rows.filter(r=>getDlStatus(r)==="Approved"||getDlStatus(r)==="Completed").length;
  document.getElementById("dw-s-late").textContent=rows.filter(isLate).length;
  document.getElementById("dw-s-notyetpaid").textContent=rows.filter(r=>r.paymentStatus==="Not Yet Paid").length;
  document.getElementById("dw-s-paid").textContent=rows.filter(r=>r.paymentStatus==="Paid").length;
  document.getElementById("dw-s-kontrak").textContent=rows.filter(r=>r.agreementId).length;
}

function applyDwFilters() {
  const source=document.getElementById("dw-fil-source")?.value||"";
  const payment=document.getElementById("dw-fil-payment")?.value||"";
  const dlStatus=document.getElementById("dw-fil-dlstatus")?.value||"";
  const q=(document.getElementById("dwSearch")?.value||"").toLowerCase();
  let rows=allDwRows;
  if(source==="cd") rows=rows.filter(r=>r.locked);
  if(source==="manual") rows=rows.filter(r=>!r.locked);
  if(payment) rows=rows.filter(r=>r.paymentStatus===payment);
  if(dlStatus) rows=rows.filter(r=>{
    if(r.locked&&r.collectionId) return computeColDeliverableStatus(r.collectionId,r.designer)===dlStatus;
    return r.deliverablesStatus===dlStatus;
  });
  if(q) rows=rows.filter(r=>
    (r.designer||"").toLowerCase().includes(q)||
    (r.projectName||r.collectionName||"").toLowerCase().includes(q)
  );
  renderDwStats(rows);
  renderDwTable(rows);
}

function clearDwFilters() {
  ["dw-fil-source","dw-fil-payment","dw-fil-dlstatus"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("dwSearch");if(s)s.value="";
  applyDwFilters();
}

// Inline styles for manual deliverables status select (select elements ignore CSS class bg)
function dwDlSelectStyle(s) {
  if(s==="Completed") return "background:#edf8ee;color:#1a5c25;border:1px solid #90d4a0";
  if(s==="In Progress") return "background:#e8f0fc;color:#1a4a8a;border:1px solid #a8c4f0";
  if(s==="Revision") return "background:#fff3e0;color:#8a4000;border:1px solid #ffcc80";
  return "background:#f0efe9;color:#5a5850;border:1px solid #d4d3cb"; // Pending
}

function renderDwTable(rows) {
  rows=sortBy(rows,dwSort.col,dwSort.dir);
  updateSortTh("dw-thead",dwSort.col,dwSort.dir);
  const tbody=document.getElementById("dwTableBody");
  if(!tbody) return;
  document.getElementById("dw-tcount").textContent=rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Tidak ada data.</td></tr>`;return;}
  const today=new Date().toISOString().slice(0,10);
  tbody.innerHTML=rows.map(r=>{
    const projectLabel=(r.projectName||r.collectionName||"—");
    const lockedBadge=r.locked?`<span class="pill p-draft" style="font-size:9px;margin-left:4px;vertical-align:middle">🔒 CD</span>`:"";
    const notesSnippet=r.notes?`<div style="font-size:10px;color:var(--g400);font-style:italic;margin-top:2px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes}</div>`:"";

    // ── Deliverables cell ──
    let dlCell;
    if(r.locked&&r.collectionId){
      const dlStatus=computeColDeliverableStatus(r.collectionId,r.designer);
      const dlPill=dlStatus==="Approved"?"p-active":dlStatus==="Partially Approved"?"p-near":dlStatus==="Not Approved"?"p-expired":"p-draft";
      const linkLine=r.deliverablesUrl?`<div style="margin-top:3px"><a href="${r.deliverablesUrl}" target="_blank" style="font-size:10px;color:#3C3489;text-decoration:none">↗ Lihat file</a></div>`:"";
      dlCell=`<span class="pill ${dlPill}" style="font-size:10px;cursor:pointer" onclick="toggleDwSKUs('${r.rowIndex}')">${dlStatus||"Belum ada SKU"} ▾</span>${linkLine}`;
    } else {
      const dlOpts=["Pending","In Progress","Revision","Completed"];
      const linkLine=r.deliverablesUrl?`<div style="margin-top:3px"><a href="${r.deliverablesUrl}" target="_blank" style="font-size:10px;color:#3C3489;text-decoration:none">↗ Lihat file</a></div>`:"";
      dlCell=`<select style="font-size:10px;border-radius:99px;padding:2px 8px;cursor:pointer;appearance:none;-webkit-appearance:none;${dwDlSelectStyle(r.deliverablesStatus)}" onchange="updateDwDeliverables('${r.rowIndex}',this.value)">${dlOpts.map(o=>`<option value="${o}"${r.deliverablesStatus===o?" selected":""}>${o}</option>`).join("")}</select>${linkLine}`;
    }

    // ── Deadline cell ──
    const dlVal=r.locked&&r.collectionId?computeColDeadline(r.collectionId,r.designer):r.deadline;
    const deadlineCell=dlVal
      ?`<span style="${dlVal<today?"color:#c0392b;font-weight:600":""}">${fmtDate(dlVal)}</span>`
      :`<span style="color:var(--g400);font-size:11px">—</span>`;

    // ── Agreement & Payment ──
    const agrCell=r.agreementId?`<span style="font-size:11px;font-family:var(--mono)">${r.agreementId}</span>`:"—";
    // Not Paid = gray (internal/karyawan, no action needed)
    // Not Yet Paid = red (needs payment)
    // Paid = green
    const payPill=r.paymentStatus==="Paid"?"p-active":r.paymentStatus==="Not Yet Paid"?"p-expired":"p-draft";

    // ── SKU sub-rows (for CD rows) ──
    const skus=r.collectionId?(r.designer?allColItems.filter(i=>i.collectionId===r.collectionId&&i.designer===r.designer):allColItems.filter(i=>i.collectionId===r.collectionId)):[];
    const skuSubRows=skus.map(i=>`<tr style="border-top:1px solid var(--g100)">
      <td style="padding:5px 8px;font-size:11px"><strong>${i.skuName}</strong></td>
      <td style="padding:5px 8px;font-size:11px">${i.category?`<span class="pill p-signings" style="font-size:9px">${i.category}</span>`:"—"}</td>
      <td style="padding:5px 8px;font-size:11px;color:var(--g600)">${i.designer||"—"}</td>
      <td style="padding:5px 8px;font-size:11px;white-space:nowrap">${fmtDate(i.deadline)}</td>
      <td style="padding:5px 8px"><span class="pill ${i.approvalStatus==="Approved"?"p-active":i.approvalStatus==="Revision"?"p-near":"p-draft"}" style="font-size:9px">${i.approvalStatus}</span></td>
    </tr>`).join("");

    // ── Edit form ──
    const editForm=r.locked
      ?`<div class="edit-row-grid">
          <div class="fg"><label>Designer <span style="font-size:10px;color:var(--g400)">(dari CD)</span></label><input type="text" value="${(r.designer||"").replace(/"/g,"&quot;")}" disabled style="opacity:0.6;cursor:not-allowed;background:var(--off)"></div>
          <div class="fg"><label>Project <span style="font-size:10px;color:var(--g400)">(dari CD)</span></label><input type="text" value="${projectLabel.replace(/"/g,"&quot;")}" disabled style="opacity:0.6;cursor:not-allowed;background:var(--off)"></div>
          <div class="fg full"><label>Deliverables URL <span style="font-size:11px;color:var(--g400)">(Google Drive)</span></label><input type="url" id="dwe-deliverables-${r.rowIndex}" value="${(r.deliverablesUrl||"").replace(/"/g,"&quot;")}" placeholder="https://drive.google.com/..."></div>
          <div class="fg" style="position:relative"><label>Kontrak (Agreement)</label><input type="text" id="dwe-agreement-${r.rowIndex}" value="${(r.agreementId||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-dwe-agr-${r.rowIndex}"></div></div>
          <div class="fg"><label>Payment Status</label><select id="dwe-payment-${r.rowIndex}"><option value="Not Paid"${r.paymentStatus==="Not Paid"?" selected":""}>Not Paid</option><option value="Not Yet Paid"${r.paymentStatus==="Not Yet Paid"?" selected":""}>Not Yet Paid</option><option value="Paid"${r.paymentStatus==="Paid"?" selected":""}>Paid</option></select></div>
          <div class="fg full"><label>Notes</label><textarea id="dwe-notes-${r.rowIndex}" rows="2" style="resize:vertical">${(r.notes||"").replace(/</g,"&lt;")}</textarea></div>
        </div>`
      :`<div class="edit-row-grid">
          <div class="fg" style="position:relative"><label>Designer</label><input type="text" id="dwe-designer-${r.rowIndex}" value="${(r.designer||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-dwe-dsg-${r.rowIndex}"></div></div>
          <div class="fg"><label>Project</label><input type="text" id="dwe-project-${r.rowIndex}" value="${(r.projectName||"").replace(/"/g,"&quot;")}" placeholder="Nama project..."></div>
          <div class="fg"><label>Deadline</label><input type="date" id="dwe-deadline-${r.rowIndex}" value="${r.deadline||""}"></div>
          <div class="fg"><label>Status Deliverables</label><select id="dwe-dlstatus-${r.rowIndex}"><option value="Pending"${r.deliverablesStatus==="Pending"?" selected":""}>Pending</option><option value="In Progress"${r.deliverablesStatus==="In Progress"?" selected":""}>In Progress</option><option value="Revision"${r.deliverablesStatus==="Revision"?" selected":""}>Revision</option><option value="Completed"${r.deliverablesStatus==="Completed"?" selected":""}>Completed</option></select></div>
          <div class="fg full"><label>Deliverables URL <span style="font-size:11px;color:var(--g400)">(Google Drive)</span></label><input type="url" id="dwe-deliverables-${r.rowIndex}" value="${(r.deliverablesUrl||"").replace(/"/g,"&quot;")}" placeholder="https://drive.google.com/..."></div>
          <div class="fg" style="position:relative"><label>Kontrak (Agreement)</label><input type="text" id="dwe-agreement-${r.rowIndex}" value="${(r.agreementId||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-dwe-agr-${r.rowIndex}"></div></div>
          <div class="fg"><label>Payment Status</label><select id="dwe-payment-${r.rowIndex}"><option value="Not Paid"${r.paymentStatus==="Not Paid"?" selected":""}>Not Paid</option><option value="Not Yet Paid"${r.paymentStatus==="Not Yet Paid"?" selected":""}>Not Yet Paid</option><option value="Paid"${r.paymentStatus==="Paid"?" selected":""}>Paid</option></select></div>
          <div class="fg full"><label>Notes</label><textarea id="dwe-notes-${r.rowIndex}" rows="2" style="resize:vertical">${(r.notes||"").replace(/</g,"&lt;")}</textarea></div>
        </div>`;

    return `<tr>
      <td><strong>${r.designer||`<span style="color:var(--g400);font-style:italic;font-size:12px">—</span>`}</strong></td>
      <td style="font-size:12px">${projectLabel}${lockedBadge}${notesSnippet}</td>
      <td>${dlCell}</td>
      <td>${deadlineCell}</td>
      <td>${agrCell}</td>
      <td><span class="pill ${payPill}" style="font-size:11px">${r.paymentStatus}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="openDwEdit('${r.rowIndex}')">Edit</button>
        <button class="btn-icon" style="color:#c0392b" onclick="deleteDw('${r.rowIndex}')">Del</button>
      </td>
    </tr>
    <tr id="dw-sku-row-${r.rowIndex}" style="display:none">
      <td colspan="7" style="padding:0 12px 10px;background:var(--off)">
        <div style="padding:8px 0 4px;font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">Deliverables — ${projectLabel}${r.designer?" / "+r.designer:""}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--g400)">
            <th style="padding:4px 8px;text-align:left">SKU</th>
            <th style="padding:4px 8px;text-align:left">Kategori</th>
            <th style="padding:4px 8px;text-align:left">Designer</th>
            <th style="padding:4px 8px;text-align:left">Deadline</th>
            <th style="padding:4px 8px;text-align:left">Approval</th>
          </tr></thead>
          <tbody>${skuSubRows||`<tr><td colspan="5" style="padding:6px 8px;color:var(--g400);font-size:11px">Belum ada SKU.</td></tr>`}</tbody>
        </table>
      </td>
    </tr>
    <tr id="dw-edit-row-${r.rowIndex}" style="display:none">
      <td colspan="7" style="padding:0 12px 12px">
        <div class="edit-row-form">
          ${editForm}
          <div class="edit-row-btns">
            <button class="btn-save" onclick="saveDwEdit('${r.rowIndex}')">Simpan</button>
            <button class="btn-cancel" onclick="closeDwEdit('${r.rowIndex}')">Batal</button>
            <button class="btn-delete" onclick="deleteDw('${r.rowIndex}')">Hapus</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join("");
  rows.forEach(r=>{
    if(!r.locked) setupAC("dwe-designer-"+r.rowIndex,"ac-dwe-dsg-"+r.rowIndex,()=>allDsgRows.map(d=>d.name).filter(Boolean));
    setupAC("dwe-agreement-"+r.rowIndex,"ac-dwe-agr-"+r.rowIndex,()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);
  });
}

function toggleDwSKUs(rowIdx) {
  document.querySelectorAll("[id^='dw-sku-row-']").forEach(el=>{if(el.id!=="dw-sku-row-"+rowIdx)el.style.display="none";});
  const row=document.getElementById("dw-sku-row-"+rowIdx);if(!row)return;
  row.style.display=row.style.display==="table-row"?"none":"table-row";
}

async function updateDwDeliverables(rowIdx, status) {
  // Update select style immediately before DB round-trip
  const sel=document.querySelector(`[onchange*="updateDwDeliverables('${rowIdx}'"]`);
  if(sel) sel.style.cssText=`font-size:10px;border-radius:99px;padding:2px 8px;cursor:pointer;appearance:none;-webkit-appearance:none;${dwDlSelectStyle(status)}`;
  try {
    const {error}=await sb.from("designer_workflow").update({
      deliverables_status:status,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",rowIdx);
    if(!error){
      const r=allDwRows.find(r=>r.id===rowIdx);
      if(r) r.deliverablesStatus=status;
    }
  } catch(e){/* silent — select already shows new value */}
}

function openDwEdit(rowIdx) {
  document.querySelectorAll("[id^='dw-edit-row-']").forEach(el=>{if(el.id!=="dw-edit-row-"+rowIdx)el.style.display="none";});
  const row=document.getElementById("dw-edit-row-"+rowIdx);if(!row)return;
  row.style.display=row.style.display==="table-row"?"none":"table-row";
}
function closeDwEdit(rowIdx){const r=document.getElementById("dw-edit-row-"+rowIdx);if(r)r.style.display="none";}

async function saveDwEdit(rowIdx) {
  const btn=document.querySelector(`#dw-edit-row-${rowIdx} .btn-save`);
  if(btn){btn.disabled=true;btn.textContent="Menyimpan...";}
  try {
    const row=allDwRows.find(r=>r.id===rowIdx);
    const isLocked=!!(row?.locked);
    const updatePayload={
      deliverables_url:document.getElementById(`dwe-deliverables-${rowIdx}`)?.value.trim()||null,
      agreement_id:document.getElementById(`dwe-agreement-${rowIdx}`)?.value.trim()||null,
      payment_status:document.getElementById(`dwe-payment-${rowIdx}`)?.value||"Not Paid",
      notes:document.getElementById(`dwe-notes-${rowIdx}`)?.value.trim()||null,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    };
    if(!isLocked){
      const dsg=document.getElementById(`dwe-designer-${rowIdx}`)?.value.trim()||null;
      updatePayload.designer=dsg;
      updatePayload.project_name=document.getElementById(`dwe-project-${rowIdx}`)?.value.trim()||null;
      updatePayload.deadline=document.getElementById(`dwe-deadline-${rowIdx}`)?.value||null;
      updatePayload.deliverables_status=document.getElementById(`dwe-dlstatus-${rowIdx}`)?.value||"Pending";
    }
    const {error}=await sb.from("designer_workflow").update(updatePayload).eq("id",rowIdx);
    if(error)throw error;
    closeDwEdit(rowIdx);
    logActivity("Designer Workflow","edit",rowIdx,row?.designer||rowIdx);
    await loadDsgWorkflow();
  } catch(e){if(btn){btn.disabled=false;btn.textContent="Simpan";}alert("Gagal: "+(e.message||e));}
}

async function deleteDw(rowIdx) {
  if(!confirm("Hapus workflow entry ini?"))return;
  try {
    const {error}=await sb.from("designer_workflow").delete().eq("id",rowIdx);
    if(error)throw error;
    logActivity("Designer Workflow","delete",rowIdx,"Dihapus");
    await loadDsgWorkflow();
  } catch(e){alert("Gagal: "+(e.message||e));}
}

function switchDwTab(tab,btn) {
  document.getElementById("dwtab-new").style.display=tab==="new"?"block":"none";
  document.getElementById("dwtab-list").style.display=tab==="list"?"block":"none";
  document.querySelectorAll("#page-dsgworkflow .tab-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  if(tab==="list")loadDsgWorkflow();
}

async function submitDsgWorkflow() {
  const dsg=document.getElementById("dw-designer")?.value.trim();
  if(!dsg){document.getElementById("dw-feedback").innerHTML='<span class="fb-err">Designer wajib diisi.</span>';return;}
  const btn=document.getElementById("dwSubmitBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try {
    const id=genId("DW");
    const {error}=await sb.from("designer_workflow").insert({
      id, designer:dsg,
      project_name:document.getElementById("dw-project")?.value.trim()||null,
      deliverables_url:document.getElementById("dw-deliverables")?.value.trim()||null,
      deliverables_status:document.getElementById("dw-dl-status")?.value||"Pending",
      deadline:document.getElementById("dw-deadline")?.value||null,
      agreement_id:document.getElementById("dw-agreement")?.value.trim()||null,
      payment_status:document.getElementById("dw-payment")?.value||"Not Paid",
      notes:document.getElementById("dw-notes")?.value.trim()||null,
      locked:false,
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    document.getElementById("dw-feedback").innerHTML=`<span class="fb-ok">✓ Workflow entry tersimpan — ID: ${id}</span>`;
    logActivity("Designer Workflow","create",id,dsg);
    clearDwForm();
  } catch(e){
    document.getElementById("dw-feedback").innerHTML=`<span class="fb-err">Gagal: ${e.message||e}</span>`;
  } finally {btn.disabled=false;btn.textContent="Simpan";}
}

function clearDwForm() {
  ["dw-designer","dw-project","dw-deliverables","dw-agreement","dw-notes"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const p=document.getElementById("dw-payment");if(p)p.value="Not Paid";
  const dl=document.getElementById("dw-deadline");if(dl)dl.value="";
  const dls=document.getElementById("dw-dl-status");if(dls)dls.value="Pending";
}

// ── DUPLICATE CHECK ──
async function checkDuplicate(name, excludeSheet) {
  // Check IP Master and Brand Master for duplicate name
  const ipNames = allIPRows.map(r=>(r.name||"").toLowerCase().trim());
  const bmNames = allBMRows.map(r=>(r.name||"").toLowerCase().trim());
  const n = name.toLowerCase().trim();
  if (excludeSheet !== "ip"  && ipNames.includes(n)) return "IP Master";
  if (excludeSheet !== "bm"  && bmNames.includes(n)) return "Brand Master";
  return null;
}

// ── SESSION RESTORE ──
(async () => {
  // Check for password recovery token in URL hash (#access_token=...&type=recovery)
  const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  if (hash.type === "recovery" && hash.access_token) {
    // Set the session from the recovery token so updateUser() works
    await sb.auth.setSession({ access_token: hash.access_token, refresh_token: hash.refresh_token || "" });
    history.replaceState(null, "", location.pathname); // clean up URL
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("resetBox").style.display = "block";
    return;
  }
  // Normal session restore
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) enterApp(session.user);
})();

async function doResetPassword() {
  const p1  = document.getElementById("resetPass1").value;
  const p2  = document.getElementById("resetPass2").value;
  const err = document.getElementById("resetErr");
  const btn = document.getElementById("resetBtn");
  if (!p1 || p1.length < 8) { err.textContent = "Password minimal 8 karakter."; return; }
  if (p1 !== p2)             { err.textContent = "Password tidak cocok."; return; }
  err.textContent = "";
  btn.disabled = true; btn.textContent = "Menyimpan...";
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { err.textContent = "Gagal: " + error.message; btn.disabled = false; btn.textContent = "Simpan Password →"; return; }
  // Password saved — sign in automatically
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) { enterApp(session.user); return; }
  // Fallback: show login
  document.getElementById("resetBox").style.display = "none";
  document.getElementById("loginBox").style.display = "block";
  document.getElementById("loginErr").textContent = "Password berhasil diubah. Silakan login.";
}

// Keep session in sync (handles token refresh, tab-switching, etc.)
sb.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = ""; allRows = [];
    document.getElementById("app").style.display = "none";
    document.getElementById("loginScreen").style.display = "grid";
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("resetBox").style.display = "none";
  }
});

