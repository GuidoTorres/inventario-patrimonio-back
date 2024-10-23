require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const routerApi = require("./src/routes");
const { initializeDatabase } = require("./config/config");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Configuración de CORS para Socket.IO
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',  // Permitir acceso desde el frontend
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(express.json());

// Configuración de CORS para Express (Permitir solicitudes del frontend)
app.use(cors({
  origin: 'http://localhost:3000',  // Solo permitir solicitudes desde esta URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/", (req, res) => {
  res.send("VISITA LA RUTA api-docs and github");
});

// Guardamos la instancia de Socket.IO en app.locals para usarla en otras partes de la app
app.locals.io = io;

routerApi(app);

async function startServer() {
  try {
    await initializeDatabase(); // Inicializa la base de datos remota o local
    server.listen(3006, () => {
      console.log(`Servidor corriendo en el puerto: 3006`);
    });
  } catch (error) {
    console.error("Error inicializando la base de datos:", error);
    process.exit(1);
  }
}

startServer();
