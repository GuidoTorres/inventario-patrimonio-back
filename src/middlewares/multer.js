const multer = require("multer");
const path = require("path");

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");  // Carpeta donde se guardan las imágenes
  },
  filename: (req, file, cb) => {
    // Guardar el archivo con el nombre del SBN, usando el valor de req.body.sbn
    const sbn = req.body.sbn;

    // Si por alguna razón el SBN no está disponible, puedes usar un nombre por defecto o un error
    if (sbn) {
      cb(null, `${sbn}${path.extname(file.originalname)}`); // Guardar con SBN y la extensión del archivo
    } else {
      cb(new Error("SBN no proporcionado"), false);  // Generar error si no hay SBN
    }
  },
});

// Configuración de Multer para subir archivos
const upload = multer({ storage: storage });

module.exports = upload;
