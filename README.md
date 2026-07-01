# PO Tracker

Webapp para administrar Purchase Orders a partir de la sábana COUPA/SAP (Excel o
CSV), con vista agrupada por PO, desglose por líneas e IO (Internal Orders /
centros de costo por marca) y forecast de ejecución mensual.

Diseño limpio y moderno estilo Folk, hecho con Tailwind.

## Funcionalidades

- **Carga de sábana (.xlsx / .xls / .csv)**: detecta automáticamente la hoja con
  datos (ignora tablas dinámicas), limpia encabezados, auto-mapea las columnas y
  **descarta sola las columnas que no se usan**. Reconoce formatos chilenos de
  número (`1.500.000`) y varios formatos de fecha.
- **Filtro de dueño** al importar: conserva solo las filas cuyo responsable calce
  con tu nombre (el matching ignora puntos, mayúsculas y dominios, así
  "Alvaro Yavar" calza con "Alvaro.Yavar@diageo.com"), con vista previa de
  cuántas filas pasan antes de importar.
- **PO agrupadas**: una fila por PO; al pincharla se despliegan sus líneas y, si
  la PO se paga con más de un IO, el desglose por IO (valor, facturado, abierto).
- **Montos completos por línea**: valor total de la PO, valor de línea, facturado
  (`As of Today: TOTAL Invoice`) y saldo abierto (se calcula si la sábana no lo
  trae). Barra de % de ejecución por PO y por línea.
- **Dashboard**: comprometido / facturado / saldo abierto, % de ejecución,
  gráfico de ejecución por IO (facturado vs abierto), líneas por estado, top
  proveedores y la matriz de **forecast mensual del saldo abierto por IO**.
- **Estados y seguimiento**: estado por línea (auto-derivado del avance al
  importar), historial de cambios, notas y mes de ejecución editable (alimenta el
  forecast).
- **Respaldos de ejecución**: snapshots del estado completo, restaurables (útil
  para cierres mensuales).
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

1. Anda a **Cargar sábana**, sube tu Excel/CSV, revisa el filtro de dueño y el
   mapeo de columnas (el **N° PO** es obligatorio; el resto es opcional).
2. Revisa y administra tus PO en **Purchase Orders** (pincha una PO para ver sus
   líneas e IOs; pincha una línea para editarla).
3. Mira totales, ejecución y el forecast por IO en el **Dashboard**.
4. Guarda un **Respaldo** antes de cambios grandes o para cerrar el mes.

## Estructura

```
src/
  app/
    page.tsx            Dashboard (KPIs, gráficos, forecast por IO)
    pos/                PO agrupadas con desglose por línea/IO
    import/             Carga de sábana + filtro de dueño + mapeo de columnas
    snapshots/          Respaldos de ejecución
    api/                Endpoints (pos, import, dashboard, snapshots, export)
  components/           Sidebar, drawer de edición, UI compartida
  lib/
    db.ts               Conexión SQLite (node:sqlite) + esquema
    repo.ts             Acceso a datos (queries)
    coerce.ts           Auto-mapeo de columnas, filtro de dueño y coerción
    format.ts           Formato de moneda/fecha (locale es-CL)
    types.ts            Campos, estados, tipos y agrupación por PO
```
