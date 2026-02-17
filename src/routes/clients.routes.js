import { Router } from 'express'
import { createClient, getClients , getClientById, updateClient, deleteClient} from '../controllers/clients.controller.js'
import { auth } from '../middlewares/auth.middleware.js'


const router = Router()

router.post('/', auth, createClient)
router.get('/', auth, getClients)
router.get('/:id', auth, getClientById)
router.put('/:id',auth, updateClient )
router.delete('/:id',auth, deleteClient)


export default router
