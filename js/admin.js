const cfg = window.SUPABASE_CONFIG;
const sb = supabase.createClient(cfg.url, cfg.key);
let negocioId = null;
let reservas = [];
let barberos = [];

const todayISO = () => new Date().toISOString().slice(0,10);
const fmtDate = (v) => v ? v.split('-').reverse().join('/') : '';
const fmtTime24 = (v) => v ? String(v).slice(0,5) : '';
const fmtTime = (v) => {
  if(!v) return '';
  const [hRaw,m='00'] = String(v).slice(0,5).split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
};
const fmtMoney = (v) => `S/ ${Number(v || 0).toFixed(0)}`;
const statusLabel = {confirmada:'Confirmada',completada:'Completada',cancelada:'Cancelada',no_asistio:'No asistió'};

function mobileCardHtml(r, editable=false){
  const state = editable
    ? `<select class="status-select mobile-status-select" data-id="${r.id}">${Object.entries(statusLabel).map(([k,v])=>`<option value="${k}" ${r.estado===k?'selected':''}>${v}</option>`).join('')}</select>`
    : `<span class="status status-${r.estado}">${statusLabel[r.estado]||r.estado}</span>`;

  return `<article class="reservation-mobile-card">
    <div class="reservation-mobile-head">
      <div>
        <strong>${r.cliente_nombre}</strong>
        <small>${r.cliente_telefono}</small>
      </div>
      ${state}
    </div>
    <div class="reservation-mobile-main">
      <span><b>Servicio</b>${r.servicios?.nombre||'-'}</span>
      <span><b>Barbero</b>${r.barberos?.nombre||'-'}</span>
      <span><b>Fecha</b>${fmtDate(r.fecha)}</span>
      <span><b>Hora</b>${fmtTime(r.hora)}</span>
      <span><b>Precio</b>${fmtMoney(r.precio)}</span>
    </div>
    ${r.nota ? `<p class="reservation-note"><b>Nota:</b> ${r.nota}</p>` : ''}
  </article>`;
}

async function requireOwner(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session){ location.replace('login.html'); return false; }
  const { data, error } = await sb.rpc('mi_negocio_id');
  if(error || !data){ await sb.auth.signOut(); alert('Esta cuenta no está autorizada para administrar la barbería.'); location.replace('login.html'); return false; }
  negocioId = data;
  return true;
}

async function loadData(){
  const [{data:r,error:re},{data:b,error:be},{data:blocks,error:ble}] = await Promise.all([
    sb.from('reservas').select('id,fecha,hora,cliente_nombre,cliente_telefono,nota,estado,precio,servicios(nombre),barberos(nombre)').eq('negocio_id',negocioId).order('fecha',{ascending:true}).order('hora',{ascending:true}),
    sb.from('barberos').select('id,nombre').eq('negocio_id',negocioId).eq('activo',true).order('nombre'),
    sb.from('bloqueos_barbero').select('id,fecha,hora_inicio,hora_fin,motivo,barbero_id,barberos(nombre)').gte('fecha',todayISO()).order('fecha',{ascending:true})
  ]);
  if(re||be||ble){ console.error(re||be||ble); alert('No se pudieron cargar los datos del panel.'); return; }
  reservas = r || []; barberos = b || [];
  renderStats(); renderSummary(); renderReservations(); renderBarbers(); renderBlocks(blocks||[]);
}

function renderStats(){
  const today = todayISO();
  const todays = reservas.filter(r=>r.fecha===today && r.estado!=='cancelada');
  const upcoming = reservas.filter(r=>r.fecha>=today && r.estado==='confirmada');
  document.getElementById('statToday').textContent = todays.length;
  document.getElementById('statUpcoming').textContent = upcoming.length;
  const completedToday = reservas.filter(r=>r.fecha===today && r.estado==='completada');
  document.getElementById('statRevenue').textContent = fmtMoney(completedToday.reduce((a,r)=>a+Number(r.precio),0));
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
}

