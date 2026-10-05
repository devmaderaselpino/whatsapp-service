import cron from 'node-cron'
import connection from '../config/db.js'
import mazatlanHora from '../utils/MazatlanHora.js'
import { enviarYRegistrar, obtenerTemplate } from '../services/whatsapp.service.js'
import { mensajesEnviadosUltimas24h, sleep } from '../functions/whatsappLimits.js'

const LIMITE_DIARIO = 200



//cron.schedule('0 9 * * 1', async () => {
cron.schedule('0 10 * * 1', async () => {
  console.log('📨 Cron: enviando recordatorios a clientes retrasados...')

  try {
    const [templates] = await connection.query(
      "SELECT * FROM wa_templates WHERE nombre = 'recordatorio_pago' AND activo = 1 LIMIT 1"
    )
    if (!templates.length) return console.error('Template recordatorio_pago no encontrado')
    const template = templates[0]
    const paramKeys = typeof template.params === 'string'
      ? JSON.parse(template.params)
      : (template.params || [])

    const [clientes] = await connection.query(`
      SELECT
          ap.idVenta,
          c.idCliente,
          CONCAT(c.nombre, ' ', c.aPaterno) AS nombre,
          c.celular,
          SUM(GREATEST(ap.cantidad - COALESCE(ap.abono, 0), 0)) AS saldo
      FROM abonos_programados ap
      INNER JOIN clientes c
          ON c.idCliente = ap.idCliente
      INNER JOIN ventas v
          ON v.idVenta = ap.idVenta
      WHERE v.status = 1
        AND ap.status = 1
        AND ap.fecha_programada < CURDATE()
        AND c.celular IS NOT NULL
        AND (ap.cantidad - COALESCE(ap.abono, 0)) > 0
        AND NOT EXISTS (
          SELECT 1 FROM wa_mensajes wm
          WHERE wm.idCliente = c.idCliente
            AND wm.status = 'sent'
            AND wm.template_nombre = 'recordatorio_pago'
            AND wm.fecha_envio >= DATE_SUB(NOW(), INTERVAL 6 DAY)
        )
      GROUP BY
          ap.idVenta,
          c.idCliente,
          c.nombre,
          c.aPaterno,
          c.celular
      HAVING saldo > 0
      ORDER BY nombre
    `)

    const yaEnviados = await mensajesEnviadosUltimas24h()
    const disponibles = LIMITE_DIARIO - yaEnviados

    if (disponibles <= 0) {
      console.log('⚠️ Límite diario ya alcanzado, no se enviará nada en este cron.')
      return
    }

    const porEnviar = clientes.slice(0, disponibles)
    const pendientes = clientes.length - porEnviar.length

    console.log(`Retrasados encontrados: ${clientes.length} | Se enviarán: ${porEnviar.length} | Pendientes: ${pendientes}`)

    for (const cliente of porEnviar) {
      const clienteData = {
        nombre: cliente.nombre,
        saldo: String(Number(cliente.saldo).toFixed(2))
      }
      const paramValues = paramKeys.map(key => clienteData[key] || '')

      const { status } = await enviarYRegistrar({
        idCliente: cliente.idCliente,
        celular: cliente.celular,
        template,
        paramValues
      })

      console.log(`  → ${cliente.nombre} [venta ${cliente.idVenta}] [${cliente.celular}]: ${status}`)
      await sleep(1200)
    }

    if (pendientes > 0) {
      console.log(`📌 ${pendientes} clientes quedaron pendientes por límite diario, se intentarán en la próxima ejecución.`)
    }

    console.log('✅ Cron retrasados finalizado')
  } catch (err) {
    console.error('❌ Error cron retrasados:', err)
  }
}, { timezone: 'America/Mazatlan' })


//cron.schedule('0 11 * * 1', async () => {
cron.schedule('0 11 * * 1', async () => {
  console.log('📨 Cron: enviando recordatorios de próximo pago...')
  const hoy = mazatlanHora().slice(0, 10)

  try {
    const [templates] = await connection.query(
      "SELECT * FROM wa_templates WHERE nombre = 'proximo_pago' AND activo = 1 LIMIT 1"
    )
    if (!templates.length) return console.error('Template proximo_pago no encontrado')
    const template = templates[0]
    const paramKeys = typeof template.params === 'string'
      ? JSON.parse(template.params)
      : (template.params || [])

    const [clientes] = await connection.query(`
      SELECT DISTINCT
        ap.idVenta,
        c.idCliente,
        CONCAT(c.nombre, ' ', c.aPaterno) AS nombre,
        c.celular,
        ap.cantidad,
        ap.fecha_programada
      FROM clientes c
      JOIN abonos_programados ap ON ap.idCliente = c.idCliente
      WHERE ap.pagado = 0
        AND ap.status = 1
        AND ap.fecha_programada BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
        AND c.celular IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM abonos_programados ap2
          WHERE ap2.idVenta = ap.idVenta
            AND ap2.pagado = 0
            AND ap2.status = 1
            AND ap2.fecha_programada < ?
        )
    `, [hoy, hoy, hoy])

    const yaEnviados = await mensajesEnviadosUltimas24h()
    const disponibles = LIMITE_DIARIO - yaEnviados

    if (disponibles <= 0) {
      console.log('⚠️ Límite diario ya alcanzado, no se enviará nada en este cron.')
      return
    }

    const porEnviar = clientes.slice(0, disponibles)
    const pendientes = clientes.length - porEnviar.length

    console.log(`Próximos pagos encontrados: ${clientes.length} | Se enviarán: ${porEnviar.length} | Pendientes: ${pendientes}`)

    for (const cliente of porEnviar) {
      const clienteData = {
        nombre: cliente.nombre,
        cantidad: String(Number(cliente.cantidad).toFixed(2)),
        fecha_programada: new Date(cliente.fecha_programada)
          .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      }
      const paramValues = paramKeys.map(key => clienteData[key] || '')

      const { status } = await enviarYRegistrar({
        idCliente: cliente.idCliente,
        celular: cliente.celular,
        template,
        paramValues
      })

      console.log(`  → ${cliente.nombre} [venta ${cliente.idVenta}] [${cliente.celular}]: ${status}`)
      await sleep(1200)
    }

    if (pendientes > 0) {
      console.log(`📌 ${pendientes} clientes quedaron pendientes por límite diario, se intentarán en la próxima ejecución.`)
    }

    console.log('✅ Cron próximo pago finalizado')
  } catch (err) {
    console.error('❌ Error cron próximo pago:', err)
  }
}, { timezone: 'America/Mazatlan' })

console.log('⏰ Cronjobs de WhatsApp inicializados')