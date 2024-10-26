const { Sequelize } = require("sequelize");
const initModels = require("../app/models/init_models");
const ping = require("ping");
const cron = require("node-cron");

let db; // Variable para almacenar la conexión actual
let isUsingRemoteDB = false; // Bandera para verificar el estado actual

// Función para verificar el estado del servidor
async function checkServerConnection(ipAddress) {
  const response = await ping.promise.probe(ipAddress);
  return response.alive; // Devuelve true si hay respuesta del ping
}

// Función para inicializar la conexión de base de datos
async function initializeDatabase() {
  const serverIP = "10.30.1.49";
  const online = await checkServerConnection(serverIP);

  if (online && !isUsingRemoteDB) {
    console.log("Conectando a la base de datos remota...");
    const remoteDB = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: "10.30.1.43",
      dialect: "mysql",
      logging: false,
    });
    db = remoteDB;
    initModels(remoteDB);
    isUsingRemoteDB = true;
    console.log("Conectado a la base de datos remota.");
  } else if (!online && isUsingRemoteDB) {
    console.log("Conectando a la base de datos local porque no hay conexión a internet...");
    const localMySQLDB = new Sequelize("inventario_patrimonio", "root", "root", {
      host: "localhost",
      dialect: "mysql",
      logging: false,
    });
    db = localMySQLDB;
    initModels(localMySQLDB);
    isUsingRemoteDB = false;
    console.log("Conectado a la base de datos local.");
  } else if (!online && !isUsingRemoteDB) {
    console.log("No hay conexión a internet. Intentando conectar a la base de datos local...");
    const localMySQLDB = new Sequelize("inventario_patrimonio", "root", "root", {
      host: "localhost",
      dialect: "mysql",
      logging: false,
    });
    db = localMySQLDB;
    initModels(localMySQLDB);
    isUsingRemoteDB = false;
    console.log("Conectado a la base de datos local .");
  }
}

// Configura el cron job para verificar la conexión cada 10 segundos
cron.schedule("*/10 * * * * *", () => {
  console.log("Verificando conexión al servidor...");
  initializeDatabase();
});

// Función para obtener la conexión activa
function getDatabaseConnection() {
  if (!db) {
    throw new Error("La base de datos no está inicializada.");
  }
  return db;
}

module.exports = { initializeDatabase, getDatabaseConnection };
