const express = require('express');
const { getTrabajadores, getAllTrabajadores } = require('../controllers/trabajadores');
const router = express.Router();

router.get("/", getTrabajadores)
router.get("/all", getAllTrabajadores)


module.exports = router