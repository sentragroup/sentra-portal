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
function mapPB(r) { return {rowIndex:r.id,id:r.id,eventDate:r.event_date||"",eventName:r.event_name||"",location:r.location||"",ipRelated:r.ip_related||"",manpower:r.manpower||"",qtyBrought:r.qty_brought!=null?r.qty_brought:"",suratJalanUrl:r.surat_jalan_url||"",deliveryStatus:r.delivery_status||"",eventStatus:r.event_status||"",reinboundStatus:r.reinbound_status||"",reinboundQty:r.reinbound_qty!=null?r.reinbound_qty:"",srDeadline:r.sr_deadline||"",actualSales:r.actual_sales!=null?r.actual_sales:"",paymentMethod:r.payment_method||"",idPesananJubelio:r.id_pesanan_jubelio||"",notes:r.notes||"",dateAdded:r.date_added||"",addedBy:r.added_by||"",lastUpdated:r.last_updated||"",lastUpdatedBy:r.last_updated_by||""}; }

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
  const _pg = location.hash.slice(1);
  if (['agreement','ipmaster','recipients','brandmaster','salesreport','leads','distpartner','popupbooth','activitylog','jubsales'].includes(_pg))
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
  const labels = {home:"Internal Tools",agreement:"Agreement Tracker",ipmaster:"IP Master",recipients:"Royalty Recipients",brandmaster:"Brand Master",salesreport:"Account Report",leads:"Leads Management",distpartner:"Distribution Partner",popupbooth:"Pop Up Booth",activitylog:"Activity Log",jubsales:"Jubelio Offline Sales"};
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

function checkPBJubelioMatch(sidId, asId, hintId) {
  const sid = (document.getElementById(sidId)?.value||"").trim();
  const asVal = document.getElementById(asId)?.value;
  const hint = document.getElementById(hintId);
  if (!hint) return;
  if (!sid) { hint.textContent=""; return; }
  const gt = (window._jubOrderMap||{})[sid];
  if (gt==null) { hint.textContent=""; return; }
  const gtNum = Number(gt);
  const asNum = asVal!==""&&asVal!=null ? Number(asVal) : null;
  if (asNum===null||isNaN(asNum)) { hint.innerHTML=`<span style="color:var(--g400)">Grand Total Jubelio: Rp ${gtNum.toLocaleString("id-ID")}</span>`; return; }
  if (asNum===gtNum) hint.innerHTML=`<span style="color:#27ae60">✓ Sesuai dengan Grand Total Jubelio (Rp ${gtNum.toLocaleString("id-ID")})</span>`;
  else hint.innerHTML=`<span style="color:#c0392b">⚠️ Tidak sesuai — Grand Total Jubelio: Rp ${gtNum.toLocaleString("id-ID")} | Actual Sales: Rp ${asNum.toLocaleString("id-ID")}</span>`;
}

function calcPBSRDeadline(eventDate) {
  if (!eventDate) return "";
  const d = new Date(eventDate+"T00:00:00"); d.setDate(d.getDate()+3);
  return d.toISOString().slice(0,10);
}

