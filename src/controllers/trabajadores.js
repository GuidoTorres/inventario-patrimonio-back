const { Op, Sequelize } = require("sequelize");
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
const postTrabajadores = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();
    const { ...otherData } = req.body;
    const {usuario_id}= req.query

    const usuarioIndex = usuario_id - 3;
    const rangoInicio = 500 + ((usuarioIndex - 1) * 50);
    const rangoFin = rangoInicio + 49;

    // Buscar el último ID usado en el rango del usuario
    const lastId = await models.trabajadores.findOne({
      where: {
        id: {
          [Sequelize.Op.between]: [rangoInicio, rangoFin]
        }
      },
      order: [['id', 'DESC']],
    });

    // Determinar el siguiente ID dentro del rango
    let newId = lastId ? lastId.id + 1 : rangoInicio;

    if (newId > rangoFin) {
      return res.status(400).json({
        message: `Se ha alcanzado el límite de trabajadores para el usuario ${usuario_id}`,
      });
    }

    const info = {
      id: newId,
      ...otherData,
      estado: "A"
    };

    const nuevoTrabajador = await models.trabajadores.create(info);

    return res.json({ 
      msg: "Trabajador registrado con éxito!",
      trabajador: nuevoTrabajador
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ 
      message: "No se pudo registrar el trabajador.", 
      error: error.message 
    });
  }
};
const updateTrabajadores = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    if(req.params.id.length === 8){
      return res.status(500).json({ msg: "El dni debe tener 8 digitos!" });
    }

    await models.trabajadores.update(req.body, {
      where: { id: req.params.id },
    });
    return res.json({ msg: "Trabajador actualizado con éxito!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "No se pudo actualizar el trabajador.",
      error: error.message,
    });
  }
};

const getAllTrabajadores = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const Trabajador = await models.trabajadores.findAll({
      attributes: ["nombre", "dni", "id"],
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
  updateTrabajadores,
  postTrabajadores
};
