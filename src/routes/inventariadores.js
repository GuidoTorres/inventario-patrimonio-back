const express = require("express");
const {
  getInventariadores,
  postInventariadores,
  updateInventariadores,
  deleteInventariadores,
} = require("../controllers/inventariadores");
const router = express.Router();

router.get("/", getInventariadores);
router.post("/", postInventariadores);
router.put("/:id", updateInventariadores);
router.delete("/:id", deleteInventariadores);

module.exports = router;