function validateSJLink(url) {
  if (!url) return null;
  if (/docs\.google\.com\/(document|spreadsheets|presentation|forms)/i.test(url))
    return "⚠️ Link ini adalah Google Docs/Sheets/Slides yang bisa diedit. Gunakan link file Google Drive: drive.google.com/file/d/.../view";
  return null;
}
function pbValidateSJ(hintId, url) {
  const el = document.getElementById(hintId);
  if (!el) return;
  el.textContent = validateSJLink(url) || "";
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
  tbody.innerHTML = `<tr><td class="empty-td" colspan="15">Memuat...</td></tr>`;
  try {
    if (!allIPRows.length) {
      const {data} = await sb.from("ip_master").select("*");
      if (data) allIPRows = data.map(mapIP);
    }
    const [{data,error},{data:jubData}] = await Promise.all([
      sb.from("popup_booths").select("*").order("event_date",{ascending:false}),
      sb.from("jubelio_offline_sales_orders").select("salesorder_id,grand_total")
    ]);
    if (error) throw error;
    allPBRows = (data||[]).map(mapPB);
    window._jubOrderMap = {};
    (jubData||[]).forEach(r=>{ if(r.salesorder_id!=null) window._jubOrderMap[String(r.salesorder_id).trim()] = r.grand_total; });
    setupACMulti("pb-iprelated","ac-pb-iprelated",()=>allIPRows.filter(r=>r.liveStatus==="Active").map(r=>r.name).filter(Boolean));
    setupACMulti("pb-manpower","ac-pb-manpower",()=>getManpowerOptions());
    setupAC("pb-id-pesanan","ac-pb-idpesanan",()=>Object.keys(window._jubOrderMap||{}));
    renderPBStats(allPBRows);
    applyPBFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="15">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function renderPBStats(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById("pb-s-total").textContent = rows.length;
  document.getElementById("pb-s-upcoming").textContent = rows.filter(r=>{ if(!r.eventDate)return false; const d=new Date(r.eventDate+"T00:00:00"); return d>=today&&r.eventStatus!=="Done"&&r.eventStatus!=="Cancelled"; }).length;
  document.getElementById("pb-s-done").textContent = rows.filter(r=>r.eventStatus==="Done").length;
  document.getElementById("pb-s-cancelled").textContent = rows.filter(r=>r.eventStatus==="Cancelled").length;
  document.getElementById("pb-s-reinbound").textContent = rows.filter(r=>r.reinboundStatus==="Not Yet").length;
}

function applyPBFilters() {
  const status = (document.getElementById("pb-fil-status")?.value)||"";
  const q = ((document.getElementById("pbSearch")?.value)||"").toLowerCase();
  let rows = allPBRows;
  if (status==="Planned") rows = rows.filter(r=>!r.eventStatus||r.eventStatus==="Planned");
  else if (status) rows = rows.filter(r=>r.eventStatus===status);
  if (q) rows = rows.filter(r=>(r.eventName||"").toLowerCase().includes(q)||(r.location||"").toLowerCase().includes(q)||(r.ipRelated||"").toLowerCase().includes(q));
  renderPBTable(rows);
}

function renderPBTable(rows) {
  rows = sortBy(rows, pbSort.col, pbSort.dir);
  updateSortTh("pb-thead", pbSort.col, pbSort.dir);
  const tbody = document.getElementById("pbTableBody");
  document.getElementById("pb-tcount").textContent = rows.length+" entri";
  if (!rows.length) { tbody.innerHTML=`<tr><td class="empty-td" colspan="15">Tidak ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => {
    const esPill = `<span class="pill ${r.eventStatus==="Done"?"p-active":r.eventStatus==="Cancelled"?"p-expired":"p-draft"}" style="font-size:11px">${r.eventStatus||"Planned"}</span>`;
    const reinPill = r.reinboundStatus ? `<span class="pill ${r.reinboundStatus==="Done"?"p-active":r.reinboundStatus==="Not Yet"?"p-near":r.reinboundStatus==="Sold Out"?"p-expired":"p-draft"}" style="font-size:11px">${r.reinboundStatus}</span>${(r.reinboundQty!==""&&r.reinboundQty!=null)?" ("+r.reinboundQty+")":""}` : "—";
    const manpowerStr = r.manpower || "—";
    const sjBtn = r.suratJalanUrl ? `<a href="${r.suratJalanUrl}" target="_blank" class="btn-icon" title="Lihat Surat Jalan">📎&nbsp;SJ</a>` : "—";
    const idPesananCell = r.idPesananJubelio ? `<span style="font-size:11px;font-family:var(--mono)">${r.idPesananJubelio}</span>` : `<span style="background:#fdecea;color:#c0392b;padding:2px 6px;border-radius:4px;font-size:11px">Belum diisi</span>`;
    const pm = r.paymentMethod ? r.paymentMethod.split(",").map(p=>`<span class="pill p-signings" style="font-size:10px;margin-right:2px">${p.trim()}</span>`).join("") : "—";
    const actualSales = (r.actualSales!==""&&r.actualSales!=null) ? `Rp ${Number(r.actualSales).toLocaleString("id-ID")}` : "—";
    return `<tr>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.eventDate)}</td>
      <td><strong>${r.eventName||"—"}</strong></td>
      <td style="font-size:12px">${r.location||"—"}</td>
      <td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.ipRelated||""}">${r.ipRelated||"—"}</td>
      <td style="font-size:11px;max-width:160px;color:var(--g600)">${manpowerStr}</td>
      <td style="text-align:center">${(r.qtyBrought!==""&&r.qtyBrought!=null)?r.qtyBrought:"—"}</td>
      <td style="text-align:center">${sjBtn}</td>
      <td><span class="pill ${r.deliveryStatus==="Delivered"?"p-active":"p-draft"}" style="font-size:11px">${r.deliveryStatus||"Pending"}</span></td>
      <td>${esPill}</td>
      <td style="font-size:12px;white-space:nowrap">${reinPill}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.srDeadline)}</td>
      <td style="white-space:nowrap;font-size:12px">${actualSales}</td>
      <td style="font-size:11px">${pm}</td>
      <td>${idPesananCell}</td>
      <td><button class="btn-icon" onclick="openPBEdit('${r.rowIndex}')">Edit</button> <button class="btn-icon" style="color:#c0392b" onclick="deletePB('${r.rowIndex}')">Del</button></td>
    </tr>
    <tr id="pb-edit-row-${r.rowIndex}" style="display:none">
      <td colspan="15" style="padding:0 12px 12px">
        <div class="edit-row-form">
          <div class="edit-row-grid">
            <div class="fg"><label>Tanggal Event</label><input type="date" id="pbe-eventdate-${r.rowIndex}" value="${r.eventDate}"></div>
            <div class="fg"><label>Nama Event</label><input type="text" id="pbe-eventname-${r.rowIndex}" value="${(r.eventName||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>Lokasi</label><input type="text" id="pbe-location-${r.rowIndex}" value="${(r.location||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>IP Related</label><input type="text" id="pbe-iprelated-${r.rowIndex}" value="${(r.ipRelated||'').replace(/"/g,'&quot;')}" placeholder="Pisahkan dengan koma"></div>
            <div class="fg"><label>Qty Brought</label><input type="number" id="pbe-qty-${r.rowIndex}" value="${r.qtyBrought!=null?r.qtyBrought:''}" min="0"></div>
            <div class="fg"><label>Delivery Status</label><select id="pbe-delivery-${r.rowIndex}"><option value="">—</option><option ${r.deliveryStatus==="Delivered"?"selected":""}>Delivered</option></select></div>
            <div class="fg"><label>Event Status</label><select id="pbe-eventstatus-${r.rowIndex}"><option value="">Planned</option><option ${r.eventStatus==="Done"?"selected":""}>Done</option><option ${r.eventStatus==="Cancelled"?"selected":""}>Cancelled</option></select></div>
            <div class="fg"><label>Reinbound Status</label><select id="pbe-reinbound-${r.rowIndex}"><option value="">—</option><option ${r.reinboundStatus==="Done"?"selected":""}>Done</option><option ${r.reinboundStatus==="Not Yet"?"selected":""}>Not Yet</option><option ${r.reinboundStatus==="Sold Out"?"selected":""}>Sold Out</option></select></div>
            <div class="fg"><label>Reinbound Qty</label><input type="number" id="pbe-reinboundqty-${r.rowIndex}" value="${r.reinboundQty!=null?r.reinboundQty:''}" min="0"></div>
            <div class="fg"><label>Actual Sales (IDR)</label><input type="number" id="pbe-actualsales-${r.rowIndex}" value="${r.actualSales!=null?r.actualSales:''}" min="0" oninput="checkPBJubelioMatch('pbe-idpesanan-${r.rowIndex}','pbe-actualsales-${r.rowIndex}','pbe-jubelio-hint-${r.rowIndex}')"></div>
            <div class="fg full"><label>Payment Method</label><div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0"><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-jpos-${r.rowIndex}" ${(r.paymentMethod||"").includes("Jubelio POS")?"checked":""}> Jubelio POS</label><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-qris-${r.rowIndex}" ${(r.paymentMethod||"").includes("QRIS Xendit")?"checked":""}> QRIS Xendit</label><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="pbe-pm-cons-${r.rowIndex}" ${(r.paymentMethod||"").includes("Consignment")?"checked":""}> Consignment</label></div></div>
            <div class="fg" style="position:relative"><label>Manpower</label><input type="text" id="pbe-manpower-${r.rowIndex}" value="${(r.manpower||'').replace(/"/g,'&quot;')}" placeholder="Ketik nama, pisahkan dengan koma" autocomplete="off"><div class="ac-list" id="ac-pbe-manpower-${r.rowIndex}"></div></div>
            <div class="fg full"><label>Surat Jalan <span style="font-size:11px;color:var(--g400)">(link Google Drive file)</span></label><input type="url" id="pbe-sj-${r.rowIndex}" value="${(r.suratJalanUrl||'').replace(/"/g,'&quot;')}" placeholder="https://drive.google.com/file/d/..." style="width:100%" oninput="pbValidateSJ('pbe-sj-hint-${r.rowIndex}',this.value)"><div id="pbe-sj-hint-${r.rowIndex}" style="color:#c0392b;font-size:11px;margin-top:3px"></div></div>
            <div class="fg" style="position:relative"><label>ID Pesanan Jubelio</label><input type="text" id="pbe-idpesanan-${r.rowIndex}" value="${(r.idPesananJubelio||'').replace(/"/g,'&quot;')}" placeholder="Pilih dari Jubelio Offline Sales" autocomplete="off" oninput="checkPBJubelioMatch('pbe-idpesanan-${r.rowIndex}','pbe-actualsales-${r.rowIndex}','pbe-jubelio-hint-${r.rowIndex}')"><div class="ac-list" id="ac-pbe-idpesanan-${r.rowIndex}"></div><div id="pbe-jubelio-hint-${r.rowIndex}" style="font-size:11px;margin-top:3px"></div></div>
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
    const orig = allPBRows.find(r=>r.rowIndex===rowIdx);
    if (orig?.idPesananJubelio) checkPBJubelioMatch("pbe-idpesanan-"+rowIdx,"pbe-actualsales-"+rowIdx,"pbe-jubelio-hint-"+rowIdx);
  }
}
function closePBEdit(rowIdx) { const r=document.getElementById("pb-edit-row-"+rowIdx); if(r) r.style.display="none"; }

