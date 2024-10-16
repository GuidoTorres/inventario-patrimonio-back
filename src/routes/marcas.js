const router = require("express").Router();
const marcas = require("../controllers/marcas");

router.get("/", marcas.getMarcas)

module.exports = router 