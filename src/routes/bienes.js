const express = require('express');
const { getBienesSiga, getBienes, postBienes, getBienImagen, getBienesInventariados, etiquetasBienes, bienesPorTrabajador, getConsultaBienes } = require('../controllers/bienes');
const router = express.Router();

router.get("/", getBienesSiga)
router.get("/inventario", getBienes)
router.get("/imagenes/:sbn/:filename", getBienImagen)
router.get("/inventariados", getBienesInventariados)
router.get("/trabajadores", etiquetasBienes)
router.get("/etiquetas", bienesPorTrabajador)
router.get("/consulta", getConsultaBienes)
router.put("/", postBienes)
module.exports = router