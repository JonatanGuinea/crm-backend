import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LOGO_PATH = join(__dirname, '../assets/logo.png')
const UPLOADS_DIR = join(__dirname, '../../uploads')

const C = {
  dark:       '#0f172a',
  teal:       '#14b8a6',
  tealLight:  '#f0fdfa',
  tealMid:    '#99f6e4',
  white:      '#ffffff',
  text:       '#1e293b',
  soft:       '#64748b',
  muted:      '#94a3b8',
  border:     '#f1f5f9',
  bg:         '#f8fafc',
}

const STATUS_LABELS = {
  draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado',
  rejected: 'Rechazado', expired: 'Vencido',
  paid: 'Pagado', overdue: 'Vencido', cancelled: 'Cancelado', partial: 'Cuotas pendientes'
}

const fmt = (n, cur = '') => {
  const sym = cur === 'USD' ? 'US$' : '$'
  return `${sym}${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—'

export function buildPdf(type, data) {
  const doc = new PDFDocument({ margin: 0, size: 'A4' })

  const isQuote   = type === 'quote'
  const docLabel  = isQuote ? 'Presupuesto' : 'Factura'
  const docPrefix = isQuote ? 'P' : 'F'
  const pageW     = doc.page.width   // 595
  const pageH     = doc.page.height  // 842
  const pad       = 52

  // Días de validez
  const validDays = (isQuote && data.validUntil && data.createdAt)
    ? Math.round((new Date(data.validUntil) - new Date(data.createdAt)) / (1000 * 60 * 60 * 24))
    : null

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER — full dark band
  // ─────────────────────────────────────────────────────────────────────────
  const headerH = 100
  doc.rect(0, 0, pageW, headerH).fillColor(C.dark).fill()

  // Teal accent bar — left edge
  doc.rect(0, 0, 5, headerH).fillColor(C.teal).fill()

  // Logo — org logo si existe, sino logo del CRM
  const orgLogoPath = data.organization?.logo ? join(UPLOADS_DIR, data.organization.logo) : null
  const logoPath = orgLogoPath && existsSync(orgLogoPath) ? orgLogoPath : DEFAULT_LOGO_PATH
  doc.image(logoPath, pad, (headerH - 36) / 2, { height: 36, fit: [160, 36] })

  // Doc type label
  doc.font('Helvetica').fontSize(9).fillColor(C.teal)
    .text(docLabel.toUpperCase(), pageW - pad - 180, 28, { width: 180, align: 'right', characterSpacing: 2 })

  // Doc number — large with prefix
  const numStr = String(data.number).padStart(3, '0')
  doc.font('Helvetica-Bold').fontSize(26).fillColor(C.white)
    .text(`${docPrefix}-${numStr}`, pageW - pad - 180, 40, { width: 180, align: 'right' })

  // ─────────────────────────────────────────────────────────────────────────
  // SUBHEADER — org name + date strip
  // ─────────────────────────────────────────────────────────────────────────
  const subH = 32
  doc.rect(0, headerH, pageW, subH).fillColor(C.tealLight).fill()

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.teal)
    .text((data.organization?.name || '').toUpperCase(), pad, headerH + 10,
      { width: (pageW - pad * 2) / 2, characterSpacing: 1 })

  doc.font('Helvetica').fontSize(8).fillColor(C.soft)
    .text(`Generado el ${fmtDate(new Date())}`, pad, headerH + 10,
      { width: pageW - pad * 2, align: 'right' })

  // ─────────────────────────────────────────────────────────────────────────
  // INFO SECTION — 3 columns: CLIENTE | DETALLES | EMISOR
  // ─────────────────────────────────────────────────────────────────────────
  const infoTop  = headerH + subH + 28
  const tableW0  = pageW - pad * 2          // 491
  const colGap   = 14
  const colC     = Math.floor(tableW0 * 0.37)  // ~182  cliente
  const colD     = Math.floor(tableW0 * 0.24)  // ~118  detalles
  const colO     = tableW0 - colC - colD - colGap * 2  // ~163  emisor

  const xC   = pad
  const xDet = xC + colC + colGap
  const xO   = xDet + colD + colGap

  // ── Separador vertical tenue entre columnas ──
  const sepTop = infoTop - 4

  // ── Columna CLIENTE ──
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.teal)
    .text('CLIENTE', xC, infoTop, { characterSpacing: 1.5 })

  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
    .text(data.client?.name || '—', xC, infoTop + 12, { width: colC })

  let cy = infoTop + 30
  ;[
    data.client?.company  ? ['Empresa',   data.client.company]  : null,
    data.client?.cuit     ? ['CUIT/CUIL', data.client.cuit]     : null,
    data.client?.phone    ? ['Teléfono',  data.client.phone]    : null,
    data.client?.email    ? ['Email',     data.client.email]    : null,
    data.client?.address  ? ['Dirección', data.client.address]  : null,
    data.client?.website  ? ['Web',       data.client.website]  : null,
  ].filter(Boolean).forEach(([lbl, val]) => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
      .text(lbl.toUpperCase(), xC, cy, { characterSpacing: 0.6 })
    doc.font('Helvetica').fontSize(9).fillColor(C.text)
      .text(val, xC, cy + 10, { width: colC })
    cy += 24
  })

  // ── Columna DETALLES DEL DOC ──
  const infoRows = isQuote
    ? [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        ['Moneda',       data.currency],
        data.project    ? ['Proyecto',     data.project.title]                              : null,
        validDays != null ? ['Válido por', `${validDays} día${validDays !== 1 ? 's' : ''}`] : null,
        data.validUntil ? ['Válido hasta', fmtDate(data.validUntil)]                        : null,
      ].filter(Boolean)
    : [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        ['Moneda',       data.currency],
        data.project  ? ['Proyecto',    data.project.title]    : null,
        data.dueDate  ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let ry = infoTop
  infoRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      .text(label.toUpperCase(), xDet, ry, { width: colD, characterSpacing: 0.6 })
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text)
      .text(String(value), xDet, ry + 10, { width: colD })
    ry += 26
  })

  // ── Columna EMISOR ──
  const org = data.organization || {}
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.teal)
    .text('EMISOR', xO, infoTop, { characterSpacing: 1.5 })

  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
    .text(org.name || '—', xO, infoTop + 12, { width: colO })

  let oy = infoTop + 30
  ;[
    org.cuit    ? ['CUIT/CUIL', org.cuit]    : null,
    org.phone   ? ['Teléfono',  org.phone]   : null,
    org.email   ? ['Email',     org.email]   : null,
    org.address ? ['Dirección', org.address] : null,
    org.website ? ['Web',       org.website] : null,
  ].filter(Boolean).forEach(([lbl, val]) => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
      .text(lbl.toUpperCase(), xO, oy, { characterSpacing: 0.6 })
    doc.font('Helvetica').fontSize(9).fillColor(C.text)
      .text(val, xO, oy + 10, { width: colO })
    oy += 24
  })

  // Separadores verticales entre columnas
  const sepBot = Math.max(cy, ry, oy) + 4
  doc.rect(xDet - colGap / 2, sepTop, 0.5, sepBot - sepTop).fillColor(C.border).fill()
  doc.rect(xO   - colGap / 2, sepTop, 0.5, sepBot - sepTop).fillColor(C.border).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // DIVIDER
  // ─────────────────────────────────────────────────────────────────────────
  const divY = sepBot + 16
  doc.rect(pad, divY, pageW - pad * 2, 1).fillColor(C.border).fill()
  // Teal accent dot on divider
  doc.rect(pad, divY - 1, 24, 3).fillColor(C.teal).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // ITEMS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  const tableTop = divY + 20
  const tableW   = pageW - pad * 2
  const cDesc    = tableW * 0.47
  const cQty     = tableW * 0.11
  const cUnit    = tableW * 0.21
  const cAmt     = tableW * 0.21

  const xD = pad
  const xQ = pad + cDesc
  const xU = pad + cDesc + cQty
  const xA = pad + cDesc + cQty + cUnit

  // Column headers — no background, just labels with teal underline
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
  doc.text('DESCRIPCIÓN',  xD + 2, tableTop, { width: cDesc - 4, characterSpacing: 0.8 })
  doc.text('CANT.',        xQ,     tableTop, { width: cQty,  align: 'right', characterSpacing: 0.8 })
  doc.text('PRECIO UNIT.', xU,     tableTop, { width: cUnit, align: 'right', characterSpacing: 0.8 })
  doc.text('TOTAL',        xA,     tableTop, { width: cAmt - 2, align: 'right', characterSpacing: 0.8 })

  // Teal underline under headers
  doc.rect(pad, tableTop + 14, tableW, 2).fillColor(C.teal).fill()

  let y = tableTop + 22
  const rowH = 26

  ;(data.items || []).forEach((item, i) => {
    // Subtle alternating bg
    if (i % 2 !== 0) {
      doc.rect(pad, y, tableW, rowH).fillColor(C.bg).fill()
    }

    doc.font('Helvetica').fontSize(9.5).fillColor(C.text)
      .text(item.description, xD + 2, y + 8, { width: cDesc - 6, ellipsis: true })

    doc.font('Helvetica').fontSize(9).fillColor(C.soft)
      .text(String(item.quantity), xQ, y + 8, { width: cQty, align: 'right' })
      .text(fmt(item.unitPrice),   xU, y + 8, { width: cUnit, align: 'right' })

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.text)
      .text(fmt(item.amount), xA, y + 8, { width: cAmt - 2, align: 'right' })

    // thin bottom border per row
    doc.rect(pad, y + rowH - 1, tableW, 0.5).fillColor(C.border).fill()

    y += rowH
  })

  // ─────────────────────────────────────────────────────────────────────────
  // NOTES
  // ─────────────────────────────────────────────────────────────────────────
  y += 20
  if (data.notes) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
      .text('NOTAS', pad, y, { characterSpacing: 1.5 })
    y += 14
    doc.font('Helvetica').fontSize(9).fillColor(C.soft)
      .text(data.notes, pad, y, { width: tableW * 0.6, lineGap: 3 })
    y = doc.y + 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUOTAS
  // ─────────────────────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    // Encabezado sección
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
      .text('PLAN DE CUOTAS', pad, y, { characterSpacing: 1.5 })
    y += 4
    doc.rect(pad, y + 10, tableW, 1.5).fillColor(C.teal).fill()
    y += 16

    // Cabeceras de columna
    const cNum  = tableW * 0.10
    const cDue  = tableW * 0.35
    const cStat = tableW * 0.30
    const cAmt  = tableW * 0.25

    const iNum  = pad
    const iDue  = iNum + cNum
    const iStat = iDue + cDue
    const iAmt  = iStat + cStat

    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.muted)
    doc.text('N°',         iNum,  y, { width: cNum,  characterSpacing: 0.6 })
    doc.text('VENCIMIENTO',iDue,  y, { width: cDue,  characterSpacing: 0.6 })
    doc.text('ESTADO',     iStat, y, { width: cStat, characterSpacing: 0.6 })
    doc.text('IMPORTE',    iAmt,  y, { width: cAmt - 2, align: 'right', characterSpacing: 0.6 })
    y += 14

    const STATUS_INST = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
    const STATUS_COLOR_INST = { pending: C.muted, paid: C.teal, overdue: '#ef4444' }

    installments.forEach((inst, i) => {
      const rowH = 20
      if (i % 2 !== 0) {
        doc.rect(pad, y, tableW, rowH).fillColor(C.bg).fill()
      }

      const statLabel = STATUS_INST[inst.status] || inst.status
      const statColor = STATUS_COLOR_INST[inst.status] || C.muted

      doc.font('Helvetica').fontSize(8.5).fillColor(C.soft)
        .text(String(inst.number),        iNum,  y + 5, { width: cNum })
        .text(fmtDate(inst.dueDate),      iDue,  y + 5, { width: cDue })
      doc.font('Helvetica').fontSize(8.5).fillColor(statColor)
        .text(statLabel,                  iStat, y + 5, { width: cStat })
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text)
        .text(fmt(inst.amount, data.currency), iAmt, y + 5, { width: cAmt - 2, align: 'right' })

      doc.rect(pad, y + rowH - 0.5, tableW, 0.5).fillColor(C.border).fill()
      y += rowH
    })

    y += 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALS
  // ─────────────────────────────────────────────────────────────────────────
  const subtotal  = Number(data.subtotal)
  const total     = Number(data.total)
  const taxAmount = total - subtotal

  const totW = tableW
  const totX = pad

  // helper: label izq + valor der, sin columnas fijas
  function totRow(label, value, labelColor, valueColor, fontSize) {
    doc.font('Helvetica').fontSize(fontSize).fillColor(labelColor)
      .text(label, totX, y, { width: totW, align: 'left' })
    doc.font('Helvetica').fontSize(fontSize).fillColor(valueColor)
      .text(value, totX, y, { width: totW, align: 'right' })
    y += fontSize + 10
  }

  // Thin top line
  doc.rect(totX, y, totW, 0.5).fillColor(C.border).fill()
  y += 14

  // Subtotal
  totRow('Subtotal', fmt(subtotal), C.soft, C.text, 9)

  // IVA
  if (data.taxRate > 0) {
    totRow(`IVA (${data.taxRate}%)`, fmt(taxAmount), C.soft, C.text, 9)
  }

  y += 6

  // Total band — label arriba, monto abajo (evita overflow horizontal)
  const totalH = 56
  doc.rect(totX, y, totW, totalH).fillColor(C.dark).fill()
  doc.rect(totX, y, 5, totalH).fillColor(C.teal).fill()

  doc.font('Helvetica').fontSize(7.5).fillColor(C.teal)
    .text(`TOTAL ${data.currency}`, totX + 14, y + 10, { width: totW - 20, align: 'right', characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
    .text(fmt(total, data.currency), totX + 14, y + 24, { width: totW - 20, align: 'right' })

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  doc.rect(0, pageH - 40, pageW, 40).fillColor(C.bg).fill()
  doc.rect(0, pageH - 40, pageW, 1).fillColor(C.border).fill()
  doc.rect(0, pageH - 40, 5, 40).fillColor(C.teal).fill()

  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
    .text(
      `${org.name || ''}  ·  ${docLabel} ${docPrefix}-${numStr}`,
      pad, pageH - 24,
      { width: pageW - pad * 2, align: 'center' }
    )

  doc.end()
  return doc
}
