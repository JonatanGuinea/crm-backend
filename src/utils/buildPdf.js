import PDFDocument from 'pdfkit'

const COLORS = {
  primary: '#4F46E5',   // indigo
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  rowAlt: '#F9FAFB',
}

function fmt(n) {
  return `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR')
}

/**
 * @param {'quote'|'invoice'} type
 * @param {object} data  — el objeto completo del quote/invoice (con items, client, project, organization)
 * @returns {PDFDocument}
 */
export function buildPdf(type, data) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })

  const isQuote = type === 'quote'
  const docLabel = isQuote ? 'PRESUPUESTO' : 'FACTURA'
  const pageWidth = doc.page.width
  const contentWidth = pageWidth - 100  // margins 50 each side

  // ── Header ──────────────────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.primary)
    .text(data.organization?.name || 'Mi organización', 50, 50)

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.text)
    .text(`${docLabel} #${data.number}`, 50, 50, { align: 'right', width: contentWidth })

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(fmtDate(data.createdAt), 50, 76, { align: 'right', width: contentWidth })

  // Divider
  doc
    .moveTo(50, 100)
    .lineTo(pageWidth - 50, 100)
    .lineWidth(1)
    .strokeColor(COLORS.primary)
    .stroke()

  // ── Client + Doc info ────────────────────────────────────────────────────
  const infoTop = 115
  const halfWidth = contentWidth / 2 - 10

  // Client block (left)
  doc
    .font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted)
    .text('CLIENTE', 50, infoTop)
  doc
    .font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text)
    .text(data.client?.name || '—', 50, infoTop + 14)

  let clientY = infoTop + 30
  const clientDetails = [
    data.client?.company,
    data.client?.email,
    data.client?.phone,
  ].filter(Boolean)
  clientDetails.forEach(line => {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(line, 50, clientY)
    clientY += 14
  })

  // Doc info block (right)
  const rightX = 50 + halfWidth + 20
  const infoRows = isQuote
    ? [
        ['Estado', data.status],
        ['Moneda', data.currency],
        data.project ? ['Proyecto', data.project.title] : null,
        data.validUntil ? ['Válido hasta', fmtDate(data.validUntil)] : null,
      ].filter(Boolean)
    : [
        ['Estado', data.status],
        ['Moneda', data.currency],
        data.project ? ['Proyecto', data.project.title] : null,
        data.dueDate ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let rowY = infoTop
  infoRows.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text(label.toUpperCase(), rightX, rowY)
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(String(value), rightX + 90, rowY)
    rowY += 18
  })

  // ── Items table ──────────────────────────────────────────────────────────
  const tableTop = Math.max(clientY, rowY) + 24

  // Table header
  doc
    .rect(50, tableTop, contentWidth, 22)
    .fillColor(COLORS.primary)
    .fill()

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
  doc.text('DESCRIPCIÓN',    58, tableTop + 7)
  doc.text('CANT.',          330, tableTop + 7)
  doc.text('PRECIO UNIT.',   380, tableTop + 7)
  doc.text('TOTAL',          460, tableTop + 7, { width: contentWidth - 410, align: 'right' })

  // Table rows
  let y = tableTop + 22
  data.items?.forEach((item, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : COLORS.rowAlt
    doc.rect(50, y, contentWidth, 20).fillColor(bg).fill()
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
    doc.text(item.description, 58, y + 6, { width: 265, ellipsis: true })
    doc.text(String(item.quantity), 330, y + 6, { width: 45 })
    doc.text(fmt(item.unitPrice), 380, y + 6, { width: 75 })
    doc.text(fmt(item.amount), 460, y + 6, { width: contentWidth - 410, align: 'right' })
    y += 20
  })

  // Border around table
  doc
    .rect(50, tableTop, contentWidth, y - tableTop)
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .stroke()

  // ── Totals ───────────────────────────────────────────────────────────────
  y += 12
  const subtotal = Number(data.subtotal)
  const total = Number(data.total)
  const taxAmount = total - subtotal
  const totalsX = pageWidth - 50 - 200
  const totalsLabelW = 120
  const totalsValueW = 80

  function totalRow(label, value, bold = false) {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 11 : 10)
      .fillColor(bold ? COLORS.text : COLORS.muted)
      .text(label, totalsX, y, { width: totalsLabelW, align: 'right' })
      .text(value, totalsX + totalsLabelW + 8, y, { width: totalsValueW, align: 'right' })
    y += bold ? 18 : 16
  }

  totalRow('Subtotal:', fmt(subtotal))
  if (data.taxRate > 0) {
    totalRow(`IVA (${data.taxRate}%):`, fmt(taxAmount))
  }

  // Divider before total
  doc
    .moveTo(totalsX, y).lineTo(pageWidth - 50, y)
    .lineWidth(0.5).strokeColor(COLORS.border).stroke()
  y += 6
  totalRow(`Total ${data.currency}:`, fmt(total), true)

  // ── Notes ────────────────────────────────────────────────────────────────
  if (data.notes) {
    y += 16
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text('NOTAS', 50, y)
    y += 14
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(data.notes, 50, y, { width: contentWidth })
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      `${docLabel} #${data.number} · Generado el ${fmtDate(new Date())}`,
      50, doc.page.height - 40,
      { align: 'center', width: contentWidth }
    )

  doc.end()
  return doc
}
