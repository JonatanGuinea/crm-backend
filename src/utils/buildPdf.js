import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LOGO_PATH       = join(__dirname, '../assets/logo.png')
const DEFAULT_LOGO_LIGHT_PATH = join(__dirname, '../assets/logo-light.png')
const UPLOADS_DIR = join(__dirname, '../../uploads')

const C = {
  slate800:  '#1e293b',
  slate700:  '#334155',
  slate400:  '#94a3b8',
  slate300:  '#cbd5e1',
  zinc50:    '#f8fafc',
  zinc100:   '#f1f5f9',
  zinc400:   '#94a3b8',
  zinc500:   '#64748b',
  zinc600:   '#475569',
  zinc800:   '#1e293b',
  white:     '#ffffff',
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

  const validDays = (isQuote && data.validUntil && data.createdAt)
    ? Math.round((new Date(data.validUntil) - new Date(data.createdAt)) / (1000 * 60 * 60 * 24))
    : null

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER — slate-800 band
  // ─────────────────────────────────────────────────────────────────────────
  const headerH = 110
  doc.rect(0, 0, pageW, headerH).fillColor(C.slate800).fill()

  const org = data.organization || {}
  const numStr = String(data.number).padStart(3, '0')

  // Left: org logo (si existe y es PNG/JPEG) + doc label + title
  const _rawLogoFile = data.organization?.logo || ''
  const _logoExt = _rawLogoFile.split('.').pop()?.toLowerCase()
  const _logoSupported = ['png', 'jpg', 'jpeg'].includes(_logoExt)
  const orgLogoHeaderPath = _logoSupported ? join(UPLOADS_DIR, _rawLogoFile) : null
  if (orgLogoHeaderPath && existsSync(orgLogoHeaderPath)) {
    doc.image(orgLogoHeaderPath, pad, 18, { height: 36, fit: [150, 36] })
    doc.font('Helvetica').fontSize(8).fillColor(C.slate400)
      .text(docLabel.toUpperCase(), pad, 62, { characterSpacing: 1.5 })
    if (data.title) {
      doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
        .text(data.title, pad, 75, { width: pageW - pad * 2 - 185 })
    }
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(C.slate400)
      .text(docLabel.toUpperCase(), pad, 22, { characterSpacing: 1.5 })
    if (data.title) {
      doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white)
        .text(data.title, pad, 35, { width: pageW - pad * 2 - 185 })
    }
  }

  // Right: EMISOR info (nombre grande + datos pequeños)
  const eX = pageW - pad - 175
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
    .text(org.name || '—', eX, 18, { width: 175, align: 'right' })
  let ey = 36
  ;[
    org.cuit    ? `CUIL/CUIT: ${org.cuit}` : null,
    org.email   ? org.email                : null,
    org.phone   ? org.phone                : null,
    org.address ? org.address              : null,
    org.website ? org.website              : null,
  ].filter(Boolean).forEach(val => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.slate400)
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

  // ── Cliente ──
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
    .text('CLIENTE', xL, infoTop, { characterSpacing: 1.5 })

  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.zinc800)
    .text(data.client?.name || '—', xL, infoTop + 13, { width: colL })

  let cy = infoTop + 32
  ;[
    data.client?.company  ? data.client.company               : null,
    data.client?.cuit     ? `CUIL/CUIT: ${data.client.cuit}`  : null,
    data.client?.email    ? data.client.email                  : null,
    data.client?.phone    ? data.client.phone                  : null,
    data.client?.address  ? data.client.address                : null,
  ].filter(Boolean).forEach(val => {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.zinc500)
      .text(val, xL, cy, { width: colL })
    cy += 14
  })

  // ── Detalle ──
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
    .text('DETALLE', xR, infoTop, { characterSpacing: 1.5 })
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
    .text(`${docLabel.toUpperCase()} #${numStr}`, xR, infoTop + 13, { width: colR, characterSpacing: 0.8 })

  const infoRows = isQuote
    ? [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        data.project     ? ['Proyecto',     data.project.title]                              : null,
        validDays != null ? ['Válido por',  `${validDays} día${validDays !== 1 ? 's' : ''}`] : null,
        data.validUntil  ? ['Válido hasta', fmtDate(data.validUntil)]                        : null,
      ].filter(Boolean)
    : [
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        ['Estado',       STATUS_LABELS[data.status] || data.status],
        data.project  ? ['Proyecto',    data.project.title]    : null,
        data.dueDate  ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let ry = infoTop + 26
  infoRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(8).fillColor(C.zinc400)
      .text(label, xR, ry, { width: 80 })
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc800)
      .text(String(value), xR + 82, ry, { width: colR - 82 })
    ry += 14
  })

  // Separator between info columns
  const sepBot = Math.max(cy, ry) + 8
  doc.rect(xR - colGap / 2, infoTop, 0.5, sepBot - infoTop).fillColor(C.zinc100).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // ITEMS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  const tableTop = sepBot + 16
  const cDesc = tableW * 0.47
  const cQty  = tableW * 0.11
  const cUnit = tableW * 0.21
  const cAmt  = tableW * 0.21

  const xD = pad
  const xQ = pad + cDesc
  const xU = pad + cDesc + cQty
  const xA = pad + cDesc + cQty + cUnit

  // Header row — slate-800 bg + white text
  const thH = 28
  doc.rect(pad, tableTop, tableW, thH).fillColor(C.slate800).fill()
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
  doc.text('DESCRIPCIÓN',  xD + 6,  tableTop + 9, { width: cDesc - 10, characterSpacing: 0.6 })
  doc.text('CANT.',        xQ,      tableTop + 9, { width: cQty,  align: 'right', characterSpacing: 0.6 })
  doc.text('PRECIO UNIT.', xU,      tableTop + 9, { width: cUnit, align: 'right', characterSpacing: 0.6 })
  doc.text('TOTAL',        xA,      tableTop + 9, { width: cAmt - 6, align: 'right', characterSpacing: 0.6 })

  let y = tableTop + thH
  const rowH = 26

  ;(data.items || []).forEach((item, i) => {
    if (i % 2 !== 0) {
      doc.rect(pad, y, tableW, rowH).fillColor(C.zinc50).fill()
    }
    doc.font('Helvetica').fontSize(9.5).fillColor(C.zinc800)
      .text(item.description, xD + 6, y + 8, { width: cDesc - 10, ellipsis: true })
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
      .text(String(item.quantity), xQ, y + 8, { width: cQty, align: 'right' })
      .text(fmt(item.unitPrice),   xU, y + 8, { width: cUnit, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.zinc800)
      .text(fmt(item.amount), xA, y + 8, { width: cAmt - 6, align: 'right' })
    doc.rect(pad, y + rowH - 0.5, tableW, 0.5).fillColor(C.zinc100).fill()
    y += rowH
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALS — right-aligned block, max ~220px
  // ─────────────────────────────────────────────────────────────────────────
  y += 16

  const subtotal  = Number(data.subtotal)
  const total     = Number(data.total)
  const taxAmount = total - subtotal

  const totBlockW = 220
  const totX = pageW - pad - totBlockW

  // Subtotal
  doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
    .text('Subtotal', totX, y)
    .text(fmt(subtotal), totX, y, { width: totBlockW, align: 'right' })
  y += 18

  // IVA
  if (data.taxRate > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
      .text(`IVA (${data.taxRate}%)`, totX, y)
      .text(fmt(taxAmount), totX, y, { width: totBlockW, align: 'right' })
    y += 18
  }

  y += 4

  // Total band
  const totalH = 44
  doc.rect(totX, y, totBlockW, totalH).fillColor(C.slate800).fill()
  doc.font('Helvetica').fontSize(7.5).fillColor(C.slate400)
    .text(`TOTAL ${data.currency}`, totX + 12, y + 8, { width: totBlockW - 20, align: 'left', characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white)
    .text(fmt(total, data.currency), totX + 12, y + 20, { width: totBlockW - 20, align: 'right' })

  y += totalH + 24

  // ─────────────────────────────────────────────────────────────────────────
  // CUOTAS
  // ─────────────────────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.zinc400)
      .text('PLAN DE CUOTAS', pad, y, { characterSpacing: 1.5 })
    y += 14

    const cNum  = tableW * 0.10
    const cDue  = tableW * 0.35
    const cStat = tableW * 0.30
    const cIA   = tableW * 0.25

    const iNum  = pad
    const iDue  = iNum + cNum
    const iStat = iDue + cDue
    const iAmt  = iStat + cStat

    // Cuotas header
    const ithH = 24
    doc.rect(pad, y, tableW, ithH).fillColor(C.slate800).fill()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white)
    doc.text('N°',          iNum,       y + 8, { width: cNum,      characterSpacing: 0.6 })
    doc.text('VENCIMIENTO', iDue,       y + 8, { width: cDue,      characterSpacing: 0.6 })
    doc.text('ESTADO',      iStat,      y + 8, { width: cStat,     characterSpacing: 0.6 })
    doc.text('IMPORTE',     iAmt,       y + 8, { width: cIA - 6,   align: 'right', characterSpacing: 0.6 })
    y += ithH

    const STATUS_INST = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
    const STATUS_COLOR_INST = { pending: C.zinc400, paid: '#10b981', overdue: '#ef4444' }

    installments.forEach((inst, i) => {
      const rH = 20
      if (i % 2 !== 0) {
        doc.rect(pad, y, tableW, rH).fillColor(C.zinc50).fill()
      }
      const statLabel = STATUS_INST[inst.status] || inst.status
      const statColor = STATUS_COLOR_INST[inst.status] || C.zinc400

      doc.font('Helvetica').fontSize(8.5).fillColor(C.zinc500)
        .text(String(inst.number),        iNum,  y + 5, { width: cNum })
        .text(fmtDate(inst.dueDate),      iDue,  y + 5, { width: cDue })
      doc.font('Helvetica').fontSize(8.5).fillColor(statColor)
        .text(statLabel,                  iStat, y + 5, { width: cStat })
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc800)
        .text(fmt(inst.amount, data.currency), iAmt, y + 5, { width: cIA - 6, align: 'right' })

      doc.rect(pad, y + rH - 0.5, tableW, 0.5).fillColor(C.zinc100).fill()
      y += rH
    })

    y += 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTES
  // ─────────────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.rect(pad, y, tableW, 0.5).fillColor(C.zinc100).fill()
    y += 16
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.zinc400)
      .text('ALCANCE / NOTAS', pad, y, { characterSpacing: 1.5 })
    y += 14
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc600)
      .text(data.notes, pad, y, { width: tableW * 0.65, lineGap: 4 })
    y = doc.y + 20
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  const footerH = 48
  doc.rect(0, pageH - footerH, pageW, footerH).fillColor(C.slate800).fill()

  // Logo centrado — logo con letras negras (contrasta con fondo blanco del footer)
  const logoPath = existsSync(DEFAULT_LOGO_LIGHT_PATH) ? DEFAULT_LOGO_LIGHT_PATH : DEFAULT_LOGO_PATH
  const logoH = 20
  const logoW = 80
  const logoX = (pageW - logoW) / 2
  doc.image(logoPath, logoX, pageH - footerH + (footerH - logoH) / 2 - 6, { height: logoH, fit: [logoW, logoH] })

  // Texto debajo del logo
  doc.font('Helvetica').fontSize(7).fillColor(C.slate400)
    .text(
      `${org.name || ''}  ·  ${docLabel} #${numStr}`,
      pad, pageH - 14,
      { width: pageW - pad * 2, align: 'center' }
    )

  doc.end()
  return doc
}
