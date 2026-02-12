const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db"); // Ensure you have your db.js file setup
const axios = require('axios'); // For M-Pesa
const moment = require('moment'); // For M-Pesa Timestamps

// MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for photo uploads

// --- 🦁 YOUR REAL M-PESA CREDENTIALS (TRIMMED) 🦁 ---
const consumerKey = "tRX6NE3RkWczKfcr0eYVAzWi6OnuB7y0OMFKXfBrLWcGsuu3".trim();
const consumerSecret = "4GFGGfLaQVb5U24w2HFhCZHByolMCosHdWUXQfd8uZGd1GAjyjd84YoB7zjROpyz".trim();
const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // Sandbox Passkey
const shortcode = "174379"; // Sandbox Shortcode

// --- HELPER: GET OAUTH TOKEN ---
const getAccessToken = async () => {
  // Create the Basic Auth string (Buffer.from is safer for newer Node versions)
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  try {
    console.log("🔑 Generatng Token...");
    
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    
    console.log("✅ Token Generated!");
    return response.data.access_token;
  } catch (error) {
    console.error("❌ TOKEN ERROR:", error.response ? error.response.data : error.message);
    throw error;
  }
};

// ================= ROUTES ================= //

// 1. REGISTER A NEW FUNDI (With Photo)
app.post("/api/register", async (req, res) => {
  try {
    const { name, skill, phone, locationName, image } = req.body;
    
    // Default Nairobi Coordinates (You can add Geocoding here if needed)
    let lat = -1.2921, lng = 36.8219; 

    // Handle Image Logic
    let finalImageUrl = image;
    if (!image) {
      const encodedName = encodeURIComponent(name);
      finalImageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodedName}`;
    }

    const newFundi = await pool.query(
      "INSERT INTO fundis (name, skill, phone, lat, lng, image_url, verified, rating, vouches, jobs) VALUES($1, $2, $3, $4, $5, $6, FALSE, 0, 0, 0) RETURNING *",
      [name, skill, phone, lat, lng, finalImageUrl]
    );

    res.json(newFundi.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. GET ALL FUNDIS
app.get("/api/fundis", async (req, res) => {
  try {
    const allFundis = await pool.query("SELECT * FROM fundis");
    res.json(allFundis.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. GET REVIEWS FOR A FUNDI
app.get("/api/reviews/:fundiId", async (req, res) => {
  try {
    const { fundiId } = req.params;
    const reviews = await pool.query(
      "SELECT * FROM reviews WHERE fundi_id = $1 ORDER BY id DESC",
      [fundiId]
    );
    res.json(reviews.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// 4. ADD A REVIEW (Update Rating)
app.post("/api/reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // A. Add the review
    await pool.query(
      "INSERT INTO reviews (fundi_id, rating, comment) VALUES ($1, $2, $3)",
      [id, rating, comment]
    );

    // B. Recalculate Average Rating
    const result = await pool.query("SELECT AVG(rating) as avg_rating FROM reviews WHERE fundi_id = $1", [id]);
    const newAverage = parseFloat(result.rows[0].avg_rating).toFixed(1);

    // C. Update Fundi Stats
    await pool.query(
      "UPDATE fundis SET rating = $1, vouches = vouches + 1, jobs = jobs + 1 WHERE id = $2",
      [newAverage, id]
    );

    res.json({ message: "Review Added" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// 5. ADMIN: VERIFY FUNDI
app.put("/api/verify/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = await pool.query(
      "UPDATE fundis SET verified = TRUE WHERE id = $1 RETURNING *",
      [id]
    );
    res.json({ message: "Fundi Verified Successfully!", fundi: update.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// 6. ADMIN: DELETE FUNDI (The Ban Hammer 🔨)
app.delete("/api/fundis/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM reviews WHERE fundi_id = $1", [id]);
    await pool.query("DELETE FROM fundis WHERE id = $1", [id]);
    res.json({ message: "Fundi Deleted Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// 7. 🚀 REAL M-PESA STK PUSH (With Custom Amount) 🚀
app.post("/api/mpesa", async (req, res) => {
  const { phone, amount } = req.body; // ✅ Now receiving amount from frontend
  
  // Validation: Ensure amount is valid
  if (!amount || isNaN(amount) || amount < 1) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  // Format Phone: Remove leading 0 or +, ensure it starts with 254
  let formattedPhone = phone.replace("+", "");
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "254" + formattedPhone.substring(1);
  }

  const timestamp = moment().format("YYYYMMDDHHmmss");
  const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

  try {
    const token = await getAccessToken();

    // ✅ YOUR NGROK URL (Ensure this matches your terminal)
    const callbackUrl = "https://noninterpolative-colette-reprovingly.ngrok-free.dev/api/callback"; 

    console.log(`📡 Sending STK Push of KES ${amount} to ${formattedPhone}...`);

    const stkResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount, // ✅ UPDATED: Sends the User's Amount
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: "FundiTrust",
        TransactionDesc: "Service Payment"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("✅ STK Push Request Sent:", stkResponse.data);
    
    res.json({ 
      success: true, 
      message: "STK Push Sent! Check your phone.", 
      checkoutRequestID: stkResponse.data.CheckoutRequestID 
    });

  } catch (error) {
    console.error("❌ M-Pesa Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, message: "Failed to initiate M-Pesa payment." });
  }
});

// 8. M-PESA CALLBACK (Receipt Receiver)
app.post("/api/callback", (req, res) => {
  console.log("📩 M-Pesa Callback Received:", JSON.stringify(req.body, null, 2));
  
  // Here you would check ResultCode === 0 to confirm payment success
  
  res.send("Callback Received");
});

// Use the Port Render gives us, or 5000 if on Localhost
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});