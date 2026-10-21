
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const publicFolder = path.join(__dirname, "Public");

app.use(express.json());
app.use(express.static(publicFolder));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// User home page
app.get("/", (req, res) => {
  res.sendFile(path.join(publicFolder, "index.html"));
});

// Admin dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicFolder, "admin.html"));
});

// Submit and save a message
app.post("/api/messages", async (req, res) => {
  const { name, email, phone, date, marks, message } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    typeof date !== "string" ||
    typeof message !== "string" || !message.trim() ||
    !Number.isInteger(Number(marks)) ||
    Number(marks) < 0 || Number(marks) > 100
  ) {
    return res.status(400).json({
      error: "Please fill in all fields correctly."
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: "Please enter a valid date."
    });
  }

  try {
    await db.query(
      `INSERT INTO messages
       (name, email, phone, submitted_date, marks, message, subject, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        date,
        Number(marks),
        message.trim(),
        "General message",
        5
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

// Get messages for the Admin page (no password)
app.get("/api/messages", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, submitted_date,
              marks, message, created_at
       FROM messages
       ORDER BY id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Load error:", err.message);
    res.status(500).json({
      error: "Could not load messages."
    });
  }
});

// Create or update the table for this version
async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      submitted_date DATE NOT NULL DEFAULT CURRENT_DATE,
      marks INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'General message',
      rating INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add missing columns to an older table without deleting data
  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS submitted_date DATE DEFAULT CURRENT_DATE
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS marks INTEGER DEFAULT 0
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'General message'
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5
  `);

  await db.query(`
    UPDATE messages
    SET submitted_date = CURRENT_DATE
    WHERE submitted_date IS NULL
  `);

  await db.query(`
    UPDATE messages
    SET marks = 0
    WHERE marks IS NULL
  `);

  await db.query(`
    UPDATE messages
    SET subject = 'General message'
    WHERE subject IS NULL
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

start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});



start().catch(err => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});
