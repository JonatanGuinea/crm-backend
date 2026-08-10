import PDFDocument from 'pdfkit'

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  brand:   '#4f46e5',
  dark:    '#1e293b',
  muted:   '#64748b',
  subtle:  '#94a3b8',
  line:    '#e2e8f0',
  bg:      '#f8fafc',
  white:   '#ffffff',
  danger:  '#dc2626',
  warning: '#d97706',
  success: '#059669',
}

const PAGE_W  = 595
const PAGE_H  = 842
const PAD     = 48
const COL_W   = PAGE_W - PAD * 2

// ── Utilidades ────────────────────────────────────────────────────────────────

const fmt = (n, cur = 'ARS') => {
  const sym = cur === 'USD' ? 'US$' : '$'
  return `${sym}${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtMonth = (key) => {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

const monthLabel = (year, month) =>
  new Date(year, month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

function hex2rgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function hline(doc, y, color = C.line) {
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(PAD, y).lineTo(PAGE_W - PAD, y).stroke().restore()
}

function sectionTitle(doc, label, y) {
  doc.save()
    .rect(PAD, y, COL_W, 20).fillColor(C.bg).fill()
    .fontSize(7.5).font('Helvetica-Bold').fillColor(C.muted)
    .text(label.toUpperCase(), PAD + 8, y + 7, { width: COL_W })
    .restore()
  return y + 26
}

function kpiRow(doc, items, y) {
  const n  = items.length
  const bW = Math.floor((COL_W - (n - 1) * 6) / n)
  const bH = 38

  items.forEach((kpi, i) => {
    const x = PAD + i * (bW + 6)
    doc.save()
      .rect(x, y, bW, bH).fillColor(C.bg).fill()
      .rect(x, y, bW, bH).strokeColor(C.line).lineWidth(0.5).stroke()
      .fontSize(6.5).font('Helvetica').fillColor(C.muted)
      .text(kpi.label, x + 7, y + 8, { width: bW - 10 })
      .fontSize(10).font('Helvetica-Bold').fillColor(C.dark)
      .text(String(kpi.value ?? '—'), x + 7, y + 20, { width: bW - 10 })
      .restore()
  })
  return y + bH + 6
}

// Tabla simple: headers[] + rows[][] + colWidths[]
function table(doc, headers, rows, colWidths, y) {
  const rowH   = 18
  const headH  = 20
  const totalW = colWidths.reduce((a, b) => a + b, 0)

  // Header
  doc.save().rect(PAD, y, totalW, headH).fillColor(C.brand).fill().restore()
  let cx = PAD
  headers.forEach((h, i) => {
    doc.save().fontSize(7).font('Helvetica-Bold').fillColor(C.white)
      .text(h, cx + 5, y + 7, { width: colWidths[i] - 10, align: i > 0 ? 'right' : 'left' })
      .restore()
    cx += colWidths[i]
  })
  y += headH

  // Rows
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.bg
    doc.save().rect(PAD, y, totalW, rowH).fillColor(bg).fill().restore()
    hline(doc, y + rowH, C.line)
    cx = PAD
    row.forEach((cell, ci) => {
      doc.save().fontSize(8).font('Helvetica').fillColor(C.dark)
        .text(String(cell ?? '—'), cx + 5, y + 6, { width: colWidths[ci] - 10, align: ci > 0 ? 'right' : 'left' })
        .restore()
      cx += colWidths[ci]
    })
    y += rowH
  })

  return y + 8
}

function checkPage(doc, y, needed = 60) {
  if (y + needed > PAGE_H - 60) { doc.addPage(); return 60 }
  return y
}

// ── Secciones del informe ─────────────────────────────────────────────────────

function drawFinances(doc, y, { finances, currency }) {
  const f = finances
  const margin    = f.incomeMonth > 0 ? ((f.netMonth / f.incomeMonth) * 100).toFixed(1) : null
  const pendingNet = f.pendingIncome - f.pendingExpense

  y = sectionTitle(doc, 'Resumen financiero del mes', y)
  y = kpiRow(doc, [
    { label: 'Ingresos confirmados', value: fmt(f.incomeMonth, currency) },
    { label: 'Egresos confirmados',  value: fmt(f.expenseMonth, currency) },
    { label: 'Resultado del mes',    value: fmt(f.netMonth, currency) },
    { label: 'Saldo total en cuentas', value: fmt(f.totalBalance, currency) },
  ], y)

  y = checkPage(doc, y, 50)
  y = kpiRow(doc, [
    { label: 'Margen operativo',    value: margin !== null ? `${margin}%` : '—' },
    { label: 'Movimientos del mes', value: `${f.incomeCount + f.expenseCount}` },
    { label: 'A cobrar (pendiente)', value: fmt(f.pendingIncome, currency) },
    { label: 'A pagar (pendiente)',  value: fmt(f.pendingExpense, currency) },
    { label: 'Resultado pendiente',  value: fmt(pendingNet, currency) },
  ], y)

  // Evolución mensual
  if (f.monthlyEvolution?.length > 0) {
    y = checkPage(doc, y, 120)
    y = sectionTitle(doc, 'Evolución mensual — últimos 6 meses', y)
    const rows = f.monthlyEvolution.map(m => {
      const inc = Number(m.income || 0)
      const exp = Number(m.expense || 0)
      return [fmtMonth(m.key), fmt(inc, currency), fmt(exp, currency), fmt(inc - exp, currency)]
    })
    y = table(doc, ['Mes', 'Ingresos', 'Egresos', 'Neto'], rows, [100, 145, 145, 109], y)
  }

  // Categorías de egreso
  if (f.categoryBreakdown?.length > 0) {
    y = checkPage(doc, y, 100)
    y = sectionTitle(doc, 'Egresos por categoría', y)
    const rows = f.categoryBreakdown.map(c => [
      c.name,
      fmt(c.total, currency),
      f.expenseMonth > 0 ? `${((c.total / f.expenseMonth) * 100).toFixed(1)}%` : '—'
    ])
    y = table(doc, ['Categoría', 'Monto', '% del egreso'], rows, [250, 145, 104], y)
  }

  return y
}

function drawQuotes(doc, y, { quotes, currency }) {
  const q = quotes
  const approved    = q.byStatus.find(s => s.status === 'approved')
  const rejected    = q.byStatus.find(s => s.status === 'rejected')
  const sent        = q.byStatus.find(s => s.status === 'sent')
  const approvalRate = (approved && (sent?.count ?? 0) + (approved.count ?? 0) > 0)
    ? `${((approved.count / ((sent?.count ?? 0) + approved.count)) * 100).toFixed(1)}%` : '—'

  y = sectionTitle(doc, 'Resumen de presupuestos', y)
  y = kpiRow(doc, [
    { label: 'Total emitidos',     value: `${q.total}` },
    { label: 'Valor total',        value: fmt(q.totalVal, currency) },
    { label: 'Aprobados',          value: `${approved?.count ?? 0}` },
    { label: 'Tasa de aprobación', value: approvalRate },
    { label: 'Rechazados',         value: `${rejected?.count ?? 0}` },
  ], y)

  if (q.byStatus.length > 0) {
    y = checkPage(doc, y, 100)
    y = sectionTitle(doc, 'Distribución por estado', y)
    const STATUS_ES = {
      draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado',
      signed: 'Firmado', rejected: 'Rechazado', cancelled: 'Cancelado'
    }
    const rows = [...q.byStatus]
      .sort((a, b) => b.count - a.count)
      .map(s => [
        STATUS_ES[s.status] ?? s.status,
        String(s.count),
        fmt(s.total, currency),
        q.total > 0 ? `${((s.count / q.total) * 100).toFixed(1)}%` : '—'
      ])
    y = table(doc, ['Estado', 'Cantidad', 'Monto', '%'], rows, [150, 100, 145, 104], y)
  }

  return y
}

function drawProjects(doc, y, { projects }) {
  const p = projects
  const total = p.byStatus.reduce((s, x) => s + x.count, 0)
  const STATUS_ES = {
    pending: 'Pendiente', approved: 'Aprobado', in_progress: 'En curso',
    finished: 'Finalizado', cancelled: 'Cancelado'
  }

  y = sectionTitle(doc, 'Resumen de proyectos', y)
  y = kpiRow(doc, [
    { label: 'Total proyectos', value: String(total) },
    { label: 'En curso',        value: String(p.byStatus.find(s => s.status === 'in_progress')?.count ?? 0) },
    { label: 'Finalizados',     value: String(p.byStatus.find(s => s.status === 'finished')?.count ?? 0) },
    { label: 'Pendientes',      value: String(p.byStatus.find(s => s.status === 'pending')?.count ?? 0) },
    { label: 'Cancelados',      value: String(p.byStatus.find(s => s.status === 'cancelled')?.count ?? 0) },
  ], y)

  if (p.byStatus.length > 0) {
    y = checkPage(doc, y, 80)
    y = sectionTitle(doc, 'Distribución por estado', y)
    const rows = p.byStatus.map(s => [
      STATUS_ES[s.status] ?? s.status,
      String(s.count),
      total > 0 ? `${((s.count / total) * 100).toFixed(1)}%` : '—'
    ])
    y = table(doc, ['Estado', 'Cantidad', '%'], rows, [250, 145, 104], y)
  }

  return y
}

function drawStock(doc, y, { stock }) {
  const s = stock

  y = sectionTitle(doc, 'Resumen de inventario', y)
  y = kpiRow(doc, [
    { label: 'Total productos', value: String(s.totalProducts) },
    { label: 'Sin stock',       value: String(s.outOfStock) },
    { label: 'Stock bajo',      value: String(s.lowStock) },
  ], y)

  if (s.outOfStockList?.length > 0) {
    y = checkPage(doc, y, 80)
    y = sectionTitle(doc, `Productos sin stock (${s.outOfStockList.length})`, y)
    const rows = s.outOfStockList.map(p => [p.sku, p.name, `${p.stock} ${p.unit}`])
    y = table(doc, ['SKU', 'Producto', 'Stock'], rows, [100, 300, 99], y)
  }

  if (s.lowStockList?.length > 0) {
    y = checkPage(doc, y, 80)
    y = sectionTitle(doc, `Productos con stock bajo (${s.lowStockList.length})`, y)
    const rows = s.lowStockList.map(p => [p.sku, p.name, `${p.stock} ${p.unit}`, `${p.minStock} ${p.unit}`])
    y = table(doc, ['SKU', 'Producto', 'Stock actual', 'Stock mínimo'], rows, [100, 230, 100, 69], y)
  }

  return y
}

// ── Cover page ────────────────────────────────────────────────────────────────

function drawCover(doc, orgName, ownerName, year, month) {
  const [br, bg, bb] = hex2rgb(C.brand)

  // Header band
  doc.save().rect(0, 0, PAGE_W, 100).fillColor(C.brand).fill().restore()

  // Org name
  doc.save()
    .fontSize(22).font('Helvetica-Bold').fillColor(C.white)
    .text(orgName, 0, 36, { align: 'center', width: PAGE_W })
    .fontSize(9).font('Helvetica').fillColor('#c7d2fe')
    .text('SISTEMA DE GESTIÓN EMPRESARIAL', 0, 64, { align: 'center', width: PAGE_W })
    .restore()

  // Title
  doc.save()
    .fontSize(28).font('Helvetica-Bold').fillColor(C.dark)
    .text('Informe Mensual', 0, 160, { align: 'center', width: PAGE_W })
    .fontSize(13).font('Helvetica').fillColor(C.brand)
    .text(monthLabel(year, month).charAt(0).toUpperCase() + monthLabel(year, month).slice(1), 0, 200, { align: 'center', width: PAGE_W })
    .restore()

  // Divider
  hline(doc, 224, C.line)

  // Meta
  doc.save()
    .fontSize(9).font('Helvetica').fillColor(C.muted)
    .text(`Generado el: ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 0, 236, { align: 'center', width: PAGE_W })
    .text(`Destinatario: ${ownerName}`, 0, 250, { align: 'center', width: PAGE_W })
    .restore()

  // Footer band
  doc.save().rect(0, PAGE_H - 50, PAGE_W, 50).fillColor(C.brand).fill().restore()
  doc.save()
    .fontSize(8).font('Helvetica').fillColor('#c7d2fe')
    .text('Reporte generado automáticamente por SOFIAPP CRM', 0, PAGE_H - 28, { align: 'center', width: PAGE_W })
    .restore()
}

