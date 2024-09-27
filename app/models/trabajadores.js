
module.exports = (sequelize, DataTypes) =>{

    const trabajadores = sequelize.define("trabajadores", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
        dni: DataTypes.STRING,
        nombre: DataTypes.STRING,
        estado: DataTypes.STRING,
        createdAt : DataTypes.DATE,
        updatedAt: DataTypes.DATE,

    }, {timestamps: true, tableName: "trabajadores", freezeTableName: true})

    return trabajadores;

} 