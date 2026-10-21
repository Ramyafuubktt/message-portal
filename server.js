
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Frontend folder (capital P to match GitHub)
const publicFolder = path.join(__dirname, "Public");

// Middleware
app.use(express.json());
app.use(express.static(publicFolder));

// PostgreSQL connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// ------------------------------
// USER PAGE
// ------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(publicFolder, "index.html"));
});

// ------------------------------
// ADMIN PAGE
// ------------------------------
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicFolder, "admin.html"));
});

// ------------------------------
// SUBMIT USER MESSAGE
// Fields: name, email, phone,
// date, rating, message
// ------------------------------
app.post("/api/messages", async (req, res) => {
  const { name, email, phone, date, rating, message } = req.body;

  // Validate required fields
  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    typeof date !== "string" ||
    typeof message !== "string" || !message.trim() ||
    !Number.isInteger(Number(rating)) ||
    Number(rating) < 1 ||
    Number(rating) > 5
  ) {
    return res.status(400).json({
      error: "Please fill in all fields correctly."
    });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: "Please enter a valid date."
    });
  }

  try {
    // Save data to PostgreSQL
    await db.query(
      `INSERT INTO messages
       (name, email, phone, submitted_date, rating, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        date,
        Number(rating),
        message.trim()
      ]
    );

    res.status(201).json({
      message: "Message submitted successfully!"
    });
  } catch (err) {
    console.error("Save error:", err.message);

    res.status(500).json({
      error: "Could not save your message."
    });
  }
});

// ------------------------------
// GET ALL MESSAGES FOR ADMIN
// No password required
// ------------------------------
app.get("/api/messages", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM messages ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Load error:", err.message);

    res.status(500).json({
      error: "Could not load messages."
    });
  }
});

// ------------------------------
// CREATE TABLE AND START SERVER
// ------------------------------
async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      submitted_date DATE NOT NULL,
      rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add new columns if an older table already exists
  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS submitted_date DATE
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS rating INTEGER
  `);

  // Fill new columns for older records
  await db.query(`
    UPDATE messages
    SET submitted_date = CURRENT_DATE
    WHERE submitted_date IS NULL
  `);

  await db.query(`
    UPDATE messages
    SET rating = 5
    WHERE rating IS NULL
  `);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Message Portal running on port ${PORT}`);
  });
}

// Handle startup or database errors
start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});


start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});
