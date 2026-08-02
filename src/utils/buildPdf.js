import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../uploads')

// ── Colores exactos de QuotePublicPage.jsx ────────────────────────────────
const C = {
  // Header gradient: from-slate-900 via-slate-800 to-slate-700
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  // Texto en header
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  // Texto en body
  zinc800: '#27272a',
  zinc700: '#3f3f46',
  zinc600: '#52525b',
  zinc500: '#71717a',
  zinc400: '#a1a1aa',
  // Fondos y bordes
  zinc50:  '#fafafa',   // alt rows, section label bg
  zinc100: '#f4f4f5',   // divide-y, row separators
  zinc200: '#e4e4e7',   // borders, section rule line
  white:   '#ffffff',
  // Badges de estado de cuotas (modo claro)
  pendingBg:   '#f4f4f5', pendingText: '#71717a',  // bg-zinc-100 text-zinc-500
  paidBg:      '#d1fae5', paidText:    '#047857',  // bg-emerald-100 text-emerald-700
  overdueBg:   '#fee2e2', overdueText: '#dc2626',  // bg-red-100 text-red-600
}


const fmt = (n, cur = '') => {
  const sym = cur === 'USD' ? 'US$' : '$'
  return `${sym}${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—'

export function buildPdf(type, data) {
  const doc    = new PDFDocument({ margin: 0, size: 'A4' })
  const isQuote = type === 'quote'
  const docLabel = isQuote ? 'Presupuesto' : 'Factura'
  const pageW  = doc.page.width   // 595
  const pageH  = doc.page.height  // 842
  const pad    = 52               // margen horizontal (≈ px-7 escalado)
  const tableW = pageW - pad * 2  // 491

  // ── Helpers ───────────────────────────────────────────────────────────────

  // SectionLabel: fondo zinc-50, borde superior zinc-100, texto + línea horizontal
  // Retorna la nueva posición Y
  function sectionLabel(label, y) {
    const h = 24
    doc.rect(0, y, pageW, h).fillColor(C.zinc50).fill()
    doc.rect(0, y, pageW, 0.5).fillColor(C.zinc100).fill()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
      .text(label.toUpperCase(), pad, y + 9, { characterSpacing: 1.5 })
    const endX = pad + doc.widthOfString(label.toUpperCase()) + 10
    doc.rect(endX, y + 12, pageW - pad - endX, 0.5).fillColor(C.zinc200).fill()
    return y + h
  }

  // Badge de estado para las cuotas (rounded-full, text-xs)
  function statusBadge(label, x, y, bgColor, textColor) {
    doc.font('Helvetica').fontSize(7.5)
    const tw = doc.widthOfString(label)
    const bw = tw + 10
    const bh = 13
    doc.roundedRect(x, y, bw, bh, bh / 2).fillColor(bgColor).fill()
    doc.fillColor(textColor).text(label, x + 5, y + 3, { width: tw })
  }

  // ── Datos ─────────────────────────────────────────────────────────────────
  const org    = data.organization || {}
  const numStr = String(data.number).padStart(3, '0')

  const validDays = (isQuote && data.validUntil && data.createdAt)
    ? Math.round((new Date(data.validUntil) - new Date(data.createdAt)) / (1000 * 60 * 60 * 24))
    : null

  const _ext      = (org.logo || '').split('.').pop()?.toLowerCase()
  const orgLogoPath = ['png', 'jpg', 'jpeg'].includes(_ext) ? join(UPLOADS_DIR, org.logo) : null
  const hasLogo     = orgLogoPath && existsSync(orgLogoPath)

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER — bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700
  // px-7 py-6 | izquierda: logo/nombre + label + título | derecha: #001 + pill + contacto
  // ─────────────────────────────────────────────────────────────────────────
  const headerH = 130

  const hg = doc.linearGradient(0, 0, pageW, headerH)
  hg.stop(0, C.slate900).stop(0.5, C.slate800).stop(1, C.slate700)
  doc.rect(0, 0, pageW, headerH).fill(hg)

  // Lado izquierdo
  const leftMaxW = pageW - pad * 2 - 190
  let leftY = 18

  if (hasLogo) {
    doc.image(orgLogoPath, pad, leftY, { height: 48, fit: [200, 48] })
    leftY += 58
  } else {
    // text-slate-300 font-semibold text-sm
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.slate300)
      .text(org.name || '', pad, leftY, { width: leftMaxW })
    leftY += 16
  }

  // "PRESUPUESTO" — text-xs uppercase tracking-[0.18em] text-slate-400
  doc.font('Helvetica').fontSize(7).fillColor(C.slate400)
    .text(docLabel.toUpperCase(), pad, leftY, { characterSpacing: 1.8 })
  leftY += 12

  // Título — text-xl font-bold text-white
  if (data.title) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
      .text(data.title, pad, leftY, { width: leftMaxW })
  }

  // Lado derecho
  const rw = 175
  const rx = pageW - pad - rw
  let ry   = 18

  // #001 — text-3xl font-bold text-white
  doc.font('Helvetica-Bold').fontSize(22).fillColor(C.white)
    .text(`#${numStr}`, rx, ry, { width: rw, align: 'right' })
  ry += 34

  // Nombre de org debajo del número (si hay logo)
  if (hasLogo) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.slate300)
      .text(org.name || '', rx, ry, { width: rw, align: 'right' })
    ry += 12
  }

  // Contacto — text-xs text-slate-400
  ;[
    org.cuit    ? `CUIL/CUIT: ${org.cuit}` : null,
    org.email   ? org.email                : null,
    org.phone   ? org.phone                : null,
    org.address ? org.address              : null,
    (org.city || org.province) ? [org.city, org.province].filter(Boolean).join(', ') + (org.postalCode ? ` (${org.postalCode})` : '') : null,
    org.website ? org.website              : null,
  ].filter(Boolean).forEach(v => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.slate400)
      .text(v, rx, ry, { width: rw, align: 'right' })
    ry += 12
  })

  // ─────────────────────────────────────────────────────────────────────────
  // INFO — grid cols-2, border-b border-zinc-100
  // Izquierda: CLIENTE | Derecha: DETALLE
  // ─────────────────────────────────────────────────────────────────────────
  const infoTop  = headerH
  const infoPadY = 15   // py-5 escalado
  const colGap   = 16
  const colL     = Math.floor(tableW * 0.50)
  const colR     = tableW - colL - colGap
  const xL       = pad
  const xR       = pad + colL + colGap

  // CLIENTE
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
    .text('CLIENTE', xL, infoTop + infoPadY, { characterSpacing: 1.5 })
  // nombre: font-semibold text-zinc-800 text-base
  const clientName    = data.client?.name    || data.potentialClientName    || '—'
  const clientCompany = data.client?.company || data.potentialClientCompany || null
  const clientEmail   = data.client?.email   || data.potentialClientEmail   || null

  let cy = infoTop + infoPadY + 12
  if (clientCompany) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.zinc800)
      .text(clientCompany, xL, cy, { width: colL })
    cy += 18
    doc.font('Helvetica').fontSize(9.5).fillColor(C.zinc500)
      .text(clientName, xL, cy, { width: colL })
    cy += 14
  } else {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.zinc800)
      .text(clientName, xL, cy, { width: colL })
    cy += 18
  }

  ;[
    data.client?.cuit    ? `CUIL/CUIT: ${data.client.cuit}` : null,
    clientEmail,
    data.client?.phone   ? data.client.phone   : null,
    data.client?.address ? data.client.address : null,
    (data.client?.city || data.client?.province) ? [data.client.city, data.client.province].filter(Boolean).join(', ') + (data.client.postalCode ? ` (${data.client.postalCode})` : '') : null,
  ].filter(Boolean).forEach(v => {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.zinc500).text(v, xL, cy, { width: colL })
    cy += 13
  })

  // DETALLE
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.zinc400)
    .text('DETALLE', xR, infoTop + infoPadY, { characterSpacing: 1.5 })

  const infoRows = isQuote
    ? [
        ['Número',       `#${numStr}`],
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        data.project      ? ['Proyecto',     data.project.title]                               : null,
        validDays != null ? ['Válido por',   `${validDays} día${validDays !== 1 ? 's' : ''}`]  : null,
        data.validUntil   ? ['Válido hasta', fmtDate(data.validUntil)]                         : null,
      ].filter(Boolean)
    : [
        ['Número',       `#${numStr}`],
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        data.project  ? ['Proyecto',    data.project.title]    : null,
        data.dueDate  ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let ry2 = infoTop + infoPadY + 12
  infoRows.forEach(([label, value]) => {
    // label: text-zinc-400 w-24 (text-sm)
    doc.font('Helvetica').fontSize(8).fillColor(C.zinc400).text(label, xR, ry2, { width: 78 })
    // value: font-medium text-zinc-700
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc700)
      .text(String(value), xR + 80, ry2, { width: colR - 80 })
    ry2 += 14
  })

  // Separador vertical entre columnas: sm:border-r border-zinc-100
  const infoBot = Math.max(cy, ry2) + infoPadY
  doc.rect(xR - colGap / 2, infoTop + infoPadY, 0.5, infoBot - infoTop - infoPadY * 1.5)
    .fillColor(C.zinc100).fill()

  // Borde inferior de info: border-b border-zinc-100
  doc.rect(0, infoBot, pageW, 0.5).fillColor(C.zinc100).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // ÍTEMS — SectionLabel + tabla con header claro
  // ─────────────────────────────────────────────────────────────────────────
  let y = sectionLabel('Ítems', infoBot)

  const cDesc = tableW * 0.47
  const cQty  = tableW * 0.11
  const cUnit = tableW * 0.21
  const cAmt  = tableW * 0.21
  const xD = pad,  xQ = pad + cDesc,  xU = pad + cDesc + cQty,  xA = pad + cDesc + cQty + cUnit

  // Header: bg-zinc-50 border-b border-zinc-200, th: text-xs font-semibold text-zinc-500 uppercase
  const thH = 26
  doc.rect(0, y, pageW, thH).fillColor(C.zinc50).fill()
  doc.rect(0, y + thH - 0.5, pageW, 0.5).fillColor(C.zinc200).fill()
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.zinc500)
  doc.text('DESCRIPCIÓN',  xD + 4, y + 9, { width: cDesc - 8,  characterSpacing: 0.5 })
  doc.text('CANT.',        xQ,     y + 9, { width: cQty - 4,   align: 'right', characterSpacing: 0.5 })
  doc.text('PRECIO UNIT.', xU,     y + 9, { width: cUnit - 4,  align: 'right', characterSpacing: 0.5 })
  doc.text('TOTAL',        xA,     y + 9, { width: cAmt - 4,   align: 'right', characterSpacing: 0.5 })
  y += thH

  // Filas: divide-y divide-zinc-100, impares bg-zinc-50/60
  const rowH = 26
  ;(data.items || []).forEach((item, i) => {
    if (i % 2 !== 0) doc.rect(0, y, pageW, rowH).fillColor(C.zinc50).fill()
    // Descripción: text-zinc-800
    doc.font('Helvetica').fontSize(9.5).fillColor(C.zinc800)
      .text(item.description, xD + 4, y + 8, { width: cDesc - 8, ellipsis: true })
    // Cant / Precio: text-zinc-500
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
      .text(String(item.quantity), xQ, y + 8, { width: cQty - 4, align: 'right' })
      .text(fmt(item.unitPrice),   xU, y + 8, { width: cUnit - 4, align: 'right' })
    // Total: font-semibold text-zinc-800
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.zinc800)
      .text(fmt(item.amount), xA, y + 8, { width: cAmt - 4, align: 'right' })
    doc.rect(0, y + rowH - 0.5, pageW, 0.5).fillColor(C.zinc100).fill()
    y += rowH
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALES — border-t border-zinc-100 bg-zinc-50/50 px-7 py-5
  // ─────────────────────────────────────────────────────────────────────────
  const subtotal    = Number(data.subtotal)
  const total       = Number(data.total)
  const discountAmt = data.discountType === 'percent'
    ? subtotal * (Number(data.discountValue) / 100)
    : Number(data.discountValue) || 0
  const taxAmount   = (subtotal - discountAmt) * (Number(data.taxRate) / 100)
  const hasDiscount = discountAmt > 0
  const totRows     = 1 + (hasDiscount ? 1 : 0) + (data.taxRate > 0 ? 1 : 0)
  const totSectH    = infoPadY + totRows * 18 + 4 + 46 + infoPadY

  doc.rect(0, y, pageW, totSectH).fillColor(C.zinc50).fill()
  doc.rect(0, y, pageW, 0.5).fillColor(C.zinc100).fill()   // border-t

  y += infoPadY

  const totBlockW = 220
  const totX      = pageW - pad - totBlockW

  // Subtotal
  doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
    .text('Subtotal', totX, y)
    .text(fmt(subtotal), totX, y, { width: totBlockW, align: 'right' })
  y += 18

  // Descuento (si aplica)
  if (hasDiscount) {
    const discLabel = data.discountType === 'percent'
      ? `Descuento (${data.discountValue}%)`
      : 'Descuento'
    doc.font('Helvetica').fontSize(9).fillColor('#16a34a')
      .text(discLabel, totX, y)
      .text(`-${fmt(discountAmt)}`, totX, y, { width: totBlockW, align: 'right' })
    y += 18
  }

  // IVA (si aplica)
  if (data.taxRate > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
      .text(`IVA (${data.taxRate}%)`, totX, y)
      .text(fmt(taxAmount), totX, y, { width: totBlockW, align: 'right' })
    y += 18
  }

  y += 4  // mt-3

  // Banda total: rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3.5
  const tbH = 46
  const tg  = doc.linearGradient(totX, y, totX + totBlockW, y)
  tg.stop(0, C.slate900).stop(1, C.slate700)
  doc.roundedRect(totX, y, totBlockW, tbH, 8).fill(tg)

  // Izquierda: "TOTAL" + moneda
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.slate400)
    .text('TOTAL', totX + 12, y + 9, { characterSpacing: 1.2 })
  doc.font('Helvetica').fontSize(7).fillColor(C.slate500)
    .text(data.currency, totX + 12, y + 19)

  // Derecha: monto total — text-2xl font-bold text-white
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
    .text(fmt(total, data.currency), totX + 12, y + 13, { width: totBlockW - 20, align: 'right' })

  y += tbH + infoPadY

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN DE PAGOS — SectionLabel + tabla con header claro + badges de estado
  // ─────────────────────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    y = sectionLabel('Plan de pagos', y)

    const cNum  = tableW * 0.10,  iNum  = pad
    const cDue  = tableW * 0.35,  iDue  = iNum + cNum
    const cStat = tableW * 0.30,  iStat = iDue + cDue
    const cIA   = tableW * 0.25,  iAmt  = iStat + cStat

    // Header claro — igual al de ítems
    const ithH = 26
    doc.rect(0, y, pageW, ithH).fillColor(C.zinc50).fill()
    doc.rect(0, y + ithH - 0.5, pageW, 0.5).fillColor(C.zinc200).fill()
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.zinc500)
    doc.text('N°',          iNum,  y + 9, { width: cNum - 4,  characterSpacing: 0.5 })
    doc.text('VENCIMIENTO', iDue,  y + 9, { width: cDue - 4,  characterSpacing: 0.5 })
    doc.text('ESTADO',      iStat, y + 9, { width: cStat - 4, characterSpacing: 0.5 })
    doc.text('IMPORTE',     iAmt,  y + 9, { width: cIA - 4,   align: 'right', characterSpacing: 0.5 })
    y += ithH

    const BADGES = {
      pending: { label: 'Pendiente', bg: C.pendingBg, text: C.pendingText },
      paid:    { label: 'Pagado',    bg: C.paidBg,    text: C.paidText    },
      overdue: { label: 'Vencido',   bg: C.overdueBg, text: C.overdueText },
    }

    installments.forEach((inst, i) => {
      const rH    = 22
      const badge = BADGES[inst.status] || BADGES.pending
      if (i % 2 !== 0) doc.rect(0, y, pageW, rH).fillColor(C.zinc50).fill()
      // N°: text-zinc-500
      doc.font('Helvetica').fontSize(8.5).fillColor(C.zinc500)
        .text(String(inst.number), iNum, y + 6, { width: cNum - 4 })
      // Vencimiento: text-zinc-600
      doc.font('Helvetica').fontSize(8.5).fillColor(C.zinc600)
        .text(fmtDate(inst.dueDate), iDue, y + 6, { width: cDue - 4 })
      // Badge de estado: px-2 py-0.5 rounded-full text-xs font-medium
      statusBadge(badge.label, iStat, y + (rH - 13) / 2, badge.bg, badge.text)
      // Importe: font-semibold text-zinc-800
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc800)
        .text(fmt(inst.amount, data.currency), iAmt, y + 6, { width: cIA - 4, align: 'right' })
      doc.rect(0, y + rH - 0.5, pageW, 0.5).fillColor(C.zinc100).fill()
      y += rH
    })

    y += 16
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTAS — SectionLabel + px-7 pb-6 text-sm text-zinc-600 leading-relaxed
  // ─────────────────────────────────────────────────────────────────────────
  if (data.notes) {
    y = sectionLabel('Notas', y)
    y += 6
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc600)
      .text(data.notes, pad, y, { width: tableW, lineGap: 3 })
    y = doc.y + 16
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIRMAS — dos columnas: cliente (izq) | organización (der)
  // ─────────────────────────────────────────────────────────────────────────
  const hasClientSig = !!data.clientSignature
  const hasOrgSig    = !!org.signature

  if (hasClientSig || hasOrgSig) {
    y = sectionLabel('Firmas', y)

    const sigPad  = 20
    const sigColW = (tableW - sigPad) / 2
    const imgH    = 56
    const sigLX   = pad
    const sigRX   = pad + sigColW + sigPad

    const imgTop  = y + 12

    if (hasClientSig) {
      try {
        const b64  = data.clientSignature.includes(',') ? data.clientSignature.split(',')[1] : data.clientSignature
        const buf  = Buffer.from(b64, 'base64')
        doc.image(buf, sigLX, imgTop, { fit: [sigColW, imgH], align: 'center', valign: 'bottom' })
      } catch (_) {}
    }

    if (hasOrgSig) {
      try {
        const b64  = org.signature.includes(',') ? org.signature.split(',')[1] : org.signature
        const buf  = Buffer.from(b64, 'base64')
        doc.image(buf, sigRX, imgTop, { fit: [sigColW, imgH], align: 'center', valign: 'bottom' })
      } catch (_) {}
    }

    const lineY = imgTop + imgH + 8
    doc.rect(sigLX, lineY, sigColW, 0.5).fillColor(C.zinc300).fill()
    doc.rect(sigRX, lineY, sigColW, 0.5).fillColor(C.zinc300).fill()

    let sigTextY = lineY + 6

    // Nombre cliente
    const clientSigName    = data.client?.name    || data.potentialClientName    || ''
    const clientSigCompany = data.client?.company || data.potentialClientCompany || ''
    if (clientSigName) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc700)
        .text(clientSigName, sigLX, sigTextY, { width: sigColW, align: 'center' })
    }
    if (clientSigCompany) {
      doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc500)
        .text(clientSigCompany, sigLX, sigTextY + (clientSigName ? 12 : 0), { width: sigColW, align: 'center' })
    }

    // Nombre org
    if (org.signatureOwnerName) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.zinc700)
        .text(org.signatureOwnerName, sigRX, sigTextY, { width: sigColW, align: 'center' })
      doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc500)
        .text(org.name || '', sigRX, sigTextY + 12, { width: sigColW, align: 'center' })
    } else if (org.name) {
      doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc500)
        .text(org.name, sigRX, sigTextY, { width: sigColW, align: 'center' })
    }

    y = sigTextY + 28
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — igual al HTML: "Generado por [org]" (izquierda) + "Presupuesto #001" (derecha)
  // ─────────────────────────────────────────────────────────────────────────
  doc.rect(0, pageH - 40, pageW, 0.5).fillColor(C.zinc200).fill()

  // Izquierda: "Presupuesto generado por sofiapp.dev"
  doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc400)
    .text('Presupuesto generado por ', pad, pageH - 24, { continued: true })
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.zinc500)
    .text('sofiapp.dev')

  // Derecha: docLabel + número
  doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc400)
    .text(`${docLabel} #${numStr}`, pad, pageH - 24, { width: tableW, align: 'right' })

  doc.end()
  return doc
}
