const { Sequelize, QueryTypes } = require("sequelize");

// Configuración de las tablas a sincronizar
const TABLE_CONFIGS = {
    ubicaciones: {
      tableName: 'ubicaciones',
      columns: [
        'id', 
        'nombre', 
        'dependencia_id', 
        'tipo_ubicac', 
        'ubicac_fisica', 
        'createdAt', 
        'updatedAt'
      ]
    },
    trabajadores: {
      tableName: 'trabajadores',
      columns: [
        'id',
        'dni',
        'nombre',
        'estado',
        'createdAt',
        'updatedAt'
      ]
    },
    dependencias: {
      tableName: 'dependencias',
      columns: [
        'id',
        'tipo_ubicac',
        'ubicac_fisica',
        'nombre',
        'sede_id',
        'createdAt',
        'updatedAt'
      ]
    }
  };
  
  const DB_CONFIGS = {
    server: {
      database: "inventario_patrimonio",
      username: "usuario",
      password: "root",
      host: "10.30.1.43",
      dialect: "mysql",
      logging: false
    },
    local: {
      database: "inventario_patrimonio",
      username: "root",
      password: "root",
      host: "localhost",
      dialect: "mysql",
      logging: false
    }
  };

  const sincronizarTabla = async (tableConfig, localDB, serverDB, direction = 'both') => {
    const { tableName, columns } = tableConfig;
    let processedCount = 0;
    let errorCount = 0;
  
    try {
      const selectQuery = `
        SELECT ${columns.join(', ')}
        FROM ${tableName}
        ORDER BY id ASC
      `;
  
      const [registrosLocal, registrosServer] = await Promise.all([
        localDB.query(selectQuery, { type: QueryTypes.SELECT }),
        serverDB.query(selectQuery, { type: QueryTypes.SELECT })
      ]);
  
      console.log(`
    ✓ Registros encontrados en ${tableName}:
      → Local: ${registrosLocal.length}
      → Servidor: ${registrosServer.length}
      `);
  
      const localMap = new Map(registrosLocal.map(r => [r.id, r]));
      const serverMap = new Map(registrosServer.map(r => [r.id, r]));
  
      // Obtener registros nuevos y actualizados
      const registrosNuevosEnServer = registrosServer.filter(r => !localMap.has(r.id));
      const registrosActualizadosEnServer = registrosServer.filter(r => {
        const localReg = localMap.get(r.id);
        if (!localReg) return false;
        return new Date(r.updatedAt) > new Date(localReg.updatedAt);
      });
  
      const registrosNuevosEnLocal = registrosLocal.filter(r => !serverMap.has(r.id));
      const registrosActualizadosEnLocal = registrosLocal.filter(r => {
        const serverReg = serverMap.get(r.id);
        if (!serverReg) return false;
        return new Date(r.updatedAt) > new Date(serverReg.updatedAt);
      });
  
      console.log(`
    ✓ Análisis de ${tableName}:
      → Nuevos en servidor: ${registrosNuevosEnServer.length}
      → Actualizados en servidor: ${registrosActualizadosEnServer.length}
      → Nuevos en local: ${registrosNuevosEnLocal.length}
      → Actualizados en local: ${registrosActualizadosEnLocal.length}
      `);
  
      const sincronizarRegistro = async (registro, targetDB, isInsert, source, transaction) => {
        const replacements = {};
        columns.forEach(column => {
          replacements[column] = registro[column];
        });
  
        try {
          if (isInsert) {
            const insertColumns = columns.join(', ');
            const insertValues = columns.map(col => `:${col}`).join(', ');
            await targetDB.query(
              `INSERT INTO ${tableName} (${insertColumns})
               VALUES (${insertValues})`,
              { replacements, type: QueryTypes.INSERT, transaction }
            );
            console.log(`✓ ${tableName} ID ${registro.id} insertado en ${source}`);
          } else {
            const updateSet = columns
              .filter(col => col !== 'id')
              .map(col => `${col} = :${col}`)
              .join(', ');
  
            await targetDB.query(
              `UPDATE ${tableName}
               SET ${updateSet}
               WHERE id = :id`,
              { replacements, type: QueryTypes.UPDATE, transaction }
            );
            console.log(`✓ ${tableName} ID ${registro.id} actualizado en ${source}`);
          }
          processedCount++;
        } catch (error) {
          errorCount++;
          console.error(`
          Error en ${tableName} ID ${registro.id}:
          - Operación: ${isInsert ? 'INSERT' : 'UPDATE'}
          - Base de datos destino: ${source}
          - Código de error: ${error.parent?.code || 'N/A'}
          - Mensaje: ${error.message}
          - Detalles SQL: ${error.parent?.sqlMessage || 'N/A'}
          - Valores: ${JSON.stringify(replacements, null, 2)}
          `);
        }
      };
  
      if (direction === 'both' || direction === 'server-to-local') {
        console.log(`\nSincronizando ${tableName} Servidor → Local`);
        await localDB.transaction(async transaction => {
          await localDB.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
          try {
            for (const registro of registrosNuevosEnServer) {
              await sincronizarRegistro(registro, localDB, true, 'local', transaction);
            }
            for (const registro of registrosActualizadosEnServer) {
              await sincronizarRegistro(registro, localDB, false, 'local', transaction);
            }
          } finally {
            await localDB.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
          }
        });
      }
  
      if (direction === 'both' || direction === 'local-to-server') {
        console.log(`\nSincronizando ${tableName} Local → Servidor`);
        await serverDB.transaction(async transaction => {
          await serverDB.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
          try {
            for (const registro of registrosNuevosEnLocal) {
              await sincronizarRegistro(registro, serverDB, true, 'servidor', transaction);
            }
            for (const registro of registrosActualizadosEnLocal) {
              await sincronizarRegistro(registro, serverDB, false, 'servidor', transaction);
            }
          } finally {
            await serverDB.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
          }
        });
      }
  
      return { processedCount, errorCount, registrosLocal, registrosServer };
    } catch (error) {
      throw new Error(`Error sincronizando ${tableName}: ${error.message}`);
    }
  };
  
  const sincronizarTodo = async (direction = 'both') => {
    let serverDB, localDB;
  
    try {
      if (!['both', 'server-to-local', 'local-to-server'].includes(direction)) {
        throw new Error('Dirección de sincronización inválida');
      }
  
      serverDB = new Sequelize(DB_CONFIGS.server);
      localDB = new Sequelize(DB_CONFIGS.local);
  
      await Promise.all([
        serverDB.authenticate(),
        localDB.authenticate()
      ]);
      console.log("✓ Conexiones establecidas correctamente");
  
      const resultados = {};
      for (const [tableName, config] of Object.entries(TABLE_CONFIGS)) {
        console.log(`\n=== Iniciando sincronización de ${tableName} ===`);
        try {
          const { processedCount, errorCount, registrosLocal, registrosServer } = await sincronizarTabla(
            config,
            localDB,
            serverDB,
            direction
          );
          resultados[tableName] = { processedCount, errorCount };
  
          // SOLO si es ubicaciones, generamos el mapeo dinámico en LOCAL y luego REMOTO
          if (tableName === 'ubicaciones') {
            const serverByName = new Map(registrosServer.map(r => [r.nombre, r]));
            const ID_MAPPING = {};
  
            for (const localReg of registrosLocal) {
              const serverReg = serverByName.get(localReg.nombre);
              // Si existe en servidor con otro ID, generar el mapeo
              if (serverReg && serverReg.id !== localReg.id) {
                ID_MAPPING[localReg.id] = serverReg.id;
              }
            }
  
            if (Object.keys(ID_MAPPING).length > 0) {
              console.log("=== Ajustando IDs en ubicaciones (Local) y actualizando bienes (Local) ===");
  
              await localDB.transaction(async (transaction) => {
                await localDB.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
                try {
                  const oldIds = Object.keys(ID_MAPPING).map(id => parseInt(id,10));
                  let cases = '';
  
                  for (const [oldId, newId] of Object.entries(ID_MAPPING)) {
                    // Insertar ubicación con newId si no existe en local
                    await localDB.query(`
                      INSERT IGNORE INTO ubicaciones (id, nombre, updatedAt, createdAt)
                      SELECT ${newId}, nombre, updatedAt, createdAt
                      FROM ubicaciones
                      WHERE id = ${oldId}
                    `, { transaction });
  
                    cases += ` WHEN ${oldId} THEN ${newId} `;
                  }
  
                  if (cases) {
                    await localDB.query(`
                      UPDATE bienes
                      SET ubicacion_id = CASE ubicacion_id
                        ${cases}
                      END
                      WHERE ubicacion_id IN (${oldIds.join(',')})
                    `, { transaction });
                  }
  
                  // Eliminar las ubicaciones con IDs antiguos en local
                  await localDB.query(`
                    DELETE FROM ubicaciones WHERE id IN (${oldIds.join(',')})
                  `, { transaction });
  
                } finally {
                  await localDB.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
                }
              });
  
              console.log("✓ Ajuste de IDs y actualización en 'bienes' completados (Local).");
  
              // Ahora replicamos el mismo ajuste en la base remota
              console.log("=== Ajustando IDs en ubicaciones (Remoto) y actualizando bienes (Remoto) ===");
  
              await serverDB.transaction(async (transaction) => {
                await serverDB.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
                try {
                  const oldIds = Object.keys(ID_MAPPING).map(id => parseInt(id,10));
                  let cases = '';
  
                  for (const [oldId, newId] of Object.entries(ID_MAPPING)) {
                    // Insertar ubicación con newId si no existe en remoto
                    await serverDB.query(`
                      INSERT IGNORE INTO ubicaciones (id, nombre, updatedAt, createdAt)
                      SELECT ${newId}, nombre, updatedAt, createdAt
                      FROM ubicaciones
                      WHERE id = ${oldId}
                    `, { transaction });
  
                    cases += ` WHEN ${oldId} THEN ${newId} `;
                  }
  
                  if (cases) {
                    await serverDB.query(`
                      UPDATE bienes
                      SET ubicacion_id = CASE ubicacion_id
                        ${cases}
                      END
                      WHERE ubicacion_id IN (${oldIds.join(',')})
                    `, { transaction });
                  }
  
                  // Eliminar las ubicaciones con IDs antiguos en remoto
                  await serverDB.query(`
                    DELETE FROM ubicaciones WHERE id IN (${oldIds.join(',')})
                  `, { transaction });
  
                } finally {
                  await serverDB.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
                }
              });
  
              console.log("✓ Ajuste de IDs y actualización en 'bienes' completados (Remoto).");
            }
          }
        } catch (error) {
          console.error(`✗ Error en ${tableName}:`, error.message);
          resultados[tableName] = { processedCount: 0, errorCount: 1 };
        }
      }
  
      // Mostrar resumen
      console.log('\n=== Resumen de sincronización ===');
      Object.entries(resultados).forEach(([tabla, resultado]) => {
        console.log(`
  ${tabla}:
    → Registros procesados: ${resultado.processedCount}
    → Errores encontrados: ${resultado.errorCount}
        `);
      });
  
    } catch (error) {
      console.error('✗ Error general:', error.message);
      throw error;
    } finally {
      if (localDB) await localDB.close();
      if (serverDB) await serverDB.close();
    }
  };
  
  module.exports = { sincronizarTodo };
  
  
  
  
  
  // Exportar funciones
  module.exports = {
    sincronizarTodo,
    sincronizarTabla,
    TABLE_CONFIGS,
    DB_CONFIGS
  };