const express = require('express');
const { getUbicaciones, postUbicaciones, updateUbicaciones, deleteUbicaciones } = require('../controllers/ubicaciones');
const router = express.Router();

router.get("/", getUbicaciones)
router.post("/", postUbicaciones)
router.put("/:id", updateUbicaciones)
router.delete("/:id", deleteUbicaciones)

module.exports = router