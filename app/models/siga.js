
module.exports = (sequelize, DataTypes) => {

    const siga = sequelize.define("siga", {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        CARACTERISTICAS: DataTypes.STRING,
        CENTRO_COSTO: DataTypes.STRING,
        CODIGO_ACTIVO: DataTypes.STRING,
        COD_UBICAC: DataTypes.STRING,
        DESCRIPCION: DataTypes.STRING,
        EMPLEADO_FINAL: DataTypes.STRING,
        ESTADO: DataTypes.STRING,
        ESTADO_CONSERV: DataTypes.STRING,
        MARCA: DataTypes.STRING,
        MEDIDAS: DataTypes.STRING,
        MODELO: DataTypes.STRING,
        NOMBRE_DEPEND: DataTypes.STRING,
        NRO_SERIE: DataTypes.STRING,
        OBSERVACIONES: DataTypes.STRING,
        RESPONSABLE: DataTypes.STRING,
        SECUENCIA: DataTypes.STRING,
        SEDE: DataTypes.STRING,
        TIPO_UBICAC: DataTypes.STRING,
        UBICAC_FISICA: DataTypes.STRING,
        USUARIO_FINAL: DataTypes.STRING,
        docum_ident: DataTypes.STRING,
        nombre_sede: DataTypes.STRING,


    }, { timestamps: false, tableName: "siga", freezeTableName: true })

    return siga;

} 