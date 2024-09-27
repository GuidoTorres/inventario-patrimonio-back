const express = require('express');
const { getDependencias, postDependencias, updateDependencias, deleteDependencias } = require('../controllers/dependencias');
const router = express.Router();

router.get("/", getDependencias)
router.post("/", postDependencias)
router.put("/:id", updateDependencias)
router.delete("/:id", deleteDependencias)

module.exports = router