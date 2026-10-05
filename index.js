import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import whatsappRoutes from './routes/whatsapp.routes.js'
import './jobs/cronjobs.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/whatsapp', whatsappRoutes)

app.get('/', (req, res) => res.json({ ok: true, message: 'WhatsApp Service running 🚀' }))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 WhatsApp Service corriendo en puerto ${PORT}`))