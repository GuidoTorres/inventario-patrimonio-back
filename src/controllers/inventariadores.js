const dayjs = require("dayjs");
const {getDatabaseConnection} = require("./../../config/config");
const getInventariadores = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const inventariadores = await models.inventariadores.findAll({
      include: [{ model: models.grupos }],
    });

    return res.json(inventariadores);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const postInventariadores = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const anio = dayjs().format("YYYY");
    const { nombre, grupo_id, jefe_id } = req.body;

    const info = {
      nombre,
      grupo_id,
      jefe_id,
      anio,
    };
    await models.inventariadores.create(info);

    return res.json({ msg: "Datos registrados con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "No se pudo registrar.", error: error.message });
  }
};

const updateInventariadores = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const id = req.params.id;

    await models.inventariadores.update(req.body, {
      where: { id: id },
    });
    return res.json({ msg: "Datos actualizados con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo actualizar los datos.",
      error: error.message,
    });
  }
};

const deleteInventariadores = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const id = req.params.id;

    await models.inventariadores.destroy({
      where: { id: id },
    });

    return res.json({ msg: "Registro eliminado con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo eliminar el registro.",
      error: error.message,
    });
  }
};

module.exports = {
  getInventariadores,
  postInventariadores,
  updateInventariadores,
  deleteInventariadores,
};
