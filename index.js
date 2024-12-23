require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const routerApi = require("./src/routes");
const { initializeDatabase, alterTable } = require("./config/config");
const path = require("path");
const cron = require("node-cron");
const { syncDatabases } = require("./src/controllers/sync");
const { SigaDB } = require("./src/controllers/siga");
const { exec } = require('child_process');
const { sincronizarUbicaciones } = require("./src/controllers/ubicaciones");
const { sincronizarTodo, compararApartirDeId } = require("./src/controllers/sincronizarTablas");
const { getSigaToDB } = require("./src/controllers/bienes");

const app = express();
const server = http.createServer(app);

// Compression
app.use(compression({
  level: 6,
  threshold: 10 * 1024
}));

// CORS configuration
const allowedOrigins = ['http://localhost:3000', 'http://10.30.1.49'];
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
};

// Socket.IO setup with optimized settings
const io = socketIo(server, {
  cors: "*",
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  debug:true
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with cache headers
const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true
};

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));

// Serve React build files in production
app.use(express.static(path.join(__dirname, 'build'), {
  ...staticOptions,
  index: false // Important: Let our route handler manage index.html
}));

// API routes with version prefix
app.use('/api/v1', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Initialize API routes
routerApi(app);

app.get('*', (req, res, next) => {
  // Don't serve index.html for API routes or direct file requests
  if (req.url.startsWith('/api/') || req.url.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// Make io available to routes
app.locals.io = io;
function openBrowserManually() {
  const url = 'http://localhost:3006';

  let command;

  if (process.platform === 'win32') {
    command = `start ${url}`;
  } else if (process.platform === 'linux') {
    command = `xdg-open ${url}`;
  } else if (process.platform === 'darwin') {
    command = `open ${url}`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`Failed to open browser: ${error.message}`);
    }
  });
}
// Server startup with error handling
async function startServer() {
  try {
    await initializeDatabase();
    
    server.listen(3006, () => {
      console.log(`Server running on port: 3006`);
      // openBrowserManually()
    });

    // Cron job for synchronization
    cron.schedule("* * * * *", async () => {
      try {
        await SigaDB()
        await getSigaToDB()
        await sincronizarTodo()
        await syncDatabases();
        // await alterTable()
      } catch (error) {
        console.error("Synchronization error:", error.message);
      }
    });

  } catch (error) {
    console.error("Database initialization error:", error.message);
    process.exit(1);
  }
}

// Graceful shutdown
function cleanup() {
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

startServer();