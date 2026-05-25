require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Optional Sentry integration: enabled when SENTRY_DSN is provided in env
let Sentry; // may remain undefined if not configured
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      // Do not sample traces by default; enable by setting SENTRY_TRACES_SAMPLE_RATE
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    console.log('Sentry initialized');
  } catch (e) {
    console.warn('Failed to initialize Sentry:', e && e.message ? e.message : e);
    Sentry = undefined;
  }
}

const { admin, initializeFirebase } = require("./firebase");
const { initializeDatabase } = require("./db");
const { getLast10ReadingsPerDevice, runSyncWorker } = require("./sync");
const { safeErrorResponse } = require("./lib/safeError");
const helmet = require("helmet");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = Number(process.env.PORT || 4000);
const rateLimitBuckets = new Map();

const AUTH_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const GENERAL_LIMIT = { limit: 60, windowMs: 60 * 1000 };
const AI_LIMIT = { limit: 10, windowMs: 60 * 1000 };
const UPLOAD_LIMIT = { limit: 5, windowMs: 60 * 1000 };

const sanitizeText = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown-ip";
};

const getRequestCategory = (req) => {
  const path = req.path || req.originalUrl || "";

  if (/^(\/api)?\/(auth|login|register|password-reset|reset-password|forgot-password)(\/|$)/i.test(path)) {
    return { scope: "auth", ...AUTH_LIMIT, key: getClientIp(req) };
  }

  if (/^(\/api)?\/(upload|uploads)(\/|$)/i.test(path)) {
    return { scope: "upload", ...UPLOAD_LIMIT, key: getClientIp(req) };
  }

  if (/^(\/api)?\/(ai|llm|proxy)(\/|$)/i.test(path)) {
    return {
      scope: "ai",
      ...AI_LIMIT,
      key: sanitizeText(req.headers["x-user-id"] || getClientIp(req), 128) || getClientIp(req),
    };
  }

  return { scope: "general", ...GENERAL_LIMIT, key: getClientIp(req) };
};

const rateLimitMiddleware = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  const { scope, limit, windowMs, key } = getRequestCategory(req);
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    console.warn(`[rate-limit] ${scope} blocked for ${key}`);
    return res.status(429).set("Retry-After", String(retryAfterSeconds)).json({
      success: false,
      message: "Too Many Requests",
      retryAfterSeconds,
    });
  }

  bucket.count += 1;
  return next();
};

const requireAdminFirebaseAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || "";
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Missing authentication token",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    const { firestore } = initializeFirebase();
    const userDoc = await firestore.collection("users").doc(decodedToken.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : null;

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.authUser = {
      uid: decodedToken.uid,
      role,
    };

    return next();
  } catch (error) {
    return safeErrorResponse(res, 401, "Invalid or expired authentication token", error, {
      middleware: "requireAdminFirebaseAuth",
    });
  }
};

app.set("trust proxy", 1);

// Configure CORS with an explicit whitelist from environment variables.
// Never use wildcard CORS in production. Set `CORS_ALLOWED_ORIGINS` to a
// comma-separated list of allowed origins (e.g. https://app.example.com).
const allowedOriginsEnv = String(process.env.CORS_ALLOWED_ORIGINS || "");
const allowedOrigins = allowedOriginsEnv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";
const defaultDevOrigins = ["http://localhost:8081", "http://localhost:5173", "http://localhost:3000"];
if (!isProduction && allowedOrigins.length === 0) {
  // In development allow common local origins to reduce friction.
  allowedOrigins.push(...defaultDevOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server) which usually have no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: String(process.env.CORS_ALLOW_CREDENTIALS || "false").toLowerCase() === "true",
  optionsSuccessStatus: 204,
};

// Security headers via Helmet
app.disable("x-powered-by");

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https:'],
  styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:'],
  fontSrc: ["'self'", 'https:', 'data:'],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
};

app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: cspDirectives,
  }),
);
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet.hsts({
      maxAge: 60 * 60 * 24 * 365,
      includeSubDomains: true,
      preload: true,
    }),
  );
}

app.use((req, res, next) => {
  // Attach a small header listing configured origins for easier debugging in dev
  res.setHeader("X-Allowed-Origins", allowedOrigins.join(",") || "none");
  return next();
});

app.use(require("cors")(corsOptions));
app.options("*", require("cors")(corsOptions));

// If Sentry is enabled, add its request handler before other middleware
if (Sentry) {
  try {
    app.use(Sentry.Handlers.requestHandler());
  } catch (e) {
    console.warn('Failed to attach Sentry request handler:', e && e.message ? e.message : e);
  }
}
app.use(express.json());
app.use(rateLimitMiddleware);

// File upload safety configuration
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_TYPES = {
  images: {
    mime: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    ext: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    maxSize: 5 * 1024 * 1024,
  },
  documents: {
    mime: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
    ext: [".pdf", ".doc", ".docx", ".txt"],
    maxSize: 25 * 1024 * 1024,
  },
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: ALLOWED_TYPES.documents.maxSize }, // global max 25MB
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype;
    const ext = path.extname(file.originalname).toLowerCase();

    const isImage = ALLOWED_TYPES.images.mime.includes(mime) && ALLOWED_TYPES.images.ext.includes(ext);
    const isDoc = ALLOWED_TYPES.documents.mime.includes(mime) && ALLOWED_TYPES.documents.ext.includes(ext);

    if (!isImage && !isDoc) {
      return cb(new Error("Invalid file type"));
    }

    return cb(null, true);
  },
});

