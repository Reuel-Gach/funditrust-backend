const { Pool } = require("pg");

// ✅ Your NEON.TECH Connection String (From your screenshot)
const connectionString = "postgresql://neondb_owner:npg_N9hfYCsikPt5@ep-dry-fire-agoghwaf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

module.exports = pool;