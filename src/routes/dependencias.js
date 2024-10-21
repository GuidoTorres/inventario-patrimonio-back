const express = require('express');
const { getDependencias, postDependencias, updateDependencias, deleteDependencias, getDependenciasSiga } = require('../controllers/dependencias');
const router = express.Router();

router.get("/", getDependencias)
router.get("/siga", getDependenciasSiga)
router.post("/", postDependencias)
router.put("/:id", updateDependencias)
router.delete("/:id", deleteDependencias)

module.exports = router