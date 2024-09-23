const express = require('express');
const { getBienesSiga, getBienes, postBienes } = require('../controllers/bienes');
const router = express.Router();

router.get("/", getBienesSiga)
router.get("/inventario", getBienes)
router.put("/", postBienes)
module.exports = router