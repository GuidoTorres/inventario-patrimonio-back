const { Sequelize, QueryTypes } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const getUbicaciones = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const ubicaciones = await models.ubicaciones.findAll({
      attributes: [
        "id",
        "nombre",
        "dependencia_id",
        "tipo_ubicac",
        "ubicac_fisica",
      ],
    });

    return res.json(ubicaciones);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};
const getUbicacionesEditar = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const ubicaciones = await models.ubicaciones.findAll({
      attributes: [
        "id",
        "nombre",
        "dependencia_id",
        "tipo_ubicac",
        "ubicac_fisica",
      ],
      include: [
        {
          model: models.dependencias,
          attributes: ["id", "nombre", "tipo_ubicac", "ubicac_fisica"],
          include: [{ model: models.sedes, attributes: ["id", "nombre"] }],
        },
      ],
    });

    const format = ubicaciones.map((item) => {
      return {
        id: item?.id,
        dependencia_id: item?.dependencia?.id,
        nombre_dependencia: item?.dependencia?.nombre,
        sede_id: item?.dependencia?.sede?.id,
        nombre_sede: item?.dependencia?.sede?.nombre,
        ubicacion: item?.nombre,
        tipo_ubicac: item?.tipo_ubicac,
        ubicac_fisica: item?.ubicac_fisica
      };
    });

    return res.json(format);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const postUbicaciones = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const { dependencia_id, nombre } = req.body;

    const lastUbicacion = await models.ubicaciones.findOne({
      where: { dependencia_id: dependencia_id },
      attributes: [
        [
          Sequelize.cast(Sequelize.col("ubicac_fisica"), "UNSIGNED"),
          "ubicac_fisica",
        ],
      ],
      order: [
        [Sequelize.cast(Sequelize.col("ubicac_fisica"), "UNSIGNED"), "DESC"],
      ],
    });
    console.log(lastUbicacion);
    let newUbicacFisica;

    if (lastUbicacion) {
      newUbicacFisica = lastUbicacion.ubicac_fisica + 1;
    } else {
      newUbicacFisica = "1";
    }

    const info = {
      nombre,
      dependencia_id,
      tipo_ubicac: dependencia_id,
      ubicac_fisica: newUbicacFisica,
    };

    console.log(info);

    await models.ubicaciones.create(info);

    return res.json({
      msg: "Ubicación creada con éxito!",
      ubicac_fisica: newUbicacFisica,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo crear la ubicación.",
      error: error.message,
    });
  }
};

const updateUbicaciones = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    await models.ubicaciones.update(req.body, {
      where: { id: id },
    });
    return res.json({ msg: "Ubiación actualizada con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo actualizar la ubicación.",
      error: error.message,
    });
  }
};

const deleteUbicaciones = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    await models.ubicaciones.destroy({
      where: { id: req.params.id },
    });

    return res.json({ msg: "Ubicación eliminada con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo eliminar la ubicación.",
      error: error.message,
    });
  }
};



