const { Sequelize } = require("sequelize");
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
          attributes: ["id","nombre"],
          include: [{ model: models.sedes, attributes: ["id","nombre"] }],
        },
      ],
    });

    const format= ubicaciones.map(item =>{
        return{
            id: item?.id,
            dependencia_id: item?.dependencia?.id,
            nombre_dependencia: item?.dependencia?.nombre,
            sede_id: item?.dependencia?.sede?.id,
            nombre_sede: item?.dependencia?.sede?.nombre,
            ubicacion: item?.nombre
        }
    })


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
      // Si se encontró un valor máximo, incrementarlo
      newUbicacFisica = lastUbicacion.ubicac_fisica + 1;
    } else {
      // Si no existe ninguna ubicación previa, empezar desde "1"
      newUbicacFisica = "1";
    }

    const info = {
      nombre,
      dependencia_id,
      tipo_ubicac: dependencia_id, // Asumo que 'tipo_ubicac' es lo mismo que 'dependencia_id'
      ubicac_fisica: newUbicacFisica, // Aquí se usa el valor incrementado
    };

    console.log(info);

    // Crear la nueva ubicación
    //   await models.ubicaciones.create(info);

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
      where: { id: id },
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

module.exports = {
  getUbicaciones,
  postUbicaciones,
  updateUbicaciones,
  deleteUbicaciones,
  getUbicacionesEditar,
};
