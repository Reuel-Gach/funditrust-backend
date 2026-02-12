const { Pool } = require("pg");

// ✅ I transcribed this directly from your screenshot
// I removed "&channel_binding=require" to prevent server crashes
const connectionString = "postgresql://neondb_owner:npg_N9hfYCsikPt5@ep-dry-fire-agoghwaf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon to accept the connection
  },
});

module.exports = pool;