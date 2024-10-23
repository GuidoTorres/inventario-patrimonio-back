const multer = require("multer");
const path = require("path");

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const sbn = req.body.sbn;

    cb(null, `${sbn}-${Date.now()}${path.extname(file.originalname)}`);
  },
});


// Configuración de Multer para subir archivos
const upload = multer({ storage: storage });

module.exports = upload;
