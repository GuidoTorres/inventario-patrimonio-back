module.exports = (sequelize, DataTypes) => {
  const bienes = sequelize.define(
    "bienes",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
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
      estado_patrimonial: DataTypes.STRING,
      fecha_registro: DataTypes.STRING,
      inventariado: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      foto: DataTypes.STRING,
      detalles: DataTypes.STRING,
      usuario_id: DataTypes.INTEGER,
      tipo: DataTypes.STRING,
      secuencia: DataTypes.INTEGER,
      observacion: DataTypes.STRING,
      lastSync: DataTypes.DATE
    },
    { timestamps: true, tableName: "bienes", freezeTableName: true }
  );

  return bienes;
};
