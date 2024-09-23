const express = require('express')

const bienesRouter = require("./bienes")
// const equipoRouter = require("./equipos")
// const usuarioRouter = require("./usuario")
// const authRouter = require("./auth")
// const marcasRouter = require("./marcas")
// const dependenciaRouter = require("./dependencia")
// const subdependenciaRouter = require("./subdependencias")
// const sedeRouter = require("./sedes")
// const modulosRouter = require("./modulos")
function routerApi(app){

    const router = express.Router();
    app.use('/api/v1', router);
    router.use('/bienes', bienesRouter)
    // router.use('/equipos', equipoRouter)
    // router.use('/usuario', usuarioRouter)
    // router.use('/subdependencias', subdependenciaRouter)
    // router.use('/auth', authRouter)
    // router.use('/dependencia', dependenciaRouter)
    // router.use('/sedes', sedeRouter)
    // router.use('/modulos', modulosRouter)
    // router.use('/red')
    // router.use('/soporte')

}

module.exports = routerApi