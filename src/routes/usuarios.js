const express = require('express');
const { getUsuario, postUsuario, updateUsuario, deleteUsuario } = require('../controllers/usuarios');
const router = express.Router();

router.get("/", getUsuario)
router.post("/", postUsuario)
router.put("/:id", updateUsuario)
router.delete("/:id", deleteUsuario)

module.exports = router