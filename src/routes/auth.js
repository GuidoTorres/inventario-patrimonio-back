const express = require('express');
const { authLogin} = require('../controllers/auth');
const router = express.Router();

router.post("/", authLogin)

module.exports = router