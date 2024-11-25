const { getDatabaseConnection } = require("./../../config/config");
const { encrypt } = require("../helpers/handleBcrypt");
const dayjs = require("dayjs");
const { Op } = require("sequelize");

const getUsuario = async (req, res, next) => {
  try {
    const { models } = await getDatabaseConnection();

    const all = await models.usuarios.findAll({
      include: [
        {
          model: models.roles,
          where: {
            nombre: { [Op.ne]: "Administrador" },
          },
        },
      ],
    });
    const format = all.map((item, i) => {
      return {
        nro: i + 1,
        ...item.dataValues,
      };
    });
    return res.status(200).json({ data: format });
  } catch (error) {
    res.status(500).json();
    console.log(error);
  }
};

const postUsuario = async (req, res, next) => {
  const { models } = await getDatabaseConnection();

  const { nombre_usuario, contrasenia, jefe_id, inventariador_id, rol_id } =
    req.body;
  if (!nombre_usuario || !contrasenia) {
    return res.status(400).json({ msg: "Faltan campos requeridos" });
  }

  const passwordHash = await encrypt(contrasenia);
  let info = {
    nombre_usuario,
    contrasenia: passwordHash,
    anio: dayjs().format("YYYY"),
    jefe_id,
    inventariador_id,
    rol_id: rol_id,
  };

  try {
    const getUser = await models.usuarios.findAll({
      where: { nombre_usuario: info.nombre_usuario },
    });

    if (getUser.length > 0) {
      return res.status(409).json({
        msg: "El nombre de usuario ya existe, intente con otro!",
        status: 500,
      });
    } else {
      const nuevoUsuario = await models.usuarios.create(info);
      return res.status(200).json({
        data: nuevoUsuario,
        msg: "Usuario creado con éxito!",
        status: 200,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "No se pudo crear.", status: 500 });
  }
};

const updateUsuario = async (req, res, next) => {
  const { models } = await getDatabaseConnection();

  let id = req.params.id;
  const { nombre_usuario, contrasenia, jefe_id, inventariador_id, rol_id } =
    req.body;

  let info = {
    nombre_usuario,
    jefe_id,
    inventariador_id,
    rol_id,
  };
  try {
    await models.usuarios.update(info, { where: { id: id } });
    return res
      .status(200)
      .json({ msg: "Usuario actualizado con éxito!", status: 200 });
  } catch (error) {
    res.status(500).json({ msg: "No se pudo actualizar", status: 500 });
  }
};

const deleteUsuario = async (req, res, next) => {
  const { models } = await getDatabaseConnection();

  let id = req.params.id;
  try {
    await models.usuarios.destroy({ where: { id: id } });
    return res
      .status(200)
      .json({ msg: "Usuario eliminado con éxito!", status: 200 });
  } catch (error) {
    res.status(500).json({ msg: "No se pudo eliminar", status: 500 });
  }
};

module.exports = {
  getUsuario,
  postUsuario,
  updateUsuario,
  deleteUsuario,
};
