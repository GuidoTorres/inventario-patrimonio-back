const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");

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
        msg: "El bien ya ha sido inventariado.",
      });
    }

    // Ruta de la carpeta en el servidor de archivos remoto
    const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${bien?.sbn}`;

    // Verificar si la carpeta existe
    if (fs.existsSync(carpetaRuta)) {
      const archivos = fs.readdirSync(carpetaRuta);

      // Buscar cualquier archivo de imagen (por ejemplo, .jpg o .png)
      const archivoImagen = archivos.find(
        (file) => file.endsWith(".jpg") || file.endsWith(".png")
      );

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
    res
      .status(500)
      .json({
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
        },
        {
          model: models.dependencias,
        },
        {
          model: models.ubicaciones,
        },
      ],

    });
    
    // Si no se encuentran bienes para el trabajador, devolver un mensaje
    if (bienes.length === 0) {
      return res.status(404).json({
        message: "No se encontraron ubicaciones para el trabajador.",
      });
    }

    // Formatear los datos para devolverlos en una estructura clara
    const response = {
      sedes: [],
      dependencias: [],
      ubicaciones: [],
    };

    bienes.forEach((bien) => {
      console.log(bien.dependencia);
      if (!response.sedes.some((sede) => sede?.id === bien?.sede?.id)) {
        response.sedes.push(bien.sede);
      }
      if (!response.dependencias.some((dep) => dep?.id === bien?.dependencia?.id)) {
        response.dependencias.push(bien.dependencia);
      }
      if (!response.ubicaciones.some((ubi) => ubi?.id === bien?.ubicacione?.id)) {
        response.ubicaciones.push(bien.ubicacion);
      }
    });

    // Devolver las sedes, dependencias y ubicaciones
    return res.json(bienes);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
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
      ],
      include: [
        {
          model: models.ubicaciones,
          attributes: ["tipo_ubicac", "ubicac_fisica"],
        },
        {
          model: models.sedes,
          attributes: ["nombre"],
        },
        {
          model: models.dependencias,
          attributes: ["nombre"],
        },
      ],
    });

    // Si no se encuentran bienes, devolver un mensaje
    if (bienes.length === 0) {
      return res.status(404).json({
        message: "No se encontraron bienes con los filtros especificados.",
      });
    }

    // Devolver la lista de bienes
    return res.json(bienes);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
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

    // Hacer fetch a la API externa
    let url = "http://localhost:3001/api/v1/bienes/prueba";
    const response = await fetch(url);
    const externalData = await response.json();

    // Mapear los datos y buscar los IDs correspondientes
    const format = externalData?.data?.map(item => {
      // Buscar los IDs en las tablas de dependencias y ubicaciones
      const dependencia = dependencias.find(dep => dep.centro_costo === item.CENTRO_COSTO);
      const ubicacion = ubicaciones.find(ubi => ubi.nombre === item.UBICAC_FISICA);

      return {
        secuencia: item.SECUENCIA,
        sbn: item.CODIGO_ACTIVO,
        descripcion: item.DESCRIPCION,
        marca: item.MARCA,
        modelo: item.MODELO,
        serie: item.NRO_SERIE,
        estado: item.ESTADO,
        sede_id: item.SEDE,
        ubicacion_id: ubicacion ? ubicacion.id : null, // Asignar el ID de la ubicación
        dependencia_id: dependencia ? dependencia.id : null, // Asignar el ID de la dependencia
        dni: item.DOCUM_IDENT,
        estado_patrimonial: item.ESTADO_CONSERV,
        detalles: item.CARACTERISTICAS
      };
    });

    await models.bienes.bulkCreate(format)

    // Devolver los bienes filtrados
    return res.json({ data: format });
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
  sedesPorTrabajador
};
