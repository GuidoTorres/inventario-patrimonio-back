const express = require('express');
const { getBienesSiga, getBienes, postBienes, getBienImagen, getBienesInventariados, bienesPorTrabajador, getConsultaBienes, getSigaToDB, getBienesPorInventariador, sedesPorTrabajador } = require('../controllers/bienes');
const upload = require('../middlewares/multer');
const router = express.Router();

router.get("/", getBienesSiga)
router.get("/inventario", getBienes)
router.get("/imagenes/:sbn/:filename", getBienImagen)
router.get("/inventariados", getBienesInventariados)
router.get("/inventariador", getBienesPorInventariador)
router.get("/trabajadores/sedes", sedesPorTrabajador  )
router.get("/etiquetas", bienesPorTrabajador)
router.get("/consulta", getConsultaBienes)
router.get("/siga/prueba", getSigaToDB)
router.put("/", upload.single('imagen'),postBienes)
module.exports = router