import PDFDocument from 'pdfkit'

const COLORS = {
  headerBg:   '#1E293B',
  headerText: '#FFFFFF',
  accent:     '#0EA5E9',
  accentMuted:'#E0F2FE',
  text:       '#1E293B',
  muted:      '#64748B',
  border:     '#E2E8F0',
  rowAlt:     '#F8FAFC',
  totalBg:    '#1E293B',
  totalText:  '#FFFFFF',
  labelBg:    '#F1F5F9',
}

const STATUS_LABELS = {
  draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado',
  rejected: 'Rechazado', expired: 'Vencido',
  paid: 'Pagado', overdue: 'Vencido', cancelled: 'Cancelado', partial: 'Cuotas pendientes'
}

function fmt(n, currency = '') {
  const sym = currency === 'USD' ? 'US$' : '$'
  return `${sym}${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR')
}

/**
 * @param {'quote'|'invoice'} type
 * @param {object} data — quote/invoice con items, client, project, organization
 */
export function buildPdf(type, data) {
  const doc = new PDFDocument({ margin: 0, size: 'A4' })

  const isQuote = type === 'quote'
  const docLabel = isQuote ? 'PRESUPUESTO' : 'FACTURA'
  const pageW = doc.page.width   // 595
  const pageH = doc.page.height  // 842
  const pad = 48

  // ── Header band ─────────────────────────────────────────────────────────
  const headerH = 72
  doc.rect(0, 0, pageW, headerH).fillColor(COLORS.headerBg).fill()

  // Org name (left)
  doc
    .font('Helvetica-Bold').fontSize(16).fillColor(COLORS.headerText)
    .text(data.organization?.name || 'Organización', pad, 24, { width: 260 })

  // Doc label + number (right)
  doc
    .font('Helvetica-Bold').fontSize(15).fillColor(COLORS.headerText)
    .text(`${docLabel}`, pageW - pad - 200, 18, { width: 200, align: 'right' })
  doc
    .font('Helvetica').fontSize(12).fillColor('#94A3B8')
    .text(`N° ${data.number}`, pageW - pad - 200, 38, { width: 200, align: 'right' })

  // ── Info section (client left, doc details right) ────────────────────────
  const infoTop = headerH + 24
  const colW = (pageW - pad * 2 - 20) / 2

  // Left: client block
  doc
    .font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
    .text('CLIENTE', pad, infoTop)
  doc
    .font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text)
    .text(data.client?.name || '—', pad, infoTop + 11, { width: colW })

  let clientY = infoTop + 30
  const clientLines = [
    data.client?.company,
    data.client?.cuit ? `CUIL/CUIT: ${data.client.cuit}` : null,
    data.client?.email,
    data.client?.phone,
    data.client?.address,
  ].filter(Boolean)
  clientLines.forEach(line => {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(line, pad, clientY, { width: colW })
    clientY += 13
  })

  // Right: doc info block
  const rightX = pad + colW + 20
  const infoRows = isQuote
    ? [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        ['Moneda',       data.currency],
        data.project    ? ['Proyecto',    data.project.title]      : null,
        data.validUntil ? ['Válido hasta', fmtDate(data.validUntil)] : null,
      ].filter(Boolean)
    : [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        ['Moneda',       data.currency],
        data.project  ? ['Proyecto',     data.project.title]    : null,
        data.dueDate  ? ['Vencimiento',  fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let rowY = infoTop
  infoRows.forEach(([label, value]) => {
    doc
      .font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
      .text(label.toUpperCase(), rightX, rowY, { width: 85 })
    doc
      .font('Helvetica').fontSize(9).fillColor(COLORS.text)
      .text(String(value), rightX + 90, rowY, { width: colW - 90 })
    rowY += 16
  })

  // Divider
  const divY = Math.max(clientY, rowY) + 16
  doc.moveTo(pad, divY).lineTo(pageW - pad, divY).lineWidth(0.5).strokeColor(COLORS.border).stroke()

  // ── Items table ──────────────────────────────────────────────────────────
  const tableTop = divY + 16
  const tableW = pageW - pad * 2
  const colDesc = tableW * 0.46
  const colQty  = tableW * 0.12
  const colUnit = tableW * 0.20
  const colAmt  = tableW * 0.22

  const xDesc = pad
  const xQty  = pad + colDesc
  const xUnit = pad + colDesc + colQty
  const xAmt  = pad + colDesc + colQty + colUnit

  // Header row
  doc.rect(pad, tableTop, tableW, 24).fillColor(COLORS.headerBg).fill()
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.headerText)
  doc.text('DESCRIPCIÓN',  xDesc + 6, tableTop + 8, { width: colDesc - 8 })
  doc.text('CANT.',        xQty,      tableTop + 8, { width: colQty,  align: 'right' })
  doc.text('PRECIO UNIT.', xUnit,     tableTop + 8, { width: colUnit, align: 'right' })
  doc.text('TOTAL',        xAmt,      tableTop + 8, { width: colAmt - 6, align: 'right' })

  // Item rows
  let y = tableTop + 24
  const rowH = 22
  ;(data.items || []).forEach((item, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : COLORS.rowAlt
    doc.rect(pad, y, tableW, rowH).fillColor(bg).fill()
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
    doc.text(item.description, xDesc + 6, y + 7, { width: colDesc - 12, ellipsis: true })
    doc.text(String(item.quantity), xQty, y + 7, { width: colQty, align: 'right' })
    doc.text(fmt(item.unitPrice), xUnit, y + 7, { width: colUnit, align: 'right' })
    doc.text(fmt(item.amount), xAmt, y + 7, { width: colAmt - 6, align: 'right' })
    y += rowH
  })

  // Table border
  doc.rect(pad, tableTop, tableW, y - tableTop).lineWidth(0.5).strokeColor(COLORS.border).stroke()

  // ── Notes / scope ────────────────────────────────────────────────────────
  if (data.notes) {
    y += 20
    doc
      .font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
      .text('ALCANCE / NOTAS', pad, y)
    y += 13
    doc
      .font('Helvetica').fontSize(9).fillColor(COLORS.text)
      .text(data.notes, pad, y, { width: tableW, lineGap: 2 })
    y = doc.y + 12
  } else {
    y += 20
  }

  // ── Bottom section: totals (right) ──────────────────────────────────────
  const subtotal  = Number(data.subtotal)
  const total     = Number(data.total)
  const taxAmount = total - subtotal

  // Totals box (right-aligned)
  const boxW  = 220
  const boxX  = pageW - pad - boxW
  const lineH = 20

  let ty = y

  function totalsLine(label, value, bold = false) {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 10 : 9)
      .fillColor(bold ? COLORS.text : COLORS.muted)
      .text(label, boxX, ty, { width: 115, align: 'right' })
      .text(value,  boxX + 120, ty, { width: boxW - 120, align: 'right' })
    ty += lineH
  }

  totalsLine('Subtotal:', fmt(subtotal))
  if (data.taxRate > 0) {
    totalsLine(`IVA (${data.taxRate}%):`, fmt(taxAmount))
  }

  // Divider
  doc.moveTo(boxX, ty).lineTo(pageW - pad, ty).lineWidth(0.5).strokeColor(COLORS.border).stroke()
  ty += 6

  // Total highlighted box
  const totalBoxH = 36
  doc.rect(boxX, ty, boxW, totalBoxH).fillColor(COLORS.totalBg).fill()
  doc
    .font('Helvetica').fontSize(8).fillColor('#94A3B8')
    .text(`TOTAL ${data.currency}`, boxX + 10, ty + 6, { width: 90 })
  doc
    .font('Helvetica-Bold').fontSize(15).fillColor(COLORS.totalText)
    .text(fmt(total, data.currency), boxX + 10, ty + 14, { width: boxW - 20, align: 'right' })

  // ── Footer ───────────────────────────────────────────────────────────────
  doc
    .font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text(
      `${docLabel} N° ${data.number}  ·  Generado el ${fmtDate(new Date())}`,
      pad, pageH - 30,
      { align: 'center', width: pageW - pad * 2 }
    )

  doc.end()
  return doc
}
