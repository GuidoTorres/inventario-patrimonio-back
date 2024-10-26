require("dotenv").config();
const express = require("express");
const compression = require("compression");  // Requerir el paquete compression
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const routerApi = require("./src/routes");
const { initializeDatabase } = require("./config/config");
const path = require("path");
const cron = require("node-cron");
const { syncDatabases } = require("./src/controllers/sync");
const { SigaDB } = require("./src/controllers/siga");

const app = express();
const server = http.createServer(app);

// Habilitar la compresión de respuestas
app.use(compression());

// Configuración de CORS y otras funcionalidades
const allowedOrigins = ['http://localhost:3000', 'http://10.30.1.49'];

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Origen no permitido por CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'build')));

app.get("/", (req, res) => {
  res.send("VISITA LA RUTA api-docs and github");
});

routerApi(app);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.locals.io = io;

async function startServer() {
  try {
    await initializeDatabase(); // Inicializa la base de datos remota o local
    server.listen(3006, () => {
      console.log(`Servidor corriendo en el puerto: 3006`);
    });

    // Puedes usar tareas programadas con cron si es necesario
     cron.schedule("* * * * *", async () => {
       console.log("Iniciando sincronización de bienes...");
       try {
         await syncDatabases();
         await SigaDB()
         console.log("Sincronización completa.");
       } catch (error) {
         console.error("Error durante la sincronización:", error);
       }
     });

  } catch (error) {
    console.error("Error inicializando la base de datos:", error);
    process.exit(1);
  }
}

startServer();
