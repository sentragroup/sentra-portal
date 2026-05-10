const SHEET_ID     = "1sTG43OTwwNFpibT-l36ZjOW9pv8UDlLzmwlSgH-UdgE";
const CACHE_KEY    = "agreements_data";
const CACHE_KEY_IP = "ip_master_data";
const CACHE_KEY_RR = "rr_data";
const CACHE_KEY_BM = "brand_master_data";
const CACHE_KEY_SR = "sales_report_data";
const CACHE_KEY_LD = "leads_data";
const CACHE_KEY_DP = "dist_partners_data";
const CACHE_TTL    = 60;

const SHEETS = {
  agreements:    "agreements",
  ip_master:     "ip_master",
  recipients:    "royalty_recipients",
  brand_master:  "brand_master",
  sr_reports:    "sr_reports",
  sr_startdates: "sr_startdates",
  leads:         "leads",
  dist_partners: "dist_partners"
};

const HEADERS = {
  agreements:    ["ID","Date Submitted","Agreement Title","Partner/Client","PIC","Related IP / Brand","Revenue Stream","Agreement Type","Start Date","End Date","Status","Link Agreement","Email Thread Link","Submitted By","Last Updated","Last Updated By"],
  ip_master:     ["ID","IP / Brand Name","Category","Live Status","Revenue Stream","Related Agreement","Royalty Type","Percentage","Fixed Amount","Termin","PPh Tax Rate","Notes","Date Added","Added By","PIC"],
  recipients:    ["ID","Nama Penerima","Tipe","Related IP","Royalty Type","Percentage","Fixed Amount","Termin","Link PKS","Notes","Date Added","Added By"],
  brand_master:  ["ID","IP / Brand Name","Category","Live Status","Revenue Stream","Related Agreement","Apparel Rate","Accessories Rate","Collectible Rate","Preloved Goods Rate","Wellness Rate","Others Rate","Notes","Date Added","Added By","PIC"],
  sr_reports:    ["Brand ID","Brand Name","Month Index","Link","Notes","Submitted By","Submitted At"],
  sr_startdates: ["Brand ID","Brand Name","Start Date","Set By","Set At"],
  leads:         ["ID","Lead Name","Category","Stage","PIC","Revenue Stream","Contact","Notes","Date Added","Added By","Last Updated","Last Updated By"],
  dist_partners: ["ID","Partner Name","Type","Channel","Region","PIC","Contact Person","Contact Info","Related Agreement","Live Status","Notes","Date Added","Added By","Last Updated","Last Updated By"]
};

