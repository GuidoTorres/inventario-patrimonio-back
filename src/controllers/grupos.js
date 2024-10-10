const {getDatabaseConnection} = require("./../../config/config");
const getGrupos = async (req, res) => {
  try {
    const {models} = getDatabaseConnection(); // Obtener la conexión adecuada (remota o local)

    const Grupos = await models.grupos.findAll({});
    
    return res.json(Grupos);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Error fetching data", error: error.message });
  }
};

const postGrupos = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.grupos.create(req.body);

    return res.json({ msg: "Datos registrados con éxito!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "No se pudo registrar.", error: error.message });
  }
};

const updateGrupos = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.grupos.update(req.body, {
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

const deleteGrupos = async (req, res) => {
  try {
    const {models} = await getDatabaseConnection(); 

    await models.grupos.destroy({
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

module.exports = { getGrupos, postGrupos, updateGrupos, deleteGrupos };
