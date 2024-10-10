module.exports = (sequelize, DataTypes) => {
  const grupos = sequelize.define(
    "grupos",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      nombre: DataTypes.STRING,
      anio: DataTypes.INTEGER,
    },
    { timestamps: false, tableName: "grupos", freezeTableName: true }
  );

  return grupos;
};