function doGet(e) {
  try {
    const action=e.parameter.action, p=e.parameter;

    // ── AGREEMENTS ──
    if(action==="submit") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.agreements),colMap=getColMap(sheet);
      const id="AGR-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      const nowFmt=Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm");
      const row=new Array(sheet.getLastColumn()).fill("");
      const set=(h,v)=>{const i=colMap[h];if(i!==undefined)row[i]=v;};
      set("ID",id);set("Date Submitted",nowFmt);set("Agreement Title",p.title||"");
      set("Partner/Client",p.partner||"");set("PIC",p.pic||"");set("Related IP / Brand",p.brand||"");
      set("Revenue Stream",p.revenue||"");set("Agreement Type",p.type||"");
      set("Start Date",p.start||"");set("End Date",p.end||"");set("Status",p.status||"Draft");
      set("Link Agreement",p.link||"");set("Email Thread Link",p.emailLink||"");
      set("Submitted By",p.by||"");set("Last Updated",nowFmt);set("Last Updated By",p.by||"");
      sheet.appendRow(row);clearCache(CACHE_KEY);return output({success:true,id});
    }
    if(action==="list") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY);
      if(cached)return output(JSON.parse(cached));
      const result=buildAgreementList();
      cache.put(CACHE_KEY,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateStatus") {
      const sheet=getSheet(SHEETS.agreements),colMap=getColMap(sheet);
      const tz=Session.getScriptTimeZone(),nowFmt=Utilities.formatDate(new Date(),tz,"dd MMM yyyy HH:mm");
      const row=Number(p.rowIndex);
      sheet.getRange(row,colMap["Status"]+1).setValue(p.status);
      sheet.getRange(row,colMap["Last Updated"]+1).setValue(nowFmt);
      sheet.getRange(row,colMap["Last Updated By"]+1).setValue(p.by||"");
      clearCache(CACHE_KEY);return output({success:true});
    }

    // ── IP MASTER ──
    if(action==="submitIP") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.ip_master);
      const id="IP-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      sheet.appendRow([id,p.name||"",p.category||"",p.liveStatus||"Active",p.revenue||"",p.agreements||"",p.royaltyType||"",p.pct||"",p.fixed||"",p.termin||"",p.pph||"",p.notes||"",Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm"),p.by||"",p.pic||""]);
      clearCache(CACHE_KEY_IP);return output({success:true,id});
    }
    if(action==="listIP") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_IP);
      if(cached)return output(JSON.parse(cached));
      const result=buildIPList();
      cache.put(CACHE_KEY_IP,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateIP") {
      const sheet=getSheet(SHEETS.ip_master),row=Number(p.rowIndex);
      sheet.getRange(row,2).setValue(p.name||"");sheet.getRange(row,3).setValue(p.category||"");
      sheet.getRange(row,4).setValue(p.liveStatus||"");sheet.getRange(row,5).setValue(p.revenue||"");
      sheet.getRange(row,6).setValue(p.agreements||"");sheet.getRange(row,7).setValue(p.royaltyType||"");
      sheet.getRange(row,8).setValue(p.pct||"");sheet.getRange(row,9).setValue(p.fixed||"");
      sheet.getRange(row,10).setValue(p.termin||"");sheet.getRange(row,11).setValue(p.pph||"");
      sheet.getRange(row,12).setValue(p.notes||"");
      sheet.getRange(row,15).setValue(p.pic||"");
      clearCache(CACHE_KEY_IP);return output({success:true});
    }
    if(action==="updateIPLiveStatus") {
      const sheet=getSheet(SHEETS.ip_master),row=Number(p.rowIndex);
      sheet.getRange(row,4).setValue(p.liveStatus||"");
      clearCache(CACHE_KEY_IP);return output({success:true});
    }

    // ── ROYALTY RECIPIENTS ──
    if(action==="submitRR") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.recipients);
      const id="RR-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      sheet.appendRow([id,p.name||"",p.tipe||"",p.ip||"",p.royaltyType||"",p.pct||"",p.fixed||"",p.termin||"",p.pks||"",p.notes||"",Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm"),p.by||""]);
      clearCache(CACHE_KEY_RR);return output({success:true,id});
    }
    if(action==="listRR") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_RR);
      if(cached)return output(JSON.parse(cached));
      const result=buildRRList();
      cache.put(CACHE_KEY_RR,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateRR") {
      const sheet=getSheet(SHEETS.recipients),row=Number(p.rowIndex);
      sheet.getRange(row,2).setValue(p.name||"");sheet.getRange(row,3).setValue(p.tipe||"");
      sheet.getRange(row,4).setValue(p.ip||"");sheet.getRange(row,5).setValue(p.royaltyType||"");
      sheet.getRange(row,6).setValue(p.pct||"");sheet.getRange(row,7).setValue(p.fixed||"");
      sheet.getRange(row,8).setValue(p.termin||"");sheet.getRange(row,9).setValue(p.pks||"");
      sheet.getRange(row,10).setValue(p.notes||"");
      clearCache(CACHE_KEY_RR);return output({success:true});
    }

    // ── BRAND MASTER ──
    if(action==="submitBM") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.brand_master);
      const id="BM-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      sheet.appendRow([id,p.name||"",p.category||"",p.liveStatus||"Active",p.revenue||"",p.agreements||"",p.apparel||"",p.accessories||"",p.collectible||"",p.preloved||"",p.wellness||"",p.others||"",p.notes||"",Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm"),p.by||"",p.pic||""]);
      clearCache(CACHE_KEY_BM);clearCache(CACHE_KEY_SR);return output({success:true,id});
    }
    if(action==="listBM") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_BM);
      if(cached)return output(JSON.parse(cached));
      const result=buildBMList();
      cache.put(CACHE_KEY_BM,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateBM") {
      const sheet=getSheet(SHEETS.brand_master),row=Number(p.rowIndex);
      sheet.getRange(row,2).setValue(p.name||"");sheet.getRange(row,3).setValue(p.category||"");
      sheet.getRange(row,4).setValue(p.liveStatus||"");sheet.getRange(row,5).setValue(p.revenue||"");
      sheet.getRange(row,6).setValue(p.agreements||"");sheet.getRange(row,7).setValue(p.apparel||"");
      sheet.getRange(row,8).setValue(p.accessories||"");sheet.getRange(row,9).setValue(p.collectible||"");
      sheet.getRange(row,10).setValue(p.preloved||"");sheet.getRange(row,11).setValue(p.wellness||"");
      sheet.getRange(row,12).setValue(p.others||"");sheet.getRange(row,13).setValue(p.notes||"");
      sheet.getRange(row,16).setValue(p.pic||"");
      clearCache(CACHE_KEY_BM);clearCache(CACHE_KEY_SR);return output({success:true});
    }

    // ── SALES REPORT ──
    if(action==="listSR") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_SR);
      if(cached)return output(JSON.parse(cached));
      const result=buildSRList();
      cache.put(CACHE_KEY_SR,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }

    if(action==="submitSRReport") {
      const sheet=getSheet(SHEETS.sr_reports);
      const now=new Date(),tz=Session.getScriptTimeZone();
      const nowFmt=Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm");
      // check if exists — update if so
      const data=sheet.getDataRange().getValues();
      let updated=false;
      for(let i=1;i<data.length;i++){
        if(String(data[i][0])===p.brandId&&String(data[i][2])===p.monthIdx){
          sheet.getRange(i+1,4).setValue(p.link||"");
          sheet.getRange(i+1,5).setValue(p.notes||"");
          sheet.getRange(i+1,6).setValue(p.by||"");
          sheet.getRange(i+1,7).setValue(nowFmt);
          updated=true; break;
        }
      }
      if(!updated) sheet.appendRow([p.brandId||"",p.brandName||"",p.monthIdx||"",p.link||"",p.notes||"",p.by||"",nowFmt]);
      clearCache(CACHE_KEY_SR);return output({success:true});
    }

    if(action==="clearSRReport") {
      const sheet=getSheet(SHEETS.sr_reports);
      const data=sheet.getDataRange().getValues();
      for(let i=1;i<data.length;i++){
        if(String(data[i][0])===p.brandId&&String(data[i][2])===p.monthIdx){
          sheet.deleteRow(i+1); break;
        }
      }
      clearCache(CACHE_KEY_SR);return output({success:true});
    }

    if(action==="setSRStartDate") {
      const sheet=getSheet(SHEETS.sr_startdates);
      const now=new Date(),tz=Session.getScriptTimeZone();
      const nowFmt=Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm");
      const data=sheet.getDataRange().getValues();
      let updated=false;
      for(let i=1;i<data.length;i++){
        if(String(data[i][0])===p.brandId){
          sheet.getRange(i+1,3).setValue(p.startDate||"");
          sheet.getRange(i+1,4).setValue(p.by||"");
          sheet.getRange(i+1,5).setValue(nowFmt);
          updated=true; break;
        }
      }
      if(!updated) sheet.appendRow([p.brandId||"",p.brandName||"",p.startDate||"",p.by||"",nowFmt]);
      clearCache(CACHE_KEY_SR);return output({success:true});
    }

    // ── DISTRIBUTION PARTNERS ──
    if(action==="submitDP") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.dist_partners);
      const id="DP-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      const nowFmt=Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm");
      sheet.appendRow([id,p.name||"",p.type||"",p.channel||"",p.region||"",p.pic||"",p.contactPerson||"",p.contactInfo||"",p.agreements||"",p.liveStatus||"Active",p.notes||"",nowFmt,p.by||"",nowFmt,p.by||""]);
      clearCache(CACHE_KEY_DP);return output({success:true,id});
    }
    if(action==="listDP") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_DP);
      if(cached)return output(JSON.parse(cached));
      const result=buildDPList();
      cache.put(CACHE_KEY_DP,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateDP") {
      const sheet=getSheet(SHEETS.dist_partners),row=Number(p.rowIndex);
      const tz=Session.getScriptTimeZone(),nowFmt=Utilities.formatDate(new Date(),tz,"dd MMM yyyy HH:mm");
      sheet.getRange(row,2).setValue(p.name||"");sheet.getRange(row,3).setValue(p.type||"");
      sheet.getRange(row,4).setValue(p.channel||"");sheet.getRange(row,5).setValue(p.region||"");
      sheet.getRange(row,6).setValue(p.pic||"");sheet.getRange(row,7).setValue(p.contactPerson||"");
      sheet.getRange(row,8).setValue(p.contactInfo||"");sheet.getRange(row,9).setValue(p.agreements||"");
      sheet.getRange(row,10).setValue(p.liveStatus||"");sheet.getRange(row,11).setValue(p.notes||"");
      sheet.getRange(row,14).setValue(nowFmt);sheet.getRange(row,15).setValue(p.by||"");
      clearCache(CACHE_KEY_DP);return output({success:true});
    }
    if(action==="updateDPLiveStatus") {
      const sheet=getSheet(SHEETS.dist_partners),row=Number(p.rowIndex);
      const tz=Session.getScriptTimeZone(),nowFmt=Utilities.formatDate(new Date(),tz,"dd MMM yyyy HH:mm");
      sheet.getRange(row,10).setValue(p.liveStatus||"");
      sheet.getRange(row,14).setValue(nowFmt);sheet.getRange(row,15).setValue(p.by||"");
      clearCache(CACHE_KEY_DP);return output({success:true});
    }

    // ── LEADS ──
    if(action==="submitLead") {
      const now=new Date(),tz=Session.getScriptTimeZone();
      const sheet=getSheet(SHEETS.leads);
      const id="LD-"+Utilities.formatDate(now,tz,"yyyyMMdd")+"-"+String(sheet.getLastRow()).padStart(3,"0");
      const nowFmt=Utilities.formatDate(now,tz,"dd MMM yyyy HH:mm");
      sheet.appendRow([id,p.name||"",p.category||"",p.stage||"New",p.pic||"",p.revenue||"",p.contact||"",p.notes||"",nowFmt,p.by||"",nowFmt,p.by||""]);
      clearCache(CACHE_KEY_LD);return output({success:true,id});
    }
    if(action==="listLeads") {
      const cache=CacheService.getScriptCache(),cached=cache.get(CACHE_KEY_LD);
      if(cached)return output(JSON.parse(cached));
      const result=buildLeadsList();
      cache.put(CACHE_KEY_LD,JSON.stringify(result),CACHE_TTL);
      return output(result);
    }
    if(action==="updateLead") {
      const sheet=getSheet(SHEETS.leads),row=Number(p.rowIndex);
      const tz=Session.getScriptTimeZone(),nowFmt=Utilities.formatDate(new Date(),tz,"dd MMM yyyy HH:mm");
      sheet.getRange(row,2).setValue(p.name||"");sheet.getRange(row,3).setValue(p.category||"");
      sheet.getRange(row,4).setValue(p.stage||"");sheet.getRange(row,5).setValue(p.pic||"");
      sheet.getRange(row,6).setValue(p.revenue||"");sheet.getRange(row,7).setValue(p.contact||"");
      sheet.getRange(row,8).setValue(p.notes||"");sheet.getRange(row,11).setValue(nowFmt);
      sheet.getRange(row,12).setValue(p.by||"");
      clearCache(CACHE_KEY_LD);return output({success:true});
    }
    if(action==="updateLeadStage") {
      const sheet=getSheet(SHEETS.leads),row=Number(p.rowIndex);
      const tz=Session.getScriptTimeZone(),nowFmt=Utilities.formatDate(new Date(),tz,"dd MMM yyyy HH:mm");
      sheet.getRange(row,4).setValue(p.stage||"");sheet.getRange(row,11).setValue(nowFmt);
      sheet.getRange(row,12).setValue(p.by||"");
      clearCache(CACHE_KEY_LD);return output({success:true});
    }

    return output({success:false,error:"Unknown action"});
  } catch(err){return output({success:false,error:err.message});}
}

