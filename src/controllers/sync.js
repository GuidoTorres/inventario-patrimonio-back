const { Sequelize } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");

async function syncDatabases() {
  try {
    const db = getDatabaseConnection(); // Obtenemos la conexión actual, ya sea local o remota
    console.log("Conexión establecida con la base de datos:", db.config.database);

    // --- Conexión a la base de datos remota ---
    const remoteDB = await getRemoteDatabaseConnection(); // Conexión remota
    if (!remoteDB) {
      console.error("No se pudo establecer conexión con la base de datos remota.");
      return;
    }

    // --- Sincronización de Local a Remoto ---
    const bienesLocales = await db.models.bienes.findAll({
      where: {
        [Sequelize.Op.or]: [
          { lastSync: { [Sequelize.Op.eq]: null } }, // No sincronizados
          { updatedAt: { [Sequelize.Op.gt]: Sequelize.col("lastSync") } } // Modificados después de la última sincronización
        ]
      }
    });

    if (bienesLocales.length > 0) {
      console.log("Sincronizando de local a remoto...");

      for (const bien of bienesLocales) {
        const existingBien = await remoteDB.models.bienes.findOne({
          where: { sbn: bien.sbn }
        });

        if (existingBien) {
          await existingBien.update(bien.dataValues, { silent: true }); // silent aquí
          console.log(`Actualizado bien con SBN: ${bien.sbn}`);
        } else {
          await remoteDB.models.bienes.create(bien.dataValues, { silent: true }); // silent también aquí
          console.log(`Creado nuevo bien con SBN: ${bien.sbn}`);
        }

        // Actualizar el campo lastSync en la base de datos local
        await db.models.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn }, silent: true } // silent en el update local
        );
      }
    }

    console.log("Sincronización de local a remoto completada.");

    // --- Sincronización de Remoto a Local ---
    const bienesRemotos = await remoteDB.models.bienes.findAll({
      where: {
        [Sequelize.Op.or]: [
          { lastSync: { [Sequelize.Op.eq]: null } },
          { updatedAt: { [Sequelize.Op.gt]: Sequelize.col("lastSync") } }
        ]
      }
    });

    if (bienesRemotos.length > 0) {
      console.log("Sincronizando de remoto a local...");

      for (const bien of bienesRemotos) {
        const existingBien = await db.models.bienes.findOne({
          where: { sbn: bien.sbn }
        });

        if (existingBien) {
          await existingBien.update(bien.dataValues, { silent: true }); // silent aquí también
          console.log(`Actualizado bien con SBN: ${bien.sbn}`);
        } else {
          await db.models.bienes.create(bien.dataValues, { silent: true }); // silent también aquí
          console.log(`Creado nuevo bien con SBN: ${bien.sbn}`);
        }

        // Actualizar el campo lastSync en la base de datos remota
        await remoteDB.models.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn }, silent: true } // silent en el update remoto
        );
      }
    }

    console.log("Sincronización de remoto a local completada.");
  } catch (error) {
    console.error("Error durante la sincronización:", error);
  }
}

async function isServerReachable(serverHost) {
  try {
    const res = await ping.promise.probe(serverHost);
    return res.alive;
  } catch (error) {
    console.error("Error al intentar hacer ping al servidor:", error);
    return false;
  }
}

// Obtener conexión remota en caso de que esté disponible
async function getRemoteDatabaseConnection() {
  const serverHost = "10.30.1.43";
  const isServerUp = await isServerReachable(serverHost);
  if (isServerUp) {
    const remoteDB = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: serverHost,
      dialect: "mysql",
      logging: console.log, // Cambia a false si no deseas ver los logs
    });
    initModels(remoteDB); // Asegúrate de inicializar los modelos aquí
    return remoteDB;
  } else {
    console.error("Servidor remoto no disponible para la sincronización.");
    return null;
  }
}

module.exports = { syncDatabases };
