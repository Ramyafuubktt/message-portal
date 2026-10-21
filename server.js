
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/messages", async (req, res) => {
  const { name, email, subject, message, phone } = req.body;

  if (![name, email, subject, message, phone].every(
    v => typeof v === "string" && v.trim()
  )) {
    return res.status(400).json({
      error: "Fill in all five fields."
    });
  }

  try {
    await db.query(
      `INSERT INTO messages (name, email, subject, message, phone)
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
    console.error(err.message);
    res.status(500).json({ error: "Could not save message." });
  }
});

app.get("/api/messages", async (req, res) => {
  if (
    !process.env.ADMIN_PASSWORD ||
    req.get("x-admin-password") !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: "Incorrect admin password."
    });
  }

  try {
    const result = await db.query(
      "SELECT * FROM messages ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not load messages." });
  }
});

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
