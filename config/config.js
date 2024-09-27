const { Sequelize } = require('sequelize');
const initModels = require('../app/models/init_models');

const sequelize = new Sequelize('inventario_patrimonio', 'usuario', 'root', {
  host: '10.30.1.43',
  dialect: 'mysql',
  dialectOptions: {

  },
  logging: true // Desactiva el logging si prefieres
});

initModels(sequelize)




module.exports = sequelize;