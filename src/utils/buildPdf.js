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
  zinc50:  '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  white:   '#ffffff',
  // Badges de estado de cuotas
  pendingBg:   '#f4f4f5', pendingText: '#71717a',
  paidBg:      '#d1fae5', paidText:    '#047857',
  overdueBg:   '#fee2e2', overdueText: '#dc2626',
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
  const pad    = 52
  const tableW = pageW - pad * 2  // 491

  // ── Helpers ───────────────────────────────────────────────────────────────

  function sectionLabel(label, y) {
    const h = 28
    doc.rect(0, y, pageW, h).fillColor(C.zinc50).fill()
    doc.rect(0, y, pageW, 0.5).fillColor(C.zinc100).fill()
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.zinc400)
      .text(label.toUpperCase(), pad, y + 10, { characterSpacing: 1.5 })
    const endX = pad + doc.widthOfString(label.toUpperCase()) + 10
    doc.rect(endX, y + 14, pageW - pad - endX, 0.5).fillColor(C.zinc200).fill()
    return y + h
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
  // HEADER
  // ─────────────────────────────────────────────────────────────────────────
  const headerH = 140

  const hg = doc.linearGradient(0, 0, pageW, headerH)
  hg.stop(0, C.slate900).stop(0.5, C.slate800).stop(1, C.slate700)
  doc.rect(0, 0, pageW, headerH).fill(hg)

  const leftMaxW = pageW - pad * 2 - 190
  let leftY = 18

  if (hasLogo) {
    doc.image(orgLogoPath, pad, leftY, { height: 48, fit: [200, 48] })
    leftY += 58
  } else {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.slate300)
      .text(org.name || '', pad, leftY, { width: leftMaxW })
    leftY += 18
  }

  // "PRESUPUESTO" label
  doc.font('Helvetica').fontSize(8).fillColor(C.slate400)
    .text(docLabel.toUpperCase(), pad, leftY, { characterSpacing: 1.8 })
  leftY += 14

  // Título
  if (data.title) {
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.white)
      .text(data.title, pad, leftY, { width: leftMaxW })
  }

  // Lado derecho
  const rw = 175
  const rx = pageW - pad - rw
  let ry   = 18

  // Número #001
  doc.font('Helvetica-Bold').fontSize(25).fillColor(C.white)
    .text(`#${numStr}`, rx, ry, { width: rw, align: 'right' })
  ry += 38

  // Nombre de org (si hay logo)
  if (hasLogo) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.slate300)
      .text(org.name || '', rx, ry, { width: rw, align: 'right' })
    ry += 14
  }

  // Contacto
  ;[
    org.cuit    ? `CUIL/CUIT: ${org.cuit}` : null,
    org.email   ? org.email                : null,
    org.phone   ? org.phone                : null,
    org.address ? org.address              : null,
    (org.city || org.province) ? [org.city, org.province].filter(Boolean).join(', ') + (org.postalCode ? ` (${org.postalCode})` : '') : null,
    org.website ? org.website              : null,
  ].filter(Boolean).forEach(v => {
    doc.font('Helvetica').fontSize(9).fillColor(C.slate400)
      .text(v, rx, ry, { width: rw, align: 'right' })
    ry += 14
  })

  // ─────────────────────────────────────────────────────────────────────────
  // INFO — CLIENTE | DETALLE
  // ─────────────────────────────────────────────────────────────────────────
  const infoTop  = headerH
  const infoPadY = 16
  const colGap   = 16
  const colL     = Math.floor(tableW * 0.50)
  const colR     = tableW - colL - colGap
  const xL       = pad
  const xR       = pad + colL + colGap

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.zinc400)
    .text('CLIENTE', xL, infoTop + infoPadY, { characterSpacing: 1.5 })

  const clientName    = data.client?.name    || data.potentialClientName    || '—'
  const clientCompany = data.client?.company || data.potentialClientCompany || null
  const clientEmail   = data.client?.email   || data.potentialClientEmail   || null

  let cy = infoTop + infoPadY + 13
  if (clientCompany) {
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.zinc800)
      .text(clientCompany, xL, cy, { width: colL })
    cy += 21
    doc.font('Helvetica').fontSize(11).fillColor(C.zinc500)
      .text(clientName, xL, cy, { width: colL })
    cy += 16
  } else {
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.zinc800)
      .text(clientName, xL, cy, { width: colL })
    cy += 21
  }

  ;[
    data.client?.cuit    ? `CUIL/CUIT: ${data.client.cuit}` : null,
    clientEmail,
    data.client?.phone   ? data.client.phone   : null,
    data.client?.address ? data.client.address : null,
    (data.client?.city || data.client?.province) ? [data.client.city, data.client.province].filter(Boolean).join(', ') + (data.client.postalCode ? ` (${data.client.postalCode})` : '') : null,
  ].filter(Boolean).forEach(v => {
    doc.font('Helvetica').fontSize(10).fillColor(C.zinc500).text(v, xL, cy, { width: colL })
    cy += 15
  })

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.zinc400)
    .text('DETALLE', xR, infoTop + infoPadY, { characterSpacing: 1.5 })

  const infoRows = isQuote
    ? [
        ['Número',       `#${numStr}`],
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        data.project      ? ['Proyecto',         data.project.title]                               : null,
        validDays != null ? ['Válido por',       `${validDays} día${validDays !== 1 ? 's' : ''}`]  : null,
        data.validUntil   ? ['Válido hasta',     fmtDate(data.validUntil)]                         : null,
        data.deliveryDate ? ['Fecha de entrega', fmtDate(data.deliveryDate)]                       : null,
      ].filter(Boolean)
    : [
        ['Número',       `#${numStr}`],
        ['Fecha',        fmtDate(data.createdAt)],
        ['Moneda',       data.currency],
        data.project  ? ['Proyecto',    data.project.title]    : null,
        data.dueDate  ? ['Vencimiento', fmtDate(data.dueDate)] : null,
      ].filter(Boolean)

  let ry2 = infoTop + infoPadY + 13
  infoRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(9).fillColor(C.zinc400).text(label, xR, ry2, { width: 78 })
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.zinc700)
      .text(String(value), xR + 80, ry2, { width: colR - 80 })
    ry2 += 16
  })

  const infoBot = Math.max(cy, ry2) + infoPadY
  doc.rect(xR - colGap / 2, infoTop + infoPadY, 0.5, infoBot - infoTop - infoPadY * 1.5)
    .fillColor(C.zinc100).fill()
  doc.rect(0, infoBot, pageW, 0.5).fillColor(C.zinc100).fill()

  // ─────────────────────────────────────────────────────────────────────────
  // ÍTEMS
  // ─────────────────────────────────────────────────────────────────────────
  let y = sectionLabel('Ítems', infoBot)

  const cDesc = tableW * 0.47
  const cQty  = tableW * 0.11
  const cUnit = tableW * 0.21
  const cAmt  = tableW * 0.21
  const xD = pad,  xQ = pad + cDesc,  xU = pad + cDesc + cQty,  xA = pad + cDesc + cQty + cUnit

  const thH = 30
  doc.rect(0, y, pageW, thH).fillColor(C.zinc50).fill()
  doc.rect(0, y + thH - 0.5, pageW, 0.5).fillColor(C.zinc200).fill()
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.zinc500)
  doc.text('DESCRIPCIÓN',  xD + 4, y + 10, { width: cDesc - 8,  characterSpacing: 0.5 })
  doc.text('CANT.',        xQ,     y + 10, { width: cQty - 4,   align: 'right', characterSpacing: 0.5 })
  doc.text('PRECIO UNIT.', xU,     y + 10, { width: cUnit - 4,  align: 'right', characterSpacing: 0.5 })
  doc.text('TOTAL',        xA,     y + 10, { width: cAmt - 4,   align: 'right', characterSpacing: 0.5 })
  y += thH

  const rowH = 30
  ;(data.items || []).forEach((item, i) => {
    if (i % 2 !== 0) doc.rect(0, y, pageW, rowH).fillColor(C.zinc50).fill()
    doc.font('Helvetica').fontSize(11).fillColor(C.zinc800)
      .text(item.description, xD + 4, y + 9, { width: cDesc - 8, ellipsis: true })
    doc.font('Helvetica').fontSize(10.5).fillColor(C.zinc500)
      .text(String(item.quantity), xQ, y + 9, { width: cQty - 4, align: 'right' })
      .text(fmt(item.unitPrice),   xU, y + 9, { width: cUnit - 4, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.zinc800)
      .text(fmt(item.amount), xA, y + 9, { width: cAmt - 4, align: 'right' })
    doc.rect(0, y + rowH - 0.5, pageW, 0.5).fillColor(C.zinc100).fill()
    y += rowH
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALES
  // ─────────────────────────────────────────────────────────────────────────
  const subtotal    = Number(data.subtotal)
  const total       = Number(data.total)
  const discountAmt = data.discountType === 'percent'
    ? subtotal * (Number(data.discountValue) / 100)
    : Number(data.discountValue) || 0
  const taxAmount   = (subtotal - discountAmt) * (Number(data.taxRate) / 100)
  const hasDiscount = discountAmt > 0
  const totRows     = 1 + (hasDiscount ? 1 : 0) + (data.taxRate > 0 ? 1 : 0)
  const totSectH    = infoPadY + totRows * 21 + 4 + 50 + infoPadY

  doc.rect(0, y, pageW, totSectH).fillColor(C.zinc50).fill()
  doc.rect(0, y, pageW, 0.5).fillColor(C.zinc100).fill()

  y += infoPadY

  const totBlockW = 220
  const totX      = pageW - pad - totBlockW

  doc.font('Helvetica').fontSize(10.5).fillColor(C.zinc500)
    .text('Subtotal', totX, y)
    .text(fmt(subtotal), totX, y, { width: totBlockW, align: 'right' })
  y += 21

  if (hasDiscount) {
    const discLabel = data.discountType === 'percent'
      ? `Descuento (${data.discountValue}%)`
      : 'Descuento'
    doc.font('Helvetica').fontSize(10.5).fillColor('#16a34a')
      .text(discLabel, totX, y)
      .text(`-${fmt(discountAmt)}`, totX, y, { width: totBlockW, align: 'right' })
    y += 21
  }

  if (data.taxRate > 0) {
    doc.font('Helvetica').fontSize(10.5).fillColor(C.zinc500)
      .text(`IVA (${data.taxRate}%)`, totX, y)
      .text(fmt(taxAmount), totX, y, { width: totBlockW, align: 'right' })
    y += 21
  }

  y += 4

  // Banda total
  const tbH = 50
  const tg  = doc.linearGradient(totX, y, totX + totBlockW, y)
  tg.stop(0, C.slate900).stop(1, C.slate700)
  doc.roundedRect(totX, y, totBlockW, tbH, 8).fill(tg)

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.slate400)
    .text('TOTAL', totX + 12, y + 10, { characterSpacing: 1.2 })
  doc.font('Helvetica').fontSize(8).fillColor(C.slate500)
    .text(data.currency, totX + 12, y + 22)

  doc.font('Helvetica-Bold').fontSize(23).fillColor(C.white)
    .text(fmt(total, data.currency), totX + 12, y + 14, { width: totBlockW - 20, align: 'right' })

  y += tbH + infoPadY

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN DE PAGOS
  // ─────────────────────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    y = sectionLabel('Plan de pagos', y)

    const cNum  = tableW * 0.12,  iNum  = pad
    const cDue  = tableW * 0.55,  iDue  = iNum + cNum
    const cIA   = tableW * 0.33,  iAmt  = iDue + cDue

    const ithH = 30
    doc.rect(0, y, pageW, ithH).fillColor(C.zinc50).fill()
    doc.rect(0, y + ithH - 0.5, pageW, 0.5).fillColor(C.zinc200).fill()
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.zinc500)
    doc.text('N°',          iNum, y + 10, { width: cNum - 4, characterSpacing: 0.5 })
    doc.text('VENCIMIENTO', iDue, y + 10, { width: cDue - 4, characterSpacing: 0.5 })
    doc.text('IMPORTE',     iAmt, y + 10, { width: cIA - 4,  align: 'right', characterSpacing: 0.5 })
    y += ithH

    installments.forEach((inst, i) => {
      const rH = 26
      if (i % 2 !== 0) doc.rect(0, y, pageW, rH).fillColor(C.zinc50).fill()
      doc.font('Helvetica').fontSize(10).fillColor(C.zinc500)
        .text(String(inst.number), iNum, y + 8, { width: cNum - 4 })
      doc.font('Helvetica').fontSize(10).fillColor(C.zinc600)
        .text(fmtDate(inst.dueDate), iDue, y + 8, { width: cDue - 4 })
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.zinc800)
        .text(fmt(inst.amount, data.currency), iAmt, y + 8, { width: cIA - 4, align: 'right' })
      doc.rect(0, y + rH - 0.5, pageW, 0.5).fillColor(C.zinc100).fill()
      y += rH
    })

    y += 16
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTAS
  // ─────────────────────────────────────────────────────────────────────────
  if (data.notes) {
    y = sectionLabel('Notas', y)
    y += 6
    doc.font('Helvetica').fontSize(10.5).fillColor(C.zinc600)
      .text(data.notes, pad, y, { width: tableW, lineGap: 3 })
    y = doc.y + 16
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IMÁGENES
  // ─────────────────────────────────────────────────────────────────────────
  const quoteImages = (data.images || []).filter(img => {
    const p = join(UPLOADS_DIR, img.storedName)
    const ext = (img.storedName || '').split('.').pop()?.toLowerCase()
    return ['png', 'jpg', 'jpeg', 'webp'].includes(ext) && existsSync(p)
  })

  if (quoteImages.length > 0) {
    y = sectionLabel('Imágenes', y)
    y += 10

    const imgW    = tableW * 0.95
    const imgX    = pad + (tableW - imgW) / 2
    const textPad = 10

    for (const img of quoteImages) {
      const imgPath = join(UPLOADS_DIR, img.storedName)

      let pdfImg, imgH
      try {
        pdfImg = doc.openImage(imgPath)
        imgH   = Math.round(imgW * pdfImg.height / pdfImg.width)
      } catch (_) {
        continue
      }

      const textH = (img.title ? 20 : 0) + (img.description ? 30 : 0) + 20
      if (y + imgH + textH > pageH - 50) {
        doc.addPage()
        y = 30
      }

      doc.image(pdfImg, imgX, y, { width: imgW })
      y += imgH + textPad

      if (img.title) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor(C.zinc800)
          .text(img.title, pad, y, { width: tableW })
        y = doc.y + 4
      }
      if (img.description) {
        doc.font('Helvetica').fontSize(10.5).fillColor(C.zinc500)
          .text(img.description, pad, y, { width: tableW, lineGap: 2 })
        y = doc.y + 4
      }

      y += 16
    }

    y += 4
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIRMAS
  // ─────────────────────────────────────────────────────────────────────────
  const hasClientSig = !!data.clientSignature
  const hasOrgSig    = !!org.signature

  if (hasClientSig || hasOrgSig) {
    const sigColGap = 40
    const sigColW   = (tableW - sigColGap) / 2
    const sigLX     = pad
    const sigRX     = pad + sigColW + sigColGap
    const imgH      = 52
    const blockH    = 220

    if (y + blockH > pageH - 42) {
      doc.addPage()
      y = 30
    }

    y = sectionLabel('Firmas', y)
    y += 12

    const clauseText = 'Las partes declaran haber leído y aceptado el presente presupuesto en todas sus condiciones. La firma a continuación implica conformidad con los servicios, plazos y valores detallados en este documento.'
    doc.font('Helvetica').fontSize(12).fillColor(C.zinc500)
      .text(clauseText, pad, y, { width: tableW, align: 'justify', lineGap: 2.5 })
    y = doc.y + 10
    doc.rect(pad, y, tableW, 0.5).fillColor(C.zinc200).fill()
    y += 12

    doc.font('Helvetica').fontSize(7.5).fillColor(C.zinc400)
    doc.text('CLIENTE', sigLX, y, { width: sigColW, align: 'center', characterSpacing: 1.2, lineBreak: false })
    doc.text('EMPRESA', sigRX, y, { width: sigColW, align: 'center', characterSpacing: 1.2, lineBreak: false })
    y += 10

    if (hasClientSig) {
      try {
        const b64 = data.clientSignature.includes(',') ? data.clientSignature.split(',')[1] : data.clientSignature
        doc.image(Buffer.from(b64, 'base64'), sigLX, y, { fit: [sigColW, imgH], align: 'center', valign: 'bottom' })
      } catch (_) {}
    }
    if (hasOrgSig) {
      try {
        const b64 = org.signature.includes(',') ? org.signature.split(',')[1] : org.signature
        doc.image(Buffer.from(b64, 'base64'), sigRX, y, { fit: [sigColW, imgH], align: 'center', valign: 'bottom' })
      } catch (_) {}
    }
    y += imgH + 8

    const divX = sigRX - sigColGap / 2
    doc.rect(divX, y - imgH - 8, 0.5, imgH + 8).fillColor(C.zinc100).fill()

    doc.rect(sigLX, y, sigColW, 0.5).fillColor(C.zinc400).fill()
    doc.rect(sigRX, y, sigColW, 0.5).fillColor(C.zinc400).fill()
    y += 8

    const cName    = data.client?.name    || data.potentialClientName    || ''
    const cCompany = data.client?.company || data.potentialClientCompany || ''
    const oName    = org.signatureOwnerName || ''
    const oOrg     = org.name || ''

    if (cName) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.zinc700)
        .text(cName, sigLX, y, { width: sigColW, align: 'center', lineBreak: false })
    }
    if (cCompany) {
      doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
        .text(cCompany, sigLX, y + (cName ? 15 : 0), { width: sigColW, align: 'center', lineBreak: false })
    }
    if (oName) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.zinc700)
        .text(oName, sigRX, y, { width: sigColW, align: 'center', lineBreak: false })
    }
    if (oOrg) {
      doc.font('Helvetica').fontSize(9).fillColor(C.zinc500)
        .text(oOrg, sigRX, y + (oName ? 15 : 0), { width: sigColW, align: 'center', lineBreak: false })
    }

    y += 32
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  doc.rect(0, pageH - 40, pageW, 0.5).fillColor(C.zinc200).fill()

  doc.font('Helvetica').fontSize(9).fillColor(C.zinc400)
    .text('Presupuesto generado por ', pad, pageH - 24, { continued: true })
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.zinc500)
    .text('danteup.com')

  doc.font('Helvetica').fontSize(9).fillColor(C.zinc400)
    .text(`${docLabel} #${numStr}`, pad, pageH - 24, { width: tableW, align: 'right' })

  doc.end()
  return doc
}
