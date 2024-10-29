const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Sequelize, Op, where } = require("sequelize");
const {
  getDatabaseConnection,
  checkServerConnection,
} = require("./../../config/config");
const cron = require("node-cron");
const XLSX = require("xlsx");
const dayjs = require("dayjs");

cron.schedule("0 */5 * * *", async () => {
  console.log("Sincronizando bienes...");
  try {
    await getSigaToDB(); // Llama a tu función de sincronización
    console.log("Sincronización completa.");
  } catch (error) {
    console.error("Error durante la sincronización:", error);
  }
});

const getBienesSiga = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const { sede_id, ubicacion_id, dni, sbn, serie } = req.query;
    // Si falla la API externa, busca en la base de datos local
    const whereClause = {};
    if (sede_id) whereClause.SEDE = sede_id;
    if (ubicacion_id) {
      whereClause[Op.and] = Sequelize.where(
        Sequelize.fn(
          "CONCAT",
          Sequelize.col("TIPO_UBICAC"),
          Sequelize.col("COD_UBICAC")
        ),
        ubicacion_id
      );
    }
    if (dni) whereClause.docum_ident = dni;
    if (sbn) whereClause.CODIGO_ACTIVO = sbn;
    if (serie) whereClause.NRO_SERIE = serie;
    const localData = await models.siga.findAll({ where: whereClause });
    if (localData.length === 0) {
      return res.status(400).json({
        msg: "No se encontraron bienes!",
      });
    }
    return res.status(200).json({ data: localData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Hubo un error.", error: error.message });
  }
};

const getBienes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Buscar el bien en la tabla 'bienes'
    const bien = await models.bienes.findOne({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        sbn: req.query.sbn,
      },
      include: [{ model: models.usuarios, attributes: ["nombre_usuario"] }],
    });

    let imageUrl = "";

    // Caso 1: El bien no existe en 'bienes'
    if (!bien) {
      // Intentar buscar en la tabla 'bienes23'
      const bien23 = await models.bienes23.findOne({
        attributes: { exclude: ["trabajador_id"] },
        where: {
          sbn: req.query.sbn,
        },
      });

      const format = {
        sbn: bien23?.SBN,
        descripcion: bien23?.descripcion,
        tipo: "sobrante",
      };

      // Caso 1.1: El bien no existe en ninguna de las tablas
      if (!bien23) {
        return res.status(404).json({
          msg: "El bien no fue encontrado.",
          data: null,
        });
      }

      // Caso 1.2: El bien se encuentra en 'bienes23'
      return res.status(200).json({
        msg: "El bien fue encontrado.",
        info: format,
      });
    }

    // Caso 2: El bien existe pero ya fue inventariado
    if (bien.inventariado) {
      return res.status(403).json({
        msg: `El bien ya ha sido inventariado por el usuario ${bien?.usuario?.nombre_usuario}.`,
      });
    }

    const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${bien?.sbn}`;

    // Verificar si la carpeta existe
    if (fs.existsSync(carpetaRuta)) {
      const archivos = fs.readdirSync(carpetaRuta);

      // Buscar un archivo de imagen cuyo nombre contenga el `sbn`
      const archivoImagen = archivos.find(
        (file) =>
          file.includes(bien.sbn) &&
          (file.endsWith(".jpg") ||
            file.endsWith(".jpeg") ||
            file.endsWith(".png"))
      );

      // Si se encuentra un archivo de imagen, construir la URL para acceder a la imagen
      if (archivoImagen) {
        imageUrl = `http://10.30.1.49/api/v1/bienes/imagenes/${bien.sbn}/${archivoImagen}`;
      }
    }

    // Preparar la información del bien con la URL de la imagen si está disponible
    const info = {
      ...bien.dataValues,
      imagen: imageUrl, // Devolver la URL de la imagen si existe
    };

    // Devolver la información del bien
    return res.status(200).json({ info });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};
const getBienesInventariados = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const { usuario_id } = req.query;
    const bien = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        inventariado: true,
        usuario_id: usuario_id,
      },
    
      include: [
      { model: models.sedes },
      { model: models.dependencias },
      { model: models.ubicaciones },
      { model: models.trabajadores },
      { model: models.usuarios },
    ],
      order: [["updatedAt", "DESC"]],
    });
  return res.json({ bien });
} catch (error) {
  console.log(error);
  res
    .status(500)
    .json({ message: "Error fetching data", error: error.message });
}
};

