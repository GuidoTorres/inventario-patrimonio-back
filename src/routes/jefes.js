const express = require('express');
const { getJefes, postJefes, updateJefes, deleteJefes } = require('../controllers/jefes');
const router = express.Router();

router.get("/", getJefes)
router.post("/", postJefes)
router.put("/:id", updateJefes)
router.delete("/:id", deleteJefes)

module.exports = router