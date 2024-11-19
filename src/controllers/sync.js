const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");

let remoteDBConnection = null;

async function checkAndSyncIfNeeded(remoteDB, localDB) {
  try {
    console.log("Checking if sync is needed...");

    // Comparar tabla sedes
    const [remoteSedes] = await remoteDB.query(
      `SELECT id, nombre, createdAt, updatedAt FROM sedes ORDER BY id`
    );
    const [localSedes] = await localDB.query(
      `SELECT id, nombre, createdAt, updatedAt FROM sedes ORDER BY id`
    );

    // Comparación rápida de longitud primero
    if (remoteSedes.length !== localSedes.length) {
      console.log("Different number of records in sedes table, sync needed");
      console.log(`Remote: ${remoteSedes.length}, Local: ${localSedes.length}`);
      return true;
    }

    // Comparación detallada de registros
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
  return new Sequelize("inventario_patrimonio1", "root", "root", {
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
  const errors = [];

  for (const sbn of missingRecords) {
    try {
      if (localToRemote) {
        const localRecord = await localDB.models.bienes.findOne({
          where: { sbn }
        });

        if (localRecord) {
          const recordData = {
            ...localRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await remoteDB.models.bienes.create(recordData);
          await localDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn } }
          );
          totalSynced++;
          console.log(`Created record in remote: ${sbn}`);
        }
      } else {
        const remoteRecord = await remoteDB.models.bienes.findOne({
          where: { sbn }
        });

        if (remoteRecord) {
          const recordData = {
            ...remoteRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await localDB.models.bienes.create(recordData);
          await remoteDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn } }
          );
          totalSynced++;
          console.log(`Created record in local: ${sbn}`);
        }
      }
    } catch (error) {
      errors.push({ sbn, error: error.message });
      console.error(`Error syncing record ${sbn}:`, error);
    }
  }

  return { totalSynced, errors };
}

async function syncLocalToRemote(localDB, remoteDB) {
  console.log("Starting Local to Remote sync");
  
  try {
    const [localCount] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [remoteCount] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    console.log(`Initial counts - Local: ${localCount[0].count}, Remote: ${remoteCount[0].count}`);

    // Obtener todos los registros
    const remoteRecords = await remoteDB.models.bienes.findAll({
      attributes: ['sbn', 'updatedAt', 'estado', 'descripcion', 'usuario_id']
    });

    const remoteRecordsMap = new Map(
      remoteRecords.map(record => [record.sbn, record])
    );

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
        recordsToCreate.push(recordData);
      } else if (
        localRecord.updatedAt > remoteRecord.updatedAt || 
        (localRecord.lastSync && remoteRecord.lastSync && 
         localRecord.lastSync > remoteRecord.lastSync)
      ) {
        recordsToUpdate.push({
          sbn: localRecord.sbn,
          data: recordData
        });
      }
    }

    // Procesar en lotes
    if (recordsToCreate.length > 0) {
      await remoteDB.models.bienes.bulkCreate(recordsToCreate);
      console.log(`Created ${recordsToCreate.length} records`);
    }

    for (const record of recordsToUpdate) {
      await remoteDB.models.bienes.update(record.data, {
        where: { sbn: record.sbn }
      });
    }

    // Verificación final
    const [finalLocalCount] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [finalRemoteCount] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    return {
      initialCounts: { local: localCount[0].count, remote: remoteCount[0].count },
      finalCounts: { local: finalLocalCount[0].count, remote: finalRemoteCount[0].count },
      created: recordsToCreate.length,
      updated: recordsToUpdate.length
    };
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
}

