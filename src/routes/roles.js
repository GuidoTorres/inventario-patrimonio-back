const express = require('express');
const { getRoles, postRoles, updateRoles, deleteRoles } = require('../controllers/roles');
const router = express.Router();

router.get("/", getRoles)
router.post("/", postRoles)
router.put("/:id", updateRoles)
router.delete("/:id", deleteRoles)

module.exports = router