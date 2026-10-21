
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const publicFolder = path.join(__dirname, "Public");

app.use(express.json());
app.use(express.static(publicFolder));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// User form
app.get("/", (req, res) => {
  res.sendFile(path.join(publicFolder, "index.html"));
});

// Admin dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicFolder, "admin.html"));
});

// Save a submitted message
app.post("/api/messages", async (req, res) => {
  const { name, email, phone, date, rating, message } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    typeof date !== "string" || !date.trim() ||
    typeof message !== "string" || !message.trim() ||
    !Number.isInteger(Number(rating)) ||
    Number(rating) < 1 || Number(rating) > 5
  ) {
    return res.status(400).json({
      error: "Please complete all fields correctly."
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date." });
  }

  try {
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
      message: "Your message was submitted successfully!"
    });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({
      error: "Could not save your message."
    });
  }
});

// Get all submitted messages for the Admin panel
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

// Create table and start server
async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      submitted_date DATE NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
    console.log("Message Portal is running!");
  });
}

start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});


start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});
