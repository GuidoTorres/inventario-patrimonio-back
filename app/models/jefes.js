module.exports = (sequelize, DataTypes) => {
    const jefes = sequelize.define(
      "jefes",
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },
        nombre: DataTypes.STRING,
        anio: DataTypes.INTEGER,
        grupo_id: DataTypes.INTEGER
      },
      { timestamps: false, tableName: "jefes", freezeTableName: true }
    );
  
    return jefes;
  };
  