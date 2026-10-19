import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../uploads')
const FONTS_DIR   = join(__dirname, '../assets/fonts')

// ── Paleta idéntica a QuotePublicPage.jsx ─────────────────────────────────────
const BG   = '#EDE8DF'
const CARD  = '#FFFFFF'
const INK   = '#1A1A1A'
const INK2  = '#3A3A3A'
const INK3  = '#6B6B6B'
const LINE  = '#E5E7EB'

const fmtNum = (n, cur = '') => {
  const sym = cur === 'USD' ? 'US$' : '$'
  const dec = cur === 'USD' ? 2 : 0
  return `${sym}${Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—'

// ── Dimensiones de página ─────────────────────────────────────────────────────
const PAGE_W  = 595.28
const PAGE_H  = 841.89
const BG_PAD  = 22                      // crema visible alrededor de la card
const CARD_X  = BG_PAD
const CARD_W  = PAGE_W - BG_PAD * 2    // ≈ 551
const C_PAD   = 28                      // padding horizontal dentro de la card
const CON_X   = CARD_X + C_PAD
const CON_W   = CARD_W - C_PAD * 2     // ≈ 495

// ─────────────────────────────────────────────────────────────────────────────
export async function buildPdf(type, data) {
  const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true })
  doc.registerFont('Geist',         join(FONTS_DIR, 'Geist-Regular.woff2'))
  doc.registerFont('Geist-SemiBold', join(FONTS_DIR, 'Geist-SemiBold.woff2'))
  doc.registerFont('Geist-Bold',    join(FONTS_DIR, 'Geist-Bold.woff2'))

  const org    = data.organization || {}
  const numStr = String(data.number).padStart(3, '0')
  const sym    = data.currency === 'USD' ? 'US$' : '$'
  const bp     = org.brandPrimary  || null
  const bs     = org.brandSecondary || null

  const _ext        = (org.logo || '').split('.').pop()?.toLowerCase()
  const orgLogoPath = ['png', 'jpg', 'jpeg', 'webp'].includes(_ext) ? join(UPLOADS_DIR, org.logo) : null
  const hasLogo     = orgLogoPath && existsSync(orgLogoPath)
  // PDFKit no soporta WebP; pre-convertir a PNG buffer
  let orgLogoBuf = null
  if (hasLogo) {
    try { orgLogoBuf = await sharp(orgLogoPath).png().toBuffer() } catch (_) {}
  }

  const subtotal    = Number(data.subtotal)
  const total       = Number(data.total)
  const discountAmt = data.discountType === 'percent'
    ? subtotal * (Number(data.discountValue) / 100)
    : Number(data.discountValue) || 0
  const taxAmount   = (subtotal - discountAmt) * (Number(data.taxRate) / 100)

  const clientName    = data.client?.name    || data.potentialClientName    || '—'
  const clientCompany = data.client?.company || data.potentialClientCompany || null
  const clientEmail   = data.client?.email   || data.potentialClientEmail   || null

  // Filas org info
  const orgInfoLines = [
    org.cuit    ? `CUIT: ${org.cuit}` : null,
    org.address ? [org.address, org.city, org.province].filter(Boolean).join(', ') + (org.postalCode ? ` (${org.postalCode})` : '') : null,
    org.phone   ? org.phone   : null,
    org.email   ? org.email   : null,
    org.website ? org.website : null,
  ].filter(Boolean)

  // Filas de detalle (derecha del header)
  const dateRows = [
    [`Emitido`,         fmtDate(data.createdAt)],
    data.validUntil   ? [`Válido hasta`,     fmtDate(data.validUntil)]   : null,
    data.deliveryDate ? [`Fecha de entrega`, fmtDate(data.deliveryDate)] : null,
    data.project      ? [`Proyecto`,         data.project.title]         : null,
  ].filter(Boolean)

  // ── Helpers de dibujo ──────────────────────────────────────────────────────

  // Rellena el fondo de página: gradiente de marca si hay colores, crema si no
  function paintPageBg() {
    if (bp && bs) {
      const grad = doc.linearGradient(0, 0, PAGE_W, PAGE_H)
      grad.stop(0, bp).stop(1, bs)
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(grad)
    } else if (bp) {
      doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(bp).fill()
    } else {
      doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(BG).fill()
    }
  }

  // Rellena blanco dentro de la card (x=CARD_X, w=CARD_W)
  function cardFill(y, h) {
    doc.rect(CARD_X, y, CARD_W, h).fillColor(CARD).fill()
  }

  // Separador horizontal full-card
  function hr(y) {
    doc.rect(CARD_X, y, CARD_W, 0.5).fillColor(LINE).fill()
  }

  // Separador interno (sólo ancho de contenido)
  function hrInner(y, op = 0.7) {
    doc.rect(CON_X, y, CON_W, 0.5).fillOpacity(op).fillColor(LINE).fill()
    doc.fillOpacity(1)
  }

  // Label de sección (10px, uppercase, INK3)
  function secLabel(text, y) {
    doc.font('Geist-Bold').fontSize(8).fillColor(INK3)
      .text(text.toUpperCase(), CON_X, y, { characterSpacing: 1.2, lineBreak: false })
  }

  // Nueva página, pinta BG, devuelve y inicial de card
  function newPage() {
    doc.addPage()
    paintPageBg()
    return BG_PAD
  }

  // Verifica que haya espacio; si no, nueva página
  function need(y, h) {
    if (y + h > PAGE_H - BG_PAD - 30) return newPage()
    return y
  }

  // ── Página 1: fondo crema ──────────────────────────────────────────────────
  paintPageBg()

  let y = BG_PAD

  // ── SECCIÓN EMPRESA ────────────────────────────────────────────────────────
  // Precalcular altura
  const logoH       = 44
  const logoGap     = 14
  const nameH       = 17
  const orgLinesH   = orgInfoLines.length * 13
  const colLeftH    = nameH + orgLinesH
  const numH        = 16
  const dateRowsH   = dateRows.length * 15
  const colRightH   = numH + dateRowsH
  const orgContentH = logoH + logoGap + Math.max(colLeftH, colRightH)
  const orgPadV     = 22
  const orgSectionH = orgPadV + orgContentH + orgPadV

  cardFill(y, orgSectionH)

  // Logo
  const logoW = Math.floor(CON_W * 0.33)
  const logoY = y + orgPadV
  if (orgLogoBuf) {
    try { doc.image(orgLogoBuf, CON_X, logoY, { height: logoH, fit: [logoW, logoH] }) } catch (_) {}
  } else {
    const sz = 44
    doc.rect(CON_X, logoY, sz, sz).fillColor(INK).fill()
    const initials = (org.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    doc.font('Geist-Bold').fontSize(14).fillColor(CARD)
      .text(initials, CON_X, logoY + 13, { width: sz, align: 'center', lineBreak: false })
  }

  const infoY = logoY + logoH + logoGap

  // Columna izquierda (org name + contacto)
  const orgLW = Math.floor(CON_W * 0.56)
  let ly = infoY
  doc.font('Geist-Bold').fontSize(12).fillColor(INK)
    .text(org.name || '', CON_X, ly, { width: orgLW, lineBreak: false })
  ly += nameH
  orgInfoLines.forEach(line => {
    doc.font('Geist').fontSize(9).fillColor(INK2)
      .text(line, CON_X, ly, { width: orgLW, lineBreak: false })
    ly += 13
  })

  // Columna derecha (número + fechas)
  const orgRX = CON_X + orgLW + 10
  const orgRW = CON_W - orgLW - 10
  let ry = infoY
  doc.font('Geist-Bold').fontSize(8).fillColor(INK3)
    .text(`PRESUPUESTO #${numStr}`, orgRX, ry, { width: orgRW, align: 'right', characterSpacing: 0.8, lineBreak: false })
  ry += numH
  dateRows.forEach(([lbl, val]) => {
    const halfW = Math.floor(orgRW / 2)
    doc.font('Geist').fontSize(9).fillColor(INK3)
      .text(lbl, orgRX, ry, { width: halfW, lineBreak: false })
    doc.font('Geist-Bold').fontSize(9).fillColor(INK)
      .text(val, orgRX + halfW, ry, { width: orgRW - halfW, align: 'right', lineBreak: false, ellipsis: true })
    ry += 15
  })

  y += orgSectionH

  // ── TÍTULO ────────────────────────────────────────────────────────────────
  const titleText = data.title || ''
  // Medir altura del título
  const titleLines = Math.ceil(doc.widthOfString(titleText, { fontSize: 22 }) / CON_W) || 1
  const titleSectionH = 18 + titleLines * 28 + 18
  y = need(y, titleSectionH)
  cardFill(y, titleSectionH)
  hr(y)
  y += 18
  doc.font('Geist-Bold').fontSize(22).fillColor(INK)
    .text(titleText, CON_X, y, { width: CON_W })
  y = doc.y + 18

  // ── CLIENTE ───────────────────────────────────────────────────────────────
  if (clientName || clientCompany) {
    const clientH = 14 + 14 + (clientCompany ? 30 : 17) + (clientEmail ? 14 : 0) + 10
    y = need(y, clientH)
    cardFill(y, clientH)
    hr(y)
    y += 14
    secLabel('Cliente', y)
    y += 14
    if (clientCompany) {
      doc.font('Geist-Bold').fontSize(11).fillColor(INK)
        .text(clientCompany, CON_X, y, { width: CON_W, lineBreak: false })
      y += 15
      doc.font('Geist').fontSize(10.5).fillColor(INK2)
        .text(clientName, CON_X, y, { width: CON_W, lineBreak: false })
      y += 14
    } else {
      doc.font('Geist-Bold').fontSize(11).fillColor(INK)
        .text(clientName, CON_X, y, { width: CON_W, lineBreak: false })
      y += 15
    }
    if (clientEmail) {
      doc.font('Geist').fontSize(9.5).fillColor(INK3)
        .text(clientEmail, CON_X, y, { width: CON_W, lineBreak: false })
      y += 13
    }
    y += 8
  }

  // ── ÍTEMS ─────────────────────────────────────────────────────────────────
  const items = data.items || []
  const itemsH = 14 + 28 + items.length * 32 + 8
  y = need(y, Math.min(itemsH, 200))
  cardFill(y, itemsH + 20)
  hr(y)
  y += 14

  // Proporciones columnas igual que HTML
  const xDesc = CON_X
  const wDesc = CON_W * 0.46
  const xQty  = xDesc + wDesc
  const wQty  = CON_W * 0.12
  const xUnit = xQty + wQty
  const wUnit = CON_W * 0.21
  const xAmt  = xUnit + wUnit
  const wAmt  = CON_W - wDesc - wQty - wUnit

  // Header tabla
  const tHeaders = [['Descripción', xDesc, wDesc, 'left'], ['Cant.', xQty, wQty, 'right'], ['Precio unit.', xUnit, wUnit, 'right'], ['Importe', xAmt, wAmt, 'right']]
  doc.font('Geist-Bold').fontSize(8).fillColor(INK3)
  tHeaders.forEach(([h, x, w, align]) => doc.text(h.toUpperCase(), x, y, { width: w, align, lineBreak: false, characterSpacing: 0.8 }))
  y += 13
  hrInner(y, 1)
  y += 1

  items.forEach(item => {
    if (y + 32 > PAGE_H - BG_PAD - 30) { y = newPage(); cardFill(y, 400) }
    doc.rect(CARD_X, y, CARD_W, 32).fillColor(CARD).fill()
    const ry = y + 9
    doc.font('Geist').fontSize(10.5).fillColor(INK)
      .text(item.description, xDesc, ry, { width: wDesc - 6, lineBreak: false, ellipsis: true })
    doc.font('Geist').fontSize(10).fillColor(INK2)
      .text(String(Number(item.quantity)), xQty, ry, { width: wQty, align: 'right', lineBreak: false })
      .text(fmtNum(item.unitPrice, data.currency), xUnit, ry, { width: wUnit, align: 'right', lineBreak: false })
    doc.font('Geist-Bold').fontSize(10.5).fillColor(INK)
      .text(fmtNum(item.amount, data.currency), xAmt, ry, { width: wAmt, align: 'right', lineBreak: false })
    y += 32
    hrInner(y)
  })

  // ── TOTALES ───────────────────────────────────────────────────────────────
  const hasDiscount = discountAmt > 0
  const hasTax      = Number(data.taxRate) > 0
  const totLineCount = (subtotal !== total ? 1 : 0) + (hasDiscount ? 1 : 0) + (hasTax ? 1 : 0)
  const totBlockH    = 52
  const totSectionH  = 20 + totLineCount * 20 + 16 + totBlockH + 22
  y = need(y, totSectionH)
  cardFill(y, totSectionH + 4)
  y += 20

  const totW = 300
  const totX = CON_X + CON_W - totW

  if (subtotal !== total) {
    doc.font('Geist').fontSize(11).fillColor(INK2)
      .text('Subtotal', totX, y, { width: totW * 0.5, lineBreak: false })
      .text(fmtNum(subtotal, data.currency), totX, y, { width: totW, align: 'right', lineBreak: false })
    y += 20
  }
  if (hasDiscount) {
    const discLabel = `Descuento${data.discountType === 'percent' ? ` ${data.discountValue}%` : ''}`
    doc.font('Geist').fontSize(11).fillColor(INK2)
      .text(discLabel, totX, y, { width: totW * 0.5, lineBreak: false })
      .text(`– ${fmtNum(discountAmt, data.currency)}`, totX, y, { width: totW, align: 'right', lineBreak: false })
    y += 20
  }
  if (hasTax) {
    doc.font('Geist').fontSize(11).fillColor(INK2)
      .text(`IVA ${data.taxRate}%`, totX, y, { width: totW * 0.5, lineBreak: false })
      .text(fmtNum(taxAmount, data.currency), totX, y, { width: totW, align: 'right', lineBreak: false })
    y += 20
  }

  y += 16

  // Label "Total" alineado a la izquierda del bloque
  doc.font('Geist-Bold').fontSize(11).fillColor(INK)
    .text('Total', CON_X, y + totBlockH / 2 - 6, { lineBreak: false })

  // Bloque oscuro  [ $XXXX ]
  doc.roundedRect(totX, y, totW, totBlockH, 4).fillColor(INK).fill()

  const amtStr = fmtNum(total, data.currency)
  const brkY   = y + 11

  doc.font('Geist').fontSize(20).fillOpacity(0.3).fillColor(CARD)
    .text('[', totX + 10, brkY, { lineBreak: false })
  doc.fillOpacity(1)

  doc.font('Geist-Bold').fontSize(22).fillColor(CARD)
    .text(amtStr, totX + 28, y + 13, { width: totW - 56, align: 'center', lineBreak: false })

  doc.font('Geist').fontSize(20).fillOpacity(0.3).fillColor(CARD)
    .text(']', totX + totW - 22, brkY, { lineBreak: false })
  doc.fillOpacity(1)

  y += totBlockH + 22

  // ── PLAN DE PAGOS ─────────────────────────────────────────────────────────
  const installments = data.installments || []
  if (installments.length > 0) {
    const instSH = 16 + 16 + 26 + installments.length * 28 + 10
    y = need(y, Math.min(instSH, 200))
    cardFill(y, instSH + 20)
    hr(y)
    y += 16
    secLabel('Plan de pagos', y)
    y += 16

    const iNW = CON_W * 0.08, iDW = CON_W * 0.30, iSW = CON_W * 0.30, iAW = CON_W * 0.32
    const iNX = CON_X, iDX = iNX + iNW, iSX = iDX + iDW, iAX = iSX + iSW

    doc.font('Geist-Bold').fontSize(8).fillColor(INK3)
    ;[['N°', iNX, iNW, 'left'], ['Vencimiento', iDX, iDW, 'left'], ['Estado', iSX, iSW, 'left'], ['Importe', iAX, iAW, 'right']]
      .forEach(([h, x, w, align]) => doc.text(h.toUpperCase(), x, y, { width: w, align, lineBreak: false, characterSpacing: 0.8 }))
    y += 13
    hrInner(y, 1)
    y += 1

    const stMap = {
      pending: ['Pendiente', '#F3F4F6', '#6B7280'],
      paid:    ['Pagado',    '#ECFDF5', '#065F46'],
      overdue: ['Vencido',  '#FEF2F2', '#991B1B'],
    }

    installments.forEach(inst => {
      if (y + 28 > PAGE_H - BG_PAD - 30) { y = newPage(); cardFill(y, 400) }
      doc.rect(CARD_X, y, CARD_W, 28).fillColor(CARD).fill()
      const ry = y + 8
      doc.font('Geist').fontSize(10).fillColor(INK2)
        .text(String(inst.number), iNX, ry, { width: iNW, lineBreak: false })
        .text(fmtDate(inst.dueDate), iDX, ry, { width: iDW - 4, lineBreak: false })
      const [stLabel, stBg, stColor] = stMap[inst.status] || stMap.pending
      doc.roundedRect(iSX, ry - 1, 58, 16, 8).fillColor(stBg).fill()
      doc.font('Geist-Bold').fontSize(8).fillColor(stColor)
        .text(stLabel, iSX, ry + 2, { width: 58, align: 'center', lineBreak: false })
      doc.font('Geist-Bold').fontSize(10.5).fillColor(INK)
        .text(fmtNum(inst.amount, data.currency), iAX, ry, { width: iAW, align: 'right', lineBreak: false })
      y += 28
      hrInner(y)
    })
    y += 10
  }

  // ── NOTAS ─────────────────────────────────────────────────────────────────
  const quoteNotes = data.quoteNotes || []
  if (quoteNotes.length > 0) {
    y = need(y, 60)
    cardFill(y, 400)
    hr(y)
    y += 16
    secLabel('Notas', y)
    y += 16

    for (const note of quoteNotes) {
      if (y + 40 > PAGE_H - BG_PAD - 30) { y = newPage(); cardFill(y, 400) }
      if (note.title) {
        doc.font('Geist-Bold').fontSize(11).fillColor(INK)
          .text(note.title, CON_X, y, { width: CON_W })
        y = doc.y + 4
      }
      doc.font('Geist').fontSize(10.5).fillColor(INK2)
        .text(note.description, CON_X, y, { width: CON_W, lineGap: 2.5 })
      y = doc.y + 14
    }
    y += 6
  }

  // ── IMÁGENES ──────────────────────────────────────────────────────────────
  const imgList = (data.images || []).filter(img => {
    const ext = (img.storedName || '').split('.').pop()?.toLowerCase()
    return ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  })

  if (imgList.length > 0) {
    // Pre-procesar: convertir WebP→PNG y calcular alturas con cap.
    // El cap garantiza que cada imagen quepa en una página limpia después del header (y=54).
    const processed = []
    for (const img of imgList) {
      try {
        const { data: buf, info } = await sharp(join(UPLOADS_DIR, img.storedName))
          .png().toBuffer({ resolveWithObject: true })
        const hasCaption = !!(img.title || img.description)
        const capH = hasCaption ? ((img.title ? 18 : 0) + (img.description ? 30 : 0) + 16) : 0
        // y=54 = BG_PAD(22) + header(32); dejar 4px de margen
        const maxImgH = Math.floor(PAGE_H - BG_PAD - 30 - 54 - capH - 4)
        const imgH    = Math.min(Math.round(CON_W * info.height / info.width), maxImgH)
        processed.push({ img, buf, imgH, capH, hasCaption })
      } catch (_) {}
    }

    if (processed.length > 0) {
      const { imgH: fH, capH: fC } = processed[0]
      // need con header + primera imagen juntos: evita header huérfano al final de página
      y = need(y, 32 + fH + fC + 16)
      cardFill(y, 40)
      hr(y)
      y += 16
      secLabel('Imágenes', y)
      y += 16

      for (const { img, buf, imgH, capH, hasCaption } of processed) {
        const blockH = imgH + capH + 16
        y = need(y, blockH)
        cardFill(y, blockH + 10)

        doc.image(buf, CON_X, y, { fit: [CON_W, imgH], align: 'center' })
        y += imgH

        if (hasCaption) {
          doc.rect(CON_X, y, CON_W, capH).fillColor(BG).fill()
          let cy = y + 8
          if (img.title) {
            doc.font('Geist-Bold').fontSize(11).fillColor(INK)
              .text(img.title, CON_X + 10, cy, { width: CON_W - 20, lineBreak: false })
            cy += 17
          }
          if (img.description) {
            doc.font('Geist').fontSize(10).fillColor(INK2)
              .text(img.description, CON_X + 10, cy, { width: CON_W - 20, lineGap: 2 })
            cy = doc.y + 4
          }
          y = cy + 6
        }
        y += 16
      }
      y += 4
    }
  }

  // ── FIRMAS ────────────────────────────────────────────────────────────────
  const hasClientSig = !!data.clientSignature
  const hasOrgSig    = !!org.signature

  if (hasClientSig || hasOrgSig) {
    const sigH = 16 + 16 + 60 + 8 + 30
    y = need(y, sigH + 20)
    cardFill(y, sigH + 20)
    hr(y)
    y += 16
    secLabel('Firmas', y)
    y += 18

    const sColGap = 20
    const sColW   = (CON_W - sColGap) / 2
    const sLX     = CON_X
    const sRX     = CON_X + sColW + sColGap
    const sImgH   = 56

    // Contenedores con borde LINE (igual al HTML)
    doc.rect(sLX, y, sColW, sImgH).strokeColor(LINE).lineWidth(0.5).stroke()
    doc.rect(sRX, y, sColW, sImgH).strokeColor(LINE).lineWidth(0.5).stroke()

    if (hasClientSig) {
      try {
        const b64 = data.clientSignature.includes(',') ? data.clientSignature.split(',')[1] : data.clientSignature
        doc.image(Buffer.from(b64, 'base64'), sLX + 4, y + 4, { fit: [sColW - 8, sImgH - 8], align: 'center', valign: 'center' })
      } catch (_) {}
    }
    if (hasOrgSig) {
      try {
        const b64 = org.signature.includes(',') ? org.signature.split(',')[1] : org.signature
        doc.image(Buffer.from(b64, 'base64'), sRX + 4, y + 4, { fit: [sColW - 8, sImgH - 8], align: 'center', valign: 'center' })
      } catch (_) {}
    }
    y += sImgH + 6

    // Línea de firma negra (igual al HTML: border-top 1px INK)
    doc.rect(sLX, y, sColW, 1).fillColor(INK).fill()
    doc.rect(sRX, y, sColW, 1).fillColor(INK).fill()
    y += 8

    const cName    = data.client?.name    || data.potentialClientName    || ''
    const cCompany = data.client?.company || data.potentialClientCompany || ''
    const oName    = org.signatureOwnerName || ''
    const oOrg     = org.name || ''

    if (cName) {
      doc.font('Geist-Bold').fontSize(9.5).fillColor(INK)
        .text(cName, sLX, y, { width: sColW, align: 'center', lineBreak: false })
    }
    if (cCompany) {
      doc.font('Geist').fontSize(9).fillColor(INK3)
        .text(cCompany, sLX, y + (cName ? 13 : 0), { width: sColW, align: 'center', lineBreak: false })
    }
    if (oName) {
      doc.font('Geist-Bold').fontSize(9.5).fillColor(INK)
        .text(oName, sRX, y, { width: sColW, align: 'center', lineBreak: false })
    }
    if (oOrg) {
      doc.font('Geist').fontSize(9).fillColor(INK3)
        .text(oOrg, sRX, y + (oName ? 13 : 0), { width: sColW, align: 'center', lineBreak: false })
    }
    y += 30
  }

  // ── Cierre de card + footer ────────────────────────────────────────────────
  // Asegurar fondo blanco hasta el fin de la card
  cardFill(y, BG_PAD + 30)
  y += BG_PAD + 8

  // Logo DanteUP para el footer
  const DANTEUP_LOGO_PATH = join(__dirname, '../assets/logotipo-horizontal-negro.png')
  const FOOTER_LOGO_H = 13
  let footerLogoImg = null
  let footerLogoW   = 0
  try {
    footerLogoImg = doc.openImage(DANTEUP_LOGO_PATH)
    footerLogoW   = Math.round(FOOTER_LOGO_H * footerLogoImg.width / footerLogoImg.height)
  } catch (_) {}

  doc.font('Geist').fontSize(9)
  const ftxt = 'Presupuesto generado con '
  const ftxtW = doc.widthOfString(ftxt)
  const fTotalW = ftxtW + footerLogoW
  const fX = (PAGE_W - fTotalW) / 2

  doc.font('Geist').fontSize(9).fillColor(INK3)
    .text(ftxt, fX, y + 1, { lineBreak: false })
  if (footerLogoImg) {
    doc.image(footerLogoImg, fX + ftxtW, y, { height: FOOTER_LOGO_H })
  }

  doc.end()
  return doc
}
