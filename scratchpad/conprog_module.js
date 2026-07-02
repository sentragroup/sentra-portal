// ── CONSIGNMENT PROGRAM ──
// SDY sebagai consignor: manage PKS, DPP+BAST ST, Laporan Bulanan, Retur (BAST RTN).
// Ref: SDY_Consignment_as Consignor_Guideline_Deck_v2.pdf
let _cpRows = [], _cpShipments = [], _cpReports = [], _cpReturns = [];
let _cpCurrentId = null, _cpCurrentTab = 'general';
let _cpEditMode = false;   // true = edit existing, false = new

async function loadConProg() {
  const tbody = document.getElementById('cp-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td class="empty-td" colspan="9">Memuat...</td></tr>`;
  try {
    const [pRes, sRes, rRes, rtRes] = await Promise.all([
      sb.from('consignment_programs').select('*').order('created_at',{ascending:false}),
      sb.from('consignment_shipments').select('id,program_id,status,dpp_date'),
      sb.from('consignment_monthly_reports').select('id,program_id,period_year,period_month,verification_status,payment_transferred_at'),
      sb.from('consignment_returns').select('id,program_id,status'),
    ]);
    if (pRes.error) throw pRes.error;
    _cpRows = pRes.data || [];
    _cpShipments = sRes.data || [];
    _cpReports = rRes.data || [];
    _cpReturns = rtRes.data || [];
    _cpUpdateStats();
    _cpApplyFilters();
  } catch(e) {
    tbody.innerHTML = `<tr><td class="empty-td" colspan="9">Gagal memuat: ${e.message||e}</td></tr>`;
  }
}

function _cpUpdateStats() {
  document.getElementById('cp-s-total').textContent = _cpRows.length;
  document.getElementById('cp-s-active').textContent = _cpRows.filter(r => r.status === 'Active').length;
  document.getElementById('cp-s-shipments').textContent = _cpShipments.length;
  document.getElementById('cp-s-pending-report').textContent = _cpReports.filter(r => r.verification_status === 'Pending').length;
  document.getElementById('cp-s-pending-payment').textContent = _cpReports.filter(r => r.verification_status === 'Verified' && !r.payment_transferred_at).length;
}

function _cpApplyFilters() {
  const stat = document.getElementById('cp-f-status').value;
  const q = (document.getElementById('cp-f-search').value||'').trim().toLowerCase();
  let rows = _cpRows.slice();
  if (stat) rows = rows.filter(r => r.status === stat);
  if (q) rows = rows.filter(r => (r.mitra_name||'').toLowerCase().includes(q));
  _cpRenderTable(rows);
}

function _cpRenderTable(rows) {
  const tbody = document.getElementById('cp-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td class="empty-td" colspan="9">Tidak ada program.</td></tr>`; return; }
  const shipByProg = new Map();
  for (const s of _cpShipments) {
    if (!shipByProg.has(s.program_id)) shipByProg.set(s.program_id, 0);
    shipByProg.set(s.program_id, shipByProg.get(s.program_id) + 1);
  }
  const repByProg = new Map();
  for (const r of _cpReports) {
    if (!repByProg.has(r.program_id)) repByProg.set(r.program_id, 0);
    repByProg.set(r.program_id, repByProg.get(r.program_id) + 1);
  }
  const statusPillCls = (s) => s==='Active'?'p-active':s==='Ended'?'p-expired':'p-draft';
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—';
  tbody.innerHTML = rows.map(r => {
    const channels = Array.isArray(r.channels) ? r.channels.map(c => `<span class="pill p-signings" style="font-size:9px;padding:1px 5px;margin-right:2px">${c.replace(/</g,'&lt;')}</span>`).join('') : '—';
    const bh = `${r.bagi_hasil_sdy_pct||80}/${r.bagi_hasil_mitra_pct||20}`;
    const periode = r.start_date || r.end_date ? `${fmtD(r.start_date)} — ${fmtD(r.end_date)}` : '—';
    return `<tr>
      <td class="mono" style="font-size:11px">${r.id}</td>
      <td><a href="#" onclick="event.preventDefault();_cpOpenDetail('${r.id.replace(/'/g,"\\'")}')" style="color:#3C3489;text-decoration:none;font-weight:600">${(r.mitra_name||'—').replace(/</g,'&lt;')}</a>${r.contact_person?`<div style="font-size:10px;color:var(--g400);margin-top:2px">${r.contact_person.replace(/</g,'&lt;')}</div>`:''}</td>
      <td style="max-width:180px">${channels}</td>
      <td style="font-size:12px">${bh}%</td>
      <td style="font-size:11px">${periode}</td>
      <td class="num">${shipByProg.get(r.id)||0}</td>
      <td class="num">${repByProg.get(r.id)||0}</td>
      <td><span class="pill ${statusPillCls(r.status)}" style="font-size:10px">${r.status||'Draft'}</span></td>
      <td><button class="btn-icon" onclick="_cpOpenDetail('${r.id.replace(/'/g,"\\'")}')">Detail</button> <button class="btn-icon" style="color:#c0392b" onclick="_cpDeleteProgram('${r.id.replace(/'/g,"\\'")}')">Del</button></td>
    </tr>`;
  }).join('');
  document.getElementById('cp-tbody').closest('.table-wrap').previousElementSibling?.remove?.();
}

// ── Drawer form (New / Edit) ──
function _cpOpenNewProgram() {
  _cpEditMode = false;
  _cpClearForm();
  document.getElementById('cp-drawer-title').textContent = 'Program Baru';
  _cpShowDrawer();
}

function _cpOpenEditProgram() {
  const p = _cpRows.find(r => r.id === _cpCurrentId);
  if (!p) return;
  _cpEditMode = true;
  document.getElementById('cp-drawer-title').textContent = `Edit: ${p.mitra_name}`;
  document.getElementById('cp-mitra-name').value = p.mitra_name || '';
  document.getElementById('cp-contact-person').value = p.contact_person || '';
  document.getElementById('cp-contact-info').value = p.contact_info || '';
  document.getElementById('cp-address').value = p.address || '';
  document.getElementById('cp-channels').value = Array.isArray(p.channels) ? p.channels.join(', ') : '';
  document.getElementById('cp-pks-date').value = p.pks_signed_date || '';
  document.getElementById('cp-pks-url').value = p.pks_url || '';
  document.getElementById('cp-lampiran1-url').value = p.lampiran1_url || '';
  document.getElementById('cp-bh-sdy').value = p.bagi_hasil_sdy_pct != null ? p.bagi_hasil_sdy_pct : 80;
  document.getElementById('cp-bh-mitra').value = p.bagi_hasil_mitra_pct != null ? p.bagi_hasil_mitra_pct : 20;
  document.getElementById('cp-start-date').value = p.start_date || '';
  document.getElementById('cp-end-date').value = p.end_date || '';
  document.getElementById('cp-status').value = p.status || 'Draft';
  document.getElementById('cp-notes').value = p.notes || '';
  _cpShowDrawer();
}

function _cpClearForm() {
  ['cp-mitra-name','cp-contact-person','cp-contact-info','cp-address','cp-channels','cp-pks-date','cp-pks-url','cp-lampiran1-url','cp-start-date','cp-end-date','cp-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('cp-bh-sdy').value = 80;
  document.getElementById('cp-bh-mitra').value = 20;
  document.getElementById('cp-status').value = 'Draft';
  document.getElementById('cp-feedback').textContent = '';
}

function _cpShowDrawer() {
  document.getElementById('cp-drawer-overlay').style.display = 'block';
  document.getElementById('cp-drawer').style.display = 'block';
}

function _cpCloseDrawer() {
  document.getElementById('cp-drawer-overlay').style.display = 'none';
  document.getElementById('cp-drawer').style.display = 'none';
}

async function _cpSubmitProgram() {
  const fb = document.getElementById('cp-feedback');
  fb.textContent = '';
  const name = document.getElementById('cp-mitra-name').value.trim();
  if (!name) { fb.textContent = '⚠️ Nama Mitra wajib diisi.'; return; }
  const chStr = document.getElementById('cp-channels').value.trim();
  const channels = chStr ? chStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  const payload = {
    mitra_name: name,
    contact_person: document.getElementById('cp-contact-person').value.trim() || null,
    contact_info: document.getElementById('cp-contact-info').value.trim() || null,
    address: document.getElementById('cp-address').value.trim() || null,
    channels: channels.length ? channels : null,
    pks_signed_date: document.getElementById('cp-pks-date').value || null,
    pks_url: document.getElementById('cp-pks-url').value.trim() || null,
    lampiran1_url: document.getElementById('cp-lampiran1-url').value.trim() || null,
    bagi_hasil_sdy_pct: parseInt(document.getElementById('cp-bh-sdy').value) || 80,
    bagi_hasil_mitra_pct: parseInt(document.getElementById('cp-bh-mitra').value) || 20,
    start_date: document.getElementById('cp-start-date').value || null,
    end_date: document.getElementById('cp-end-date').value || null,
    status: document.getElementById('cp-status').value,
    notes: document.getElementById('cp-notes').value.trim() || null,
    last_updated: new Date().toISOString(),
    last_updated_by: currentUser,
  };
  try {
    if (_cpEditMode && _cpCurrentId) {
      const {error} = await sb.from('consignment_programs').update(payload).eq('id', _cpCurrentId);
      if (error) throw error;
    } else {
      payload.id = genId('CP');
      payload.created_by = currentUser;
      const {error} = await sb.from('consignment_programs').insert(payload);
      if (error) throw error;
      _cpCurrentId = payload.id;
    }
    _cpCloseDrawer();
    await loadConProg();
    if (_cpEditMode) _cpOpenDetail(_cpCurrentId);
  } catch(e) {
    fb.textContent = '❌ Gagal: '+(e.message||e);
  }
}

async function _cpDeleteProgram(id) {
  const p = _cpRows.find(r => r.id === id);
  if (!p) return;
  if (!confirm(`Hapus program ${p.mitra_name}? Semua shipments, laporan, dan retur terkait akan ikut terhapus.`)) return;
  try {
    const {error} = await sb.from('consignment_programs').delete().eq('id', id);
    if (error) throw error;
    await loadConProg();
  } catch(e) { alert('Gagal hapus: '+(e.message||e)); }
}

// ── Detail view ──
function _cpOpenDetail(id) {
  const p = _cpRows.find(r => r.id === id);
  if (!p) return;
  _cpCurrentId = id;
  _cpCurrentTab = 'general';
  document.getElementById('cp-list-view').style.display = 'none';
  document.getElementById('cp-detail-view').style.display = '';
  document.getElementById('cp-detail-title').textContent = p.mitra_name;
  const bh = `${p.bagi_hasil_sdy_pct||80}/${p.bagi_hasil_mitra_pct||20}`;
  document.getElementById('cp-detail-sub').textContent = `${p.id} · Bagi Hasil ${bh}% · ${(p.channels||[]).join(', ') || 'no channel'}`;
  const cls = p.status==='Active'?'p-active':p.status==='Ended'?'p-expired':'p-draft';
  document.getElementById('cp-detail-status-pill').innerHTML = `<span class="pill ${cls}" style="font-size:11px">${p.status||'Draft'}</span>`;
  // Reset tab pills
  document.querySelectorAll('#page-conprog .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#page-conprog .tab-btn').classList.add('active');
  document.querySelectorAll('#page-conprog .cp-tab').forEach(el => el.style.display = 'none');
  document.getElementById('cp-tab-general').style.display = '';
  _cpRenderGeneralTab(p);
}

function _cpBackToList() {
  _cpCurrentId = null;
  document.getElementById('cp-detail-view').style.display = 'none';
  document.getElementById('cp-list-view').style.display = '';
}

function _cpSwitchTab(tab, btn) {
  _cpCurrentTab = tab;
  document.querySelectorAll('#page-conprog .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#page-conprog .cp-tab').forEach(el => el.style.display = 'none');
  document.getElementById(`cp-tab-${tab}`).style.display = '';
  const p = _cpRows.find(r => r.id === _cpCurrentId);
  if (!p) return;
  if (tab === 'general') _cpRenderGeneralTab(p);
  else if (tab === 'shipments') _cpRenderShipmentsTab(p);
  else if (tab === 'reports') _cpRenderReportsTab(p);
  else if (tab === 'returns') _cpRenderReturnsTab(p);
}

function _cpRenderGeneralTab(p) {
  const cont = document.getElementById('cp-tab-general');
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '—';
  const link = (url) => url ? `<a href="${url}" target="_blank" style="color:#3C3489">📎 Buka</a>` : '—';
  cont.innerHTML = `
    <div style="background:white;padding:16px 20px;border:1px solid var(--g100);border-radius:8px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 24px;font-size:12px">
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Mitra</div><div style="margin-top:4px;font-weight:600">${(p.mitra_name||'—').replace(/</g,'&lt;')}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Contact Person</div><div style="margin-top:4px">${(p.contact_person||'—').replace(/</g,'&lt;')}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Contact Info</div><div style="margin-top:4px">${(p.contact_info||'—').replace(/</g,'&lt;')}</div></div>
        <div style="grid-column:span 3"><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Alamat</div><div style="margin-top:4px">${(p.address||'—').replace(/</g,'&lt;')}</div></div>
        <div style="grid-column:span 3"><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Channel</div><div style="margin-top:4px">${(p.channels||[]).map(c => `<span class="pill p-signings" style="font-size:10px;margin-right:4px">${c.replace(/</g,'&lt;')}</span>`).join('') || '—'}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">PKS Signed</div><div style="margin-top:4px">${fmtD(p.pks_signed_date)}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">PKS Document</div><div style="margin-top:4px">${link(p.pks_url)}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Lampiran I</div><div style="margin-top:4px">${link(p.lampiran1_url)}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Bagi Hasil</div><div style="margin-top:4px;font-weight:600">SDY <span style="color:#c33">${p.bagi_hasil_sdy_pct||80}%</span> · Mitra ${p.bagi_hasil_mitra_pct||20}%</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Start Date</div><div style="margin-top:4px">${fmtD(p.start_date)}</div></div>
        <div><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">End Date</div><div style="margin-top:4px">${fmtD(p.end_date)}</div></div>
        <div style="grid-column:span 3"><div style="font-size:10px;color:var(--g400);text-transform:uppercase;letter-spacing:0.5px">Notes</div><div style="margin-top:4px;white-space:pre-wrap">${(p.notes||'—').replace(/</g,'&lt;')}</div></div>
      </div>
    </div>
    <div style="margin-top:16px;padding:12px 16px;background:#fff8e1;border:1px solid #f0d68e;border-radius:8px;font-size:11px;color:#8a6d3b">
      ℹ️ Tab <strong>Shipments / Laporan Bulanan / Retur</strong> masih placeholder. Bakal dibangun di iterasi berikutnya (form DPP + BAST ST upload, entry laporan bulanan dengan auto-bagi hasil 80/20, form retur).
    </div>`;
}

function _cpRenderShipmentsTab(p) {
  const cont = document.getElementById('cp-tab-shipments');
  const rows = _cpShipments.filter(s => s.program_id === p.id);
  cont.innerHTML = `
    <div style="background:white;padding:16px 20px;border:1px solid var(--g100);border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600">Shipments (DPP + BAST ST)</div>
        <button style="padding:6px 12px;background:var(--g200);color:var(--g600);border:none;border-radius:4px;font-size:11px;cursor:not-allowed" disabled>+ Shipment (segera)</button>
      </div>
      <div style="font-size:11px;color:var(--g600);padding:20px;text-align:center">${rows.length ? `${rows.length} shipment tercatat. UI detail masih placeholder.` : 'Belum ada shipment. Form DPP + upload BAST ST bakal ada di iterasi berikutnya.'}</div>
    </div>`;
}

function _cpRenderReportsTab(p) {
  const cont = document.getElementById('cp-tab-reports');
  const rows = _cpReports.filter(r => r.program_id === p.id);
  cont.innerHTML = `
    <div style="background:white;padding:16px 20px;border:1px solid var(--g100);border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600">Laporan Penjualan Bulanan</div>
        <button style="padding:6px 12px;background:var(--g200);color:var(--g600);border:none;border-radius:4px;font-size:11px;cursor:not-allowed" disabled>+ Laporan (segera)</button>
      </div>
      <div style="font-size:11px;color:var(--g600);padding:20px;text-align:center">${rows.length ? `${rows.length} laporan tercatat. UI detail masih placeholder.` : 'Belum ada laporan bulanan. Deadline: tgl 3 tiap bulan untuk transaksi bulan sebelumnya. Auto-compute Bagi Hasil ${p.bagi_hasil_sdy_pct||80}/${p.bagi_hasil_mitra_pct||20}.'}</div>
    </div>`;
}

function _cpRenderReturnsTab(p) {
  const cont = document.getElementById('cp-tab-returns');
  const rows = _cpReturns.filter(r => r.program_id === p.id);
  cont.innerHTML = `
    <div style="background:white;padding:16px 20px;border:1px solid var(--g100);border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600">Retur (BAST RTN)</div>
        <button style="padding:6px 12px;background:var(--g200);color:var(--g600);border:none;border-radius:4px;font-size:11px;cursor:not-allowed" disabled>+ Retur (segera)</button>
      </div>
      <div style="font-size:11px;color:var(--g600);padding:20px;text-align:center">${rows.length ? `${rows.length} retur tercatat. UI detail masih placeholder.` : 'Belum ada retur. SDY dapat minta retur (penjualan <30% dalam 3 bulan), Mitra dapat minta retur setelah 2 bulan.'}</div>
    </div>`;
}
