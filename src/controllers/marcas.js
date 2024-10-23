const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getDatabaseConnection } = require("./../../config/config");

const getMarcas = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection(); // Asegúrate de tener la conexión configurada

    const data = await models.marcas.findAll()

    return res.json( {data:data} );

  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

module.exports = { getMarcas };
