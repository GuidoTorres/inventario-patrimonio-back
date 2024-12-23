const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");

let remoteDBConnection = null;

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
      } catch {}
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
async function syncDatabases() {
  try {
    const { localDB, remoteDB } = await verifyDatabaseConnections();
    console.log("Iniciando sincronización completa...");

    // 1. Obtener todos los registros de ambas bases
    const localRecords = await localDB.query("SELECT * FROM bienes", {
      type: Sequelize.QueryTypes.SELECT,
    });

    const remoteRecords = await remoteDB.query("SELECT * FROM bienes", {
      type: Sequelize.QueryTypes.SELECT,
    });

    // Crear mapas para comparaciones rápidas
    const localMap = new Map(localRecords.map((r) => [r.sbn, r]));
    const remoteMap = new Map(remoteRecords.map((r) => [r.sbn, r]));

    // 2. Sincronizar registros nuevos de local a remoto
    for (const localRecord of localRecords) {
      if (!remoteMap.has(localRecord.sbn)) {
        // Insertar nuevo registro en remoto
        await remoteDB.query(
          `INSERT INTO bienes 
           (sbn, descripcion, marca, modelo, serie, color, estado, situacion, sede_id, 
            ubicacion_id, dependencia_id, dni, estado_patrimonial, fecha_registro, inventariado, 
            createdAt, updatedAt, foto, detalles, usuario_id, tipo, secuencia, observacion, lastSync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              localRecord.sbn,
              localRecord.descripcion,
              localRecord.marca,
              localRecord.modelo,
              localRecord.serie,
              localRecord.color,
              localRecord.estado,
              localRecord.situacion,
              localRecord.sede_id,
              localRecord.ubicacion_id,
              localRecord.dependencia_id,
              localRecord.dni,
              localRecord.estado_patrimonial,
              localRecord.fecha_registro,
              localRecord.inventariado,
              localRecord.createdAt,
              localRecord.updatedAt,
              localRecord.foto,
              localRecord.detalles,
              localRecord.usuario_id,
              localRecord.tipo,
              localRecord.secuencia,
              localRecord.observacion,
              new Date(), // lastSync
            ],
            type: Sequelize.QueryTypes.INSERT,
          }
        );
      }
    }

    // 3. Sincronizar registros nuevos de remoto a local
    for (const remoteRecord of remoteRecords) {
      if (!localMap.has(remoteRecord.sbn)) {
        // Insertar nuevo registro en local
        await localDB.query(
          `INSERT INTO bienes 
           (sbn, descripcion, marca, modelo, serie, color, estado, situacion, sede_id, 
            ubicacion_id, dependencia_id, dni, estado_patrimonial, fecha_registro, inventariado, 
            createdAt, updatedAt, foto, detalles, usuario_id, tipo, secuencia, observacion, lastSync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              remoteRecord.sbn,
              remoteRecord.descripcion,
              remoteRecord.marca,
              remoteRecord.modelo,
              remoteRecord.serie,
              remoteRecord.color,
              remoteRecord.estado,
              remoteRecord.situacion,
              remoteRecord.sede_id,
              remoteRecord.ubicacion_id,
              remoteRecord.dependencia_id,
              remoteRecord.dni,
              remoteRecord.estado_patrimonial,
              remoteRecord.fecha_registro,
              remoteRecord.inventariado,
              remoteRecord.createdAt,
              remoteRecord.updatedAt,
              remoteRecord.foto,
              remoteRecord.detalles,
              remoteRecord.usuario_id,
              remoteRecord.tipo,
              remoteRecord.secuencia,
              remoteRecord.observacion,
              new Date(), // lastSync
            ],
            type: Sequelize.QueryTypes.INSERT,
          }
        );
      }
    }

    // 4. Actualizar registros existentes con lógica de preservación
    for (const localRecord of localRecords) {
      const remoteRecord = remoteMap.get(localRecord.sbn);

      if (remoteRecord) {
        const localUpdatedAt = new Date(localRecord.updatedAt);
        const remoteUpdatedAt = new Date(remoteRecord.updatedAt);

        if (localUpdatedAt > remoteUpdatedAt) {
          // Local es más reciente, actualizar remoto
          await remoteDB.query(
            `UPDATE bienes 
             SET descripcion = ?, marca = ?, modelo = ?, serie = ?, color = ?, estado = ?, 
                 situacion = ?, sede_id = ?, ubicacion_id = ?, dependencia_id = ?, dni = ?, 
                 estado_patrimonial = ?, fecha_registro = ?, inventariado = ?, updatedAt = ?, 
                 foto = ?, detalles = ?, usuario_id = ?, tipo = ?, secuencia = ?, 
                 observacion = ?, lastSync = ?
             WHERE sbn = ?`,
            {
              replacements: [
                localRecord.descripcion,
                localRecord.marca,
                localRecord.modelo,
                localRecord.serie,
                localRecord.color,
                localRecord.estado,
                localRecord.situacion,
                localRecord.sede_id,
                localRecord.ubicacion_id,
                localRecord.dependencia_id,
                localRecord.dni,
                localRecord.estado_patrimonial,
                localRecord.fecha_registro,
                localRecord.inventariado,
                localRecord.updatedAt,
                localRecord.foto,
                localRecord.detalles,
                localRecord.usuario_id,
                localRecord.tipo,
                localRecord.secuencia,
                localRecord.observacion,
                new Date(),
                localRecord.sbn,
              ],
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
        } else if (remoteUpdatedAt > localUpdatedAt) {
          // Remoto es más reciente, actualizar local
          await localDB.query(
            `UPDATE bienes 
             SET descripcion = ?, marca = ?, modelo = ?, serie = ?, color = ?, estado = ?, 
                 situacion = ?, sede_id = ?, ubicacion_id = ?, dependencia_id = ?, dni = ?, 
                 estado_patrimonial = ?, fecha_registro = ?, inventariado = ?, updatedAt = ?, 
                 foto = ?, detalles = ?, usuario_id = ?, tipo = ?, secuencia = ?, 
                 observacion = ?, lastSync = ?
             WHERE sbn = ?`,
            {
              replacements: [
                remoteRecord.descripcion,
                remoteRecord.marca,
                remoteRecord.modelo,
                remoteRecord.serie,
                remoteRecord.color,
                remoteRecord.estado,
                remoteRecord.situacion,
                remoteRecord.sede_id,
                remoteRecord.ubicacion_id,
                remoteRecord.dependencia_id,
                remoteRecord.dni,
                remoteRecord.estado_patrimonial,
                remoteRecord.fecha_registro,
                remoteRecord.inventariado,
                remoteRecord.updatedAt,
                remoteRecord.foto,
                remoteRecord.detalles,
                remoteRecord.usuario_id,
                remoteRecord.tipo,
                remoteRecord.secuencia,
                remoteRecord.observacion,
                new Date(),
                remoteRecord.sbn,
              ],
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
        } else {
          // localUpdatedAt === remoteUpdatedAt
          if (localRecord.inventariado !== remoteRecord.inventariado) {
            if (localRecord.inventariado === true || remoteRecord.inventariado === true) {
              // Si uno de los dos es true, sincronizamos a true en ambos
              await remoteDB.query(
                `UPDATE bienes 
                 SET inventariado = ?, updatedAt = ?, lastSync = ?
                 WHERE sbn = ?`,
                {
                  replacements: [
                    true,
                    new Date(),
                    new Date(),
                    localRecord.sbn,
                  ],
                  type: Sequelize.QueryTypes.UPDATE,
                }
              );
              await localDB.query(
                `UPDATE bienes 
                 SET inventariado = ?, updatedAt = ?, lastSync = ?
                 WHERE sbn = ?`,
                {
                  replacements: [
                    true,
                    new Date(),
                    new Date(),
                    remoteRecord.sbn,
                  ],
                  type: Sequelize.QueryTypes.UPDATE,
                }
              );
            } else {
              // Si uno de los dos es false o null, sincronizamos a false en ambos
              await remoteDB.query(
                `UPDATE bienes 
                 SET inventariado = ?, updatedAt = ?, lastSync = ?
                 WHERE sbn = ?`,
                {
                  replacements: [
                    false,
                    new Date(),
                    new Date(),
                    localRecord.sbn,
                  ],
                  type: Sequelize.QueryTypes.UPDATE,
                }
              );
              await localDB.query(
                `UPDATE bienes 
                 SET inventariado = ?, updatedAt = ?, lastSync = ?
                 WHERE sbn = ?`,
                {
                  replacements: [
                    false,
                    new Date(),
                    new Date(),
                    remoteRecord.sbn,
                  ],
                  type: Sequelize.QueryTypes.UPDATE,
                }
              );
            }
          }
        }
      }
    }

    // 5. Resumen final
    const finalLocal = await localDB.query(
      "SELECT COUNT(*) AS count FROM bienes WHERE inventariado = true",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    const finalRemote = await remoteDB.query(
      "SELECT COUNT(*) AS count FROM bienes WHERE inventariado = true",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`
      Resumen de sincronización:
      - Registros inventariados en local: ${finalLocal[0].count}
      - Registros inventariados en remoto: ${finalRemote[0].count}
    `);

    console.log("Sincronización completa.");
  } catch (error) {
    console.error("Error durante la sincronización:", error);
  }
}


module.exports = { syncDatabases };
