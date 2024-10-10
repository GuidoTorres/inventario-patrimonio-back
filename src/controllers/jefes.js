const dayjs = require("dayjs");
const {getDatabaseConnection} = require("./../../config/config");
const getJefes = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const jefes = await models.jefes.findAll({
      include: [{ model: models.grupos }],
    });
    return res.json(jefes);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error fetching data", error: error.message });
  }
};

const postJefes = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const anio = dayjs().format("YYYY");
    const { nombre, grupo_id } = req.body;

    // Verificar si ya existe un jefe para este grupo en el año actual
    const existingJefe = await models.jefes.findOne({
      where: {
        grupo_id,
        anio,
      },
    });

    if (existingJefe) {
      return res
        .status(400)
        .json({ msg: "Este grupo ya tiene un jefe registrado." });
    }

    // Crear el nuevo registro de jefe
    const info = {
      nombre,
      grupo_id,
      anio,
    };

    await models.jefes.create(info);

    return res.json({ msg: "Datos registrados con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "No se pudo registrar.", error: error.message });
  }
};

const updateJefes = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const id = req.params.id;
    const anio = dayjs().format("YYYY");
    const { nombre, grupo_id } = req.body;

    // Obtener los datos actuales del jefe
    const jefeActual = await models.jefes.findOne({
      where: { id }
    });

    if (!jefeActual) {
      return res.status(404).json({ msg: "El jefe no existe." });
    }

    // Verificar si se está intentando cambiar el grupo
    if (grupo_id !== jefeActual.grupo_id) {
      // Verificar si ya existe un jefe para el nuevo grupo en el año actual
      const existingJefe = await models.jefes.findOne({
        where: {
          grupo_id,
          anio,
        },
      });

      if (existingJefe) {
        return res
          .status(400)
          .json({ msg: "Este grupo ya tiene un jefe registrado." });
      }
    }

    // Actualizar solo los campos permitidos (nombre, y grupo si aplica)
    await models.jefes.update(
      { nombre, grupo_id }, // Se actualiza el nombre y grupo si es necesario
      { where: { id } }
    );

    return res.json({ msg: "Datos actualizados con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "No se pudo actualizar los datos.",
      error: error.message,
    });
  }
};


const deleteJefes = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const id = req.params.id;

    await models.jefes.destroy({
      where: { id: id },
    });

    return res.json({ msg: "Registro eliminado con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "No se pudo eliminar el registro.", error: error.message });
  }
};

module.exports = { getJefes, postJefes, updateJefes, deleteJefes };