const getBienesFaltantes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Obtener los parámetros de búsqueda
    const { sede_id, ubicacion_id, dni, sbn, serie, usuario_id } = req.query;

    // Construir las condiciones de búsqueda para bienes
    const whereBienes = {
      inventariado: true
    };

    // Construir las condiciones de búsqueda para SIGA
    const whereSiga = {};

    // Aplicar filtros dinámicamente
    if (sede_id) {
      whereBienes.sede_id = sede_id;
      whereSiga.SEDE = sede_id;
    }
    if (dni) {
      whereBienes.dni = dni;
      whereSiga.docum_ident = dni;
    }
    if (sbn) {
      whereBienes.sbn = sbn;
      whereSiga.CODIGO_ACTIVO = sbn;
    }
    if (serie) {
      whereBienes.serie = serie;
      whereSiga.NRO_SERIE = serie;
    }
    if (ubicacion_id) {
      whereBienes.ubicacion_id = ubicacion_id;
    }
    if (usuario_id) {
      whereBienes.usuario_id = usuario_id;
    }

    // Obtener los bienes inventariados que cumplen con los filtros
    const bienesInventariados = await models.bienes.findAll({
      where: whereBienes,
      attributes: ['sbn'],
      raw: true
    });

    const sbnsInventariados = bienesInventariados.map(b => b.sbn);

    // Agregar la condición de no estar en los inventariados
    whereSiga.CODIGO_ACTIVO = {
      [Op.notIn]: sbnsInventariados
    };

    // Buscar en SIGA los bienes faltantes
    const bienesFaltantes = await models.siga.findAll({
      where: whereSiga,
      attributes: [
        ['CODIGO_ACTIVO', 'sbn'],
        ['DESCRIPCION', 'descripcion'],
        ['MARCA', 'marca'],
        ['MODELO', 'modelo'],
        ['NRO_SERIE', 'serie'],
        ['SEDE', 'sede_id'],
        ['NOMBRE_DEPEND', 'nombre_depend'],
        ['TIPO_UBICAC', 'tipo_ubicac'],
        ['UBICAC_FISICA', 'ubicac_fisica'],
        ['docum_ident', 'dni'],
        ['USUARIO_FINAL', 'usuario_final'],
        ['ESTADO', 'estado'],
        ['ESTADO_CONSERV', 'estado_conserv'],
      ],
      raw: true
    });

    // Obtener información relacionada
    const bienesConRelaciones = await Promise.all(
      bienesFaltantes.map(async (bien) => {
        // Buscar sede
        const sede = await models.sedes.findByPk(bien.sede_id, {
          attributes: ['nombre'],
          raw: true
        });

        // Buscar dependencia
        let dependencia = null;
        if (bien.nombre_depend) {
          dependencia = await models.dependencias.findOne({
            where: { nombre: bien.nombre_depend },
            attributes: ['id', 'nombre'],
            raw: true
          });
        }

        // Buscar ubicación
        let ubicacion = null;
        if (ubicacion_id) {
          ubicacion = await models.ubicaciones.findByPk(ubicacion_id, {
            attributes: ['id', 'nombre'],
            raw: true
          });
        } else if (bien.ubicac_fisica) {
          ubicacion = await models.ubicaciones.findOne({
            where: { nombre: bien.ubicac_fisica },
            attributes: ['id', 'nombre'],
            raw: true
          });
        }

        return {
          sbn: bien.sbn,
          descripcion: bien.descripcion,
          marca: bien.marca,
          modelo: bien.modelo,
          serie: bien.serie,
          sede: sede ? {
            id: bien.sede_id,
            nombre: sede.nombre
          } : null,
          dependencia: dependencia ? {
            id: dependencia.id,
            nombre: dependencia.nombre
          } : null,
          ubicacion: ubicacion ? {
            id: ubicacion.id,
            nombre: ubicacion.nombre
          } : null,
          dni: bien.dni,
          usuario: bien.usuario_final,
          estado: bien.estado,
          estado_conservacion: bien.estado_conserv,
          estado_inventario: 'faltante'
        };
      })
    );

    // Devolver los resultados
    return res.json({
      data: bienesConRelaciones,
      total: bienesConRelaciones.length,
      filters: {
        sede_id,
        ubicacion_id,
        dni,
        sbn,
        serie,
        usuario_id
      }
    });

  } catch (error) {
    console.error("Error en consulta de faltantes:", error);
    res.status(500).json({
      message: "Error al buscar bienes faltantes",
      error: error.message
    });
  }
};



