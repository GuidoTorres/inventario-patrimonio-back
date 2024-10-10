require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const routerApi = require("./src/routes");
const { initializeDatabase } = require("./config/config");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("VISITA LA RUTA api-docs and github");
});

// Guardamos la instancia de Socket.IO en app.locals
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
