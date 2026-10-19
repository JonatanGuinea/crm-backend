import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR  = join(__dirname, '../assets/fonts')

// ── Paleta DanteUP monocroma ──────────────────────────────────────────────────
const C = {
  bg:    '#0B0B0C',
  s1:    '#141415',
  s2:    '#1E1E20',
  linea: '#2C2C2F',
  crema: '#F2EDE3',
  arena: '#B9B4AA',
  piedra:'#8C877E',
  ok:    '#7DBE93',
  warn:  '#E2B663',
  err:   '#E58373',
}

const PAGE_W = 595
const PAGE_H  = 842
const PAD     = 44
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

// ── Primitivos ────────────────────────────────────────────────────────────────

function paintBg(doc) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(C.bg).fill()
}

function hline(doc, y, color = C.linea) {
  doc.save().rect(PAD, y, COL_W, 0.5).fillColor(color).fill().restore()
}

function sectionTitle(doc, label, y) {
  doc.save()
    .rect(PAD, y, 3, 18).fillColor(C.arena).fill()
    .rect(PAD + 3, y, COL_W - 3, 18).fillColor(C.s2).fill()
    .fontSize(7).font('Geist-Bold').fillColor(C.arena)
    .text(label.toUpperCase(), PAD + 11, y + 6, { width: COL_W - 14, characterSpacing: 0.8 })
    .restore()
  return y + 28
}

function kpiRow(doc, items, y) {
  const n  = items.length
  const bW = Math.floor((COL_W - (n - 1) * 6) / n)
  const bH = 40

  items.forEach((kpi, i) => {
    const x = PAD + i * (bW + 6)
    doc.save()
      .rect(x, y, bW, bH).fillColor(C.s1).fill()
      .rect(x, y, bW, bH).strokeColor(C.linea).lineWidth(0.5).stroke()
      .fontSize(6.5).font('Geist').fillColor(C.piedra)
      .text(kpi.label, x + 8, y + 9, { width: bW - 14 })
      .fontSize(10.5).font('Geist-Bold').fillColor(C.crema)
      .text(String(kpi.value ?? '—'), x + 8, y + 22, { width: bW - 14 })
      .restore()
  })
  return y + bH + 8
}

function table(doc, headers, rows, colWidths, y) {
  const rowH   = 19
  const headH  = 22
  const totalW = colWidths.reduce((a, b) => a + b, 0)

  // Header
  doc.save().rect(PAD, y, totalW, headH).fillColor(C.s2).fill().restore()
  let cx = PAD
  headers.forEach((h, i) => {
    doc.save().fontSize(7).font('Geist-Bold').fillColor(C.crema)
      .text(h.toUpperCase(), cx + 6, y + 8, { width: colWidths[i] - 12, align: i > 0 ? 'right' : 'left', characterSpacing: 0.6 })
      .restore()
    cx += colWidths[i]
  })
  y += headH

  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? C.bg : C.s1
    doc.save().rect(PAD, y, totalW, rowH).fillColor(bg).fill().restore()
    doc.save().rect(PAD, y + rowH - 0.5, totalW, 0.5).fillColor(C.linea).fill().restore()
    cx = PAD
    row.forEach((cell, ci) => {
      doc.save().fontSize(8.5).font('Geist').fillColor(ci === 0 ? C.arena : C.crema)
        .text(String(cell ?? '—'), cx + 6, y + 6, { width: colWidths[ci] - 12, align: ci > 0 ? 'right' : 'left' })
        .restore()
      cx += colWidths[ci]
    })
    y += rowH
  })

  return y + 8
}

function checkPage(doc, y, needed = 60) {
  if (y + needed > PAGE_H - 50) {
    doc.addPage()
    paintBg(doc)
    return 28
  }
  return y
}

// ── Cover ─────────────────────────────────────────────────────────────────────