// Upload endpoint: accepts field `file`. Validates type/size, renames to UUID, sets safe permissions.
app.post("/upload", rateLimitMiddleware, (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return safeErrorResponse(res, 400, "File upload failed", err, { route: "/upload", ip: getClientIp(req) });
    }
    if (err) {
      return safeErrorResponse(res, 400, "Invalid file", err, { route: "/upload", ip: getClientIp(req) });
    }

    const f = req.file;
    if (!f) {
      return safeErrorResponse(res, 400, "No file uploaded", null, { route: "/upload", ip: getClientIp(req) });
    }

    // Additional per-type size enforcement
    const mime = f.mimetype;
    const ext = path.extname(f.originalname).toLowerCase();
    const isImage = ALLOWED_TYPES.images.mime.includes(mime) && ALLOWED_TYPES.images.ext.includes(ext);

    if (isImage && f.size > ALLOWED_TYPES.images.maxSize) {
      // remove file
      try { fs.unlinkSync(f.path); } catch (_) {}
      return safeErrorResponse(res, 413, "Image too large");
    }

    // Ensure no executable permissions
    try {
      fs.chmodSync(f.path, 0o644);
    } catch (chmodErr) {
      console.warn("Failed to set file permissions:", chmodErr);
    }

    // TODO: optionally scan file for malware here (integrate with antivirus/cloud API)

    // Return sanitized response; do not expose original filename
    return res.json({ success: true, filename: path.basename(f.path), size: f.size, mime: f.mimetype });
  });
});

// (Optional) attach validation helpers for route authors
app.locals.validate = require("./lib/validate");

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Returns the latest 10 readings for every device, grouped by device_id.
app.get("/readings", requireAdminFirebaseAuth, async (req, res) => {
  try {
    const grouped = await getLast10ReadingsPerDevice();
    const sanitizedGrouped = Object.fromEntries(
      Object.entries(grouped).map(([deviceId, readings]) => [
        sanitizeText(deviceId, 128),
        readings.map((reading) => ({
          ...reading,
          device_id: sanitizeText(reading.device_id, 128),
          status: sanitizeText(reading.status, 32),
          user_id: sanitizeText(reading.user_id, 128),
        })),
      ]),
    );

    res.json({ success: true, data: sanitizedGrouped });
  } catch (error) {
    safeErrorResponse(res, 500, "Unable to fetch readings", error, { route: "/readings" });
  }
});

async function startServer() {
  try {
    initializeFirebase();
    let dbAvailable = true;

    try {
      await initializeDatabase();
    } catch (dbErr) {
      dbAvailable = false;
      console.error("Database initialization failed:", dbErr && dbErr.message ? dbErr.message : dbErr);
      console.error("Continuing without DB. Sync worker disabled. Set correct MYSQL credentials in backend/.env to enable DB.");
    }

    if (dbAvailable) {
      try {
        await runSyncWorker();
      } catch (syncErr) {
        console.error("Sync worker failed to start:", syncErr);
      }
    }

    // Expose DB availability to request handlers via app.locals
    app.locals.dbAvailable = dbAvailable;

    const server = app.listen(port, () => {
      console.log(`HydroSentinal backend running on http://localhost:${port}`);
      if (!dbAvailable) console.log("NOTE: MySQL unavailable — reading sync disabled.");
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        const newPort = port + 1;
        console.warn(`Port ${port} in use, trying ${newPort}`);
        const fallback = app.listen(newPort, () => {
          console.log(`HydroSentinal backend running on http://localhost:${newPort}`);
        });
        fallback.on('error', (err2) => {
          if (err2 && err2.code === 'EADDRINUSE') {
            console.warn(`Port ${newPort} also in use, starting on a random free port`);
            const randomServer = app.listen(0, () => {
              const actual = randomServer.address().port;
              console.log(`HydroSentinal backend running on http://localhost:${actual}`);
            });
            randomServer.on('error', (err3) => {
              console.error('Failed to start server on random port:', err3);
              process.exitCode = 1;
            });
          } else {
            console.error('Server error while trying to bind fallback port:', err2);
            process.exitCode = 1;
          }
        });
      } else {
        console.error('Server error:', err);
        process.exitCode = 1;
      }
    });
  } catch (error) {
    console.error("Server failed to start:", error);
    process.exitCode = 1;
  }
}

startServer();

// Global error handler — ensures no raw error leaks to clients
// If Sentry is configured, attach its error handler so events are enriched and sent.
if (Sentry) {
  try {
    app.use(Sentry.Handlers.errorHandler());
  } catch (e) {
    console.warn('Failed to attach Sentry error handler:', e && e.message ? e.message : e);
  }
}

app.use((err, req, res, next) => {
  if (!res.headersSent) {
    const status = err && err.status && Number(err.status) >= 400 ? Number(err.status) : 500;
    let publicMessage = "Internal server error";

    if (status === 400) {
      publicMessage = "Bad request";
    } else if (status === 401) {
      publicMessage = "Unauthorized";
    } else if (status === 403) {
      publicMessage = "Forbidden";
    } else if (status === 404) {
      publicMessage = "Not found";
    } else if (status === 429) {
      publicMessage = "Too many requests";
    }

    return safeErrorResponse(res, status, publicMessage, err, {
      path: req.path,
      method: req.method,
    });
  }

  return next(err);
});
