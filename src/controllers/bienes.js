const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { models } = require("./../../config/config");
const fs = require("fs");
const path = require("path");

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
    let imageUrl
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

    const carpetaRuta = `\\\\10.30.1.22\\patrimonio\\Docpat\\1137\\2024\\Margesi\\${bien?.sbn}`;
    console.log('Carpeta a escanear:', carpetaRuta);
    // Verificar si la carpeta existe
    if (!fs.existsSync(carpetaRuta)) {
      imageUrl = ""
    }

    // Listar los archivos dentro de la carpeta
    const archivos = fs.readdirSync(carpetaRuta);

    // Buscar cualquier archivo de imagen (por ejemplo, .jpg o .png)
    const archivoImagen = archivos.find(
      (file) => file.endsWith(".jpg") || file.endsWith(".png")
    );

    // Si no se encuentra una imagen, devolver un campo imageUrl vacío
    if (!archivoImagen) {
      imageUrl = "";
    } else {
      imageUrl = `/public/images/${sbn}/${archivoImagen}`;
    }

    // Devolver los datos del bien junto con la URL de la imagen
    return res.json({
      msg: "El bien fue encontrado.",
      imageUrl, // Devolver la URL de la imagen si existe
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
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

module.exports = {
  getBienesSiga,
  getBienes,
  postBienes,
};
