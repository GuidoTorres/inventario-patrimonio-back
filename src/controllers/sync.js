const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");

let remoteDBConnection = null;
let lastSuccessfulConnection = 0;
const CONNECTION_RETRY_INTERVAL = 30000;

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
    }
  });
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

async function syncMissingRecords(localDB, remoteDB, missingRecords, localToRemote) {
  let totalSynced = 0;
  
  for (const sbn of missingRecords) {
    try {
      if (localToRemote) {
        // Syncing from local to remote
        const localRecord = await localDB.models.bienes.findOne({
          where: { sbn }
        });

        if (localRecord) {
          const recordData = {
            ...localRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await remoteDB.models.bienes.create(recordData, { silent: true });
          
          await localDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn }, silent: true }
          );
          
          totalSynced++;
          console.log(`Created record in remote: ${sbn}`);
        }
      } else {
        // Syncing from remote to local
        const remoteRecord = await remoteDB.models.bienes.findOne({
          where: { sbn }
        });

        if (remoteRecord) {
          const recordData = {
            ...remoteRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await localDB.models.bienes.create(recordData, { silent: true });
          
          await remoteDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn }, silent: true }
          );
          
          totalSynced++;
          console.log(`Created record in local: ${sbn}`);
        }
      }
    } catch (error) {
      console.error(`Error syncing record ${sbn}:`, error);
    }
  }
  
  console.log(`Completed missing records sync. Total records synced: ${totalSynced}`);
}

async function syncLocalToRemote(localDB, remoteDB) {
  console.log("Starting Local to Remote sync");
  let totalSynced = 0;
  let totalUpdated = 0;

  try {
    // Obtener todos los registros remotos con sus SNBs y updatedAt
    const remoteRecords = await remoteDB.models.bienes.findAll({
      attributes: ['sbn', 'updatedAt']
    });

    // Crear mapa de registros remotos para búsqueda rápida
    const remoteRecordsMap = new Map(
      remoteRecords.map(record => [record.sbn, record])
    );

    // Obtener todos los registros locales
    const bienesLocales = await localDB.models.bienes.findAll();

    const recordsToCreate = [];
    const recordsToUpdate = [];

    for (const localRecord of bienesLocales) {
      const remoteRecord = remoteRecordsMap.get(localRecord.sbn);
      const recordData = {
        ...localRecord.dataValues,
        lastSync: new Date()
      };
      delete recordData.id;

      if (!remoteRecord) {
        // Registro nuevo - para crear en remoto
        recordsToCreate.push(recordData);
      } else if (localRecord.updatedAt > remoteRecord.updatedAt) {
        // Registro existente pero actualizado - para actualizar en remoto
        recordsToUpdate.push({
          sbn: localRecord.sbn,
          data: recordData
        });
      }
    }

    // Crear nuevos registros en lote
    if (recordsToCreate.length > 0) {
      await remoteDB.models.bienes.bulkCreate(recordsToCreate, {
        silent: true,
        logging: false
      });
      totalSynced = recordsToCreate.length;
      console.log(`Created ${totalSynced} new records in remote database`);

      // Actualizar lastSync para los registros creados
      for (const record of recordsToCreate) {
        await localDB.models.bienes.update(
          { lastSync: new Date() },
          { 
            where: { sbn: record.sbn },
            silent: true 
          }
        );
      }
    }

    // Actualizar registros existentes
    if (recordsToUpdate.length > 0) {
      for (const record of recordsToUpdate) {
        await remoteDB.models.bienes.update(record.data, {
          where: { sbn: record.sbn },
          silent: true
        });

        // Actualizar lastSync en local
        await localDB.models.bienes.update(
          { lastSync: new Date() },
          { 
            where: { sbn: record.sbn },
            silent: true 
          }
        );

        totalUpdated++;
      }
      console.log(`Updated ${totalUpdated} existing records in remote database`);
    }

    console.log(`Sync Summary:
      New records created: ${totalSynced}
      Records updated: ${totalUpdated}
      Total processed: ${totalSynced + totalUpdated}
    `);

  } catch (error) {
    console.error("Error during sync:", error);
    throw error;
  }

  return { created: totalSynced, updated: totalUpdated };
}

