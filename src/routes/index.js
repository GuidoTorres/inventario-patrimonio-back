const express = require("express");

const bienesRouter = require("./bienes");
const sedesRouter = require("./sedes");
const dependenciasRouter = require("./dependencias");
const ubicacionesRouter = require("./ubicaciones");
const trabajadorRouter = require("./trabajadores");
const jefeRouter = require("./jefes");
const inventariadorRouter = require("./inventariadores");
const UsuarioRouter = require("./usuarios");
const RolRouter = require("./roles");
const AuthRouter = require("./auth");
const MarcasRouter = require("./marcas");
const ColoresRouter = require("./colores");
const EstadisticasRouter = require("./estadisticas");

function routerApi(app) {
  const router = express.Router();
  app.use("/api/v1", router);
  router.use("/bienes", bienesRouter);
  router.use("/sedes", sedesRouter);
  router.use("/dependencias", dependenciasRouter);
  router.use("/ubicaciones", ubicacionesRouter);
  router.use("/trabajadores", trabajadorRouter);
  router.use("/jefes", jefeRouter);
  router.use("/inventariadores", inventariadorRouter);
  router.use("/usuarios", UsuarioRouter);
  router.use("/roles", RolRouter);
  router.use("/auth", AuthRouter);
  router.use("/marcas", MarcasRouter);
  router.use("/colores", ColoresRouter);
  router.use("/estadisticas", EstadisticasRouter);

}

module.exports = routerApi;
