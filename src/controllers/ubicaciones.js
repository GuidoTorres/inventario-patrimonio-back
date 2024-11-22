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
        nombre: item?.nombre,
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
    const { dependencia_id, nombre, usuario_id } = req.body;

    const usuarioIndex = usuario_id - 3;
    const rangoInicio = 1500 + ((usuarioIndex - 1) * 100);
    const rangoFin = rangoInicio + 99;

    // Buscar el último ID usado en el rango del usuario
    const lastId = await models.ubicaciones.findOne({
      where: {
        id: {
          [Sequelize.Op.between]: [rangoInicio, rangoFin]
        }
      },
      order: [['id', 'DESC']],
    });

    // Determinar el siguiente ID dentro del rango
    let newId = lastId ? lastId.id + 1 : rangoInicio;

    if (newId > rangoFin) {
      return res.status(400).json({
        message: `Se ha alcanzado el límite de ubicaciones para el usuario ${usuario_id}`,
      });
    }

    // Obtener la última ubicac_fisica (mantener la lógica original)
    const lastUbicacion = await models.ubicaciones.findOne({
      where: { dependencia_id },
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

    let newUbicacFisica;
    if (lastUbicacion) {
      newUbicacFisica = lastUbicacion.ubicac_fisica + 1;
    } else {
      newUbicacFisica = "1";
    }

    const info = {
      id: newId, // Asignar el ID del rango
      nombre,
      dependencia_id,
      tipo_ubicac: dependencia_id,
      ubicac_fisica: newUbicacFisica,
      usuario_id
    };

    const nuevaUbicacion = await models.ubicaciones.create(info);

    return res.json({
      msg: "Ubicación creada con éxito!",
      ubicacion: nuevaUbicacion
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
      where: { id: req.params.id },
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

    const localDB = new Sequelize("inventario_patrimonio", "root", "root", {
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
    const ubicacionesLocal = (await localDB.query(
      `SELECT id, nombre, dependencia_id, tipo_ubicac, ubicac_fisica, 
              createdAt, updatedAt 
       FROM ubicaciones 
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT }
    ));

    const ubicacionesServer = (await serverDB.query(
      `SELECT id, nombre, dependencia_id, tipo_ubicac, ubicac_fisica, 
              createdAt, updatedAt 
       FROM ubicaciones 
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT }
    ));

    console.log(`
      Registros encontrados:
      - Local: ${ubicacionesLocal.length}
      - Servidor: ${ubicacionesServer.length}
    `);

    // 2. Crear mapas por ID para búsqueda rápida
    const localMap = new Map(ubicacionesLocal.map(u => [u.id, u]));
    const serverMap = new Map(ubicacionesServer.map(u => [u.id, u]));

    // 3. Encontrar registros para sincronizar
    const registrosNuevosEnServer = ubicacionesServer.filter(u => !localMap.has(u.id));
    const registrosActualizadosEnServer = ubicacionesServer.filter(u => {
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
              updatedAt: registro.updatedAt
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
  sincronizarUbicaciones
};
