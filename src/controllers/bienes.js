const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const fs = require("fs");
const path = require("path");
const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const cron = require("node-cron");

// cron.schedule('* * * * *', async () => {
//   console.log('Sincronizando bienes...');
//   try {
//     await getBienesSiga(); // Llama a tu función de sincronización
//     console.log('Sincronización completa.');
//   } catch (error) {
//     console.error('Error durante la sincronización:', error);
//   }
// });

const getBienesSiga = async (req, res) => {
  try {
    // Obtener los parámetros de la consulta
    const { sede_id, ubicacion_id, dni, sbn, serie } = req.query;

    // Construir la URL con los parámetros recibidos
    let url = "http://10.30.1.42:8084/api/v1/bienes?";
    const queryParams = new URLSearchParams();

    if (sede_id) queryParams.append("sede_id", sede_id);
    if (ubicacion_id) queryParams.append("ubicacion_id", ubicacion_id);
    if (dni) queryParams.append("dni", dni);
    if (sbn) queryParams.append("sbn", sbn);
    if (serie) queryParams.append("serie", serie);

    // Concatenar los parámetros a la URL
    url += queryParams.toString();

    // Hacer la solicitud a la API externa con los parámetros
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Error fetching data from external API");
    }

    const externalData = await response.json();

    // Guardar los datos en tu base de datos local
    await models.bienes.bulkCreate(externalData.data, {
      updateOnDuplicate: true,
    });

    // Devolver la respuesta
    return res.json(externalData);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};
