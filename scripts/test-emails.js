import 'dotenv/config'
import {
  sendPasswordResetEmail,
  sendPasswordChangeEmail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendMonthlyReportEmail,
  sendQuoteReminderEmail,
  sendPaymentReminderEmail,
  sendQuoteEmail,
  sendBackupFailureEmail,
} from '../src/services/email.service.js'

const TEST_TO = 'jonatanguinea@outlook.com'

const tests = [
  {
    name: '1. Reset de contraseña',
    fn: () => sendPasswordResetEmail({
      to: TEST_TO,
      name: 'Jonathan',
      token: 'tok_test_reset_abc123',
    }),
  },
  {
    name: '2. Cambio de contraseña',
    fn: () => sendPasswordChangeEmail({
      to: TEST_TO,
      name: 'Jonathan',
      token: 'tok_test_change_xyz789',
    }),
  },
  {
    name: '3. Verificación de cuenta',
    fn: () => sendVerificationEmail({
      to: TEST_TO,
      name: 'Jonathan',
      token: 'tok_test_verify_def456',
    }),
  },
  {
    name: '4. Invitación (nuevo usuario)',
    fn: () => sendInvitationEmail({
      to: TEST_TO,
      inviteeName: 'Jonathan',
      orgName: 'Estudio DanteUP',
      role: 'admin',
      inviteLink: 'http://localhost:5173/invite?token=tok_inv_test',
      isNewUser: true,
    }),
  },
  {
    name: '5. Invitación (usuario existente)',
    fn: () => sendInvitationEmail({
      to: TEST_TO,
      inviteeName: 'Jonathan',
      orgName: 'Estudio DanteUP',
      role: 'member',
      inviteLink: 'http://localhost:5173/invite?token=tok_inv_existing',
      isNewUser: false,
    }),
  },
  {
    name: '6. Informe mensual',
    fn: () => sendMonthlyReportEmail({
      to: TEST_TO,
      ownerName: 'Jonathan',
      orgName: 'Estudio DanteUP',
      year: 2026,
      month: 10,
      pdfBuffer: Buffer.from('%PDF-1.4 test pdf content'),
    }),
  },
  {
    name: '7. Envío de presupuesto',
    fn: () => sendQuoteEmail({
      to: TEST_TO,
      clientName: 'Carlos Rodríguez',
      orgName: 'Estudio DanteUP',
      orgLogo: null,
      quoteId: 'cltest123',
      quoteNumber: 7,
      quoteTitle: 'Diseño de identidad visual — Marca XYZ',
      total: 85000,
      currency: 'ARS',
    }),
  },
  {
    name: '8. Recordatorio de presupuesto',
    fn: () => sendQuoteReminderEmail({
      to: TEST_TO,
      clientName: 'Carlos Rodríguez',
      orgName: 'Estudio DanteUP',
      orgLogo: null,
      quoteId: 'cltest123',
      quoteNumber: 7,
      quoteTitle: 'Diseño de identidad visual — Marca XYZ',
      total: 85000,
      currency: 'ARS',
    }),
  },
  {
    name: '9. Recordatorio de pago (cuota 2/3)',
    fn: () => sendPaymentReminderEmail({
      to: TEST_TO,
      clientName: 'Carlos Rodríguez',
      orgName: 'Estudio DanteUP',
      orgLogo: null,
      quoteId: 'cltest123',
      quoteNumber: 7,
      quoteTitle: 'Diseño de identidad visual — Marca XYZ',
      installmentNumber: 2,
      installmentTotal: 3,
      amount: 28333.33,
      currency: 'ARS',
    }),
  },
  {
    name: '10. Alerta de backup fallido',
    fn: () => sendBackupFailureEmail('ECONNREFUSED 127.0.0.1:5432 — test error desde script de prueba'),
  },
]

console.log(`\nEnviando ${tests.length} emails de prueba → ${TEST_TO}\n`)

for (const test of tests) {
  process.stdout.write(`  ${test.name} ... `)
  try {
    await test.fn()
    console.log('✓')
  } catch (err) {
    console.log(`✗  ${err.message}`)
  }
}

console.log('\nListo.\n')
process.exit(0)
