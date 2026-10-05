import mysql from 'mysql2/promise'
import 'dotenv/config'

const connection = mysql.createPool({
  host: process.env.HOST,
  port: Number(process.env.BD_PORT) || 3306,
  user: process.env.USER_BD,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10
})

export default connection
