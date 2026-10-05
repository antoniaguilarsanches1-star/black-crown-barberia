# Black Crown Barbería — Prototipo inicial

Primera versión funcional del sitio de barbería.

## Incluye
- Página pública responsive.
- Servicios y precios.
- Barberos.
- Formulario de reserva sin registro.
- Bloqueo de horario duplicado por barbero en la demo.
- Panel básico del dueño con reservas, total e ingresos estimados.
- Datos separados con `negocioId` para facilitar una futura versión multinegocio.

## Probar
1. Abrir `index.html`.
2. Entrar a `Reservar` y crear una cita.
3. Abrir `admin/index.html` para verla en el panel.

La demo guarda reservas con `localStorage`. El siguiente paso es reemplazarlo por Supabase: negocios, servicios, barberos, horarios, reservas, bloqueos y autenticación del dueño.
