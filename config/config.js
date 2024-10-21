const { Sequelize } = require("sequelize");
const initModels = require("../app/models/init_models");
const ping = require("ping");

let db; // Variable para almacenar la conexión actual

// Función para cargar dinámicamente el módulo is-online
async function loadIsOnline() {
  const isOnlineModule = await import("is-online"); // Cargar dinámicamente
  return isOnlineModule.default;
}

// Función para hacer ping al servidor remoto
async function isServerReachable(host) {
  try {
    const res = await ping.promise.probe(host);
    return res.alive; // Devuelve true si el servidor responde al ping
  } catch (error) {
    console.error("Error al intentar hacer ping al servidor:", error);
    return false;
  }
}

// Inicializar la base de datos al inicio de la aplicación
async function initializeDatabase() {
  const isOnline = await loadIsOnline();
  const online = await isOnline(); // Verifica si hay conexión a internet
  console.log("Conexión a internet:", online);

  const serverHost = "10.30.1.43"; // Dirección IP de tu servidor remoto
  const serverReachable = await isServerReachable(serverHost);

  if (online && serverReachable) {
    // Conexión a la base de datos remota (servidor)
    const remoteDB = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: serverHost,
      dialect: "mysql",
      logging: false, // Desactiva logging para mejorar el rendimiento si prefieres
    });
    db = remoteDB; // Usa la base de datos remota
    initModels(remoteDB); // Inicializa los modelos para la DB remota
    console.log("Conectado a la base de datos remota");
  } else {
    // Conexión a la base de datos local
    console.log("Servidor remoto no accesible, conectando a la base de datos local...");
    const localMySQLDB = new Sequelize(
      "inventario_patrimonio",
      "root",
      "Tupapi00",
      {
        host: "localhost",
        dialect: "mysql",
      }
    );
    db = localMySQLDB; // Usa la base de datos local
    initModels(localMySQLDB); // Inicializa los modelos para la DB local
    console.log("Conectado a la base de datos local");
  }
}

// Función para obtener la conexión activa
function getDatabaseConnection() {
  if (!db) {
    throw new Error("La base de datos no está inicializada.");
  }
  return db;
}

module.exports = { initializeDatabase, getDatabaseConnection };

