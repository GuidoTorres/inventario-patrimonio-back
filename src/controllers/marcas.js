const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getDatabaseConnection } = require("./../../config/config");

const getMarcas = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection(); // Asegúrate de tener la conexión configurada

    // Hacer fetch a la API externa
    let url = "http://10.30.1.43/api/v1/marcas";
    const response = await fetch(url);
    const externalData = await response.json();
//prueba
    return res.json(externalData );
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

module.exports = { getMarcas };
