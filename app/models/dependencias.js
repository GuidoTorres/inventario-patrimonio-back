
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
        tipo_ubicac:DataTypes.STRING,
        ubicac_fisica: DataTypes.STRING,
        sede_id: DataTypes.INTEGER,
        centro_costo: DataTypes.STRING,

    }, {timestamps: true, tableName: "dependencias", freezeTableName: true})

    return dependencias;

} 