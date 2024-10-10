const {getDatabaseConnection} = require("./../../config/config");
const getDependencias = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

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

const postDependencias = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.dependencias.create(req.body);

    return res.json({ msg: "Dependencia creada con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
        message: "No se pudo crear la dependencia.",
        error: error.message,
      });
  }
};

const updateDependencias = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.dependencias.update(req.body, {
      where: { id: id },
    });
    return res.json({ msg: "Dependencia actualizada con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
        message: "No se pudo actualizar la dependencia.",
        error: error.message,
      });
  }
};

const deleteDependencias = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.dependencias.destroy({
      where: { id: id },
    });

    return res.json({ msg: "Dependencia eliminada con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
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
};
