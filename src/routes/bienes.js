const express = require('express');
const { getBienesSiga, getBienes, postBienes, getBienImagen, getBienesInventariados, bienesPorTrabajador, getConsultaBienes, getSigaToDB, getBienesPorInventariador, sedesPorTrabajador, getBienesFaltantes, getBienesSigaSbn, getEstadisticasBiens, generarSbnSobrante } = require('../controllers/bienes');
const upload = require('../middlewares/multer');
const router = express.Router();

router.get("/", getBienesSiga)
router.get("/sbn", getBienesSigaSbn)
router.get("/sobrante/sbn", generarSbnSobrante)
router.get("/inventario", getBienes)
router.get("/faltantes", getBienesFaltantes)
router.get("/imagenes/:sbn/:filename", getBienImagen)
router.get("/inventariados", getBienesInventariados)
router.get("/inventariador", getBienesPorInventariador)
router.get("/trabajadores/sedes", sedesPorTrabajador  )
router.get("/etiquetas", bienesPorTrabajador)
router.get("/consulta", getConsultaBienes)
router.get("/siga/prueba", getSigaToDB)
router.get("/estadisticas", getEstadisticasBiens)


router.put("/", upload.single('imagen'),postBienes)
module.exports = router