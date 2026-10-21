
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const multer = require("multer");

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

// Image upload: keep image in memory before saving to PostgreSQL
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (allowed.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Upload a JPG, PNG, WEBP, or GIF image."));
    }
  }
});

// Pages
app.get("/", (req, res) => {
  res.sendFile(path.join(publicFolder, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicFolder, "admin.html"));
});

// Submit form and optional image
app.post("/api/messages", (req, res) => {
  upload.single("image")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        error: uploadError.message || "Image upload failed."
      });
    }

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
        error: "Please fill in all required fields correctly."
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date." });
    }

    try {
      await db.query(
        `INSERT INTO messages
         (name, email, phone, submitted_date, marks,
          message, subject, rating, image_data, image_mime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          name.trim(),
          email.trim(),
          phone.trim(),
          date,
          Number(marks),
          message.trim(),
          "General message",
          5,
          req.file ? req.file.buffer : null,
          req.file ? req.file.mimetype : null
        ]
      );

      res.status(201).json({
        message: "Details and image submitted successfully!"
      });
    } catch (err) {
      console.error("Save error:", err.message);
      res.status(500).json({
        error: "Could not save the submission."
      });
    }
  });
});

// Retrieve submissions for Admin
app.get("/api/messages", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, phone, submitted_date, marks,
             message, created_at, image_mime,
             CASE
               WHEN image_data IS NOT NULL
               THEN encode(image_data, 'base64')
               ELSE NULL
             END AS image_base64
      FROM messages
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Load error:", err.message);
    res.status(500).json({
      error: "Could not load submissions."
    });
  }
});

// Create table and safely add columns to an existing table
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
      image_data BYTEA,
      image_mime TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS submitted_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS marks INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'General message',
    ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS image_data BYTEA,
    ADD COLUMN IF NOT EXISTS image_mime TEXT
  `);

  await db.query(`
    UPDATE messages SET submitted_date = CURRENT_DATE
    WHERE submitted_date IS NULL
  `);

  await db.query(`
    UPDATE messages SET marks = 0 WHERE marks IS NULL
  `);

  await db.query(`
    UPDATE messages SET subject = 'General message'
    WHERE subject IS NULL
  `);

  await db.query(`
    UPDATE messages SET rating = 5 WHERE rating IS NULL
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
