
module.exports = (sequelize, DataTypes) =>{

    const bienes = sequelize.define("bienes", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
        sbn: DataTypes.STRING,
        descripcion: DataTypes.STRING,
        marca: DataTypes.STRING,
        modelo: DataTypes.STRING,
        serie: DataTypes.STRING,
        color: DataTypes.STRING,
        estado: DataTypes.STRING,
        situacion: DataTypes.BOOLEAN,
        sede_id: DataTypes.INTEGER,
        ubicacion_id: DataTypes.INTEGER,
        dependencia_id: DataTypes.INTEGER,
        dni: DataTypes.STRING,
        estado_patrimonial: DataTypes.BOOLEAN,
        fecha_registro: DataTypes.STRING,
        inventariado: DataTypes.BOOLEAN,
        createdAt : DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        foto: DataTypes.STRING



    }, {timestamps: true, tableName: "bienes", freezeTableName: true})
    bienes.associate = function(models) {
        // equipos.belongsTo(models.sedes, { foreignKey: "sede_id" });
        // equipos.belongsTo(models.ubicaciones, {foreignKey: "ubicacion_id"})
      };

    return bienes;

} 