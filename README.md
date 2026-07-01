# PO Tracker

Webapp para administrar tus **Purchase Orders (PO)**: cargas tu "sábana" en Excel o
CSV, la mapeas a los campos del tracker y desde ahí filtras, editas estados,
guardas respaldos y ves el **forecast de ejecución mensual por IO** (Internal
Order / centro de costo por marca).

Diseño limpio y moderno estilo Folk, hecho con Tailwind.

## Funcionalidades

- **Carga de sábana (.xlsx / .xls / .csv)** con detección automática de columnas y
  mapeo manual. Reconoce formatos chilenos de número (`1.500.000`) y varios
  formatos de fecha (`15/07/2026`, `Ago 2026`, `2026-07`).
- **Administración de PO**: tabla con búsqueda y filtros por estado e IO, edición
  en panel lateral, cambio de estado con historial.
- **Dashboard**: totales, monto por IO, PO por estado, top proveedores y la matriz
  de **forecast de ejecución mensual por IO**.
- **Respaldos de ejecución**: guarda un snapshot del estado completo de tus PO y
  restáuralo cuando quieras (útil para cierres mensuales).
- **Exportar** la vista filtrada a Excel o CSV.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + **lucide-react** (íconos) + **Recharts** (gráficos)
- **SQLite** vía el módulo integrado de Node (`node:sqlite`) — sin binarios ni
  servicios externos que instalar. La base vive en `./data/tracker.db`.
- **SheetJS (xlsx)** para leer y exportar planillas.

## Requisitos

- **Node.js 22+** (se usa `node:sqlite`, disponible con el flag
  `--experimental-sqlite`, que ya viene incluido en los scripts vía `cross-env`).

## Cómo correrlo

```bash
npm install
npm run dev        # desarrollo en http://localhost:3000
```

Para producción:

```bash
npm run build
npm run start
```

La base de datos SQLite se crea sola en `./data/tracker.db` la primera vez.

## Flujo de uso

1. Anda a **Cargar sábana**, sube tu Excel/CSV y confirma el mapeo de columnas
   (el **N° PO** es obligatorio; el resto es opcional).
2. Revisa y administra tus PO en **Purchase Orders**.
3. Mira totales y el forecast por IO en el **Dashboard**.
4. Guarda un **Respaldo** antes de cambios grandes o para cerrar el mes.

## Estructura

```
src/
  app/
    page.tsx            Dashboard (KPIs, gráficos, forecast por IO)
    pos/                Tabla y administración de PO
    import/             Carga de sábana + mapeo de columnas
    snapshots/          Respaldos de ejecución
    api/                Endpoints (pos, import, dashboard, snapshots, export)
  components/           Sidebar, drawer de edición, UI compartida
  lib/
    db.ts               Conexión SQLite (node:sqlite) + esquema
    repo.ts             Acceso a datos (queries)
    coerce.ts           Auto-mapeo de columnas y coerción de valores
    format.ts           Formato de moneda/fecha (locale es-CL)
    types.ts            Campos, estados y tipos
```
