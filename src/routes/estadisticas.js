const router = require("express").Router();
const estadisticas = require("../controllers/estadisticas");

router.get("/uso", estadisticas.estadisticasUso);
router.get("/tipo", estadisticas.estadisticasTipo);
router.get("/sede", estadisticas.estadisticasPorSede);
router.get("/estado", estadisticas.estadisticasPorEstadoPatrimonial);

module.exports = router;
