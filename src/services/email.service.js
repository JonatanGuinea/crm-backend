const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const BACKEND_URL  = process.env.BACKEND_URL  || `http://localhost:${process.env.PORT || 8000}`

/**
 * Envía el informe mensual como PDF adjunto al owner de la organización.
 *
 * Para activar: configurar el mismo proveedor que sendQuoteEmail.
 *
 * Resend:
 *   await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html,
 *     attachments: [{ filename, content: pdfBuffer.toString('base64') }] })
 *
 * Nodemailer:
 *   await transporter.sendMail({ from, to, subject, html,
 *     attachments: [{ filename, content: pdfBuffer }] })
 */
export async function sendMonthlyReportEmail({ to, ownerName, orgName, year, month, pdfBuffer }) {
  const monthStr = new Date(year, month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const monthId  = `${year}-${String(month).padStart(2, '0')}`
  const filename = `informe-${orgName.toLowerCase().replace(/\s+/g, '-')}-${monthId}.pdf`
  const subject  = `Informe mensual ${monthStr} — ${orgName}`
  const html     = buildReportEmailHtml({ ownerName, orgName, monthStr, filename })

  // ── Resend ────────────────────────────────────────────────────────────────
  // import { Resend } from 'resend'
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM, to, subject, html,
  //   attachments: [{ filename, content: pdfBuffer.toString('base64') }]
  // })

  // ── Nodemailer / SMTP ─────────────────────────────────────────────────────
  // import nodemailer from 'nodemailer'
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // })
  // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html,
  //   attachments: [{ filename, content: pdfBuffer }] })

  console.log(`[email] Informe mensual → ${to} | ${subject} | PDF: ${pdfBuffer.length} bytes`)
}

function buildReportEmailHtml({ ownerName, orgName, monthStr, filename }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Informe mensual ${monthStr}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;background:#ffffff;">

          <tr>
            <td style="background-color:#4f46e5;padding:28px 36px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Informe Mensual</h1>
              <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">${orgName} · ${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 12px;color:#27272a;font-size:15px;">
                Hola, <strong>${ownerName}</strong>
              </p>
              <p style="margin:0 0 20px;color:#71717a;font-size:14px;line-height:1.6;">
                Adjunto encontrás el informe mensual de <strong style="color:#27272a;">${orgName}</strong> correspondiente a <strong style="color:#27272a;">${monthStr}</strong>.
              </p>
              <p style="margin:0 0 20px;color:#71717a;font-size:14px;line-height:1.6;">
                El reporte incluye:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#71717a;font-size:14px;line-height:1.8;">
                <li>Resumen financiero del mes</li>
                <li>Estado de presupuestos</li>
                <li>Situación de proyectos</li>
                <li>Inventario y alertas de stock</li>
              </ul>
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                Archivo: <strong>${filename}</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #f4f4f5;padding:18px 36px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Generado automáticamente por <strong>SOFIAPP CRM</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Envía un recordatorio al cliente si no respondió el presupuesto en 2 días.
 * Usa la misma configuración de proveedor que sendQuoteEmail.
 */
export async function sendQuoteReminderEmail({ to, clientName, orgName, orgLogo, quoteId, quoteNumber, quoteTitle, total, currency }) {
  const publicUrl  = `${FRONTEND_URL}/p/presupuesto/${quoteId}`
  const orgLogoUrl = orgLogo ? `${BACKEND_URL}/uploads/${orgLogo}` : null
  const num        = String(quoteNumber).padStart(3, '0')
  const sym        = currency === 'USD' ? 'US$' : '$'
  const totalFmt   = `${sym}${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const subject = `Recordatorio: Presupuesto #${num} pendiente de respuesta`
  const html    = buildReminderEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl })

  // ── Resend ────────────────────────────────────────────────────────────────
  // import { Resend } from 'resend'
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html })

  // ── Nodemailer / SMTP ─────────────────────────────────────────────────────
  // import nodemailer from 'nodemailer'
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // })
  // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html })

  console.log(`[email] Recordatorio → ${to} | Presupuesto #${num} | ${publicUrl}`)
}

function buildReminderEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl }) {
  const logoCell = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="max-height:40px;max-width:130px;object-fit:contain;display:block;">`
    : `<p style="margin:0;color:#cbd5e1;font-size:12px;font-weight:600;">${orgName}</p>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Recordatorio Presupuesto #${num}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;background:#ffffff;">

          <tr>
            <td style="background-color:#1e293b;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:140px;padding-right:20px;">
                    ${logoCell}
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Recordatorio</p>
                    <h1 style="margin:0 0 4px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">#${num}</h1>
                    <p style="margin:0;color:#cbd5e1;font-size:13px;">${quoteTitle}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 12px;color:#27272a;font-size:15px;">
                Hola, <strong>${clientName}</strong>
              </p>
              <p style="margin:0 0 6px;color:#71717a;font-size:14px;line-height:1.6;">
                Hace unos días te enviamos el presupuesto <strong style="color:#27272a;">${quoteTitle}</strong> y aún no recibimos tu respuesta.
              </p>
              <p style="margin:0 0 28px;color:#71717a;font-size:14px;">
                Total: <strong style="color:#27272a;font-size:15px;">${totalFmt}</strong>
              </p>
              <p style="margin:0 0 28px;color:#71717a;font-size:14px;line-height:1.6;">
                Si tenés alguna consulta o necesitás algún ajuste, no dudes en contactarnos. Podés ver el presupuesto completo haciendo clic en el botón:
              </p>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${publicUrl}"
                       style="display:inline-block;background-color:#1e293b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:600;">
                      Ver presupuesto
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;word-break:break-all;">
                <a href="${publicUrl}" style="color:#64748b;">${publicUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #f4f4f5;padding:18px 36px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Generado por <a href="https://sofiapp.dev" target="_blank" style="color:#71717a;font-weight:600;text-decoration:none;">sofiapp.dev</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Envía el presupuesto al cliente como email con link a la página pública HTML.
 *
 * Para activar: descomentar el bloque del proveedor elegido y configurar
 * las variables de entorno correspondientes en .env
 */
export async function sendQuoteEmail({ to, clientName, orgName, orgLogo, quoteId, quoteNumber, quoteTitle, total, currency }) {
  const publicUrl   = `${FRONTEND_URL}/p/presupuesto/${quoteId}`
  const orgLogoUrl  = orgLogo ? `${BACKEND_URL}/uploads/${orgLogo}` : null
  const num         = String(quoteNumber).padStart(3, '0')
  const sym         = currency === 'USD' ? 'US$' : '$'
  const totalFmt    = `${sym}${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const subject = `Presupuesto #${num} — ${quoteTitle}`
  const html    = buildEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl })

  // ── Resend ────────────────────────────────────────────────────────────────
  // npm install resend
  // .env: RESEND_API_KEY=re_xxx   EMAIL_FROM=Empresa <noreply@tudominio.com>
  //
  // import { Resend } from 'resend'
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html })

  // ── Nodemailer / SMTP ─────────────────────────────────────────────────────
  // npm install nodemailer
  // .env: SMTP_HOST  SMTP_PORT  SMTP_USER  SMTP_PASS  EMAIL_FROM
  //
  // import nodemailer from 'nodemailer'
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT) || 587,
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // })
  // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html })

  // Sin proveedor configurado: solo log
  console.log(`[email] Para enviar → ${to} | Presupuesto #${num} | ${publicUrl}`)
}

function buildEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl }) {
  const logoCell = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="max-height:40px;max-width:130px;object-fit:contain;display:block;">`
    : `<p style="margin:0;color:#cbd5e1;font-size:12px;font-weight:600;">${orgName}</p>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Presupuesto #${num}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;background:#ffffff;">

          <!-- Header: izquierda = info del doc | derecha = logo/nombre org -->
          <tr>
            <td style="background-color:#1e293b;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Izquierda: logo o nombre de la empresa -->
                  <td style="vertical-align:middle;width:140px;padding-right:20px;">
                    ${logoCell}
                  </td>
                  <!-- Derecha: datos del presupuesto -->
                  <td style="vertical-align:middle;text-align:right;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Presupuesto</p>
                    <h1 style="margin:0 0 4px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">#${num}</h1>
                    <p style="margin:0;color:#cbd5e1;font-size:13px;">${quoteTitle}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 12px;color:#27272a;font-size:15px;">
                Hola, <strong>${clientName}</strong>
              </p>
              <p style="margin:0 0 6px;color:#71717a;font-size:14px;line-height:1.6;">
                Te compartimos el presupuesto <strong style="color:#27272a;">${quoteTitle}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#71717a;font-size:14px;">
                Total: <strong style="color:#27272a;font-size:15px;">${totalFmt}</strong>
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${publicUrl}"
                       style="display:inline-block;background-color:#1e293b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:600;">
                      Ver presupuesto
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;word-break:break-all;">
                <a href="${publicUrl}" style="color:#64748b;">${publicUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f4f4f5;padding:18px 36px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Generado por <a href="https://sofiapp.dev" target="_blank" style="color:#71717a;font-weight:600;text-decoration:none;">sofiapp.dev</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}
