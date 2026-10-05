import axios from 'axios'
import db from '../config/db.js'
import dotenv from 'dotenv'
dotenv.config()

const PHONE_ID = process.env.WA_PHONE_NUMBER_ID
const TOKEN = process.env.WA_ACCESS_TOKEN
const API_URL = `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`


export async function enviarTemplate({ telefono, templateName, idioma = 'es_MX', params = [] }) {
  const body = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'template',
    template: {
      name: templateName,
      language: { code: idioma },
      components: params.length > 0 ? [{
        type: 'body',
        parameters: params.map(text => ({ type: 'text', text: String(text) }))
      }] : []
    }
  }

  const res = await axios.post(API_URL, body, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  })

  return res.data
}


export async function enviarYRegistrar({ idCliente, celular, template, paramValues }) {
  const telefono = `52${celular.replace(/\D/g, '')}`
  let status = 'sent'
  let wamid = null

  try {
    const result = await enviarTemplate({
      telefono,
      templateName: template.nombre,
      idioma: template.idioma,
      params: paramValues
    })
    wamid = result.messages?.[0]?.id || null
  } catch (err) {
    status = 'failed'
    console.error(`WhatsApp error [${celular}]:`, err.response?.data?.error?.message || err.message)
  }

  await db.query(
    `INSERT INTO wa_mensajes 
     (idCliente, celular, idTemplate, template_nombre, params, status, wamid, fecha_envio)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [idCliente, telefono, template.id, template.nombre,
     JSON.stringify(paramValues), status, wamid]
  )

  return { status, wamid, telefono }
}


export async function obtenerTemplate(nombre) {
  const [rows] = await db.query(
    'SELECT * FROM wa_templates WHERE nombre = ? AND activo = 1 LIMIT 1',
    [nombre]
  )
  if (!rows.length) throw new Error(`Template '${nombre}' no encontrado`)
  const t = rows[0]
  return { ...t, params: typeof t.params === 'string' ? JSON.parse(t.params) : (t.params || []) }
}