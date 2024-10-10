module.exports = (sequelize, DataTypes) => {
  const inventariadores = sequelize.define(
    "inventariadores",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      nombre: DataTypes.STRING,
      anio: DataTypes.INTEGER,
      grupo_id: DataTypes.INTEGER,
      jefe_id: DataTypes.INTEGER,
    },
    { timestamps: false, tableName: "inventariadores", freezeTableName: true }
  );

  return inventariadores;
};
