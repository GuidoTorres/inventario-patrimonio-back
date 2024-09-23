
module.exports = (sequelize, DataTypes) =>{

    const ubicaciones = sequelize.define("ubicaciones", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
        nombre: DataTypes.STRING,
        createdAt : DataTypes.DATE,
        updatedAt: DataTypes.DATE,

    }, {timestamps: true, tableName: "ubicaciones", freezeTableName: true})
    ubicaciones.associate = function(models) {
        // equipos.belongsTo(models.sedes, { foreignKey: "sede_id" });
        // equipos.hasMany(models.dependencias, {foreignKey: "dependencia_id"})
      };

    return ubicaciones;

} 