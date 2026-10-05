import { Router } from 'express'
import {
  getTemplates, crearTemplate, actualizarTemplate, eliminarTemplate,
  enviarIndividual, enviarMasivo, getHistorial
} from '../controllers/whatsapp.controller.js'

const router = Router()

router.get('/templates', getTemplates)
router.post('/templates', crearTemplate)
router.put('/templates/:id', actualizarTemplate)
router.delete('/templates/:id', eliminarTemplate)

router.post('/enviar/individual', enviarIndividual)
router.post('/enviar/masivo', enviarMasivo)

router.get('/historial', getHistorial)

export default router