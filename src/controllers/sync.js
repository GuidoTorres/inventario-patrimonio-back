async function syncDatabases() {
    try {
      const { models: localModels } = await getLocalDatabaseConnection(); // Conexión local
      const { models: remoteModels } = await getRemoteDatabaseConnection(); // Conexión remota
  
      // --- Sincronizar de local a remoto ---
      // Buscar los registros en la base de datos local que necesitan ser sincronizados
      const bienesLocales = await localModels.bienes.findAll({
        where: {
          [Sequelize.Op.or]: [
            { lastSync: { [Sequelize.Op.eq]: null } }, // No sincronizados
            { updatedAt: { [Sequelize.Op.gt]: Sequelize.col('lastSync') } } // Modificados después de la última sincronización
          ]
        }
      });
  
      // Enviar bienes locales al servidor remoto
      for (const bien of bienesLocales) {
        await remoteModels.bienes.upsert(bien.dataValues); // Insertar o actualizar en la base de datos remota
        
        // Actualizar el campo lastSync en la base de datos local
        await localModels.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn } }
        );
      }
  
      // --- Sincronizar de remoto a local ---
      // Buscar los registros en la base de datos remota que necesitan ser sincronizados
      const bienesRemotos = await remoteModels.bienes.findAll({
        where: {
          [Sequelize.Op.or]: [
            { lastSync: { [Sequelize.Op.eq]: null } }, // No sincronizados
            { updatedAt: { [Sequelize.Op.gt]: Sequelize.col('lastSync') } } // Modificados después de la última sincronización
          ]
        }
      });
  
      // Enviar bienes remotos a la base de datos local
      for (const bien of bienesRemotos) {
        await localModels.bienes.upsert(bien.dataValues); // Insertar o actualizar en la base de datos local
  
        // Actualizar el campo lastSync en la base de datos remota
        await remoteModels.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn } }
        );
      }
  
      console.log("Sincronización completada con éxito");
    } catch (error) {
      console.error("Error durante la sincronización:", error);
    }
  }
  