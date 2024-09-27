const { Sequelize } = require("sequelize");
const BienModel = require("./bienes");
const SedeModel = require("./sedes");
const UbiacionModel = require("./ubicaciones");
const DependenciaModel = require("./dependencias");
const TrabajadorModel = require("./trabajadores");

function initModels(sequelize) {
  const Bienes = BienModel(sequelize, Sequelize);
  const Sedes = SedeModel(sequelize, Sequelize);
  const Ubicaciones = UbiacionModel(sequelize, Sequelize)
  const Dependencias = DependenciaModel(sequelize, Sequelize)
  const Trabajadores = TrabajadorModel(sequelize, Sequelize)
  //   const Usuario = UsuarioModel(sequelize, Sequelize);

  Ubicaciones.hasMany(Bienes,  { foreignKey: "ubicacion_id" })
  Bienes.belongsTo(Trabajadores, { foreignKey: "trabajador_id" })
  Bienes.belongsTo(Ubicaciones, { foreignKey: "ubicacion_id" })


  return {
    Bienes,
    Sedes,
    Ubicaciones,
    Dependencias,
    Trabajadores
  };
}

module.exports = initModels;
