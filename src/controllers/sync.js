const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");
const net = require('net');

let remoteDBConnection = null;
let lastSuccessfulConnection = 0;
const CONNECTION_RETRY_INTERVAL = 30000;

async function checkTcpConnection(host, port = 3306) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(2000);

    socket.on('connect', () => {
      console.log(`TCP connection successful to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.log(`TCP connection timeout to ${host}:${port}`);
      socket.destroy();
      resolve(false);
    });

    socket.on('error', (err) => {
      console.log(`TCP connection error to ${host}:${port}:`, err.message);
      resolve(false);
    });

    console.log(`Attempting TCP connection to ${host}:${port}...`);
    socket.connect(port, host);
  });
}

async function checkAndSyncIfNeeded(remoteDB, localDB) {
  try {
    console.log("Checking if sync is needed...");

    const [remoteSedes] = await remoteDB.query(
      `SELECT id, nombre, createdAt, updatedAt FROM sedes ORDER BY id`
    );
    const [localSedes] = await localDB.query(
      `SELECT id, nombre, createdAt, updatedAt FROM sedes ORDER BY id`
    );

    if (remoteSedes.length !== localSedes.length) {
      console.log("Different number of records in sedes table, sync needed");
      console.log(`Remote: ${remoteSedes.length}, Local: ${localSedes.length}`);
      return true;
    }

    for (let i = 0; i < remoteSedes.length; i++) {
      if (remoteSedes[i].id !== localSedes[i].id || 
          remoteSedes[i].nombre !== localSedes[i].nombre) {
        console.log(`Difference found in sede record: ${remoteSedes[i].id}`);
        return true;
      }
    }

    console.log("Tables are in sync, no update needed");
    return false;

  } catch (error) {
    console.error("Error checking sync status:", error);
    throw error;
  }
}

function getLocalDatabaseConnection() {
  return new Sequelize("inventario_patrimonio", "root", "root", {
    host: "localhost",
    dialect: "mysql",
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 30000,
      supportBigNumbers: true,
      bigNumberStrings: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  });
}

async function getRemoteDatabaseConnection() {
  const serverHost = "10.30.1.43";
  const now = Date.now();

  if (remoteDBConnection) {
    try {
      await remoteDBConnection.authenticate();
      return remoteDBConnection;
    } catch {
      try {
        await remoteDBConnection.close();
      } catch {}
      remoteDBConnection = null;
    }
  }

  try {
    console.log("Checking server availability...");
    const pingOptions = process.platform === 'win32' ? 
      { timeout: 2, extra: ['-n', '1'] } :
      { timeout: 2, extra: ['-c', '1'] };

    const isServerUp = await ping.promise.probe(serverHost, pingOptions);

    if (!isServerUp.alive) {
      console.log("Ping failed, trying direct TCP connection...");
      const isReachable = await checkTcpConnection(serverHost);
      if (!isReachable) {
        console.log("Remote server is not accessible");
        return null;
      }
    }

    console.log("Creating new remote connection...");
    remoteDBConnection = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: serverHost,
      dialect: "mysql",
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        connectTimeout: 30000,
        supportBigNumbers: true,
        bigNumberStrings: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    });

    await remoteDBConnection.authenticate();
    initModels(remoteDBConnection);
    console.log("Remote connection established successfully");
    
    return remoteDBConnection;
  } catch (error) {
    console.error("Failed to establish remote connection:", error);
    remoteDBConnection = null;
    return null;
  }
}

async function verifyDatabaseConnections() {
  let localDB = null;
  let remoteDB = null;
  
  try {
    console.log("Verifying local database connection...");
    localDB = getLocalDatabaseConnection();
    await localDB.authenticate();
    initModels(localDB);
    
    const [[localInfo]] = await localDB.query('SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id');
    console.log("Local database info:", {
      hostname: localInfo.hostname,
      database: localInfo.database_name,
      connectionId: localInfo.connection_id,
      host: "localhost"
    });
  } catch (error) {
    console.error("Local database connection failed:", error);
    throw new Error("Cannot proceed without local database connection");
  }

  try {
    console.log("\nVerifying remote database connection...");
    remoteDB = await getRemoteDatabaseConnection();
    if (!remoteDB) {
      throw new Error("Could not establish remote connection");
    }
    
    const [[remoteInfo]] = await remoteDB.query('SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id');
    console.log("Remote database info:", {
      hostname: remoteInfo.hostname,
      database: remoteInfo.database_name,
      connectionId: remoteInfo.connection_id,
      host: "10.30.1.43"
    });

    return { localDB, remoteDB };
  } catch (error) {
    console.error("Remote database connection failed:", error);
    throw new Error("Cannot proceed without remote database connection");
  }
}

async function syncReferenceTables(remoteDB, localDB) {
  try {
    console.log("\nSyncing reference tables and their relations...");
    
    console.log("\nSyncing Sedes...");
    await syncSedes(remoteDB, localDB);
    
    console.log("\nSyncing Dependencias...");
    await syncDependencias(remoteDB, localDB);

    console.log("\nUpdating sede_id references in bienes...");
    await updateBienesReferences(remoteDB, localDB);
    
    console.log("\nAll tables and references sync completed");
  } catch (error) {
    console.error("Error in sync process:", error);
    throw error;
  }
}

async function syncSedes(remoteDB, localDB) {
  console.log("Starting Sedes sync");
  try {
    const remoteSedes = await remoteDB.query(
      'SELECT * FROM sedes ORDER BY id ASC',
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${remoteSedes.length} sedes in remote database`);
    await localDB.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      await localDB.query('TRUNCATE TABLE sedes');

      for (const sede of remoteSedes) {
        await localDB.query(
          `INSERT INTO sedes (id, nombre, createdAt, updatedAt) 
           VALUES (:id, :nombre, :createdAt, :updatedAt)`,
          {
            replacements: {
              id: sede.id,
              nombre: sede.nombre,
              createdAt: sede.createdAt,
              updatedAt: sede.updatedAt
            }
          }
        );
        console.log(`Inserted sede ID: ${sede.id} - ${sede.nombre}`);
      }

      const [localSedes] = await localDB.query(
        'SELECT * FROM sedes ORDER BY id ASC'
      );

      console.log('\nVerification:');
      console.log(`Remote sedes: ${remoteSedes.length}`);
      console.log(`Local sedes: ${localSedes.length}`);
      
      if (remoteSedes.length === localSedes.length) {
        console.log('✓ Sedes synchronized successfully');
      } else {
        console.log('! Warning: Sede counts don\'t match');
      }

    } finally {
      await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    }

  } catch (error) {
    console.error("Error syncing sedes:", error);
    await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  }
}

