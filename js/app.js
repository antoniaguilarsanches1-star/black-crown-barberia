const { servicios, barberos } = window.BARBERIA_DATA;
const servicesGrid = document.getElementById('servicesGrid');
const barbersGrid = document.getElementById('barbersGrid');

servicesGrid.innerHTML = servicios.map((s, index) => `
  <article class="service-card">
    <div class="service-top">
      <span class="service-price">S/ ${s.precio}</span>
      <span class="service-chip">${s.duracion} min</span>
    </div>
    <span class="service-index">0${index + 1}</span>
    <h3>${s.nombre}</h3>
    <p>${s.descripcion}</p>
    <small>${s.detalle}</small>
  </article>`).join('');

barbersGrid.innerHTML = barberos.map(b => `
  <article class="barber-card">
    <div class="barber-photo-wrap">
      <img class="barber-photo" src="${b.foto}" alt="Barbero ${b.nombre}" loading="lazy" />
    </div>
    <div class="barber-info">
      <div class="barber-tag">Especialista</div>
      <h3>${b.nombre}</h3>
      <p>${b.especialidad}</p>
      <a href="reservar.html?barbero=${b.id}">Reservar con ${b.nombre}</a>
    </div>
  </article>`).join('');

const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
menuToggle?.addEventListener('click', () => mainNav.classList.toggle('open'));
