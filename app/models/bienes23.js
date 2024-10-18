const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('bienes23', {
    SBN: {
      type: DataTypes.STRING(25),
      allowNull: false,
      primaryKey: true
    },
    cuentac: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    cod_activo: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fecha_ingreso: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    saldo_inicial: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    codbien: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codinst: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codlocal: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codarea: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codoficina: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    ubicacion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codanterior: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codusuario: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    codusuario2: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    tipo_cta: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    cuenta: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    cuentacontable: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    valorlibro: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    valortasa: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    marca: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    modelo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tipo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    serie: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    nummotor: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    numchasis: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    'año': {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    dimension: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    raza: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    especie: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_reg: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    placa: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    edad: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    pais: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    condicion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_act: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    asegurado: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    est_bien: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    flg_causal: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resol_baja: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_baja: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    flg_acto: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resol_disp: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_disp: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    causal_elim: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    est_gestion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resol_afec: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_afec: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    fec_vafec: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    ent_afec: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resol_arre: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fec_arre: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    fec_varre: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    ent_arre: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    doc_alta: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    doc_baja: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    sit_binv: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    valoradq: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    ent_disp: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    matricula: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    anho_fab: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    longitud: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    altura: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    ancho: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    dsc_otros: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    id_foto: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    formaadq: {
      type: DataTypes.SMALLINT,
      allowNull: true
    },
    ordencompra: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    SEC_EJEC: {
      type: DataTypes.DECIMAL(6,0),
      allowNull: true
    },
    TIPO_MODALIDAD: {
      type: DataTypes.DECIMAL(1,0),
      allowNull: true
    },
    SECUENCIA: {
      type: DataTypes.DECIMAL(8,0),
      allowNull: true
    },
    ESTADO_2: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    TIPO_BIEN: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    GRUPO_BIEN: {
      type: DataTypes.CHAR(2),
      allowNull: true
    },
    CLASE_BIEN: {
      type: DataTypes.CHAR(2),
      allowNull: true
    },
    FAMILIA_BIEN: {
      type: DataTypes.CHAR(4),
      allowNull: true
    },
    ITEM_BIEN: {
      type: DataTypes.CHAR(4),
      allowNull: true
    },
    TIPO_ACTIVO: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    TIPO_DOC_ADQUISICION: {
      type: DataTypes.CHAR(3),
      allowNull: true
    },
    NRO_DOCUMENTO: {
      type: DataTypes.CHAR(10),
      allowNull: true
    },
    VALOR_NEA: {
      type: DataTypes.DECIMAL(16,6),
      allowNull: true
    },
    FECHA_NEA: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    VALOR_COMPRA: {
      type: DataTypes.DECIMAL(16,6),
      allowNull: true
    },
    FECHA_COMPRA: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    TIPO_DOC_ALTA: {
      type: DataTypes.CHAR(3),
      allowNull: true
    },
    NRO_PECOSA: {
      type: DataTypes.DECIMAL(5,0),
      allowNull: true
    },
    FECHA_ALTA: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    CENTRO_COSTO: {
      type: DataTypes.CHAR(15),
      allowNull: true
    },
    EMPLEADO_RESPONSABLE: {
      type: DataTypes.CHAR(15),
      allowNull: true
    },
    TIPO_UBICAC: {
      type: DataTypes.DECIMAL(3,0),
      allowNull: true
    },
    SUBTIPO_UBICAC: {
      type: DataTypes.CHAR(3),
      allowNull: true
    },
    CARACTERISTICAS: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    MEDIDAS: {
      type: DataTypes.CHAR(30),
      allowNull: true
    },
    FLAG_ITEM_ESNI: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    MARCA_ESNI: {
      type: DataTypes.DECIMAL(5,0),
      allowNull: true
    },
    COD_MODELO: {
      type: DataTypes.DECIMAL(3,0),
      allowNull: true
    },
    ESTADO_ACTUAL: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    FECHA_MOVIMTO: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    PROVEEDOR: {
      type: DataTypes.DECIMAL(5,0),
      allowNull: true
    },
    COD_ALMACEN: {
      type: DataTypes.CHAR(3),
      allowNull: true
    },
    SEC_ALMACEN: {
      type: DataTypes.CHAR(3),
      allowNull: true
    },
    FLAG_ETIQUETA: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    FECHA_ETIQUET: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    VALOR_INICIAL: {
      type: DataTypes.DECIMAL(16,2),
      allowNull: true
    },
    VALOR_DEPREC: {
      type: DataTypes.DECIMAL(16,2),
      allowNull: true
    },
    INVENT_SCANER: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    CLASIFICADOR: {
      type: DataTypes.CHAR(20),
      allowNull: true
    },
    ANO_EJE: {
      type: DataTypes.DECIMAL(4,0),
      allowNull: true
    },
    SUB_CTA: {
      type: DataTypes.CHAR(8),
      allowNull: true
    },
    MAYOR: {
      type: DataTypes.CHAR(4),
      allowNull: true
    },
    CODIGO_BARRA: {
      type: DataTypes.CHAR(15),
      allowNull: true
    },
    proceso: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    codigo_recuperado: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    estado_trabajo: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    flag_contable: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    ultimo_inv: {
      type: DataTypes.CHAR(4),
      allowNull: true
    },
    usuario_creacion: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    fecha_creacion: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    usuario_modificacion: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    fecha_modificacion: {
      type: DataTypes.DATE(3),
      allowNull: true
    },
    habilitado: {
      type: DataTypes.CHAR(1),
      allowNull: true
    },
    tipo_tran_nea: {
      type: DataTypes.STRING(1),
      allowNull: true
    },
    situacion: {
      type: DataTypes.CHAR(1),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'bienes23',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "SBN" },
        ]
      },
    ]
  });
};