function doPost(e){return doGet(e);}

// ── BUILD LISTS ──
function buildAgreementList() {
  const sheet=getSheet(SHEETS.agreements),data=sheet.getDataRange().getValues();
  if(data.length<=1)return{success:true,rows:[],brands:[],types:[],pics:[]};
  const tz=Session.getScriptTimeZone();
  const headers=data[0].map(h=>String(h).trim()),colMap={};
  headers.forEach((h,i)=>colMap[h]=i);
  const get=(r,h)=>{const i=colMap[h];return i!==undefined?String(r[i]||"").trim():"";};
  const fmtDate=(val)=>{
    if(!val)return"";
    if(val instanceof Date&&!isNaN(val))return Utilities.formatDate(val,tz,"dd MMM yyyy");
    const s=String(val).trim();if(!s)return"";
    const d=new Date(s);if(!isNaN(d))return Utilities.formatDate(d,tz,"dd MMM yyyy");
    return s;
  };
  const rows=data.slice(1).filter(r=>r[colMap["Agreement Title"]]).map((r,i)=>({
    rowIndex:i+2,id:get(r,"ID"),date:get(r,"Date Submitted"),title:get(r,"Agreement Title"),
    partner:get(r,"Partner/Client"),pic:get(r,"PIC"),brand:get(r,"Related IP / Brand"),
    revenue:get(r,"Revenue Stream"),type:get(r,"Agreement Type"),
    start:fmtDate(r[colMap["Start Date"]]),end:fmtDate(r[colMap["End Date"]]),
    status:get(r,"Status"),link:get(r,"Link Agreement"),emailLink:get(r,"Email Thread Link"),
    by:get(r,"Submitted By"),lastUpdate:fmtDate(r[colMap["Last Updated"]]),lastBy:get(r,"Last Updated By")
  }));
  const uniq=(k)=>[...new Set(rows.map(r=>r[k]).filter(Boolean))];
  return{success:true,rows,brands:uniq("brand"),types:uniq("type"),pics:uniq("pic")};
}

