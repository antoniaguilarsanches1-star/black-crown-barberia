
const cfg = window.SUPABASE_CONFIG;
const sb = supabase.createClient(cfg.url, cfg.key);

const form = document.getElementById('ownerLoginForm');
const msg = document.getElementById('loginMsg');
const submitBtn = document.getElementById('authSubmit');
const userInput = document.getElementById('ownerUser');
const passwordInput = document.getElementById('ownerPassword');

// El panel muestra un usuario simple ("admin"), pero la autenticación real
// sigue protegida por Supabase con la cuenta privada del dueño.
const ADMIN_USER = 'admin';
const OWNER_EMAIL = 'antoniaguilarsanches1@gmail.com';

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) location.href = 'index.html';
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';

  const usuario = userInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (usuario !== ADMIN_USER) {
    msg.textContent = 'Usuario o contraseña incorrectos.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Ingresando...';

  const { error } = await sb.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password
  });

  if (error) {
    msg.textContent = 'Usuario o contraseña incorrectos.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ingresar';
    return;
  }

  location.href = 'index.html';
});
