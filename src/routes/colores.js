const router = require("express").Router();
const colores = require("../controllers/colores");

router.get("/", colores.getColores)

module.exports = router 