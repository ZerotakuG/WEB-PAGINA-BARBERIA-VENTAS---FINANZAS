# Plantilla Barbería Premium

Web para barberías con escena 3D, reservas en línea y panel de administración con finanzas.
Es HTML, CSS y JS puro: no necesita compilar nada. La base de datos es **Supabase**.

## Estructura

```
index.html          Web pública (hero 3D, servicios, equipo, galería, reservas)
admin.html          Panel del dueño (login)
config.js           ← LO ÚNICO que se cambia por cliente (marca, contacto, horario, claves)
css/site.css        Estilos de la web (colores en :root)
css/admin.css       Estilos del panel
js/data.js          Capa de datos (Supabase o modo demo)
js/scene3d.js       Escena 3D con Three.js (poste de barbero, anillos, tijeras)
js/site.js          Lógica de la web y de las reservas
js/admin.js         Panel: dashboard, reservas, finanzas, proyecciones, barberos, servicios
supabase/schema.sql Tablas, seguridad (RLS) y funciones
```

## Modo demo (para mostrarla a los clientes)

Si `supabaseUrl` está vacío en `config.js`, todo funciona con datos de ejemplo guardados en el navegador
(9 meses de reservas, gastos e inversiones). En el panel se entra con cualquier correo y contraseña.
En **Ajustes → Restablecer datos de ejemplo** se vuelve al estado inicial.

Para probarla en local:

```bash
python -m http.server 5173
```

y abre http://localhost:5173 (y http://localhost:5173/admin.html).

## Instalación para una barbería nueva (unos 15 minutos)

1. **Crea un proyecto en Supabase** (https://supabase.com, el plan gratuito sirve). Usa un proyecto por barbería.
2. **SQL Editor → New query**: pega todo `supabase/schema.sql` y dale a *Run*.
3. **Authentication → Users → Add user**: crea el correo y la contraseña del dueño.
4. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*.
5. Da permisos de administrador al dueño (en SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'dueno@barberia.com';
   ```
6. **Project Settings → API**: copia la *Project URL* y la clave *anon / publishable* en `config.js`.
7. Edita el resto de `config.js`: nombre, contacto, WhatsApp, horario, fotos de la galería y testimonios.
8. Entra a `admin.html` y crea los **barberos** (con su % de comisión) y los **servicios** (precio y duración).
9. Publica la carpeta en cualquier hosting estático: Netlify, Vercel o Cloudflare Pages (arrastrar y soltar la carpeta).

> La clave *anon* es pública por diseño. La seguridad la dan las políticas RLS del esquema:
> los visitantes solo pueden **crear** reservas "pendientes" (el precio lo pone la base de datos)
> y consultar horas ocupadas sin ver datos de otros clientes. Todo lo demás lo ve y edita solo un admin.
> **Nunca** pongas la clave `service_role` en `config.js`.

## Cómo se calculan las finanzas

| Concepto | Origen |
|---|---|
| Ingresos por servicios | Reservas en estado **completada** (precio registrado) |
| Ingresos extra | Movimientos tipo *ingreso* (productos, propinas…) |
| Comisiones | Precio × % de comisión de cada barbero |
| Gastos fijos | Movimientos tipo *gasto* (arriendo, nómina, servicios…) |
| Costos variables | Movimientos tipo *costo* (insumos, lavandería…) |
| **Utilidad neta** | Ingresos − comisiones − gastos − costos |
| Inversiones | Movimientos tipo *inversion*; se usan para calcular el ROI y el tiempo de recuperación |
| Proyecciones | Tendencia lineal de los últimos 6 meses completos + el escenario que elijas (crecimiento, gastos, nueva inversión) |
| Punto de equilibrio | Gastos fijos ÷ (ticket promedio × (1 − % costo variable)) |

**Flujo diario del dueño:** las reservas llegan como *pendiente* → las confirma → al terminar el servicio
las marca como *completada* (y así cuentan como ingreso). Desde **Finanzas** registra gastos, costos e
inversiones, y consulta la liquidación de comisiones de cada barbero por mes.

## Personalizar el diseño

- Colores: variables en `:root` de `css/site.css` (`--gold`, `--bg`…) y en `css/admin.css`.
- Colores del poste 3D: arreglo `stripes` en `js/scene3d.js`.
- Tipografías: Playfair Display + Manrope (Google Fonts, en el `<head>`).
