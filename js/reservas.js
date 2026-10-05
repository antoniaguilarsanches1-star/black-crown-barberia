const cfg = window.SUPABASE_CONFIG;
const sb = supabase.createClient(cfg.url, cfg.key);

const form = document.getElementById('bookingForm');
const service = document.getElementById('service');
const barber = document.getElementById('barber');
const date = document.getElementById('date');
const time = document.getElementById('time');
const nameInput = document.getElementById('name');
const phone = document.getElementById('phone');
const note = document.getElementById('note');
const summary = document.getElementById('bookingSummary');
const successBox = document.getElementById('successBox');
const availabilityNotice = document.getElementById('availabilityNotice');
const submitBtn = form.querySelector('button[type="submit"]');

let servicios = [];
let barberos = [];
let negocio = null;
let fullDayBlockedBarbers = new Set();
let preselectedBarber = new URLSearchParams(location.search).get('barbero');

function formatMoney(value) {
  return `S/ ${Number(value).toFixed(0)}`;
}

function formatTime24(value) {
  return value ? String(value).slice(0, 5) : '';
}

function formatTime(value) {
  if (!value) return '';
  const [hRaw, m = '00'] = String(value).slice(0, 5).split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

function formatDate(value) {
  if (!value) return '';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function setLoading(el, text = 'Cargando...') {
  el.innerHTML = `<option value="">${text}</option>`;
  el.disabled = true;
}

function showNotice(message, type = 'info') {
  availabilityNotice.className = `availability-notice ${type}`;
  availabilityNotice.textContent = message;
}

function hideNotice() {
  availabilityNotice.className = 'availability-notice hidden';
  availabilityNotice.textContent = '';
}

async function cargarDatos() {
  setLoading(service);
  setLoading(barber, 'Primero elige una fecha');

  const { data: negocios, error: negocioError } = await sb
    .from('negocios')
    .select('id,nombre,moneda')
    .eq('slug', cfg.negocioSlug)
    .eq('activo', true)
    .limit(1);

  if (negocioError || !negocios?.length) {
    throw new Error('No se pudo cargar la barbería.');
  }

  negocio = negocios[0];

  const [{ data: serviciosData, error: serviciosError }, { data: barberosData, error: barberosError }] = await Promise.all([
    sb.from('servicios')
      .select('id,nombre,descripcion,precio,duracion_min,orden')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('orden', { ascending: true }),
    sb.from('barberos')
      .select('id,nombre,especialidad,foto_url')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre', { ascending: true })
  ]);

  if (serviciosError || barberosError) {
    throw new Error('No se pudieron cargar los servicios y barberos.');
  }

  servicios = serviciosData || [];
  barberos = barberosData || [];

  service.innerHTML = '<option value="">Selecciona</option>' +
    servicios.map(s => `<option value="${s.id}">${s.nombre} — ${formatMoney(s.precio)}</option>`).join('');
  service.disabled = false;

  renderBarbers();
  updateSummary();
}

function renderBarbers() {
  if (!date.value) {
    barber.innerHTML = '<option value="">Primero elige una fecha</option>';
    barber.disabled = true;
    return;
  }

  barber.innerHTML = '<option value="">Selecciona</option>' +
    barberos.map(b => {
      const blocked = fullDayBlockedBarbers.has(b.id);
      return `<option value="${b.id}"${blocked ? ' disabled' : ''}>${b.nombre}${blocked ? ' — No disponible' : ''}</option>`;
    }).join('');

  barber.disabled = false;

  if (preselectedBarber) {
    const found = barberos.find(b => b.nombre.toLowerCase() === preselectedBarber.toLowerCase() || b.id === preselectedBarber);
    if (found && !fullDayBlockedBarbers.has(found.id)) {
      barber.value = found.id;
    }
    preselectedBarber = null;
  }
}

async function cargarDisponibilidadBarberos() {
  time.innerHTML = '<option value="">Selecciona un barbero</option>';
  time.disabled = true;
  barber.value = '';
  fullDayBlockedBarbers = new Set();
  hideNotice();

  if (!date.value) {
    renderBarbers();
    updateSummary();
    return;
  }

  barber.innerHTML = '<option value="">Consultando disponibilidad...</option>';
  barber.disabled = true;

  const { data: bloqueos, error } = await sb
    .from('bloqueos_barbero')
    .select('barbero_id,hora_inicio,hora_fin')
    .eq('fecha', date.value);

  if (error) {
    console.error(error);
    barber.innerHTML = '<option value="">No se pudo cargar</option>';
    return;
  }

  (bloqueos || []).forEach(b => {
    if (b.hora_inicio === null && b.hora_fin === null) {
      fullDayBlockedBarbers.add(b.barbero_id);
    }
  });

  renderBarbers();

  if (fullDayBlockedBarbers.size === barberos.length && barberos.length) {
    showNotice(`No hay barberos disponibles el ${formatDate(date.value)}. Elige otra fecha.`, 'warning');
  } else if (fullDayBlockedBarbers.size > 0) {
    const nombres = barberos.filter(b => fullDayBlockedBarbers.has(b.id)).map(b => b.nombre);
    showNotice(`${nombres.join(', ')} ${nombres.length > 1 ? 'no están disponibles' : 'no está disponible'} el ${formatDate(date.value)}.`, 'info');
  }

  updateSummary();
}

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
date.min = `${yyyy}-${mm}-${dd}`;

function getSelectedService() {
  return servicios.find(s => s.id === service.value);
}
function getSelectedBarber() {
  return barberos.find(b => b.id === barber.value);
}

function updateSummary() {
  const s = getSelectedService();
  const b = getSelectedBarber();

  if (!s && !b && !date.value && !time.value) {
    summary.innerHTML = '<span class="muted">Completa los datos para ver el resumen de tu cita.</span>';
    return;
  }

  summary.innerHTML = `
    <strong>Resumen de tu cita</strong>
    <span>${s ? `${s.nombre} · ${formatMoney(s.precio)} · ${s.duracion_min} min` : 'Servicio pendiente'}</span>
    <span>${date.value ? formatDate(date.value) : 'Fecha pendiente'}</span>
    <span>${b ? `Con ${b.nombre}` : 'Barbero pendiente'}${time.value ? ` · ${formatTime(time.value)}` : ''}</span>
  `;
}

async function cargarHorarios() {
  time.innerHTML = '<option value="">Selecciona servicio, fecha y barbero</option>';
  time.disabled = true;

  if (!service.value || !date.value || !barber.value) {
    updateSummary();
    return;
  }

  if (fullDayBlockedBarbers.has(barber.value)) {
    const b = getSelectedBarber();
    showNotice(`${b?.nombre || 'Ese barbero'} no está disponible el ${formatDate(date.value)}. Elige otro barbero.`, 'warning');
    time.innerHTML = '<option value="">Barbero no disponible ese día</option>';
    updateSummary();
    return;
  }

  time.innerHTML = '<option value="">Consultando disponibilidad...</option>';

  const { data, error } = await sb.rpc('horarios_estado', {
    p_negocio_slug: cfg.negocioSlug,
    p_barbero_id: barber.value,
    p_servicio_id: service.value,
    p_fecha: date.value
  });

  if (error) {
    console.error(error);
    time.innerHTML = '<option value="">No se pudo cargar</option>';
    return;
  }

  const slots = data || [];
  if (!slots.length) {
    const b = getSelectedBarber();
    time.innerHTML = '<option value="">Sin horarios para este día</option>';
    showNotice(`${b?.nombre || 'Este barbero'} no tiene horarios disponibles el ${formatDate(date.value)}.`, 'warning');
    updateSummary();
    return;
  }

  const labelEstado = {
    ocupado: ' — Ocupado',
    bloqueado: ' — No disponible'
  };

  // En reservas no mostramos horas que ya pasaron.
  // Las horas futuras ocupadas o bloqueadas sí permanecen visibles, pero deshabilitadas.
  const slotsVisibles = slots.filter(x => x.estado !== 'pasado');
  const disponibles = slotsVisibles.filter(x => x.estado === 'disponible').length;

  time.innerHTML = '<option value="">Selecciona</option>' +
    slotsVisibles.map(x => {
      const disponible = x.estado === 'disponible';
      const value = disponible ? formatTime24(x.hora) : '';
      const disabled = disponible ? '' : ' disabled';
      const suffix = disponible ? '' : (labelEstado[x.estado] || ' — No disponible');
      return `<option value="${value}"${disabled}>${formatTime(x.hora)}${suffix}</option>`;
    }).join('');

  time.disabled = disponibles === 0;

  if (disponibles === 0) {
    const b = getSelectedBarber();
    showNotice(`${b?.nombre || 'Este barbero'} ya no tiene horarios disponibles el ${formatDate(date.value)}. Elige otro barbero o fecha.`, 'warning');
  } else if (fullDayBlockedBarbers.size === 0) {
    hideNotice();
  }

  updateSummary();
}

service.addEventListener('change', cargarHorarios);
date.addEventListener('change', cargarDisponibilidadBarberos);
barber.addEventListener('change', () => {
  hideNotice();
  cargarHorarios();
});
time.addEventListener('change', updateSummary);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const s = getSelectedService();
  const b = getSelectedBarber();
  const cleanPhone = phone.value.replace(/\D/g, '');

  if (!s || !b || !date.value || !time.value || !nameInput.value.trim() || cleanPhone.length < 9) {
    alert('Completa correctamente todos los datos obligatorios.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Confirmando...';

  const { data: reservaId, error } = await sb.rpc('crear_reserva_publica', {
    p_negocio_slug: cfg.negocioSlug,
    p_servicio_id: s.id,
    p_barbero_id: b.id,
    p_fecha: date.value,
    p_hora: time.value,
    p_cliente_nombre: nameInput.value.trim(),
    p_cliente_telefono: cleanPhone,
    p_nota: note.value.trim() || null
  });

  if (error) {
    console.error(error);
    alert(error.message?.includes('disponible')
      ? 'Ese horario ya no está disponible. Elige otro.'
      : 'No se pudo registrar la reserva. Intenta nuevamente.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmar reserva';
    await cargarHorarios();
    return;
  }

  form.classList.add('hidden');
  successBox.classList.remove('hidden');
  successBox.innerHTML = `
    <div class="success-icon">✓</div>
    <h2>¡Reserva confirmada!</h2>
    <p><strong>${nameInput.value.trim()}</strong>, tu cita quedó registrada para el
    <strong>${formatDate(date.value)}</strong> a las <strong>${formatTime(time.value)}</strong> con <strong>${b.nombre}</strong>.</p>
    <p>${s.nombre} · ${formatMoney(s.precio)} · ${s.duracion_min} min</p>
    <p class="muted">Código de reserva: ${String(reservaId).slice(0, 8).toUpperCase()}</p>
    <div class="success-actions">
      <a class="btn" href="index.html">Volver al inicio</a>
      <a class="btn btn-ghost-dark" target="_blank" rel="noopener"
         href="https://wa.me/51999999999?text=${encodeURIComponent(`Hola, acabo de reservar ${s.nombre} para el ${formatDate(date.value)} a las ${formatTime(time.value)} con ${b.nombre}.`)}">
         Abrir WhatsApp
      </a>
    </div>
  `;
});

(async () => {
  try {
    await cargarDatos();
  } catch (err) {
    console.error(err);
    summary.innerHTML = '<strong>No se pudo conectar con el sistema de reservas.</strong><span>Recarga la página e intenta nuevamente.</span>';
  }
})();