const getBienes = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const bien = await models.bienes.findOne({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        sbn: req.query.sbn,
      },
      include:[{model:models.usuarios, attributes:["nombre_usuario"]}]
    });


    let imageUrl = "";
    // Caso 1: El bien no existe
    if (!bien) {
      return res.status(404).json({
        msg: "El bien no fue encontrado.",
      });
    }

    // Caso 2: El bien existe pero ya fue inventariado
    if (bien.inventariado) {
      return res.status(403).json({
        msg: `El bien ya ha sido inventariado.`,
      });
    }

    // Ruta de la carpeta en el servidor de archivos remoto
    const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${bien?.sbn}`;
    // Verificar si la carpeta existe
    if (fs.existsSync(carpetaRuta)) {
      const archivos = fs.readdirSync(carpetaRuta);
      console.log(archivos);
      // Buscar cualquier archivo de imagen (por ejemplo, .jpg o .png)
      const archivoImagen = archivos.find(
        (file) => file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".png")
      );

      console.log(archivoImagen);
      // Si se encuentra un archivo de imagen, construir la URL para acceder a la imagen
      if (archivoImagen) {
        imageUrl = `http://localhost:3006/api/v1/bienes/imagenes/${bien?.sbn}/${archivoImagen}`;
      }
    }

    // Preparar la información del bien con la URL de la imagen
    const info = {
      ...bien.dataValues,
      imagen: imageUrl, // URL para acceder a la imagen
    };

    // Devolver la información del bien con la URL de la imagen
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

    const bien = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        inventariado: true,
      },
      include: [
        { model: models.sedes },
        { model: models.dependencias },
        { model: models.ubicaciones },
        { model: models.trabajadores },
      ],
    });

    // Devolver la información del bien con la URL de la imagen
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

    const bien = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },
      where: {
        inventariado: { [Op.not]: true },
      },
      include: [
        { model: models.sedes },
        { model: models.dependencias },
        { model: models.ubicaciones },
        { model: models.trabajadores },
      ],
    });

    // Devolver la información del bien con la URL de la imagen
    return res.json({ bien });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
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
    await models.bienes.update(req.body, {
      where: { sbn: req.body.sbn },
    });
    const io = req.app.locals.io;

    // Obtener el número actualizado de bienes inventariados
    const count = await models.bienes.count({
      where: {
        inventariado: true,
      },
    });

    // Emitir el bien actualizado y el nuevo conteo de bienes a través de Socket.IO
    io.emit("bien-actualizado", {
      bien: req.body,
      count: count, // Enviar el nuevo conteo
    });
    return res.json({ msg: "Bien actualizado con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
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
        "secuencia"
      ],
      include: [
        {
          model: models.ubicaciones,
          attributes: ["tipo_ubicac", "ubicac_fisica", "nombre"],
        },
        {
          model: models.sedes,
          attributes: ["nombre"],
        },
        {
          model: models.dependencias,
          attributes: ["nombre"],
        },
        {
          model: models.usuarios,
          include: [
            { model: models.inventariadores, attributes: ["nombre"] },
            { model: models.jefes, include: [{ model: models.grupos }] },
          ],
        },

        { model: models.trabajadores, attributes: ["nombre"] },
      ],
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
    const { sede_id, ubicacion_id, dni, sbn, serie } = req.query;

    // Construir el objeto 'where' dinámico
    const whereConditions = {};

    // Añadir condiciones dinámicamente si los parámetros existen
    if (sede_id) whereConditions.sede_id = sede_id;
    if (ubicacion_id) whereConditions.ubicacion_id = ubicacion_id;
    if (dni) whereConditions.dni = dni;
    if (sbn) whereConditions.sbn = sbn;
    if (serie) whereConditions.serie = serie;
    whereConditions.inventariado = true;
    // whereConditions.inventariado = false;

    // Realizar la consulta a la base de datos
    const bienes = await models.bienes.findAll({
      attributes: { exclude: ["trabajador_id"] },

      where: whereConditions,
    });

    // Devolver los bienes filtrados
    return res.json({ data: bienes });
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

    // Obtener los valores de las tablas 'dependencias' y 'ubicaciones'
    const dependencias = await models.dependencias.findAll();
    const ubicaciones = await models.ubicaciones.findAll();

    console.log(dependencias);
    console.log(ubicaciones);
    // Hacer fetch a la API externa
    let url = "http://localhost:3001/api/v1/bienes/prueba";
    const response = await fetch(url);
    const externalData = await response.json();

    // Mapear los datos y buscar los IDs correspondientes
    const format = externalData?.data?.map((item) => {
      let dependenciaId = null;
      let ubicacionId = null;

      // Buscar la dependencia (TiPO_UBICAC es 1 y COD_UBICAC es 0)
      if (item.TIPO_UBICAC === 1 && item.COD_UBICAC === 0) {
        dependenciaId = dependencias.find(
          (dep) =>
            dep.centro_costo === item.CENTRO_COSTO &&
            dep.tipo_ubicacion === item.TIPO_UBICAC
        )?.id;
      }

      // Buscar la ubicación (TiPO_UBICAC es 1 y COD_UBICAC es distinto de 0)
      if (item.TIPO_UBICAC === 1 && item.COD_UBICAC !== 0) {
        ubicacionId = ubicaciones.find(
          (ubi) =>
            ubi.nombre === item.UBICAC_FISICA &&
            ubi.tipo_ubicacion === item.TIPO_UBICAC
        )?.id;
      }

      // Manejar el caso donde la dependencia es 0 y también se considera una ubicación
      if (item.TIPO_UBICAC === 0) {
        // Suponiendo que aquí puedes tener ubicaciones que son dependencias
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
        ubicacion_id: ubicacionId, // Asignar el ID de la ubicación
        dependencia_id: dependenciaId, // Asignar el ID de la dependencia
        dni: item.DOCUM_IDENT,
        estado_patrimonial: item.ESTADO_CONSERV,
        detalles: item.CARACTERISTICAS,
      };
    });

    // await models.bienes.bulkCreate(format, {
    //   ignoreDuplicates: true, // Ignorar duplicados si es necesario
    // });
    // Devolver los bienes filtrados
    return res.json({ data: externalData });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
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
};
