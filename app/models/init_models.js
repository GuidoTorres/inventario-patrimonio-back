const { Sequelize } = require("sequelize");
const BienModel = require("./bienes");
const SedeModel = require("./sedes");
const UbiacionModel = require("./ubicaciones");
const DependenciaModel = require("./dependencias");
const TrabajadorModel = require("./trabajadores");
const GrupoModel = require("./grupos");
const JefesModel = require("./jefes");
const InventariadorModel = require("./inventariadores");
const UsuarioModel = require("./usuarios");
const RolModel = require("./roles");
const PermisoModel = require("./permisos");
const UsuarioPermisoModel = require("./usuario_permisos");
const ubicaciones = require("./ubicaciones");
const Bienes23Model = require("./bienes23")
function initModels(sequelize) {
  const Bienes = BienModel(sequelize, Sequelize);
  const Sedes = SedeModel(sequelize, Sequelize);
  const Ubicaciones = UbiacionModel(sequelize, Sequelize);
  const Dependencias = DependenciaModel(sequelize, Sequelize);
  const Trabajadores = TrabajadorModel(sequelize, Sequelize);
  const Grupos = GrupoModel(sequelize, Sequelize);
  const Jefes = JefesModel(sequelize, Sequelize);
  const Inventariadores = InventariadorModel(sequelize, Sequelize);
  const Usuarios = UsuarioModel(sequelize, Sequelize);
  const Roles = RolModel(sequelize, Sequelize);
  const Permisos = PermisoModel(sequelize, Sequelize);
  const UsuarioPermiso = UsuarioPermisoModel(sequelize, Sequelize)
  const Bienes23= Bienes23Model(sequelize, Sequelize)
  Sedes.hasMany(Dependencias, {foreignKey:"sede_id"})
  Dependencias.belongsTo(Sedes, {foreignKey:"sede_id"})

  Dependencias.hasMany(Ubicaciones, {foreignKey:"dependencia_id"})
  Ubicaciones.belongsTo(Dependencias, {foreignKey:"dependencia_id"})

  Usuarios.hasMany(Bienes, {foreignKey:"usuario_id"})
  Bienes.belongsTo(Usuarios, {foreignKey:"usuario_id"})

  Ubicaciones.hasMany(Bienes, { foreignKey: "ubicacion_id" });
  Bienes.belongsTo(Trabajadores, { foreignKey: "trabajador_id" });
  Bienes.belongsTo(Ubicaciones, { foreignKey: "ubicacion_id" });
  Grupos.hasMany(Jefes, { foreignKey: "grupo_id" });
  Jefes.belongsTo(Grupos, { foreignKey: "grupo_id" });
  Grupos.hasMany(Inventariadores, { foreignKey: "grupo_id" });
  Inventariadores.belongsTo(Grupos, { foreignKey: "grupo_id" });
  Jefes.hasMany(Inventariadores, { foreignKey: "jefe_id" });
  Inventariadores.belongsTo(Jefes, { foreignKey: "jefe_id" });
  Roles.hasMany(Usuarios, { foreignKey: "rol_id" });
  Usuarios.belongsTo(Roles, { foreignKey: "rol_id" });
  Jefes.hasMany(Usuarios, { foreignKey: "jefe_id" });
  Usuarios.belongsTo(Jefes, { foreignKey: "jefe_id" });
  Inventariadores.hasMany(Usuarios, { foreignKey: "inventariador_id" });
  Usuarios.belongsTo(Inventariadores, { foreignKey: "inventariador_id" });
  Usuarios.belongsToMany(Permisos, {
    through: UsuarioPermiso,
    foreignKey: "usuario_id",
  });
  Permisos.belongsToMany(Usuarios, {
    through: UsuarioPermiso,
    foreignKey: "permiso_id",
  });

  Sedes.hasMany(Bienes, {foreignKey:"sede_id"})
  Bienes.belongsTo(Sedes, {foreignKey:"sede_id"})

  Dependencias.hasMany(Bienes, {foreignKey:"dependencia_id"})
  Bienes.belongsTo(Dependencias, {foreignKey:"dependencia_id"})

  Ubicaciones.hasMany(Bienes, {foreignKey:"ubicacion_id"})
  Bienes.belongsTo(Ubicaciones, {foreignKey:"ubicacion_id"})

  return {
    Bienes,
    Sedes,
    Ubicaciones,
    Dependencias,
    Trabajadores,
    Grupos,
    Jefes,
    Trabajadores,
    Usuarios,
    Roles,
    Bienes23
  };
}

module.exports = initModels;
