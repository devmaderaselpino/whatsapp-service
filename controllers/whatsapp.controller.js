import db from '../config/db.js'
import { enviarYRegistrar, obtenerTemplate } from '../services/whatsapp.service.js'

// GET /templates
export async function getTemplates(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM wa_templates WHERE activo = 1 ORDER BY fecha_reg DESC'
    )
    res.json({ ok: true, data: rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// POST /templates
export async function crearTemplate(req, res) {
  try {
    const { nombre, descripcion, idioma = 'es_MX', params = [] } = req.body
    const [result] = await db.query(
      'INSERT INTO wa_templates (nombre, descripcion, idioma, params, fecha_reg) VALUES (?, ?, ?, ?, NOW())',
      [nombre, descripcion, idioma, JSON.stringify(params)]
    )
    const [rows] = await db.query('SELECT * FROM wa_templates WHERE id = ?', [result.insertId])
    res.json({ ok: true, data: rows[0] })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// PUT /templates/:id
export async function actualizarTemplate(req, res) {
  try {
    const { id } = req.params
    const { nombre, descripcion, idioma = 'es_MX', params = [] } = req.body
    await db.query(
      'UPDATE wa_templates SET nombre=?, descripcion=?, idioma=?, params=? WHERE id=?',
      [nombre, descripcion, idioma, JSON.stringify(params), id]
    )
    const [rows] = await db.query('SELECT * FROM wa_templates WHERE id = ?', [id])
    res.json({ ok: true, data: rows[0] })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// DELETE /templates/:id
export async function eliminarTemplate(req, res) {
  try {
    await db.query('UPDATE wa_templates SET activo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true, message: 'Template eliminado' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// POST /enviar/individual
export async function enviarIndividual(req, res) {
  try {
    const { idCliente, templateNombre } = req.body

    const [clientes] = await db.query(`
      SELECT 
        c.idCliente,
        CONCAT(c.nombre, ' ', c.aPaterno) AS nombre,
        c.celular,
        (SELECT COALESCE(SUM(ap.cantidad), 0)
         FROM abonos_programados ap
         WHERE ap.idCliente = c.idCliente
           AND ap.pagado = 0 AND ap.status = 1
           AND ap.fecha_programada < CURDATE()) AS saldo
      FROM clientes c WHERE c.idCliente = ?
    `, [idCliente])

    if (!clientes.length) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' })
    const cliente = clientes[0]
    if (!cliente.celular) return res.status(400).json({ ok: false, error: 'Cliente sin celular' })

    const template = await obtenerTemplate(templateNombre)
    const clienteData = {
      nombre: cliente.nombre,
      saldo: String(Number(cliente.saldo).toFixed(2)),
      celular: cliente.celular
    }
    const paramValues = template.params.map(key => clienteData[key] || '')

    const result = await enviarYRegistrar({
      idCliente: cliente.idCliente,
      celular: cliente.celular,
      template,
      paramValues
    })

    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// POST /enviar/masivo
export async function enviarMasivo(req, res) {
  try {
    const { idRuta, templateNombre } = req.body

    const [clientes] = await db.query(`
      SELECT 
        ar.idCliente,
        CONCAT(c.nombre, ' ', c.aPaterno) AS nombre,
        c.celular,
        (SELECT COALESCE(SUM(ap.cantidad), 0)
         FROM abonos_programados ap
         WHERE ap.idCliente = ar.idCliente
           AND ap.pagado = 0 AND ap.status = 1
           AND ap.fecha_programada < CURDATE()) AS saldo
      FROM asignacion_rutas ar
      JOIN clientes c ON c.idCliente = ar.idCliente
      WHERE ar.idRuta = ? AND ar.status = 1
        AND ar.idCliente IS NOT NULL
        AND c.celular IS NOT NULL
      HAVING saldo > 0
    `, [idRuta])

    const template = await obtenerTemplate(templateNombre)
    let enviados = 0, fallidos = 0
    const detalle = []

    for (const cliente of clientes) {
      const clienteData = {
        nombre: cliente.nombre,
        saldo: String(Number(cliente.saldo).toFixed(2)),
        celular: cliente.celular
      }
      const paramValues = template.params.map(key => clienteData[key] || '')
      const result = await enviarYRegistrar({
        idCliente: cliente.idCliente,
        celular: cliente.celular,
        template,
        paramValues
      })

      result.status === 'sent' ? enviados++ : fallidos++
      detalle.push({ idCliente: cliente.idCliente, cliente: cliente.nombre, ...result })
    }

    res.json({ ok: true, data: { enviados, fallidos, detalle } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// GET /historial
export async function getHistorial(req, res) {
  try {
    const { idCliente, limit = 50 } = req.query
    let query = `
      SELECT m.*, CONCAT(c.nombre,' ',c.aPaterno) as cliente
      FROM wa_mensajes m
      JOIN clientes c ON m.idCliente = c.idCliente
    `
    const values = []
    if (idCliente) {
      query += ' WHERE m.idCliente = ?'
      values.push(idCliente)
    }
    query += ' ORDER BY m.fecha_envio DESC LIMIT ?'
    values.push(Number(limit))

    const [rows] = await db.query(query, values)
    res.json({ ok: true, data: rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}