async function syncRemoteToLocal(localDB, remoteDB) {
  console.log("Starting Remote to Local sync");
  
  try {
    const [localCount] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [remoteCount] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    console.log(`Initial counts - Local: ${localCount[0].count}, Remote: ${remoteCount[0].count}`);

    const localRecords = await localDB.models.bienes.findAll({
      attributes: ['sbn', 'updatedAt', 'estado', 'descripcion', 'usuario_id']
    });

    const localRecordsMap = new Map(
      localRecords.map(record => [record.sbn, record])
    );

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
        recordsToCreate.push(recordData);
      } else if (
        remoteRecord.updatedAt > localRecord.updatedAt || 
        (remoteRecord.lastSync && localRecord.lastSync && 
         remoteRecord.lastSync > localRecord.lastSync)
      ) {
        recordsToUpdate.push({
          sbn: remoteRecord.sbn,
          data: recordData
        });
      }
    }

    if (recordsToCreate.length > 0) {
      await localDB.models.bienes.bulkCreate(recordsToCreate);
      console.log(`Created ${recordsToCreate.length} records`);
    }

    for (const record of recordsToUpdate) {
      await localDB.models.bienes.update(record.data, {
        where: { sbn: record.sbn }
      });
    }

    // Verificación final
    const [finalLocalCount] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [finalRemoteCount] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    return {
      initialCounts: { local: localCount[0].count, remote: remoteCount[0].count },
      finalCounts: { local: finalLocalCount[0].count, remote: finalRemoteCount[0].count },
      created: recordsToCreate.length,
      updated: recordsToUpdate.length
    };
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
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
      } catch { }
      remoteDBConnection = null;
    }
  }

  try {
    console.log("Checking server availability...");
    const pingOptions = process.platform === 'win32' ?
      { timeout: 2, extra: ['-n', '1'] } :  // Windows options
      { timeout: 2, extra: ['-c', '1'] };   // Unix/Mac options

    const isServerUp = await ping.promise.probe(serverHost, pingOptions);

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
    const needsSync = await checkAndSyncIfNeeded(remoteDB, localDB);

    if (needsSync) {

      await syncReferenceTables(remoteDB, localDB)
    }

    // Then handle updates
    console.log('\nSyncing local changes to remote...');
    // await syncLocalToRemote(localDB, remoteDB);

    console.log('\nSyncing remote changes to local...');
    // await syncRemoteToLocal(localDB, remoteDB);

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

async function syncReferenceTables(remoteDB, localDB) {
  try {
    console.log("\nSyncing reference tables and their relations...");

    // 1. Primero sincronizar sedes
    console.log("\nSyncing Sedes...");
    await syncSedes(remoteDB, localDB);

    // 2. Luego sincronizar dependencias
    console.log("\nSyncing Dependencias...");
    await syncDependencias(remoteDB, localDB);

    // 3. Actualizar sede_id en bienes
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
    // 1. Primero obtener todas las sedes remotas
    const remoteSedes = await remoteDB.query(
      'SELECT * FROM sedes ORDER BY id ASC',
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${remoteSedes.length} sedes in remote database`);

    // 2. Desactivar temporalmente las restricciones de clave foránea
    await localDB.query('SET FOREIGN_KEY_CHECKS = 0');

    // 3. Eliminar todas las sedes locales
    await localDB.query('TRUNCATE TABLE sedes');

    // 4. Insertar las sedes remotas con sus IDs exactos
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

    // 5. Reactivar las restricciones de clave foránea
    await localDB.query('SET FOREIGN_KEY_CHECKS = 1');

    // 6. Verificar la sincronización
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

    // Mostrar algunas sedes para verificación
    console.log('\nSample of synchronized sedes:');
    remoteSedes.slice(0, 5).forEach(sede => {
      console.log(`ID: ${sede.id}, Nombre: ${sede.nombre}`);
    });

  } catch (error) {
    console.error("Error syncing sedes:", error);
    // Asegurarse de reactivar las restricciones de clave foránea en caso de error
    await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  }
}
async function syncDependencias(remoteDB, localDB) {
  console.log("\nStarting Dependencias sync");
  try {
    // 1. Obtener dependencias remotas
    const remoteDependencias = await remoteDB.query(
      'SELECT * FROM dependencias ORDER BY id ASC',
      {
        type: Sequelize.QueryTypes.SELECT  // Esto es importante para obtener el array directamente
      }
    );

    console.log(`Found ${remoteDependencias.length} dependencias in remote database`);

    // Debug: Mostrar algunas dependencias remotas
    console.log('\nSample remote dependencias:');
    remoteDependencias.slice(0, 3).forEach(dep => {
      console.log(`ID: ${dep.id}, Nombre: ${dep.nombre}, Sede: ${dep.sede_id}`);
    });

    // 2. Desactivar foreign key checks
    await localDB.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      // 3. Limpiar tabla local
      await localDB.query('TRUNCATE TABLE dependencias');

      // 4. Insertar todas las dependencias
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

      // 5. Verificar la sincronización
      const localDependencias = await localDB.query(
        'SELECT * FROM dependencias ORDER BY id ASC',
        { type: Sequelize.QueryTypes.SELECT }
      );

      console.log('\nVerification:');
      console.log(`Remote dependencias: ${remoteDependencias.length}`);
      console.log(`Local dependencias: ${localDependencias.length}`);

      // Mostrar algunas dependencias locales
      console.log('\nSample local dependencias after sync:');
      localDependencias.slice(0, 3).forEach(dep => {
        console.log(`ID: ${dep.id}, Nombre: ${dep.nombre}, Sede: ${dep.sede_id}`);
      });

    } finally {
      // Reactivar foreign key checks
      await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    }

  } catch (error) {
    console.error("Error syncing dependencias:", error);
    console.error("Full error:", error.message);
    // Asegurar que se reactivan las foreign key checks en caso de error
    await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  }
}
async function updateBienesReferences(remoteDB, localDB) {
  try {
    // Obtener el mapeo de sedes actualizado
    const [sedesMapping] = await remoteDB.query(
      `SELECT id, nombre FROM sedes ORDER BY id`
    );

    console.log("\nUpdating bienes references with new sede IDs...");

    // Actualizar sede_id en bienes usando el mapeo correcto
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




module.exports = { syncDatabases };