import connection from '../config/db.js'

export async function mensajesEnviadosUltimas24h() {
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM wa_mensajes
    WHERE status = 'sent'
      AND fecha_envio >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `)
  return rows[0].total
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}