async function syncDependencias(remoteDB, localDB) {
  console.log("\nStarting Dependencias sync");
  try {
    const remoteDependencias = await remoteDB.query(
      'SELECT * FROM dependencias ORDER BY id ASC',
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${remoteDependencias.length} dependencias in remote database`);
    await localDB.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      await localDB.query('TRUNCATE TABLE dependencias');

      for (const dep of remoteDependencias) {
        await localDB.query(
          `INSERT INTO dependencias 
           (id, nombre, sede_id, tipo_ubicac, ubicac_fisica, createdAt, updatedAt) 
           VALUES (:id, :nombre, :sede_id, :tipo_ubicac, :ubicac_fisica, :createdAt, :updatedAt)`,
          {
            replacements: {
              id: dep.id,
              nombre: dep.nombre,
              sede_id: dep.sede_id,
              tipo_ubicac: dep.tipo_ubicac || null,
              ubicac_fisica: dep.ubicac_fisica || null,
              createdAt: dep.createdAt,
              updatedAt: dep.updatedAt
            }
          }
        );
        console.log(`Inserted dependencia ID: ${dep.id} - ${dep.nombre}`);
      }

    } finally {
      await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    }

  } catch (error) {
    console.error("Error syncing dependencias:", error);
    await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  }
}

async function updateBienesReferences(remoteDB, localDB) {
  try {
    const [sedesMapping] = await remoteDB.query(
      `SELECT id, nombre FROM sedes ORDER BY id`
    );

    console.log("\nUpdating bienes references with new sede IDs...");

    for (const sede of sedesMapping) {
      await localDB.query(
        `UPDATE bienes SET sede_id = :newSedeId 
         WHERE sede_id = :oldSedeId`,
        {
          replacements: {
            newSedeId: sede.id,
            oldSedeId: sede.id
          },
          type: Sequelize.QueryTypes.UPDATE
        }
      );
      console.log(`Updated bienes for sede ID: ${sede.id}`);
    }

    console.log("Completed updating bienes references");
  } catch (error) {
    console.error("Error updating bienes references:", error);
    throw error;
  }
}

async function syncDatabases() {
  try {
    console.log('====================================');
    console.log("Starting synchronization process");
    console.log('====================================');

    const { localDB, remoteDB } = await verifyDatabaseConnections();
    const needsSync = await checkAndSyncIfNeeded(remoteDB, localDB);

    if (needsSync) {
      await syncReferenceTables(remoteDB, localDB);
      console.log('Reference tables synchronized successfully');
    } else {
      console.log('Reference tables are already in sync');
    }

  } catch (error) {
    console.error("Synchronization error:", error);
  } finally {
    if (remoteDBConnection) {
      await remoteDBConnection.close();
      remoteDBConnection = null;
    }
  }
}

module.exports = { syncDatabases };