async function savePBEdit(rowIdx) {
  const btn = document.querySelector(`#pb-edit-row-${rowIdx} .btn-save`);
  if (btn) { btn.disabled=true; btn.textContent="Menyimpan..."; }
  try {
    const orig = allPBRows.find(r=>r.rowIndex===rowIdx);
    const sjUrl = document.getElementById(`pbe-sj-${rowIdx}`)?.value.trim()||null;
    const sjWarn = validateSJLink(sjUrl);
    if (sjWarn) { if(btn){btn.disabled=false;btn.textContent="Simpan";} alert(sjWarn); return; }
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
    const qtyVal = document.getElementById(`pbe-qty-${rowIdx}`).value;
    const rqVal  = document.getElementById(`pbe-reinboundqty-${rowIdx}`).value;
    const asVal  = document.getElementById(`pbe-actualsales-${rowIdx}`).value;
    const {error} = await sb.from("popup_booths").update({
      event_name:nm, event_date:eventDate||null,
      location:document.getElementById(`pbe-location-${rowIdx}`).value.trim()||null,
      ip_related:document.getElementById(`pbe-iprelated-${rowIdx}`).value.trim()||null,
      manpower, qty_brought:qtyVal?parseInt(qtyVal):null,
      surat_jalan_url:sjUrl, delivery_status:document.getElementById(`pbe-delivery-${rowIdx}`).value||null,
      event_status:document.getElementById(`pbe-eventstatus-${rowIdx}`).value||null,
      reinbound_status:document.getElementById(`pbe-reinbound-${rowIdx}`).value||null,
      reinbound_qty:rqVal?parseInt(rqVal):null, sr_deadline:srDeadline||null,
      actual_sales:asVal?parseFloat(asVal):null, payment_method:pm||null,
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
  ["pb-eventdate","pb-eventname","pb-location","pb-iprelated","pb-qty","pb-actualsales","pb-notes","pb-reinboundqty","pb-sj","pb-id-pesanan"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  ["pb-delivery","pb-eventstatus","pb-reinbound"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
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
    const sjWarn = validateSJLink(sjUrl);
    if (sjWarn) { document.getElementById("pb-feedback").innerHTML=`<span class="fb-err">${sjWarn}</span>`; btn.disabled=false; btn.textContent="Simpan"; return; }
    const pm = [
      document.getElementById("pb-pm-jpos")?.checked?"Jubelio POS":"",
      document.getElementById("pb-pm-qris")?.checked?"QRIS Xendit":"",
      document.getElementById("pb-pm-cons")?.checked?"Consignment":""
    ].filter(Boolean).join(", ");
    const manpower = document.getElementById("pb-manpower")?.value.trim()||null;
    const srDeadline = calcPBSRDeadline(eventDate);
    const qtyVal = document.getElementById("pb-qty").value;
    const rqVal  = document.getElementById("pb-reinboundqty").value;
    const asVal  = document.getElementById("pb-actualsales").value;
    const row = {
      id, event_name:eventName, event_date:eventDate,
      location:document.getElementById("pb-location").value.trim()||null,
      ip_related:document.getElementById("pb-iprelated").value.trim()||null,
      manpower, qty_brought:qtyVal?parseInt(qtyVal):null,
      surat_jalan_url:sjUrl,
      delivery_status:document.getElementById("pb-delivery").value||null,
      event_status:document.getElementById("pb-eventstatus").value||null,
      reinbound_status:document.getElementById("pb-reinbound").value||null,
      reinbound_qty:rqVal?parseInt(rqVal):null,
      sr_deadline:srDeadline||null,
      actual_sales:asVal?parseFloat(asVal):null,
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
    note:r.note||"",
    dateAdded:r.date_added||"",
    addedBy:r.added_by||""
  };
}

async function loadJubSales() {
  const tbody = document.getElementById("jubTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="8">Memuat...</td></tr>`;
  try {
    const [{data:jubData,error:jubErr},{data:pbData}] = await Promise.all([
      sb.from("jubelio_offline_sales_orders").select("*").order("transaction_date",{ascending:false}),
      sb.from("popup_booths").select("id_pesanan_jubelio")
    ]);
    if (jubErr) throw jubErr;
    allJubRows = (jubData||[]).map(mapJub);
    // Build set of mapped IDs from popup_booths
    window._jubMappedSet = new Set((pbData||[]).map(r=>r.id_pesanan_jubelio!=null?String(r.id_pesanan_jubelio).trim():"").filter(Boolean));
    renderJubStats(allJubRows);
    applyJubFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="8">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function isJubMapped(row) {
  const s = (window._jubMappedSet||new Set());
  const sid = row.salesorderId!=null ? String(row.salesorderId).trim() : "";
  return sid !== "" && s.has(sid);
}

function renderJubStats(rows) {
  const mapped = rows.filter(r=>isJubMapped(r)).length;
  const unmapped = rows.length - mapped;
  const totalSales = rows.reduce((a,r)=>a+(r.grandTotal!==""&&r.grandTotal!=null?Number(r.grandTotal):0),0);
  document.getElementById("jub-s-total").textContent = rows.length;
  document.getElementById("jub-s-mapped").textContent = mapped;
  document.getElementById("jub-s-unmapped").textContent = unmapped;
  document.getElementById("jub-s-total-sales").textContent = totalSales ? "Rp "+totalSales.toLocaleString("id-ID") : "—";
}

function applyJubFilters() {
  const mapFil = document.getElementById("jub-fil-mapped")?.value||"";
  const q = (document.getElementById("jubSearch")?.value||"").toLowerCase();
  let rows = allJubRows;
  if (mapFil==="mapped") rows = rows.filter(r=>isJubMapped(r));
  else if (mapFil==="unmapped") rows = rows.filter(r=>!isJubMapped(r));
  if (q) rows = rows.filter(r=>(r.salesorderId||"").toLowerCase().includes(q)||(r.shippingFullName||"").toLowerCase().includes(q)||(r.internalStatus||"").toLowerCase().includes(q));
  renderJubTable(rows);
}

function clearJubFilters() {
  const mf=document.getElementById("jub-fil-mapped"); if(mf) mf.value="";
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
    const mapped = isJubMapped(r);
    const mappedCell = mapped
      ? `<span class="pill p-active" style="font-size:11px">Mapped</span>`
      : `<span style="color:#c0392b;font-size:11px;font-weight:500">Unmapped</span>`;
    const gt = (r.grandTotal!==""&&r.grandTotal!=null) ? `Rp ${Number(r.grandTotal).toLocaleString("id-ID")}` : "—";
    return `<tr>
      <td style="font-family:var(--mono);font-size:12px">${r.salesorderId||"—"}</td>
      <td>${r.shippingFullName||"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.transactionDate)}</td>
      <td><span class="pill p-draft" style="font-size:11px">${r.internalStatus||"—"}</span></td>
      <td style="white-space:nowrap;font-size:12px">${gt}</td>
      <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.note||'').replace(/"/g,'&quot;')}">${r.note||"—"}</td>
      <td>${mappedCell}</td>
      <td><button class="btn-icon" onclick="openJubEdit(${r.rowIndex})">Edit</button> <button class="btn-icon" style="color:#c0392b" onclick="deleteJub(${r.rowIndex})">Del</button></td>
    </tr>
    <tr id="jub-edit-row-${r.rowIndex}" style="display:none">
      <td colspan="8" style="padding:0 12px 12px">
        <div class="edit-row-form">
          <div class="edit-row-grid">
            <div class="fg"><label>Sales Order ID</label><input type="text" id="jube-soid-${r.rowIndex}" value="${(r.salesorderId||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>Nama Penerima</label><input type="text" id="jube-name-${r.rowIndex}" value="${(r.shippingFullName||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>Tanggal Transaksi</label><input type="date" id="jube-txdate-${r.rowIndex}" value="${r.transactionDate}"></div>
            <div class="fg"><label>Internal Status</label><input type="text" id="jube-status-${r.rowIndex}" value="${(r.internalStatus||'').replace(/"/g,'&quot;')}"></div>
            <div class="fg"><label>Grand Total (IDR)</label><input type="number" id="jube-total-${r.rowIndex}" value="${r.grandTotal!==""&&r.grandTotal!=null?r.grandTotal:''}" min="0"></div>
            <div class="fg full"><label>Note</label><textarea id="jube-note-${r.rowIndex}" rows="2" style="resize:vertical">${(r.note||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea></div>
          </div>
          <div class="edit-row-btns">
            <button class="btn-save" onclick="saveJubEdit(${r.rowIndex})">Simpan</button>
            <button class="btn-cancel" onclick="closeJubEdit(${r.rowIndex})">Batal</button>
            <button class="btn-delete" onclick="deleteJub(${r.rowIndex})">Hapus</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function openJubEdit(rowIdx) {
  document.querySelectorAll("[id^='jub-edit-row-']").forEach(el=>{ if(el.id!=="jub-edit-row-"+rowIdx) el.style.display="none"; });
  const row = document.getElementById("jub-edit-row-"+rowIdx);
  if (!row) return;
  const shown = row.style.display==="table-row";
  row.style.display = shown ? "none" : "table-row";
}
function closeJubEdit(rowIdx) { const r=document.getElementById("jub-edit-row-"+rowIdx); if(r) r.style.display="none"; }

async function saveJubEdit(rowIdx) {
  const btn = document.querySelector(`#jub-edit-row-${rowIdx} .btn-save`);
  if (btn) { btn.disabled=true; btn.textContent="Menyimpan..."; }
  try {
    const gtVal = document.getElementById(`jube-total-${rowIdx}`).value;
    const {error} = await sb.from("jubelio_offline_sales_orders").update({
      salesorder_id:document.getElementById(`jube-soid-${rowIdx}`).value.trim()||null,
      shipping_full_name:document.getElementById(`jube-name-${rowIdx}`).value.trim()||null,
      transaction_date:document.getElementById(`jube-txdate-${rowIdx}`).value||null,
      internal_status:document.getElementById(`jube-status-${rowIdx}`).value.trim()||null,
      grand_total:gtVal?parseFloat(gtVal):null,
      note:document.getElementById(`jube-note-${rowIdx}`).value.trim()||null
    }).eq("id",rowIdx);
    if (error) throw error;
    closeJubEdit(rowIdx);
    logActivity("Jubelio Offline Sales","edit",String(rowIdx),"Edit sales order");
    await loadJubSales();
  } catch(e) {
    if(btn){btn.disabled=false;btn.textContent="Simpan";}
    alert("Gagal menyimpan: "+(e.message||e));
  }
}

async function deleteJub(rowIdx) {
  if (!confirm("Hapus sales order ini? Tindakan tidak bisa dibatalkan.")) return;
  try {
    const {error} = await sb.from("jubelio_offline_sales_orders").delete().eq("id",rowIdx);
    if (error) throw error;
    logActivity("Jubelio Offline Sales","delete",String(rowIdx),"Dihapus");
    await loadJubSales();
  } catch(e) { alert("Gagal menghapus: "+(e.message||e)); }
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