async function syncRemoteToLocal(localDB, remoteDB) {
  console.log("Starting Remote to Local sync");
  let totalSynced = 0;
  let totalUpdated = 0;

  try {
    // Obtener todos los registros locales con sus SNBs y updatedAt
    const localRecords = await localDB.models.bienes.findAll({
      attributes: ['sbn', 'updatedAt']
    });

    // Crear un mapa para búsqueda rápida
    const localRecordsMap = new Map(
      localRecords.map(record => [record.sbn, record])
    );

    // Obtener todos los registros remotos
    const bienesRemotos = await remoteDB.models.bienes.findAll();

    const recordsToCreate = [];
    const recordsToUpdate = [];

    for (const remoteRecord of bienesRemotos) {
      const localRecord = localRecordsMap.get(remoteRecord.sbn);
      const recordData = {
        ...remoteRecord.dataValues,
        lastSync: new Date()
      };
      delete recordData.id;

      if (!localRecord) {
        // Registro nuevo - para crear
        recordsToCreate.push(recordData);
      } else if (remoteRecord.updatedAt > localRecord.updatedAt) {
        // Registro existente pero actualizado - para actualizar
        recordsToUpdate.push({
          sbn: remoteRecord.sbn,
          data: recordData
        });
      }
    }

    // Crear nuevos registros en lote
    if (recordsToCreate.length > 0) {
      await localDB.models.bienes.bulkCreate(recordsToCreate, {
        silent: true,
        logging: false
      });
      totalSynced = recordsToCreate.length;
      console.log(`Created ${totalSynced} new records in local database`);
    }

    // Actualizar registros existentes
    if (recordsToUpdate.length > 0) {
      for (const record of recordsToUpdate) {
        await localDB.models.bienes.update(record.data, {
          where: { sbn: record.sbn },
          silent: true
        });
        totalUpdated++;
      }
      console.log(`Updated ${totalUpdated} existing records in local database`);
    }

    console.log(`Sync Summary:
      New records created: ${totalSynced}
      Records updated: ${totalUpdated}
      Total processed: ${totalSynced + totalUpdated}
    `);

  } catch (error) {
    console.error("Error during sync:", error);
    throw error;
  }

  return { created: totalSynced, updated: totalUpdated };
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
    const isServerUp = await ping.promise.probe(serverHost, {
      timeout: 2,
      extra: ["-c", "1"]
    });

    if (!isServerUp.alive) {
      console.log("Remote server is not accessible");
      return null;
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

async function syncDatabases() {
  try {
    console.log('====================================');
    console.log("Starting synchronization process");
    console.log('====================================');

    const { localDB, remoteDB } = await verifyDatabaseConnections();

    // Check initial counts
    const [[{ count: localCount }]] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [[{ count: remoteCount }]] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');

    console.log(`\nInitial record counts:`);
    console.log(`Local database: ${localCount} records`);
    console.log(`Remote database: ${remoteCount} records`);

    // Find missing records in both directions
    const missingInRemoteQuery = `
      SELECT l.sbn FROM bienes l WHERE NOT EXISTS (
        SELECT 1 FROM bienes r WHERE r.sbn = l.sbn
      )`;

    const missingInLocalQuery = `
      SELECT r.sbn FROM bienes r WHERE NOT EXISTS (
        SELECT 1 FROM bienes l WHERE l.sbn = r.sbn
      )`;

    const missingInRemote = await localDB.query(missingInRemoteQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    const missingInLocal = await remoteDB.query(missingInLocalQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    // Handle missing records first
    if (missingInRemote.length > 0) {
      console.log(`Found ${missingInRemote.length} records missing in remote`);
      await syncMissingRecords(localDB, remoteDB, missingInRemote.map(r => r.sbn), true);
    }

    if (missingInLocal.length > 0) {
      console.log(`Found ${missingInLocal.length} records missing in local`);
      await syncMissingRecords(localDB, remoteDB, missingInLocal.map(r => r.sbn), false);
    }

    // Then handle updates
    console.log('\nSyncing local changes to remote...');
    await syncLocalToRemote(localDB, remoteDB);

    console.log('\nSyncing remote changes to local...');
    await syncRemoteToLocal(localDB, remoteDB);

    // Final verification
    const [[{ count: finalLocalCount }]] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [[{ count: finalRemoteCount }]] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    console.log('\nFinal record counts:');
    console.log(`Local database: ${finalLocalCount} records`);
    console.log(`Remote database: ${finalRemoteCount} records`);

    if (finalLocalCount === finalRemoteCount) {
      console.log('✓ Databases are synchronized');
    } else {
      console.log('! Database counts still don\'t match');
      
      const differences = await remoteDB.query(`
        SELECT 'missing_in_local' as type, r.sbn 
        FROM bienes r 
        WHERE NOT EXISTS (SELECT 1 FROM bienes l WHERE l.sbn = r.sbn)
        UNION ALL
        SELECT 'missing_in_remote' as type, l.sbn
        FROM bienes l 
        WHERE NOT EXISTS (SELECT 1 FROM bienes r WHERE r.sbn = l.sbn)
      `, {
        type: Sequelize.QueryTypes.SELECT
      });

      if (differences.length > 0) {
        console.log('Found differences:', differences);
      }
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

async function syncSedes(remoteDB, localDB) {
  console.log("Starting Remote to Local sync for sedes");
  let totalSynced = 0;

  try {
    const remoteSedes = await remoteDB.models.sedes.findAll();
    const localSedes = await localDB.models.sedes.findAll({
      attributes: ['id', 'updatedAt']
    });

    const localSedesMap = new Map(localSedes.map(record => [record.id, record]));

    const recordsToCreate = [];
    const recordsToUpdate = [];

    for (const remoteSede of remoteSedes) {
      const localSede = localSedesMap.get(remoteSede.id);

      if (!localSede) {
        // Nueva sede en la base de datos remota, crear en local
        recordsToCreate.push(remoteSede.dataValues);
      } else if (remoteSede.updatedAt > localSede.updatedAt) {
        // Actualizar la sede si tiene un timestamp más reciente en remoto
        recordsToUpdate.push({
          id: remoteSede.id,
          data: remoteSede.dataValues
        });
      }
    }

    // Crear nuevos registros
    if (recordsToCreate.length > 0) {
      await localDB.models.sedes.bulkCreate(recordsToCreate, { silent: true });
      totalSynced += recordsToCreate.length;
      console.log(`Created ${recordsToCreate.length} new sedes in local database`);
    }

    // Actualizar registros existentes
    for (const record of recordsToUpdate) {
      await localDB.models.sedes.update(record.data, {
        where: { id: record.id },
        silent: true
      });
    }
    totalSynced += recordsToUpdate.length;
    console.log(`Updated ${recordsToUpdate.length} sedes in local database`);
  } catch (error) {
    console.error("Error syncing sedes:", error);
  }

  return totalSynced;
}

// Función para sincronizar la tabla "dependencias" desde la base de datos remota a la local
async function syncDependencias(remoteDB, localDB) {
  console.log("Starting Remote to Local sync for dependencias");
  let totalSynced = 0;

  try {
    const remoteDependencias = await remoteDB.models.dependencias.findAll();
    const localDependencias = await localDB.models.dependencias.findAll({
      attributes: ['id', 'updatedAt']
    });

    const localDependenciasMap = new Map(localDependencias.map(record => [record.id, record]));

    const recordsToCreate = [];
    const recordsToUpdate = [];

    for (const remoteDependencia of remoteDependencias) {
      const localDependencia = localDependenciasMap.get(remoteDependencia.id);

      if (!localDependencia) {
        // Nueva dependencia en la base de datos remota, crear en local
        recordsToCreate.push(remoteDependencia.dataValues);
      } else if (remoteDependencia.updatedAt > localDependencia.updatedAt) {
        // Actualizar la dependencia si tiene un timestamp más reciente en remoto
        recordsToUpdate.push({
          id: remoteDependencia.id,
          data: remoteDependencia.dataValues
        });
      }
    }

    // Crear nuevos registros
    if (recordsToCreate.length > 0) {
      await localDB.models.dependencias.bulkCreate(recordsToCreate, { silent: true });
      totalSynced += recordsToCreate.length;
      console.log(`Created ${recordsToCreate.length} new dependencias in local database`);
    }

    // Actualizar registros existentes
    for (const record of recordsToUpdate) {
      await localDB.models.dependencias.update(record.data, {
        where: { id: record.id },
        silent: true
      });
    }
    totalSynced += recordsToUpdate.length;
    console.log(`Updated ${recordsToUpdate.length} dependencias in local database`);
  } catch (error) {
    console.error("Error syncing dependencias:", error);
  }

  return totalSynced;
}

// Función principal para la sincronización
async function syncDatabases() {
  try {
    console.log('====================================');
    console.log("Starting synchronization process");
    console.log('====================================');

    const { localDB, remoteDB } = await verifyDatabaseConnections();

    console.log('Syncing sedes...');
    await syncSedes(remoteDB, localDB);

    console.log('Syncing dependencias...');
    await syncDependencias(remoteDB, localDB);

    console.log('Syncing bienes...');
    await syncRemoteToLocal(localDB, remoteDB); // Para bienes

    console.log('Syncing bienes Local to Remote...');
    await syncLocalToRemote(localDB, remoteDB); // Para bienes en la otra dirección

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