const sincronizarUbicaciones = async () => {
  let processedCount = 0;
  let errorCount = 0;

  try {
    // Inicializar conexiones
    const serverDB = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: "10.30.1.43",
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
    const [ubicacionesLocal] = await localDB.query(
      `SELECT id, nombre, dependencia_id, tipo_ubicac, ubicac_fisica, 
              createdAt, updatedAt 
       FROM ubicaciones 
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT }
    );

    const [ubicacionesServer] = await serverDB.query(
      `SELECT id, nombre, dependencia_id, tipo_ubicac, ubicac_fisica, 
              createdAt, updatedAt 
       FROM ubicaciones 
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT }
    );

    console.log(`
      Registros encontrados:
      - Local: ${ubicacionesLocal.length}
      - Servidor: ${ubicacionesServer.length}
    `);

    // 2. Crear mapas por ID para búsqueda rápida
    const localMap = new Map(ubicacionesLocal.map(u => [u.id, u]));
    const serverMap = new Map(ubicacionesServer.map(u => [u.id, u]));

    // 3. Encontrar registros para sincronizar
    const soloEnLocal = ubicacionesLocal.filter(u => !serverMap.has(u.id));
    const soloEnServer = ubicacionesServer.filter(u => !localMap.has(u.id));
    const enAmbos = ubicacionesLocal.filter(u => serverMap.has(u.id));

    console.log(`
      Análisis de registros:
      - Solo en local: ${soloEnLocal.length}
      - Solo en servidor: ${soloEnServer.length}
      - En ambos: ${enAmbos.length}
    `);

    // 4. Funciones auxiliares para insert y update
    const insertarRegistro = async (db, registro, isServer) => {
      try {
        await db.query(
          `INSERT INTO ubicaciones 
           (id, nombre, dependencia_id, tipo_ubicac, ubicac_fisica, createdAt, updatedAt)
           VALUES (:id, :nombre, :dependencia_id, :tipo_ubicac, :ubicac_fisica, :createdAt, :updatedAt)`,
          {
            replacements: {
              id: registro.id,
              nombre: registro.nombre,
              dependencia_id: registro.dependencia_id,
              tipo_ubicac: registro.tipo_ubicac,
              ubicac_fisica: registro.ubicac_fisica,
              createdAt: registro.createdAt,
              updatedAt: new Date()
            },
            type: QueryTypes.INSERT
          }
        );
        processedCount++;
        console.log(`Registro ID ${registro.id} "${registro.nombre}" copiado a ${isServer ? 'servidor' : 'local'}`);
      } catch (error) {
        errorCount++;
        console.error(`Error copiando ID ${registro.id} "${registro.nombre}":`, error.message);
      }
    };

    const actualizarRegistro = async (db, registro, isServer) => {
      try {
        await db.query(
          `UPDATE ubicaciones 
           SET nombre = :nombre,
               dependencia_id = :dependencia_id,
               tipo_ubicac = :tipo_ubicac,
               ubicac_fisica = :ubicac_fisica,
               updatedAt = :updatedAt
           WHERE id = :id`,
          {
            replacements: {
              ...registro,
              updatedAt: new Date()
            },
            type: QueryTypes.UPDATE
          }
        );
        processedCount++;
        console.log(`Registro ID ${registro.id} "${registro.nombre}" actualizado en ${isServer ? 'servidor' : 'local'}`);
      } catch (error) {
        errorCount++;
        console.error(`Error actualizando ID ${registro.id} "${registro.nombre}":`, error.message);
      }
    };

    // 5. Sincronizar registros que solo existen en una base de datos
    // Desactivar temporalmente las restricciones de clave primaria
    await Promise.all([
      serverDB.query('SET FOREIGN_KEY_CHECKS = 0'),
      localDB.query('SET FOREIGN_KEY_CHECKS = 0')
    ]);

    try {
      // Local -> Server
      for (const ubicacion of soloEnLocal) {
        await insertarRegistro(serverDB, ubicacion, true);
      }

      // Server -> Local
      for (const ubicacion of soloEnServer) {
        await insertarRegistro(localDB, ubicacion, false);
      }

      // 6. Actualizar registros que existen en ambos pero tienen diferentes fechas
      for (const ubicacionLocal of enAmbos) {
        const ubicacionServer = serverMap.get(ubicacionLocal.id);
        const localDate = new Date(ubicacionLocal.updatedAt);
        const serverDate = new Date(ubicacionServer.updatedAt);

        if (localDate > serverDate) {
          // Actualizar servidor con datos locales
          await actualizarRegistro(serverDB, ubicacionLocal, true);
        } else if (serverDate > localDate) {
          // Actualizar local con datos del servidor
          await actualizarRegistro(localDB, ubicacionServer, false);
        }
      }
    } finally {
      // Reactivar las restricciones de clave primaria
      await Promise.all([
        serverDB.query('SET FOREIGN_KEY_CHECKS = 1'),
        localDB.query('SET FOREIGN_KEY_CHECKS = 1')
      ]);
    }

    // 7. Verificación final
    const [[{ countLocal }]] = await localDB.query('SELECT COUNT(*) as countLocal FROM ubicaciones');
    const [[{ countServer }]] = await serverDB.query('SELECT COUNT(*) as countServer FROM ubicaciones');

    const [[{ maxIdLocal }]] = await localDB.query('SELECT MAX(id) as maxIdLocal FROM ubicaciones');
    const [[{ maxIdServer }]] = await serverDB.query('SELECT MAX(id) as maxIdServer FROM ubicaciones');

    console.log(`
      Sincronización completada:
      - Registros en local: ${countLocal} (Max ID: ${maxIdLocal})
      - Registros en servidor: ${countServer} (Max ID: ${maxIdServer})
      - Registros procesados: ${processedCount}
      - Errores: ${errorCount}
      - Timestamp: ${new Date().toISOString()}
    `);

    // 8. Verificar consistencia
    const [idsLocal] = await localDB.query('SELECT id FROM ubicaciones ORDER BY id');
    const [idsServer] = await serverDB.query('SELECT id FROM ubicaciones ORDER BY id');
    
    const diferencias = idsLocal.length === idsServer.length ? 
      idsLocal.filter((local, index) => local.id !== idsServer[index].id) : 
      ['Cantidad de registros diferente'];

    if (diferencias.length > 0) {
      console.log('¡Advertencia! Se encontraron inconsistencias en IDs:', diferencias);
    } else {
      console.log('Verificación de consistencia completada: OK');
    }

  } catch (error) {
    console.error("Error de sincronización:", error);
    throw error;
  }
};

module.exports = {
  getUbicaciones,
  postUbicaciones,
  updateUbicaciones,
  deleteUbicaciones,
  getUbicacionesEditar,
};
