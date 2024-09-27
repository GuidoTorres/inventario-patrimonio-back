const express = require('express');
const { getSedes, postSedes, updateSedes, deleteSedes } = require('../controllers/sedes');
const router = express.Router();

router.get("/", getSedes)
router.post("/", postSedes)
router.put("/:id", updateSedes)
router.delete("/:id", deleteSedes)

module.exports = router