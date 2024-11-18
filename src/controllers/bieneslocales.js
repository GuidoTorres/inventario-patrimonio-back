
const { Sequelize, QueryTypes } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");

const sincronizarBienLocal = async () => {
    let processedCount = 0;
    let errorCount = 0;

    try {
        // Inicializar conexiones
        const serverDB = new Sequelize("inventario_patrimonio", "root", "root", {
            host: "localhost",
            dialect: "mysql",
            logging: false
        });

        const localDB = new Sequelize("prueba_inventario", "root", "root", {
            host: "localhost",
            dialect: "mysql",
            logging: false
        });

        // Verificar conexiones
        await Promise.all([
            serverDB.authenticate(),
            localDB.authenticate()
        ]);
        console.log("Conexiones establecidas correctamente");

        // 1. Obtener datos de ambas bases de datos
        const bienesLocal = (await localDB.query(
            `SELECT id, sbn,descripcion,marca, modelo,serie,color,estado, situacion, sede_id, ubicacion_id, dependencia_id,
        dni, estado_patrimonial, createdAt, updatedAt, fecha_registro, inventariado, detalles, usuario_id, tipo, trabajador_id, observacion, lastSync
         FROM bienes 
         ORDER BY id ASC`,
            { type: QueryTypes.SELECT }
        ));

        const bienesServer = (await serverDB.query(
            `SELECT sbn,descripcion,marca, modelo,serie,color,estado, situacion, sede_id, ubicacion_id, dependencia_id,
        dni, estado_patrimonial, createdAt, updatedAt, fecha_registro, inventariado, detalles, usuario_id, tipo, trabajador_id, observacion, lastSync
         FROM bienes 
         ORDER BY id ASC`,
            { type: QueryTypes.SELECT }
        ));

        console.log(`
        Registros encontrados:
        - Local: ${bienesLocal.length}
        - Servidor: ${bienesServer.length}
      `);

        // 2. Crear mapas por ID para búsqueda rápida
        const localMap = new Map(bienesLocal.map(u => [u.id, u]));
        const serverMap = new Map(bienesServer.map(u => [u.id, u]));

        // 3. Encontrar registros para sincronizar
        const registrosNuevosEnServer = bienesServer.filter(u => !localMap.has(u.id));
        const registrosActualizadosEnServer = bienesServer.filter(u => {
            const localReg = localMap.get(u.id);
            if (!localReg) return false;
            return new Date(u.updatedAt) > new Date(localReg.updatedAt);
        });

        console.log(`
        Análisis de registros:
        - Nuevos en servidor: ${registrosNuevosEnServer.length}
        - Actualizados en servidor: ${registrosActualizadosEnServer.length}
      `);

        // 4. Funciones auxiliares para insert y update
        const insertarRegistro = async (registro) => {
            try {
                await localDB.query(
                    `INSERT INTO bienes 
             (sbn,descripcion,marca, modelo,serie,color,estado, situacion, sede_id, ubicacion_id, dependencia_id,
        dni, estado_patrimonial, createdAt, updatedAt, fecha_registro, inventariado, detalles, usuario_id, tipo, trabajador_id, observacion, lastSync)
             VALUES (:sbn,:descripcion,:marca, :modelo,:serie,:color,:estado, :situacion, :sede_id, :ubicacion_id, :dependencia_id,
        :dni, :estado_patrimonial, :createdAt, :updatedAt, :fecha_registro, :inventariado, :detalles, :usuario_id, :tipo, :trabajador_id, :observacion, :lastSync)`,
                    {
                        replacements: {
                            sbn: registro.sbn,
                            descripcion: registro.descripcion,
                            marca: registro.marca,
                            modelo: registro.modelo,
                            serie: registro.serie,
                            color: registro.color,
                            estado_patrimonial: registro.estado_patrimonial,
                            createdAt: registro.createdAt,
                            updatedAt: registro.updatedAt,
                            fecha_registro: registro.fecha_registro,
                            inventariado: registro.inventariado,
                            detalles: registro.detalles,
                            usuario_id: registro.usuario_id,
                            tipo: registro.tipo,
                            trabajador_id: registro.trabajador_id,
                            observacion: registro.observacion,
                            lastSync: registro.lastSync,

                        },
                        type: QueryTypes.INSERT
                    }
                );
                processedCount++;
                console.log(`Registro ID ${registro.id} "${registro.nombre}" copiado a local`);
            } catch (error) {
                errorCount++;
                console.error(`Error copiando ID ${registro.id} "${registro.nombre}":`, error.message);
            }
        };

        const actualizarRegistro = async (registro) => {
            try {
                await localDB.query(
                    `UPDATE bienes 
             SET nombre = :nombre,
                sbn: sbn,
                descripcion: descripcion,
                marca: marca,
                modelo: modelo,
                serie: serie,
                color: color,
                estado_patrimonial: estado_patrimonial,
                createdAt: createdAt,
                updatedAt: updatedAt,
                fecha_registro: fecha_registro,
                inventariado: inventariado,
                detalles: detalles,
                usuario_id: usuario_id,
                tipo: tipo,
                trabajador_id: trabajador_id,
                observacion: observacion,
                lastSync: lastSync,
             WHERE sbn = :sbn`,
                    {
                        replacements: {
                            ...registro,
                            updatedAt: registro.updatedAt
                        },
                        type: QueryTypes.UPDATE
                    }
                );
                processedCount++;
                console.log(`Registro ID ${registro.id} "${registro.nombre}" actualizado en local`);
            } catch (error) {
                errorCount++;
                console.error(`Error actualizando ID ${registro.id} "${registro.nombre}":`, error.message);
            }
        };

        // 5. Sincronizar registros del servidor al local
        await localDB.query('SET FOREIGN_KEY_CHECKS = 0');

        try {
            // Insertar nuevos registros del servidor
            for (const ubicacion of registrosNuevosEnServer) {
                await insertarRegistro(ubicacion);
            }

            // Actualizar registros modificados en el servidor
            for (const ubicacion of registrosActualizadosEnServer) {
                await actualizarRegistro(ubicacion);
            }
        } finally {
            await localDB.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        // 6. Verificación final
        const [countLocalResult] = await localDB.query('SELECT COUNT(*) as count FROM ubicaciones');
        const [countServerResult] = await serverDB.query('SELECT COUNT(*) as count FROM ubicaciones');

        const countLocal = countLocalResult[0].count;
        const countServer = countServerResult[0].count;

        console.log(`
        Sincronización completada:
        - Registros en local: ${countLocal}
        - Registros en servidor: ${countServer}
        - Registros procesados: ${processedCount}
        - Errores: ${errorCount}
        - Timestamp: ${new Date().toISOString()}
      `);

        // 7. Verificar consistencia
        if (countLocal !== countServer) {
            console.log('¡Advertencia! Diferente número de registros entre local y servidor');
        } else {
            console.log('Verificación de número de registros: OK');
        }

    } catch (error) {
        console.error("Error de sincronización:", error);
        throw error;
    }
};