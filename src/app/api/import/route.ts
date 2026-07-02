import { NextRequest, NextResponse } from "next/server";
import { bulkCreate, clearAllPos, createSnapshot, listPos, reconcileImport, PoInput } from "@/lib/repo";
import { coerceDate, coerceNumber, coerceText, matchesOwner } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/import
// body: {
//   rows: Array<Record<field, value>>,   filas ya mapeadas a campos canónicos
//   raw?: any[],                          filas originales de la sábana
//   mode: "update" | "append" | "replace",  update = actualización semanal acumulativa
//   closeAbsent?: boolean,                en "update": cerrar líneas que no vienen (default true)
//   ownerFilter?: string                  ej: "Alvaro Yavar" — descarta lo que no calce
// }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
  const raws: any[] = Array.isArray(body.raw) ? body.raw : [];
  const mode: string = ["update", "replace", "append"].includes(body.mode) ? body.mode : "update";
  const closeAbsent: boolean = body.closeAbsent !== false;
  const ownerFilter: string = coerceText(body.ownerFilter) || "";

  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }

  let filteredOut = 0;
  const records: PoInput[] = [];

  rows.forEach((r, i) => {
    const poNumber = coerceText(r.poNumber);
    if (!poNumber) return; // fila sin N° de PO -> se descarta

    // Filtro de dueño: se evalúa contra owner y requisitioner.
    if (ownerFilter) {
      const ownerVal = coerceText(r.owner);
      const reqVal = coerceText(r.requisitioner);
      const target = [ownerVal, reqVal].filter(Boolean).join(" ");
      if (!matchesOwner(target, ownerFilter)) {
        filteredOut++;
        return;
      }
    }

    const lineValue = coerceNumber(r.lineValue);
    const invoiced = coerceNumber(r.invoicedAmount);
    // Si la sábana no trae saldo abierto, se calcula: línea - facturado.
    const openAmount =
      r.openAmount !== undefined && r.openAmount !== ""
        ? coerceNumber(r.openAmount)
        : Math.max(0, lineValue - invoiced);

    // Estado automático según ejecución (si la sábana no trae estado).
    let status = coerceText(r.status);
    if (!status) {
      if (lineValue > 0 && openAmount <= 1) status = "Facturada";
      else if (invoiced > 0) status = "En proceso";
      else status = "Pendiente";
    }

    records.push({
      poNumber,
      poLine: coerceText(r.poLine),
      io: coerceText(r.io),
      vendor: coerceText(r.vendor),
      description: coerceText(r.description),
      glAccount: coerceText(r.glAccount),
      glDescription: coerceText(r.glDescription),
      requisitioner: coerceText(r.requisitioner),
      owner: coerceText(r.owner),
      reportingFY: coerceText(r.reportingFY),
      totalPoValue: coerceNumber(r.totalPoValue),
      lineValue,
      invoicedAmount: invoiced,
      openAmount,
      currency: coerceText(r.currency) || "CLP",
      status,
      poDate: coerceDate(r.poDate),
      deliveryDate: coerceDate(r.deliveryDate),
      executionDate: coerceDate(r.executionDate),
      notes: coerceText(r.notes),
      raw: raws[i] ? JSON.stringify(raws[i]) : null,
    });
  });

  if (records.length === 0) {
    return NextResponse.json(
      {
        error: ownerFilter
          ? `Ninguna fila pasó el filtro (dueño: "${ownerFilter}" y N° de PO válido)`
          : "Ninguna fila tenía un N° de PO válido",
      },
      { status: 400 }
    );
  }

  const skipped = rows.length - records.length - filteredOut;

  if (mode === "update") {
    // Respaldo automático antes de reconciliar, por si hay que volver atrás.
    if ((await listPos()).length > 0) {
      const stamp = new Date().toLocaleDateString("es-CL");
      await createSnapshot(`Auto — antes de carga semanal ${stamp}`, null);
    }
    const summary = await reconcileImport(records, closeAbsent);
    return NextResponse.json({ mode, skipped, filteredOut, summary });
  }

  if (mode === "replace") await clearAllPos();
  const imported = await bulkCreate(records);
  return NextResponse.json({ imported, skipped, filteredOut, mode });
}