function rowHtml(r, editable=false){
  const state = editable ? `<select class="status-select" data-id="${r.id}">${Object.entries(statusLabel).map(([k,v])=>`<option value="${k}" ${r.estado===k?'selected':''}>${v}</option>`).join('')}</select>` : `<span class="status status-${r.estado}">${statusLabel[r.estado]||r.estado}</span>`;
  return `<tr><td><strong>${r.cliente_nombre}</strong><small>${r.cliente_telefono}${r.nota?` · ${r.nota}`:''}</small></td><td>${r.servicios?.nombre||'-'}</td><td>${r.barberos?.nombre||'-'}</td><td>${fmtDate(r.fecha)}</td><td>${fmtTime(r.hora)}</td><td>${fmtMoney(r.precio)}</td><td>${state}</td></tr>`;
}
function renderSummary(){
  const t = todayISO(); const upcoming = reservas.filter(r=>r.fecha>=t && r.estado==='confirmada').slice(0,8);
  document.getElementById('summaryBody').innerHTML = upcoming.length?upcoming.map(r=>rowHtml(r)).join(''):'<tr><td colspan="7" class="empty">No hay próximas reservas.</td></tr>';
  document.getElementById('summaryCards').innerHTML = upcoming.length?upcoming.map(r=>mobileCardHtml(r,false)).join(''):'<p class="empty">No hay próximas reservas.</p>';
}
function renderReservations(){
  const filter = document.getElementById('statusFilter').value;
  const rows = filter?reservas.filter(r=>r.estado===filter):reservas;
  document.getElementById('reservationsBody').innerHTML = rows.length?rows.map(r=>rowHtml(r,true)).join(''):'<tr><td colspan="7" class="empty">No hay reservas con este filtro.</td></tr>';
  document.getElementById('reservationCards').innerHTML = rows.length?rows.map(r=>mobileCardHtml(r,true)).join(''):'<p class="empty">No hay reservas con este filtro.</p>';
  document.querySelectorAll('.status-select').forEach(s=>s.addEventListener('change',updateStatus));
}
async function updateStatus(e){
  const sel=e.currentTarget; sel.disabled=true;
  const {error}=await sb.from('reservas').update({estado:sel.value}).eq('id',sel.dataset.id).eq('negocio_id',negocioId);
  if(error){alert('No se pudo actualizar el estado.');}
  await loadData();
}
function renderBarbers(){
  document.getElementById('blockBarber').innerHTML='<option value="">Selecciona</option>'+barberos.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
}
function renderBlocks(items){
  const box=document.getElementById('blocksList');
  box.innerHTML = items.length ? items.map(x=>`<article class="block-item"><div><strong>${x.barberos?.nombre||'Barbero'} · ${fmtDate(x.fecha)}</strong><span>${x.hora_inicio?`${fmtTime(x.hora_inicio)} – ${fmtTime(x.hora_fin)}`:'Día completo'}${x.motivo?` · ${x.motivo}`:''}</span></div><button data-id="${x.id}" class="block-delete">Eliminar</button></article>`).join('') : '<p class="empty">No hay bloqueos próximos.</p>';
  box.querySelectorAll('.block-delete').forEach(btn=>btn.addEventListener('click',deleteBlock));
}
async function deleteBlock(e){
  if(!confirm('¿Eliminar este bloqueo?'))return;
  const {error}=await sb.from('bloqueos_barbero').delete().eq('id',e.currentTarget.dataset.id);
  if(error) alert('No se pudo eliminar.'); else await loadData();
}

const adminTimeValues = [];
for(let h=8; h<=19; h++){
  for(const m of [0,30]){
    adminTimeValues.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
}
function fillStartTimes(){
  const el=document.getElementById('blockStart');
  el.innerHTML='<option value="">Selecciona</option>'+adminTimeValues.slice(0,-1).map(v=>`<option value="${v}">${fmtTime(v)}</option>`).join('');
}
function fillEndTimes(){
  const start=document.getElementById('blockStart').value;
  const el=document.getElementById('blockEnd');
  if(!start){
    el.innerHTML='<option value="">Selecciona primero la hora inicial</option>';
    el.disabled=true;
    return;
  }
  const options=adminTimeValues.filter(v=>v>start);
  el.innerHTML='<option value="">Selecciona</option>'+options.map(v=>`<option value="${v}">${fmtTime(v)}</option>`).join('');
  el.disabled=false;
}
fillStartTimes();
fillEndTimes();
document.getElementById('blockStart').addEventListener('change',fillEndTimes);

document.getElementById('statusFilter').addEventListener('change',renderReservations);
document.getElementById('refreshBtn').addEventListener('click',loadData);
document.getElementById('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('login.html');});
document.getElementById('blockType').addEventListener('change',e=>document.getElementById('blockRange').classList.toggle('hidden',e.target.value!=='range'));
document.getElementById('blockDate').min=todayISO();
document.getElementById('blockForm').addEventListener('submit',async(e)=>{
  e.preventDefault(); const type=document.getElementById('blockType').value;
  const payload={barbero_id:document.getElementById('blockBarber').value,fecha:document.getElementById('blockDate').value,motivo:document.getElementById('blockReason').value.trim()||null,hora_inicio:type==='range'?document.getElementById('blockStart').value:null,hora_fin:type==='range'?document.getElementById('blockEnd').value:null};
  if(type==='range'&&(!payload.hora_inicio||!payload.hora_fin||payload.hora_fin<=payload.hora_inicio)){alert('Revisa el rango horario.');return;}
  const {error}=await sb.from('bloqueos_barbero').insert(payload);
  if(error){alert('No se pudo crear el bloqueo.');console.error(error);return;}
  e.target.reset();fillEndTimes();document.getElementById('blockRange').classList.add('hidden');await loadData();
});

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('.admin-view').forEach(x=>x.classList.remove('active'));
  document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
  document.getElementById('viewTitle').textContent = btn.textContent;
  closeAdminMobileMenu();
}));

const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');
adminMenuToggle?.addEventListener('click', () => {
  adminSidebar.classList.toggle('menu-open');
  adminMenuToggle.textContent = adminSidebar.classList.contains('menu-open') ? '✕' : '☰';
});

function closeAdminMobileMenu(){
  if(window.innerWidth <= 600){
    adminSidebar.classList.remove('menu-open');
    if(adminMenuToggle) adminMenuToggle.textContent = '☰';
  }
}

(async()=>{if(await requireOwner()) await loadData();})();
