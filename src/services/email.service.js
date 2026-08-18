import nodemailer from 'nodemailer'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const BACKEND_URL  = process.env.BACKEND_URL  || `http://localhost:${process.env.PORT || 8000}`

export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`
  const subject  = 'Restablecer contraseña — DANTEUP CRM'
  const html     = buildPasswordResetEmailHtml({ name, resetUrl })

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  console.log(`[email] Reset de contraseña → ${to} | ${resetUrl}`)
}

function buildPasswordResetEmailHtml({ name, resetUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="color:#00B2A9;font-size:16px;font-weight:700;letter-spacing:-0.3px;">DANTEUP CRM</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Recuperar acceso
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:28px 32px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Solicitud recibida</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Restablecer contraseña</h1>
              <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;">Usá el botón para crear una nueva contraseña</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                Hola, ${name} 👋
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:#18181b;">DANTEUP CRM</strong>.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Si no fuiste vos, podés ignorar este email — tu contraseña actual no cambiará. El enlace expira en <strong style="color:#18181b;">30 minutos</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Crear nueva contraseña
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 6px;color:#a1a1aa;font-size:11px;text-align:center;">
                O copiá este enlace en tu navegador:
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${resetUrl}" style="color:#00B2A9;text-decoration:none;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

export async function sendPasswordChangeEmail({ to, name, token }) {
  const confirmUrl = `${FRONTEND_URL}/confirm-password-change?token=${token}`
  const subject    = 'Confirmá el cambio de contraseña — DANTEUP CRM'
  const html       = buildPasswordChangeEmailHtml({ name, confirmUrl })

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  console.log(`[email] Cambio de contraseña → ${to} | ${confirmUrl}`)
}

function buildPasswordChangeEmailHtml({ name, confirmUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Confirmá el cambio de contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="color:#00B2A9;font-size:16px;font-weight:700;letter-spacing:-0.3px;">DANTEUP CRM</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Seguridad
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:28px 32px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Solicitud de cambio</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Cambio de contraseña</h1>
              <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;">Confirmá para aplicar el cambio</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                Hola, ${name} 👋
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong style="color:#18181b;">DANTEUP CRM</strong>.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Hacé clic en el botón para confirmar el cambio. Si no fuiste vos, ignorá este email — tu contraseña actual seguirá siendo la misma.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Confirmar cambio de contraseña
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 6px;color:#a1a1aa;font-size:11px;text-align:center;">
                O copiá este enlace en tu navegador:
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${confirmUrl}" style="color:#00B2A9;text-decoration:none;">${confirmUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0 0 4px;color:#a1a1aa;font-size:11px;">
                Este enlace expira en 30 minutos. Si no solicitaste este cambio, ignorá este email.
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`
  const subject   = 'Confirmá tu cuenta en DANTEUP CRM'
  const html      = buildVerificationEmailHtml({ name, verifyUrl })

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  console.log(`[email] Verificación → ${to} | ${verifyUrl}`)
}

