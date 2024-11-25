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
      if (
        remoteSedes[i].id !== localSedes[i].id ||
        remoteSedes[i].nombre !== localSedes[i].nombre
      ) {
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
      idle: 10000,
    },
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
      } catch { }
      remoteDBConnection = null;
    }
  }

  try {
    console.log("Checking server availability...");
    const pingOptions =
      process.platform === "win32"
        ? { timeout: 2, extra: ["-n", "1"] } // Windows options
        : { timeout: 2, extra: ["-c", "1"] }; // Unix/Mac options

    const isServerUp = await ping.promise.probe(serverHost, pingOptions);

    if (!isServerUp.alive) {
      console.log("Remote server is not accessible");
      return null;
    }

    console.log("Creating new remote connection...");
    remoteDBConnection = new Sequelize(
      "inventario_patrimonio",
      "usuario",
      "root",
      {
        host: serverHost,
        dialect: "mysql",
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      }
    );

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

    const [[localInfo]] = await localDB.query(
      "SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id"
    );
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

    const [[remoteInfo]] = await remoteDB.query(
      "SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id"
    );

    return { localDB, remoteDB };
  } catch (error) {
    console.error("Remote database connection failed:", error);
    throw new Error("Cannot proceed without remote database connection");
  }
}
async function syncMissingRecords(
  localDB,
  remoteDB,
  missingRecords,
  localToRemote
) {
  let totalSynced = 0;
  const errors = [];

  for (const sbn of missingRecords) {
    try {
      if (localToRemote) {
        const localRecord = await localDB.models.bienes.findOne({
          where: { sbn },
        });

        if (localRecord) {
          const recordData = {
            ...localRecord.dataValues,
            lastSync: new Date(),
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
          where: { sbn },
        });

        if (remoteRecord) {
          const recordData = {
            ...remoteRecord.dataValues,
            lastSync: new Date(),
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
async function shouldUpdateRecord(sourceRecord, targetRecord) {
  // Convertir fechas para comparación
  const sourceDate = new Date(sourceRecord.updatedAt);
  const targetDate = new Date(targetRecord.updatedAt);

  // Si las fechas son diferentes, usar la más reciente
  if (sourceDate.getTime() !== targetDate.getTime()) {
    // Si alguno está inventariado
    if (sourceRecord.inventariado || targetRecord.inventariado) {
      // Si el origen está inventariado y es más reciente, actualizar
      if (sourceRecord.inventariado && sourceDate > targetDate) {
        return true;
      }
      // Si el destino está inventariado y es más reciente, no actualizar
      if (targetRecord.inventariado && targetDate > sourceDate) {
        return false;
      }
    }
    // Si ninguno está inventariado o la fecha del inventariado es más antigua,
    // usar siempre el más reciente
    return sourceDate > targetDate;
  }

  // Si las fechas son iguales pero los estados de inventario son diferentes,
  // priorizar el inventariado
  if (sourceRecord.inventariado !== targetRecord.inventariado) {
    return sourceRecord.inventariado;
  }

  // Si todo es igual, no hay necesidad de actualizar
  return false;
}
async function validateUserInventory(localDB, remoteDB) {
  // Verificar inventarios para usuarios del 4 al 11
  for (let userId = 4; userId <= 11; userId++) {
    const [localInventario] = await localDB.query(
      'SELECT COUNT(*) as count FROM bienes WHERE inventariado = true AND usuario_id = ?',
      { 
        replacements: [userId],
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    const [remoteInventario] = await remoteDB.query(
      'SELECT COUNT(*) as count FROM bienes WHERE inventariado = true AND usuario_id = ?',
      { 
        replacements: [userId],
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    if (localInventario.count !== remoteInventario.count) {
      const localSBNs = await localDB.query(
        'SELECT sbn FROM bienes WHERE inventariado = true AND usuario_id = ?',
        { 
          replacements: [userId],
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      for (const { sbn } of localSBNs) {
        await remoteDB.query(
          'UPDATE bienes SET inventariado = true WHERE sbn = ?',
          { 
            replacements: [sbn],
            type: Sequelize.QueryTypes.UPDATE 
          }
        );
      }
      console.log(`Synchronized inventory for user ${userId}: ${localInventario.count} items`);
    }
  }
}

async function syncLocalToRemote(localDB, remoteDB) {
  try {
    const BATCH_SIZE = 3000;
    let offset = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalProtected = 0;

    console.log('\nIniciando sincronización Local → Remoto');

    // Obtener todos los registros remotos inventariados para protegerlos
    const remoteInventariadosInitial = await remoteDB.query(
      'SELECT sbn FROM bienes WHERE inventariado = true',
      {
        type: Sequelize.QueryTypes.SELECT  // Esto es importante
      }
    );

    // Crear Set con los SNBs inventariados
    const remoteInventariadosSet = new Set(remoteInventariadosInitial.map(r => r.sbn));

    while (true) {
      const bienesLocales = await localDB.models.bienes.findAll({
        limit: BATCH_SIZE,
        offset,
      });

      if (!bienesLocales.length) break;

      console.log(`\nProcesando lote de ${bienesLocales.length} registros locales...`);

      const remoteRecords = await remoteDB.models.bienes.findAll();
      const remoteRecordsMap = new Map(remoteRecords.map((r) => [r.sbn, r]));

      const recordsToCreate = [];
      const recordsToUpdate = [];

      for (const localRecord of bienesLocales) {
        const remoteRecord = remoteRecordsMap.get(localRecord.sbn);

        if (remoteInventariadosSet.has(localRecord.sbn)) {
          // Ya está inventariado en remoto, proteger y continuar
          totalProtected++;
          continue;
        } else if (localRecord.inventariado) {
          // Si está inventariado en local pero no en remoto, actualizar remoto
          await remoteDB.models.bienes.update(
            { inventariado: true },
            { where: { sbn: localRecord.sbn } }
          );
          totalUpdated++;
        }

        const recordData = {
          ...localRecord.dataValues,
          lastSync: new Date(),
          updatedAt: localRecord.updatedAt,
        };
        delete recordData.id;

        // Crear solo si no existe en remoto y está inventariado localmente
        if (!remoteRecord && localRecord.inventariado) {
          recordsToCreate.push(recordData);
        }
        // Actualizar solo si existe en remoto, no está inventariado en remoto,
        // y cumple con las condiciones de shouldUpdateRecord
        else if (
          remoteRecord &&
          !remoteRecord.inventariado &&
          await shouldUpdateRecord(localRecord, remoteRecord)
        ) {
          recordsToUpdate.push({ sbn: localRecord.sbn, data: recordData });
        }
      }

      if (recordsToCreate.length) {
        await remoteDB.models.bienes.bulkCreate(recordsToCreate, {
          silent: true,
        });
        totalCreated += recordsToCreate.length;
        console.log(`✓ Creados ${recordsToCreate.length} registros en remoto`);
      }

      for (const record of recordsToUpdate) {
        await remoteDB.models.bienes.update(record.data, {
          where: {
            sbn: record.sbn,
            inventariado: false // Asegurar que solo actualiza no inventariados
          },
          silent: true,
        });
        totalUpdated++;
      }

      offset += BATCH_SIZE;
      console.log(`
      Progreso del lote:
      - Procesados: ${offset}
      - Creados: ${totalCreated}
      - Actualizados: ${totalUpdated}
      - Protegidos (inventariados en remoto): ${totalProtected}
      `);
    }

    // Verificación final
    const [[{ count: finalLocalCount }]] = await localDB.query(
      "SELECT COUNT(*) as count FROM bienes"
    );
    const [[{ count: finalRemoteCount }]] = await remoteDB.query(
      "SELECT COUNT(*) as count FROM bienes"
    );

    // Contar inventariados en ambas bases
    const [[{ count: localInventariados }]] = await localDB.query(
      "SELECT COUNT(*) as count FROM bienes WHERE inventariado = true"
    );
    const [[{ count: remoteInventariados }]] = await remoteDB.query(
      "SELECT COUNT(*) as count FROM bienes WHERE inventariado = true"
    );

    console.log(`
      === Resumen de sincronización Local → Remoto ===
      ✓ Registros creados: ${totalCreated}
      ✓ Registros actualizados: ${totalUpdated}
      ✓ Registros protegidos: ${totalProtected}

      Estadísticas:
      - Total registros en local: ${finalLocalCount}
      - Total registros en remoto: ${finalRemoteCount}
      - Inventariados en local: ${localInventariados}
      - Inventariados en remoto: ${remoteInventariados}
    `);

    return {
      created: totalCreated,
      updated: totalUpdated,
      protected: totalProtected,
      finalCounts: { local: finalLocalCount, remote: finalRemoteCount },
      inventariados: { local: localInventariados, remote: remoteInventariados }
    };

  } catch (error) {
    console.error("Error en sincronización Local → Remoto:", error);
    throw error;
  }
}

async function syncRemoteToLocal(localDB, remoteDB) {
  try {
    const BATCH_SIZE = 3000;
    let offset = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalProtected = 0;

    console.log('\nIniciando sincronización Remoto → Local');

    // Obtener los SNBs inventariados locales para protección
    const localInventariados = await localDB.query(
      'SELECT sbn FROM bienes WHERE inventariado = true',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const localInventariadosSet = new Set(localInventariados.map(r => r.sbn));
    console.log(`Registros inventariados en local: ${localInventariadosSet.size}`);

    while (true) {
      const bienesRemotos = await remoteDB.models.bienes.findAll({
        limit: BATCH_SIZE,
        offset,
        order: [['updatedAt', 'DESC']]
      });

      if (!bienesRemotos.length) break;

      console.log(`\nProcesando lote de ${bienesRemotos.length} registros remotos...`);

      // Obtener registros locales para este lote
      const localRecords = await localDB.models.bienes.findAll();
      const localRecordsMap = new Map(localRecords.map(r => [r.sbn, r]));

      for (const remoteRecord of bienesRemotos) {
        const localRecord = localRecordsMap.get(remoteRecord.sbn);

        if (localRecord?.inventariado || remoteRecord.inventariado) {
          // Si está inventariado en cualquiera de las dos bases, asegurar que esté en ambas
          if (!localRecord?.inventariado) {
            await localDB.models.bienes.update(
              { inventariado: true },
              { where: { sbn: remoteRecord.sbn } }
            );
            totalUpdated++;
          }
          if (!remoteRecord.inventariado) {
            await remoteDB.models.bienes.update(
              { inventariado: true },
              { where: { sbn: remoteRecord.sbn } }
            );
          }
          totalProtected++;
          continue;
        }

        try {
          const recordData = {
            ...remoteRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          // Si no existe en local, crearlo
          if (!localRecord) {
            await localDB.models.bienes.create(recordData);
            totalCreated++;
            continue;
          }

          // Si existe pero no está inventariado localmente y el remoto es más reciente
          if (!localRecord.inventariado &&
            new Date(remoteRecord.updatedAt) > new Date(localRecord.updatedAt)) {
            await localDB.models.bienes.update(recordData, {
              where: {
                sbn: remoteRecord.sbn,
                inventariado: false // Doble verificación
              }
            });
            totalUpdated++;
          }

        } catch (error) {
          console.error(`Error procesando ${remoteRecord.sbn}:`, error.message);
        }
      }

      offset += bienesRemotos.length;
      console.log(`
      Progreso del lote:
      - Procesados: ${offset}
      - Creados: ${totalCreated}
      - Actualizados: ${totalUpdated}
      - Protegidos (inventariados local): ${totalProtected}
            `);
    }

    // Verificación final
    const [[{ count: finalLocalCount }]] = await localDB.query(
      'SELECT COUNT(*) as count FROM bienes'
    );
    const [[{ count: finalRemoteCount }]] = await remoteDB.query(
      'SELECT COUNT(*) as count FROM bienes'
    );

    // Verificación de inventariados
    const [[{ count: totalLocalInventariados }]] = await localDB.query(
      'SELECT COUNT(*) as count FROM bienes WHERE inventariado = true'
    );
    const [[{ count: totalRemoteInventariados }]] = await remoteDB.query(
      'SELECT COUNT(*) as count FROM bienes WHERE inventariado = true'
    );

    console.log(`
=== Resumen de sincronización Remoto → Local ===
✓ Registros creados: ${totalCreated}
✓ Registros actualizados: ${totalUpdated}
✓ Registros protegidos: ${totalProtected}

Estadísticas:
- Total registros en local: ${finalLocalCount}
- Total registros en remoto: ${finalRemoteCount}
- Inventariados en local: ${totalLocalInventariados}
- Inventariados en remoto: ${totalRemoteInventariados}
    `);

    return {
      created: totalCreated,
      updated: totalUpdated,
      protected: totalProtected,
      finalCounts: { local: finalLocalCount, remote: finalRemoteCount }
    };

  } catch (error) {
    console.error("\nError en sincronización Remoto → Local:", error);
    throw error;
  }
}
async function syncDatabases() {
  try {
    const { localDB, remoteDB } = await verifyDatabaseConnections();

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
      type: Sequelize.QueryTypes.SELECT,
    });

    const missingInLocal = await remoteDB.query(missingInLocalQuery, {
      type: Sequelize.QueryTypes.SELECT,
    });

    // Handle missing records first
    if (missingInRemote.length > 0) {
      console.log(`Found ${missingInRemote.length} records missing in remote`);
      await syncMissingRecords(
        localDB,
        remoteDB,
        missingInRemote.map((r) => r.sbn),
        true
      );
    }

    if (missingInLocal.length > 0) {
      console.log(`Found ${missingInLocal.length} records missing in local`);
      await syncMissingRecords(
        localDB,
        remoteDB,
        missingInLocal.map((r) => r.sbn),
        false
      );
    }
    const needsSync = await checkAndSyncIfNeeded(remoteDB, localDB);

    if (needsSync) {
      await syncReferenceTables(remoteDB, localDB);
    }

    // Then handle updates
    console.log("\nSyncing local changes to remote...");
    await syncLocalToRemote(localDB, remoteDB);

    console.log("\nSyncing remote changes to local...");
    await syncRemoteToLocal(localDB, remoteDB);

    // Final verification
    const [[{ count: finalLocalCount }]] = await localDB.query(
      "SELECT COUNT(*) as count FROM bienes"
    );
    const [[{ count: finalRemoteCount }]] = await remoteDB.query(
      "SELECT COUNT(*) as count FROM bienes"
    );
    const usuariosTotal = await localDB.query('SELECT DISTINCT usuario_id FROM bienes WHERE usuario_id IS NOT NULL');
    for (const { usuario_id } of usuariosTotal) {
      await validateUserInventory(localDB, remoteDB, usuario_id);
    }

    // Final status output
    console.log(`\nFinal counts after user inventory validation:`);
    console.log(`Local database: ${finalLocalCount} records`);
    console.log(`Remote database: ${finalRemoteCount} records`);

    console.log("\nFinal record counts:");
    console.log(`Local database: ${finalLocalCount} records`);
    console.log(`Remote database: ${finalRemoteCount} records`);

    if (finalLocalCount === finalRemoteCount) {
      console.log("✓ Databases are synchronized");
    } else {
      console.log("! Database counts still don't match");

      const differences = await remoteDB.query(
        `
        SELECT 'missing_in_local' as type, r.sbn 
        FROM bienes r 
        WHERE NOT EXISTS (SELECT 1 FROM bienes l WHERE l.sbn = r.sbn)
        UNION ALL
        SELECT 'missing_in_remote' as type, l.sbn
        FROM bienes l 
        WHERE NOT EXISTS (SELECT 1 FROM bienes r WHERE r.sbn = l.sbn)
      `,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (differences.length > 0) {
        console.log("Found differences:", differences);
      }
    }
    const usuarios = await localDB.query('SELECT DISTINCT usuario_id FROM bienes WHERE usuario_id IS NOT NULL');
    for (const { usuario_id } of usuarios) {
      await validateUserInventory(localDB, remoteDB);
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
      "SELECT * FROM sedes ORDER BY id ASC",
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${remoteSedes.length} sedes in remote database`);

    // 2. Desactivar temporalmente las restricciones de clave foránea
    await localDB.query("SET FOREIGN_KEY_CHECKS = 0");

    // 3. Eliminar todas las sedes locales
    await localDB.query("TRUNCATE TABLE sedes");

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
            updatedAt: sede.updatedAt,
          },
        }
      );
      console.log(`Inserted sede ID: ${sede.id} - ${sede.nombre}`);
    }

    // 5. Reactivar las restricciones de clave foránea
    await localDB.query("SET FOREIGN_KEY_CHECKS = 1");

    // 6. Verificar la sincronización
    const [localSedes] = await localDB.query(
      "SELECT * FROM sedes ORDER BY id ASC"
    );

    console.log("\nVerification:");
    console.log(`Remote sedes: ${remoteSedes.length}`);
    console.log(`Local sedes: ${localSedes.length}`);

    if (remoteSedes.length === localSedes.length) {
      console.log("✓ Sedes synchronized successfully");
    } else {
      console.log("! Warning: Sede counts don't match");
    }

    // Mostrar algunas sedes para verificación
    console.log("\nSample of synchronized sedes:");
    remoteSedes.slice(0, 5).forEach((sede) => {
      console.log(`ID: ${sede.id}, Nombre: ${sede.nombre}`);
    });
  } catch (error) {
    console.error("Error syncing sedes:", error);
    // Asegurarse de reactivar las restricciones de clave foránea en caso de error
    await localDB.query("SET FOREIGN_KEY_CHECKS = 1");
    throw error;
  }
}
async function syncDependencias(remoteDB, localDB) {
  console.log("\nStarting Dependencias sync");
  try {
    // 1. Obtener dependencias remotas
    const remoteDependencias = await remoteDB.query(
      "SELECT * FROM dependencias ORDER BY id ASC",
      {
        type: Sequelize.QueryTypes.SELECT, // Esto es importante para obtener el array directamente
      }
    );

    console.log(
      `Found ${remoteDependencias.length} dependencias in remote database`
    );

    // Debug: Mostrar algunas dependencias remotas
    console.log("\nSample remote dependencias:");
    remoteDependencias.slice(0, 3).forEach((dep) => {
      console.log(`ID: ${dep.id}, Nombre: ${dep.nombre}, Sede: ${dep.sede_id}`);
    });

    // 2. Desactivar foreign key checks
    await localDB.query("SET FOREIGN_KEY_CHECKS = 0");

    try {
      // 3. Limpiar tabla local
      await localDB.query("TRUNCATE TABLE dependencias");

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
              updatedAt: dep.updatedAt,
            },
          }
        );
        console.log(`Inserted dependencia ID: ${dep.id} - ${dep.nombre}`);
      }

      // 5. Verificar la sincronización
      const localDependencias = await localDB.query(
        "SELECT * FROM dependencias ORDER BY id ASC",
        { type: Sequelize.QueryTypes.SELECT }
      );

      console.log("\nVerification:");
      console.log(`Remote dependencias: ${remoteDependencias.length}`);
      console.log(`Local dependencias: ${localDependencias.length}`);

      // Mostrar algunas dependencias locales
      console.log("\nSample local dependencias after sync:");
      localDependencias.slice(0, 3).forEach((dep) => {
        console.log(
          `ID: ${dep.id}, Nombre: ${dep.nombre}, Sede: ${dep.sede_id}`
        );
      });
    } finally {
      // Reactivar foreign key checks
      await localDB.query("SET FOREIGN_KEY_CHECKS = 1");
    }
  } catch (error) {
    console.error("Error syncing dependencias:", error);
    console.error("Full error:", error.message);
    // Asegurar que se reactivan las foreign key checks en caso de error
    await localDB.query("SET FOREIGN_KEY_CHECKS = 1");
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
            oldSedeId: sede.id,
          },
          type: Sequelize.QueryTypes.UPDATE,
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
