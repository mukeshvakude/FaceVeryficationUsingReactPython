import mysql from "mysql2/promise";
import pg from "pg";

const { Pool: PgPool } = pg;

// Determine database type based on environment
const DB_TYPE = process.env.DB_TYPE || 
  (process.env.DATABASE_HOST?.includes('pg.psdb.cloud') || 
   process.env.DB_HOST?.includes('pg.psdb.cloud') || 
   process.env.DATABASE_PORT === '5432' || 
   process.env.DB_PORT === '5432' ? 'postgresql' : 'mysql');

let pool;

// MySQL Pool
if (DB_TYPE === 'mysql') {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || process.env.DATABASE_HOST || process.env.DB_HOST || "localhost",
    user: process.env.MYSQL_USER || process.env.DATABASE_USERNAME || process.env.DB_USER || "root",
    password: process.env.MYSQL_PASSWORD || process.env.DATABASE_PASSWORD || process.env.DB_PASS || "root",
    database: process.env.MYSQL_DB || process.env.DATABASE_NAME || process.env.DB_NAME || "face_verification_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.MYSQL_HOST?.includes('psdb.cloud') ? { rejectUnauthorized: true } : undefined
  });
  console.log("🔧 Using MySQL database");
}

// PostgreSQL Pool
if (DB_TYPE === 'postgresql') {
  pool = new PgPool({
    host: process.env.DATABASE_HOST || process.env.DB_HOST || process.env.POSTGRES_HOST,
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DATABASE_USERNAME || process.env.DB_USER || process.env.POSTGRES_USER,
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASS || process.env.POSTGRES_PASSWORD,
    database: process.env.DATABASE_NAME || process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres',
    ssl: { rejectUnauthorized: false },
    max: 10
  });
  console.log("🔧 Using PostgreSQL database");
}

// Unified interface
export const dbQuery = async (query, params = []) => {
  if (DB_TYPE === 'mysql') {
    const [rows] = await pool.execute(query, params);
    return rows;
  } else if (DB_TYPE === 'postgresql') {
    // Convert MySQL placeholders (?) to PostgreSQL ($1, $2, etc.)
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
    
    const result = await pool.query(pgQuery, params);
    return result.rows;
  }
};

export const getConnection = async () => {
  if (DB_TYPE === 'mysql') {
    return await pool.getConnection();
  } else if (DB_TYPE === 'postgresql') {
    const client = await pool.connect();
    
    // Map PostgreSQL lowercase columns to camelCase for JavaScript
    const mapRowKeys = (row) => {
      if (!row) return row;
      return {
        ...row,
        passwordHash: row.passwordhash || row.passwordHash,
        createdAt: row.createdat || row.createdAt,
        faceImagePath: row.faceimagepath || row.faceImagePath,
        faceImageData: row.faceimagedata || row.faceImageData
      };
    };
    
    // Wrap execute method to match mysql2 interface
    client.execute = async (query, params) => {
      let pgQuery = query;
      let paramIndex = 1;
      pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
      const result = await client.query(pgQuery, params);
      // Map lowercase column names to camelCase
      const mappedRows = result.rows.map(mapRowKeys);
      return [mappedRows];
    };
    return client;
  }
};

export const getDbType = () => DB_TYPE;

export default pool;
