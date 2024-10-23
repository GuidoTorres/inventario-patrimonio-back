const { getDatabaseConnection } = require("./../../config/config");
const cron = require("node-cron");

cron.schedule("* * * * *", async () => {
  console.log("Iniciando sincronización de bienes...");
  try {
    await syncDatabases(); // Llama a la función de sincronización
    console.log("Sincronización completa.");
  } catch (error) {
    console.error("Error durante la sincronización:", error);
  }
});

// Función para sincronizar bases de datos locales y remotas
async function syncDatabases() {
  try {
    const db = getDatabaseConnection(); // Obtenemos la conexión actual, ya sea local o remota

    // --- Sincronización de Local a Remoto ---
    const bienesLocales = await db.models.bienes.findAll({
      where: {
        [Sequelize.Op.or]: [
          { lastSync: { [Sequelize.Op.eq]: null } }, // No sincronizados
          { updatedAt: { [Sequelize.Op.gt]: Sequelize.col('lastSync') } } // Modificados después de la última sincronización
        ]
      }
    });

    if (bienesLocales.length > 0) {
      console.log("Sincronizando de local a remoto...");

      // Aquí, asumiendo que se está conectando a la base de datos remota:
      const remoteDB = await getRemoteDatabaseConnection(); // Asegúrate de que esté disponible la conexión remota

      for (const bien of bienesLocales) {
        // Insertar o actualizar en la base de datos remota
        await remoteDB.models.bienes.upsert(bien.dataValues);

        // Actualizar el campo lastSync en la base de datos local
        await db.models.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn } }
        );
      }
    }

    console.log('Sincronización de local a remoto completada.');

    // --- Sincronización de Remoto a Local ---
    const bienesRemotos = await remoteDB.models.bienes.findAll({
      where: {
        [Sequelize.Op.or]: [
          { lastSync: { [Sequelize.Op.eq]: null } }, // No sincronizados
          { updatedAt: { [Sequelize.Op.gt]: Sequelize.col('lastSync') } } // Modificados después de la última sincronización
        ]
      }
    });

    if (bienesRemotos.length > 0) {
      console.log("Sincronizando de remoto a local...");

      for (const bien of bienesRemotos) {
        // Insertar o actualizar en la base de datos local
        await db.models.bienes.upsert(bien.dataValues);

        // Actualizar el campo lastSync en la base de datos remota
        await remoteDB.models.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn } }
        );
      }
    }

    console.log('Sincronización de remoto a local completada.');

  } catch (error) {
    console.error("Error durante la sincronización:", error);
  }
}

// Obtener conexión remota en caso de que esté disponible
async function getRemoteDatabaseConnection() {
  const serverHost = "10.30.1.43"; // Dirección IP de tu servidor remoto
  const isServerUp = await isServerReachable(serverHost);
  if (isServerUp) {
    return new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: serverHost,
      dialect: "mysql",
      logging: false,
    });
  } else {
    console.error("Servidor remoto no disponible para la sincronización.");
    throw new Error("Servidor remoto no disponible");
  }
}
