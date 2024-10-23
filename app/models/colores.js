module.exports = (sequelize, DataTypes) => {
    const colores = sequelize.define(
      "colores",
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },
        CODIGO_COLOR: DataTypes.STRING,
        NOMBRE: DataTypes.STRING,
      },
      { timestamps: false, tableName: "colores", freezeTableName: true }
    );
  
    return colores;
  };