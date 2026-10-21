
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const folder = path.join(__dirname, "Public");
const uploadFolder = path.join(folder, "uploads");

// Create uploads folder automatically
fs.mkdirSync(uploadFolder, { recursive: true });

app.use(express.json());
app.use(express.static(folder));

// PostgreSQL connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// Image upload configuration
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadFolder);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, Date.now() + "-" +
      Math.round(Math.random() * 1e9) + extension);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },

  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new Error("Please upload an image file."));
    }
  }
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

// Save user details and uploaded image
app.post("/api/messages", (req, res) => {
  upload.single("image")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        error: uploadError.message
      });
    }

    const { name, email, phone, date } = req.body;

    if (![name, email, phone, date].every(
      value => typeof value === "string" && value.trim()
    )) {
      if (req.file) fs.unlink(req.file.path, () => {});

      return res.status(400).json({
        error: "Please fill in all required fields."
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
          (name, email, phone, submitted_date, image_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          name.trim(),
          email.trim(),
          phone.trim(),
          date,
          imageUrl
        ]
      );

      res.json({
        message: "Details submitted successfully!"
      });

    } catch (err) {
      console.error("Save error:", err.message);

      fs.unlink(req.file.path, () => {});

      res.status(500).json({
        error: "Could not save details to the database."
      });
    }
  });
});

// Display submitted details in Admin Panel
app.get("/api/messages", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        name,
        email,
        phone,
        submitted_date AS date,
        image_url AS "imageUrl",
        created_at
      FROM messages
      ORDER BY id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Load error:", err.message);

    res.status(500).json({
      error: "Could not load messages."
    });
  }
});

// Create or update database structure
async function start() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT,
      phone TEXT NOT NULL,
      submitted_date DATE,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Update existing tables without deleting old records
  await db.query(`
    ALTER TABLE messages
      ALTER COLUMN subject DROP NOT NULL,
      ALTER COLUMN message DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS submitted_date DATE,
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
