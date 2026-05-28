import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: DATABASE_URL is not configured. Database operations will fail.');
}

// Setup Neon DB PG Connection Pool
// Neon PostgreSQL requires SSL configuration when connecting from external services
export const dbPool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false,
});

// Event listener for database connection success
dbPool.on('connect', () => {
  console.log('Successfully connected to Neon PostgreSQL Database.');
});

// Event listener for connection errors
dbPool.on('error', (err) => {
  console.error('Unexpected error on idle Neon PostgreSQL client:', err);
});

/**
 * Execute a query.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>} Query response
 */
export const query = (text, params) => dbPool.query(text, params);