function buildIPList() {
  const tz=Session.getScriptTimeZone(),now=new Date();now.setHours(0,0,0,0);
  const agrSheet=getSheet(SHEETS.agreements),agrData=agrSheet.getDataRange().getValues();
  const agrHeaders=agrData[0].map(h=>String(h).trim()),agrColMap={};
  agrHeaders.forEach((h,i)=>agrColMap[h]=i);
  const agrRows=agrData.slice(1).filter(r=>r[agrColMap["Agreement Title"]]);
  const agrMap={};
  agrRows.forEach(r=>{
    const id=String(r[agrColMap["ID"]]||"").trim(),st=String(r[agrColMap["Status"]]||"").trim();
    const endRaw=r[agrColMap["End Date"]];
    let endDate=null;
    if(endRaw instanceof Date&&!isNaN(endRaw))endDate=new Date(endRaw);
    else if(endRaw){const d=new Date(endRaw);if(!isNaN(d))endDate=d;}
    if(id)agrMap[id]={status:st,endDate};
  });
  const agrIDs=agrRows.map(r=>({id:String(r[agrColMap["ID"]]||"").trim(),label:[String(r[agrColMap["Partner/Client"]]||""),String(r[agrColMap["Agreement Type"]]||"")].filter(Boolean).join(" — ")})).filter(o=>o.id);
  const ipSheet=getSheet(SHEETS.ip_master),ipData=ipSheet.getDataRange().getValues();
  if(ipData.length<=1)return{success:true,rows:[],agrIDs};
  const rows=ipData.slice(1).filter(r=>r[0]).map((r,i)=>({
    rowIndex:i+2,id:String(r[0]||""),name:String(r[1]||""),category:String(r[2]||""),
    liveStatus:String(r[3]||"Active"),revenue:String(r[4]||""),agreements:String(r[5]||""),
    royaltyType:String(r[6]||""),pct:String(r[7]||""),fixed:String(r[8]||""),
    termin:String(r[9]||""),pph:String(r[10]||""),notes:String(r[11]||""),pic:String(r[14]||""),
    ipStatus:computeIPStatus(String(r[5]||""),agrMap,now)
  }));
  return{success:true,rows,agrIDs};
}

