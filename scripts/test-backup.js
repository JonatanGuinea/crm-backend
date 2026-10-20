import 'dotenv/config'
import { runDatabaseBackup } from '../src/services/backup.service.js'

console.log('Iniciando prueba de backup...')
await runDatabaseBackup()
console.log('Prueba finalizada.')
process.exit(0)
