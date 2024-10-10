module.exports = (sequelize, DataTypes) => {
    const usuario_permisos = sequelize.define(
      "usuario_permisos",
      {
        usuario_id: DataTypes.INTEGER,
        permiso_id: DataTypes.INTEGER,
      },
      { timestamps: false, tableName: "usuario_permisos", freezeTableName: true }
    );
  
    return usuario_permisos;
  };
  