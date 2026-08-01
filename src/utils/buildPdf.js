import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LOGO_PATH       = join(__dirname, '../assets/logo.png')
const DEFAULT_LOGO_LIGHT_PATH = join(__dirname, '../assets/logo-light.png')
const UPLOADS_DIR = join(__dirname, '../../uploads')

const C = {
  dark900:   '#0f172a',
  dark800:   '#1e293b',
  dark700:   '#334155',
  ink800:    '#1e293b',
  ink600:    '#475569',
  ink500:    '#64748b',
  ink400:    '#94a3b8',
  ink300:    '#cbd5e1',
  rowAlt:    '#f8fafc',
  rowBorder: '#f1f5f9',
  white:     '#ffffff',
  success:   '#10b981',
  danger:    '#ef4444',
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

function drawSectionLabel(doc, label, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.ink400)
    .text(label, x, y, { characterSpacing: 1.5 })
  const labelW = doc.widthOfString(label) + 8
  doc.rect(x + labelW, y + 5, width - labelW, 0.5).fillColor(C.rowBorder).fill()
}

export function buildPdf(type, data) {
  const doc = new PDFDocument({ margin: 0, size: 'A4' })

  const isQuote   = type === 'quote'
  const docLabel  = isQuote ? 'Presupuesto' : 'Factura'
  const pageW     = doc.page.width   // 595
  const pageH     = doc.page.height  // 842
  const pad       = 52

  const validDays = (isQuote && data.validUntil && data.createdAt)
    ? Math.round((new Date(data.validUntil) - new Date(data.createdAt)) / (1000 * 60 * 60 * 24))
    : null

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER — gradient dark band
  // ─────────────────────────────────────────────────────────────────────────
  const headerH = 114

  const grad = doc.linearGradient(0, 0, pageW, headerH)
  grad.stop(0, C.dark900)
  grad.stop(1, C.dark700)
  doc.rect(0, 0, pageW, headerH).fill(grad)

  // Left accent stripe
  doc.rect(0, 0, 4, headerH).fillColor(C.ink300).fill()

  const org    = data.organization || {}
  const numStr = String(data.number).padStart(3, '0')

  // Org logo or name
  const _rawLogoFile   = org.logo || ''
  const _logoExt       = _rawLogoFile.split('.').pop()?.toLowerCase()
  const _logoSupported = ['png', 'jpg', 'jpeg'].includes(_logoExt)
  const orgLogoPath    = _logoSupported ? join(UPLOADS_DIR, _rawLogoFile) : null

  let logoBottomY = 18
  if (orgLogoPath && existsSync(orgLogoPath)) {
    doc.image(orgLogoPath, pad, 16, { height: 28, fit: [140, 28] })
    logoBottomY = 48
  } else {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink300)
      .text(org.name || '', pad, 18, { width: pageW - pad * 2 - 195 })
    logoBottomY = 32
  }

  // Doc type label + title
  doc.font('Helvetica').fontSize(7).fillColor(C.ink400)
    .text(docLabel.toUpperCase(), pad, logoBottomY, { characterSpacing: 1.8 })
  if (data.title) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white)
      .text(data.title, pad, logoBottomY + 12, { width: pageW - pad * 2 - 195 })
  }

  // Right: doc number (large) + contact info
  const eX = pageW - pad - 175
  let ey = 16

  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
    .text(`#${numStr}`, eX, ey, { width: 175, align: 'right' })
  ey += 30

  ;[
    org.cuit    ? `CUIL/CUIT: ${org.cuit}` : null,
    org.email   ? org.email                : null,
    org.phone   ? org.phone                : null,
    org.address ? org.address              : null,
    org.website ? org.website              : null,
  ].filter(Boolean).forEach(val => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.ink400)
      .text(val, eX, ey, { width: 175, align: 'right' })
    ey += 12
  })

  // ─────────────────────────────────────────────────────────────────────────
  // INFO SECTION — 2 columns: CLIENTE | DETALLE
  // ─────────────────────────────────────────────────────────────────────────
  const infoTop = headerH + 24
  const tableW  = pageW - pad * 2
  const colGap  = 20
  const colL    = Math.floor(tableW * 0.50)
  const colR    = tableW - colL - colGap

  const xL = pad
  const xR = pad + colL + colGap

  // Cliente
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.ink400)
    .text('CLIENTE', xL, infoTop, { characterSpacing: 1.5 })
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink800)
    .text(data.client?.name || '—', xL, infoTop + 13, { width: colL })

  let cy = infoTop + 32
  ;[
    data.client?.company  ? data.client.company               : null,
    data.client?.cuit     ? `CUIL/CUIT: ${data.client.cuit}`  : null,
    data.client?.email    ? data.client.email                  : null,
    data.client?.phone    ? data.client.phone                  : null,
    data.client?.address  ? data.client.address                : null,
  ].filter(Boolean).forEach(val => {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.ink500)
      .text(val, xL, cy, { width: colL })
    cy += 14
  })

  // Detalle
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.ink400)
    .text('DETALLE', xR, infoTop, { characterSpacing: 1.5 })

  const infoRows = isQuote
    ? [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        data.project      ? ['Proyecto',     data.project.title]                              : null,
        validDays != null ? ['Válido por',   `${validDays} día${validDays !== 1 ? 's' : ''}`] : null,
        data.validUntil   ? ['Válido hasta', fmtDate(data.validUntil)]                        : null,
      ].filter(Boolean)
    : [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        data.project  ? ['Proyecto',    data.project.title]    : null,
        data.dueDate  ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let ry = infoTop + 13
  infoRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(8).fillColor(C.ink400)
      .text(label, xR, ry, { width: 80 })
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.ink800)
      .text(String(value), xR + 82, ry, { width: colR - 82 })
    ry += 14
  })

  // Column separator
  const sepBot = Math.max(cy, ry) + 8
  doc.rect(xR - colGap / 2, infoTop, 0.5, sepBot - infoTop).fillColor(C.rowBorder).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // ITEMS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  let y = sepBot + 16

  drawSectionLabel(doc, 'ÍTEMS', pad, y, tableW)
  y += 18

  const cDesc = tableW * 0.47
  const cQty  = tableW * 0.11
  const cUnit = tableW * 0.21
  const cAmt  = tableW * 0.21

  const xD = pad
  const xQ = pad + cDesc
  const xU = pad + cDesc + cQty
  const xA = pad + cDesc + cQty + cUnit

  const thH = 26
  doc.roundedRect(pad, y, tableW, thH, 5).fillColor(C.dark800).fill()
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
  doc.text('DESCRIPCIÓN',  xD + 6,  y + 9, { width: cDesc - 10, characterSpacing: 0.5 })
  doc.text('CANT.',        xQ,      y + 9, { width: cQty,  align: 'right', characterSpacing: 0.5 })
  doc.text('PRECIO UNIT.', xU,      y + 9, { width: cUnit, align: 'right', characterSpacing: 0.5 })
  doc.text('TOTAL',        xA,      y + 9, { width: cAmt - 6, align: 'right', characterSpacing: 0.5 })
  y += thH

  const rowH = 26
  ;(data.items || []).forEach((item, i) => {
    if (i % 2 !== 0) {
      doc.rect(pad, y, tableW, rowH).fillColor(C.rowAlt).fill()
    }
    doc.font('Helvetica').fontSize(9.5).fillColor(C.ink800)
      .text(item.description, xD + 6, y + 8, { width: cDesc - 10, ellipsis: true })
    doc.font('Helvetica').fontSize(9).fillColor(C.ink500)
      .text(String(item.quantity), xQ, y + 8, { width: cQty, align: 'right' })
      .text(fmt(item.unitPrice),   xU, y + 8, { width: cUnit, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.ink800)
      .text(fmt(item.amount), xA, y + 8, { width: cAmt - 6, align: 'right' })
    doc.rect(pad, y + rowH - 0.5, tableW, 0.5).fillColor(C.rowBorder).fill()
    y += rowH
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALS
  // ─────────────────────────────────────────────────────────────────────────
  y += 16

  const subtotal  = Number(data.subtotal)
  const total     = Number(data.total)
  const taxAmount = total - subtotal

  const totBlockW = 220
  const totX = pageW - pad - totBlockW

  doc.font('Helvetica').fontSize(9).fillColor(C.ink500)
    .text('Subtotal', totX, y)
    .text(fmt(subtotal), totX, y, { width: totBlockW, align: 'right' })
  y += 18

  if (data.taxRate > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.ink500)
      .text(`IVA (${data.taxRate}%)`, totX, y)
      .text(fmt(taxAmount), totX, y, { width: totBlockW, align: 'right' })
    y += 18
  }

  y += 4

  // Total band — gradient
  const totalH = 46
  const totGrad = doc.linearGradient(totX, y, totX + totBlockW, y + totalH)
  totGrad.stop(0, C.dark900)
  totGrad.stop(1, C.dark700)
  doc.roundedRect(totX, y, totBlockW, totalH, 6).fill(totGrad)
  doc.font('Helvetica').fontSize(7).fillColor(C.ink400)
    .text(`TOTAL ${data.currency}`, totX + 12, y + 9, { characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(19).fillColor(C.white)
    .text(fmt(total, data.currency), totX + 12, y + 21, { width: totBlockW - 20, align: 'right' })

  y += totalH + 28

  // ─────────────────────────────────────────────────────────────────────────
  // CUOTAS
  // ─────────────────────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    drawSectionLabel(doc, 'PLAN DE PAGOS', pad, y, tableW)
    y += 18

    const cNum  = tableW * 0.10
    const cDue  = tableW * 0.35
    const cStat = tableW * 0.30
    const cIA   = tableW * 0.25

    const iNum  = pad
    const iDue  = iNum + cNum
    const iStat = iDue + cDue
    const iAmt  = iStat + cStat

    const ithH = 26
    doc.roundedRect(pad, y, tableW, ithH, 5).fillColor(C.dark800).fill()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white)
    doc.text('N°',          iNum,  y + 9, { width: cNum,    characterSpacing: 0.5 })
    doc.text('VENCIMIENTO', iDue,  y + 9, { width: cDue,    characterSpacing: 0.5 })
    doc.text('ESTADO',      iStat, y + 9, { width: cStat,   characterSpacing: 0.5 })
    doc.text('IMPORTE',     iAmt,  y + 9, { width: cIA - 6, align: 'right', characterSpacing: 0.5 })
    y += ithH

    const STATUS_INST       = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
    const STATUS_COLOR_INST = { pending: C.ink400, paid: C.success, overdue: C.danger }

    installments.forEach((inst, i) => {
      const rH = 20
      if (i % 2 !== 0) {
        doc.rect(pad, y, tableW, rH).fillColor(C.rowAlt).fill()
      }
      const statLabel = STATUS_INST[inst.status]       || inst.status
      const statColor = STATUS_COLOR_INST[inst.status] || C.ink400

      doc.font('Helvetica').fontSize(8.5).fillColor(C.ink500)
        .text(String(inst.number),   iNum,  y + 5, { width: cNum })
        .text(fmtDate(inst.dueDate), iDue,  y + 5, { width: cDue })
      doc.font('Helvetica').fontSize(8.5).fillColor(statColor)
        .text(statLabel,             iStat, y + 5, { width: cStat })
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.ink800)
        .text(fmt(inst.amount, data.currency), iAmt, y + 5, { width: cIA - 6, align: 'right' })

      doc.rect(pad, y + rH - 0.5, tableW, 0.5).fillColor(C.rowBorder).fill()
      y += rH
    })

    y += 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTES
  // ─────────────────────────────────────────────────────────────────────────
  if (data.notes) {
    drawSectionLabel(doc, 'NOTAS', pad, y, tableW)
    y += 18
    doc.font('Helvetica').fontSize(9).fillColor(C.ink600)
      .text(data.notes, pad, y, { width: tableW * 0.65, lineGap: 4 })
    y = doc.y + 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  const footerH = 48
  const footGrad = doc.linearGradient(0, pageH - footerH, pageW, pageH)
  footGrad.stop(0, C.dark900)
  footGrad.stop(1, C.dark700)
  doc.rect(0, pageH - footerH, pageW, footerH).fill(footGrad)

  // Thin separator line at footer top
  doc.rect(0, pageH - footerH, pageW, 1).fillColor(C.ink300).fill()

  const logoPath = existsSync(DEFAULT_LOGO_LIGHT_PATH) ? DEFAULT_LOGO_LIGHT_PATH : DEFAULT_LOGO_PATH
  const logoH = 20
  const logoW = 80
  const logoX = (pageW - logoW) / 2
  doc.image(logoPath, logoX, pageH - footerH + (footerH - logoH) / 2 - 6, { height: logoH, fit: [logoW, logoH] })

  doc.font('Helvetica').fontSize(7).fillColor(C.ink400)
    .text(
      `${org.name || ''}  ·  ${docLabel} #${numStr}`,
      pad, pageH - 14,
      { width: pageW - pad * 2, align: 'center' }
    )

  doc.end()
  return doc
}