function computeIPStatus(agrStr,agrMap,now) {
  if(!agrStr||!agrStr.trim())return"No Agreement";
  const ids=agrStr.split(",").map(s=>s.trim()).filter(Boolean);
  if(!ids.length)return"No Agreement";
  const infos=ids.map(id=>agrMap[id]).filter(Boolean);
  if(!infos.length)return"No Agreement";
  const signed=infos.filter(a=>a.status==="Signed");
  if(signed.length>0){
    const withEnd=signed.filter(a=>a.endDate);
    if(!withEnd.length)return"Active";
    const soonest=withEnd.reduce((a,b)=>a.endDate<b.endDate?a:b);
    const diff=Math.ceil((soonest.endDate-now)/(1000*60*60*24));
    if(diff<0)return"Expired";if(diff<=30)return"Near Expiring";return"Active";
  }
  if(infos.some(a=>["Draft","Under Review","Signings"].includes(a.status)))return"In Progress";
  return"Expired";
}

function buildRRList() {
  const sheet=getSheet(SHEETS.recipients),data=sheet.getDataRange().getValues();
  if(data.length<=1)return{success:true,rows:[],tipes:[]};
  const rows=data.slice(1).filter(r=>r[0]).map((r,i)=>({
    rowIndex:i+2,id:String(r[0]||""),name:String(r[1]||""),tipe:String(r[2]||""),
    ip:String(r[3]||""),royaltyType:String(r[4]||""),pct:String(r[5]||""),
    fixed:String(r[6]||""),termin:String(r[7]||""),pks:String(r[8]||""),notes:String(r[9]||"")
  }));
  return{success:true,rows,tipes:[...new Set(rows.map(r=>r.tipe).filter(Boolean))]};
}

