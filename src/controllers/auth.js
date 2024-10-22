const { getDatabaseConnection } = require("./../../config/config");
const { tokenSign } = require("../helpers/generateToken");
const { compare } = require("../helpers/handleBcrypt");
const authLogin = async (req, res, next) => {
  try {
    const { models } = await getDatabaseConnection();

    const { usuario, contrasenia } = req.body;
    const get = await models.usuarios.findOne({
      where: { nombre_usuario: usuario },
      include: [
        {
          model: models.permisos,
          attributes: ["nombre"],
        },
        {
          model: models.inventariadores,
          attributes: [],
          include: { model: models.grupos },
        },
        {
          model: models.jefes,
          attributes: [],
          include: { model: models.grupos },
        },
      ],
    });

    if (!get) {
      return res
        .status(404)
        .send({ msg: "Usuario no encontrado!", status: 404 });
    }
    console.log(get);
    const checkPassword = await compare(
      contrasenia,
      get.dataValues.contrasenia
    );
    const tokenSession = await tokenSign(get.dataValues);
    if (get.estado === false) {
      return res.status(500).send({ msg: "Usuario inactivo!", status: 500 });
    }

    if (checkPassword) {
      return res.send({
        data: get,
        tokenSession,
        msg: `Bienvenido ${get.nombre_usuario}!`,
        status: 200,
      });
    }

    if (!checkPassword) {
      return res
        .status(409)
        .send({ msg: "Contraseña incorrecta!", status: 409 });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: "Hubo un error.", status: 500 });
  }
};

module.exports = {
  authLogin,
};
