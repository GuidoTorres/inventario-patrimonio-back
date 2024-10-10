
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

    return sedes;

} 