function buildBMList() {
  const sheet=getSheet(SHEETS.brand_master),data=sheet.getDataRange().getValues();
  if(data.length<=1)return{success:true,rows:[]};
  const rows=data.slice(1).filter(r=>r[0]).map((r,i)=>({
    rowIndex:i+2,id:String(r[0]||""),name:String(r[1]||""),category:String(r[2]||""),
    liveStatus:String(r[3]||"Active"),revenue:String(r[4]||""),agreements:String(r[5]||""),
    apparel:String(r[6]||""),accessories:String(r[7]||""),collectible:String(r[8]||""),
    preloved:String(r[9]||""),wellness:String(r[10]||""),others:String(r[11]||""),notes:String(r[12]||""),pic:String(r[15]||"")
  }));
  return{success:true,rows};
}

function buildSRList() {
  // Collect active brands from all 3 sources
  const seen = {}, brands = [];

  const addBrand = (id, name, revenue, source, pic) => {
    if (!seen[id]) {
      seen[id] = true;
      brands.push({id, name:name.trim(), revenue:revenue||"", source, pic:pic||""});
    }
  };

  // 1. Brand Master - live Active (empty cell treated as Active)
  const bmSheet=getSheet(SHEETS.brand_master),bmData=bmSheet.getDataRange().getValues();
  bmData.slice(1).filter(r=>r[0]&&String(r[3]||"Active").trim()==="Active").forEach(r=>addBrand(String(r[0]),String(r[1]||""),String(r[4]||""),"BM",String(r[15]||"")));

  // 2. IP Master - live Active (empty cell treated as Active)
  const ipSheet=getSheet(SHEETS.ip_master),ipData=ipSheet.getDataRange().getValues();
  ipData.slice(1).filter(r=>r[0]&&String(r[3]||"Active").trim()==="Active").forEach(r=>addBrand(String(r[0]),String(r[1]||""),String(r[4]||""),"IP",String(r[14]||"")));

  // 3. Royalty Recipients - all (no status field yet)
  const rrSheet=getSheet(SHEETS.recipients),rrData=rrSheet.getDataRange().getValues();
  rrData.slice(1).filter(r=>r[0]).forEach(r=>addBrand(String(r[0]),String(r[1]||""),String(r[4]||""),"CR",""));

  // 4. Distribution Partners - Consignment type, Live Active
  const dpSheet=getSheet(SHEETS.dist_partners),dpData=dpSheet.getDataRange().getValues();
  dpData.slice(1).filter(r=>r[0]&&String(r[9]||"Active").trim()==="Active"&&String(r[2]||"").toLowerCase().includes("consign")).forEach(r=>addBrand(String(r[0]),String(r[1]||""),""  ,"DP",String(r[5]||"")));

  // Load start dates
  const sdSheet=getSheet(SHEETS.sr_startdates),sdData=sdSheet.getDataRange().getValues();
  const startDates={};
  sdData.slice(1).forEach(r=>{ if(r[0]) startDates[String(r[0])]=String(r[2]||""); });

  // Load reports
  const repSheet=getSheet(SHEETS.sr_reports),repData=repSheet.getDataRange().getValues();
  const reports={};
  repData.slice(1).forEach(r=>{
    if(r[0]&&r[2]!==""){
      const key=String(r[0])+"_"+String(r[2]);
      reports[key]={link:String(r[3]||""),notes:String(r[4]||""),by:String(r[5]||""),date:String(r[6]||"")};
    }
  });

  // Attach start dates to brands
  brands.forEach(b=>{ b.startDate = startDates[b.id]||""; });

  return{success:true, brands, reports};
}

