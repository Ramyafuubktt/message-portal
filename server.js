
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const folder = path.join(__dirname, "Public");

app.use(express.json());
app.use(express.static(folder));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// User page
app.get("/", (req, res) => {
  res.sendFile(path.join(folder, "index.html"));
});

// Admin page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(folder, "admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(folder, "admin.html"));
});

// Save user's five fields
app.post("/api/messages", async (req, res) => {
  const { name, email, subject, message, phone } = req.body;

  if (![name, email, subject, message, phone].every(
    value => typeof value === "string" && value.trim()
  )) {
    return res.status(400).json({
      error: "Please fill in all five fields."
    });
  }

  try {
    await db.query(
      `INSERT INTO messages
       (name, email, subject, message, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        name.trim(),
        email.trim(),
        subject.trim(),
        message.trim(),
        phone.trim()
      ]
    );

    res.json({ message: "Message submitted successfully!" });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({
      error: "Could not save message."
    });
  }
});

// Display all submitted messages - no password
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

// Create database table and start server
async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      phone TEXT NOT NULL,
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

