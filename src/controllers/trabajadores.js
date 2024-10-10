const { Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const getTrabajadores = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const Trabajador = await models.trabajadores.findOne({
      attributes: ["nombre"],
      where: { dni: req.query.dni },
    });
    if (!Trabajador) {
      return res.status(500).json({ msg: "Trabajador no encontrado!" });
    }

    return res.json(Trabajador);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Trabajador no encontrado.", error: error.message });
  }
};

const getAllTrabajadores = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const Trabajador = await models.trabajadores.findAll({
      attributes: ["nombre", "dni"],
      where: { dni: { [Op.not]: null } },
      order: [['nombre', 'ASC']],
    });

    return res.json(Trabajador);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Trabajador no encontrado.", error: error.message });
  }
};

module.exports = {
  getTrabajadores,
  getAllTrabajadores,
};
