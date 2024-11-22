const express = require('express');
const { getTrabajadores, getAllTrabajadores, postTrabajadores, updateTrabajadores } = require('../controllers/trabajadores');
const router = express.Router();

router.get("/", getTrabajadores)
router.get("/all", getAllTrabajadores)
router.post("/", postTrabajadores)
router.put("/:id", updateTrabajadores)

module.exports = router