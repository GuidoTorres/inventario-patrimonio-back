module.exports = (sequelize, DataTypes) => {
    const marcas = sequelize.define(
      "marcas",
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },
        marca: DataTypes.STRING,
        nombre: DataTypes.STRING,
      },
      { timestamps: false, tableName: "marcas", freezeTableName: true }
    );
  
    return marcas;
  };