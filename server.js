
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const folder = path.join(__dirname, "Public");
const uploadFolder = path.join(folder, "uploads");

fs.mkdirSync(uploadFolder, { recursive: true });

app.use(express.json());
app.use(express.static(folder));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Please select an image."));
    }
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(folder, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(folder, "admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(folder, "admin.html"));
});

// Save message, date of birth and image
app.post("/api/messages", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { name, email, phone, subject, message, dob } = req.body;

    if (![name, email, phone, subject, message, dob].every(
      value => typeof value === "string" && value.trim()
    )) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: "Please fill in all fields."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload an image."
      });
    }

    try {
      const imageUrl = "/uploads/" + req.file.filename;

      await db.query(
        `INSERT INTO messages
         (name, email, subject, message, phone, dob, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          name.trim(),
          email.trim(),
          subject.trim(),
          message.trim(),
          phone.trim(),
          dob,
          imageUrl
        ]
      );

      res.json({ message: "Message submitted successfully!" });
    } catch (err) {
      console.error("Save error:", err.message);
      fs.unlink(req.file.path, () => {});

      res.status(500).json({
        error: "Could not save message."
      });
    }
  });
});

// Display messages in Admin Panel
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

async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      phone TEXT NOT NULL,
      dob DATE,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add the new columns to your existing table
  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS dob DATE,
    ADD COLUMN IF NOT EXISTS image_url TEXT
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
