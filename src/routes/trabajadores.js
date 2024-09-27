const express = require('express');
const { getTrabajadores } = require('../controllers/trabajadores');
const router = express.Router();

router.get("/", getTrabajadores)


module.exports = router