const { Pool } = require("pg");

// ✅ This tells it: "Use the Render Secret if online, or my local one if on laptop"
const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_N9hfYCsikPt5@ep-dry-fire-agoghwaf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;