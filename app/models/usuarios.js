module.exports = (sequelize, DataTypes) => {
  const usuarios = sequelize.define(
    "usuarios",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      nombre_usuario: DataTypes.STRING,
      contrasenia: DataTypes.STRING,
      rol_id: DataTypes.INTEGER,
      jefe_id: DataTypes.INTEGER,
      inventariador_id: DataTypes.INTEGER,
    },
    { timestamps: false, tableName: "usuarios", freezeTableName: true }
  );

  return usuarios;
};
