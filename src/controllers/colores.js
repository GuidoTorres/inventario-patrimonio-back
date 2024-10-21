const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const getColores = async (req, res) => {
  try {

    // Hacer fetch a la API externa
    let url = "http://10.30.1.43/api/v1/colores";
    const response = await fetch(url);
    const externalData = await response.json();

    return res.json( externalData );
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

module.exports = { getColores };
