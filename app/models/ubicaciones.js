
module.exports = (sequelize, DataTypes) => {
  const { v4: uuidv4 } = require('uuid');

  const ubicaciones = sequelize.define("ubicaciones", {

    id: {
      allowNull: false,
      autoIncrement: false,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    nombre: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    dependencia_id: DataTypes.INTEGER,
    tipo_ubicac: DataTypes.STRING,
    ubicac_fisica: DataTypes.STRING,

  }, { timestamps: true, tableName: "ubicaciones", freezeTableName: true })


  return ubicaciones;

} 