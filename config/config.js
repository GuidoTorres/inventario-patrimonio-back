const { Sequelize } = require('sequelize');
const initModels = require('../app/models/init_models');

const sequelize = new Sequelize('inventario_patrimonio', 'root', 'Tupapi00', {
  host: 'localhost',
  dialect: 'mysql',
  dialectOptions: {

  },
  logging: false // Desactiva el logging si prefieres
});

initModels(sequelize)




module.exports = sequelize;