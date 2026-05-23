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
// Fetch every row from a table, paging past PostgREST's 1000-row response cap.
// extraQ (optional) receives the query builder to add filters/order, e.g. q=>q.eq("x",1).
async function _fetchAllPages(table, select="*", extraQ){
  const PAGE=1000; let all=[], from=0;
  while(true){
    let q=sb.from(table).select(select).range(from,from+PAGE-1);
    if(extraQ) q=extraQ(q);
    const {data,error}=await q; if(error) throw error;
    all=all.concat(data||[]);
    if(!data||data.length<PAGE) break;
    from+=PAGE;
  }
  return all;
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
function mapLD(r) { return {rowIndex:r.id,id:r.id,name:r.lead_name||"",category:r.category||"",stage:r.stage||"",pic:r.pic||"",revenue:r.revenue_stream||"",contact:r.contact||"",notes:r.notes||"",priority:r.priority||"",followUpDate:r.follow_up_date||"",date:r.date_added?new Date(r.date_added).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"",by:r.added_by||"",lastUpdate:r.last_updated?new Date(r.last_updated).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"",lastBy:r.last_updated_by||"",addedBy:r.added_by||""}; }
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
  enterApp(data.user, true);
}

function enterApp(user, freshLogin) {
  const name = user.user_metadata?.name || user.email.split("@")[0];
  currentUser = name;
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("userName").textContent = name;
  document.getElementById("greetName").textContent = name.split(" ")[0];
  document.getElementById("greetDate").textContent = new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  loadStats();
  preloadAutocomplete();
  if (freshLogin) logActivity("Auth","login",null,"Login berhasil");
  loadNotifications();
  if (notifPollTimer) clearInterval(notifPollTimer);
  notifPollTimer = setInterval(loadNotifications, 60000);
  // Restore page: prefer URL hash, fall back to sessionStorage
  let _pg = location.hash.slice(1).split('/')[0];
  if (!_pg) _pg = sessionStorage.getItem('snt_page') || '';
  const _pages = ['agreement','ipmaster','recipients','brandmaster','salesreport','leads','distpartner','popupbooth','activitylog','jubsales','mesign','po','stockmovement','productmap','collections','designermaster','dsgworkflow','warehousekpi','stockadjmgmt','returnreason','tradorders','invcheck'];
  if (_pages.includes(_pg))
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
  const labels = {home:"Internal Tools",project:"Project Board",agreement:"Agreement",ipmaster:"IP Master",recipients:"Royalty Recipients",brandmaster:"Brand Master",salesreport:"Account Report",leads:"Leads Management",distpartner:"Distribution Partner",popupbooth:"Pop Up Booth",activitylog:"Activity Log",jubsales:"Offline Sales Log",mesign:"Mekari Sign",po:"Purchase Orders",stockmovement:"Stock Movement",productmap:"Product Mapping",collections:"Collection Development",designermaster:"Designer Master",dsgworkflow:"Designer Workflow",warehousekpi:"Warehouse KPI",stockadjmgmt:"Stock Adjustment",returnreason:"Return Reason",tradorders:"Wholesale Orders",invcheck:"Inventory Check"};
  document.getElementById("topbarPage").textContent = labels[name]||name;
  // Keep full hash if it's already a sub-path of this page (e.g. #collections/slug)
  const _curHash = location.hash.slice(1);
  const _newHash = name==="home" ? location.pathname
    : (_curHash===name||_curHash.startsWith(name+'/')) ? location.hash : "#"+name;
  history.replaceState(null, "", _newHash);
  // Save current page to sessionStorage as fallback for refresh restoration
  if (name !== "home") sessionStorage.setItem('snt_page', name);
  else sessionStorage.removeItem('snt_page');
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
  if (name==="stockmovement" && !smPORows.length) loadStockMovement();
  if (name==="productmap") loadProductMap(0,'');
  if (name==="collections") {
    // If restoring a collection detail from URL, immediately switch to detail view
    // to prevent the "new collection" form from flashing before data loads
    const _ch = location.hash.slice(1);
    if (_ch.startsWith('collections/')) {
      const lv=document.getElementById("col-list-view");
      const dv=document.getElementById("col-detail-view");
      if(lv) lv.style.display="none";
      if(dv) dv.style.display="block";
    }
    loadCollections();
    setupAC("col-ip","ac-col-ip",()=>allIPRows.map(r=>r.name).filter(Boolean));
    setupAC("col-pic","ac-col-pic",()=>[...new Set(allColRows.map(r=>r.pic).filter(Boolean))]);
  }
  if (name==="designermaster") { loadDesignerMaster(); const cats=[...new Set([...DSG_CATEGORIES_DEFAULT,...allDsgRows.map(r=>r.category).filter(Boolean)])]; setupAC("dsg-category","ac-dsg-category",()=>cats); }
  if (name==="dsgworkflow") loadDsgWorkflow();
  if (name==="warehousekpi" && !whBills.length) loadWHData();
  if (name==="stockadjmgmt" && !saAdjustments.length) loadSAData();
  if (name==="returnreason" && !retOrders.length) loadRetData();
  if (name==="tradorders") loadTradeOrders();
  if (name==="invcheck") loadInvCheck();
  if (name==="project") loadProjects();
  if (name==="calendar") loadCalendar();
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

// Position AC dropdown using fixed coords so it escapes overflow:hidden/auto parents
function positionACList(inp, lst) {
  const r = inp.getBoundingClientRect();
  lst.style.position = 'fixed';
  lst.style.top  = (r.bottom + 4) + 'px';
  lst.style.left = r.left + 'px';
  lst.style.width = Math.max(r.width, 220) + 'px';
  lst.style.right = 'auto';
}

function setupAC(inpId, lstId, getOpts, getRichOpts) {
  const inp = document.getElementById(inpId), lst = document.getElementById(lstId);
  if (!inp || !lst) return;
  inp.addEventListener("input",  () => { positionACList(inp,lst); renderAC(lst, inp, getOpts(), getRichOpts?getRichOpts():null); });
  inp.addEventListener("focus",  () => { if (getOpts().length) { positionACList(inp,lst); renderAC(lst, inp, getOpts(), getRichOpts?getRichOpts():null); } });
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
    logActivity("Account Report",isUpdate?"update":"submit",srModalContext.brandId,srModalContext.brandName+" — bulan "+(srModalContext.monthIdx+1));
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
    logActivity("Account Report","delete",srModalContext.brandId,srModalContext.brandName+" — bulan "+(srModalContext.monthIdx+1));
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
    logActivity("Account Report","set_startdate",srSDContext.brandId,(brand?brand.name:srSDContext.brandId)+" → "+date);
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
    positionACList(inp, lst);
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
    const {error}=await sb.from("leads").insert({id,lead_name:name,category,stage,pic:document.getElementById("ld-pic").value.trim(),contact:document.getElementById("ld-contact").value.trim(),revenue_stream:revenues.join(", "),notes:document.getElementById("ld-notes").value.trim(),priority:document.getElementById("ld-priority").value,follow_up_date:document.getElementById("ld-followup").value||null,added_by:currentUser,last_updated:new Date().toISOString(),last_updated_by:currentUser});
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
  ["ld-name","ld-category","ld-pic","ld-contact","ld-notes","ld-followup"].forEach(id=>document.getElementById(id).value="");
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
          <div class="fg"><label>Follow-up Date</label><input type="date" id="ld-e-followup-${r.rowIndex}" value="${r.followUpDate||""}"></div>
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
    const {error}=await sb.from("leads").update({lead_name:document.getElementById("ld-e-name-"+rowIndex).value.trim(),category:document.getElementById("ld-e-cat-"+rowIndex).value.trim(),stage:document.getElementById("ld-e-stage-"+rowIndex).value,pic:document.getElementById("ld-e-pic-"+rowIndex).value.trim(),contact:document.getElementById("ld-e-contact-"+rowIndex).value.trim(),revenue_stream:document.getElementById("ld-e-revenue-"+rowIndex).value.trim(),notes:document.getElementById("ld-e-notes-"+rowIndex).value.trim(),priority:document.getElementById("ld-e-priority-"+rowIndex).value,follow_up_date:document.getElementById("ld-e-followup-"+rowIndex).value||null,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq("id",rowIndex);
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
    positionACList(inp, lst);
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
  if (!info) { hint.innerHTML=`<span style="color:var(--g400);font-size:11px">Tidak ditemukan di Mekari Sign.</span>`; return; }
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
    const [{data,error},jubData,mekData] = await Promise.all([
      sb.from("popup_booths").select("*").order("event_date",{ascending:false}),
      _fetchAllPages("jubelio_sales_orders","salesorder_id,grand_total,note"),
      _fetchAllPages("mekari_esign_completions","message_id,subject,email_date",q=>q.order("email_date",{ascending:false}))
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
            <div class="fg" style="position:relative"><label>Surat Jalan</label><input type="text" id="pbe-sj-${r.rowIndex}" value="${(r.suratJalanUrl||'').replace(/"/g,'&quot;')}" placeholder="Pilih dari Mekari Sign" autocomplete="off" oninput="showPBSJInfo('pbe-sj-${r.rowIndex}','pbe-sj-hint-${r.rowIndex}')"><div class="ac-list" id="ac-pbe-sj-${r.rowIndex}"></div><div id="pbe-sj-hint-${r.rowIndex}"></div></div>
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
    rowIndex:r.salesorder_id, id:r.salesorder_id,
    salesorderId:r.salesorder_id!=null?String(r.salesorder_id):"",
    shippingFullName:r.shipping_full_name||"",
    transactionDate:r.transaction_date||"",
    internalStatus:r.internal_status||"",
    grandTotal:r.grand_total!=null?r.grand_total:"",
    locationName:r.location_name||"",
    note:r.note||""
  };
}

// Gudang yang di-exclude dari "offline sales" (online & event warehouse)
const JUB_EXCLUDE_LOCATIONS = ["Gudang Bintaro","Gudang Marte"];
const JUB_PAGE = 1000;

// Fetch all pages from jubelio_sales_orders with server-side filters applied
async function fetchJubPages(filters={}){
  const cols = "salesorder_id,salesorder_no,shipping_full_name,transaction_date,internal_status,grand_total,location_name,note";
  const excl = `(${JUB_EXCLUDE_LOCATIONS.map(l=>`"${l}"`).join(",")})`;
  let all=[], from=0;
  while(true){
    let q = sb.from("jubelio_sales_orders").select(cols)
      .not("location_name","in",excl)
      .order("transaction_date",{ascending:false})
      .range(from, from+JUB_PAGE-1);
    if(filters.location) q=q.eq("location_name",filters.location);
    if(filters.status)   q=q.eq("internal_status",filters.status);
    if(filters.from)     q=q.gte("transaction_date",filters.from);
    if(filters.to)       q=q.lte("transaction_date",filters.to+"T23:59:59");
    const {data,error}=await q;
    if(error) throw error;
    all=all.concat(data||[]);
    if(!data||data.length<JUB_PAGE) break;
    from+=JUB_PAGE;
  }
  return all;
}

async function loadJubSales() {
  const tbody = document.getElementById("jubTableBody");
  tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;
  try {
    const filters = {
      location: document.getElementById("jub-fil-location")?.value||"",
      status:   document.getElementById("jub-fil-status")?.value||"",
      from:     document.getElementById("jub-fil-from")?.value||"",
      to:       document.getElementById("jub-fil-to")?.value||""
    };
    const [jubRows, {data:pbData}] = await Promise.all([
      fetchJubPages(filters),
      sb.from("popup_booths").select("id_pesanan_jubelio,event_name")
    ]);
    allJubRows = jubRows.map(mapJub);
    // Build map: salesorder_id → event_name
    window._jubMappedToMap = {};
    (pbData||[]).forEach(r=>{
      if (r.id_pesanan_jubelio!=null && String(r.id_pesanan_jubelio).trim())
        window._jubMappedToMap[String(r.id_pesanan_jubelio).trim()] = r.event_name||"";
    });
    // Populate location + status dropdowns from loaded data (preserve selection)
    _populateJubDropdown("jub-fil-location", allJubRows.map(r=>r.locationName), "Semua Gudang");
    _populateJubDropdown("jub-fil-status",   allJubRows.map(r=>r.internalStatus), "Semua Status Transaksi");
    renderJubStats(allJubRows);
    applyJubFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function _populateJubDropdown(id, values, placeholder){
  const sel = document.getElementById(id);
  if(!sel) return;
  const prev = sel.value;
  const opts = [...new Set(values.filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${placeholder}</option>`
    + opts.map(v=>`<option value="${v}"${v===prev?" selected":""}>${v}</option>`).join("");
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

// Client-side only: mapped filter + text search on already-loaded rows
function applyJubFilters() {
  const mapFil = document.getElementById("jub-fil-mapped")?.value||"";
  const q = (document.getElementById("jubSearch")?.value||"").toLowerCase();
  let rows = allJubRows;
  if (mapFil==="mapped")   rows = rows.filter(r=>getJubMappedTo(r)!==null);
  else if (mapFil==="unmapped") rows = rows.filter(r=>getJubMappedTo(r)===null);
  if (q) rows = rows.filter(r=>
    (r.salesorderId||"").toLowerCase().includes(q)||
    (r.shippingFullName||"").toLowerCase().includes(q)||
    (r.internalStatus||"").toLowerCase().includes(q)||
    (r.locationName||"").toLowerCase().includes(q)
  );
  renderJubStats(rows);
  renderJubTable(rows);
}

function clearJubFilters() {
  ["jub-fil-location","jub-fil-status","jub-fil-from","jub-fil-to","jub-fil-mapped"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  const s=document.getElementById("jubSearch"); if(s) s.value="";
  loadJubSales();
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
    const [mekData,{data:pbData}] = await Promise.all([
      _fetchAllPages("mekari_esign_completions","*",q=>q.order("email_date",{ascending:false})),
      sb.from("popup_booths").select("surat_jalan_url,event_name")
    ]);
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
let allPORows=[], allPOItems=[], allPOBills=[], allPOBillItems=[], allPOReceives=[];
let allCPLinks=[];            // collection_po_links rows
let allCPLinkItems=[];        // collection_po_link_items rows
let cplItemsByLink={};        // link_id → Set<purchaseorder_detail_id>
let poToCollections={};       // purchaseorder_id → [collection_name, ...]
let colToPos={};              // collection_id → [{id, purchaseorder_id, purchaseorder_no, ...}, ...]
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
    itemId:r.item_id||null,
    itemCode:r.item_code||"",itemName:r.item_name||"",
    qty:r.qty!=null?Number(r.qty):null,unit:r.unit||"",
    price:r.price!=null?Number(r.price):null,
    amount:r.amount!=null?Number(r.amount):null
  };
}

const PO_PAGE = 1000;

async function fetchPOPages(filters={}){
  let all=[], from=0;
  while(true){
    let q = sb.from("jubelio_purchase_orders").select("*")
      .order("transaction_date",{ascending:false})
      .range(from, from+PO_PAGE-1);
    if(filters.status) q=q.eq("status",filters.status);
    if(filters.from)   q=q.gte("transaction_date",filters.from);
    if(filters.to)     q=q.lte("transaction_date",filters.to+"T23:59:59");
    const {data,error}=await q;
    if(error) throw error;
    all=all.concat(data||[]);
    if(!data||data.length<PO_PAGE) break;
    from+=PO_PAGE;
  }
  return all;
}

async function loadPO(){
  const tbody=document.getElementById("poTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="12">Memuat...</td></tr>`;
  try {
    const filters = {
      status: document.getElementById("po-fil-status")?.value||"",
      from:   document.getElementById("po-fil-from")?.value||"",
      to:     document.getElementById("po-fil-to")?.value||""
    };
    // POs with server-side filter+pagination; items/bills/receives load full (supplementary)
    const [poData,itemData,billData,billItemData,rcvData]=await Promise.all([
      fetchPOPages(filters),
      _fetchAllPages("jubelio_purchase_order_items","*",q=>q.order("purchaseorder_detail_id",{ascending:true})),
      _fetchAllPages("jubelio_purchase_bills"),
      _fetchAllPages("jubelio_purchase_bill_items"),
      _fetchAllPages("jubelio_purchase_receives")
    ]);
    allPORows=poData.map(mapPO);
    allPOItems=(itemData||[]).map(mapPOItem);
    allPOBills=(billData||[]);
    allPOBillItems=(billItemData||[]);
    allPOReceives=(rcvData||[]);
    await refreshCPLinks();
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

// Client-side only: text search on already-loaded rows
function applyPOFilters(){
  const q=(document.getElementById("poSearch")?.value||"").toLowerCase();
  let rows=allPORows;
  if(q) rows=rows.filter(r=>
    (r.purchaseorderNo||"").toLowerCase().includes(q)||
    (r.supplierName||"").toLowerCase().includes(q)||
    (r.locationName||"").toLowerCase().includes(q)||
    (r.note||"").toLowerCase().includes(q)
  );
  renderPOStats(rows);
  renderPOTable(rows);
}

function clearPOFilters(){
  ["po-fil-status","po-fil-from","po-fil-to"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("poSearch");if(s)s.value="";
  loadPO();
}

function renderPOTable(rows){
  rows=sortBy(rows,poSort.col,poSort.dir);
  updateSortTh("po-thead",poSort.col,poSort.dir);
  const tbody=document.getElementById("poTableBody");
  document.getElementById("po-tcount").textContent=rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="12">Tidak ada data.</td></tr>`;return;}
  const sPill=s=>{
    const c=s==="ACTIVE"?"p-signings":s==="COMPLETED"?"p-active":s==="CANCELLED"?"p-inactive":"p-draft";
    return `<span class="pill ${c}" style="font-size:11px">${s||"—"}</span>`;
  };
  const rPill=s=>{
    if(s==="Lunas") return `<span class="pill p-active" style="font-size:11px">Lunas</span>`;
    if(s==="Sebagian") return `<span class="pill p-review" style="font-size:11px">Sebagian</span>`;
    return `<span class="pill p-draft" style="font-size:11px">Belum</span>`;
  };
  tbody.innerHTML=rows.flatMap(r=>{
    const items=allPOItems.filter(i=>i.purchaseorderId===r.id);
    const bills=allPOBills.filter(b=>b.purchaseorder_id===r.id);
    // received qty per item (sum across all bills for this PO)
    const rcvdByDetailId={};
    bills.forEach(b=>{
      allPOBillItems.filter(bi=>bi.bill_id===b.bill_id).forEach(bi=>{
        const key=bi.purchaseorder_detail_id;
        rcvdByDetailId[key]=(rcvdByDetailId[key]||0)+(Number(bi.qty)||0);
      });
    });
    // receive status
    const totalPOQty=items.reduce((s,it)=>s+(it.qty||0),0);
    const totalRcvd=Object.values(rcvdByDetailId).reduce((s,v)=>s+v,0);
    const rcvStatus=bills.length===0?"Belum":totalRcvd>=totalPOQty?"Lunas":"Sebagian";
    const rcv=allPOReceives.find(rx=>rx.purchaseorder_no===r.purchaseorderNo);
    const rcvDate=rcv?new Date(rcv.transaction_date).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"2-digit"}):null;
    const gt=r.grandTotal!=null?`Rp ${Math.round(r.grandTotal).toLocaleString("id-ID")}`:"—";
    const dt=r.transactionDate?new Date(r.transactionDate).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—";
    const hasItems=items.length>0;
    const totalQty=items.reduce((s,it)=>s+(it.qty||0),0);
    const main=`<tr>
      <td style="text-align:center;cursor:${hasItems?"pointer":"default"};color:var(--g400);user-select:none" onclick="${hasItems?`togglePOItems(${r.id})`:""}" id="po-toggle-${r.id}">${hasItems?"▶":""}</td>
      <td><a href="https://v2.jubelio.com/purchase/orders/detail/${r.id}" target="_blank" style="font-family:var(--mono);font-size:12px;color:#3C3489;text-decoration:none">${r.purchaseorderNo||r.id}</a></td>
      <td style="font-size:13px">${r.supplierName||"—"}</td>
      <td>${sPill(r.status)}</td>
      <td style="white-space:nowrap">${rPill(rcvStatus)}${rcvDate?`<span style="font-size:10px;color:var(--g400);display:block;margin-top:2px">${rcvDate}</span>`:""}</td>
      <td style="white-space:nowrap;font-size:12px">${dt}</td>
      <td style="font-size:12px">${r.locationName||"—"}</td>
      <td style="white-space:nowrap;font-size:12px;font-weight:600">${gt}</td>
      <td style="font-size:12px;text-align:right;font-weight:600">${totalQty?totalQty.toLocaleString("id-ID"):"—"}</td>
      <td style="font-size:12px;color:var(--g400)">${items.length} item${items.length!==1?"s":""}</td>
      <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--g600)" title="${(r.note||"").replace(/"/g,"&quot;")}">${r.note||"—"}</td>
      <td style="font-size:11px">${(poToCollections[r.id]||[]).map(c=>`<span class="pill p-signings" style="font-size:10px;margin-right:3px">${c}</span>`).join("")||`<span style="color:var(--g400)">—</span>`}</td>
      <td style="font-size:11px;color:var(--g400);white-space:nowrap">${relTime(r.syncedAt)}</td>
    </tr>`;
    const detail=`<tr id="po-items-${r.id}" style="display:none;background:var(--off)">
      <td></td>
      <td colspan="12" style="padding:8px 12px 14px">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
            <th style="padding:4px 8px;text-align:left">Item Code</th>
            <th style="padding:4px 8px;text-align:left">Nama</th>
            <th style="padding:4px 8px;text-align:right">PO Qty</th>
            <th style="padding:4px 8px;text-align:right">Diterima</th>
            <th style="padding:4px 8px;text-align:left">Satuan</th>
            <th style="padding:4px 8px;text-align:right">Harga Satuan</th>
            <th style="padding:4px 8px;text-align:right">Total</th>
          </tr></thead>
          <tbody>${items.map(it=>{
            const rcvd=rcvdByDetailId[it.id]||0;
            const rcvdColor=rcvd===0?"color:var(--g400)":rcvd>=it.qty?"color:#2d8a4e":"color:#c0700a";
            return `<tr style="border-top:1px solid var(--g100)">
            <td style="padding:4px 8px;font-family:var(--mono);font-size:10px">${it.itemCode||"—"}</td>
            <td style="padding:4px 8px">${it.itemName||"—"}</td>
            <td style="padding:4px 8px;text-align:right">${it.qty!=null?Number(it.qty).toLocaleString("id-ID"):"—"}</td>
            <td style="padding:4px 8px;text-align:right;font-weight:600;${rcvdColor}">${rcvd?rcvd.toLocaleString("id-ID"):"—"}</td>
            <td style="padding:4px 8px">${it.unit||"—"}</td>
            <td style="padding:4px 8px;text-align:right">${it.price!=null?"Rp "+Math.round(it.price).toLocaleString("id-ID"):"—"}</td>
            <td style="padding:4px 8px;text-align:right;font-weight:600">${it.amount!=null?"Rp "+Math.round(it.amount).toLocaleString("id-ID"):"—"}</td>
          </tr>`;}).join("")}
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

async function refreshCPLinks(){
  const queries=[
    sb.from("collection_po_links").select("*"),
    sb.from("collection_po_link_items").select("*"),
  ];
  if(!allColRows.length) queries.push(sb.from("collections").select("id,collection_name"));
  const results=await Promise.all(queries);
  const [{data:links},{data:litems}]=results;
  // id → collection name: prefer full allColRows, fallback to minimal fetch
  const colNameMap={};
  if(allColRows.length) allColRows.forEach(r=>{ colNameMap[r.id]=r.collectionName; });
  else (results[2]?.data||[]).forEach(r=>{ colNameMap[r.id]=r.collection_name; });
  allCPLinks=links||[];
  allCPLinkItems=litems||[];
  // rebuild cplItemsByLink: link_id → Set<purchaseorder_detail_id>
  cplItemsByLink={};
  allCPLinkItems.forEach(r=>{
    if(!cplItemsByLink[r.link_id]) cplItemsByLink[r.link_id]=new Set();
    cplItemsByLink[r.link_id].add(r.purchaseorder_detail_id);
  });
  // purchaseorder_id → collection names
  poToCollections={};
  colToPos={};
  allCPLinks.forEach(lnk=>{
    const colName=colNameMap[lnk.collection_id];
    const col=colName?{collectionName:colName}:allColRows.find(r=>r.id===lnk.collection_id);
    const po=allPORows.find(r=>r.id===lnk.purchaseorder_id);
    if(col){
      if(!poToCollections[lnk.purchaseorder_id]) poToCollections[lnk.purchaseorder_id]=[];
      poToCollections[lnk.purchaseorder_id].push(col.collectionName);
    }
    if(!colToPos[lnk.collection_id]) colToPos[lnk.collection_id]=[];
    colToPos[lnk.collection_id].push({linkId:lnk.id, poId:lnk.purchaseorder_id, expectedDate:lnk.expected_date||"", po});
  });
}

async function addCPLink(colId, poId){
  if(!poId||!colId) return;
  const exists=allCPLinks.find(l=>l.collection_id===colId&&l.purchaseorder_id==poId);
  if(exists) return;
  const id=genId("CPL");
  const{error}=await sb.from("collection_po_links").insert({id,collection_id:colId,purchaseorder_id:Number(poId),added_by:currentUser,added_at:new Date().toISOString()});
  if(error) throw error;
  await refreshCPLinks();
}

async function removeCPLink(linkId, colId){
  const{error}=await sb.from("collection_po_links").delete().eq("id",linkId);
  if(error) throw error;
  await refreshCPLinks();
  renderColPOLinks(colId);
}

// Helper: call a Supabase edge function with anon key auth
async function callEdgeFunction(slug, body={}){
  let r;
  try {
    r=await fetch(`${SUPABASE_URL}/functions/v1/${slug}`,{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON,"Authorization":`Bearer ${SUPABASE_ANON}`},
      body:JSON.stringify(body)
    });
  } catch(netErr){
    throw new Error(`Network error: ${netErr.message}`);
  }
  let j;
  try { j=await r.json(); } catch(_){ j={}; }
  if(!r.ok||j.ok===false) throw new Error(j.error||`HTTP ${r.status}`);
  return j;
}

async function syncPONow(){
  const btn=document.getElementById("po-sync-btn");
  const se=document.getElementById("po-sync-status");
  const now=Date.now();
  if(now<_poSyncCooldown){
    if(se) se.textContent=`Tunggu ${Math.ceil((_poSyncCooldown-now)/1000)}s lagi.`;
    return;
  }
  if(btn){btn.disabled=true;btn.textContent="⟳ Syncing...";}
  if(se) se.textContent="Menghubungi Jubelio...";
  try {
    const j=await callEdgeFunction("sync-jubelio-purchase-orders");
    _poSyncCooldown=Date.now()+60000;
    if(se) se.textContent=`✓ ${j.headersUpserted||j.listed||0} PO, ${j.itemsUpserted||0} items diperbarui`;
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

// ── PRODUCT MAPPING ──
let allPMRows=[];
let pmPage=0, pmSearchQuery='';
let pmSort={col:'jubelio_item_id',dir:'desc'};
let pmFilters={brand:'',ip:'',collection:'',mappingCount:''};
const PM_PAGE_SIZE=20;
let _pmSearchTimer=null;
let allColNames=[];

function onPMSearch(val){
  clearTimeout(_pmSearchTimer);
  _pmSearchTimer=setTimeout(()=>loadProductMap(0,val.trim()),300);
}

function sortPMBy(col){
  pmSort.dir=pmSort.col===col?(pmSort.dir==='asc'?'desc':'asc'):'asc';
  pmSort.col=col;
  loadProductMap(0,pmSearchQuery);
}

function applyPMFilters(){
  pmFilters.brand=document.getElementById("pm-fil-brand")?.value||'';
  pmFilters.ip=document.getElementById("pm-fil-ip")?.value||'';
  pmFilters.collection=document.getElementById("pm-fil-collection")?.value||'';
  pmFilters.mappingCount=document.getElementById("pm-fil-mapping")?.value??'';
  loadProductMap(0,pmSearchQuery);
}

function clearPMFilters(){
  pmFilters={brand:'',ip:'',collection:'',mappingCount:''};
  pmSearchQuery='';
  ['pm-fil-brand','pm-fil-ip','pm-fil-collection','pm-fil-mapping'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const s=document.getElementById("pm-search"); if(s) s.value='';
  loadProductMap(0,'');
}

function populatePMFilters(){
  const bSel=document.getElementById("pm-fil-brand");
  const iSel=document.getElementById("pm-fil-ip");
  const cSel=document.getElementById("pm-fil-collection");
  if(bSel && bSel.options.length<=1){
    const brands=[...new Set([...allBMRows.map(r=>r.name)].filter(Boolean))].sort();
    brands.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;bSel.appendChild(o);});
  }
  if(iSel && iSel.options.length<=1){
    const ips=[...new Set(allIPRows.map(r=>r.name).filter(Boolean))].sort();
    ips.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;iSel.appendChild(o);});
  }
  if(cSel && cSel.options.length<=1){
    allColNames.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;cSel.appendChild(o);});
  }
}

function mapPM(r){
  return {id:r.id,itemName:r.item_name||"",brand:r.brand||"",ip:r.ip||"",
    royaltyRecipient:r.royalty_recipient||"",collection:r.collection||"",
    jubItemId:r.jubelio_item_id||null};
}

async function loadProductMap(page=0, search=''){
  pmPage=page; pmSearchQuery=search;
  const tbody=document.getElementById("pmTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;
  try {
    if(!allBMRows.length){const{data}=await sb.from("brand_master").select("id,name").order("name");allBMRows=(data||[]).map(mapBM);}
    if(!allIPRows.length){const{data}=await sb.from("ip_master").select("id,name").order("name");allIPRows=(data||[]).map(mapIP);}
    if(!allRRRows.length){const{data}=await sb.from("royalty_recipients").select("id,nama").order("nama");allRRRows=(data||[]).map(mapRR);}
    if(!allColNames.length){
      const{data:colData}=await sb.from("collections").select("collection_name").order("collection_name");
      allColNames=(colData||[]).map(r=>r.collection_name).filter(Boolean);
      updatePMColDatalist();
    }
    populatePMFilters();
    const from=page*PM_PAGE_SIZE, to=from+PM_PAGE_SIZE-1;
    const isUnmapped=q=>q.is("brand",null).is("ip",null).is("royalty_recipient",null).is("collection",null);
    const isMapped=q=>q.or("brand.not.is.null,ip.not.is.null,royalty_recipient.not.is.null,collection.not.is.null");
    const hasFilter=search||pmFilters.brand||pmFilters.ip||pmFilters.collection||pmFilters.mappingCount!=='';
    const applyFilter=q=>{
      if(!hasFilter) return isUnmapped(q);
      if(search) q=q.ilike("item_name",`%${search}%`);
      if(pmFilters.brand) q=q.eq("brand",pmFilters.brand);
      if(pmFilters.ip) q=q.eq("ip",pmFilters.ip);
      if(pmFilters.collection) q=q.eq("collection",pmFilters.collection);
      if(pmFilters.mappingCount==='unmapped') q=isUnmapped(q);
      if(pmFilters.mappingCount==='mapped') q=isMapped(q);
      return q;
    };
    const [
      {data:rows,count:filteredCount,error:rowsErr},
      {count:totalCount},
      {count:unmappedCount}
    ]=await Promise.all([
      applyFilter(sb.from("product_mappings").select("*",{count:"exact"}))
        .order(pmSort.col,{ascending:pmSort.dir==='asc'}).range(from,to),
      sb.from("product_mappings").select("*",{count:"exact",head:true}),
      isUnmapped(sb.from("product_mappings").select("*",{count:"exact",head:true}))
    ]);
    if(rowsErr) throw rowsErr;
    allPMRows=(rows||[]).map(mapPM);
    // De-duplicate by item_name; track variant count per product
    const pmByName={};
    allPMRows.forEach(r=>{
      if(!pmByName[r.itemName]){pmByName[r.itemName]={...r,variantCount:0};}
      pmByName[r.itemName].variantCount++;
    });
    const uniqueNames=Object.keys(pmByName);
    document.getElementById("pm-s-total").textContent=totalCount||0;
    document.getElementById("pm-s-mapped").textContent=(totalCount||0)-(unmappedCount||0);
    document.getElementById("pm-s-unmapped").textContent=unmappedCount||0;
    const activeFilters=[search&&`"${search}"`,pmFilters.brand,pmFilters.ip,pmFilters.collection,pmFilters.mappingCount!==''&&`mapping ${pmFilters.mappingCount}/3`].filter(Boolean);
    const uniqueCount=uniqueNames.length;
    document.getElementById("pm-tcount").textContent=hasFilter
      ? `${uniqueCount} produk${activeFilters.length?` · ${activeFilters.join(" · ")}`:""}`
      : `${unmappedCount||0} belum mapped`;
    renderPMTable(uniqueNames,pmByName);
    renderPMPagination(page,uniqueCount);
    renderPMSortHeaders();
  } catch(e){
    if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Gagal: ${e.message||e}</td></tr>`;
  }
}

function updatePMColDatalist(){
  const dl=document.getElementById("pm-col-datalist");
  if(!dl) return;
  dl.innerHTML=allColNames.map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('');
}

function renderPMSortHeaders(){
  ['jubelio_item_id','item_name','brand','ip'].forEach(col=>{
    const el=document.getElementById(`pm-sort-${col}`);
    if(el) el.textContent=pmSort.col===col?(pmSort.dir==='asc'?'↑':'↓'):'';
  });
}

function renderPMPagination(page,total){
  const el=document.getElementById("pm-pagination");
  if(!el) return;
  const totalPages=Math.ceil(total/PM_PAGE_SIZE);
  if(totalPages<=1){el.innerHTML='';return;}
  const esc=pmSearchQuery.replace(/'/g,"\\'");
  el.innerHTML=`
    <button class="btn-ghost" style="padding:4px 12px;font-size:12px" onclick="loadProductMap(${page-1},'${esc}')" ${page===0?'disabled':''}>← Prev</button>
    <span style="font-size:12px;color:var(--g400);font-family:var(--mono)">${page+1} / ${totalPages}</span>
    <button class="btn-ghost" style="padding:4px 12px;font-size:12px" onclick="loadProductMap(${page+1},'${esc}')" ${page>=totalPages-1?'disabled':''}>Next →</button>
  `;
}

function renderPMTable(uniqueNames, pmByName){
  const tbody=document.getElementById("pmTableBody");
  if(!tbody) return;
  if(!uniqueNames.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="7">Tidak ada produk.</td></tr>`;return;}
  const bmOpts=allBMRows.map(r=>`<option value="${(r.name||"").replace(/"/g,"&quot;")}">${r.name}</option>`).join("");
  const ipOpts=allIPRows.map(r=>`<option value="${(r.name||"").replace(/"/g,"&quot;")}">${r.name}</option>`).join("");
  const rrOpts=allRRRows.map(r=>`<option value="${(r.name||r.rowIndex||"").replace(/"/g,"&quot;")}">${r.name||r.rowIndex}</option>`).join("");
  tbody.innerHTML=uniqueNames.map(name=>{
    const m=pmByName[name]||{brand:"",ip:"",royaltyRecipient:"",collection:"",jubItemId:null};
    const esc=name.replace(/"/g,"&quot;").replace(/'/g,"\\'");
    const sel=(opts,val,field)=>`<select onchange="savePMField('${esc}','${field}',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--g100);border-radius:4px;width:100%;background:var(--white)"><option value=""></option>${opts.replace(`value="${(val||"").replace(/"/g,"&quot;")}"`,`value="${(val||"").replace(/"/g,"&quot;")}" selected`)}</select>`;
    const safeId=btoa(unescape(encodeURIComponent(name))).replace(/[^a-zA-Z0-9]/g,'');
    return `<tr style="border-top:1px solid var(--g100)">
      <td style="padding:8px 6px;font-size:11px;color:var(--g400);text-align:center;white-space:nowrap">${m.variantCount>1?`<span title="Item ID: ${m.jubItemId||'?'}">${m.variantCount} var</span>`:(m.jubItemId||'—')}</td>
      <td style="padding:8px 10px;font-size:12px;max-width:220px">${name.replace(/</g,"&lt;")}</td>
      <td style="padding:6px 8px;min-width:130px">${sel(bmOpts,m.brand,"brand")}</td>
      <td style="padding:6px 8px;min-width:130px">${sel(ipOpts,m.ip,"ip")}</td>
      <td style="padding:6px 8px;min-width:130px">${sel(rrOpts,m.royaltyRecipient,"royalty_recipient")}</td>
      <td style="padding:6px 8px;min-width:150px"><input type="text" list="pm-col-datalist" value="${(m.collection||"").replace(/"/g,"&quot;")}" placeholder="Pilih atau ketik baru..." style="font-size:11px;padding:3px 8px;border:1px solid var(--g100);border-radius:4px;width:100%;box-sizing:border-box" onblur="savePMField('${esc}','collection',this.value)" onkeydown="if(event.key==='Enter')this.blur()"></td>
      <td style="padding:6px 8px;text-align:center" id="pm-status-${safeId}">
        ${m.brand||m.ip||m.royaltyRecipient||m.collection?'<span class="pill p-active" style="font-size:10px">Mapped</span>':'<span style="color:var(--g400);font-size:11px">—</span>'}
      </td>
    </tr>`;
  }).join("");
}

async function savePMField(itemName, field, value){
  const existing=allPMRows.find(r=>r.itemName===itemName);
  try {
    const upd={updated_at:new Date().toISOString(),updated_by:currentUser};
    upd[field]=value||null;
    // Sync corresponding ID column
    if(field==='brand'){
      const bm=allBMRows.find(r=>r.name===value);
      upd.brand_master_id=bm?bm.rowIndex:null;
    } else if(field==='ip'){
      const im=allIPRows.find(r=>r.name===value);
      upd.ip_master_id=im?im.rowIndex:null;
    } else if(field==='royalty_recipient'){
      const rr=allRRRows.find(r=>(r.name||r.rowIndex)===value);
      upd.royalty_recipient_id=rr?rr.rowIndex:null;
    } else if(field==='collection' && value && !allColNames.includes(value)){
      await sb.from("collections").insert({id:genId("COL"),collection_name:value,added_by:currentUser,date_added:new Date().toISOString()});
      allColNames.push(value); allColNames.sort(); updatePMColDatalist();
    }
    await sb.from("product_mappings").update(upd).eq("item_name",itemName);
    // Update ALL local rows with same item_name (variants)
    allPMRows.filter(r=>r.itemName===itemName).forEach(r=>{
      if(field==='brand') r.brand=value;
      else if(field==='ip') r.ip=value;
      else if(field==='royalty_recipient') r.royaltyRecipient=value;
      else if(field==='collection') r.collection=value;
    });
    // Refresh status cell
    const safeId=btoa(unescape(encodeURIComponent(itemName))).replace(/[^a-zA-Z0-9]/g,'');
    const cell=document.getElementById(`pm-status-${safeId}`);
    const r=existing||{};
    if(cell) cell.innerHTML=(r.brand||r.ip||r.royaltyRecipient||r.collection)
      ?'<span class="pill p-active" style="font-size:10px">Mapped</span>'
      :'<span style="color:var(--g400);font-size:11px">—</span>';
    // Refresh unmapped count
    const{count:uc}=await sb.from("product_mappings").select("*",{count:"exact",head:true}).is("brand",null).is("ip",null).is("royalty_recipient",null).is("collection",null);
    const tot=parseInt(document.getElementById("pm-s-total").textContent)||0;
    document.getElementById("pm-s-mapped").textContent=tot-(uc||0);
    document.getElementById("pm-s-unmapped").textContent=uc||0;
  } catch(e){console.error("savePMField:",e);}
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
    pic:r.pic||"", notes:r.notes||"", dateAdded:r.date_added||"", addedBy:r.added_by||"",
    samplingDriveUrl:r.sampling_drive_url||""
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
const COL_STAGE_NAMES = ["inbound","photoshoot","content","ads","kol","offline_activation","marketing_config"];
const COL_STAGE_LABELS = {inbound:"Inbound",photoshoot:"Photoshoot",content:"Content",ads:"Ads",kol:"KOL",offline_activation:"Offline Activation",marketing_config:"Config"};
const MKT_ACTIVITIES = [
  {key:"photoshoot",    label:"Photoshoot", icon:"📸"},
  {key:"content",       label:"Content",    icon:"📱"},
  {key:"ads",           label:"Ads",        icon:"📢"},
  {key:"kol",           label:"KOL",        icon:"🌟"},
  {key:"offline_activation", label:"Offline", icon:"🛍️"},
];

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
      sb.from("designer_workflow").select("*").not("collection_id","is",null),
      sb.from("collection_stages").select("*")
    ];
    if(!allDsgRows.length) fetches.push(sb.from("designer_master").select("*").order("name"));
    const results=await Promise.all(fetches);
    const [{data,error},{data:ciData},{data:dwData},{data:csData}]=results;
    if(error)throw error;
    allColRows=(data||[]).map(mapCol);
    allColItems=(ciData||[]).map(mapCI);
    allColStages=(csData||[]).map(mapCS);
    if(results[4]?.data) allDsgRows=results[4].data.map(mapDsg);
    // Populate allDwRows with full data (payment, URL, agreement, etc.)
    allDwRows=(dwData||[]).filter(r=>r.locked).map(r=>{
      const row=mapDw(r);
      const col=allColRows.find(c=>c.id===r.collection_id);
      row.collectionName=col?col.collectionName:"";
      if(!row.projectName&&row.collectionName) row.projectName=row.collectionName;
      return row;
    });
    const dwCheck=dwData; // used by ensureDWProjects below
    // Ensure PO data available for the link dropdown + production cards
    const poFetches=[];
    if(!allPORows.length) poFetches.push(_fetchAllPages("jubelio_purchase_orders","*",q=>q.order("transaction_date",{ascending:false})));
    if(!allPOItems.length) poFetches.push(_fetchAllPages("jubelio_purchase_order_items"));
    if(!allPOBills.length) poFetches.push(_fetchAllPages("jubelio_purchase_bills"));
    if(!allPOBillItems.length) poFetches.push(_fetchAllPages("jubelio_purchase_bill_items"));
    if(!allPOReceives.length) poFetches.push(_fetchAllPages("jubelio_purchase_receives"));
    if(poFetches.length){
      const poResults=await Promise.all(poFetches);
      let pi=0;
      if(!allPORows.length&&poFetches[pi]) { allPORows=(poResults[pi]||[]).map(mapPO); pi++; }
      if(!allPOItems.length&&poFetches[pi]) { allPOItems=(poResults[pi]||[]).map(mapPOItem); pi++; }
      if(!allPOBills.length&&poFetches[pi]) { allPOBills=poResults[pi]||[]; pi++; }
      if(!allPOBillItems.length&&poFetches[pi]) { allPOBillItems=poResults[pi]||[]; pi++; }
      if(!allPOReceives.length&&poFetches[pi]) { allPOReceives=poResults[pi]||[]; }
    }
    setupAC("col-ip","ac-col-ip",()=>allIPRows.map(r=>r.name).filter(Boolean));
    setupAC("col-pic","ac-col-pic",()=>[...new Set(allColRows.map(r=>r.pic).filter(Boolean))]);
    // Auto-create DW projects + stage placeholders for any collection missing them (background)
    ensureDWProjects(allColRows, dwCheck||[]);
    ensureColStages(allColRows, csData||[]);
    // Restore collection detail from URL slug
    const hashParts=location.hash.slice(1).split("/");
    if(hashParts[0]==="collections"&&hashParts[1]){
      const col=allColRows.find(r=>slugifyCol(r.collectionName)===hashParts[1]);
      if(col){openCollectionDetail(col.id);return;}
    }
    await refreshCPLinks();
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
    // Only create rows for collections that have designers assigned; skip blanks
    if(!designers.length) continue;
    for(const designer of designers){
      const key=`${col.id}|${designer}`;
      if(existingKeys.has(key)) continue;
      try{
        const dwId=genId("DW");
        const {error}=await sb.from("designer_workflow").insert({
          id:dwId, collection_id:col.id,
          project_name:col.collectionName,
          designer:designer||null,
          payment_status:"No Fee", locked:true,
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
            paymentStatus:"No Fee",locked:true,
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
    .select("*").eq("collection_id",colId);
  // Sync allDwRows for this collection with fresh DB data
  allDwRows=allDwRows.filter(r=>r.collectionId!==colId);
  (data||[]).filter(r=>r.locked).forEach(r=>{
    const row=mapDw(r);
    row.collectionName=col.collectionName;
    if(!row.projectName) row.projectName=col.collectionName;
    allDwRows.push(row);
  });
  await ensureDWProjects([col], data||[]);
}

// Sync DW rows for a collection: delete orphaned designers, create missing ones
async function syncDWForCollection(colId) {
  const col=allColRows.find(r=>r.id===colId);
  if(!col) return;
  const currentDesigners=new Set(
    allColItems.filter(i=>i.collectionId===colId&&i.designer).map(i=>i.designer)
  );
  // Delete DW rows for designers no longer assigned to any SKU in this collection
  const orphans=allDwRows.filter(r=>r.collectionId===colId&&r.locked&&r.designer&&!currentDesigners.has(r.designer));
  for(const dw of orphans){
    try {
      await sb.from("designer_workflow").delete().eq("id",dw.id);
      allDwRows=allDwRows.filter(r=>r.id!==dw.id);
    } catch(e){/* silent */}
  }
  // Create rows for new designers
  await ensureDWForCollection(colId);
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
  // Design: SKU approval_status is primary source; DW deliverables as fallback
  const dwRows=allDwRows.filter(r=>r.collectionId===colId&&r.locked);
  let design="not-started";
  if(items.length){
    if(items.every(i=>i.approvalStatus==="Approved")) design="done";
    else if(items.some(i=>i.approvalStatus==="Approved"||i.approvalStatus==="Revision")) design="in-progress";
    else if(dwRows.length){
      const dlStats=dwRows.map(r=>computeColDeliverableStatus(r.collectionId,r.designer));
      if(dlStats.every(s=>s==="Approved")) design="done";
      else if(dlStats.some(s=>s&&s!=="Not Approved")) design="in-progress";
    } else if(items.some(i=>i.designer)) design="in-progress";
  } else if(dwRows.length){
    const dlStats=dwRows.map(r=>computeColDeliverableStatus(r.collectionId,r.designer));
    if(dlStats.every(s=>s==="Approved")) design="done";
    else if(dlStats.some(s=>s&&s!=="Not Approved")) design="in-progress";
  }
  // Sampling
  let sampling="not-started";
  if(items.length){
    if(items.every(i=>i.samplingStatus==="Done")) sampling="done";
    else if(items.some(i=>i.samplingStatus==="In Progress"||i.samplingStatus==="Done")) sampling="in-progress";
  }
  // Production — driven by linked PO putaway status
  let production="not-started";
  const poLinks=colToPos[colId]||[];
  if(poLinks.length){
    const allPutaway=poLinks.every(({poId})=>allPOBills.some(b=>b.purchaseorder_id===poId&&b.is_putaway===true));
    production=allPutaway?"done":"in-progress";
  }
  const getStage=s=>stages.find(r=>r.stage===s)?.status||"Not Started";
  const stageToKey=s=>s==="Done"?"done":s==="In Progress"?"in-progress":"not-started";
  const inbound=stageToKey(getStage("inbound"));
  const mktEnabled=getMktEnabled(colId);
  const mktActKeys=MKT_ACTIVITIES.filter(a=>mktEnabled.includes(a.key)).map(a=>a.key);
  let marketing="not-started";
  if(!mktActKeys.length){
    marketing="done";
  } else {
    const mkt=mktActKeys.map(s=>getStage(s));
    if(mkt.every(s=>s==="Done")) marketing="done";
    else if(mkt.some(s=>s==="In Progress"||s==="Done")) marketing="in-progress";
  }
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
  const _slug=slugifyCol(col.collectionName);
  history.replaceState(null,"",`#collections/${_slug}`);
  sessionStorage.setItem('snt_page','collections');
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
  else if(stage==="production"){const pl=colToPos[colId]||[];s=pl.length?(pl.every(({poId})=>allPOBills.some(b=>b.purchaseorder_id===poId&&b.is_putaway===true))?"Done":"In Progress"):"Not Started";}
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
  const _today=new Date(); _today.setHours(0,0,0,0);
  const skuRows=items.map(i=>{
    // Preview: SKU's own designPreviewUrl first, fall back to DW deliverables link for this designer
    const dwLink=colDwRows.find(r=>r.designer===i.designer)?.deliverablesUrl||"";
    const previewUrl=i.designPreviewUrl||dwLink;
    // Deadline coloring: red if past and not yet Approved
    const dlPast=i.deadline&&new Date(i.deadline+"T00:00:00")<_today&&i.approvalStatus!=="Approved";
    const dlStyle=`padding:8px 10px;white-space:nowrap;${dlPast?"color:#c0392b;font-weight:600":""}`;
    return `<tr id="ci-row-${i.id}" style="border-top:1px solid var(--g100)">
    <td style="padding:8px 10px"><strong style="font-size:13px">${i.skuName}</strong></td>
    <td style="padding:8px 10px">${i.category?`<span class="pill p-signings" style="font-size:10px">${i.category}</span>`:`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
    <td style="padding:8px 10px;color:var(--g600)">${i.designer||"—"}</td>
    <td style="${dlStyle}">${dlPast?"⚠ ":""}${fmtDate(i.deadline)||"—"}</td>
    <td style="padding:8px 10px">${previewUrl?`<a href="${previewUrl}" target="_blank" style="color:#3C3489;text-decoration:none">↗ Design</a>`:`<span style="color:var(--g400);font-size:11px">—</span>`}</td>
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

  // ── Production: PO cards ──
  const productionContent=renderColPOCards(col.id);


  // ── Pipeline bar ──
  const ps=getPipelineStatuses(col.id);
  const pipeStages=[["design","Design"],["sampling","Sampling"],["production","Prod & Inbound"],["marketing","Marketing"]];
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
          </table></div>`:`<div style="color:var(--g400);font-size:12px">Belum ada SKU. Tambah di atas.</div>`}
          ${colDwRows.filter(dw=>dw.designer).length?`
          <div style="margin-top:14px;border-top:1px solid var(--g100);padding-top:12px">
            <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Designer Payment</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${colDwRows.filter(dw=>dw.designer).map(dw=>{
                const payClr=dw.paymentStatus==="Paid"?"background:#edf8ee;color:#1a5c25;border-color:#90d4a0":dw.paymentStatus==="Not Yet Paid"?"background:#fff3e0;color:#8a4000;border-color:#ffcc80":"background:#f0efe9;color:#5a5850;border-color:#d4d3cb";
                return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--g100);border-radius:6px;background:var(--off)">
                  <span style="font-size:12px;font-weight:600;color:var(--g600)">${dw.designer}</span>
                  <select onchange="updateDwPaymentFromCD('${dw.id}',this.value)" style="font-size:11px;padding:2px 8px;border:1px solid;border-radius:99px;${payClr}">
                    <option value="No Fee"${dw.paymentStatus==="No Fee"?" selected":""}>No Fee</option>
                    <option value="Not Yet Paid"${dw.paymentStatus==="Not Yet Paid"?" selected":""}>Not Yet Paid</option>
                    <option value="Paid"${dw.paymentStatus==="Paid"?" selected":""}>Paid</option>
                  </select>
                  <div style="position:relative;display:inline-block">
                    <input type="text" id="cd-dw-agr-${dw.id}" value="${(dw.agreementId||"").replace(/"/g,"&quot;")}" placeholder="PKS / Kontrak" autocomplete="off" style="font-size:11px;font-family:var(--mono);padding:3px 8px;border:1px solid var(--g200);border-radius:4px;width:180px" onblur="saveDwAgreementFromCD('${dw.id}',this.value)">
                    <div class="ac-list" id="ac-cd-dw-agr-${dw.id}"></div>
                  </div>
                </div>`;
              }).join("")}
            </div>
          </div>`:""}
          `)}
        <!-- Sampling -->
        ${cdStageBox("🧵","Sampling",`
          ${cdStageBadge(items.length?items.every(i=>i.samplingStatus==="Done")?"Done":items.some(i=>i.samplingStatus!=="Not Started")?"In Progress":"Not Started":"Not Started",`col-sampling-badge-${col.id}`)}
          <div id="sl-disp-${col.id}" style="display:inline-flex;align-items:center;gap:4px;margin-left:4px">
            ${col.samplingDriveUrl
              ?`<a href="${col.samplingDriveUrl}" target="_blank" style="font-size:11px;color:#3C3489;text-decoration:none;font-family:'DM Mono',monospace">↗ Drive</a>
                <button class="btn-icon" style="font-size:10px" onclick="openSamplingLink('${col.id}')">✏</button>`
              :`<button class="btn-icon" style="font-size:10px" onclick="openSamplingLink('${col.id}')">+ Drive</button>`}
          </div>
          <div id="sl-edit-${col.id}" style="display:none;align-items:center;gap:4px;margin-left:4px">
            <input type="url" id="sl-inp-${col.id}" value="${(col.samplingDriveUrl||"").replace(/"/g,"&quot;")}"
              placeholder="https://drive.google.com/..."
              style="font-size:11px;padding:2px 6px;border:1px solid var(--g200);border-radius:4px;width:200px"
              onblur="saveSamplingLink('${col.id}',this.value)"
              onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){document.getElementById('sl-edit-${col.id}').style.display='none';document.getElementById('sl-disp-${col.id}').style.display='inline-flex';}">
          </div>`,samplingContent)}
        <!-- Production -->
        ${(()=>{
          const poLinks=colToPos[col.id]||[];
          let prodStatus="Not Started";
          if(poLinks.length){
            // Done = all linked POs have at least one bill with is_putaway=true
            const allPutaway=poLinks.every(({poId})=>allPOBills.some(b=>b.purchaseorder_id===poId&&b.is_putaway===true));
            prodStatus=allPutaway?"Done":"In Progress";
          }
          return cdStageBox("🏭","Production & Inbound",cdStageBadge(prodStatus,`col-production-badge-${col.id}`),`
          <div id="col-production-body-${col.id}">
            ${productionContent}
          </div>`);
        })()}
        <!-- Marketing -->
        ${cdStageBox("📣","Marketing",cdStageBadge(ps.marketing==="done"?"Done":ps.marketing==="in-progress"?"In Progress":"Not Started",`col-marketing-badge-${col.id}`),`
          <div id="col-mkt-body-${col.id}">${renderMktBodyHTML(col.id)}</div>`)}
        <!-- Product Performance -->
        ${cdStageBox("📊","Product Performance","",`<div id="col-perf-${col.id}" style="color:var(--g400);font-size:12px">Memuat...</div>`)}
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
  colDwRows.filter(dw=>dw.designer).forEach(dw=>{
    setupAC(`cd-dw-agr-${dw.id}`,`ac-cd-dw-agr-${dw.id}`,()=>acAgrOptions.map(o=>o.id),()=>acAgrOptions);
  });
  loadColSidebar(col.id);
  setupNoteAC(col.id);
  loadColProductPerf(col.id, col.collectionName);
}

const SIZE_ORDER = ['XS','S','M','L','XL','XXL','XXXL','XXXXL','4XL','5XL','FREE SIZE','FREE'];
const _colPerfCache = {};

async function printColPerf(colId) {
  const d = _colPerfCache[colId];
  if (!d) return;
  const { colName, products, grandStock, grandSold, grandAdj, grandRevenue, grandDiscount, grandSubtotal, hasDiscount, str, strClr, adjStr, adjClr, avgPerDay, fds, itemIds } = d;

  // Convert thumbnails to base64 so they render correctly in the print window (avoids CORS block)
  const thumbUrls = [...new Set(products.map(p => p.thumbnail).filter(Boolean))];
  const b64Map = {};
  await Promise.all(thumbUrls.map(async url => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      b64Map[url] = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch(e) {}
  }));

  const fmtRp = n => n ? "Rp " + Math.round(n).toLocaleString("id-ID") : "—";
  const metricBox = (lbl, val, clr) => `
    <div style="border:1px solid #e5e5e5;border-radius:6px;padding:10px 14px;min-width:90px">
      <div style="font-family:monospace;font-size:9px;text-transform:uppercase;color:#888;margin-bottom:4px">${lbl}</div>
      <div style="font-weight:700;font-size:12px;color:${clr}">${val}</div>
    </div>`;
  const rows = products.map(p => {
    const iStr  = (p.totalSold + p.totalStock) > 0 ? ((p.totalSold / (p.totalSold + p.totalStock)) * 100).toFixed(0) + "%" : "—";
    const iSClr = iStr !== "—" ? (parseFloat(iStr) >= 70 ? "#2d7a2d" : parseFloat(iStr) >= 30 ? "#e67e00" : "#c0392b") : "#888";
    const iAStr = p.totalAdj > 0 ? `+${Math.round(p.totalAdj)}` : `${Math.round(p.totalAdj)}`;
    const iAClr = p.totalAdj > 0 ? "#2d7a2d" : p.totalAdj < 0 ? "#c0392b" : "#888";
    const sizePills = p.variants
      .sort((a, b) => { const ai=SIZE_ORDER.indexOf(a.size.toUpperCase()), bi=SIZE_ORDER.indexOf(b.size.toUpperCase()); return (ai===-1?99:ai)-(bi===-1?99:bi); })
      .map(v => {
        const broken = v.stock === 0;
        return `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-family:monospace;color:${broken?"#c0392b":"#2d7a2d"};background:${broken?"#fdecea":"#edf8ee"};margin:1px 1px 0 0">${v.size}</span>`;
      }).join("");
    const imgSrc = p.thumbnail ? (b64Map[p.thumbnail] || p.thumbnail) : null;
    const thumbHTML = imgSrc
      ? `<img src="${imgSrc}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #eee">`
      : `<div style="width:48px;height:48px;border-radius:4px;border:1px solid #eee;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
    return `<tr style="border-top:1px solid #eee">
      <td style="padding:8px;vertical-align:middle">${thumbHTML}</td>
      <td style="padding:8px 10px;font-size:12px;vertical-align:middle"><div style="font-weight:500;margin-bottom:3px">${p.name}</div><div>${sizePills}</div></td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;vertical-align:middle;color:#888">${p.price ? fmtRp(p.price) : "—"}</td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:12px;vertical-align:middle;${p.totalStock===0&&p.totalSold>0?"color:#c0392b":""}">${Math.round(p.totalStock)}</td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:12px;vertical-align:middle;color:${iAClr}">${iAStr}</td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:12px;vertical-align:middle">${Math.round(p.totalSold)}</td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:12px;vertical-align:middle;color:${iSClr}">${iStr}</td>
      <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;vertical-align:middle;color:#2d7a2d">${fmtRp(p.totalRevenue)}</td>
      ${hasDiscount ? `<td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;vertical-align:middle;color:#c0392b">${p.totalDiscount > 0 ? "-"+fmtRp(p.totalDiscount) : "—"}</td><td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;vertical-align:middle;color:#2d7a2d;border-left:2px solid #eee">${fmtRp(p.totalRevenue - p.totalDiscount)}</td>` : ""}
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Product Performance — ${colName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'DM Sans',Arial,sans-serif;color:#0c0c0c;padding:32px 40px;font-size:13px;}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .sub{font-size:11px;color:#888;font-family:monospace;margin-bottom:20px}
    .metrics{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#f7f7f5}
    th{font-family:monospace;font-size:9px;text-transform:uppercase;color:#888;padding:8px 10px;text-align:left;border-bottom:2px solid #eee}
    th:not(:nth-child(1)):not(:nth-child(2)){text-align:right}
    .footer{margin-top:12px;font-size:10px;color:#aaa;font-family:monospace}
    @media print{body{padding:16px 20px}@page{margin:12mm}}
  </style></head><body>
  <h1>📊 Product Performance</h1>
  <div class="sub">${colName} · Dicetak ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div>
  <div class="metrics">
    ${metricBox("Stock Skrg", Math.round(grandStock)+" pcs", grandStock===0&&grandSold>0?"#c0392b":"#0c0c0c")}
    ${metricBox("Net Adj", adjStr, adjClr)}
    ${metricBox("Total Terjual", Math.round(grandSold)+" pcs", "#0c0c0c")}
    ${metricBox("Total Sales", fmtRp(grandRevenue), "#2d7a2d")}
    ${hasDiscount ? metricBox("Diskon",   fmtRp(grandDiscount), "#c0392b") : ""}
    ${hasDiscount ? metricBox("Subtotal", fmtRp(grandSubtotal), "#2d7a2d") : ""}
    ${metricBox("Sell-through", str, strClr)}
    ${metricBox("First Sale", fds, "#0c0c0c")}
    ${metricBox("Avg / Hari", avgPerDay, "#0c0c0c")}
  </div>
  <table>
    <thead><tr>
      <th style="width:56px"></th>
      <th>Produk</th>
      <th style="text-align:right">Harga Jual</th>
      <th style="text-align:right">Stock</th>
      <th style="text-align:right">Net Adj</th>
      <th style="text-align:right">Terjual</th>
      <th style="text-align:right">STR</th>
      <th style="text-align:right">Total Sales</th>
      ${hasDiscount ? `<th style="text-align:right">Diskon</th><th style="text-align:right;border-left:2px solid #eee">Subtotal</th>` : ""}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${products.length} produk · ${itemIds.length} variants · Sentra Internal Tools</div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

async function loadColProductPerf(colId, colName) {
  const el = document.getElementById(`col-perf-${colId}`);
  if (!el) return;

  // 1. Get products mapped to this collection
  const { data: mappings, error: mErr } = await sb.from("product_mappings")
    .select("jubelio_item_id, item_name")
    .ilike("collection", colName);

  if (mErr || !mappings || !mappings.length) {
    el.innerHTML = `<div style="color:var(--g400);font-size:12px;padding:4px 0">Belum ada produk yang di-mapping ke koleksi ini.</div>`;
    return;
  }

  const itemIds = [...new Set(mappings.map(m => m.jubelio_item_id).filter(Boolean))];

  // 2. Parallel fetch: sales items, stock, adjustments, item codes (for size extraction)
  const [salesItems, stocks, adjItems, itemCodes] = await Promise.all([
    _fetchAllPages("jubelio_sales_order_items","item_id, qty, salesorder_id, price, disc_amount",q=>q.in("item_id",itemIds)),
    _fetchAllPages("jubelio_inventory_stocks","item_id, on_hand",q=>q.in("item_id",itemIds)),
    _fetchAllPages("jubelio_inventory_adjustment_items","item_id, qty",q=>q.in("item_id",itemIds)),
    _fetchAllPages("jubelio_items","item_id, item_code, thumbnail",q=>q.in("item_id",itemIds)),
  ]).catch(() => [[], [], [], []]);

  // Size map: item_id → size label (last segment of item_code after final "-")
  const sizeMap = {};
  const thumbMap = {};
  for (const ji of (itemCodes || [])) {
    const parts = (ji.item_code || "").split("-");
    sizeMap[ji.item_id] = parts[parts.length - 1] || "?";
    if (ji.thumbnail) thumbMap[ji.item_id] = ji.thumbnail;
  }

  // 3. Get completed orders + dates
  let completedMap = new Map();
  if (salesItems.length) {
    const soIds = [...new Set(salesItems.map(s => s.salesorder_id))];
    const chunks = [];
    for (let i = 0; i < soIds.length; i += 200) chunks.push(soIds.slice(i, i + 200));
    const results = await Promise.all(chunks.map(chunk =>
      sb.from("jubelio_sales_orders")
        .select("salesorder_id, transaction_date")
        .in("salesorder_id", chunk)
        .eq("wms_status", "COMPLETED")
    ));
    for (const r of results) {
      for (const o of (r.data || [])) completedMap.set(o.salesorder_id, o.transaction_date);
    }
  }

  // 4. Per-variant aggregates
  const varData = {}; // item_id → { stock, sold, adj, revenue, pfreq }
  for (const id of itemIds) varData[id] = { stock: 0, sold: 0, adj: 0, revenue: 0, discAmount: 0, pfreq: {} };
  for (const s of stocks) {
    if (varData[s.item_id] !== undefined) varData[s.item_id].stock += parseFloat(s.on_hand || 0);
  }
  for (const si of salesItems) {
    if (!completedMap.has(si.salesorder_id) || varData[si.item_id] === undefined) continue;
    const qty   = parseFloat(si.qty        || 0);
    const price = parseFloat(si.price      || 0);
    const disc  = parseFloat(si.disc_amount|| 0);
    varData[si.item_id].sold += qty;
    if (price > 0) {
      varData[si.item_id].revenue    += qty * price;
      varData[si.item_id].discAmount += disc;
      varData[si.item_id].pfreq[price] = (varData[si.item_id].pfreq[price] || 0) + 1;
    }
  }
  for (const a of adjItems) {
    if (varData[a.item_id] !== undefined) varData[a.item_id].adj += parseFloat(a.qty || 0);
  }

  // 5. Group by product name, aggregate
  const productGroups = {};
  for (const m of mappings) {
    if (!m.jubelio_item_id) continue;
    if (!productGroups[m.item_name]) productGroups[m.item_name] = { name: m.item_name, variants: [] };
    const vd = varData[m.jubelio_item_id] || { stock: 0, sold: 0, adj: 0 };
    productGroups[m.item_name].variants.push({ id: m.jubelio_item_id, size: sizeMap[m.jubelio_item_id] || "?", ...vd });
  }
  const products = Object.values(productGroups).map(p => ({
    ...p,
    totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
    totalSold:  p.variants.reduce((s, v) => s + v.sold,  0),
    totalAdj:   p.variants.reduce((s, v) => s + v.adj,   0),
    thumbnail:     p.variants.map(v => thumbMap[v.id]).find(Boolean) || null,
    totalRevenue:  p.variants.reduce((s, v) => s + (v.revenue    || 0), 0),
    totalDiscount: p.variants.reduce((s, v) => s + (v.discAmount || 0), 0),
    price: p.variants.reduce((s,v)=>s+(v.sold||0),0) > 0
      ? p.variants.reduce((s,v)=>s+(v.revenue||0),0) / p.variants.reduce((s,v)=>s+(v.sold||0),0)
      : null,
  })).sort((a, b) => b.totalSold - a.totalSold);

  // 6. Grand totals + summary metrics
  const grandStock   = products.reduce((s, p) => s + p.totalStock,   0);
  const grandSold    = products.reduce((s, p) => s + p.totalSold,    0);
  const grandAdj     = products.reduce((s, p) => s + p.totalAdj,     0);
  const grandRevenue  = products.reduce((s, p) => s + p.totalRevenue,  0);
  const grandDiscount = products.reduce((s, p) => s + p.totalDiscount, 0);
  const grandSubtotal = grandRevenue - grandDiscount;
  const hasDiscount   = grandDiscount > 0;
  const fmtRp = n => n ? "Rp " + Math.round(n).toLocaleString("id-ID") : "—";

  let firstSaleDate = null;
  for (const si of salesItems) {
    if (!completedMap.has(si.salesorder_id)) continue;
    const d = completedMap.get(si.salesorder_id);
    if (d && (!firstSaleDate || d < firstSaleDate)) firstSaleDate = d;
  }

  const str = (grandSold + grandStock) > 0
    ? ((grandSold / (grandSold + grandStock)) * 100).toFixed(1) + "%"
    : "—";
  const strNum = parseFloat(str) || 0;
  const strClr = str !== "—" ? (strNum >= 70 ? "#2d7a2d" : strNum >= 30 ? "#e67e00" : "#c0392b") : "var(--black)";
  const adjStr = grandAdj > 0 ? `+${Math.round(grandAdj)}` : `${Math.round(grandAdj)}`;
  const adjClr = grandAdj > 0 ? "#2d7a2d" : grandAdj < 0 ? "#c0392b" : "var(--g400)";
  let avgPerDay = "—";
  if (firstSaleDate && grandSold > 0) {
    const days = Math.max(1, Math.ceil((Date.now() - new Date(firstSaleDate)) / 86400000));
    avgPerDay = (grandSold / days).toFixed(1) + "/hari";
  }
  const fds = firstSaleDate ? firstSaleDate.slice(0, 10) : "—";

  // 7. Render
  const metricCard = (lbl, val, clr) => `
    <div style="border:1px solid var(--g100);border-radius:6px;padding:10px 12px;min-width:0">
      <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--g400);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</div>
      <div style="font-weight:700;font-size:12px;color:${clr};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>
    </div>`;

  // Store for PDF export
  _colPerfCache[colId] = { colName, products, grandStock, grandSold, grandAdj, grandRevenue, grandDiscount, grandSubtotal, hasDiscount, str, strClr, adjStr, adjClr, avgPerDay, fds, itemIds };

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px">
      ${metricCard("Stock Skrg",    Math.round(grandStock) + " pcs", grandStock === 0 && grandSold > 0 ? "#c0392b" : "var(--black)")}
      ${metricCard("Net Adj",       adjStr, adjClr)}
      ${metricCard("Total Terjual", Math.round(grandSold) + " pcs", "var(--black)")}
      ${metricCard("Total Sales",   fmtRp(grandRevenue),  "#2d7a2d")}
      ${hasDiscount ? metricCard("Diskon",        fmtRp(grandDiscount), "#c0392b") : ""}
      ${hasDiscount ? metricCard("Subtotal",      fmtRp(grandSubtotal), "#2d7a2d") : ""}
      ${metricCard("Sell-through",  str, strClr)}
      ${metricCard("First Sale",    fds, "var(--black)")}
      ${metricCard("Avg / Hari",    avgPerDay, "var(--black)")}
    </div>
    ${products.length ? `<div class="table-wrap" style="max-height:400px;overflow-y:auto">
      <table style="width:100%">
        <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
          <th style="padding:6px 8px;width:52px"></th>
          <th style="padding:6px 10px;text-align:left">Produk</th>
          <th style="padding:6px 10px;text-align:right">Harga Jual</th>
          <th style="padding:6px 10px;text-align:right">Stock</th>
          <th style="padding:6px 10px;text-align:right">Net Adj</th>
          <th style="padding:6px 10px;text-align:right">Terjual</th>
          <th style="padding:6px 10px;text-align:right">STR</th>
          <th style="padding:6px 10px;text-align:right">Total Sales</th>
          ${hasDiscount ? `<th style="padding:6px 10px;text-align:right">Diskon</th><th style="padding:6px 10px;text-align:right;border-left:2px solid var(--g100)">Subtotal</th>` : ""}
        </tr></thead>
        <tbody>${products.map(p => {
          const iStr  = (p.totalSold + p.totalStock) > 0 ? ((p.totalSold / (p.totalSold + p.totalStock)) * 100).toFixed(0) + "%" : "—";
          const iSClr = iStr !== "—" ? (parseFloat(iStr) >= 70 ? "#2d7a2d" : parseFloat(iStr) >= 30 ? "#e67e00" : "#c0392b") : "var(--g400)";
          const iAStr = p.totalAdj > 0 ? `+${Math.round(p.totalAdj)}` : `${Math.round(p.totalAdj)}`;
          const iAClr = p.totalAdj > 0 ? "#2d7a2d" : p.totalAdj < 0 ? "#c0392b" : "var(--g400)";
          const sizePills = p.variants
            .sort((a, b) => {
              const ai = SIZE_ORDER.indexOf(a.size.toUpperCase());
              const bi = SIZE_ORDER.indexOf(b.size.toUpperCase());
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            })
            .map(v => {
              const broken = v.stock === 0;
              const bg    = broken ? "#fdecea" : "#edf8ee";
              const color = broken ? "#c0392b" : "#2d7a2d";
              return `<span title="Stock: ${Math.round(v.stock)} · Terjual: ${Math.round(v.sold)}" style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-family:var(--mono);color:${color};background:${bg};margin:1px 1px 0 0">${v.size}</span>`;
            }).join("");
          const thumbHTML = p.thumbnail
            ? `<img src="${p.thumbnail}" style="width:44px;height:44px;object-fit:cover;border-radius:5px;border:1px solid var(--g100);display:block" onerror="this.style.display='none'">`
            : `<div style="width:44px;height:44px;border-radius:5px;border:1px solid var(--g100);background:var(--off);display:flex;align-items:center;justify-content:center;font-size:16px">📦</div>`;
          return `<tr style="border-top:1px solid var(--g100)">
            <td style="padding:6px 8px;vertical-align:middle">${thumbHTML}</td>
            <td style="padding:7px 10px;font-size:12px;vertical-align:middle">
              <div style="margin-bottom:3px;font-weight:500">${p.name}</div>
              <div>${sizePills}</div>
            </td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:11px;vertical-align:middle;color:var(--g600)">${p.price ? fmtRp(p.price) : "—"}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px;vertical-align:middle${p.totalStock === 0 && p.totalSold > 0 ? ";color:#c0392b" : ""}">${Math.round(p.totalStock)}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px;vertical-align:middle;color:${iAClr}">${iAStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px;vertical-align:middle">${Math.round(p.totalSold)}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px;vertical-align:middle;color:${iSClr}">${iStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:11px;vertical-align:middle;color:#2d7a2d">${fmtRp(p.totalRevenue)}</td>
            ${hasDiscount ? `<td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:11px;vertical-align:middle;color:#c0392b">${p.totalDiscount > 0 ? "-"+fmtRp(p.totalDiscount) : "—"}</td><td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:11px;vertical-align:middle;color:#2d7a2d;border-left:2px solid var(--g100)">${fmtRp(p.totalRevenue - p.totalDiscount)}</td>` : ""}
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>` : ""}
    <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:10px;color:var(--g400);font-family:var(--mono)">${products.length} produk · ${itemIds.length} variants ter-mapping</div>
      <button onclick="printColPerf('${colId}')" style="padding:5px 12px;border:1px solid var(--g200);border-radius:6px;background:none;font-size:11px;font-family:var(--mono);cursor:pointer;color:var(--g600);display:flex;align-items:center;gap:5px" title="Download PDF">⬇ PDF</button>
    </div>
  `;
}

function renderColPOCards(colId) {
  const links=colToPos[colId]||[];
  const addRow=`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <select id="col-po-select-${colId}" style="font-size:12px;padding:4px 8px;border:1px solid var(--g100);border-radius:4px;flex:1;max-width:340px;background:var(--white)">
        <option value="">+ Link PO...</option>
        ${allPORows.map(p=>`<option value="${p.id}">${p.purchaseorderNo} — ${p.supplierName||"—"} (${p.status})</option>`).join("")}
      </select>
      <button class="btn-primary" style="padding:5px 14px;font-size:12px" onclick="handleAddCPLink('${colId}')">Tambah</button>
    </div>`;
  if(!links.length) return addRow+`<div style="color:var(--g400);font-size:12px">Belum ada PO terkait.</div>`;

  const cards=links.map(({linkId,poId,expectedDate,po})=>{
    const r=po||allPORows.find(p=>p.id===poId)||{};
    const poItems=allPOItems.filter(i=>i.purchaseorderId===poId);
    const bills=allPOBills.filter(b=>b.purchaseorder_id===poId);
    // received qty per detail id
    const rcvdMap={};
    bills.forEach(b=>allPOBillItems.filter(i=>i.bill_id===b.bill_id).forEach(i=>{
      rcvdMap[i.purchaseorder_detail_id]=(rcvdMap[i.purchaseorder_detail_id]||0)+(Number(i.qty)||0);
    }));
    // item filter: if any items checked for this link, only count those
    const checkedSet=cplItemsByLink[linkId]||new Set();
    const isFiltered=checkedSet.size>0;
    const activeItems=isFiltered?poItems.filter(it=>checkedSet.has(it.id)):poItems;
    const totalPO=activeItems.reduce((s,i)=>s+(i.qty||0),0);
    const totalRcvd=activeItems.reduce((s,i)=>s+(rcvdMap[i.id]||0),0);
    // actual received date: from penerimaan (nerima barang), fallback to bill date
    const receive=allPOReceives.find(rx=>rx.purchaseorder_no===r.purchaseorderNo);
    const actualDate=receive?receive.transaction_date:(bills.length?bills.map(b=>b.transaction_date).sort()[0]:null);
    // putaway status from bill
    const isPutaway=bills.some(b=>b.is_putaway===true);
    // status pills
    const stC=r.status==="ACTIVE"?"p-signings":r.status==="COMPLETED"?"p-active":r.status==="CANCELLED"?"p-inactive":"p-draft";
    const rcvLabel=bills.length===0?"Belum Diterima":totalRcvd>=totalPO?"Lunas":"Sebagian";
    const rcvC=bills.length===0?"p-draft":totalRcvd>=totalPO?"p-active":"p-review";
    const dt=r.transactionDate?new Date(r.transactionDate).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—";
    // item rows — all PO items shown, with checkbox to include/exclude per collection
    const itemRows=poItems.map(it=>{
      const checked=checkedSet.has(it.id);
      const active=!isFiltered||checked;
      const rcvd=rcvdMap[it.id]||0;
      const rcvdClr=!active?"var(--g300)":rcvd===0?"var(--g400)":rcvd>=it.qty?"#2d8a4e":"#c0700a";
      const rowOp=active?"1":"0.4";
      return `<tr style="border-top:1px solid var(--g100);opacity:${rowOp}">
        <td style="padding:5px 8px;text-align:center">
          <input type="checkbox" ${checked?"checked":""} style="cursor:pointer;accent-color:#3C3489"
            onchange="toggleCPLinkItem('${linkId}','${colId}',${it.id},this.checked)">
        </td>
        <td style="padding:5px 8px;font-family:var(--mono);font-size:10px;color:var(--g400)">${it.itemCode||"—"}</td>
        <td style="padding:5px 8px;font-size:12px">${it.itemName||"—"}</td>
        <td style="padding:5px 8px;font-size:12px;text-align:right">${it.qty!=null?Number(it.qty).toLocaleString("id-ID"):"—"}</td>
        <td style="padding:5px 8px;font-size:12px;text-align:right;font-weight:600;color:${rcvdClr}">${rcvd?rcvd.toLocaleString("id-ID"):"—"}</td>
        <td style="padding:5px 8px;font-size:11px;color:var(--g400)">${it.unit||""}</td>
      </tr>`;
    }).join("");
    return `
    <div style="border:1px solid var(--g100);border-radius:8px;margin-bottom:10px;overflow:hidden">
      <!-- PO Header -->
      <div style="padding:10px 14px;background:var(--off);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="cursor:pointer;color:var(--g400);font-size:12px;user-select:none" onclick="toggleCPItems('${linkId}')" id="cpl-toggle-${linkId}">${poItems.length?"▶":""}</span>
        <a href="https://v2.jubelio.com/purchase/orders/detail/${poId}" target="_blank" style="font-family:var(--mono);font-size:13px;color:#3C3489;text-decoration:none;font-weight:700">${r.purchaseorderNo||poId}</a>
        <span style="font-size:12px;color:var(--g600)">${r.supplierName||"—"}</span>
        <span style="font-size:11px;color:var(--g400)">${dt}</span>
        <span class="pill ${stC}" style="font-size:10px">${r.status||"—"}</span>
        <span class="pill ${rcvC}" style="font-size:10px">${rcvLabel}</span>
        <span style="font-size:11px;color:var(--g600)">${totalRcvd.toLocaleString("id-ID")} / ${totalPO.toLocaleString("id-ID")} pcs</span>
        ${isFiltered?`<span class="pill p-near" style="font-size:9px" title="${checkedSet.size} dari ${poItems.length} item digunakan">⚑ ${checkedSet.size}/${poItems.length} items</span>`:""}
        <button onclick="handleRemoveCPLink('${linkId}','${colId}')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--g400);font-size:15px;padding:0 2px;line-height:1" title="Hapus PO">×</button>
      </div>
      <!-- Expected / Actual dates -->
      ${(()=>{
        const today=new Date(); today.setHours(0,0,0,0);
        const expPast=expectedDate&&new Date(expectedDate+"T00:00:00")<today;
        const expOverdue=expPast&&!actualDate;
        const expLate=expPast&&actualDate&&new Date(actualDate)>new Date(expectedDate+"T00:00:00");
        const inputBorder=expOverdue?"1px solid #e74c3c":expLate?"1px solid #e67e22":"1px solid var(--g100)";
        const inputBg=expOverdue?"#fdecea":expLate?"#fff3e0":"var(--white)";
        return `<div style="padding:10px 14px;display:flex;gap:24px;align-items:center;border-bottom:1px solid var(--g100);flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">Expected</span>
          <input type="date" value="${expectedDate||""}" style="font-size:12px;padding:3px 8px;border:${inputBorder};border-radius:4px;background:${inputBg}"
            onchange="saveCPLExpectedDate('${linkId}','${colId}',this.value)">
          ${expOverdue?`<span class="pill p-expired" style="font-size:9px">Overdue</span>`:""}
          ${expLate?`<span class="pill p-near" style="font-size:9px">Terlambat</span>`:""}
        </div>`;
      })()}
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">Diterima</span>
          <span style="font-size:12px;font-weight:600;color:${actualDate?"#1a5c25":"var(--g400)"}">
            ${actualDate?new Date(actualDate).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—"}
          </span>
        </div>
        ${actualDate?`<div style="display:flex;align-items:center;gap:6px">
          <span style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">Putaway</span>
          ${isPutaway
            ?`<span class="pill p-active" style="font-size:9px">✓ Selesai</span>`
            :`<span class="pill p-review" style="font-size:9px">Pending</span>`}
        </div>`:""}
      </div>
      <!-- Items (collapsible) -->
      <div id="cpl-items-${linkId}" style="display:none">
        ${poItems.length?`<table style="width:100%;border-collapse:collapse">
          <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
            <th style="padding:5px 8px;text-align:center;width:28px" title="Centang item yang relevan untuk collection ini">✓</th>
            <th style="padding:5px 8px;text-align:left">Kode</th>
            <th style="padding:5px 8px;text-align:left">Item</th>
            <th style="padding:5px 8px;text-align:right">PO Qty</th>
            <th style="padding:5px 8px;text-align:right">Diterima</th>
            <th style="padding:5px 8px;text-align:left">Satuan</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>`:`<div style="padding:10px 14px;color:var(--g400);font-size:12px">Tidak ada items.</div>`}
      </div>
    </div>`;
  }).join("");
  return addRow+cards;
}

function toggleCPItems(linkId){
  const el=document.getElementById(`cpl-items-${linkId}`);
  const tog=document.getElementById(`cpl-toggle-${linkId}`);
  if(!el) return;
  const open=el.style.display==="table"||el.style.display==="block";
  el.style.display=open?"none":"block";
  if(tog) tog.textContent=open?"▶":"▼";
}

async function saveCPLExpectedDate(linkId, colId, date){
  await sb.from("collection_po_links").update({expected_date:date||null}).eq("id",linkId);
  // update local cache
  const lnk=allCPLinks.find(l=>l.id===linkId);
  if(lnk) lnk.expected_date=date||null;
  const entry=(colToPos[colId]||[]).find(l=>l.linkId===linkId);
  if(entry) entry.expectedDate=date||"";
}

async function toggleCPLinkItem(linkId, colId, detailId, checked){
  if(checked){
    // insert
    const {error}=await sb.from("collection_po_link_items").insert({link_id:linkId,purchaseorder_detail_id:detailId});
    if(error&&error.code!=="23505") { console.error(error); return; } // ignore duplicate
    if(!cplItemsByLink[linkId]) cplItemsByLink[linkId]=new Set();
    cplItemsByLink[linkId].add(detailId);
    allCPLinkItems.push({link_id:linkId,purchaseorder_detail_id:detailId});
  } else {
    // delete
    await sb.from("collection_po_link_items").delete().eq("link_id",linkId).eq("purchaseorder_detail_id",detailId);
    if(cplItemsByLink[linkId]) cplItemsByLink[linkId].delete(detailId);
    const idx=allCPLinkItems.findIndex(r=>r.link_id===linkId&&r.purchaseorder_detail_id===detailId);
    if(idx>-1) allCPLinkItems.splice(idx,1);
  }
  // re-render just the production section header to update filter badge + qty counts
  refreshProductionBody(colId);
}

function renderColPOChips(colId) {
  const links=colToPos[colId]||[];
  if(!links.length) return `<span style="color:var(--g400);font-size:12px">Belum ada PO terkait.</span>`;
  const rcvPill=(bills,poId)=>{
    const linked=allPOBills.filter(b=>b.purchaseorder_id===poId);
    const rcvd=linked.reduce((s,b)=>s+allPOBillItems.filter(i=>i.bill_id===b.bill_id).reduce((ss,i)=>ss+(Number(i.qty)||0),0),0);
    const poItems=allPOItems.filter(i=>i.purchaseorderId===poId);
    const total=poItems.reduce((s,i)=>s+(i.qty||0),0);
    if(linked.length===0) return `<span class="pill p-draft" style="font-size:9px">Belum</span>`;
    if(rcvd>=total) return `<span class="pill p-active" style="font-size:9px">Lunas</span>`;
    return `<span class="pill p-review" style="font-size:9px">Sebagian</span>`;
  };
  return links.map(({linkId,poId,po})=>{
    const r=po||allPORows.find(p=>p.id===poId)||{};
    const stC=r.status==="ACTIVE"?"p-signings":r.status==="COMPLETED"?"p-active":r.status==="CANCELLED"?"p-inactive":"p-draft";
    const dt=r.transactionDate?new Date(r.transactionDate).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—";
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--g100);border-radius:6px;margin-bottom:6px;background:var(--white)">
      <a href="https://v2.jubelio.com/purchase/orders/detail/${poId}" target="_blank" style="font-family:var(--mono);font-size:12px;color:#3C3489;text-decoration:none;font-weight:600;white-space:nowrap">${r.purchaseorderNo||poId}</a>
      <span style="font-size:11px;color:var(--g400)">${r.supplierName||"—"}</span>
      <span style="font-size:11px;color:var(--g400)">${dt}</span>
      <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <span class="pill ${stC}" style="font-size:9px">${r.status||"—"}</span>
        ${rcvPill(allPOBills,poId)}
        <button onclick="handleRemoveCPLink('${linkId}','${colId}')" style="background:none;border:none;cursor:pointer;color:var(--g400);font-size:13px;padding:0 2px;line-height:1" title="Hapus">×</button>
      </span>
    </div>`;
  }).join("");
}

function renderColPOLinks(colId){
  const el=document.getElementById(`col-po-chips-${colId}`);
  if(el) el.innerHTML=renderColPOChips(colId);
}

function refreshProductionBody(colId){
  const el=document.getElementById(`col-production-body-${colId}`);
  if(el) el.innerHTML=renderColPOCards(colId);
}

async function handleAddCPLink(colId){
  const sel=document.getElementById(`col-po-select-${colId}`);
  if(!sel||!sel.value){alert("Pilih PO dulu.");return;}
  try{
    await addCPLink(colId, sel.value);
    sel.value="";
    refreshProductionBody(colId);
    renderPOTable(allPORows);
  }catch(e){alert("Gagal: "+(e.message||e));}
}

async function handleRemoveCPLink(linkId, colId){
  if(!confirm("Hapus link PO ini?")) return;
  try{
    await removeCPLink(linkId, colId);
    refreshProductionBody(colId);
    renderPOTable(allPORows);
  }catch(e){alert("Gagal: "+(e.message||e));}
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
      payment_status:"No Fee", locked:true,
      date_added:new Date().toISOString().slice(0,10), added_by:currentUser,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    });
    if(error)throw error;
    logActivity("Designer Workflow","create",id,`Pushed from: ${col.collectionName}`);
    // Add to local cache so repeat-push detection works without full reload
    allDwRows.push({rowIndex:id,id,designer:"",collectionId:colId,collectionName:col.collectionName,
      deliverablesUrl:"",agreementId:"",paymentStatus:"No Fee",locked:true,notes:"",
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

// Update DW payment status from Collection Detail
async function updateDwPaymentFromCD(dwId, value) {
  try {
    const {error}=await sb.from("designer_workflow").update({
      payment_status:value, last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",dwId);
    if(error) throw error;
    const dw=allDwRows.find(r=>r.id===dwId);
    if(dw) dw.paymentStatus=value;
    // Update select style to match new value
    const sel=document.querySelector(`[onchange*="updateDwPaymentFromCD('${dwId}'"]`);
    if(sel){
      const clr=value==="Paid"?"background:#edf8ee;color:#1a5c25;border-color:#90d4a0":
                value==="Not Yet Paid"?"background:#fff3e0;color:#8a4000;border-color:#ffcc80":
                "background:#f0efe9;color:#5a5850;border-color:#d4d3cb";
      sel.style.cssText=`font-size:11px;padding:2px 8px;border:1px solid;border-radius:99px;${clr}`;
    }
  } catch(e){alert("Gagal: "+(e.message||e));}
}

// Save DW agreement from Collection Detail
async function saveDwAgreementFromCD(dwId, value) {
  const agreementId=value.trim()||null;
  try {
    const {error}=await sb.from("designer_workflow").update({
      agreement_id:agreementId,
      last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",dwId);
    if(error) throw error;
    const dw=allDwRows.find(r=>r.id===dwId);
    if(dw) dw.agreementId=agreementId||"";
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
  const pipeStages=[["design","Design"],["sampling","Sampling"],["production","Prod & Inbound"],["marketing","Marketing"]];
  const pdot=s=>s==="done"?"●":s==="in-progress"?"◐":"○";
  const pclr=s=>s==="done"?"#1a5c25":s==="in-progress"?"#1a4a8a":"#aaa";
  return pipeStages.map(([k,l],i)=>`${i>0?`<div style="width:32px;flex-shrink:0;height:1px;background:var(--g200)"></div>`:""}
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px">
      <span style="font-size:20px;line-height:1;color:${pclr(ps[k])}">${pdot(ps[k])}</span>
      <span style="font-size:9px;font-family:var(--mono);text-transform:uppercase;color:${pclr(ps[k])};white-space:nowrap">${l}</span>
    </div>`).join("");
}

// Sampling drive link (collection-level) toggle + save
function openSamplingLink(colId) {
  const disp=document.getElementById(`sl-disp-${colId}`);
  const edit=document.getElementById(`sl-edit-${colId}`);
  if(disp) disp.style.display='none';
  if(edit){ edit.style.display='inline-flex'; document.getElementById(`sl-inp-${colId}`)?.select(); }
}
async function saveSamplingLink(colId, url) {
  const val=url.trim()||null;
  try {
    await sb.from("collections").update({
      sampling_drive_url:val, last_updated:new Date().toISOString(), last_updated_by:currentUser
    }).eq("id",colId);
    const col=allColRows.find(r=>r.id===colId);
    if(col) col.samplingDriveUrl=val||"";
    const disp=document.getElementById(`sl-disp-${colId}`);
    const edit=document.getElementById(`sl-edit-${colId}`);
    if(disp){
      disp.innerHTML=val
        ?`<a href="${val}" target="_blank" style="font-size:11px;color:#3C3489;text-decoration:none">↗ Drive</a> <button class="btn-icon" style="font-size:10px" onclick="openSamplingLink('${colId}')">✏</button>`
        :`<button class="btn-icon" style="font-size:10px" onclick="openSamplingLink('${colId}')">+ Drive</button>`;
      disp.style.display='inline-flex';
    }
    if(edit) edit.style.display='none';
  } catch(e){/* silent */}
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
    if(stage!=="inbound"&&stage!=="marketing_config") refreshStageHeaderBadge(colId,"marketing");
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

// ── Marketing section helpers ──

// Linkify URLs in plain text (for notes display)
function linkifyNotes(text) {
  if (!text) return '<em style="color:var(--g400);font-size:10px">Klik untuk tambah notes...</em>';
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return esc.replace(/(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color:#1a4a8a;word-break:break-all;text-decoration:underline" onclick="event.stopPropagation()">$1</a>');
}

// Get enabled marketing activities for a collection (default = all)
function getMktEnabled(colId) {
  const cfg=allColStages.find(r=>r.collectionId===colId&&r.stage==='marketing_config');
  if(!cfg||!cfg.notes) return MKT_ACTIVITIES.map(a=>a.key);
  try {
    const p=JSON.parse(cfg.notes);
    return Array.isArray(p.enabled)?p.enabled:MKT_ACTIVITIES.map(a=>a.key);
  } catch(e){ return MKT_ACTIVITIES.map(a=>a.key); }
}

// Render a single marketing activity sub-box
function mktSubBoxHTML(colId, stage) {
  const s=allColStages.find(r=>r.collectionId===colId&&r.stage===stage)||{stage,status:"Not Started",notes:""};
  const act=MKT_ACTIVITIES.find(a=>a.key===stage);
  const selClr=s.status==="Done"?"#edf8ee;color:#1a5c25;border-color:#90d4a0":
               s.status==="In Progress"?"#e8f0fc;color:#1a4a8a;border-color:#a8c4f0":
               "#f0efe9;color:#5a5850;border-color:#d4d3cb";
  return `<div style="border:1px solid var(--g100);border-radius:6px;padding:12px">
    <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:10px">${act?act.icon+' ':''}${COL_STAGE_LABELS[stage]||stage}</div>
    <select onchange="updateColStageStatus('${colId}','${stage}',this.value)" style="font-size:11px;padding:3px 8px;border:1px solid;border-radius:4px;width:100%;margin-bottom:8px;background:${selClr}">
      <option${s.status==="Not Started"?" selected":""}>Not Started</option>
      <option${s.status==="In Progress"?" selected":""}>In Progress</option>
      <option${s.status==="Done"?" selected":""}>Done</option>
    </select>
    <div id="col-notes-disp-${colId}-${stage}" style="font-size:11px;line-height:1.5;padding:6px 8px;border:1px solid var(--g100);border-radius:4px;min-height:38px;cursor:text;white-space:pre-wrap;word-break:break-word" onclick="colNotesToggleEdit('${colId}','${stage}')">${linkifyNotes(s.notes)}</div>
    <textarea id="col-notes-ta-${colId}-${stage}" placeholder="Notes..." rows="2" style="display:none;font-size:11px;padding:6px 8px;border:1px solid var(--g100);border-radius:4px;width:100%;resize:vertical;box-sizing:border-box" onblur="colNotesSave('${colId}','${stage}',this)">${(s.notes||"").replace(/</g,"&lt;")}</textarea>
  </div>`;
}

// Render full marketing section body (pills + activity boxes)
function renderMktBodyHTML(colId) {
  const enabled=getMktEnabled(colId);
  const pills=MKT_ACTIVITIES.map(a=>{
    const on=enabled.includes(a.key);
    return `<span onclick="toggleMktActivity('${colId}','${a.key}')" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1.5px solid ${on?'#1a4a8a':'var(--g200)'};background:${on?'#e8f0fc':'var(--off)'};color:${on?'#1a4a8a':'var(--g400)'};user-select:none">${a.icon} ${a.label}</span>`;
  }).join('');
  const acts=MKT_ACTIVITIES.filter(a=>enabled.includes(a.key));
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${acts.length?'14px':'10px'}">${pills}</div>`+
    (acts.length
      ?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">${acts.map(a=>mktSubBoxHTML(colId,a.key)).join('')}</div>`
      :`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#1a5c25;background:#edf8ee;border:1px solid #90d4a0;border-radius:6px;padding:8px 12px"><strong>✓</strong>Tidak ada aktivitas marketing yang dijalankan.</div>`);
}

// Toggle marketing activity on/off
async function toggleMktActivity(colId, key) {
  const enabled=getMktEnabled(colId);
  const newEnabled=enabled.includes(key)?enabled.filter(k=>k!==key):[...enabled,key];
  const notes=JSON.stringify({enabled:newEnabled});
  const cfg=allColStages.find(r=>r.collectionId===colId&&r.stage==='marketing_config');
  if(cfg){
    try {
      await sb.from('collection_stages').update({notes,last_updated:new Date().toISOString(),last_updated_by:currentUser}).eq('id',cfg.id);
      cfg.notes=notes;
    } catch(e){/* silent */}
  }
  const el=document.getElementById(`col-mkt-body-${colId}`);
  if(el) el.innerHTML=renderMktBodyHTML(colId);
  refreshStageHeaderBadge(colId,'marketing');
  const pipeEl=document.getElementById(`col-pipeline-${colId}`);
  if(pipeEl) pipeEl.innerHTML=renderPipelineBarHTML(colId);
}

// Switch notes display div → textarea
function colNotesToggleEdit(colId, stage) {
  const disp=document.getElementById(`col-notes-disp-${colId}-${stage}`);
  const ta=document.getElementById(`col-notes-ta-${colId}-${stage}`);
  if(!disp||!ta) return;
  disp.style.display='none';
  ta.style.display='';
  ta.focus();
}

// Save notes, switch back to display div
async function colNotesSave(colId, stage, el) {
  const notes=el.value;
  await saveColStageNote(colId,stage,notes);
  const disp=document.getElementById(`col-notes-disp-${colId}-${stage}`);
  if(disp){ disp.innerHTML=linkifyNotes(notes); disp.style.display=''; }
  el.style.display='none';
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
    // Sync DW rows: remove orphaned designers, add new ones
    syncDWForCollection(colId);
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
    // Remove DW row if this designer no longer has any SKUs in the collection
    syncDWForCollection(colId);
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
    // Cascade: remove DW rows for this collection
    await sb.from("designer_workflow").delete().eq("collection_id",rowIdx);
    allColRows=allColRows.filter(r=>r.id!==rowIdx);
    allColItems=allColItems.filter(i=>i.collectionId!==rowIdx);
    allDwRows=allDwRows.filter(r=>r.collectionId!==rowIdx);
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
    paymentStatus:r.payment_status||"No Fee", locked:!!r.locked,
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
    // No Fee = gray (internal/karyawan, no action needed)
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
          <div class="fg"><label>Payment Status</label><select id="dwe-payment-${r.rowIndex}"><option value="No Fee"${r.paymentStatus==="No Fee"?" selected":""}>No Fee</option><option value="Not Yet Paid"${r.paymentStatus==="Not Yet Paid"?" selected":""}>Not Yet Paid</option><option value="Paid"${r.paymentStatus==="Paid"?" selected":""}>Paid</option></select></div>
          <div class="fg full"><label>Notes</label><textarea id="dwe-notes-${r.rowIndex}" rows="2" style="resize:vertical">${(r.notes||"").replace(/</g,"&lt;")}</textarea></div>
        </div>`
      :`<div class="edit-row-grid">
          <div class="fg" style="position:relative"><label>Designer</label><input type="text" id="dwe-designer-${r.rowIndex}" value="${(r.designer||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-dwe-dsg-${r.rowIndex}"></div></div>
          <div class="fg"><label>Project</label><input type="text" id="dwe-project-${r.rowIndex}" value="${(r.projectName||"").replace(/"/g,"&quot;")}" placeholder="Nama project..."></div>
          <div class="fg"><label>Deadline</label><input type="date" id="dwe-deadline-${r.rowIndex}" value="${r.deadline||""}"></div>
          <div class="fg"><label>Status Deliverables</label><select id="dwe-dlstatus-${r.rowIndex}"><option value="Pending"${r.deliverablesStatus==="Pending"?" selected":""}>Pending</option><option value="In Progress"${r.deliverablesStatus==="In Progress"?" selected":""}>In Progress</option><option value="Revision"${r.deliverablesStatus==="Revision"?" selected":""}>Revision</option><option value="Completed"${r.deliverablesStatus==="Completed"?" selected":""}>Completed</option></select></div>
          <div class="fg full"><label>Deliverables URL <span style="font-size:11px;color:var(--g400)">(Google Drive)</span></label><input type="url" id="dwe-deliverables-${r.rowIndex}" value="${(r.deliverablesUrl||"").replace(/"/g,"&quot;")}" placeholder="https://drive.google.com/..."></div>
          <div class="fg" style="position:relative"><label>Kontrak (Agreement)</label><input type="text" id="dwe-agreement-${r.rowIndex}" value="${(r.agreementId||"").replace(/"/g,"&quot;")}" autocomplete="off"><div class="ac-list" id="ac-dwe-agr-${r.rowIndex}"></div></div>
          <div class="fg"><label>Payment Status</label><select id="dwe-payment-${r.rowIndex}"><option value="No Fee"${r.paymentStatus==="No Fee"?" selected":""}>No Fee</option><option value="Not Yet Paid"${r.paymentStatus==="Not Yet Paid"?" selected":""}>Not Yet Paid</option><option value="Paid"${r.paymentStatus==="Paid"?" selected":""}>Paid</option></select></div>
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
        ${r.locked?`<span style="font-size:10px;color:var(--g400);font-style:italic">Kelola di CD</span>`:`<button class="btn-icon" onclick="openDwEdit('${r.rowIndex}')">Edit</button>
        <button class="btn-icon" style="color:#c0392b" onclick="deleteDw('${r.rowIndex}')">Del</button>`}
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
    ${r.locked?"":`<tr id="dw-edit-row-${r.rowIndex}" style="display:none">
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
    </tr>`}`;
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
      payment_status:document.getElementById(`dwe-payment-${rowIdx}`)?.value||"No Fee",
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
      payment_status:document.getElementById("dw-payment")?.value||"No Fee",
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
  const p=document.getElementById("dw-payment");if(p)p.value="No Fee";
  const dl=document.getElementById("dw-deadline");if(dl)dl.value="";
  const dls=document.getElementById("dw-dl-status");if(dls)dls.value="Pending";
}

// ── STOCK MOVEMENT ──
let smPORows=[], smPOItems=[], smPOBills=[], smPOBillItems=[], smPOReceives=[];
let smStockMap={};   // item_id → [{loc, qty}]
let smLocNames={};   // location_id → location_name
let _smSyncCooldown=0;
let smSalesMap={};  // item_id → total qty sold
let smAdjMap={};    // item_id → count of adjustment events
let smSort={col:null,dir:'asc'};
let _smFiltered=[];
function sortSmBy(c){smSort.dir=smSort.col===c?(smSort.dir==='asc'?'desc':'asc'):'asc';smSort.col=c;renderSmTable(_smFiltered);}

async function loadStockMovement(){
  const tbody=document.getElementById("smTableBody");
  if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Memuat...</td></tr>`;
  try{
    const status=document.getElementById("sm-fil-status")?.value||"";
    const from=document.getElementById("sm-fil-from")?.value||"";
    const to=document.getElementById("sm-fil-to")?.value||"";

    // Phase 1: load PO data + stocks + location names (fast, targeted)
    const [poData,itemData,billData,billItemData,rcvData,stockData,adjData]=await Promise.all([
      (async()=>{
        const PAGE=1000; let all=[], f=0;
        while(true){
          let q=sb.from("jubelio_purchase_orders").select("*").order("transaction_date",{ascending:false}).range(f,f+PAGE-1);
          if(status) q=q.eq("status",status);
          if(from)   q=q.gte("transaction_date",from);
          if(to)     q=q.lte("transaction_date",to+"T23:59:59");
          const {data,error}=await q; if(error) throw error;
          all=all.concat(data||[]); if(!data||data.length<PAGE) break; f+=PAGE;
        }
        return all;
      })(),
      _fetchAllPages("jubelio_purchase_order_items","purchaseorder_id,purchaseorder_detail_id,item_id,item_code,item_name,qty,unit"),
      _fetchAllPages("jubelio_purchase_bills","bill_id,purchaseorder_id,is_putaway,location_name,transaction_date"),
      _fetchAllPages("jubelio_purchase_bill_items","bill_id,purchaseorder_detail_id,qty"),
      _fetchAllPages("jubelio_purchase_receives","bill_id,purchaseorder_no,transaction_date"),
      _fetchAllPages("jubelio_inventory_stocks","item_id,location_id,location_code,on_hand"),
      _fetchAllPages("jubelio_inventory_adjustments","location_id,location_name"),
    ]);

    smPORows=poData.map(r=>({
      id:r.purchaseorder_id, purchaseorderId:r.purchaseorder_id,
      purchaseorderNo:r.purchaseorder_no||"", status:r.status||"",
      supplierName:r.supplier_name||"", transactionDate:r.transaction_date||"",
      locationName:r.location_name||"", grandTotal:r.grand_total!=null?Number(r.grand_total):null
    }));
    smPOItems=itemData;
    smPOBills=billData;
    smPOBillItems=billItemData;
    smPOReceives=rcvData;
    smSalesMap={}; smAdjMap={};

    // Location name map: location_id → location_name
    smLocNames={};
    (adjData||[]).forEach(r=>{ if(r.location_id!=null&&r.location_name) smLocNames[r.location_id]=r.location_name; });

    // Stock map: item_id → [{loc, qty}]
    smStockMap={};
    (stockData||[]).forEach(r=>{
      if(!smStockMap[r.item_id]) smStockMap[r.item_id]=[];
      if((r.on_hand||0)>0){
        const loc=smLocNames[r.location_id]||r.location_code||`ID:${r.location_id}`;
        smStockMap[r.item_id].push({loc, qty:Number(r.on_hand)});
      }
    });

    // Show table immediately after phase 1
    applySmFilters();

    // Phase 2: load sales + adj only for item_ids in loaded PO items (much faster)
    const itemIds=[...new Set(smPOItems.map(i=>i.item_id).filter(Boolean))];
    if(itemIds.length){
      const BATCH=500;
      const salesChunks=[], adjChunks=[];
      for(let i=0;i<itemIds.length;i+=BATCH){
        const ids=itemIds.slice(i,i+BATCH);
        salesChunks.push(_fetchAllPages("jubelio_sales_order_items","item_id,qty",q=>q.in("item_id",ids)));
        adjChunks.push(_fetchAllPages("jubelio_inventory_adjustment_items","item_id,item_adj_id",q=>q.in("item_id",ids)));
      }
      const results=await Promise.all([...salesChunks,...adjChunks]);
      const half=salesChunks.length;
      results.slice(0,half).forEach(data=>(data||[]).forEach(r=>{
        if(r.item_id!=null) smSalesMap[r.item_id]=(smSalesMap[r.item_id]||0)+(Number(r.qty)||0);
      }));
      results.slice(half).forEach(data=>(data||[]).forEach(r=>{
        if(r.item_id!=null){
          if(!smAdjMap[r.item_id]) smAdjMap[r.item_id]=new Set();
          smAdjMap[r.item_id].add(r.item_adj_id);
        }
      }));
      Object.keys(smAdjMap).forEach(k=>{smAdjMap[k]=smAdjMap[k].size;});
      // Re-render with sales+adj data
      applySmFilters();
    }
  }catch(e){
    if(tbody) tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function applySmFilters(){
  const putaway=document.getElementById("sm-fil-putaway")?.value||"";
  const q=(document.getElementById("smSearch")?.value||"").toLowerCase();
  let rows=smPORows;
  if(putaway==="yes") rows=rows.filter(r=>smPOBills.some(b=>b.purchaseorder_id===r.id&&b.is_putaway===true));
  else if(putaway==="no") rows=rows.filter(r=>!smPOBills.some(b=>b.purchaseorder_id===r.id&&b.is_putaway===true));
  if(q){
    const items=smPOItems.filter(i=>(i.item_code||"").toLowerCase().includes(q)||(i.item_name||"").toLowerCase().includes(q));
    const matchedPOs=new Set(items.map(i=>i.purchaseorder_id));
    rows=rows.filter(r=>(r.purchaseorderNo||"").toLowerCase().includes(q)||(r.supplierName||"").toLowerCase().includes(q)||matchedPOs.has(r.id));
  }
  _smFiltered=rows;
  renderSmStats(rows);
  renderSmTable(rows);
}

function renderSmStats(rows){
  const poIds=new Set(rows.map(r=>r.id));
  const putawayCount=rows.filter(r=>smPOBills.some(b=>b.purchaseorder_id===r.id&&b.is_putaway===true)).length;
  // received qty: sum bill_items for bills linked to these POs
  const billIds=new Set(smPOBills.filter(b=>poIds.has(b.purchaseorder_id)).map(b=>b.bill_id));
  const rcvdQty=smPOBillItems.filter(bi=>billIds.has(bi.bill_id)).reduce((s,bi)=>s+(Number(bi.qty)||0),0);
  // sales + adj for items in these POs
  const itemIds=new Set(smPOItems.filter(i=>poIds.has(i.purchaseorder_id)).map(i=>i.item_id).filter(Boolean));
  const salesQty=[...itemIds].reduce((s,id)=>s+(smSalesMap[id]||0),0);
  const adjCount=[...itemIds].reduce((s,id)=>s+(smAdjMap[id]||0),0);
  document.getElementById("sm-s-total").textContent=rows.length;
  document.getElementById("sm-s-putaway").textContent=putawayCount;
  document.getElementById("sm-s-rcvd").textContent=rcvdQty?rcvdQty.toLocaleString("id-ID"):"—";
  document.getElementById("sm-s-sales").textContent=salesQty?salesQty.toLocaleString("id-ID"):"—";
  document.getElementById("sm-s-adj").textContent=adjCount||"—";
}

function renderSmTable(rows){
  rows=sortBy(rows,smSort.col,smSort.dir);
  updateSortTh("sm-thead",smSort.col,smSort.dir);
  const tbody=document.getElementById("smTableBody");
  document.getElementById("sm-tcount").textContent=rows.length+" entri";
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Tidak ada data.</td></tr>`;return;}
  const putawayPill=isPutaway=>{
    if(isPutaway) return `<span class="pill p-active" style="font-size:11px">✓ Putaway</span>`;
    return `<span class="pill p-near" style="font-size:11px">⏳ Belum</span>`;
  };
  tbody.innerHTML=rows.flatMap(r=>{
    const bills=smPOBills.filter(b=>b.purchaseorder_id===r.id);
    const isPutaway=bills.some(b=>b.is_putaway===true);
    const rcv=smPOReceives.find(rx=>rx.purchaseorder_no===r.purchaseorderNo);
    const rcvDate=rcv?fmtDate(rcv.transaction_date):"—";
    const location=bills.find(b=>b.location_name)?.location_name||r.locationName||"—";
    const items=smPOItems.filter(i=>i.purchaseorder_id===r.id);
    const hasItems=items.length>0;
    const gt=r.grandTotal!=null?`Rp ${Math.round(r.grandTotal).toLocaleString("id-ID")}`:"—";

    // Attach receive date for sorting
    r.receiveDate=rcv?.transaction_date||"";

    const main=`<tr>
      <td style="text-align:center;cursor:${hasItems?"pointer":"default"};color:var(--g400);user-select:none" onclick="${hasItems?`toggleSmItems(${r.id})`:""}" id="sm-toggle-${r.id}">${hasItems?"▶":""}</td>
      <td><a href="https://v2.jubelio.com/purchase/orders/detail/${r.id}" target="_blank" style="font-family:var(--mono);font-size:12px;color:#3C3489;text-decoration:none">${r.purchaseorderNo||r.id}</a></td>
      <td style="font-size:13px">${r.supplierName||"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.transactionDate)||"—"}</td>
      <td style="white-space:nowrap;font-size:12px">${rcvDate}</td>
      <td>${isPutaway?putawayPill(true):(bills.length?putawayPill(false):`<span class="pill p-draft" style="font-size:11px">Menunggu</span>`)}</td>
      <td><span style="font-size:12px">${location}</span></td>
      <td style="text-align:right;font-size:12px;font-weight:600">${items.length}</td>
      <td style="text-align:right;font-family:var(--mono);font-size:12px;font-weight:600">${gt}</td>
    </tr>`;

    // Build received qty map for this PO's bill items
    const billIds=new Set(bills.map(b=>b.bill_id));
    const rcvdByDetail={};
    smPOBillItems.filter(bi=>billIds.has(bi.bill_id)).forEach(bi=>{
      rcvdByDetail[bi.purchaseorder_detail_id]=(rcvdByDetail[bi.purchaseorder_detail_id]||0)+(Number(bi.qty)||0);
    });

    const detail=`<tr id="sm-items-${r.id}" style="display:none;background:var(--off)">
      <td></td>
      <td colspan="8" style="padding:8px 12px 14px">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400)">
            <th style="padding:4px 8px;text-align:left">Kode</th>
            <th style="padding:4px 8px;text-align:left">Nama Item</th>
            <th style="padding:4px 8px;text-align:right">PO Qty</th>
            <th style="padding:4px 8px;text-align:right">Diterima</th>
            <th style="padding:4px 8px">Stok Saat Ini</th>
            <th style="padding:4px 8px;text-align:right">Sales Qty</th>
            <th style="padding:4px 8px;text-align:right">Adj</th>
          </tr></thead>
          <tbody>${items.map(it=>{
            const rcvd=rcvdByDetail[it.purchaseorder_detail_id]||0;
            const rcvdC=rcvd===0?"color:var(--g400)":rcvd>=(it.qty||0)?"color:#2d8a4e":"color:#c0700a";
            const stock=[...(smStockMap[it.item_id]||[])].sort((a,b)=>{
              if(a.loc===location) return -1;
              if(b.loc===location) return 1;
              return a.loc.localeCompare(b.loc,"id");
            });
            const stockHtml=stock.length
              ? stock.map(s=>`<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:4px;border:1px solid var(--g200);background:var(--white);font-size:10px;font-family:var(--mono)">${s.loc} <b>${s.qty.toLocaleString("id-ID")}</b></span>`).join("")
              : `<span style="color:var(--g400);font-size:11px">—</span>`;
            const sales=smSalesMap[it.item_id]||0;
            const adj=smAdjMap[it.item_id]||0;
            return `<tr style="border-top:1px solid var(--g100)">
              <td style="padding:5px 8px;font-family:var(--mono);font-size:10px">${it.item_code||"—"}</td>
              <td style="padding:5px 8px">${it.item_name||"—"}</td>
              <td style="padding:5px 8px;text-align:right;font-weight:600">${it.qty!=null?Number(it.qty).toLocaleString("id-ID"):"—"}</td>
              <td style="padding:5px 8px;text-align:right;font-weight:600;${rcvdC}">${rcvd?rcvd.toLocaleString("id-ID"):"—"}</td>
              <td style="padding:5px 8px">${stockHtml}</td>
              <td style="padding:5px 8px;text-align:right;font-weight:600;color:#3C3489">${sales?sales.toLocaleString("id-ID"):"—"}</td>
              <td style="padding:5px 8px;text-align:right;color:${adj?"#c0700a":"var(--g400)"};font-weight:${adj?600:400}">${adj||"—"}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </td>
    </tr>`;
    return [main,detail];
  }).join("");
}

function toggleSmItems(poId){
  const row=document.getElementById(`sm-items-${poId}`);
  const tog=document.getElementById(`sm-toggle-${poId}`);
  if(!row) return;
  const open=row.style.display==="table-row";
  row.style.display=open?"none":"table-row";
  if(tog) tog.textContent=open?"▶":"▼";
}

function clearSmFilters(){
  ["sm-fil-status","sm-fil-putaway","sm-fil-from","sm-fil-to"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const s=document.getElementById("smSearch");if(s)s.value="";
  loadStockMovement();
}

async function syncSMNow(){
  const btn=document.getElementById("sm-sync-btn");
  const se=document.getElementById("sm-sync-status");
  const now=Date.now();
  if(now<_smSyncCooldown){
    if(se) se.textContent=`Tunggu ${Math.ceil((_smSyncCooldown-now)/1000)}s lagi.`;
    return;
  }
  if(btn){btn.disabled=true;btn.textContent="⟳ Syncing...";}
  // Sync sequence: PO bills → receives → inventory → adjustments
  const steps=[
    {slug:"sync-jubelio-purchase-bills",  label:"bills"},
    {slug:"sync-jubelio-purchase-receives",label:"receives"},
    {slug:"sync-jubelio-inventory",        label:"inventory"},
    {slug:"sync-jubelio-inventory-adjustments",label:"adjustments"},
  ];
  const results=[];
  for(const step of steps){
    if(se) se.textContent=`Syncing ${step.label}...`;
    try{
      const j=await callEdgeFunction(step.slug);
      results.push(`${step.label} ✓`);
    }catch(e){
      results.push(`${step.label} ✗`);
    }
  }
  _smSyncCooldown=Date.now()+60000;
  if(se) se.textContent=results.join(" · ");
  if(btn){btn.disabled=false;btn.textContent="⟳ Sync dari Jubelio";}
  await loadStockMovement();
}

// ── WAREHOUSE KPI ──
// All data from existing jubelio_purchase_* tables — no separate putaway sync needed.
// jubelio_purchase_bills.is_putaway = true  ←  the "putaway done" flag
// bill_items join via bill_id (NOT purchaseorder_id — that column doesn't exist on bill_items)
let whBills        = [];   // jubelio_purchase_bills
let whPOItems      = [];   // jubelio_purchase_order_items (ordered qty)
let whShipments    = [];   // jubelio_sales_orders WHERE wms_status=COMPLETED (all pages)
let whReturns      = [];   // jubelio_sales_orders WHERE wms_status=RETURNED
let whAdjHeaders   = [];   // jubelio_inventory_adjustments
let whBillItems    = [];   // jubelio_purchase_bill_items  (received qty, key: bill_id)
let whPORows       = [];   // jubelio_purchase_orders (for PO header display)
let whCourierStats = [];   // wh_courier_stats view — all-time aggregate, no row-limit issue
let whOPage = 0;           // outbound log pagination
let whIPage = 0;           // inventory log pagination

async function loadWHData() {
  const tbody  = document.getElementById("wh-log-body");
  const recvTb = document.getElementById("wh-recv-body");
  if (tbody)  tbody.innerHTML  = `<tr><td class="empty-td" colspan="5">Memuat...</td></tr>`;
  if (recvTb) recvTb.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;

  let bills, poItems, bItems, poRows, ships, adjs, rets, cStatsRes;
  try {
    [ bills, poItems, bItems, poRows, ships, adjs, rets, cStatsRes ] = await Promise.all([
      _fetchAllPages("jubelio_purchase_bills","bill_id,bill_no,purchaseorder_id,supplier_name,transaction_date,location_name,is_putaway",q=>q.order("transaction_date",{ascending:false})),
      _fetchAllPages("jubelio_purchase_order_items","purchaseorder_id,qty"),
      _fetchAllPages("jubelio_purchase_bill_items","bill_id,qty"),
      _fetchAllPages("jubelio_purchase_orders","purchaseorder_id,purchaseorder_no,supplier_name,transaction_date,status"),
      _fetchAllPages("jubelio_sales_orders","salesorder_id,salesorder_no,transaction_date,awb_created_date,location_name,customer_name,courier",q=>q.eq("wms_status","COMPLETED").order("transaction_date",{ascending:false})),
      _fetchAllPages("jubelio_inventory_adjustments","item_adj_id,item_adj_no,transaction_date,location_name,net_qty,item_count,note",q=>q.order("transaction_date",{ascending:false})),
      _fetchAllPages("jubelio_sales_orders","salesorder_id,courier,transaction_date,location_name",q=>q.eq("wms_status","RETURNED")),
      sb.from("wh_courier_stats").select("courier,completed_count,returned_count,total_count"),
    ]);
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td class="empty-td" colspan="5">Gagal memuat: ${e.message||e}</td></tr>`;
    return;
  }

  whBills        = bills   || [];
  whPOItems      = poItems || [];
  whBillItems    = bItems  || [];
  whPORows       = poRows  || [];
  whShipments    = ships   || [];
  whAdjHeaders   = adjs    || [];
  whReturns      = rets    || [];
  whCourierStats = cStatsRes?.data || [];

  populateWHGudangFilter();
  renderWHDashboard();
}

function whPeriodCutoff() {
  const v = document.getElementById("wh-period")?.value || "30";
  if (v === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(v));
  return d.toISOString();
}

function whPeriodLabel() {
  const v = document.getElementById("wh-period")?.value || "30";
  const map = { "7": "7 hari terakhir", "30": "30 hari terakhir", "90": "90 hari terakhir", "all": "semua waktu" };
  return "(" + (map[v] || v + " hari terakhir") + ")";
}

function whGudangFilter() {
  return document.getElementById("wh-gudang")?.value || "all";
}

function whOGoPage(dir) {
  const total = document.getElementById("wh-o-tcount")?.dataset.total || 0;
  const maxPage = Math.max(0, Math.ceil(parseInt(total) / 10) - 1);
  whOPage = Math.min(maxPage, Math.max(0, whOPage + dir));
  renderWHDashboard();
}

function whIGoPage(dir) {
  const total = document.getElementById("wh-i-tcount")?.dataset.total || 0;
  const maxPage = Math.max(0, Math.ceil(parseInt(total) / 10) - 1);
  whIPage = Math.min(maxPage, Math.max(0, whIPage + dir));
  renderWHDashboard();
}

function populateWHGudangFilter() {
  const sel = document.getElementById("wh-gudang");
  if (!sel) return;
  const cur = sel.value;
  // Collect distinct location_name values from all loaded datasets
  const locs = new Set();
  for (const b of whBills)      if (b.location_name) locs.add(b.location_name);
  for (const s of whShipments)  if (s.location_name) locs.add(s.location_name);
  for (const a of whAdjHeaders) if (a.location_name) locs.add(a.location_name);
  const sorted = [...locs].sort((a, b) => a.localeCompare(b, "id"));
  sel.innerHTML = `<option value="all">Semua Gudang</option>` +
    sorted.map(l => `<option value="${l}"${cur === l ? " selected" : ""}>${l}</option>`).join("");
}

function renderWHDashboard() {
  const cutoff = whPeriodCutoff();
  const gudang = whGudangFilter();
  const byGudang = arr => gudang === "all" ? arr : arr.filter(r => r.location_name === gudang);

  // Update all period labels in chart headings
  const lbl = whPeriodLabel();
  document.querySelectorAll(".wh-period-lbl").forEach(el => el.textContent = lbl);

  // Bills filtered by period + gudang
  const periodBills = byGudang(cutoff
    ? whBills.filter(b => b.transaction_date && b.transaction_date >= cutoff)
    : whBills);

  // Putaway bills only (within period + gudang)
  const putawayBills = periodBills.filter(b => b.is_putaway === true);

  // bill_id → purchaseorder_id map (from ALL bills, not just period)
  const billPoMap = {};
  for (const b of whBills) billPoMap[b.bill_id] = b.purchaseorder_id;

  // bill_items qty summed per bill_id
  const billItemQty = {};
  for (const it of whBillItems) {
    billItemQty[it.bill_id] = (billItemQty[it.bill_id] || 0) + parseFloat(it.qty || 0);
  }

  // bill_items qty summed per purchaseorder_id (via billPoMap)
  const billPoQty = {};
  for (const [billId, qty] of Object.entries(billItemQty)) {
    const poId = billPoMap[billId];
    if (poId != null) billPoQty[poId] = (billPoQty[poId] || 0) + qty;
  }

  // po_items qty per purchaseorder_id
  const poQtyMap = {};
  for (const it of whPOItems) {
    poQtyMap[it.purchaseorder_id] = (poQtyMap[it.purchaseorder_id] || 0) + parseFloat(it.qty || 0);
  }

  // KPI 1 — putaway count
  const totalPutaway = putawayBills.length;

  // KPI 2 — items received in putaway bills
  const totalItems = putawayBills.reduce((s, b) => s + (billItemQty[b.bill_id] || 0), 0);

  // KPI 3 — bills not yet putaway (within period)
  const notPutaway = periodBills.filter(b => b.is_putaway !== true).length;

  // KPI 4 & 5 — receiving accuracy across ALL POs with items
  const poIds = Object.keys(poQtyMap);
  let accurate = 0, needFix = 0;
  for (const id of poIds) {
    const ordered  = poQtyMap[id]   || 0;
    const received = billPoQty[id]  || 0;
    if (received >= ordered) accurate++;
    else needFix++;
  }
  const recvTotal = poIds.length;
  const accuracyStr = recvTotal > 0 ? ((accurate / recvTotal) * 100).toFixed(1) + "%" : "—";

  document.getElementById("wh-k-putaway").textContent  = totalPutaway;
  document.getElementById("wh-k-items").textContent    = Math.round(totalItems);
  document.getElementById("wh-k-pending").textContent  = notPutaway;
  document.getElementById("wh-k-recv").textContent     = accuracyStr;

  // Inbound trend + location — follow period filter
  renderWHTrendChart(putawayBills);
  renderWHLocTable(putawayBills, billItemQty);
  renderWHLog(putawayBills, billItemQty);
  renderWHRecvDetail(poQtyMap, billPoQty);

  // Outbound
  const periodShips = byGudang(cutoff
    ? whShipments.filter(s => s.transaction_date && s.transaction_date >= cutoff)
    : whShipments);
  const periodRets = byGudang(cutoff
    ? whReturns.filter(r => r.transaction_date && r.transaction_date >= cutoff)
    : whReturns);
  renderWHOutbound(periodShips, periodRets);

  // Inventory
  const periodAdjs = byGudang(cutoff
    ? whAdjHeaders.filter(a => a.transaction_date && a.transaction_date >= cutoff)
    : whAdjHeaders);
  renderWHInventory(periodAdjs);
}

function renderWHTrendChart(putawayBills) {
  renderWHBarChart("wh-trend-chart", putawayBills, "transaction_date");
}

function renderWHLocTable(putawayBills, billItemQty) {
  const el = document.getElementById("wh-loc-table");
  if (!el) return;
  if (!putawayBills.length) {
    el.innerHTML = `<div style="color:var(--g400);font-size:12px">Belum ada data penerimaan.</div>`;
    return;
  }
  // Build locMap weighted by items received (richer than just count)
  const locMap = {};
  for (const b of putawayBills) {
    const loc = b.location_name || "(tanpa lokasi)";
    if (!locMap[loc]) locMap[loc] = { count: 0, items: 0 };
    locMap[loc].count++;
    locMap[loc].items += billItemQty[b.bill_id] || 0;
  }
  const sorted   = Object.entries(locMap).sort((a, b) => b[1].items - a[1].items);
  const maxItems = sorted[0]?.[1].items || 1;
  el.innerHTML = sorted.map(([loc, s]) => {
    const pct = Math.max(Math.round((s.items / maxItems) * 100), 3);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span>${loc}</span>
        <span style="font-family:'DM Mono',monospace;color:var(--g600)">${Math.round(s.items)} items · ${s.count} bill</span>
      </div>
      <div style="height:6px;background:var(--off);border-radius:3px">
        <div style="height:6px;width:${pct}%;background:var(--black);border-radius:3px"></div>
      </div>
    </div>`;
  }).join("");
}

function renderWHLog(putawayBills, billItemQty) {
  const tbody  = document.getElementById("wh-log-body");
  const tcount = document.getElementById("wh-tcount");
  if (!tbody) return;
  if (tcount) tcount.textContent = `${putawayBills.length} entri`;

  if (!putawayBills.length) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="5">Belum ada bill dengan status putaway dalam periode ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = putawayBills.map(b => {
    const tgl   = b.transaction_date ? b.transaction_date.slice(0, 10) : "—";
    const items = billItemQty[b.bill_id] != null ? Math.round(billItemQty[b.bill_id]) : "—";
    const billLink = b.bill_id
      ? `<a href="https://v2.jubelio.com/warehouse/item_in/item_receives/view/${b.bill_id}" target="_blank" style="color:inherit;text-decoration:underline dotted">${b.bill_no || b.bill_id}</a>`
      : (b.bill_no || "—");
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${billLink}</td>
      <td>${tgl}</td>
      <td>${b.supplier_name || "—"}</td>
      <td>${b.location_name || "—"}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${items}</td>
    </tr>`;
  }).join("");
}

function renderWHRecvDetail(poQtyMap, billPoQty) {
  const tbody  = document.getElementById("wh-recv-body");
  const tcount = document.getElementById("wh-recv-tcount");
  if (!tbody) return;

  if (!whPORows.length) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="8">Data PO belum dimuat.</td></tr>`;
    return;
  }

  // Build PO → gudang map from bills (first bill wins per PO)
  const poLocMap = {};
  for (const b of whBills) {
    if (b.purchaseorder_id && b.location_name && !poLocMap[b.purchaseorder_id]) {
      poLocMap[b.purchaseorder_id] = b.location_name;
    }
  }

  const detail = whPORows
    .filter(p => poQtyMap[p.purchaseorder_id] != null)
    .map(p => {
      const ordered  = poQtyMap[p.purchaseorder_id] || 0;
      const received = billPoQty[p.purchaseorder_id] || 0;
      const diff     = received - ordered;
      return { ...p, ordered, received, diff };
    })
    .sort((a, b) => a.diff - b.diff);

  if (tcount) tcount.textContent = `${detail.length} PO diperiksa`;

  if (!detail.length) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="8">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = detail.map(p => {
    const diffStr = p.diff >= 0
      ? `<span style="color:#2d7a2d">+${Math.round(p.diff)}</span>`
      : `<span style="color:#c0392b">${Math.round(p.diff)}</span>`;
    const status = p.diff >= 0
      ? `<span class="pill p-active">OK</span>`
      : `<span class="pill p-near">Kurang</span>`;
    const tgl = p.transaction_date ? p.transaction_date.slice(0, 10) : "—";
    const loc = poLocMap[p.purchaseorder_id] || "—";
    const poLink = p.purchaseorder_id
      ? `<a href="https://v2.jubelio.com/purchasing/transactions/order/view/${p.purchaseorder_id}" target="_blank" style="color:inherit;text-decoration:underline dotted">${p.purchaseorder_no || p.purchaseorder_id}</a>`
      : (p.purchaseorder_no || "—");
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${poLink}</td>
      <td>${p.supplier_name || "—"}</td>
      <td style="font-size:11px;color:var(--g600)">${loc}</td>
      <td>${tgl}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${Math.round(p.ordered)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${Math.round(p.received)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${diffStr}</td>
      <td>${status}</td>
    </tr>`;
  }).join("");
}

function renderWHOutbound(periodShips, periodRets) {
  // ── KPI cards ──────────────────────────────────────────────
  const shipped   = periodShips.length;
  const openEl    = document.getElementById("wh-o-open");
  const openCount = openEl ? (parseInt(openEl.dataset.live || "0") || 0) : 0;
  const fRate = (shipped + openCount) > 0
    ? ((shipped / (shipped + openCount)) * 100).toFixed(1) + "%"
    : shipped > 0 ? "100%" : "—";

  // Avg order → AWB hours
  let awbSum = 0, awbCount = 0;
  for (const s of periodShips) {
    if (s.awb_created_date && s.transaction_date) {
      const diff = (new Date(s.awb_created_date) - new Date(s.transaction_date)) / 3600000;
      if (diff >= 0 && diff < 720) { awbSum += diff; awbCount++; }  // ignore outliers >30 days
    }
  }
  const avgAwb = awbCount > 0 ? (awbSum / awbCount).toFixed(1) : "—";

  // Return rate (period-filtered)
  const retRate = (shipped + periodRets.length) > 0
    ? ((periodRets.length / (shipped + periodRets.length)) * 100).toFixed(1) + "%"
    : "—";

  if (document.getElementById("wh-o-shipped"))  document.getElementById("wh-o-shipped").textContent  = shipped;
  if (document.getElementById("wh-o-avgawb"))   document.getElementById("wh-o-avgawb").textContent   = avgAwb;
  if (document.getElementById("wh-o-rate"))     document.getElementById("wh-o-rate").textContent     = fRate;
  if (document.getElementById("wh-o-retrate"))  document.getElementById("wh-o-retrate").textContent  = retRate;

  // ── Trend + per-gudang ─────────────────────────────────────
  renderWHBarChart("wh-o-trend", periodShips, "transaction_date");
  const locMap = {};
  for (const s of periodShips) {
    const loc = s.location_name || "(tanpa lokasi)";
    locMap[loc] = (locMap[loc] || 0) + 1;
  }
  renderWHLocBars("wh-o-loc", locMap, "order");

  // ── Courier volume ─────────────────────────────────────────
  const courierVol = {};
  for (const s of periodShips) {
    const c = (s.courier || "").trim() || "(tanpa kurir)";
    courierVol[c] = (courierVol[c] || 0) + 1;
  }
  renderWHLocBars("wh-o-courier-vol", courierVol, "order");

  // ── Courier reliability — period-aware ──────────────────────
  // "Semua waktu": use wh_courier_stats aggregate view (bypasses 1000-row cap, accurate).
  // Any other period: compute directly from periodShips + periodRets (already filtered).
  const relEl = document.getElementById("wh-o-courier-rel");
  if (relEl) {
    const isAllTime = (document.getElementById("wh-period")?.value || "30") === "all";
    let reliStats;

    if (isAllTime) {
      // All-time: aggregate view has accurate totals across all 11k+ orders
      reliStats = whCourierStats
        .filter(r => r.courier !== "(tanpa kurir)")
        .sort((a, b) => b.completed_count - a.completed_count)
        .slice(0, 8)
        .map(r => {
          const total = r.completed_count + r.returned_count;
          const rate  = total > 0 ? (r.returned_count / total) * 100 : 0;
          return { c: r.courier, comp: r.completed_count, ret: r.returned_count, total, rate };
        });
    } else {
      // Period-filtered: count from the same arrays driving the rest of the dashboard
      const compByC = {}, retByC = {};
      for (const s of periodShips) {
        const c = (s.courier || "").trim() || "(tanpa kurir)";
        compByC[c] = (compByC[c] || 0) + 1;
      }
      for (const r of periodRets) {
        const c = (r.courier || "").trim() || "(tanpa kurir)";
        retByC[c] = (retByC[c] || 0) + 1;
      }
      const couriers = [...new Set([...Object.keys(compByC), ...Object.keys(retByC)])]
        .filter(c => c !== "(tanpa kurir)")
        .sort((a, b) => (compByC[b] || 0) - (compByC[a] || 0))
        .slice(0, 8);
      reliStats = couriers.map(c => {
        const comp  = compByC[c] || 0;
        const ret   = retByC[c]  || 0;
        const total = comp + ret;
        const rate  = total > 0 ? (ret / total) * 100 : 0;
        return { c, comp, ret, total, rate };
      });
    }

    if (!reliStats.length) {
      relEl.innerHTML = `<div style="color:var(--g400);font-size:12px">Belum ada data.</div>`;
    } else {
      // Fixed 10% scale: 10% return rate = full bar width. Honest, not relative.
      relEl.innerHTML = reliStats.map(({ c, comp, ret, total, rate }) => {
        const rateStr = rate.toFixed(1);
        const barPct  = Math.max(Math.min(rate * 10, 100), ret > 0 ? 3 : 0);
        const color   = rate === 0 ? "var(--g400)" : rate < 1 ? "#2d7a2d" : rate < 3 ? "#e67e00" : "#c0392b";
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span>${c}</span>
            <span style="font-family:'DM Mono',monospace;color:${color}">${rateStr}% — ${ret} retur / ${comp} shipped</span>
          </div>
          <div style="height:6px;background:var(--off);border-radius:3px">
            <div style="height:6px;width:${barPct}%;background:${color};border-radius:3px"></div>
          </div>
        </div>`;
      }).join("");
    }
  }

  // ── Log table (paginated 10/page) ─────────────────────────
  const tbody  = document.getElementById("wh-o-body");
  const tcount = document.getElementById("wh-o-tcount");
  const total  = periodShips.length;
  const page   = whOPage;
  const start  = page * 10;
  const end    = Math.min(start + 10, total);
  const slice  = periodShips.slice(start, end);

  if (tcount) {
    tcount.textContent = total > 0 ? `${start + 1}–${end} dari ${total}` : "0 entri";
    tcount.dataset.total = total;
  }
  if (!tbody) return;
  if (!total) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="5">Belum ada data dalam periode ini.</td></tr>`;
    return;
  }
  tbody.innerHTML = slice.map(s => {
    const tgl = s.transaction_date ? s.transaction_date.slice(0, 10) : "—";
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${s.salesorder_no || "—"}</td>
      <td>${tgl}</td>
      <td>${s.customer_name || "—"}</td>
      <td>${s.location_name || "—"}</td>
      <td>${s.courier || "—"}</td>
    </tr>`;
  }).join("");
}

function renderWHInventory(periodAdjs) {
  const total    = periodAdjs.length;
  const shrink   = periodAdjs.filter(a => parseFloat(a.net_qty || 0) < 0).length;
  const skus     = periodAdjs.reduce((s, a) => s + (a.item_count || 0), 0);
  const netQty   = periodAdjs.reduce((s, a) => s + parseFloat(a.net_qty || 0), 0);
  const netStr   = netQty > 0 ? "+" + Math.round(netQty) : Math.round(netQty).toString();

  if (document.getElementById("wh-i-total"))  document.getElementById("wh-i-total").textContent  = total;
  if (document.getElementById("wh-i-shrink")) document.getElementById("wh-i-shrink").textContent = shrink;
  if (document.getElementById("wh-i-items"))  document.getElementById("wh-i-items").textContent  = skus;
  if (document.getElementById("wh-i-net"))    document.getElementById("wh-i-net").textContent    = netStr;

  // Trend (follow period filter)
  renderWHBarChart("wh-i-trend", periodAdjs, "transaction_date");

  // Per-gudang (follow period filter)
  const locMap = {};
  for (const a of periodAdjs) {
    const loc = a.location_name || "(tanpa lokasi)";
    locMap[loc] = (locMap[loc] || 0) + 1;
  }
  renderWHLocBars("wh-i-loc", locMap, "adj");

  // Log table (paginated 10/page)
  const tbody  = document.getElementById("wh-i-body");
  const tcount = document.getElementById("wh-i-tcount");
  const iTot   = periodAdjs.length;
  const iStart = whIPage * 10;
  const iEnd   = Math.min(iStart + 10, iTot);
  const iSlice = periodAdjs.slice(iStart, iEnd);

  if (tcount) {
    tcount.textContent = iTot > 0 ? `${iStart + 1}–${iEnd} dari ${iTot}` : "0 entri";
    tcount.dataset.total = iTot;
  }
  if (!tbody) return;
  if (!iTot) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="6">Belum ada data dalam periode ini.</td></tr>`;
    return;
  }
  tbody.innerHTML = iSlice.map(a => {
    const tgl  = a.transaction_date ? a.transaction_date.slice(0, 10) : "—";
    const qty  = parseFloat(a.net_qty || 0);
    const qStr = qty > 0
      ? `<span style="color:#2d7a2d">+${Math.round(qty)}</span>`
      : qty < 0
        ? `<span style="color:#c0392b">${Math.round(qty)}</span>`
        : "0";
    const adjLink = a.item_adj_id
      ? `<a href="https://v2.jubelio.com/inventory/stock_transaction/adjustment_qty/view/${a.item_adj_id}" target="_blank" style="color:inherit;text-decoration:underline dotted">${a.item_adj_no || a.item_adj_id}</a>`
      : (a.item_adj_no || "—");
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${adjLink}</td>
      <td>${tgl}</td>
      <td>${a.location_name || "—"}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${a.item_count ?? "—"}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${qStr}</td>
      <td style="font-size:11px;color:var(--g600)">${a.note || "—"}</td>
    </tr>`;
  }).join("");
}

// Shared bar chart helper (by month, always all-time)
function renderWHBarChart(elId, rows, dateField) {
  const el = document.getElementById(elId);
  if (!el) return;
  const monthMap = {};
  for (const r of rows) {
    if (!r[dateField]) continue;
    const key = r[dateField].slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + 1;
  }
  const keys = Object.keys(monthMap).sort();
  if (!keys.length) {
    el.innerHTML = `<div style="color:var(--g400);font-size:12px;padding:0.5rem 0">Belum ada data.</div>`;
    return;
  }
  const maxVal = Math.max(...keys.map(k => monthMap[k]), 1);
  const chartH = 100;
  const barW   = Math.min(44, Math.floor((el.offsetWidth || 360) / keys.length) - 4);
  el.innerHTML = keys.map(k => {
    const v   = monthMap[k];
    const pct = Math.max((v / maxVal) * chartH, 4);
    const lbl = k.slice(5) + "/" + k.slice(2, 4);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:${barW}px">
      <div style="font-size:10px;color:var(--g600);font-family:'DM Mono',monospace">${v}</div>
      <div style="width:${barW-6}px;height:${pct}px;background:var(--black);border-radius:3px 3px 0 0"></div>
      <div style="font-size:9px;color:var(--g400);font-family:'DM Mono',monospace;white-space:nowrap">${lbl}</div>
    </div>`;
  }).join("") + `<div style="position:absolute;bottom:18px;left:0;right:0;height:1px;background:var(--g200)"></div>`;
}

// Shared location bar helper
function renderWHLocBars(elId, locMap, unit) {
  const el = document.getElementById(elId);
  if (!el) return;
  const sorted = Object.entries(locMap).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) { el.innerHTML = `<div style="color:var(--g400);font-size:12px">Belum ada data.</div>`; return; }
  const maxVal = sorted[0][1] || 1;
  el.innerHTML = sorted.map(([loc, v]) => {
    const pct = Math.max(Math.round((v / maxVal) * 100), 3);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span>${loc}</span>
        <span style="font-family:'DM Mono',monospace;color:var(--g600)">${v} ${unit}</span>
      </div>
      <div style="height:6px;background:var(--off);border-radius:3px">
        <div style="height:6px;width:${pct}%;background:var(--black);border-radius:3px"></div>
      </div>
    </div>`;
  }).join("");
}

async function whSyncNow() {
  const btn = document.getElementById("wh-sync-btn");
  const se  = document.getElementById("wh-sync-status");
  if (btn) { btn.disabled = true; btn.textContent = "Syncing..."; }
  if (se) se.textContent = "";
  try {
    // Run warehouse sync (putaway + shipments + adjustments) + PO sync in parallel
    const [wh, po] = await Promise.all([
      callEdgeFunction("sync-jubelio-warehouse"),
      callEdgeFunction("sync-jubelio-purchase-orders"),
    ]);
    // Store live open order count for fulfillment rate calculation
    const openEl = document.getElementById("wh-o-open");
    if (openEl && wh.openOrders != null) {
      openEl.textContent       = wh.openOrders;
      openEl.dataset.live      = wh.openOrders;
    }
    const parts = [
      `✓ ${po.headersUpserted||0} PO`,
      `${wh.shipmentsUpserted||0} shipped`,
      `${wh.adjUpserted||0} adj`,
    ];
    if (se) se.textContent = parts.join(" · ");
  } catch (err) {
    if (se) se.textContent = `✗ ${err.message}`;
  }
  if (btn) { btn.disabled = false; btn.textContent = "⟳ Sync"; }
  await loadWHData();
}

// ── RETURN REASON MGMT ──
const RET_PRESETS = [
  "Produk Rusak / Cacat", "Salah Kirim", "Tidak Sesuai Deskripsi",
  "Pembeli Tidak Jadi", "Gagal Antar", "Paket Tidak Diambil", "Lainnya",
];
const RET_GROUPS = {
  "Kualitas Produk": ["Produk Rusak / Cacat"],
  "Operasional":     ["Salah Kirim", "Gagal Antar", "Paket Tidak Diambil"],
  "Pembeli":         ["Tidak Sesuai Deskripsi", "Pembeli Tidak Jadi"],
  "Lainnya":         ["Lainnya"],
};
const RET_GROUP_COLORS = {
  "Kualitas Produk": "#c0392b", "Operasional": "#e67e00",
  "Pembeli": "#3C3489",         "Lainnya": "var(--g400)",
};
const RET_CAT_COLORS = {
  "Produk Rusak / Cacat": "#c0392b", "Salah Kirim": "#e67e00",
  "Tidak Sesuai Deskripsi": "#3C3489", "Pembeli Tidak Jadi": "#6B5CE7",
  "Gagal Antar": "#e67e00",           "Paket Tidak Diambil": "#e6a817",
  "Lainnya": "var(--g400)",
};

let retOrders   = [];   // jubelio_sales_orders WHERE wms_status=RETURNED
let retReasons  = {};   // { salesorder_id → { reason_category, notes, categorized_by } }
let retUserCats = [];   // user-added categories

async function loadRetData() {
  const tbody = document.getElementById("ret-tbody");
  if (tbody) tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;

  let orders, reasons;
  try {
    [orders, reasons] = await Promise.all([
      _fetchAllPages("jubelio_sales_orders","salesorder_id,salesorder_no,transaction_date,location_name,customer_name,courier",q=>q.eq("wms_status","RETURNED").order("transaction_date",{ascending:false})),
      _fetchAllPages("return_reason_categories","salesorder_id,reason_category,notes,categorized_by,updated_at"),
    ]);
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Error: ${e.message||e}</td></tr>`;
    return;
  }

  retOrders  = orders  || [];
  retReasons = {};
  for (const r of (reasons || [])) retReasons[r.salesorder_id] = r;

  const usedCats = [...new Set((reasons || []).map(r => r.reason_category))];
  retUserCats = usedCats.filter(c => !RET_PRESETS.includes(c));

  populateRetKurirFilter();
  populateRetCatFilter();
  renderRetStats();
  renderRetTable();
}

function populateRetKurirFilter() {
  const sel = document.getElementById("ret-f-kurir");
  if (!sel) return;
  const cur  = sel.value;
  const kurirs = [...new Set(retOrders.map(o => (o.courier||"").trim()).filter(Boolean))].sort();
  sel.innerHTML = `<option value="all">Semua Kurir</option>` +
    kurirs.map(k => `<option value="${k}"${cur===k?" selected":""}>${k}</option>`).join("");
}

function populateRetCatFilter() {
  const sel = document.getElementById("ret-f-cat");
  if (!sel) return;
  const cur = sel.value;
  const userOpts = retUserCats.length
    ? `<optgroup label="Custom">${retUserCats.map(c=>`<option value="${c}"${cur===c?" selected":""}>${c}</option>`).join("")}</optgroup>`
    : "";
  sel.innerHTML = `
    <option value="all">Semua Kategori</option>
    <option value="__none__"${cur==="__none__"?" selected":""}>— Belum Dikategori</option>
    <optgroup label="Preset">
      ${RET_PRESETS.map(c=>`<option value="${c}"${cur===c?" selected":""}>${c}</option>`).join("")}
    </optgroup>
    ${userOpts}`;
}

function renderRetStats() {
  const total  = retOrders.length;
  const done   = retOrders.filter(o => retReasons[o.salesorder_id]).length;
  const undone = total - done;
  const pct    = total > 0 ? ((done / total) * 100).toFixed(0) + "%" : "—";
  const el = id => document.getElementById(id);
  if (el("ret-total"))  el("ret-total").textContent  = total;
  if (el("ret-done"))   el("ret-done").textContent   = done;
  if (el("ret-undone")) el("ret-undone").textContent = undone;
  if (el("ret-pct"))    el("ret-pct").textContent    = pct;

  // ── Group breakdown ──
  const grpEl = document.getElementById("ret-grp-chart");
  if (grpEl) {
    const counts = {};
    for (const o of retOrders) {
      const cat = retReasons[o.salesorder_id]?.reason_category || null;
      const grp = cat
        ? (Object.keys(RET_GROUPS).find(g => RET_GROUPS[g].includes(cat)) || "Lainnya")
        : "Belum Dikategori";
      counts[grp] = (counts[grp] || 0) + 1;
    }
    const order = [...Object.keys(RET_GROUPS), "Belum Dikategori"];
    const rows  = order.filter(k => counts[k]).map(k => ({ k, n: counts[k] }));
    const maxN  = Math.max(...rows.map(r => r.n), 1);
    grpEl.innerHTML = rows.map(({ k, n }) => {
      const bar   = Math.max(Math.round((n / maxN) * 100), 3);
      const color = RET_GROUP_COLORS[k] || "var(--g400)";
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${k}</span>
          <span style="font-family:'DM Mono',monospace;color:${color}">${n} order · ${Math.round(n/total*100)}%</span>
        </div>
        <div style="height:6px;background:var(--off);border-radius:3px">
          <div style="height:6px;width:${bar}%;background:${color};border-radius:3px"></div>
        </div>
      </div>`;
    }).join("");
  }

  // ── Per-category breakdown ──
  const catEl = document.getElementById("ret-cat-chart");
  if (catEl) {
    const catCounts = {};
    for (const o of retOrders) {
      const cat = retReasons[o.salesorder_id]?.reason_category;
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const catDone  = Object.values(catCounts).reduce((s,n)=>s+n,0);
    const catRows  = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
    const catMax   = Math.max(...catRows.map(r=>r[1]), 1);
    catEl.innerHTML = catRows.length
      ? catRows.map(([c, n]) => {
          const bar   = Math.max(Math.round((n / catMax) * 100), 3);
          const color = RET_CAT_COLORS[c] || "#3C3489";
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
              <span>${c}</span>
              <span style="font-family:'DM Mono',monospace;color:${color}">${n} · ${Math.round(n/catDone*100)}%</span>
            </div>
            <div style="height:6px;background:var(--off);border-radius:3px">
              <div style="height:6px;width:${bar}%;background:${color};border-radius:3px"></div>
            </div>
          </div>`;
        }).join("")
      : `<div style="color:var(--g400);font-size:12px">Belum ada data.</div>`;
  }
}

function retGetFiltered() {
  const catF    = document.getElementById("ret-f-cat")?.value    || "all";
  const kurirF  = document.getElementById("ret-f-kurir")?.value  || "all";
  const searchF = (document.getElementById("ret-f-search")?.value || "").toLowerCase().trim();
  return retOrders.filter(o => {
    const cat = retReasons[o.salesorder_id]?.reason_category || null;
    if (catF === "__none__" && cat) return false;
    if (catF !== "all" && catF !== "__none__" && cat !== catF) return false;
    if (kurirF !== "all" && (o.courier || "").trim() !== kurirF) return false;
    if (searchF) {
      const hay = `${o.salesorder_no||""} ${o.customer_name||""}`.toLowerCase();
      if (!hay.includes(searchF)) return false;
    }
    return true;
  });
}

function clearRetFilters() {
  const el = id => document.getElementById(id);
  if (el("ret-f-cat"))    el("ret-f-cat").value    = "all";
  if (el("ret-f-kurir"))  el("ret-f-kurir").value  = "all";
  if (el("ret-f-search")) el("ret-f-search").value = "";
  renderRetTable();
}

function retCatSelectHTML(soId, currentCat) {
  const allCats = [...RET_PRESETS, ...retUserCats.filter(c => !RET_PRESETS.includes(c))];
  const opts = allCats.map(c =>
    `<option value="${c}"${c===currentCat?" selected":""}>${c}</option>`
  ).join("");
  return `<select onchange="retSelectChange('${soId}',this)"
    style="font-size:12px;padding:3px 8px;border:1px solid var(--g200);border-radius:4px;width:100%;background:var(--white);max-width:200px">
    <option value="">— Pilih —</option>
    ${opts}
    <option value="__new__">＋ Tambah baru...</option>
  </select>`;
}

function retNotesHTML(soId, currentNotes) {
  const safe = (currentNotes||"").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  return `<input type="text" value="${safe}" placeholder="Opsional..."
    onblur="saveRetNotes('${soId}',this.value)"
    onkeydown="if(event.key==='Enter')this.blur()"
    style="font-size:12px;padding:3px 8px;border:1px solid var(--g200);border-radius:4px;width:100%;background:var(--white);outline:none;max-width:180px">`;
}

function retSelectChange(soId, selectEl) {
  const val = selectEl.value;
  if (val === "__new__") retStartNewCat(soId, selectEl);
  else if (val)          saveRetCategory(soId, val);
}

function retStartNewCat(soId, selectEl) {
  const prev = retReasons[soId]?.reason_category || "";
  const wrap = selectEl.parentElement;
  wrap.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center">
      <input type="text" id="ret-new-${soId}" placeholder="Nama kategori baru"
        style="flex:1;font-size:12px;padding:3px 6px;border:1px solid var(--black);border-radius:4px;outline:none"
        onkeydown="if(event.key==='Enter')retConfirmNewCat('${soId}');if(event.key==='Escape')retCancelNewCat('${soId}','${prev.replace(/'/g,"\\'")}')">
      <button onclick="retConfirmNewCat('${soId}')"
        style="padding:3px 8px;font-size:11px;background:var(--black);color:var(--white);border:none;border-radius:4px;cursor:pointer">✓</button>
      <button onclick="retCancelNewCat('${soId}','${prev.replace(/'/g,"\\'")}'")"
        style="padding:3px 8px;font-size:11px;background:var(--off);border:1px solid var(--g200);border-radius:4px;cursor:pointer">✕</button>
    </div>`;
  document.getElementById(`ret-new-${soId}`)?.focus();
}

function retConfirmNewCat(soId) {
  const val = (document.getElementById(`ret-new-${soId}`)?.value || "").trim();
  if (!val) return;
  if (!RET_PRESETS.includes(val) && !retUserCats.includes(val)) {
    retUserCats.push(val);
    populateRetCatFilter();
  }
  saveRetCategory(soId, val);
}

function retCancelNewCat(soId, prev) {
  const cell = document.getElementById(`ret-cat-cell-${soId}`);
  if (cell) cell.innerHTML = retCatSelectHTML(soId, prev);
}

async function saveRetCategory(soId, category) {
  const existing = retReasons[soId] || {};
  const { error } = await sb.from("return_reason_categories").upsert({
    salesorder_id:  soId,
    reason_category: category,
    notes:           existing.notes || null,
    categorized_by:  currentUser,
    updated_at:      new Date().toISOString(),
  }, { onConflict: "salesorder_id" });
  if (error) {
    alert("Gagal menyimpan: " + error.message);
    const cell = document.getElementById(`ret-cat-cell-${soId}`);
    if (cell) cell.innerHTML = retCatSelectHTML(soId, existing.reason_category || "");
    return;
  }
  if (!retReasons[soId]) retReasons[soId] = { salesorder_id: soId };
  retReasons[soId].reason_category = category;
  retReasons[soId].categorized_by  = currentUser;
  const cell = document.getElementById(`ret-cat-cell-${soId}`);
  if (cell) cell.innerHTML = retCatSelectHTML(soId, category);
  renderRetStats();
}

async function saveRetNotes(soId, notes) {
  const existing = retReasons[soId];
  if (!existing?.reason_category) return;  // must have category first
  const trimmed = notes.trim();
  if (trimmed === (existing.notes || "")) return;  // no change
  const { error } = await sb.from("return_reason_categories").upsert({
    salesorder_id:   soId,
    reason_category: existing.reason_category,
    notes:           trimmed || null,
    categorized_by:  currentUser,
    updated_at:      new Date().toISOString(),
  }, { onConflict: "salesorder_id" });
  if (!error) {
    retReasons[soId].notes = trimmed || null;
  }
}

function renderRetTable() {
  const tbody  = document.getElementById("ret-tbody");
  const tcount = document.getElementById("ret-tcount");
  if (!tbody) return;

  const filtered = retGetFiltered();
  if (tcount) tcount.textContent = filtered.length > 0 ? `${filtered.length} entri` : "0 entri";

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Tidak ada data untuk filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const tgl     = o.transaction_date ? o.transaction_date.slice(0, 10) : "—";
    const soLink  = `<a href="https://v2.jubelio.com/sales/transactions/orders/detail/${o.salesorder_id}" target="_blank" style="color:inherit;text-decoration:underline dotted">${o.salesorder_no || o.salesorder_id}</a>`;
    const curCat  = retReasons[o.salesorder_id]?.reason_category || "";
    const curNote = retReasons[o.salesorder_id]?.notes || "";
    const catBadge = curCat
      ? `<div style="font-size:10px;color:${RET_CAT_COLORS[curCat]||"var(--g600)"};margin-top:2px;font-family:'DM Mono',monospace">${curCat}</div>`
      : "";
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${soLink}</td>
      <td>${tgl}</td>
      <td style="font-size:11px">${(o.courier||"—")}</td>
      <td style="font-size:11px;color:var(--g600)">${o.location_name||"—"}</td>
      <td style="font-size:11px">${o.customer_name||"—"}</td>
      <td id="ret-cat-cell-${o.salesorder_id}">${retCatSelectHTML(o.salesorder_id, curCat)}</td>
      <td>${retNotesHTML(o.salesorder_id, curNote)}</td>
    </tr>`;
  }).join("");
}

// ── STOCK ADJUSTMENT MGMT ──
const SA_PRESETS = [
  "Freebies KOL", "Freebies Licensor", "Freebies Internal", "Other Freebies",
  "Stock Opname", "Defect", "Penjualan Offline",
  "Penyesuaian Stock", "Inbound", "Retur",
];
const SA_GROUPS = {
  "Freebies":          ["Freebies KOL","Freebies Licensor","Freebies Internal","Other Freebies"],
  "Stock Opname":      ["Stock Opname"],
  "Defect":            ["Defect"],
  "Penjualan Offline": ["Penjualan Offline"],
  "Penyesuaian Stock": ["Penyesuaian Stock"],
  "Inbound":           ["Inbound"],
  "Retur":             ["Retur"],
};
const SA_GROUP_COLORS = {
  "Freebies":          "#3C3489",
  "Stock Opname":      "#2d7a2d",
  "Defect":            "#c0392b",
  "Penjualan Offline": "#e67e00",
  "Penyesuaian Stock": "#0077b6",
  "Inbound":           "#00897b",
  "Retur":             "#8e44ad",
};

let saAdjustments = [];   // jubelio_inventory_adjustments WHERE 2026
let saCategories  = {};   // { item_adj_id → { category, categorized_by } }
let saUserCats    = [];   // user-added category strings (collected from DB)
let saPage        = 0;

async function loadSAData() {
  const tbody = document.getElementById("sa-tbody");
  if (tbody) tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Memuat...</td></tr>`;

  let adjs, cats;
  try {
    [adjs, cats] = await Promise.all([
      _fetchAllPages("jubelio_inventory_adjustments","item_adj_id,item_adj_no,transaction_date,location_name,net_qty,item_count,note",q=>q.gte("transaction_date","2026-01-01").order("transaction_date",{ascending:false})),
      _fetchAllPages("adjustment_categories","item_adj_id,category,categorized_by,updated_at"),
    ]);
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Error: ${e.message||e}</td></tr>`;
    return;
  }

  saAdjustments = adjs || [];
  saCategories  = {};
  for (const c of (cats || [])) saCategories[c.item_adj_id] = c;

  // Collect user-added categories (not in presets)
  const usedCats = [...new Set((cats || []).map(c => c.category))];
  saUserCats = usedCats.filter(c => !SA_PRESETS.includes(c));

  populateSAGudangFilter();
  populateSACatFilter();
  renderSATable();
}

function populateSAGudangFilter() {
  const sel = document.getElementById("sa-f-gudang");
  if (!sel) return;
  const cur = sel.value;
  const locs = [...new Set(saAdjustments.map(a => a.location_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
  sel.innerHTML = `<option value="all">Semua Gudang</option>` +
    locs.map(l => `<option value="${l}"${cur===l?" selected":""}>${l}</option>`).join("");
}

function populateSACatFilter() {
  const sel = document.getElementById("sa-f-cat");
  if (!sel) return;
  const cur = sel.value;
  // Rebuild: keep base options + preset optgroup + any user-added cats
  const userOpts = saUserCats.length
    ? `<optgroup label="Custom">${saUserCats.map(c=>`<option value="${c}"${cur===c?" selected":""}>${c}</option>`).join("")}</optgroup>`
    : "";
  sel.innerHTML = `
    <option value="all">Semua Kategori</option>
    <option value="__none__"${cur==="__none__"?" selected":""}>— Belum Dikategori</option>
    <optgroup label="Preset">
      ${SA_PRESETS.map(c=>`<option value="${c}"${cur===c?" selected":""}>${c}</option>`).join("")}
    </optgroup>
    ${userOpts}
  `;
}

function renderSAStats(arr) {
  // arr = filtered subset; fallback to full list if not provided
  const subset = arr !== undefined ? arr : saAdjustments;
  const total  = saAdjustments.length;
  const done   = saAdjustments.filter(a => saCategories[a.item_adj_id]).length;
  const undone = total - done;
  const pct    = total > 0 ? ((done / total) * 100).toFixed(0) + "%" : "—";

  const el = id => document.getElementById(id);
  if (el("sa-total"))  el("sa-total").textContent  = total;
  if (el("sa-done"))   el("sa-done").textContent   = done;
  if (el("sa-undone")) el("sa-undone").textContent = undone;
  if (el("sa-pct"))    el("sa-pct").textContent    = pct;

  // ── Grup breakdown (from filtered subset) ──
  const grpEl = document.getElementById("sa-grp-chart");
  if (grpEl) {
    const counts  = {};
    const netQtys = {};
    for (const a of subset) {
      const cat = saCategories[a.item_adj_id]?.category || null;
      let grp = null;
      if (cat) {
        grp = Object.keys(SA_GROUPS).find(g => SA_GROUPS[g].includes(cat)) || "Lainnya";
      }
      const key = grp || "Belum Dikategori";
      counts[key]  = (counts[key]  || 0) + 1;
      netQtys[key] = (netQtys[key] || 0) + parseFloat(a.net_qty || 0);
    }
    const subTotal = subset.length;
    const order = [...Object.keys(SA_GROUPS), "Lainnya", "Belum Dikategori"];
    const rows  = order.filter(k => counts[k]).map(k => ({ k, n: counts[k], q: netQtys[k] || 0 }));
    const maxN  = Math.max(...rows.map(r => r.n), 1);
    grpEl.innerHTML = rows.length
      ? rows.map(({ k, n, q }) => {
          const pctBar = Math.max(Math.round((n / maxN) * 100), 3);
          const color  = SA_GROUP_COLORS[k] || "var(--g400)";
          const qRound = Math.round(q);
          const qStr   = qRound > 0 ? `+${qRound}` : `${qRound}`;
          const qColor = qRound > 0 ? "#2d7a2d" : qRound < 0 ? "#c0392b" : "var(--g400)";
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
              <span>${k}</span>
              <span style="font-family:'DM Mono',monospace;color:${color}">${n} adj</span>
            </div>
            <div style="height:6px;background:var(--off);border-radius:3px;margin-bottom:3px">
              <div style="height:6px;width:${pctBar}%;background:${color};border-radius:3px"></div>
            </div>
            <div style="font-size:11px;color:var(--g600)">
              ${subTotal > 0 ? Math.round(n/subTotal*100) : 0}% · net qty <span style="color:${qColor};font-family:'DM Mono',monospace">${qStr}</span>
            </div>
          </div>`;
        }).join("")
      : `<div style="color:var(--g400);font-size:12px">Belum ada data.</div>`;
  }

  // ── Freebies sub-breakdown (from filtered subset) ──
  const fbEl = document.getElementById("sa-freebie-chart");
  if (fbEl) {
    const fbCounts  = {};
    const fbNetQtys = {};
    for (const a of subset) {
      const cat = saCategories[a.item_adj_id]?.category;
      if (cat && SA_GROUPS["Freebies"].includes(cat)) {
        fbCounts[cat]  = (fbCounts[cat]  || 0) + 1;
        fbNetQtys[cat] = (fbNetQtys[cat] || 0) + parseFloat(a.net_qty || 0);
      }
    }
    const fbTotal = Object.values(fbCounts).reduce((s, n) => s + n, 0);
    const fbRows  = SA_GROUPS["Freebies"].filter(c => fbCounts[c]).map(c => ({ c, n: fbCounts[c], q: fbNetQtys[c] || 0 }));
    const fbMax   = Math.max(...fbRows.map(r => r.n), 1);
    fbEl.innerHTML = fbTotal > 0
      ? fbRows.map(({ c, n, q }) => {
          const pctBar = Math.max(Math.round((n / fbMax) * 100), 3);
          const qRound = Math.round(q);
          const qStr   = qRound > 0 ? `+${qRound}` : `${qRound}`;
          const qColor = qRound > 0 ? "#2d7a2d" : qRound < 0 ? "#c0392b" : "var(--g400)";
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
              <span>${c}</span>
              <span style="font-family:'DM Mono',monospace;color:#3C3489">${n} adj</span>
            </div>
            <div style="height:6px;background:var(--off);border-radius:3px;margin-bottom:3px">
              <div style="height:6px;width:${pctBar}%;background:#3C3489;border-radius:3px"></div>
            </div>
            <div style="font-size:11px;color:var(--g600)">
              ${fbTotal > 0 ? Math.round(n/fbTotal*100) : 0}% · net qty <span style="color:${qColor};font-family:'DM Mono',monospace">${qStr}</span>
            </div>
          </div>`;
        }).join("")
      : `<div style="color:var(--g400);font-size:12px">Belum ada data freebies.</div>`;
  }
}

function saGetFiltered() {
  const catF    = document.getElementById("sa-f-cat")?.value    || "all";
  const gudangF = document.getElementById("sa-f-gudang")?.value || "all";
  const searchF = (document.getElementById("sa-f-search")?.value || "").toLowerCase().trim();

  return saAdjustments.filter(a => {
    const cat = saCategories[a.item_adj_id]?.category || null;
    if (catF === "__none__" && cat) return false;
    if (catF !== "all" && catF !== "__none__" && cat !== catF) return false;
    if (gudangF !== "all" && a.location_name !== gudangF) return false;
    if (searchF) {
      const haystack = `${a.item_adj_no || ""} ${a.note || ""}`.toLowerCase();
      if (!haystack.includes(searchF)) return false;
    }
    return true;
  });
}

function saGoPage(dir) {
  const total   = saGetFiltered().length;
  const maxPage = Math.max(0, Math.ceil(total / 100) - 1);
  saPage = Math.min(maxPage, Math.max(0, saPage + dir));
  renderSATable();
}

function clearSAFilters() {
  const el = id => document.getElementById(id);
  if (el("sa-f-cat"))    el("sa-f-cat").value    = "all";
  if (el("sa-f-gudang")) el("sa-f-gudang").value = "all";
  if (el("sa-f-search")) el("sa-f-search").value = "";
  saPage = 0;
  renderSATable();
}

function saCatSelectHTML(adjId, currentCat) {
  const allCats = [...SA_PRESETS, ...saUserCats.filter(c => !SA_PRESETS.includes(c))];
  const opts = allCats.map(c =>
    `<option value="${c}"${c === currentCat ? " selected" : ""}>${c}</option>`
  ).join("");
  return `<select onchange="saSelectChange(${adjId},this)"
    style="font-size:12px;padding:3px 8px;border:1px solid var(--g200);border-radius:4px;width:100%;background:var(--white);max-width:200px">
    <option value="">— Pilih —</option>
    ${opts}
    <option value="__new__">＋ Tambah baru...</option>
  </select>`;
}

function saSelectChange(adjId, selectEl) {
  const val = selectEl.value;
  if (val === "__new__") {
    saStartNewCat(adjId, selectEl);
  } else if (val) {
    saveSACategory(adjId, val);
  }
}

function saStartNewCat(adjId, selectEl) {
  const prev = saCategories[adjId]?.category || "";
  const wrap = selectEl.parentElement;
  wrap.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center">
      <input type="text" id="sa-new-${adjId}" placeholder="Nama kategori baru"
        style="flex:1;font-size:12px;padding:3px 6px;border:1px solid var(--black);border-radius:4px;outline:none"
        onkeydown="if(event.key==='Enter')saConfirmNewCat(${adjId});if(event.key==='Escape')saCancelNewCat(${adjId},'${prev.replace(/'/g,"\\'")}')">
      <button onclick="saConfirmNewCat(${adjId})"
        style="padding:3px 8px;font-size:11px;background:var(--black);color:var(--white);border:none;border-radius:4px;cursor:pointer;white-space:nowrap">✓</button>
      <button onclick="saCancelNewCat(${adjId},'${prev.replace(/'/g,"\\'")}'")"
        style="padding:3px 8px;font-size:11px;background:var(--off);border:1px solid var(--g200);border-radius:4px;cursor:pointer">✕</button>
    </div>`;
  document.getElementById(`sa-new-${adjId}`)?.focus();
}

function saConfirmNewCat(adjId) {
  const input = document.getElementById(`sa-new-${adjId}`);
  const val   = (input?.value || "").trim();
  if (!val) return;
  if (!SA_PRESETS.includes(val) && !saUserCats.includes(val)) {
    saUserCats.push(val);
    populateSACatFilter();
  }
  saveSACategory(adjId, val);
}

function saCancelNewCat(adjId, prev) {
  const cell = document.getElementById(`sa-cat-cell-${adjId}`);
  if (cell) cell.innerHTML = saCatSelectHTML(adjId, prev);
}

async function saveSACategory(adjId, category) {
  const { error } = await sb.from("adjustment_categories").upsert({
    item_adj_id:     adjId,
    category,
    categorized_by:  currentUser,
    updated_at:      new Date().toISOString(),
  }, { onConflict: "item_adj_id" });

  if (error) {
    alert("Gagal menyimpan: " + error.message);
    // Restore select to previous value
    const cell = document.getElementById(`sa-cat-cell-${adjId}`);
    if (cell) cell.innerHTML = saCatSelectHTML(adjId, saCategories[adjId]?.category || "");
    return;
  }

  if (!saCategories[adjId]) saCategories[adjId] = { item_adj_id: adjId };
  saCategories[adjId].category        = category;
  saCategories[adjId].categorized_by  = currentUser;

  // Update just this cell (no full re-render)
  const cell = document.getElementById(`sa-cat-cell-${adjId}`);
  if (cell) cell.innerHTML = saCatSelectHTML(adjId, category);

  // Refresh stats (counts change) — pass current filtered set
  renderSAStats(saGetFiltered());
}

function renderSATable() {
  const tbody  = document.getElementById("sa-tbody");
  const tcount = document.getElementById("sa-tcount");
  if (!tbody) return;

  const filtered = saGetFiltered();
  renderSAStats(filtered);

  const total = filtered.length;
  const start = saPage * 100;
  const end   = Math.min(start + 100, total);
  const slice = filtered.slice(start, end);

  if (tcount) {
    tcount.textContent    = total > 0 ? `${start + 1}–${end} dari ${total}` : "0 entri";
    tcount.dataset.total  = total;
  }

  if (!total) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="7">Tidak ada data untuk filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(a => {
    const tgl    = a.transaction_date ? a.transaction_date.slice(0, 10) : "—";
    const qty    = parseFloat(a.net_qty || 0);
    const qStr   = qty > 0
      ? `<span style="color:#2d7a2d">+${Math.round(qty)}</span>`
      : qty < 0 ? `<span style="color:#c0392b">${Math.round(qty)}</span>` : "0";
    const adjLink = `<a href="https://v2.jubelio.com/inventory/stock_transaction/adjustment_qty/view/${a.item_adj_id}" target="_blank" style="color:inherit;text-decoration:underline dotted">${a.item_adj_no || a.item_adj_id}</a>`;
    const curCat  = saCategories[a.item_adj_id]?.category || "";
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${adjLink}</td>
      <td>${tgl}</td>
      <td style="font-size:11px;color:var(--g600)">${a.location_name || "—"}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${a.item_count ?? "—"}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${qStr}</td>
      <td style="font-size:11px;color:var(--g600);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(a.note||"").replace(/"/g,"&quot;")}">${a.note || "—"}</td>
      <td id="sa-cat-cell-${a.item_adj_id}">${saCatSelectHTML(a.item_adj_id, curCat)}</td>
    </tr>`;
  }).join("");
}

// ── SYNC ALL JUBELIO ──
const SYNC_ALL_JOBS = [
  { slug: "sync-jubelio-gudang-offline",          label: "Sales Orders"       },
  { slug: "sync-jubelio-purchase-orders",         label: "Purchase Orders"    },
  { slug: "sync-jubelio-purchase-bills",          label: "Purchase Bills"     },
  { slug: "sync-jubelio-purchase-receives",       label: "Purchase Receives"  },
  { slug: "sync-jubelio-inventory",               label: "Inventory Stock"    },
  { slug: "sync-jubelio-inventory-adjustments",   label: "Adjustments"        },
  { slug: "sync-jubelio-contacts",                label: "Contacts"           },
  { slug: "sync-jubelio-warehouse",               label: "Warehouse / Putaway"},
];

let _syncAllCooldownUntil = 0;

function closeSyncModal() {
  const modal = document.getElementById("sync-all-modal");
  if (modal) modal.style.display = "none";
}

async function syncAllJubelio() {
  const now = Date.now();
  if (now < _syncAllCooldownUntil) {
    const remaining = Math.ceil((_syncAllCooldownUntil - now) / 60000);
    alert(`Sync baru saja dijalankan. Tunggu ${remaining} menit lagi.`);
    return;
  }
  const modal   = document.getElementById("sync-all-modal");
  const list    = document.getElementById("sync-all-list");
  const summary = document.getElementById("sync-all-summary");
  const doneBtn = document.getElementById("sync-all-done-btn");
  const closeBtn= document.getElementById("sync-all-close");
  const trigBtn = document.getElementById("sync-all-btn");
  if (!modal || !list) return;

  // Disable trigger button while running
  if (trigBtn) trigBtn.disabled = true;

  // Build initial rows
  list.innerHTML = SYNC_ALL_JOBS.map(j => `
    <div id="sync-row-${j.slug}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--off)">
      <span style="font-size:13px">${j.label}</span>
      <span id="sync-status-${j.slug}" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--g400)">⟳ menghubungi...</span>
    </div>`).join("");
  summary.textContent = "Sedang sync...";
  doneBtn.disabled = true;
  doneBtn.style.opacity = "0.4";
  doneBtn.style.cursor = "not-allowed";
  if (closeBtn) { closeBtn.disabled = true; closeBtn.style.opacity = "0.3"; }

  // Show modal
  modal.style.display = "flex";

  const startAll = Date.now();
  let doneCount  = 0;
  let errCount   = 0;

  const setStatus = (slug, html) => {
    const el = document.getElementById(`sync-status-${slug}`);
    if (el) el.innerHTML = html;
  };

  // Run all in parallel
  await Promise.allSettled(SYNC_ALL_JOBS.map(async (j) => {
    const t0 = Date.now();
    try {
      await callEdgeFunction(j.slug);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      setStatus(j.slug, `<span style="color:#2d7a2d">✓ ${elapsed}s</span>`);
      doneCount++;
    } catch (e) {
      const msg = (e.message || "error").slice(0, 40);
      setStatus(j.slug, `<span style="color:#c0392b" title="${msg}">✗ ${msg}</span>`);
      errCount++;
    }
  }));

  const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);
  summary.textContent = errCount > 0
    ? `${doneCount} selesai · ${errCount} gagal · ${totalSec}s`
    : `Semua ${doneCount} sync selesai dalam ${totalSec}s`;
  summary.style.color = errCount > 0 ? "#c0392b" : "#2d7a2d";

  _syncAllCooldownUntil = Date.now() + 10 * 60 * 1000; // 10 menit

  doneBtn.disabled = false;
  doneBtn.style.opacity = "1";
  doneBtn.style.cursor = "pointer";
  if (closeBtn) { closeBtn.disabled = false; closeBtn.style.opacity = "1"; }
  if (trigBtn) trigBtn.disabled = false;
}

// ── TRADE ORDERS ──
let allTrdOrders = [];
let allTrdTracking = {};
let trdContactCategories = {};
function fmtRp(n){return 'Rp '+Math.round(n||0).toLocaleString('id-ID');}

async function loadTradeOrders(){
  const tbody=document.getElementById('trdTableBody');
  if(tbody)tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Memuat...</td></tr>`;
  try{
    // 1. Get CNSGNE/WHLSR contact_ids
    const {data:contacts,error:cErr}=await sb.from('jubelio_contacts').select('contact_id,contact_name,category_display').ilike('category_display','WHLSR%');
    if(cErr)throw cErr;
    trdContactCategories={};
    const contactIds=(contacts||[]).map(c=>{
      trdContactCategories[c.contact_id]=(c.category_display||'').startsWith('CNSGNE')?'CNSGNE':'WHLSR';
      return c.contact_id;
    });
    if(!contactIds.length){allTrdOrders=[];renderTrdStats([]);applyTrdFilters();return;}
    // 2. Get orders for those contacts
    const orders=await _fetchAllPages('jubelio_sales_orders','salesorder_id,salesorder_no,invoice_no,transaction_date,customer_name,contact_id,channel_status,internal_status,is_paid,is_canceled,grand_total,buyer_shipping_cost',q=>q.in('contact_id',contactIds).order('transaction_date',{ascending:false}));
    // 3. Get tracking — chunk salesorder_ids to keep the .in() URL within limits
    const orderIds=(orders||[]).map(o=>o.salesorder_id);
    let trackingMap={};
    for(let i=0;i<orderIds.length;i+=500){
      const chunk=orderIds.slice(i,i+500);
      const {data:tracking}=await sb.from('trade_order_tracking').select('*').in('salesorder_id',chunk);
      (tracking||[]).forEach(t=>{trackingMap[t.salesorder_id]=t;});
    }
    allTrdOrders=(orders||[]).map(o=>({...o,categoryDisplay:trdContactCategories[o.contact_id]||''}));
    allTrdTracking=trackingMap;
    renderTrdStats(allTrdOrders);
    applyTrdFilters();
  }catch(e){if(tbody)tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Gagal: ${e.message||e}</td></tr>`;}
}

function renderTrdStats(orders){
  const unpaid=orders.filter(o=>!o.is_paid&&!o.is_canceled).length;
  const active=orders.filter(o=>!o.is_canceled&&(o.channel_status||'').toLowerCase()!=='done').length;
  const total=orders.reduce((s,o)=>s+(parseFloat(o.grand_total)||0),0);
  document.getElementById('trd-s-total').textContent=orders.length;
  document.getElementById('trd-s-unpaid').textContent=unpaid;
  document.getElementById('trd-s-active').textContent=active;
  document.getElementById('trd-s-value').textContent=total?fmtRp(total):'—';
}

function applyTrdFilters(){
  const status=document.getElementById('trd-fil-status')?.value||'';
  const pay=document.getElementById('trd-fil-pay')?.value||'';
  const q=(document.getElementById('trd-search')?.value||'').toLowerCase();
  let rows=allTrdOrders;
  if(status)rows=rows.filter(r=>(r.channel_status||r.internal_status||'').toLowerCase()===status);
  if(pay==='paid')rows=rows.filter(r=>r.is_paid);
  if(pay==='unpaid')rows=rows.filter(r=>!r.is_paid&&!r.is_canceled);
  if(q)rows=rows.filter(r=>(r.customer_name||'').toLowerCase().includes(q)||(r.salesorder_no||'').toLowerCase().includes(q)||(r.invoice_no||'').toLowerCase().includes(q));
  renderTrdTable(rows);
  const el=document.getElementById('trd-tcount');
  if(el)el.textContent=rows.length+' entri';
}

function trdProgress(t){
  const steps=[
    {l:'PO',done:!!(t&&t.customer_po_url)},
    {l:'DP1',done:!!(t&&t.dp1_paid)},
    {l:'DP2',done:!!(t&&t.dp2_amount&&t.dp2_paid)},
    {l:'Kirim',done:!!(t&&t.shipped_date)},
  ];
  return steps.map(s=>`<span style="font-size:10px;padding:2px 5px;border-radius:3px;background:${s.done?'var(--black)':'var(--g100)'};color:${s.done?'var(--white)':'var(--g400)'};font-family:var(--mono)">${s.l}</span>`).join(' ');
}

function renderTrdTable(rows){
  const tbody=document.getElementById('trdTableBody');
  if(!tbody)return;
  if(!rows.length){tbody.innerHTML=`<tr><td class="empty-td" colspan="9">Tidak ada data.</td></tr>`;return;}
  tbody.innerHTML=rows.map(r=>{
    const status=r.channel_status||r.internal_status||'—';
    const stClr={open:'p-draft',confirmed:'p-signings',delivered:'p-signings',done:'p-active',cancelled:'p-inactive'}[status.toLowerCase()]||'p-draft';
    const payPill=r.is_paid?'p-active':r.is_canceled?'p-inactive':'p-draft';
    const payLabel=r.is_paid?'Lunas':r.is_canceled?'Dibatalkan':'Belum Lunas';
    const trk=allTrdTracking[r.salesorder_id];
    return `<tr style="cursor:pointer" onclick="openTrdDetail(${r.salesorder_id})">
      <td style="white-space:nowrap"><strong>${r.salesorder_no||'—'}</strong>${r.invoice_no?`<div style="font-size:10px;color:var(--g400)">${r.invoice_no}</div>`:''}</td>
      <td>${r.customer_name||'—'}</td>
      <td style="white-space:nowrap">${fmtDate(r.transaction_date)||'—'}</td>
      <td style="text-align:right;white-space:nowrap">${r.grand_total?fmtRp(r.grand_total):'—'}</td>
      <td><span class="pill ${stClr}" style="font-size:10px">${status}</span></td>
      <td><span class="pill ${payPill}" style="font-size:10px">${payLabel}</span></td>
      <td style="white-space:nowrap">${trdProgress(trk)}</td>
      <td><button class="btn-icon" onclick="event.stopPropagation();openTrdDetail(${r.salesorder_id})">Detail →</button></td>
    </tr>`;
  }).join('');
}

function openTrdDetail(salesorderId){
  document.getElementById('trd-list-view').style.display='none';
  document.getElementById('trd-detail-view').style.display='block';
  document.getElementById('trd-detail-content').innerHTML=`<div style="padding:24px;color:var(--g400);font-family:var(--mono);font-size:12px">Memuat detail...</div>`;
  loadTrdDetail(salesorderId);
}

function closeTrdDetail(){
  document.getElementById('trd-detail-view').style.display='none';
  document.getElementById('trd-list-view').style.display='block';
}

async function loadTrdDetail(salesorderId){
  try{
    const [ordRes,itmRes,trkRes,poRes]=await Promise.all([
      sb.from('jubelio_sales_orders').select('*').eq('salesorder_id',salesorderId).single(),
      sb.from('jubelio_sales_order_items').select('*').eq('salesorder_id',salesorderId),
      sb.from('trade_order_tracking').select('*').eq('salesorder_id',salesorderId).maybeSingle(),
      sb.from('jubelio_purchase_orders').select('purchaseorder_id,purchaseorder_no,supplier_name,transaction_date,status').order('transaction_date',{ascending:false}).limit(200)
    ]);
    if(ordRes.error)throw ordRes.error;
    const tracking=trkRes.data||{};
    allTrdTracking[salesorderId]=tracking;
    // Fetch PO items if a PO has been linked
    let poItems=[];
    if(tracking.linked_po_id){
      const {data:piData}=await sb.from('jubelio_purchase_order_items').select('item_code,item_name,qty,unit,price,amount').eq('purchaseorder_id',tracking.linked_po_id);
      poItems=piData||[];
    }
    renderTrdDetail(ordRes.data,itmRes.data||[],tracking,poRes.data||[],poItems);
  }catch(e){
    document.getElementById('trd-detail-content').innerHTML=`<div style="padding:24px;color:#c0392b;font-family:var(--mono);font-size:12px">Gagal: ${e.message||e}</div>`;
  }
}

function _trdLinkField(label,value,inputId){
  const esc=(value||'').replace(/"/g,'&quot;');
  return `<div class="fg"><label style="font-size:11px">${label}</label>
    <div style="display:flex;gap:4px;align-items:center">
      <input type="url" id="${inputId}" value="${esc}" placeholder="https://..." style="flex:1;min-width:0">
      ${value?`<a href="${value}" target="_blank" style="font-size:11px;padding:4px 8px;border:1px solid var(--g200);border-radius:4px;text-decoration:none;white-space:nowrap;color:var(--black)">↗</a>`:''}
    </div></div>`;
}

function _trdPayBlock(prefix,label,amount,proofUrl,paid){
  const amtId=`trd-trk-${prefix}-amt`,proofId=`trd-trk-${prefix}-proof`,paidId=`trd-trk-${prefix}-paid`;
  return `<div style="padding:12px;border:1px solid var(--g200);border-radius:6px;background:${paid?'rgba(39,174,96,0.06)':'var(--off)'}">
    <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px;display:flex;align-items:center;gap:8px">
      ${label}
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:${paid?'#27ae60':'var(--g400)'};text-transform:none;font-family:var(--sans)">
        <input type="checkbox" id="${paidId}" ${paid?'checked':''} style="margin:0"> Lunas
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
      <div class="fg"><label style="font-size:11px">Nominal (Rp)</label>
        <input type="number" id="${amtId}" value="${amount||''}" placeholder="0" min="0">
      </div>
      ${_trdLinkField('Bukti Bayar',proofUrl,proofId)}
    </div></div>`;
}

function renderTrdDetail(order,items,tracking,poList,poItems){
  const cat=trdContactCategories[order.contact_id]||'';
  const catLabel=cat==='CNSGNE'?'Consignment':cat==='WHLSR'?'Wholesale':cat;
  const catPill=cat==='CNSGNE'?'p-signings':'p-review';
  const t=tracking||{};
  const sid=order.salesorder_id;
  const poOpts=poList.map(p=>`<option value="${p.purchaseorder_id}" ${t.linked_po_id==p.purchaseorder_id?'selected':''}>${p.purchaseorder_no} — ${p.supplier_name||''} (${fmtDate(p.transaction_date)||''})</option>`).join('');
  const html=`<div style="padding:0 0 32px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn-ghost" style="padding:6px 12px;font-size:12px" onclick="closeTrdDetail()">← Kembali</button>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;font-family:var(--heading)">${order.salesorder_no||'—'}</div>
        <div style="font-size:12px;color:var(--g400);font-family:var(--mono)">${order.customer_name||''} · ${fmtDate(order.transaction_date)||''}</div>
      </div>
      <span class="pill ${catPill}" style="font-size:11px">${catLabel}</span>
      <span class="pill ${order.is_paid?'p-active':'p-draft'}" style="font-size:11px">${order.is_paid?'Lunas':'Belum Lunas'}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
      <div class="stat-card" style="padding:10px 14px"><div style="font-size:10px;color:var(--g400);font-family:var(--mono);text-transform:uppercase">Status</div><div style="font-weight:600;margin-top:2px">${order.channel_status||order.internal_status||'—'}</div></div>
      <div class="stat-card" style="padding:10px 14px"><div style="font-size:10px;color:var(--g400);font-family:var(--mono);text-transform:uppercase">Invoice</div><div style="font-weight:600;margin-top:2px">${order.invoice_no||'—'}</div></div>
      <div class="stat-card" style="padding:10px 14px"><div style="font-size:10px;color:var(--g400);font-family:var(--mono);text-transform:uppercase">Total</div><div style="font-weight:700;margin-top:2px">${order.grand_total?fmtRp(order.grand_total):'—'}</div></div>
      <div class="stat-card" style="padding:10px 14px"><div style="font-size:10px;color:var(--g400);font-family:var(--mono);text-transform:uppercase">Ongkir Pembeli</div><div style="font-weight:600;margin-top:2px">${order.buyer_shipping_cost?fmtRp(order.buyer_shipping_cost):'—'}</div></div>
    </div>
    <!-- Line Items -->
    <div class="form-card" style="margin-bottom:16px">
      <div class="form-sec">Barang
        ${poItems&&poItems.length?`<span style="font-size:10px;font-family:var(--mono);color:var(--g400);text-transform:none;letter-spacing:0;font-weight:400">dibandingkan dengan PO yang ditautkan</span>`:(t.linked_po_id?'':'<span style="font-size:10px;font-family:var(--mono);color:#c0392b;text-transform:none;letter-spacing:0;font-weight:400">— tautkan PO di bawah untuk lihat perbandingan</span>')}
      </div>
      ${items.length?`<div class="table-wrap" style="margin-top:8px"><table>
        <thead><tr>
          <th>Kode</th><th>Nama Produk</th>
          <th style="text-align:right">Qty Order</th>
          ${poItems&&poItems.length?`<th style="text-align:right">Qty PO</th><th style="text-align:center">Status</th>`:''}
          <th style="text-align:right">Harga</th><th style="text-align:right">Subtotal</th>
        </tr></thead>
        <tbody>${items.map(i=>{
          const pi=poItems?poItems.find(p=>p.item_code===i.item_code):null;
          const qtyOrd=parseFloat(i.qty)||0;
          const qtyPO=pi?parseFloat(pi.qty)||0:null;
          const gap=qtyPO!==null?qtyOrd-qtyPO:null;
          const gapBadge=gap===null?''
            :gap===0?`<span style="color:#27ae60;font-weight:600;font-family:var(--mono);font-size:11px">✓ OK</span>`
            :gap>0?`<span style="color:#c0392b;font-weight:600;font-family:var(--mono);font-size:11px">-${gap} kurang</span>`
            :`<span style="color:#7a5000;font-weight:600;font-family:var(--mono);font-size:11px">+${Math.abs(gap)} lebih</span>`;
          const rowBg=gap===null?'':gap===0?'':'background:rgba(192,57,43,0.04)';
          return `<tr style="${rowBg}">
            <td style="font-family:var(--mono);font-size:11px">${i.item_code||'—'}</td>
            <td>${i.item_name||'—'}${i.variant?`<span style="font-size:10px;color:var(--g400);margin-left:4px">${i.variant}</span>`:''}</td>
            <td style="text-align:right;font-weight:600">${qtyOrd} ${i.unit||''}</td>
            ${poItems&&poItems.length?`
            <td style="text-align:right">${qtyPO!==null?qtyPO+' '+(pi.unit||''):'<span style="color:var(--g400);font-size:11px">belum ada</span>'}</td>
            <td style="text-align:center">${gapBadge}</td>`:''}
            <td style="text-align:right;white-space:nowrap">${i.price?fmtRp(i.price):'—'}</td>
            <td style="text-align:right;font-weight:600;white-space:nowrap">${i.amount?fmtRp(i.amount):'—'}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--g200)">
          <td colspan="${poItems&&poItems.length?6:4}" style="text-align:right;font-weight:600;padding:6px 12px;font-family:var(--mono);font-size:11px">TOTAL</td>
          <td style="text-align:right;font-weight:700;padding:6px 12px;white-space:nowrap">${fmtRp(items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0))}</td>
        </tr></tfoot>
      </table></div>`:
      `<div style="color:var(--g400);font-size:12px;padding:8px 0">Tidak ada data item — sync ulang untuk memuat.</div>`}
    </div>
    <!-- Tracking -->
    <div class="form-card">
      <div class="form-sec" style="margin-bottom:16px">Process Tracking</div>
      <div style="margin-bottom:20px">
        <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Customer PO</div>
        ${_trdLinkField('Link Dokumen PO dari Mitra',t.customer_po_url,`trd-trk-${sid}-po-url`)}
      </div>
      <div style="margin-bottom:20px">
        <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Pembayaran</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${_trdPayBlock(`${sid}-dp1`,'DP 1',t.dp1_amount,t.dp1_proof_url,t.dp1_paid)}
          ${_trdPayBlock(`${sid}-dp2`,'DP 2',t.dp2_amount,t.dp2_proof_url,t.dp2_paid)}
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Purchase Order & Penerimaan Gudang</div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div class="fg"><label style="font-size:11px">Link ke Purchase Order</label>
            <select id="trd-trk-${sid}-po-id"><option value="">— Belum ditautkan —</option>${poOpts}</select>
          </div>
          <div class="fg"><label style="font-size:11px">Tanggal Terima Gudang</label>
            <input type="date" id="trd-trk-${sid}-rcv-date" value="${t.warehouse_received_date||''}">
          </div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Pengiriman</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label style="font-size:11px">Tanggal Kirim</label>
            <input type="date" id="trd-trk-${sid}-ship-date" value="${t.shipped_date||''}">
          </div>
          ${_trdLinkField('Surat Jalan (Mekari Sign)',t.surat_jalan_url,`trd-trk-${sid}-sj-url`)}
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px">Ongkos Kirim</div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">
          <div class="fg"><label style="font-size:11px">Biaya Ongkir (Rp)</label>
            <input type="number" id="trd-trk-${sid}-ship-cost" value="${t.shipping_cost||''}" placeholder="0" min="0">
          </div>
          <div style="padding:12px;border:1px solid var(--g200);border-radius:6px;background:${t.shipping_reimb_paid?'rgba(39,174,96,0.06)':'var(--off)'}">
            <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--g400);margin-bottom:8px;display:flex;align-items:center;gap:8px">
              Reimbursement Ongkir dari Mitra
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:${t.shipping_reimb_paid?'#27ae60':'var(--g400)'};text-transform:none;font-family:var(--sans)">
                <input type="checkbox" id="trd-trk-${sid}-reimb-paid" ${t.shipping_reimb_paid?'checked':''} style="margin:0"> Sudah Dibayar
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
              <div class="fg"><label style="font-size:11px">Nominal (Rp)</label>
                <input type="number" id="trd-trk-${sid}-reimb-amt" value="${t.shipping_reimb_amount||''}" placeholder="0" min="0">
              </div>
              ${_trdLinkField('Bukti Pembayaran',t.shipping_reimb_proof_url,`trd-trk-${sid}-reimb-proof`)}
            </div>
          </div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div class="fg"><label style="font-size:11px">Catatan</label>
          <textarea id="trd-trk-${sid}-notes" rows="2" style="resize:vertical" placeholder="Catatan internal...">${(t.notes||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn-primary" onclick="saveTrdTracking(${sid})">Simpan Tracking</button>
        <div id="trd-trk-fb-${sid}" style="font-size:12px"></div>
      </div>
    </div>
  </div>`;
  document.getElementById('trd-detail-content').innerHTML=html;
}

async function saveTrdTracking(sid){
  const g=id=>document.getElementById(id);
  const fb=document.getElementById(`trd-trk-fb-${sid}`);
  if(fb)fb.innerHTML='';
  try{
    const row={
      salesorder_id:sid,
      customer_po_url:g(`trd-trk-${sid}-po-url`)?.value?.trim()||null,
      dp1_amount:parseFloat(g(`trd-trk-${sid}-dp1-amt`)?.value)||null,
      dp1_proof_url:g(`trd-trk-${sid}-dp1-proof`)?.value?.trim()||null,
      dp1_paid:g(`trd-trk-${sid}-dp1-paid`)?.checked||false,
      dp2_amount:parseFloat(g(`trd-trk-${sid}-dp2-amt`)?.value)||null,
      dp2_proof_url:g(`trd-trk-${sid}-dp2-proof`)?.value?.trim()||null,
      dp2_paid:g(`trd-trk-${sid}-dp2-paid`)?.checked||false,
      linked_po_id:g(`trd-trk-${sid}-po-id`)?.value||null,
      warehouse_received_date:g(`trd-trk-${sid}-rcv-date`)?.value||null,
      shipped_date:g(`trd-trk-${sid}-ship-date`)?.value||null,
      surat_jalan_url:g(`trd-trk-${sid}-sj-url`)?.value?.trim()||null,
      shipping_cost:parseFloat(g(`trd-trk-${sid}-ship-cost`)?.value)||null,
      shipping_reimb_amount:parseFloat(g(`trd-trk-${sid}-reimb-amt`)?.value)||null,
      shipping_reimb_proof_url:g(`trd-trk-${sid}-reimb-proof`)?.value?.trim()||null,
      shipping_reimb_paid:g(`trd-trk-${sid}-reimb-paid`)?.checked||false,
      notes:g(`trd-trk-${sid}-notes`)?.value?.trim()||null,
      last_updated:new Date().toISOString(),
      last_updated_by:currentUser
    };
    const {error}=await sb.from('trade_order_tracking').upsert(row,{onConflict:'salesorder_id'});
    if(error)throw error;
    allTrdTracking[sid]=row;
    logActivity('Wholesale Orders','update',String(sid),'Update tracking order');
    if(fb)fb.innerHTML='<span class="fb-ok">✓ Tersimpan — memuat ulang perbandingan PO...</span>';
    // Reload detail to refresh PO comparison with new linked_po_id
    await loadTrdDetail(sid);
  }catch(e){if(fb)fb.innerHTML=`<span class="fb-err">Gagal: ${e.message||e}</span>`;}
}

// ── INVENTORY CHECK ──
let invLocations = [];   // [{location_id, location_name, category}]
let invStockFlat = [];   // all rows from jubelio_inventory_by_location
let invGroups    = [];   // built by rebuildInvGroups() — sorted parent items
let invStockMap  = {};   // key: `${location_id}_${item_id}` -> row (fast lookup)
let invFilterCats = new Set(['Inbound','Online','Offline','Event','Consignment']);
let invFilterWhs  = new Set();
let invFilterSearch = '';
let invPage = 1;
const INV_PAGE_SIZE = 20;
let _invSearchTimer = null;

const INV_CAT_ORDER = ['Inbound','Online','Offline','Event','Consignment'];
const INV_CAT_CFG = {
  Inbound:     {bg:'#e8f0fc',border:'#a8c4f0',text:'#1a4a8a',colBg:'#f0f5fd',icon:'↓'},
  Online:      {bg:'#edf8ee',border:'#90d4a0',text:'#1a5c25',colBg:'#f0f9f1',icon:'🌐'},
  Offline:     {bg:'#f5ecfc',border:'#d4a0e8',text:'#5c1a6e',colBg:'#f8f0fc',icon:'🏪'},
  Event:       {bg:'#fff3e0',border:'#ffcc80',text:'#7a4000',colBg:'#fffaf0',icon:'🎪'},
  Consignment: {bg:'#e0f4f4',border:'#80d4d4',text:'#1a5050',colBg:'#f0fafa',icon:'⇄'}
};
const INV_CAT_SVG = {
  Inbound:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><rect x="2" y="8" width="12" height="6" rx="1"/><path d="M8 2v8"/><path d="M5 7l3 3 3-3"/></svg>`,
  Online:      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><circle cx="8" cy="8" r="6"/><path d="M8 2c-2 2-3 4-3 6s1 4 3 6"/><path d="M8 2c2 2 3 4 3 6s-1 4-3 6"/><line x1="2" y1="8" x2="14" y2="8"/></svg>`,
  Offline:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><path d="M2 6l6-4 6 4v8H2V6z"/><rect x="5" y="9" width="3" height="5"/><rect x="8" y="9" width="3" height="3"/></svg>`,
  Event:       `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 2v2M11 2v2M2 7h12"/></svg>`,
  Consignment: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><path d="M4 8h8"/><path d="M10 5l3 3-3 3"/><path d="M6 5L3 8l3 3"/></svg>`
};

function invEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function loadInvCheck(){
  const container=document.getElementById('inv-table-container');
  const catsEl=document.getElementById('inv-cat-cards');
  if(container) container.innerHTML=`<div style="padding:2.5rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--g400)">Memuat data stok...</div>`;
  if(catsEl) catsEl.innerHTML='';
  try{
    // 1. Fetch active warehouse categories (small, no paging needed)
    const {data:cats,error:cErr}=await sb.from('warehouse_categories')
      .select('location_id,location_name,category,is_active')
      .eq('is_active',true).order('category').order('location_name');
    if(cErr) throw cErr;
    invLocations=(cats||[]);
    const locIds=invLocations.map(l=>l.location_id);
    // 2. Fetch all stock rows for mapped locations only — use _fetchAllPages to bypass 1000-row cap
    const stock=locIds.length
      ? await _fetchAllPages('jubelio_inventory_by_location',
          'location_id,item_id,item_code,item_name,item_group_id,item_group_name,brand_name,qty_on_hand,qty_available,synced_at',
          q=>q.in('location_id',locIds))
      : [];
    invStockFlat=(stock||[]);
    // Build fast lookup map
    invStockMap={};
    for(const s of invStockFlat) invStockMap[`${s.location_id}_${s.item_id}`]=s;
    // Init warehouse filter with all active locations
    invFilterWhs=new Set(invLocations.map(l=>l.location_id));
    // Sync note
    const syncNote=document.getElementById('inv-sync-note');
    if(syncNote){
      const latest=invStockFlat.reduce((m,r)=>((r.synced_at||'')>(m||''))?r.synced_at:m,'');
      syncNote.textContent=latest?'Terakhir sync: '+new Date(latest).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
    }
    rebuildInvGroups();
    renderInvFilterChips();
    renderInvCatCards(invGroups);
    invPage=1;
    applyInvFilters();
  }catch(e){
    console.error('[loadInvCheck]',e);
    if(container) container.innerHTML=`<div style="padding:2rem;color:#c0392b;font-family:var(--mono);font-size:12px">Gagal memuat: ${invEsc(e.message||String(e))}</div>`;
  }
}

function rebuildInvGroups(){
  const groupMap={};
  for(const row of invStockFlat){
    const gid=row.item_group_id??row.item_id;
    if(!groupMap[gid]){
      // item_name IS the parent name — variants (size, color) live in variation_values
      const pName=row.item_name||'—';
      // derive brand: prefer explicit brand_name, fall back to first segment of item_name
      const rawBrand=row.brand_name||(row.item_name?row.item_name.split(' - ')[0].trim():'');
      const brandKey=rawBrand.toLowerCase().trim();
      groupMap[gid]={item_group_id:gid,parent_name:pName,brand_name:rawBrand,brandKey,skus:[],byLocation:{}};
    }
    const g=groupMap[gid];
    if(!g.skus.find(s=>s.item_id===row.item_id && s.location_id===row.location_id)) g.skus.push(row);
    const locId=row.location_id;
    g.byLocation[locId]=(g.byLocation[locId]||0)+parseFloat(row.qty_on_hand||0);
  }
  invGroups=Object.values(groupMap).sort((a,b)=>a.parent_name.localeCompare(b.parent_name,'id'));
  // Build deduplicated, sorted brand list for the filter
  const brandSet=new Map();
  for(const g of invGroups){
    if(g.brandKey&&!brandSet.has(g.brandKey)) brandSet.set(g.brandKey,g.brand_name||g.brandKey);
  }
  invAllBrands=[...brandSet.entries()].sort((a,b)=>a[0].localeCompare(b[0],'id')).map(([k,label])=>({lowerKey:k,label}));
}

function invDeriveParentName(name){
  if(!name) return '—';
  const parts=name.split(' - ');
  return parts.length>1?parts.slice(0,-1).join(' - '):name;
}

function renderInvFilterChips(){
  const catsEl=document.getElementById('inv-f-cats');
  const whsEl=document.getElementById('inv-f-whs');
  if(!catsEl||!whsEl) return;
  const chipBase='display:inline-flex;align-items:center;padding:3px 9px;border-radius:99px;font-size:11px;font-family:var(--mono);cursor:pointer;border:1px solid;white-space:nowrap;transition:all .12s;';
  // Category chips
  catsEl.innerHTML=INV_CAT_ORDER.map(cat=>{
    const cfg=INV_CAT_CFG[cat];
    const active=invFilterCats.has(cat);
    const st=active?`background:${cfg.text};color:#fff;border-color:${cfg.text}`:`background:var(--white);color:var(--g600);border-color:var(--g200)`;
    return `<span style="${chipBase}${st}" onclick="toggleInvCatFilter('${cat}',this)">${cfg.icon} ${cat}</span>`;
  }).join('');
  // Warehouse chips — only show warehouses whose category is currently active
  const visibleLocs=invLocations.filter(l=>invFilterCats.has(l.category));
  if(!visibleLocs.length){
    whsEl.innerHTML=`<span style="font-family:var(--mono);font-size:10px;color:var(--g400)">—</span>`;
  } else {
    whsEl.innerHTML=visibleLocs.map(loc=>{
      const cfg=INV_CAT_CFG[loc.category]||{text:'var(--black)'};
      const active=invFilterWhs.has(loc.location_id);
      const st=active?`background:${cfg.text};color:#fff;border-color:${cfg.text}`:`background:var(--white);color:var(--g600);border-color:var(--g200)`;
      return `<span style="${chipBase}${st}" onclick="toggleInvWhFilter(${loc.location_id},this)">${invEsc(loc.location_name)}</span>`;
    }).join('');
  }
}

function toggleInvCatFilter(cat,el){
  if(invFilterCats.has(cat)){if(invFilterCats.size<=1) return; invFilterCats.delete(cat);}
  else invFilterCats.add(cat);
  // Sync warehouse filter to match active categories
  invFilterWhs=new Set(invLocations.filter(l=>invFilterCats.has(l.category)).map(l=>l.location_id));
  renderInvFilterChips();
  invPage=1; applyInvFilters();
}

function toggleInvWhFilter(locId,el){
  const active=invFilterWhs.has(locId);
  if(active){if(invFilterWhs.size<=1) return; invFilterWhs.delete(locId);}
  else invFilterWhs.add(locId);
  const loc=invLocations.find(l=>l.location_id===locId);
  const cfg=INV_CAT_CFG[loc?.category]||{text:'var(--black)'};
  const now=invFilterWhs.has(locId);
  el.style.background=now?cfg.text:'var(--white)';
  el.style.color=now?'#fff':'var(--g600)';
  el.style.borderColor=now?cfg.text:'var(--g200)';
  invPage=1; applyInvFilters();
}

function invSearchDebounce(){
  clearTimeout(_invSearchTimer);
  _invSearchTimer=setTimeout(()=>{
    invFilterSearch=(document.getElementById('inv-f-search')?.value||'').toLowerCase().trim();
    invPage=1; applyInvFilters();
  },300);
}

function clearInvFilters(){
  invFilterCats=new Set(INV_CAT_ORDER);
  invFilterWhs=new Set(invLocations.map(l=>l.location_id));
  invFilterSearch='';
  const s=document.getElementById('inv-f-search'); if(s) s.value='';
  renderInvFilterChips();
  invPage=1; applyInvFilters();
}

function applyInvFilters(){
  // Order columns by INV_CAT_ORDER so category header colspans align with warehouse columns
  const activeCols=INV_CAT_ORDER.flatMap(cat=>
    invLocations.filter(l=>l.category===cat&&invFilterCats.has(l.category)&&invFilterWhs.has(l.location_id)));
  let filtered=invGroups;
  // Text search (matches parent name or brand)
  if(invFilterSearch) filtered=filtered.filter(g=>g.parent_name.toLowerCase().includes(invFilterSearch)||(g.brand_name||'').toLowerCase().includes(invFilterSearch));
  const totalSkus=filtered.reduce((s,g)=>s+new Set(g.skus.map(sk=>sk.item_code)).size,0);
  const tcEl=document.getElementById('inv-tcount');
  if(tcEl) tcEl.textContent=`${filtered.length} parent item · ${totalSkus} SKU`;
  renderInvCatCards(filtered);  // cards reflect current filter state
  renderInvTable(filtered,activeCols,invPage);
  renderInvPagination(filtered.length,invPage,activeCols);
}

function renderInvTable(groups,columns,page){
  const container=document.getElementById('inv-table-container');
  if(!container) return;
  if(!invLocations.length){
    container.innerHTML=`<div style="padding:3rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--g400)">Belum ada gudang dikonfigurasi.<br>Tambahkan data ke tabel <b>warehouse_categories</b> di Supabase.</div>`;
    return;
  }
  if(!invStockFlat.length){
    container.innerHTML=`<div style="padding:3rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--g400)">Belum ada data stok.<br>Lakukan sync inventory dari Jubelio terlebih dahulu.</div>`;
    return;
  }
  if(!groups.length){
    container.innerHTML=`<div style="padding:3rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--g400)">Tidak ada data yang cocok dengan filter.</div>`;
    return;
  }
  if(!columns.length){
    container.innerHTML=`<div style="padding:3rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--g400)">Pilih minimal satu gudang.</div>`;
    return;
  }
  const start=(page-1)*INV_PAGE_SIZE;
  const pageGroups=groups.slice(start,start+INV_PAGE_SIZE);
  // ── category header row ──
  const stickyTh=`position:sticky;left:0;background:var(--off);z-index:3;`;
  let catCells=`<th style="${stickyTh}min-width:220px;border-bottom:1px solid var(--g100);padding:6px 12px"></th>`;
  for(const cat of INV_CAT_ORDER){
    const catCols=columns.filter(c=>c.category===cat);
    if(!catCols.length) continue;
    const cfg=INV_CAT_CFG[cat];
    catCells+=`<th colspan="${catCols.length}" style="background:${cfg.bg};color:${cfg.text};padding:6px 8px;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;text-align:center;border-bottom:1px solid ${cfg.border}">${cfg.icon} ${cat}</th>`;
  }
  // ── warehouse name header row ──
  let whCells=`<th style="${stickyTh}text-align:left;padding:8px 12px;font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--g400);border-bottom:1px solid var(--g100)">Parent Item</th>`;
  for(const col of columns){
    const cfg=INV_CAT_CFG[col.category];
    whCells+=`<th style="background:${cfg.colBg};min-width:88px;text-align:center;padding:7px 6px;font-family:var(--mono);font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--g400);font-weight:400;border-bottom:1px solid var(--g100);white-space:nowrap" title="${invEsc(col.location_name)}">${invEsc(col.location_name)}</th>`;
  }
  // ── body rows ──
  const numSty=`font-family:var(--mono);font-size:13px;font-weight:500;line-height:1;`;
  const subSty=`font-family:var(--mono);font-size:9px;color:var(--g400);margin-top:2px;`;
  const tdBase=`padding:10px 6px;border-bottom:1px solid var(--g100);vertical-align:middle;`;
  const stickyTd=`position:sticky;left:0;z-index:1;`;

  const rowsHTML=pageGroups.map(group=>{
    const gid=group.item_group_id;
    const rowId=`inv-g-${gid}`;
    // Count unique SKUs across all locations
    const uniqueSkuCodes=[...new Set(group.skus.map(s=>s.item_code))];
    // Parent item cells
    let pCells=`<td style="${stickyTd}background:var(--white);padding:10px 12px;border-bottom:1px solid var(--g100);vertical-align:middle">
      <div style="font-weight:400;font-size:13px;color:var(--black);margin-bottom:2px">${invEsc(group.parent_name)}
        <button onclick="toggleInvSKUs('${rowId}',this)" style="background:none;border:none;cursor:pointer;color:var(--g400);font-size:10px;padding:1px 5px;border-radius:3px;font-family:var(--mono);margin-left:4px;line-height:1.4">▾ ${uniqueSkuCodes.length} SKU</button>
      </div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--g400)">${invEsc(group.brand_name)}</div>
    </td>`;
    for(const col of columns){
      const cfg=INV_CAT_CFG[col.category];
      const qty=group.byLocation[col.location_id];
      const n=qty!==undefined?parseFloat(qty):null;
      if(n===null){
        pCells+=`<td style="${tdBase}background:${cfg.colBg};text-align:center"><span style="font-family:var(--mono);font-size:11px;color:var(--g200)">—</span></td>`;
      }else if(n===0){
        pCells+=`<td style="${tdBase}background:${cfg.colBg};text-align:center;opacity:.45"><div style="${numSty}color:#c0392b">0</div></td>`;
      }else if(n<=10){
        pCells+=`<td style="${tdBase}background:rgba(255,200,100,.18);text-align:center"><div style="${numSty}color:#b35900">${Math.round(n)}</div></td>`;
      }else{
        pCells+=`<td style="${tdBase}background:${cfg.colBg};text-align:center"><div style="${numSty}color:var(--black)">${Math.round(n).toLocaleString('id-ID')}</div></td>`;
      }
    }
    // SKU rows — one row per unique SKU code
    const skuRows=uniqueSkuCodes.map((code,si)=>{
      const skuRow=group.skus.find(s=>s.item_code===code)||{item_id:null,variation_values:null};
      // Show variant labels (size, color) — item_name duplicates the parent row name
      const varStr=Array.isArray(skuRow.variation_values)&&skuRow.variation_values.length
        ?skuRow.variation_values.map(v=>v.value).join(' · '):'—';
      let sCells=`<td style="${stickyTd}background:#fafaf8;padding:6px 12px 6px 28px;border-bottom:1px solid var(--g100);vertical-align:middle">
        <div style="font-family:var(--mono);font-size:10px;color:var(--g400)">${invEsc(code)}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--g600)">${invEsc(varStr)}</div>
      </td>`;
      for(const col of columns){
        const cfg=INV_CAT_CFG[col.category];
        // Find stock for this SKU in this location
        const locSku=group.skus.find(s=>s.item_code===code&&s.location_id===col.location_id);
        const sq=locSku?parseFloat(locSku.qty_on_hand||0):null;
        const sqSty=`font-family:var(--mono);font-size:12px;font-weight:500;`;
        if(sq===null){
          sCells+=`<td style="background:#fafaf8;text-align:center;padding:6px;border-bottom:1px solid var(--g100)"><span style="font-size:10px;color:var(--g200);font-family:var(--mono)">—</span></td>`;
        }else if(sq===0){
          sCells+=`<td style="background:#fafaf8;text-align:center;padding:6px;border-bottom:1px solid var(--g100)"><span style="${sqSty}color:#c0392b;opacity:.5">0</span></td>`;
        }else if(sq<=10){
          sCells+=`<td style="background:#fafaf8;text-align:center;padding:6px;border-bottom:1px solid var(--g100)"><span style="${sqSty}color:#b35900">${Math.round(sq)}</span></td>`;
        }else{
          sCells+=`<td style="background:#fafaf8;text-align:center;padding:6px;border-bottom:1px solid var(--g100)"><span style="${sqSty}color:var(--black)">${Math.round(sq).toLocaleString('id-ID')}</span></td>`;
        }
      }
      return `<tr class="${rowId}-sku" style="display:none">${sCells}</tr>`;
    }).join('');
    return `<tr>${pCells}</tr>${skuRows}`;
  }).join('');

  container.innerHTML=`<div style="overflow-x:auto;border:1px solid var(--g100);border-radius:10px">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--off)">${catCells}</tr>
        <tr style="background:var(--off)">${whCells}</tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  </div>`;
}

function toggleInvSKUs(rowId,btn){
  const rows=document.querySelectorAll(`.${rowId}-sku`);
  const vis=rows.length>0&&rows[0].style.display!=='none';
  rows.forEach(r=>r.style.display=vis?'none':'');
  btn.textContent=vis?btn.textContent.replace('▴','▾'):btn.textContent.replace('▾','▴');
}

function renderInvCatCards(filteredGroups){
  const el=document.getElementById('inv-cat-cards');
  if(!el) return;
  if(!invLocations.length){el.style.display='none';return;}
  el.style.display='grid';
  const groups=filteredGroups||invGroups;
  el.innerHTML=INV_CAT_ORDER.map(cat=>{
    const cfg=INV_CAT_CFG[cat];
    const catLocIds=invLocations.filter(l=>l.category===cat).map(l=>l.location_id);
    // Compute stats from filtered groups only
    let totalItems=0;
    const uniqueSKUs=new Set();
    for(const g of groups){
      for(const locId of catLocIds) totalItems+=(g.byLocation[locId]||0);
      g.skus.filter(s=>catLocIds.includes(s.location_id)).forEach(s=>uniqueSKUs.add(s.item_code));
    }
    const whNames=invLocations.filter(l=>l.category===cat).map(l=>l.location_name).join(' · ')||'—';
    // Dim card if this category is filtered out
    const op=!catLocIds.length?'0.3':!invFilterCats.has(cat)?'0.3':'1';
    return `<div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:10px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:8px;opacity:${op}">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,0,0,.07);display:flex;align-items:center;justify-content:center;color:${cfg.text}">${INV_CAT_SVG[cat]}</div>
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${cfg.text};font-weight:500">${cat}</div>
      </div>
      <div style="display:flex;gap:16px">
        <div><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1;color:${cfg.text}">${Math.round(totalItems).toLocaleString('id-ID')}</div><div style="font-family:var(--mono);font-size:9px;color:var(--g400);letter-spacing:.06em;text-transform:uppercase;margin-top:2px">Items</div></div>
        <div><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1;color:${cfg.text}">${uniqueSKUs.size}</div><div style="font-family:var(--mono);font-size:9px;color:var(--g400);letter-spacing:.06em;text-transform:uppercase;margin-top:2px">SKUs</div></div>
      </div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--g600);line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${invEsc(whNames)}">${invEsc(whNames)}</div>
    </div>`;
  }).join('');
}

function renderInvPagination(total,page,columns){
  const el=document.getElementById('inv-pagination');
  if(!el) return;
  const totalPages=Math.ceil(total/INV_PAGE_SIZE);
  if(totalPages<=1){el.innerHTML='';return;}
  const start=(page-1)*INV_PAGE_SIZE+1;
  const end=Math.min(page*INV_PAGE_SIZE,total);
  const btnSt=`padding:5px 10px;border:1px solid var(--g200);border-radius:5px;font-family:var(--mono);font-size:11px;cursor:pointer;background:var(--white);color:var(--g600);`;
  const actSt=`padding:5px 10px;border:1px solid var(--black);border-radius:5px;font-family:var(--mono);font-size:11px;cursor:pointer;background:var(--black);color:var(--white);`;
  const w=2;
  const pages=[];
  for(let p=1;p<=totalPages;p++){
    if(p===1||p===totalPages||(p>=page-w&&p<=page+w)) pages.push(p);
    else if(pages[pages.length-1]!=='...') pages.push('...');
  }
  let h=`<span style="font-family:var(--mono);font-size:11px;color:var(--g400);margin-right:6px">${start}–${end} / ${total}</span>`;
  h+=`<button style="${btnSt}" onclick="invGoPage(${page-1})" ${page===1?'disabled':''}>‹</button>`;
  for(const p of pages){
    if(p==='...') h+=`<span style="padding:5px 4px;font-family:var(--mono);font-size:11px;color:var(--g400)">…</span>`;
    else h+=`<button style="${p===page?actSt:btnSt}" onclick="invGoPage(${p})">${p}</button>`;
  }
  h+=`<button style="${btnSt}" onclick="invGoPage(${page+1})" ${page===totalPages?'disabled':''}>›</button>`;
  el.innerHTML=h;
}

function invGoPage(p){
  const activeCols=INV_CAT_ORDER.flatMap(cat=>
    invLocations.filter(l=>l.category===cat&&invFilterCats.has(l.category)&&invFilterWhs.has(l.location_id)));
  let filtered=invGroups;
  if(invFilterSearch) filtered=filtered.filter(g=>g.parent_name.toLowerCase().includes(invFilterSearch)||g.brand_name.toLowerCase().includes(invFilterSearch));
  const totalPages=Math.ceil(filtered.length/INV_PAGE_SIZE);
  if(p<1||p>totalPages) return;
  invPage=p;
  renderInvTable(filtered,activeCols,p);
  renderInvPagination(filtered.length,p,activeCols);
  document.getElementById('page-invcheck')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ── PROJECT BOARD ──
let projAll = [];
let projCats = [];
let projComments = {};
let projActivity = {};
let projDragId = null;
let projDragSourceStatus = null;
let projDetailId = null;
let _projSearchTimer = null;
let projFilterCat = '';
let projFilterSearch = '';
let _projDirty = false;

const PROJ_STATUSES = [
  { key:'backlog',     label:'Backlog',     color:'#64748b', bg:'#f1f5f9', icon:'○' },
  { key:'todo',        label:'To Do',       color:'#3b82f6', bg:'#eff6ff', icon:'◑' },
  { key:'in_progress', label:'In Progress', color:'#f59e0b', bg:'#fffbeb', icon:'◕' },
  { key:'done',        label:'Done',        color:'#10b981', bg:'#f0fdf4', icon:'●' },
];
const PROJ_PRIORITIES = [
  { key:'high',   label:'High',   color:'#ef4444' },
  { key:'medium', label:'Medium', color:'#f59e0b' },
  { key:'low',    label:'Low',    color:'#94a3b8' },
];
const PROJ_REVENUE = ['SD&Y','Lagaa','Marte'];

function projEsc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function mapProj(r){
  return { id:r.id, title:r.title||'—', description:r.description||'', status:r.status||'backlog',
    priority:r.priority||'medium', assignee:r.assignee||'', dueDate:r.due_date||'',
    revenueStream:r.revenue_stream||'', categoryId:r.category_id||'', position:r.position||0,
    link:r.link||'', createdBy:r.created_by||'', createdAt:r.created_at||'', updatedAt:r.updated_at||'' };
}
// Day diff using local midnight — fixes timezone "besok" bug
function projDayDiff(dateStr){
  if(!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr+'T00:00:00'); // local midnight, not UTC
  return Math.round((due - today) / 86400000);
}
// Linkify URLs + highlight @mentions for chat messages
function projLinkify(text){
  if(!text) return '';
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map(part=>{
    if(/^https?:\/\//.test(part)){
      const esc=part.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<a href="${esc}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:#3b82f6;text-decoration:underline;word-break:break-all">${esc}</a>`;
    }
    return projEsc(part).replace(/@(\w+)/g,'<span style="color:#6366f1;font-weight:600">@$1</span>');
  }).join('');
}

async function loadProjects(){
  const board = document.getElementById('proj-board');
  if(board) board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--g400);font-size:14px">Memuat data...</div>`;
  try{
    const [{ data:cats, error:cErr }, { data:projs, error:pErr }] = await Promise.all([
      sb.from('project_categories').select('*').order('name'),
      sb.from('projects').select('*').order('position').order('created_at',{ascending:false})
    ]);
    if(cErr) throw cErr;
    if(pErr) throw pErr;
    projCats = cats || [];
    projAll = (projs||[]).map(mapProj);
    renderProjCatFilter();
    renderProjStats();
    renderKanban();
  } catch(e){
    console.error('[loadProjects]',e);
    if(board) board.innerHTML = `<div style="padding:40px;text-align:center;color:#c0392b;font-size:14px">Gagal memuat: ${projEsc(e.message||String(e))}</div>`;
  }
}

function projGetFiltered(){
  let f = projAll;
  if(projFilterCat) f = f.filter(p => p.categoryId === projFilterCat);
  if(projFilterSearch){ const q = projFilterSearch.toLowerCase(); f = f.filter(p => p.title.toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)||(p.assignee||'').toLowerCase().includes(q)); }
  return f;
}

function renderProjStats(){
  renderProjUrgent();
}
function renderProjUrgent(){
  const el = document.getElementById('proj-urgent-bar');
  if(!el) return;
  const urgent = projGetFiltered()
    .filter(p => p.dueDate && p.status !== 'done')
    .map(p => ({ ...p, daysLeft: projDayDiff(p.dueDate) }))
    .filter(p => p.daysLeft <= 7)
    .sort((a,b) => a.daysLeft - b.daysLeft)
    .slice(0, 10);
  if(!urgent.length){
    el.innerHTML = `<span style="font-size:12px;color:#10b981;font-family:var(--mono)">✓ Tidak ada task yang mendekati deadline</span>`;
    return;
  }
  el.innerHTML = urgent.map(p => {
    const st  = PROJ_STATUSES.find(s => s.key === p.status);
    const dl  = p.daysLeft;
    const lbl = dl < 0 ? `overdue ${Math.abs(dl)}h` : dl === 0 ? 'hari ini' : dl === 1 ? 'besok' : `${dl} hari lagi`;
    const clr = dl < 0 ? '#ef4444' : '#d97706';
    const ico = dl < 0 ? '🔴' : '⚠️';
    return `<span onclick="openProjectDetail('${p.id}')" title="${projEsc(p.title)}"
      style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--white);border:1px solid var(--g100);border-radius:6px;font-size:12px;max-width:260px;transition:border-color .12s"
      onmouseover="this.style.borderColor='var(--black)'" onmouseout="this.style.borderColor='var(--g100)'">
      <span style="color:${st?.color||'var(--g400)'}">${st?.icon||'○'}</span>
      <span style="color:var(--black);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${projEsc(p.title)}</span>
      <span style="font-family:var(--mono);font-size:10px;color:${clr};font-weight:600;flex-shrink:0">${ico} ${lbl}</span>
    </span>`;
  }).join('');
}

function renderProjCatFilter(){
  const sel = document.getElementById('proj-cat-filter');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua Kategori</option>` +
    projCats.map(c=>`<option value="${c.id}" ${cur===c.id?'selected':''}>${projEsc(c.name)}</option>`).join('');
}

function projCatFilterChange(){
  projFilterCat = document.getElementById('proj-cat-filter')?.value || '';
  renderProjStats();
  renderKanban();
}

function projSearchDebounce(){
  clearTimeout(_projSearchTimer);
  _projSearchTimer = setTimeout(()=>{
    projFilterSearch = (document.getElementById('proj-search')?.value||'').toLowerCase().trim();
    renderProjStats();
    renderKanban();
  }, 200);
}

function renderKanban(){
  const board = document.getElementById('proj-board');
  if(!board) return;
  const filtered = projGetFiltered();
  board.innerHTML = PROJ_STATUSES.map(st=>{
    const cards = filtered.filter(p=>p.status===st.key).sort((a,b)=>a.position-b.position);
    return `<div class="kanban-col" data-status="${st.key}"
      ondragover="projDragOver(event)" ondrop="projDrop(event,'${st.key}')" ondragleave="projDragLeave(event)">
      <div class="kanban-col-header" style="border-top:3px solid ${st.color}">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:14px;color:${st.color}">${st.icon}</span>
          <span style="font-size:13px;font-weight:600;color:var(--black)">${st.label}</span>
          <span style="font-size:10px;font-family:var(--mono);color:var(--g400);background:var(--g100);padding:1px 7px;border-radius:99px">${cards.length}</span>
        </div>
        <button class="kanban-add-btn" onclick="openProjectDetail(null,'${st.key}')" title="Tambah project di kolom ini">+</button>
      </div>
      <div class="kanban-cards" id="kcards-${st.key}">
        ${cards.length ? cards.map(p=>renderProjCard(p)).join('') :
          `<div class="kanban-empty" ondragover="projDragOver(event)" ondrop="projDrop(event,'${st.key}')">
            <span style="font-size:11px;color:var(--g400);font-family:var(--mono)">drop here</span>
          </div>`}
      </div>
    </div>`;
  }).join('');
}

function renderProjCard(p){
  const cat = projCats.find(c=>c.id===p.categoryId);
  const pri = PROJ_PRIORITIES.find(x=>x.key===p.priority);
  const dueStr  = p.dueDate ? new Date(p.dueDate+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '';
  const daysLeft = projDayDiff(p.dueDate);
  const isOverdue = daysLeft !== null && daysLeft < 0  && p.status !== 'done';
  const isNearDue = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && p.status !== 'done';
  const dueIcon   = isOverdue ? '🔴' : isNearDue ? '⚠️' : '📅';
  const dueCl     = isOverdue ? 'color:#ef4444;font-weight:600' : isNearDue ? 'color:#d97706;font-weight:600' : 'color:var(--g400)';
  const dueLabel  = isNearDue&&daysLeft===0?' · hari ini':isNearDue&&daysLeft===1?' · besok':isNearDue?` · ${daysLeft}h`:'';
  return `<div class="kanban-card" id="pcard-${p.id}" draggable="true"
    ondragstart="projDragStart(event,'${p.id}')" ondragend="projDragEnd(event)"
    onclick="openProjectDetail('${p.id}')">
    <div class="kcard-title">${projEsc(p.title)}</div>
    ${p.description?`<div class="kcard-desc">${projEsc(p.description.substring(0,70))}${p.description.length>70?'…':''}</div>`:''}
    <div class="kcard-meta">
      ${cat?`<span class="kcard-tag" style="background:${cat.color}18;color:${cat.color};border-color:${cat.color}40">${projEsc(cat.name)}</span>`:''}
      ${p.revenueStream?`<span class="kcard-tag" style="background:var(--g100);color:var(--g600);border-color:var(--g200)">${projEsc(p.revenueStream)}</span>`:''}
      ${p.link?`<a href="${projEsc(p.link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="kcard-tag" style="background:#eff6ff;color:#3b82f6;border-color:#bfdbfe;text-decoration:none">🔗 Link</a>`:''}
    </div>
    <div class="kcard-footer">
      <div style="display:flex;align-items:center;gap:6px">
        ${pri?`<span style="font-size:10px;font-family:var(--mono);color:${pri.color};font-weight:600">${pri.label.toUpperCase()}</span>`:''}
        ${p.assignee?`<span style="font-size:11px;color:var(--g400)">· ${projEsc(p.assignee)}</span>`:''}
      </div>
      ${dueStr?`<span style="font-size:10px;font-family:var(--mono);${dueCl}">${dueIcon} ${dueStr}${dueLabel}</span>`:''}
    </div>
  </div>`;
}

// ── DRAG & DROP ──
function projDragStart(e, id){
  projDragId = id;
  const p = projAll.find(x=>x.id===id);
  projDragSourceStatus = p ? p.status : null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
  setTimeout(()=>{ const el=document.getElementById('pcard-'+id); if(el) el.classList.add('dragging'); }, 0);
}
function projDragEnd(){
  document.querySelectorAll('.kanban-card.dragging').forEach(el=>el.classList.remove('dragging'));
  document.querySelectorAll('.kanban-col.drag-over').forEach(el=>el.classList.remove('drag-over'));
  projDragId = null;
}
function projDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget.closest?.('.kanban-col');
  if(col) col.classList.add('drag-over');
}
function projDragLeave(e){
  const col = e.currentTarget.closest?.('.kanban-col');
  if(col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
}
async function projDrop(e, newStatus){
  e.preventDefault();
  const col = document.querySelector(`.kanban-col[data-status="${newStatus}"]`);
  if(col) col.classList.remove('drag-over');
  if(!projDragId) return;
  const p = projAll.find(x=>x.id===projDragId);
  if(!p || p.status===newStatus){ projDragId=null; return; }
  const oldStatus = p.status;
  p.status = newStatus;
  renderKanban();
  renderProjStats();
  try{
    await sb.from('projects').update({ status:newStatus, updated_at:new Date().toISOString() }).eq('id',projDragId);
    await sb.from('project_activity').insert({ project_id:projDragId, actor:currentUser, action:'moved', field_name:'status', old_value:oldStatus, new_value:newStatus });
  } catch(err){
    console.error('[projDrop]',err);
    p.status = oldStatus;
    renderKanban();
    renderProjStats();
  }
  projDragId = null;
}

// ── PROJECT DETAIL PANEL ──
async function openProjectDetail(id, defaultStatus='backlog'){
  projDetailId = id;
  _projDirty = false;
  const overlay = document.getElementById('proj-overlay');
  const panel = document.getElementById('proj-panel');
  if(!overlay||!panel) return;
  overlay.style.display = 'block';
  panel.style.display = 'flex';
  panel.innerHTML = `<div style="padding:40px;text-align:center;color:var(--g400);flex:1">Memuat...</div>`;
  if(id){
    try{
      const [{ data:cmts },{ data:acts }] = await Promise.all([
        sb.from('project_comments').select('*').eq('project_id',id).order('created_at'),
        sb.from('project_activity').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(50)
      ]);
      projComments[id] = cmts || [];
      projActivity[id] = acts || [];
    } catch(e){ console.error(e); }
  }
  renderProjDetail(id, defaultStatus);
}

function closeProjectDetail(){
  const overlay = document.getElementById('proj-overlay');
  const panel   = document.getElementById('proj-panel');
  if(overlay) overlay.style.display = 'none';
  if(panel)   panel.style.display   = 'none';
  projDetailId = null;
  _projDirty = false;
}

function renderProjDetail(id, defaultStatus='backlog'){
  const panel = document.getElementById('proj-panel');
  if(!panel) return;
  const p = id ? projAll.find(x=>x.id===id) : null;
  const isNew = !p;
  const comments  = id ? (projComments[id]  || []) : [];
  const activities= id ? (projActivity[id] || []) : [];

  panel.innerHTML = `
  <div style="padding:16px 20px;border-bottom:1px solid var(--g100);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0">
    <span style="font-size:11px;font-family:var(--mono);color:var(--g400)">${isNew?'Project Baru':projEsc(id)}</span>
    <div style="display:flex;gap:8px">
      ${!isNew?`<button onclick="deleteProjConfirm('${id}')" style="padding:5px 12px;background:none;border:1px solid #fca5a5;color:#ef4444;border-radius:6px;font-size:12px;cursor:pointer">Hapus</button>`:''}
      <button onclick="closeProjectDetail()" style="padding:5px 14px;background:var(--black);color:var(--white);border:none;border-radius:6px;font-size:12px;cursor:pointer">✕</button>
    </div>
  </div>
  <div style="flex:1;display:flex;overflow:hidden">
    <div style="flex:1;padding:22px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:14px">
      <input id="pd-title" type="text" value="${projEsc(p?.title||'')}" placeholder="Judul project…" oninput="projMarkDirty()"
        style="font-size:18px;font-weight:600;border:none;border-bottom:2px solid var(--g100);background:none;outline:none;color:var(--black);font-family:var(--head);padding:0 0 6px 0;width:100%;transition:border-color .15s"
        onfocus="this.style.borderColor='var(--black)'" onblur="this.style.borderColor='var(--g100)'">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div>
          <div class="fg-label">Status</div>
          <select id="pd-status" onchange="projMarkDirty()" style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;background:var(--white)">
            ${PROJ_STATUSES.map(s=>`<option value="${s.key}" ${(p?.status||defaultStatus)===s.key?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="fg-label">Priority</div>
          <select id="pd-priority" onchange="projMarkDirty()" style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;background:var(--white)">
            ${PROJ_PRIORITIES.map(x=>`<option value="${x.key}" ${(p?.priority||'medium')===x.key?'selected':''}>${x.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="fg-label">Revenue Stream</div>
          <select id="pd-revenue" onchange="projMarkDirty()" style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;background:var(--white)">
            <option value="">—</option>
            ${PROJ_REVENUE.map(r=>`<option value="${r}" ${p?.revenueStream===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div>
          <div class="fg-label">PIC / Assignee</div>
          <input id="pd-assignee" type="text" list="pd-assignee-opts" value="${projEsc(p?.assignee||'')}" placeholder="Nama PIC…" oninput="projMarkDirty()"
            style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px">
          <datalist id="pd-assignee-opts">
            ${[...new Set(projAll.map(x=>x.assignee).filter(Boolean))].map(n=>`<option value="${projEsc(n)}">`).join('')}
          </datalist>
        </div>
        <div>
          <div class="fg-label">Due Date</div>
          <input id="pd-duedate" type="date" value="${p?.dueDate||''}" onchange="projMarkDirty()"
            style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px">
        </div>
        <div>
          <div class="fg-label">Kategori</div>
          <select id="pd-cat" onchange="projMarkDirty();projHandleCatNew()" style="width:100%;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;background:var(--white)">
            <option value="">— Pilih</option>
            ${projCats.map(c=>`<option value="${c.id}" ${p?.categoryId===c.id?'selected':''}>${projEsc(c.name)}</option>`).join('')}
            <option value="__new__">+ Kategori baru…</option>
          </select>
        </div>
      </div>
      <div>
        <div class="fg-label">Deskripsi</div>
        <textarea id="pd-desc" rows="3" placeholder="Deskripsi, tujuan, catatan penting…" oninput="projMarkDirty()"
          style="width:100%;padding:8px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;resize:vertical;font-family:var(--body);line-height:1.5">${projEsc(p?.description||'')}</textarea>
      </div>
      <div>
        <div class="fg-label">Link</div>
        <div style="display:flex;align-items:center;gap:6px">
          <input id="pd-link" type="url" value="${projEsc(p?.link||'')}" placeholder="https://…" oninput="projMarkDirty()"
            style="flex:1;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px;outline:none">
          ${p?.link?`<a href="${projEsc(p.link)}" target="_blank" rel="noopener noreferrer" style="padding:7px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#3b82f6;text-decoration:none;white-space:nowrap">Buka →</a>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button id="pd-save-btn" onclick="saveProjDetail('${id||''}')" disabled
          style="padding:8px 22px;background:var(--black);color:var(--white);border:none;border-radius:8px;font-size:13px;cursor:not-allowed;opacity:0.35;transition:opacity .15s">
          ${isNew?'Buat Project':'Simpan'}
        </button>
        <span id="pd-feedback" style="font-size:12px;color:var(--g400)"></span>
      </div>
      ${!isNew?`<div style="padding-top:12px;border-top:1px solid var(--g100)"><span style="font-size:11px;font-family:var(--mono);color:var(--g400)">
        Dibuat ${p.createdBy?'oleh '+projEsc(p.createdBy)+' · ':''} ${p.createdAt?new Date(p.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—'}
      </span></div>`:''}
    </div>
    ${!isNew?`<div style="width:260px;flex-shrink:0;border-left:1px solid var(--g100);display:flex;flex-direction:column">
      <div style="flex:1;overflow-y:auto;padding:16px;border-bottom:1px solid var(--g100);display:flex;flex-direction:column;gap:8px">
        <div style="font-size:12px;font-weight:600;color:var(--black);margin-bottom:2px">💬 Chat</div>
        <div id="pd-comments" style="display:flex;flex-direction:column;gap:8px;flex:1">
          ${comments.length?comments.map(c=>renderProjCmt(c)).join(''):`<div style="font-size:11px;color:var(--g400)">Belum ada komentar</div>`}
        </div>
        <div style="position:relative;flex-shrink:0;margin-top:4px">
          <div id="pd-mention-drop" style="display:none;position:absolute;bottom:36px;left:0;right:40px;background:var(--white);border:1px solid var(--g200);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:10;overflow:hidden;max-height:140px;overflow-y:auto"></div>
          <div style="display:flex;gap:5px">
            <input id="pd-cmt-in" type="text" placeholder="Tulis pesan… @ untuk mention"
              style="flex:1;padding:6px 9px;border:1px solid var(--g200);border-radius:6px;font-size:12px;outline:none"
              oninput="projHandleMentionInput('${id}')"
              onkeydown="projCmtKeydown(event,'${id}')">
            <button onclick="submitProjComment('${id}')" style="padding:6px 10px;background:var(--black);color:var(--white);border:none;border-radius:6px;font-size:13px;cursor:pointer">→</button>
          </div>
        </div>
      </div>
      <div style="padding:14px 16px;overflow-y:auto;max-height:220px">
        <div style="font-size:12px;font-weight:600;color:var(--black);margin-bottom:8px">📋 Activity</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${activities.length?activities.map(a=>renderProjAct(a)).join(''):`<div style="font-size:11px;color:var(--g400)">—</div>`}
        </div>
      </div>
    </div>`:''}
  </div>`;
}

function renderProjCmt(c){
  const dt = new Date(c.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  return `<div style="background:var(--off);border-radius:8px;padding:8px 10px">
    <div style="display:flex;justify-content:space-between;margin-bottom:3px">
      <span style="font-size:11px;font-weight:600;color:var(--black)">${projEsc(c.author||'—')}</span>
      <span style="font-size:10px;color:var(--g400);font-family:var(--mono)">${dt}</span>
    </div>
    <div style="font-size:12px;color:var(--g600);white-space:pre-wrap;line-height:1.5">${projLinkify(c.content)}</div>
  </div>`;
}

function renderProjAct(a){
  const dt = new Date(a.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const desc = a.action==='created'?'membuat project ini'
    : a.action==='moved'?`memindahkan ke <strong>${projEsc(a.new_value)}</strong>`
    : a.action==='updated'?`mengubah ${projEsc(a.field_name||'field')}`
    : projEsc(a.action);
  return `<div style="font-size:11px;color:var(--g400);line-height:1.45">
    <span style="color:var(--black);font-weight:500">${projEsc(a.actor||'—')}</span> ${desc}
    <div style="font-family:var(--mono);font-size:10px;margin-top:1px">${dt}</div>
  </div>`;
}

function projMarkDirty(){
  _projDirty = true;
  const btn = document.getElementById('pd-save-btn');
  if(btn){ btn.disabled=false; btn.style.opacity='1'; btn.style.cursor='pointer'; }
}

async function projHandleCatNew(){
  const sel = document.getElementById('pd-cat');
  if(!sel || sel.value !== '__new__') return;
  const name = prompt('Nama kategori baru:');
  if(!name || !name.trim()){ sel.value=''; return; }
  try{
    const { data, error } = await sb.from('project_categories').insert({ name:name.trim(), created_by:currentUser }).select().single();
    if(error) throw error;
    projCats.push(data);
    renderProjCatFilter();
    sel.innerHTML += `<option value="${data.id}">${projEsc(data.name)}</option>`;
    sel.value = data.id;
    projMarkDirty();
  } catch(e){ alert('Gagal membuat kategori: '+e.message); sel.value=''; }
}

async function saveProjDetail(existingId){
  const title   = document.getElementById('pd-title')?.value?.trim();
  if(!title){ showProjFeedback('Judul tidak boleh kosong','error'); return; }
  const status  = document.getElementById('pd-status')?.value  || 'backlog';
  const priority= document.getElementById('pd-priority')?.value|| 'medium';
  const revenue = document.getElementById('pd-revenue')?.value || '';
  const assignee= document.getElementById('pd-assignee')?.value?.trim()||'';
  const dueDate = document.getElementById('pd-duedate')?.value || null;
  const catId   = document.getElementById('pd-cat')?.value     || null;
  const desc    = document.getElementById('pd-desc')?.value?.trim()||'';
  const link    = document.getElementById('pd-link')?.value?.trim()||'';
  const btn = document.getElementById('pd-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Menyimpan…'; btn.style.opacity='0.5'; }
  try{
    if(!existingId){
      const id = genId('PRJ');
      const pos = projAll.filter(p=>p.status===status).length;
      const { error } = await sb.from('projects').insert({
        id, title, description:desc||null, status, priority,
        assignee:assignee||null, due_date:dueDate||null,
        revenue_stream:revenue||null, category_id:catId||null,
        link:link||null, position:pos, created_by:currentUser
      });
      if(error) throw error;
      await sb.from('project_activity').insert({ project_id:id, actor:currentUser, action:'created' });
      projAll.push({ id, title, description:desc, status, priority, assignee, dueDate:dueDate||'',
        revenueStream:revenue, categoryId:catId||'', link:link||'', position:pos, createdBy:currentUser,
        createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
      renderKanban();
      renderProjStats();
      openProjectDetail(id);
    } else {
      const old = projAll.find(x=>x.id===existingId);
      const { error } = await sb.from('projects').update({
        title, description:desc||null, status, priority,
        assignee:assignee||null, due_date:dueDate||null,
        revenue_stream:revenue||null, category_id:catId||null,
        link:link||null, updated_at:new Date().toISOString()
      }).eq('id',existingId);
      if(error) throw error;
      const changes = [];
      if(old?.title!==title) changes.push({f:'title',o:old?.title,n:title});
      if(old?.status!==status) changes.push({f:'status',o:old?.status,n:status});
      if(old?.priority!==priority) changes.push({f:'priority',o:old?.priority,n:priority});
      for(const ch of changes) await sb.from('project_activity').insert({ project_id:existingId, actor:currentUser, action:'updated', field_name:ch.f, old_value:ch.o, new_value:ch.n });
      Object.assign(old, { title, description:desc, status, priority, assignee, dueDate:dueDate||'',
        revenueStream:revenue, categoryId:catId||'', link:link||'', updatedAt:new Date().toISOString() });
      renderKanban();
      renderProjStats();
      showProjFeedback('Tersimpan ✓');
      _projDirty = false;
      if(btn){ btn.disabled=true; btn.textContent='Simpan'; btn.style.opacity='0.35'; btn.style.cursor='not-allowed'; }
    }
  } catch(e){
    console.error('[saveProjDetail]',e);
    showProjFeedback('Gagal: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='Simpan'; btn.style.opacity='1'; btn.style.cursor='pointer'; }
  }
}

function showProjFeedback(msg, type='success'){
  const el = document.getElementById('pd-feedback');
  if(!el) return;
  el.style.color = type==='error'?'#ef4444':'#10b981';
  el.textContent = msg;
  setTimeout(()=>{ if(el.textContent===msg) el.textContent=''; },3000);
}

async function submitProjComment(projectId){
  const input = document.getElementById('pd-cmt-in');
  const content = input?.value?.trim();
  if(!content||!projectId) return;
  input.value = '';
  try{
    const { data, error } = await sb.from('project_comments').insert({
      project_id:projectId, author:currentUser, content
    }).select().single();
    if(error) throw error;
    if(!projComments[projectId]) projComments[projectId]=[];
    projComments[projectId].push(data);
    const cEl = document.getElementById('pd-comments');
    if(cEl){
      const empty = cEl.querySelector('[style*="Belum ada komentar"]');
      if(empty) cEl.innerHTML='';
      cEl.innerHTML += renderProjCmt(data);
      cEl.scrollTop = cEl.scrollHeight;
    }
  } catch(e){ console.error('[submitProjComment]',e); }
}

async function deleteProjConfirm(id){
  if(!confirm('Hapus project ini? Semua komentar dan aktivitas juga akan terhapus.')) return;
  try{
    const { error } = await sb.from('projects').delete().eq('id',id);
    if(error) throw error;
    projAll = projAll.filter(p=>p.id!==id);
    closeProjectDetail();
    renderKanban();
    renderProjStats();
  } catch(e){ alert('Gagal hapus: '+e.message); }
}

function openProjCatManager(){
  const modal = `<div style="position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
    <div style="background:var(--white);border-radius:14px;padding:24px;width:360px;max-height:80vh;overflow-y:auto">
      <div style="font-family:var(--head);font-size:16px;font-weight:700;margin-bottom:16px">Kelola Kategori</div>
      <div id="cat-mgr-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        ${projCats.map(c=>`
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--g100);border-radius:8px">
            <input type="color" value="${c.color}" onchange="updateProjCatColor('${c.id}',this.value)"
              style="width:24px;height:24px;border:none;cursor:pointer;border-radius:4px;padding:0">
            <span style="flex:1;font-size:13px">${projEsc(c.name)}</span>
            <button onclick="deleteProjCat('${c.id}',this)" style="background:none;border:none;color:var(--g400);cursor:pointer;font-size:14px;padding:0 4px">✕</button>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:7px">
        <input id="new-cat-name" type="text" placeholder="Nama kategori baru…" style="flex:1;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-size:13px" onkeydown="if(event.key==='Enter')addProjCatFromManager()">
        <button onclick="addProjCatFromManager()" style="padding:7px 14px;background:var(--black);color:var(--white);border:none;border-radius:8px;font-size:13px;cursor:pointer">Tambah</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modal);
}

async function addProjCatFromManager(){
  const input = document.getElementById('new-cat-name');
  const name = input?.value?.trim();
  if(!name) return;
  try{
    const { data, error } = await sb.from('project_categories').insert({ name, created_by:currentUser }).select().single();
    if(error) throw error;
    projCats.push(data);
    renderProjCatFilter();
    input.value='';
    const list = document.getElementById('cat-mgr-list');
    if(list) list.insertAdjacentHTML('beforeend',`
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--g100);border-radius:8px">
        <input type="color" value="${data.color}" onchange="updateProjCatColor('${data.id}',this.value)" style="width:24px;height:24px;border:none;cursor:pointer;border-radius:4px;padding:0">
        <span style="flex:1;font-size:13px">${projEsc(data.name)}</span>
        <button onclick="deleteProjCat('${data.id}',this)" style="background:none;border:none;color:var(--g400);cursor:pointer;font-size:14px;padding:0 4px">✕</button>
      </div>`);
  } catch(e){ alert('Gagal: '+e.message); }
}

async function updateProjCatColor(id, color){
  try{
    await sb.from('project_categories').update({ color }).eq('id',id);
    const c = projCats.find(x=>x.id===id);
    if(c) c.color = color;
    renderKanban();
  } catch(e){ console.error(e); }
}

async function deleteProjCat(id, btn){
  if(!confirm('Hapus kategori ini? Project yang menggunakan kategori ini akan kehilangan kategorinya.')) return;
  try{
    const { error } = await sb.from('project_categories').delete().eq('id',id);
    if(error) throw error;
    projCats = projCats.filter(c=>c.id!==id);
    projAll.forEach(p=>{ if(p.categoryId===id) p.categoryId=''; });
    renderProjCatFilter();
    renderKanban();
    btn?.closest('div')?.remove();
  } catch(e){ alert('Gagal hapus: '+e.message); }
}

function projHandleMentionInput(pid){
  const input = document.getElementById('pd-cmt-in');
  const drop  = document.getElementById('pd-mention-drop');
  if(!input||!drop) return;
  const before = input.value.slice(0, input.selectionStart);
  const match  = before.match(/@(\w*)$/);
  if(!match){ drop.style.display='none'; return; }
  const q = match[1].toLowerCase();
  const pics = [...new Set(projAll.map(p=>p.assignee).filter(Boolean))];
  const hits = pics.filter(n=>n.toLowerCase().includes(q)).slice(0,6);
  if(!hits.length){ drop.style.display='none'; return; }
  drop.innerHTML = hits.map(n=>`<div onclick="projInsertMention('${projEsc(n)}')"
    style="padding:7px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--g100)"
    onmouseover="this.style.background='var(--off)'" onmouseout="this.style.background=''">${projEsc(n)}</div>`).join('');
  drop.style.display='block';
}
function projInsertMention(name){
  const input = document.getElementById('pd-cmt-in');
  const drop  = document.getElementById('pd-mention-drop');
  if(!input) return;
  const pos  = input.selectionStart;
  const before = input.value.slice(0,pos).replace(/@\w*$/, '@'+name+' ');
  input.value = before + input.value.slice(pos);
  input.focus();
  input.setSelectionRange(before.length, before.length);
  if(drop) drop.style.display='none';
}
function projCmtKeydown(e, pid){
  const drop = document.getElementById('pd-mention-drop');
  if(drop && drop.style.display!=='none'){
    if(e.key==='Escape'){ drop.style.display='none'; return; }
    if(e.key==='Enter'){ e.preventDefault(); drop.querySelector('div')?.click(); return; }
    if(e.key==='ArrowDown'){ e.preventDefault(); drop.querySelector('div')?.focus(); return; }
  }
  if(e.key==='Enter' && (!drop || drop.style.display==='none')) submitProjComment(pid);
}

// ── CALENDAR ──
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calEvents = [];
let calActiveFilters = new Set(['project','collection','colitem','leads','popup']);
const CAL_MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const CAL_DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

async function loadCalendar() {
  try {
    const [projRes, colRes, colItemRes, leadsRes, popupRes] = await Promise.all([
      sb.from('projects').select('id,title,due_date,status').not('due_date','is',null).neq('status','done'),
      sb.from('collections').select('id,collection_name,release_date').not('release_date','is',null),
      sb.from('collection_items').select('id,sku_name,deadline,collection_id').not('deadline','is',null),
      sb.from('leads').select('id,lead_name,follow_up_date,stage').not('follow_up_date','is',null),
      sb.from('popup_booths').select('id,event_name,event_date,location').not('event_date','is',null)
    ]);
    calEvents = [];
    (projRes.data||[]).forEach(r=>calEvents.push({src:'project',date:r.due_date,label:r.title,id:r.id}));
    (colRes.data||[]).forEach(r=>calEvents.push({src:'collection',date:r.release_date,label:r.collection_name,id:r.id}));
    (colItemRes.data||[]).forEach(r=>calEvents.push({src:'colitem',date:r.deadline,label:r.sku_name,id:r.collection_id}));
    (leadsRes.data||[]).forEach(r=>calEvents.push({src:'leads',date:r.follow_up_date,label:r.lead_name,id:r.id}));
    (popupRes.data||[]).forEach(r=>calEvents.push({src:'popup',date:r.event_date,label:r.event_name+(r.location?` · ${r.location}`:''),id:r.id}));
    renderCalendar();
  } catch(e){ console.error('Calendar load error:',e); }
}

function calToggleFilter(src, el) {
  if (calActiveFilters.has(src)) { calActiveFilters.delete(src); el.classList.remove('active'); }
  else { calActiveFilters.add(src); el.classList.add('active'); }
  renderCalendar();
}

function calChangeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  loadCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('cal-month-title');
  const gridEl = document.getElementById('cal-grid');
  if (!titleEl || !gridEl) return;
  titleEl.textContent = CAL_MONTH_NAMES[calMonth] + ' ' + calYear;

  const today = new Date(); today.setHours(0,0,0,0);
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  const filtered = calEvents.filter(e => calActiveFilters.has(e.src));
  const byDate = {};
  filtered.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });

  const srcLabel = {project:'📌',collection:'🎨',colitem:'🧵',leads:'🎯'};
  let html = CAL_DAY_NAMES.map(d=>`<div class="cal-dow">${d}</div>`).join('');

  // prev month fillers
  for (let i=0; i<firstDow; i++) {
    const d = daysInPrev - firstDow + 1 + i;
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }

  // current month
  for (let d=1; d<=daysInMonth; d++) {
    const mm = String(calMonth+1).padStart(2,'0');
    const dd = String(d).padStart(2,'0');
    const dateStr = `${calYear}-${mm}-${dd}`;
    const dayDate = new Date(calYear, calMonth, d);
    const isToday = dayDate.getTime() === today.getTime();
    const dayEvts = byDate[dateStr] || [];
    const evHtml = dayEvts.slice(0,3).map(e=>`<div class="cal-event src-${e.src}" onclick="event.stopPropagation();calEventClick('${e.src}','${e.id}')" title="${e.label}">${srcLabel[e.src]} ${e.label}</div>`).join('');
    const overflow = dayEvts.length > 3 ? `<div class="cal-overflow">+${dayEvts.length-3} lagi</div>` : '';
    html += `<div class="cal-day${isToday?' today':''}"><div class="cal-day-num">${d}</div>${evHtml}${overflow}</div>`;
  }

  // next month fillers
  const total = firstDow + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i=1; i<=rem; i++) html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;

  gridEl.innerHTML = html;
}

function calEventClick(src, id) {
  const pageMap = {project:'project',collection:'collections',colitem:'collections',leads:'leads',popup:'popup-booth'};
  if (pageMap[src]) showPage(pageMap[src], null);
}

const CAL_ICS_URL = 'https://qyxdjdwgvwtrpnvfndnu.supabase.co/functions/v1/calendar-ics?token=sntr-cal-f8k2';

function calShowIcsUrl() {
  const msg = `Subscribe URL untuk Google Calendar:\n\n${CAL_ICS_URL}\n\nCara:\n1. Buka Google Calendar\n2. Klik "+" di "Other calendars" → "From URL"\n3. Paste URL di atas → Add Calendar\n\nCalendar akan auto-sync tiap ~12 jam. Kalau ada perubahan tanggal, akan ikut update.`;
  alert(msg);
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