const getBienesPorInventariador = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const bienesPorInventariador = await models.bienes.findAll({
      attributes: [
        "usuario_id",
        [Sequelize.fn("COUNT", Sequelize.col("bienes.id")), "total_bienes"],
        [Sequelize.col("usuario.id"), "usuario.id"],
        [Sequelize.col("usuario.nombre_usuario"), "usuario.nombre_usuario"],
      ],
      include: [
        {
          model: models.usuarios,
          as: "usuario", // Asegúrate de que el alias sea correcto
          attributes: ["nombre_usuario"], // No traer todos los atributos, solo los especificados
        },
      ],
      where: {
        inventariado: true, // Solo bienes inventariados
      },
      group: ["bienes.usuario_id", "usuario.id", "usuario.nombre_usuario"], // Asegúrate de agrupar correctamente
    });

    return res.json({ data: bienesPorInventariador });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Error al obtener bienes por inventariador",
      error: error.message,
    });
  }
};
const getBienImagen = async (req, res) => {
  const { sbn, filename } = req.params;

  // Ruta completa a la carpeta remota
  const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${sbn}`;
  const filePath = path.join(carpetaRuta, filename);

  // Verificar si el archivo existe y enviarlo como respuesta
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Imagen no encontrada");
  }
};
const postBienes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Verificar si el bien ya existe
    const bienExistente = await models.bienes.findOne({
      where: { sbn: req.body.sbn },
    });
    let bien;

    // Si el bien ya existe, actualízalo; si no, créalo
    if (bienExistente) {
      await models.bienes.update(req.body, {
        where: { sbn: req.body.sbn },
      });
      bien = { ...bienExistente.dataValues, ...req.body }; // Combinar los datos antiguos con los nuevos
    } else {
      bien = await models.bienes.create(req.body);
    }
    // Manejo de imágenes si se ha subido una
    if (req.file) {
      // req.file contiene toda la información del archivo
      const imagen = req.file;
      const nombreImagen = `${req.body.sbn}${path.extname(
        imagen.originalname
      )}`; // Renombrar la imagen con el SBN y la extensión correcta
      const carpetaServidor = path.join(__dirname, "..", "uploads"); // Ruta a la carpeta en el servidor

      // Crear la carpeta si no existe
      if (!fs.existsSync(carpetaServidor)) {
        fs.mkdirSync(carpetaServidor, { recursive: true });
      }

      // Verificar si el bien ya tenía una imagen anterior y eliminarla
      if (bienExistente && bienExistente.foto) {
        const rutaImagenAnterior = path.join(
          __dirname,
          "..",
          "uploads",
          path.basename(bienExistente.foto)
        );
        if (fs.existsSync(rutaImagenAnterior)) {
          fs.unlinkSync(rutaImagenAnterior); // Eliminar la imagen anterior
        }
      }

      // Ruta completa para guardar la nueva imagen
      const archivoImagenRuta = path.join(carpetaServidor, nombreImagen);

      // Renombrar la imagen cargada para moverla a la nueva ubicación
      fs.renameSync(imagen.path, archivoImagenRuta); // Mover el archivo cargado a la ubicación definitiva

      // Ruta pública para acceder a la imagen
      const urlImagen = `http://10.30.1.49/uploads/${nombreImagen}`;
      console.log(urlImagen);
      // Actualizar la base de datos con la nueva ruta de la imagen
      await models.bienes.update(
        { foto: urlImagen }, // Asumiendo que tienes un campo para la ruta de la imagen
        { where: { sbn: req.body.sbn } }
      );

      // Actualizar el objeto del bien con la nueva imagen en la respuesta
      bien.foto = urlImagen;
    }

    // Emitir cambios si es necesario
    const io = req.app.locals.io;
    const count = await models.bienes.count({
      where: { inventariado: true },
    });
    io.emit("bien-actualizado", {
      bien: req.body,
      count: count,
    });

    return res.json({
      msg: bienExistente
        ? "Bien registrado con éxito!"
        : "Bien registrado con éxito!",
      bien: bien, // Asegurarse de que 'bien' contenga la nueva foto
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error al procesar el bien", error: error.message });
  }
};
const updateFaltantes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Verificar que se está recibiendo un array de `sbn` en req.body.sbn
    const sbnArray = req.body.sbn;

    if (!Array.isArray(sbnArray) || sbnArray.length === 0) {
      return res
        .status(400)
        .json({ message: "No se proporcionó un array válido de SBN." });
    }

    // Actualizar todos los bienes que coincidan con los SBN proporcionados
    await models.bienes.update(
      { tipo: "faltante", inventariado: true }, // Actualizamos el tipo y el estado inventariado
      { where: { sbn: { [Op.in]: sbnArray } } } // Usamos el operador IN para actualizar múltiples registros
    );

    return res.json({
      msg: "Faltantes actualizados con éxito!",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ msg: "Error al procesar los faltantes", error: error.message });
  }
};
const sedesPorTrabajador = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();
    const dniTrabajador = req.query.dni; // DNI del trabajador seleccionado

    // Verificar si se proporcionó un DNI
    if (!dniTrabajador) {
      return res.status(400).json({
        message: "Debe proporcionar el DNI del trabajador.",
      });
    }

    // Buscar las ubicaciones, dependencias y sedes relacionadas con los bienes del trabajador
    const bienes = await models.bienes.findAll({
      where: { dni: dniTrabajador, inventariado: true },
      attributes: [], // No necesitamos los atributos de la tabla de bienes
      include: [
        {
          model: models.sedes,
          attributes: ["id", "nombre"], // Solo devuelve los campos necesarios
        },
        {
          model: models.dependencias,
          attributes: [
            "id",
            "nombre",
            "tipo_ubicac",
            "ubicac_fisica",
            "sede_id",
          ],
        },
        {
          model: models.ubicaciones,
          attributes: [
            "id",
            "nombre",
            "tipo_ubicac",
            "ubicac_fisica",
            "dependencia_id",
          ],
        },
      ],
    });

    // Si no se encuentran bienes para el trabajador, devolver un mensaje
    if (bienes.length === 0) {
      return res.status(404).json({
        message: "No se encontraron ubicaciones para el trabajador.",
      });
    }

    // Estructuras de sets para evitar duplicados en sedes, dependencias y ubicaciones
    const sedesSet = new Set();
    const dependenciasSet = new Set();
    const ubicacionesSet = new Set();

    // Arrays para agrupar las sedes, dependencias y ubicaciones
    const sedes = [];
    const dependencias = [];
    const ubicaciones = [];

    bienes.forEach((bien) => {
      // Añadir las sedes si no se repiten
      if (bien.sede && !sedesSet.has(bien.sede.id)) {
        sedes.push(bien.sede);
        sedesSet.add(bien.sede.id); // Agregar al set para evitar duplicados
      }

      // Añadir las dependencias si no se repiten
      if (bien.dependencia && !dependenciasSet.has(bien.dependencia.id)) {
        dependencias.push(bien.dependencia);
        dependenciasSet.add(bien.dependencia.id); // Agregar al set para evitar duplicados
      }

      // Añadir las ubicaciones si no se repiten
      if (bien.ubicacione && !ubicacionesSet.has(bien.ubicacione.id)) {
        ubicaciones.push(bien.ubicacione);
        ubicacionesSet.add(bien.ubicacione.id); // Agregar al set para evitar duplicados
      }
    });

    // Devolver las sedes, dependencias y ubicaciones sin duplicados
    return res.json({
      sedes: sedes,
      dependencias: dependencias,
      ubicaciones: ubicaciones,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const bienesPorTrabajador = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const dniTrabajador = req.query.dni; // DNI del trabajador seleccionado
    const sedeId = req.query.sedeId; // Sede seleccionada
    const dependenciaId = req.query.dependenciaId; // Dependencia seleccionada
    const ubicacionId = req.query.ubicacionId; // Ubicación seleccionada

    // Crear el objeto de condiciones de búsqueda dinámicamente
    const whereConditions = {};

    // Agregar las condiciones en base a las selecciones del usuario
    if (dniTrabajador) {
      whereConditions.dni = dniTrabajador;
    }
    if (sedeId) {
      whereConditions.sede_id = sedeId;
    }
    if (dependenciaId) {
      whereConditions.dependencia_id = dependenciaId;
    }
    if (ubicacionId) {
      whereConditions.ubicacion_id = ubicacionId;
    }
    whereConditions.inventariado = true;

    // Verificar si hay al menos una condición
    if (Object.keys(whereConditions).length === 0) {
      return res.status(400).json({
        message: "Debe proporcionar al menos un filtro para buscar bienes.",
      });
    }

    // Buscar los bienes que coinciden con las condiciones proporcionadas
    const bienes = await models.bienes.findAll({
      where: whereConditions,
      attributes: [
        "id",
        "descripcion",
        "estado",
        "dni",
        "sbn",
        "marca",
        "modelo",
        "color",
        "serie",
        "estado_patrimonial",
        "detalles",
        "situacion",
        "secuencia",
      ],
      include: [
        {
          model: models.ubicaciones,
          where: { id: ubicacionId },
          attributes: ["tipo_ubicac", "ubicac_fisica", "nombre"],
        },
        {
          model: models.sedes,
          where: { id: sedeId },

          attributes: ["nombre"],
        },
        {
          model: models.dependencias,
          where: { id: dependenciaId },

          attributes: ["nombre"],
        },
        {
          model: models.usuarios,
          include: [
            { model: models.inventariadores, attributes: ["nombre"] },
            { model: models.jefes, include: [{ model: models.grupos }] },
          ],
        },

        {
          model: models.trabajadores,
          where: { dni: dniTrabajador },
          attributes: ["nombre"],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    // Si no se encuentran bienes, devolver un mensaje
    if (bienes.length === 0) {
      return res.status(404).json({
        message: "No se encontraron bienes con los filtros especificados.",
      });
    }

    const format = bienes.map((item, index) => {
      return {
        ...item.get(), // Convierte la instancia de Sequelize a un objeto plano
        id: index + 1, // Asigna un nuevo ID secuencial
      };
    });

    // Devolver la lista de bienes
    return res.json(format);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const getConsultaBienes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Obtener los parámetros de búsqueda de la solicitud
    const { sede_id, ubicacion_id, dni, sbn, serie, inventariado, usuario_id } =
      req.query;

    // Construir el objeto 'where' dinámico
    const whereConditions = {};

    // Añadir condiciones dinámicamente si los parámetros existen
    if (sede_id) whereConditions.sede_id = sede_id;
    if (ubicacion_id) whereConditions.ubicacion_id = ubicacion_id;
    if (dni) whereConditions.dni = dni;
    if (sbn) whereConditions.sbn = sbn;
    if (serie) whereConditions.serie = serie;
    if (inventariado === "true") {
      whereConditions.inventariado = true; // Buscar donde 'inventariado' es true
    } else if (inventariado === "false") {
      whereConditions.inventariado = { [Op.not]: true }; // Buscar donde 'inventariado' es false o null
    }
    if (usuario_id) whereConditions.usuario_id = usuario_id;

    // whereConditions.inventariado = false;

    // Realizar la consulta a la base de datos
    const bien = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },
      include: [
        { model: models.sedes },
        { model: models.dependencias },
        { model: models.ubicaciones },
        { model: models.trabajadores },
      ],
      where: whereConditions,
    });

    // Devolver los bienes filtrados
    return res.json({ data: bien });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const getSigaToDB = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection(); // Asegúrate de tener la conexión configurada

    const online = await checkServerConnection("10.30.1.43");

    if (online) {
      // Obtener las secuencias de todos los bienes ya existentes en la base de datos
      const bienesExistentes = await models.bienes.findAll({
        attributes: ["secuencia"],
      });

      // Convertir los bienes existentes a un set de secuencias para una búsqueda rápida
      const secuenciasExistentes = new Set(
        bienesExistentes.map((bien) => bien.secuencia)
      );

      // Hacer fetch a la API externa
      let url = "http://10.30.1.42:8084/api/v1/bienes/prueba";
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const externalData = await response.json();

      // Filtrar los bienes que no están en la base de datos
      const nuevosBienes = externalData?.data?.filter((item) => {
        return !secuenciasExistentes.has(item.SECUENCIA); // Solo incluye bienes que no existen
      });

      // Si no hay bienes nuevos, finalizar la sincronización
      if (nuevosBienes.length === 0) {
        console.log("No hay nuevos bienes para sincronizar.");
        return;
      }

      // Obtener los valores de las tablas 'dependencias' y 'ubicaciones'
      const dependencias = await models.dependencias.findAll({
        attributes: ["id", "tipo_ubicac"], // Solo se necesita tipo_ubicac para dependencias
      });

      const ubicaciones = await models.ubicaciones.findAll({
        attributes: ["id", "tipo_ubicac", "ubicac_fisica"], // Para ubicaciones usamos ambos campos
      });

      // Mapear los datos y buscar los IDs correspondientes
      const format = nuevosBienes?.map((item) => {
        let dependenciaId = null;
        let ubicacionId = null;

        // Buscar la dependencia por tipo_ubicac (sin necesidad de comparar con ubicac_fisica)
        if (item.COD_UBICAC === "0") {
          // Si COD_UBICAC es "0", lo tratamos como una dependencia
          dependenciaId = dependencias.find(
            (dep) => Number(dep.tipo_ubicac) === Number(item.TIPO_UBICAC)
          )?.id;
        }

        if (item.COD_UBICAC == "0") {
          ubicacionId = ubicaciones.find(
            (ubi) =>
              Number(ubi.tipo_ubicac) === Number(item.TIPO_UBICAC) &&
              Number(ubi.ubicac_fisica) === Number(item.COD_UBICAC)
          )?.id;
        }
        // Buscar la ubicación por tipo_ubicac y ubicac_fisica si COD_UBICAC no es "0"
        if (item.COD_UBICAC !== "0") {
          ubicacionId = ubicaciones.find(
            (ubi) =>
              Number(ubi.tipo_ubicac) === Number(item.TIPO_UBICAC) &&
              Number(ubi.ubicac_fisica) === Number(item.COD_UBICAC)
          )?.id;
        }

        return {
          secuencia: item.SECUENCIA,
          sbn: item.CODIGO_ACTIVO,
          descripcion: item.DESCRIPCION,
          marca: item.MARCA,
          modelo: item.MODELO,
          serie: item.NRO_SERIE,
          estado: item.ESTADO,
          sede_id: item.SEDE,
          ubicacion_id: ubicacionId,
          dependencia_id: dependenciaId,
          dni: item.docum_ident,
          estado_patrimonial: item.ESTADO_CONSERV,
          detalles: item.CARACTERISTICAS,
          observacin: item.OBSERVACIONES,
        };
      });

      // Insertar los nuevos bienes
      await models.bienes.bulkCreate(format);

      console.log(
        "Sincronización completa. Nuevos bienes insertados:",
        format.length
      );
      return res.json({ message: "Sincronización completada" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error durante la sincronización",
      error: error.message,
    });
  }
};

const getBienesSigaSbn = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();
    const { sbn } = req.query;

    // Obtener los valores de las tablas 'dependencias' y 'ubicaciones'
    const dependencias = await models.dependencias.findAll();
    const ubicaciones = await models.ubicaciones.findAll();

    // Buscar el bien en la base de datos
    const bien = await models.bienes.findOne({
      attributes: { exclude: ["trabajador_id"] },
      where: { sbn: sbn },
      include: [{ model: models.usuarios, attributes: ["nombre_usuario"] }],
    });
    if (bien) {
      return res.status(200).json(bien);
    }
    // Verificar si el bien no existe
    if (!bien) {
      // Hacer fetch a la API externa
      let url = `http://10.30.1.49/api/v1/bienes/sbn?sbn=${sbn}`;
      const response = await fetch(url);

      if (!response.ok) {
        return res.status(500).json({
          message: "Error fetching data from external API",
        });
      }

      const externalData = await response.json();

      if (
        !externalData ||
        !externalData.data ||
        externalData.data.length === 0
      ) {
        return res
          .status(404)
          .json({ msg: "El bien no fue encontrado en la API externa." });
      }

      // Mapear los datos de la API externa
      const format = externalData.data.map((item) => {
        let dependenciaId = null;
        let ubicacionId = null;

        // Buscar la dependencia
        if (item.TIPO_UBICAC === 1 && item.COD_UBICAC === 0) {
          dependenciaId = dependencias.find(
            (dep) =>
              dep.centro_costo === item.CENTRO_COSTO &&
              dep.tipo_ubicacion === item.TIPO_UBICAC
          )?.id;
        }

        // Buscar la ubicación
        if (item.TIPO_UBICAC === 1 && item.COD_UBICAC !== 0) {
          ubicacionId = ubicaciones.find(
            (ubi) =>
              ubi.nombre === item.UBICAC_FISICA &&
              ubi.tipo_ubicacion === item.TIPO_UBICAC
          )?.id;
        }

        // Manejar el caso donde la dependencia es 0 y también se considera una ubicación
        if (item.TIPO_UBICAC === 0) {
          ubicacionId = ubicaciones.find(
            (ubi) =>
              ubi.nombre === item.UBICAC_FISICA &&
              ubi.tipo_ubicacion === item.TIPO_UBICAC
          )?.id;
        }

        return {
          secuencia: item.SECUENCIA,
          sbn: item.CODIGO_ACTIVO,
          descripcion: item.DESCRIPCION,
          marca: item.MARCA,
          modelo: item.MODELO,
          serie: item.NRO_SERIE,
          estado: item.ESTADO,
          sede_id: item.SEDE,
          ubicacion_id: ubicacionId,
          dependencia_id: dependenciaId,
          dni: item.DOCUM_IDENT,
          estado_patrimonial: item.ESTADO_CONSERV,
          detalles: item.CARACTERISTICAS,
        };
      });

      return res.status(200).json(format);
    }

    // Si el bien ya ha sido inventariado
    if (bien.inventariado) {
      return res.status(403).json({
        msg: `El bien ya ha sido inventariado por el usuario ${bien?.usuario?.nombre_usuario}.`,
      });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const getEstadisticasBiens = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const total = await models.siga.count({
      attributes: { exclude: ["trabajador_id"] },
    });

    const inventariados = await models.bienes.count({
      attributes: { exclude: ["trabajador_id"] },
      where: { inventariado: true },
    });
    const activos = await models.bienes.count({
      attributes: { exclude: ["trabajador_id"] },
      where: { tipo: "activo" },
    });
    const sobrantes = await models.bienes.count({
      attributes: { exclude: ["trabajador_id"] },
      where: { tipo: "sobrante" },
    });
    const faltantes = await models.bienes.count({
      attributes: { exclude: ["trabajador_id"] },
      where: { tipo: "faltante" },
    });

    const info = {
      total,
      inventariados: activos + sobrantes,
      sobrantes,
      activos,
      faltantes: faltantes,
      faltan: total - inventariados,
    };

    // Devolver la información del bien con la URL de la imagen
    return res.status(200).json(info);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const generarSbnSobrante = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const { id_usuario, id_sede, id_ubicacion } = req.query;

    // Obtener el grupo basado en el id_usuario
    const usuario = await models.usuarios.findOne({
      where: { id: id_usuario },
      include: [
        {
          model: models.jefes,
          include: [{ model: models.grupos }],
        },
        {
          model: models.inventariadores,
          include: [{ model: models.grupos }],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Obtener el grupo del usuario (puede ser de jefes o inventariadores)
    let grupoPrefix = null;

    if (usuario.jefe && usuario.jefe.grupo) {
      // Usar trim() para eliminar posibles espacios y === para comparación estricta
      const grupoNombre = usuario.jefe.grupo.id;
      grupoPrefix = grupoNombre === 1 ? "G1" : "G2";
    } else if (usuario.inventariadore && usuario.inventariadore.grupo) {
      // Usar trim() para eliminar posibles espacios y === para comparación estricta
      const grupoNombre = usuario.inventariadore.grupo.id;
      grupoPrefix = grupoNombre === 1 ? "G1" : "G2";
    }

    if (!grupoPrefix) {
      return res
        .status(404)
        .json({ msg: "Grupo no encontrado para el usuario" });
    }

    // Formatear id_sede: añadir un 0 al inicio si es menor a 10
    const sedeFormateada = id_sede.padStart(2, "0");

    // Buscar el último correlativo usado para el grupo seleccionado
    const ultimoBien = await models.bienes.findOne({
      where: {
        sbn: {
          [Op.like]: `${grupoPrefix}%`, // Buscar SBN con el mismo patrón
        },
      },
      order: [["sbn", "DESC"]], // Ordenar para encontrar el último SBN
    });

    // Generar el correlativo
    let correlativo = "001"; // Empezar en 001
    if (ultimoBien) {
      const ultimoSbn = ultimoBien.sbn;
      const correlativoActual = parseInt(ultimoSbn.slice(-3), 10); // Extraer el último correlativo (3 últimos dígitos)
      correlativo = String(correlativoActual + 1).padStart(3, "0"); // Incrementar y mantener el formato de 3 dígitos
    }

    // Generar el nuevo SBN
    const nuevoSbn = `${grupoPrefix}${id_usuario}${sedeFormateada}${id_ubicacion}${correlativo}`;

    // Verificar si el nuevo SBN es único, si no, incrementar el correlativo
    let bienExistente = await models.bienes.findOne({
      where: {
        sbn: nuevoSbn,
      },
    });

    while (bienExistente) {
      correlativo = String(parseInt(correlativo, 10) + 1).padStart(3, "0"); // Incrementar el correlativo
      bienExistente = await models.bienes.findOne({
        where: {
          sbn: `${grupoPrefix}${id_usuario}${sedeFormateada}${id_ubicacion}${correlativo}`,
        },
      });
    }

    // Retornar el nuevo SBN generado
    return res.json({
      msg: "SBN generado con éxito",
      sbn: `${grupoPrefix}${id_usuario}${sedeFormateada}${id_ubicacion}${correlativo}`,
    });
  } catch (error) {
    console.error("Error generando el SBN:", error);
    return res.status(500).json({ msg: "Error generando el SBN", error });
  }
};

const actualizarBienesPorSBN = async (req, res) => {
  try {
    // Verificar que se haya cargado un archivo
    if (!req.file) {
      return res.status(400).send("No se ha cargado ningún archivo.");
    }

    // Ruta al archivo cargado
    const rutaArchivo = req.file.path;

    // Leer el archivo Excel
    const workbook = XLSX.readFile(rutaArchivo);
    const nombreHoja = workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];
    const registrosExcel = XLSX.utils.sheet_to_json(hoja);

    // Extraer los 'sbn' del Excel y convertir a string, eliminar espacios y normalizar a minúsculas
    const sbnExcel = registrosExcel.map((registro) =>
      String(registro.cod_barra).trim().toLowerCase()
    );

    const { models } = await getDatabaseConnection();

    // Buscar en la base de datos los 'sbn' que están en el Excel
    const bienesEncontradosEnBD = await models.bienes23.findAll({
      where: {
        sbn: {
          [Op.in]: sbnExcel, // Buscar los valores de 'sbn' que están en la base de datos
        },
      },
      attributes: ["sbn"], // Solo seleccionar el campo 'sbn'
    });

    // Convertir a string y normalizar los SBN encontrados en la BD
    const sbnEnBD = bienesEncontradosEnBD.map((bien) =>
      String(bien.sbn).trim().toLowerCase()
    );

    // Imprimir los SBN de la base de datos y del Excel para depuración
    console.log("SBNs en Excel (normalizados):", sbnExcel);
    console.log("SBNs en BD (normalizados):", sbnEnBD);

    // Filtrar los 'sbn' del Excel que NO están en la base de datos
    const sbnNoEnBD = sbnExcel.filter((sbn) => !sbnEnBD.includes(sbn));

    // Obtener los registros completos desde el Excel que no están en la BD
    const registrosNuevos = registrosExcel.filter((registro) =>
      sbnNoEnBD.includes(String(registro.cod_barra).trim().toLowerCase())
    );

    // Formatear los registros nuevos que se van a insertar o mostrar
    const format = registrosNuevos.map((item) => {
      return {
        SBN: item?.cod_barra,
        descripcion: item?.descripcion,
        modelo: item?.modelo,
        marca: item?.marca,
        serie: item?.serie,
      };
    });

    await models.bienes23.bulkCreate(format, {
      ignoreDuplicates: true, // Omitir registros que ya existen
    });
    fs.unlinkSync(rutaArchivo);

    // Responder con los registros nuevos que se van a insertar
    res.status(200).json({
      message: "Procesado correctamente",
      registrosNuevos: format,
    });
  } catch (error) {
    console.error("Error al procesar el archivo Excel:", error);
    res.status(500).send("Error al procesar el archivo Excel.");
  }
};

const deleteBienes = async (req, res) => {
  const { models } = await getDatabaseConnection();

  try {
    const { id } = req.query;
    await models.bienes.update({ inventariado: false }, { where: { id: id } });

    return res.status(200).json({ msg: "Bien eliminado correctamente!" });
  } catch (error) {
    res.status(500).json({ message: "No se pudo eliminar el bien!" });
  }
};

const getExcelInventariados = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();
    const { usuario_id } = req.query;

    // Obtener inicio y fin del día actual
    const startOfDay = dayjs().startOf("day").toDate();
    const endOfDay = dayjs().endOf("day").toDate();

    const bienes = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        updatedAt: {
          [Op.between]: [startOfDay, endOfDay]  // Entre inicio y fin del día actual
        },
        usuario_id: usuario_id
      },
      include: [
        { model: models.sedes },
        { model: models.dependencias },
        { model: models.ubicaciones },
        { model: models.trabajadores },
        { model: models.usuarios },
      ],
      order: [["updatedAt", "DESC"]],
    });

    // Rest of the code remains the same...
    const excelData = bienes.map((bien) => {
      const plainBien = bien.get({ plain: true });

      return {
        SBN: plainBien.sbn || "",
        Descripcion: plainBien.descripcion || "",
        Marca: plainBien.marca || "",
        Modelo: plainBien.modelo || "",
        Serie: plainBien.serie || "",
        Color: plainBien.color || "",
        Estado: plainBien.estado === "1" ? "Activo" : "Baja",
        Sede: plainBien.sede?.nombre || "",
        Dependencia: plainBien.dependencia?.nombre || "",
        Ubicación: plainBien.ubicacione?.nombre || "",
        Responsable: plainBien.trabajadore?.nombre || "",
        "DNI Responsable": plainBien.trabajadore?.dni || "",
        "Fecha Inventario": dayjs(plainBien.updatedAt).format("DD/MM-YYYY"),
      };
    });

    // Create workbook and worksheet...
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const columnWidths = [
      { wch: 15 }, // SBN
      { wch: 30 }, // Denominación
      { wch: 15 }, // Marca
      { wch: 15 }, // Modelo
      { wch: 15 }, // Serie
      { wch: 15 }, // Color
      { wch: 10 }, // Estado
      { wch: 20 }, // Sede
      { wch: 25 }, // Dependencia
      { wch: 25 }, // Ubicación
      { wch: 30 }, // Responsable
      { wch: 12 }, // DNI
      { wch: 20 }, // Fecha
      { wch: 25 }, // Inventariado por
    ];
    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Bienes Inventariados");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=BienesSIGA.xlsx"
    );

    return res.send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel:", error);
    return res.status(500).json({
      message: "Error generating Excel file",
      error: error.message,
    });
  }
};

module.exports = {
  getBienesSiga,
  getBienes,
  postBienes,
  getBienImagen,
  getBienesInventariados,
  bienesPorTrabajador,
  getConsultaBienes,
  getSigaToDB,
  getBienesPorInventariador,
  sedesPorTrabajador,
  getBienesFaltantes,
  getBienesSigaSbn,
  getEstadisticasBiens,
  generarSbnSobrante,
  updateFaltantes,
  actualizarBienesPorSBN,
  deleteBienes,
  getExcelInventariados,
};
