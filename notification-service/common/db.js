const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION || 'postgres://postgres:postgres@localhost:5432/orchestrator';

const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
});

async function query(text, params){
  return pool.query(text, params);
}

module.exports = { pool, query };
