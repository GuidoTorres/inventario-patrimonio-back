
module.exports = (sequelize, DataTypes) =>{

    const sedes = sequelize.define("sedes", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
        nombre: DataTypes.STRING,
        createdAt : DataTypes.DATE,
        updatedAt: DataTypes.DATE,

    }, {timestamps: true, tableName: "sedes", freezeTableName: true})
    sedes.associate = function(models) {
        // equipos.hasMany(models.ubicaciones, { foreignKey: "ubicacion_id" });
        // equipos.hasMany(models.dependencias, {foreignKey: "dependencia_id"})
      };

    return sedes;

} 