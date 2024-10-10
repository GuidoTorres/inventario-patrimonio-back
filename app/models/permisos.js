module.exports = (sequelize, DataTypes) => {
  const permisos = sequelize.define(
    "permisos",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      nombre: DataTypes.STRING,
    },
    { timestamps: false, tableName: "permisos", freezeTableName: true }
  );

  return permisos;
};
