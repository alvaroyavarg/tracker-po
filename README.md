# PO Tracker

Webapp para administrar Purchase Orders a partir de la sábana COUPA/SAP (Excel o
CSV), con vista agrupada por PO, desglose por líneas e IO (Internal Orders /
centros de costo por marca) y forecast de ejecución mensual.

Diseño limpio y moderno estilo Folk, hecho con Tailwind.

## Funcionalidades

- **Carga semanal acumulativa (reconciliación)**: el modo "Actualización semanal"
  compara la sábana nueva contra lo existente (llave PO + línea + IO, tolerante a
  llaves repetidas): registra los avances de facturación detectados, crea las
  líneas nuevas y **cierra como facturadas completas las que ya no vienen en el
  archivo**. Conserva tus notas, mes de ejecución y estados manuales, crea un
  respaldo automático antes de aplicar y muestra un resumen de los cambios.
- **Facturación manual con registro**: en cada línea puedes registrar que el
  proveedor facturó (monto + nota); actualiza facturado/saldo/estado y queda en
  la **bitácora de actividad** de la línea junto a los eventos de cada carga
  semanal (avances, cierres, creación).
- **Carga de sábana (.xlsx / .xls / .csv)**: detecta automáticamente la hoja con
  datos (ignora tablas dinámicas), limpia encabezados, auto-mapea las columnas y
  descarta sola las que no se usan (verificado contra las 55 columnas del
  reporte real). Reconoce formatos chilenos de número y varios de fecha.
- **Filtro de dueño** al importar: conserva solo las filas cuyo responsable
  (columna Requisitante) calce con tu nombre, con vista previa de cuántas filas
  pasan antes de importar.
- **PO agrupadas**: una fila por PO; al pincharla se despliegan sus líneas y, si
  la PO se paga con más de un IO, el desglose por IO (valor, facturado, abierto).
- **Dashboard**: comprometido / facturado / saldo abierto, % de ejecución,
  gráfico de ejecución por IO, líneas por estado, top proveedores y la matriz de
  **forecast mensual del saldo abierto por IO**.
- **Respaldos de ejecución**: snapshots del estado completo, restaurables.
- **Exportar** la vista filtrada a Excel o CSV.
- **Clave de acceso**: pantalla de login con contraseña única (`APP_PASSWORD`);
  toda la app y la API quedan protegidas por cookie de sesión.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + **lucide-react** + **Recharts**
- **PostgreSQL** (Neon, Supabase o cualquier Postgres) vía `pg`
- **SheetJS (xlsx)** para leer y exportar planillas

## Configuración

Variables de entorno (ver `.env.example`):

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | URL de conexión a tu Postgres. En Neon/Supabase usa la URL **pooled** (con `-pooler` en Neon o puerto `6543` en Supabase) para que funcione bien en Vercel. |
| `APP_PASSWORD` | Clave de acceso de la app. Si no se define, la app queda abierta (útil en desarrollo). |

Las tablas se crean solas en el primer arranque — no hay migraciones que correr.

## Correr localmente

```bash
npm install
cp .env.example .env   # y edita DATABASE_URL
npm run dev            # http://localhost:3000
```

## Desplegar en Vercel (con Neon o Supabase)

1. **Crea la base de datos** (elige una):
   - [Neon](https://neon.tech): crea un proyecto → copia la *pooled connection string*.
   - [Supabase](https://supabase.com): crea un proyecto → Settings → Database →
     *Connection string* en modo **Transaction pooler** (puerto 6543).
2. **Importa el repo en [Vercel](https://vercel.com/new)** (conectando tu GitHub).
   Framework: Next.js — no requiere configuración extra.
3. **Agrega las variables de entorno** en el proyecto de Vercel:
   `DATABASE_URL` (la URL del paso 1) y `APP_PASSWORD` (tu clave).
4. **Deploy.** Entra a la URL, pon tu clave y carga tu primera sábana.

Cada push a la rama conectada redespliega automáticamente. Los datos viven en
Postgres, así que los deploys no los tocan.

## Flujo de uso semanal

1. Llega la sábana → **Cargar sábana** → revisa el filtro de dueño y el mapeo
   (automático) → modo **Actualización semanal** → Actualizar.
2. Mira el resumen: líneas nuevas, avances de facturación, cerradas.
3. Ajusta lo manual: registra facturas, notas, mes de ejecución (forecast).
4. El **Dashboard** y el forecast quedan al día. Exporta si lo necesitas.

## Estructura

```
src/
  middleware.ts         Protección por clave (cookie de sesión)
  app/
    login/              Pantalla de clave de acceso
    page.tsx            Dashboard (KPIs, gráficos, forecast por IO)
    pos/                PO agrupadas con desglose por línea/IO
    import/             Carga de sábana + filtro de dueño + mapeo + modos
    snapshots/          Respaldos de ejecución
    api/                Endpoints (pos, import, dashboard, snapshots, export, login)
  components/           Sidebar, drawer de edición (facturación + actividad), UI
  lib/
    db.ts               Pool Postgres + esquema (auto-creado)
    repo.ts             Acceso a datos, reconciliación semanal, bitácora
    auth.ts             Token de sesión (HMAC)
    coerce.ts           Auto-mapeo de columnas, filtro de dueño y coerción
    format.ts           Formato de moneda/fecha (locale es-CL)
    types.ts            Campos, estados, tipos y agrupación por PO
```
