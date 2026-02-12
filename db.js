// ...existing code...
const { Pool } = require('pg');

// ⚠️ PASTE YOUR NEON CONNECTION STRING HERE
const connectionString = process.env.NEON_CONNECTION_STRING || 'postgresql://neondb_owner:npg_N9hfYCsikPt5@ep-dry-fire-agoghwaf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

module.exports = pool;
// ...existing code...