// ── Encabezado de sección ─────────────────────────────────────────────────────

function drawSectionHeader(doc, title, orgName, year, month) {
  doc.save()
    .rect(0, 0, PAGE_W, 36).fillColor(C.brand).fill()
    .fontSize(14).font('Helvetica-Bold').fillColor(C.white)
    .text(title, PAD, 12, { width: COL_W })
    .fontSize(8).font('Helvetica').fillColor('#c7d2fe')
    .text(`${orgName} · ${monthLabel(year, month)}`, PAD, 0, { width: COL_W, align: 'right', baseline: 'middle' })
    .restore()
  return 52
}

// ── Pie de página ─────────────────────────────────────────────────────────────

function addPageNumbers(doc, orgName, startPage = 2) {
  const total = doc.bufferedPageRange().count + startPage - 1
  for (let i = startPage; i <= total; i++) {
    doc.switchToPage(i - 1)
    doc.save()
      .fontSize(7).font('Helvetica').fillColor(C.muted)
      .text(`${orgName} · SOFIAPP CRM`, PAD, PAGE_H - 30)
      .text(`Página ${i - startPage + 1}`, PAGE_W - PAD - 50, PAGE_H - 30, { width: 50, align: 'right' })
      .restore()
  }
}

// ── Export principal ──────────────────────────────────────────────────────────

export function buildMonthlyReportPdf(data, year, month) {
  return new Promise((resolve, reject) => {
    const { org, currency, finances, quotes, projects, stock } = data
    const orgName   = org?.name   ?? 'Organización'
    const ownerName = org?.owner?.name ?? 'Administrador'

    const doc    = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
    const chunks = []
    doc.on('data',  chunk => chunks.push(chunk))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Portada
    drawCover(doc, orgName, ownerName, year, month)

    // ── Finanzas ──
    doc.addPage()
    let y = drawSectionHeader(doc, 'Finanzas', orgName, year, month)
    y = drawFinances(doc, y, { finances, currency })

    // ── Presupuestos ──
    doc.addPage()
    y = drawSectionHeader(doc, 'Presupuestos', orgName, year, month)
    y = drawQuotes(doc, y, { quotes, currency })

    // ── Proyectos ──
    doc.addPage()
    y = drawSectionHeader(doc, 'Proyectos', orgName, year, month)
    y = drawProjects(doc, y, { projects })

    // ── Stock ──
    doc.addPage()
    y = drawSectionHeader(doc, 'Stock e Inventario', orgName, year, month)
    drawStock(doc, y, { stock })

    addPageNumbers(doc, orgName)

    doc.end()
  })
}
