const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { models } = require("./../../config/config");
const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");

const getBienesSiga = async (req, res) => {
  try {
    const response = await fetch("http://localhost:3001/api/v1/bienes");
    const externalData = await response.json();

    await models.bienes.bulkCreate(externalData.data);

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
    const bien = await models.bienes.findOne({
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
    return res.json({ info });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
};

const getBienesInventariados = async (req, res) => {
  try {
    const bien = await models.bienes.findAll({
      where: {
        inventariado: true
      },
    });
    // Devolver la información del bien con la URL de la imagen
    return res.json({ bien });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
};
const getBienImagen = async (req, res) => {

  console.log("prueba");

  const { sbn, filename } = req.params;

  // Ruta completa a la carpeta remota
  const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${sbn}`;
  const filePath = path.join(carpetaRuta, filename);

  // Verificar si el archivo existe y enviarlo como respuesta
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Imagen no encontrada');
  }
};

const postBienes = async (req, res) => {
  try {
    await models.bienes.update(req.body, {
      where: { sbn: req.body.sbn },
    });

    return res.json({ msg: "Bien actualizado con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const etiquetasBienes = async (req, res) => {
  try {
    const cod = req.query.cod;
   
    // Buscar los bienes que están en la ubicación concatenada
    const bienes = await models.bienes.findAll({
      attributes:[], // No necesitamos atributos adicionales de esta tabla
      include: [{
        model: models.ubicaciones, // Incluir la tabla de ubicaciones
        where: Sequelize.literal(`CONCAT(ubicaciones.tipo_ubicac, ubicaciones.ubicac_fisica) = '${cod}'`)
      }],
      attributes: ['dni'], // Solo necesitamos el campo dni de la tabla bienes
    });

    // Extraer solo los DNIs únicos
    const dniList = bienes.map(bien => bien.dni).filter((value, index, self) => self.indexOf(value) === index);

    // Si no se encuentran DNIs, devolver una respuesta adecuada
    if (dniList.length === 0) {
      return res.status(404).json({ message: "No se encontraron bienes en la ubicación especificada." });
    }

    // Paso 2: Buscar los trabajadores que coincidan con los DNIs obtenidos
    const trabajadores = await models.trabajadores.findAll({
      where: {
        dni: dniList // Buscar en la tabla trabajadores usando los DNIs obtenidos
      },
      attributes: ['dni', 'nombre'], // Atributos que quieres devolver
    });

    // Devolver la lista de trabajadores
    return res.json(trabajadores);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
};


module.exports = {
  getBienesSiga,
  getBienes,
  postBienes,
  getBienImagen,
  getBienesInventariados,
  etiquetasBienes
};
