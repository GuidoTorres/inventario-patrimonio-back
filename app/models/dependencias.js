
module.exports = (sequelize, DataTypes) =>{

    const dependencias = sequelize.define("dependencias", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
        nombre: DataTypes.STRING,
        createdAt : DataTypes.DATE,
        updatedAt: DataTypes.DATE,

    }, {timestamps: true, tableName: "dependencias", freezeTableName: true})
    dependencias.associate = function(models) {
        // equipos.belongsTo(models.sedes, { foreignKey: "sede_id" });
        // equipos.belongsTo(models.ubicaciones, {foreignKey: "ubicacion_id"})
      };

    return dependencias;

} 