function buildVerificationEmailHtml({ name, verifyUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Confirmá tu cuenta — DANTEUP CRM</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <!-- Barra de acento teal superior -->
          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header oscuro -->
          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="color:#00B2A9;font-size:16px;font-weight:700;letter-spacing:-0.3px;">DANTEUP CRM</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Verificación
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Banner teal con ícono -->
          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:20px;">
                    <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Nuevo acceso</p>
                    <h1 style="margin:0 0 6px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Confirmá tu cuenta</h1>
                    <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;">Estás a un paso de empezar</p>
                  </td>
                  <td style="vertical-align:middle;text-align:right;width:64px;">
                    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">
                      <img src="https://cdn-icons-png.flaticon.com/512/9195/9195785.png" width="30" height="30" alt="" style="display:block;opacity:0.9;" />
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                Hola, ${name} 👋
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Gracias por registrarte en <strong style="color:#18181b;">DANTEUP CRM</strong>. Para activar tu cuenta y comenzar a usarla, confirmá tu dirección de email haciendo clic en el botón de abajo.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Este enlace es válido por <strong style="color:#18181b;">24 horas</strong>.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Confirmar email
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Link plano -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 6px;color:#a1a1aa;font-size:11px;text-align:center;">
                O copiá este enlace en tu navegador:
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#00B2A9;text-decoration:none;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Separador -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0 0 4px;color:#a1a1aa;font-size:11px;">
                Si no creaste esta cuenta, ignorá este email.
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    authMethod: 'PLAIN',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendInvitationEmail({ to, inviteeName, orgName, role, inviteLink, isNewUser }) {
  const subject = `Te invitaron a unirse a ${orgName}`
  const html    = buildInvitationEmailHtml({ inviteeName, orgName, role, inviteLink, isNewUser })

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  console.log(`[email] Invitación → ${to} | ${orgName} | ${role} | ${inviteLink}`)
}

function buildInvitationEmailHtml({ inviteeName, orgName, role, inviteLink, isNewUser }) {
  const roleLabel = role === 'admin' ? 'Administrador' : 'Miembro'
  const greeting  = inviteeName ? `Hola, ${inviteeName} 👋` : '¡Hola! 👋'
  const ctaText   = isNewUser ? 'Crear cuenta y unirse' : 'Aceptar invitación'
  const subtitle  = isNewUser
    ? 'Creá tu cuenta para comenzar'
    : 'Hacé clic para unirte al equipo'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Invitación a ${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="color:#00B2A9;font-size:16px;font-weight:700;letter-spacing:-0.3px;">DANTEUP CRM</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Invitación
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:28px 32px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Nueva invitación</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${orgName}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;">${subtitle}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                ${greeting}
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Te invitaron a unirte a <strong style="color:#18181b;">${orgName}</strong> en DANTEUP CRM con el rol de <strong style="color:#18181b;">${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Este enlace es válido por <strong style="color:#18181b;">7 días</strong>. Si no esperabas esta invitación, podés ignorar este email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 6px;color:#a1a1aa;font-size:11px;text-align:center;">
                O copiá este enlace en tu navegador:
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${inviteLink}" style="color:#00B2A9;text-decoration:none;">${inviteLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

export async function sendMonthlyReportEmail({ to, ownerName, orgName, year, month, pdfBuffer }) {
  const monthStr = new Date(year, month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const monthId  = `${year}-${String(month).padStart(2, '0')}`
  const filename = `informe-${orgName.toLowerCase().replace(/\s+/g, '-')}-${monthId}.pdf`
  const subject  = `Informe mensual ${monthStr} — ${orgName}`
  const html     = buildReportEmailHtml({ ownerName, orgName, monthStr, filename })

  await createTransporter().sendMail({
    from: `${orgName} - Informe mensual <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: [{ filename, content: pdfBuffer }],
  })

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
                Generado automáticamente por <strong>DANTEUP CRM</strong>
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

export async function sendQuoteReminderEmail({ to, clientName, orgName, orgLogo, quoteId, quoteNumber, quoteTitle, total, currency }) {
  const publicUrl  = `${FRONTEND_URL}/p/presupuesto/${quoteId}`
  const orgLogoUrl = orgLogo ? `${BACKEND_URL}/uploads/${orgLogo}` : null
  const num        = String(quoteNumber).padStart(3, '0')
  const sym        = currency === 'USD' ? 'US$' : '$'
  const totalFmt   = `${sym}${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const subject = `Recordatorio · Presupuesto #${num} — ${orgName}`
  const html    = buildReminderEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl })

  await createTransporter().sendMail({
    from: `${orgName} - Recordatorio <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })

  console.log(`[email] Recordatorio → ${to} | Presupuesto #${num} | ${publicUrl}`)
}

function buildReminderEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl }) {
  const logoBlock = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="max-height:36px;max-width:120px;object-fit:contain;display:block;">`
    : `<span style="color:#00B2A9;font-size:15px;font-weight:700;letter-spacing:-0.3px;">${orgName}</span>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Recordatorio · Presupuesto #${num}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${logoBlock}
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Recordatorio
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:28px 32px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Presupuesto</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:-1px;">#${num}</h1>
              <p style="margin:0 0 16px;color:rgba(255,255,255,0.85);font-size:14px;">${quoteTitle}</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 18px;">
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Total</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700;">${totalFmt}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                Hola, ${clientName} 👋
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Hace unos días te enviamos el presupuesto <strong style="color:#18181b;">${quoteTitle}</strong> y aún no recibimos tu respuesta.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Si tenés alguna consulta o necesitás algún ajuste, no dudes en contactarnos. El presupuesto sigue disponible en el enlace de abajo.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${publicUrl}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Ver presupuesto
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${publicUrl}" style="color:#00B2A9;text-decoration:none;">${publicUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por
                <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

export async function sendPaymentReminderEmail({
  to, clientName, orgName, orgLogo,
  quoteId, quoteNumber, quoteTitle,
  installmentNumber, installmentTotal, amount, currency
}) {
  const publicUrl  = `${FRONTEND_URL}/p/presupuesto/${quoteId}`
  const orgLogoUrl = orgLogo ? `${BACKEND_URL}/uploads/${orgLogo}` : null
  const num        = String(quoteNumber).padStart(3, '0')
  const sym        = currency === 'USD' ? 'US$' : '$'
  const amountFmt  = `${sym}${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const isFirst   = installmentNumber === 1
  const cuotaLabel = isFirst
    ? 'Primer pago'
    : installmentTotal > 1
      ? `Cuota ${installmentNumber} de ${installmentTotal}`
      : 'Pago'

  const subject = `Recordatorio de pago · ${cuotaLabel} — Presupuesto #${num} — ${orgName}`
  const html    = buildPaymentReminderEmailHtml({
    clientName, orgName, orgLogoUrl, num, quoteTitle,
    cuotaLabel, amountFmt, publicUrl
  })

  await createTransporter().sendMail({
    from: `${orgName} - Recordatorio <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })

  console.log(`[email] Recordatorio de pago → ${to} | ${cuotaLabel} | Presupuesto #${num}`)
}

function buildPaymentReminderEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, cuotaLabel, amountFmt, publicUrl }) {
  const logoBlock = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="max-height:36px;max-width:120px;object-fit:contain;display:block;">`
    : `<span style="color:#00B2A9;font-size:15px;font-weight:700;letter-spacing:-0.3px;">${orgName}</span>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Recordatorio de pago · ${cuotaLabel}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef9f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,178,169,0.10);background:#ffffff;">

          <tr>
            <td style="background:linear-gradient(90deg,#009990,#00B2A9,#33C4BE);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#080e1a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">${logoBlock}</td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;background-color:rgba(0,178,169,0.15);color:#33C4BE;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,178,169,0.3);">
                      Recordatorio de pago
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,#00B2A9,#009990);padding:28px 32px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Presupuesto #${num}</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${cuotaLabel}</h1>
              <p style="margin:0 0 16px;color:rgba(255,255,255,0.85);font-size:14px;">${quoteTitle}</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 18px;">
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Monto a abonar</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${amountFmt}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;font-weight:600;">
                Hola, ${clientName} 👋
              </p>
              <p style="margin:0 0 14px;color:#52525b;font-size:14px;line-height:1.65;">
                Te recordamos que hoy vence el <strong style="color:#18181b;">${cuotaLabel}</strong> del presupuesto <strong style="color:#18181b;">${quoteTitle}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#52525b;font-size:14px;line-height:1.65;">
                Podés revisar el detalle completo del presupuesto en el siguiente enlace. Si ya realizaste el pago, ignorá este mensaje.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${publicUrl}"
                       style="display:inline-block;background-color:#00B2A9;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Ver presupuesto
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${publicUrl}" style="color:#00B2A9;text-decoration:none;">${publicUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#f4f4f5;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Enviado por <a href="https://danteup.com" target="_blank" style="color:#00B2A9;font-weight:600;text-decoration:none;">DANTEUP CRM</a>
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

export async function sendQuoteEmail({ to, clientName, orgName, orgLogo, quoteId, quoteNumber, quoteTitle, total, currency }) {
  const publicUrl   = `${FRONTEND_URL}/p/presupuesto/${quoteId}`
  const orgLogoUrl  = orgLogo ? `${BACKEND_URL}/uploads/${orgLogo}` : null
  const num         = String(quoteNumber).padStart(3, '0')
  const sym         = currency === 'USD' ? 'US$' : '$'
  const totalFmt    = `${sym}${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const subject = `Presupuesto #${num} — ${orgName}`
  const html    = buildEmailHtml({ clientName, orgName, orgLogoUrl, num, quoteTitle, totalFmt, publicUrl })

  await createTransporter().sendMail({
    from: `${orgName} - Presupuesto <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })

  console.log(`[email] Presupuesto → ${to} | #${num} | ${publicUrl}`)
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

          <tr>
            <td style="background-color:#1e293b;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:140px;padding-right:20px;">
                    ${logoCell}
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Presupuesto</p>
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
                Te compartimos el presupuesto <strong style="color:#27272a;">${quoteTitle}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#71717a;font-size:14px;">
                Total: <strong style="color:#27272a;font-size:15px;">${totalFmt}</strong>
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
                Generado por <a href="https://danteup.com" target="_blank" style="color:#71717a;font-weight:600;text-decoration:none;">danteup.com</a>
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
