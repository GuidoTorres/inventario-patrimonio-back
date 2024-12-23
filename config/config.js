const { Sequelize } = require("sequelize");
const initModels = require("../app/models/init_models");
const ping = require("ping");
const cron = require("node-cron");
const { snbsParaBaja } = require("../src/helpers/dataConsulta");

let db;
let isUsingRemoteDB = false;
let isCheckingConnection = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 10000;

const dbConfigs = {
  remote: {
    database: "inventario_patrimonio",
    username: "usuario",
    password: "root",
    host: "10.30.1.43",
    dialect: "mysql",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  local: {
    database: "inventario_patrimonio",
    username: "root",
    password: "root",
    host: "localhost",
    dialect: "mysql",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};

function logConnectionStatus(message) {
  const timestamp = new Date().toISOString();
  const connectionType = isUsingRemoteDB ? "REMOTE" : "LOCAL";
  console.log(`[${timestamp}] [DB:${connectionType}] ${message}`);
}

async function checkTcpConnection(host, port = 3306) {
  return new Promise((resolve) => {
    const net = require("net");
    const socket = new net.Socket();

    socket.setTimeout(2000); // 2 segundos timeout

    socket.on("connect", () => {
      console.log(`TCP connection successful to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      console.log(`TCP connection timeout to ${host}:${port}`);
      socket.destroy();
      resolve(false);
    });

    socket.on("error", (err) => {
      console.log(`TCP connection error to ${host}:${port}:`, err.message);
      resolve(false);
    });

    console.log(`Attempting TCP connection to ${host}:${port}...`);
    socket.connect(port, host);
  });
}

async function checkServerConnection(ipAddress) {
  try {
    const serverHost = "10.30.1.43";
    console.log(`Attempting to ping ${ipAddress}...`);
    const pingOptions =
      process.platform === "win32"
        ? { timeout: 2, extra: ["-n", "1"] } // Windows options
        : { timeout: 2, extra: ["-c", "1"] }; // Unix/Mac options

    const response = await ping.promise.probe(serverHost, pingOptions);

    // Si el ping falla, intentar conexión TCP directa
    if (!response.alive) {
      console.log("Ping failed, trying direct TCP connection...");
      const isReachable = await checkTcpConnection(serverHost);
      return isReachable;
    }

    return response.alive;
  } catch (error) {
    console.error("Connection check error:", error);
    // Intentar conexión TCP como respaldo
    return await checkTcpConnection(serverHost);
  }
}

async function createConnection(config) {
  try {
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        dialect: config.dialect,
        logging: config.logging,
        pool: config.pool,
        dialectOptions: {
          connectTimeout: 30000,
          supportBigNumbers: true,
          bigNumberStrings: true,
          charset: "utf8mb4",
        },
      }
    );

    await sequelize.authenticate();
    initModels(sequelize);
    return sequelize;
  } catch (error) {
    console.error("Database connection error:", {
      message: error.message,
      code: error.original?.code,
      errno: error.original?.errno,
      sqlMessage: error.original?.sqlMessage,
    });
    throw error;
  }
}

async function switchConnection(useRemote) {
  if (useRemote === isUsingRemoteDB && db) {
    return;
  }

  const config = useRemote ? dbConfigs.remote : dbConfigs.local;
  logConnectionStatus(`Attempting to connect to ${config.host}`);

  try {
    if (db) {
      logConnectionStatus("Closing existing connection");
      await db.close().catch(() => {});
    }

    const newConnection = await createConnection(config);
    db = newConnection;
    isUsingRemoteDB = useRemote;
    logConnectionStatus(`Successfully connected to ${config.host}`);

    if (!useRemote) {
      setTimeout(checkAndSwitchToRemote, 5000);
    }
  } catch (error) {
    logConnectionStatus(
      `Failed to connect to ${config.host}: ${error.message}`
    );
    if (useRemote) {
      logConnectionStatus("Falling back to local database");
      await switchConnection(false);
    }
  }
}

async function checkAndSwitchToRemote() {
  const serverIP = "10.30.1.43";
  const online = await checkServerConnection(serverIP);

  if (online && !isUsingRemoteDB) {
    logConnectionStatus("Server is available - switching to remote database");
    await switchConnection(true);
  }
}

async function initializeDatabase() {
  if (isCheckingConnection) {
    logConnectionStatus("Connection check already in progress");
    return;
  }

  try {
    isCheckingConnection = true;
    const serverIP = "10.30.1.43";
    logConnectionStatus(`Checking server connection to ${serverIP}`);
    const online = await checkServerConnection(serverIP);

    if (online) {
      logConnectionStatus("Server is online, attempting remote connection");
      await switchConnection(true);
    } else {
      logConnectionStatus(
        "Server is offline, temporarily using local connection"
      );
      await switchConnection(false);
    }
  } catch (error) {
    logConnectionStatus(`Error during initialization: ${error.message}`);
    if (isUsingRemoteDB || !db) {
      await switchConnection(false);
    }
  } finally {
    isCheckingConnection = false;
    lastCheckTime = Date.now();
  }
}

function getDatabaseConnection() {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

function getCurrentConnectionInfo() {
  if (!db) {
    return {
      status: "Not Connected",
      type: "None",
      host: "None",
    };
  }

  return {
    status: "Connected",
    type: isUsingRemoteDB ? "Remote" : "Local",
    host: isUsingRemoteDB ? dbConfigs.remote.host : dbConfigs.local.host,
  };
}

cron.schedule("*/5 * * * * *", async () => {
  if (isCheckingConnection || Date.now() - lastCheckTime < CHECK_INTERVAL) {
    return;
  }

  try {
    if (db) {
      await db.authenticate();
      logConnectionStatus("Connection health check successful");

      if (!isUsingRemoteDB) {
        await checkAndSwitchToRemote();
      }
    } else {
      await initializeDatabase();
    }
  } catch (error) {
    logConnectionStatus("Connection health check failed, reinitializing");
    await initializeDatabase();
  }
});

async function alterTable(query) {
  const sequelize = getDatabaseConnection();
  try {
    console.log("====================================");
    console.log("====================================");
    console.log("====================================");
    console.log("====================================");
    console.log("PRUEBA ALTER TABLE FUNCION ");
    console.log("====================================");
    console.log("====================================");
    console.log("====================================");
    console.log("====================================");

    const [deleteControl] = await sequelize.query(
      "SHOW COLUMNS FROM bienes LIKE 'delete_duplicates_control'",
      { type: Sequelize.QueryTypes.RAW }
    );

    if (!deleteControl.length) {
      logConnectionStatus("Starting duplicate removal process");

      await sequelize.query(
        "ALTER TABLE bienes ADD COLUMN delete_duplicates_control BOOLEAN DEFAULT FALSE",
        { type: Sequelize.QueryTypes.RAW }
      );

      // Consulta corregida para eliminar duplicados
      await sequelize.query(
        `
        DELETE FROM bienes
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM (SELECT id, sbn FROM bienes) AS temp
          GROUP BY sbn
        )
      `,
        { type: Sequelize.QueryTypes.RAW }
      );

      // Agregar índice único
      await sequelize.query(
        `
        ALTER TABLE bienes DROP INDEX IF EXISTS idx_sbn;
        ALTER TABLE bienes ADD UNIQUE INDEX idx_sbn (sbn);
      `,
        { type: Sequelize.QueryTypes.RAW }
      );

      await sequelize.query(
        "UPDATE bienes SET delete_duplicates_control = TRUE",
        { type: Sequelize.QueryTypes.RAW }
      );

      logConnectionStatus(
        "Duplicate removal and index creation completed successfully"
      );
    }
    // const sbnsBaja = snbsParaBaja;
    // ///////////////////////////////////
    // // Verificar columna estado_baja
    // const estadoBajaColumn = await sequelize.query(
    //   "SHOW COLUMNS FROM bienes23 LIKE 'estado_baja'",
    //   { type: Sequelize.QueryTypes.SELECT }
    // );

    // if (!estadoBajaColumn || estadoBajaColumn.length === 0) {
    //   await sequelize.query(
    //     "ALTER TABLE bienes23 ADD COLUMN estado_baja BOOLEAN DEFAULT FALSE",
    //     { type: Sequelize.QueryTypes.RAW }
    //   );
    //   logConnectionStatus("Added estado_baja column");
    // }

    // // Obtener SNBs que ya están marcados como baja
    // const existingBajas = await sequelize.query(
    //   `SELECT sbn
    //     FROM bienes23
    //     WHERE sbn IN (${sbnsBaja.map((sbn) => `'${sbn}'`).join(",")})
    //     AND estado_baja = 1`,
    //         { type: Sequelize.QueryTypes.SELECT }
    //       );

    // // Crear un Set de SNBs ya marcados como baja
    // const snbsYaMarcados = new Set(existingBajas.map((record) => record.sbn));

    // // Filtrar solo los SNBs que necesitan actualización
    // const snbsPorActualizar = sbnsBaja.filter(
    //   (sbn) => !snbsYaMarcados.has(sbn)
    // );

    // if (snbsPorActualizar.length > 0) {
    //   await sequelize.query(
    //     `UPDATE bienes23
    //  SET estado_baja = 1
    //  WHERE sbn IN (${snbsPorActualizar.map((sbn) => `'${sbn}'`).join(",")})`,
    //     { type: Sequelize.QueryTypes.RAW }
    //   );
    //   logConnectionStatus(
    //     `Updated estado_baja for SNBs: ${snbsPorActualizar.join(", ")}`
    //   );
    // } else {
    //   logConnectionStatus("No new SNBs to update");
    // }

    // Verificar si la columna 'nombre_sede' existe
    const [nombreSedeColumn] = await sequelize.query(
      "SHOW COLUMNS FROM siga LIKE 'nombre_sede'",
      { type: Sequelize.QueryTypes.RAW }
    );

    if (!nombreSedeColumn.length) {
      logConnectionStatus("Adding nombre_sede column to siga table");
      await sequelize.query(
        "ALTER TABLE siga ADD COLUMN nombre_sede VARCHAR(255) NULL",
        { type: Sequelize.QueryTypes.RAW }
      );
      logConnectionStatus("Column nombre_sede added successfully");
    }

    // Verificar si el índice único en CODIGO_ACTIVO ya existe
    const [uniqueIndex] = await sequelize.query(
      "SHOW INDEX FROM siga WHERE Column_name = 'CODIGO_ACTIVO' AND Non_unique = 0",
      { type: Sequelize.QueryTypes.RAW }
    );

    if (!uniqueIndex.length) {
      logConnectionStatus(
        "Adding unique constraint to CODIGO_ACTIVO column in siga table"
      );
      await sequelize.query("ALTER TABLE siga ADD UNIQUE (CODIGO_ACTIVO)", {
        type: Sequelize.QueryTypes.RAW,
      });
      logConnectionStatus(
        "Unique constraint on CODIGO_ACTIVO added successfully"
      );
    }

    logConnectionStatus("Table altered successfully");
  } catch (error) {
    logConnectionStatus(`Error altering table: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  getDatabaseConnection,
  checkServerConnection,
  alterTable,
  getCurrentConnectionInfo,
};
