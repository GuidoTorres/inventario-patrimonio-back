const express = require('express')

const bienesRouter = require("./bienes")
const sedesRouter = require("./sedes")
const dependenciasRouter = require("./dependencias")
const ubicacionesRouter = require("./ubicaciones")
const trabajadorRouter = require("./trabajadores")

function routerApi(app){

    const router = express.Router();
    app.use('/api/v1', router);
    router.use('/bienes', bienesRouter)
    router.use('/sedes', sedesRouter)
    router.use('/dependencias', dependenciasRouter)
    router.use('/ubicaciones', ubicacionesRouter)
    router.use('/trabajadores', trabajadorRouter)



}

module.exports = routerApi