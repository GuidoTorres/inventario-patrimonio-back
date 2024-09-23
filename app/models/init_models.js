const { Sequelize } = require("sequelize");
const BienModel = require("./bienes");

function initModels(sequelize) {
  const Bienes = BienModel(sequelize, Sequelize);
  //   const Usuario = UsuarioModel(sequelize, Sequelize);

  //   Usuario.hasMany(Documento, { foreignKey: "usuario_id" });
  //   Documento.belongsTo(Usuario, { foreignKey: "usuario_id" });

  return {
    Bienes,
  };
}

module.exports = initModels;