function buildDPList() {
  const sheet=getSheet(SHEETS.dist_partners),data=sheet.getDataRange().getValues();
  if(data.length<=1)return{success:true,rows:[]};
  const tz=Session.getScriptTimeZone();
  const fmtD=(val)=>{if(!val)return"";if(val instanceof Date&&!isNaN(val))return Utilities.formatDate(val,tz,"dd MMM yyyy HH:mm");return String(val).trim();};
  const rows=data.slice(1).filter(r=>r[0]).map((r,i)=>({
    rowIndex:i+2,id:String(r[0]||""),name:String(r[1]||""),type:String(r[2]||""),
    channel:String(r[3]||""),region:String(r[4]||""),pic:String(r[5]||""),
    contactPerson:String(r[6]||""),contactInfo:String(r[7]||""),agreements:String(r[8]||""),
    liveStatus:String(r[9]||"Active"),notes:String(r[10]||""),
    date:fmtD(r[11]),by:String(r[12]||""),lastUpdated:fmtD(r[13]),lastBy:String(r[14]||"")
  }));
  return{success:true,rows};
}

function buildLeadsList() {
  const sheet=getSheet(SHEETS.leads),data=sheet.getDataRange().getValues();
  if(data.length<=1)return{success:true,rows:[]};
  const tz=Session.getScriptTimeZone();
  const fmtDate=(val)=>{
    if(!val)return"";
    if(val instanceof Date&&!isNaN(val))return Utilities.formatDate(val,tz,"dd MMM yyyy HH:mm");
    return String(val).trim();
  };
  const rows=data.slice(1).filter(r=>r[0]).map((r,i)=>({
    rowIndex:i+2,id:String(r[0]||""),name:String(r[1]||""),category:String(r[2]||""),
    stage:String(r[3]||"New"),pic:String(r[4]||""),revenue:String(r[5]||""),
    contact:String(r[6]||""),notes:String(r[7]||""),date:fmtDate(r[8]),by:String(r[9]||""),
    lastUpdated:fmtDate(r[10]),lastBy:String(r[11]||"")
  }));
  return{success:true,rows};
}

// ── HELPERS ──
function getColMap(sheet){
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const map={};headers.forEach((h,i)=>{if(h)map[String(h).trim()]=i;});return map;
}

function getSheet(name){
  const ss=SpreadsheetApp.openById(SHEET_ID);
  let sheet=ss.getSheetByName(name);
  if(!sheet){
    sheet=ss.insertSheet(name);
    const key=Object.keys(SHEETS).find(k=>SHEETS[k]===name);
    const h=key?HEADERS[key]:null;
    if(h){sheet.appendRow(h);sheet.setFrozenRows(1);sheet.getRange(1,1,1,h.length).setFontWeight("bold");}
  }
  return sheet;
}

function clearCache(key){CacheService.getScriptCache().remove(key);}
function clearAllCache(){
  const c=CacheService.getScriptCache();
  [CACHE_KEY,CACHE_KEY_IP,CACHE_KEY_RR,CACHE_KEY_BM,CACHE_KEY_SR,CACHE_KEY_LD,CACHE_KEY_DP].forEach(k=>c.remove(k));
}

function migrateSheets(){
  const ss=SpreadsheetApp.openById(SHEET_ID);
  Object.keys(SHEETS).forEach(key=>{
    const sheet=ss.getSheetByName(SHEETS[key]);
    const expected=HEADERS[key];
    if(!sheet||!expected)return;
    const lastCol=sheet.getLastColumn();
    if(lastCol<1)return;
    for(let i=lastCol;i<expected.length;i++){
      sheet.getRange(1,i+1).setValue(expected[i]);
      sheet.getRange(1,i+1).setFontWeight("bold");
      Logger.log('Added "'+expected[i]+'" to '+SHEETS[key]+' at col '+(i+1));
    }
  });
  Logger.log("migrateSheets complete.");
}
function output(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}