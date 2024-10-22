const { getDatabaseConnection } = require("./../../config/config");
const getDependencias = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const dependencias = await models.dependencias.findAll({
      attributes: ["id", "nombre", "sede_id", "tipo_ubicac", "ubicac_fisica"],
    });

    return res.json(dependencias);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const getDependenciasSiga = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Hacer fetch a la API externa
    let url = "http://localhost:3001/api/v1/bienes/marcas";
    const response = await fetch(url);
    const externalData = await response.json();

    // Obtener todas las dependencias registradas en la base de datos
    const dependenciasDB = await models.dependencias.findAll();

    // Filtrar y mapear las ubicaciones que están asociadas a dependencias
    const ubicaciones = externalData.data
      .map((item) => {
        // Buscar el id de la dependencia correspondiente en la base de datos
        const dependencia = dependenciasDB.find(
          (dep) =>
            dep.tipo_ubicac == item.TIPO_UBICAC // Comparar el tipo de ubicación
        );

        return {
          tipo_ubicac: item.TIPO_UBICAC, // Código de ubicación
          ubicac_fisica: item.COD_UBICAC, // Código de la ubicación física
          nombre: item.UBICAC_FISICA, // Nombre de la ubicación
          dependencia_id: dependencia ? dependencia.id : null, // Asignar el id de la dependencia
        };
      })
      .filter((ubicacion) => ubicacion.dependencia_id !== null); // Filtrar ubicaciones con dependencias válidas

    // Insertar ubicaciones en la base de datos
    await models.ubicaciones.bulkCreate(ubicaciones, {
      ignoreDuplicates: true, // Evita duplicados en caso de que ya existan
    });



    return res.json({
      message: "Sincronización completa",
      ubicacionesInsertadas: ubicaciones, // Mostrar el número de ubicaciones insertadas
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
};



const postDependencias = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    await models.dependencias.create(req.body);

    return res.json({ msg: "Dependencia creada con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo crear la dependencia.",
      error: error.message,
    });
  }
};

const updateDependencias = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    await models.dependencias.update(req.body, {
      where: { id: id },
    });
    return res.json({ msg: "Dependencia actualizada con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo actualizar la dependencia.",
      error: error.message,
    });
  }
};

const deleteDependencias = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    await models.dependencias.destroy({
      where: { id: id },
    });

    return res.json({ msg: "Dependencia eliminada con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo eliminar la dependencia.",
      error: error.message,
    });
  }
};

module.exports = {
  getDependencias,
  postDependencias,
  updateDependencias,
  deleteDependencias,
  getDependenciasSiga,
};
