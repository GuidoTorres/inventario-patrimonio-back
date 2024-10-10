const {getDatabaseConnection} = require("./../../config/config");
const getRoles = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    const roles = await models.roles.findAll({});
    return res.json(roles);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Error fetching data", error: error.message });
  }
};

const postRoles = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.roles.create(req.body);

    return res.json({ msg: "Datos registrados con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "No se pudo registrar.", error: error.message });
  }
};

const updateRoles = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.roles.update(req.body, {
      where: { id: id },
    });
    return res.json({ msg: "Datos actualizados con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
        msg: "No se pudo actualizar los datos.",
        error: error.message,
      });
  }
};

const deleteRoles = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.roles.destroy({
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

module.exports = { getRoles, postRoles, updateRoles, deleteRoles };