function drawCover(doc, orgName, ownerName, year, month) {
  paintBg(doc)

  // Línea de acento superior
  doc.rect(0, 0, PAGE_W, 3).fillColor(C.crema).fill()

  // Nombre de organización
  doc.font('Geist').fontSize(9).fillColor(C.piedra)
    .text(orgName.toUpperCase(), 0, 188, { align: 'center', width: PAGE_W, characterSpacing: 2 })

  // Título principal
  doc.font('Geist-Bold').fontSize(38).fillColor(C.crema)
    .text('Informe', 0, 208, { align: 'center', width: PAGE_W })
  doc.font('Geist-Bold').fontSize(38).fillColor(C.crema)
    .text('Mensual', 0, 254, { align: 'center', width: PAGE_W })

  // Divisor
  doc.rect(PAD, 308, COL_W, 0.5).fillColor(C.linea).fill()

  // Mes
  const mLabel = monthLabel(year, month)
  doc.font('Geist').fontSize(14).fillColor(C.arena)
    .text(mLabel.charAt(0).toUpperCase() + mLabel.slice(1), 0, 325, { align: 'center', width: PAGE_W })

  // Meta
  doc.font('Geist').fontSize(9).fillColor(C.piedra)
    .text(`Generado el ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 0, 360, { align: 'center', width: PAGE_W })
    .text(`Destinatario: ${ownerName}`, 0, 374, { align: 'center', width: PAGE_W })

  // Footer
  doc.font('Geist').fontSize(8).fillColor(C.piedra)
    .text('Reporte generado con DANTEUP', 0, PAGE_H - 38, { align: 'center', width: PAGE_W })
}

// ── Encabezado de sección ─────────────────────────────────────────────────────

function drawSectionHeader(doc, title, orgName, year, month) {
  paintBg(doc)

  doc.rect(0, 0, PAGE_W, 40).fillColor(C.s1).fill()
  doc.rect(0, 39, PAGE_W, 0.5).fillColor(C.linea).fill()
  doc.rect(0, 0, 3, 40).fillColor(C.crema).fill()

  doc.font('Geist-Bold').fontSize(13).fillColor(C.crema)
    .text(title, PAD, 14, { width: COL_W * 0.55, lineBreak: false })

  const mLabel = monthLabel(year, month)
  doc.font('Geist').fontSize(8).fillColor(C.piedra)
    .text(`${orgName} · ${mLabel.charAt(0).toUpperCase() + mLabel.slice(1)}`, PAD, 16, { width: COL_W, align: 'right', lineBreak: false })

  return 56
}

// ── Pie de página ─────────────────────────────────────────────────────────────

function addPageNumbers(doc, orgName, startPage = 2) {
  const total = doc.bufferedPageRange().count + startPage - 1
  for (let i = startPage; i <= total; i++) {
    doc.switchToPage(i - 1)
    doc.save()
      .fontSize(7).font('Geist').fillColor(C.piedra)
      .text(`${orgName} · DANTEUP`, PAD, PAGE_H - 28, { lineBreak: false })
      .text(String(i - startPage + 1), PAGE_W - PAD - 30, PAGE_H - 28, { width: 30, align: 'right', lineBreak: false })
      .restore()
  }
}

// ── Secciones de contenido ────────────────────────────────────────────────────

function drawFinances(doc, y, { finances, currency }) {
  const f          = finances
  const margin     = f.incomeMonth > 0 ? ((f.netMonth / f.incomeMonth) * 100).toFixed(1) : null
  const pendingNet = f.pendingIncome - f.pendingExpense

  y = sectionTitle(doc, 'Resumen financiero del mes', y)
  y = kpiRow(doc, [
    { label: 'Ingresos confirmados',  value: fmt(f.incomeMonth, currency) },
    { label: 'Egresos confirmados',   value: fmt(f.expenseMonth, currency) },
    { label: 'Resultado del mes',     value: fmt(f.netMonth, currency) },
    { label: 'Saldo total en cuentas', value: fmt(f.totalBalance, currency) },
  ], y)

  y = checkPage(doc, y, 50)
  y = kpiRow(doc, [
    { label: 'Margen operativo',      value: margin !== null ? `${margin}%` : '—' },
    { label: 'Movimientos del mes',   value: `${f.incomeCount + f.expenseCount}` },
    { label: 'A cobrar (pendiente)',  value: fmt(f.pendingIncome, currency) },
    { label: 'A pagar (pendiente)',   value: fmt(f.pendingExpense, currency) },
    { label: 'Resultado pendiente',   value: fmt(pendingNet, currency) },
  ], y)

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

  if (f.categoryBreakdown?.length > 0) {
    y = checkPage(doc, y, 100)
    y = sectionTitle(doc, 'Egresos por categoría', y)
    const rows = f.categoryBreakdown.map(c => [
      c.name,
      fmt(c.total, currency),
      f.expenseMonth > 0 ? `${((c.total / f.expenseMonth) * 100).toFixed(1)}%` : '—',
    ])
    y = table(doc, ['Categoría', 'Monto', '% del egreso'], rows, [250, 145, 104], y)
  }

  return y
}

function drawQuotes(doc, y, { quotes, currency }) {
  const q            = quotes
  const approved     = q.byStatus.find(s => s.status === 'approved')
  const rejected     = q.byStatus.find(s => s.status === 'rejected')
  const sent         = q.byStatus.find(s => s.status === 'sent')
  const approvalRate = (approved && (sent?.count ?? 0) + (approved.count ?? 0) > 0)
    ? `${((approved.count / ((sent?.count ?? 0) + approved.count)) * 100).toFixed(1)}%` : '—'

  y = sectionTitle(doc, 'Resumen de presupuestos', y)
  y = kpiRow(doc, [
    { label: 'Total emitidos',      value: `${q.total}` },
    { label: 'Valor total',         value: fmt(q.totalVal, currency) },
    { label: 'Aprobados',           value: `${approved?.count ?? 0}` },
    { label: 'Tasa de aprobación',  value: approvalRate },
    { label: 'Rechazados',          value: `${rejected?.count ?? 0}` },
  ], y)

  if (q.byStatus.length > 0) {
    y = checkPage(doc, y, 100)
    y = sectionTitle(doc, 'Distribución por estado', y)
    const STATUS_ES = {
      draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado',
      signed: 'Firmado', rejected: 'Rechazado', cancelled: 'Cancelado',
    }
    const rows = [...q.byStatus]
      .sort((a, b) => b.count - a.count)
      .map(s => [
        STATUS_ES[s.status] ?? s.status,
        String(s.count),
        fmt(s.total, currency),
        q.total > 0 ? `${((s.count / q.total) * 100).toFixed(1)}%` : '—',
      ])
    y = table(doc, ['Estado', 'Cantidad', 'Monto', '%'], rows, [150, 100, 145, 104], y)
  }

  return y
}

function drawProjects(doc, y, { projects }) {
  const p       = projects
  const total   = p.byStatus.reduce((s, x) => s + x.count, 0)
  const STATUS_ES = {
    pending: 'Pendiente', approved: 'Aprobado', in_progress: 'En curso',
    finished: 'Finalizado', cancelled: 'Cancelado',
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
      total > 0 ? `${((s.count / total) * 100).toFixed(1)}%` : '—',
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

// ── Export principal ──────────────────────────────────────────────────────────

export function buildMonthlyReportPdf(data, year, month) {
  return new Promise((resolve, reject) => {
    const { org, currency, finances, quotes, projects, stock } = data
    const orgName   = org?.name        ?? 'Organización'
    const ownerName = org?.owner?.name ?? 'Administrador'

    const doc    = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
    const chunks = []
    doc.on('data',  chunk => chunks.push(chunk))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('Geist',          join(FONTS_DIR, 'Geist-Regular.woff2'))
    doc.registerFont('Geist-SemiBold', join(FONTS_DIR, 'Geist-SemiBold.woff2'))
    doc.registerFont('Geist-Bold',     join(FONTS_DIR, 'Geist-Bold.woff2'))

    drawCover(doc, orgName, ownerName, year, month)

    doc.addPage()
    let y = drawSectionHeader(doc, 'Finanzas', orgName, year, month)
    y = drawFinances(doc, y, { finances, currency })

    doc.addPage()
    y = drawSectionHeader(doc, 'Presupuestos', orgName, year, month)
    y = drawQuotes(doc, y, { quotes, currency })

    doc.addPage()
    y = drawSectionHeader(doc, 'Proyectos', orgName, year, month)
    y = drawProjects(doc, y, { projects })

    doc.addPage()
    y = drawSectionHeader(doc, 'Stock e Inventario', orgName, year, month)
    drawStock(doc, y, { stock })

    addPageNumbers(doc, orgName)

    doc.end()
  })
}
