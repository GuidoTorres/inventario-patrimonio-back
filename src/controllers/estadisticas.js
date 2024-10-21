const { Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");

const estadisticasUso = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const bienes = await models.bienes.findAll({
      where: {
        inventariado: true, // Filtrar solo los bienes inventariados
      },
      include: [
        { model: models.sedes },
        { model: models.dependencias },
        { model: models.ubicaciones },
      ],
    });

    const conteosBienes = {
      bienesEnUso: 0,
      bienesEnDesuso: 0,
    };

    bienes.forEach(({ situacion }) => {
      if (situacion) {
        conteosBienes.bienesEnUso += 1; // Eliminado el operador opcional
      } else {
        conteosBienes.bienesEnDesuso += 1; // Eliminado el operador opcional
      }
    });

    // Filtrar etiquetas y datos donde el valor es mayor que 0
    const filteredLabels = ["Bienes en Uso", "Bienes en Desuso"].filter(
      (label, index) => Object.values(conteosBienes)[index] > 0
    );
    const filteredData = Object.values(conteosBienes).filter(
      (value) => value > 0
    );

    const predefinedColors = [
      "rgba(75, 192, 192, 0.8)", // Verde para bienes en uso
      "rgba(255, 99, 132, 0.8)", // Rojo para bienes en desuso
    ];

    const filteredColors = predefinedColors.filter(
      (color, index) => Object.values(conteosBienes)[index] > 0
    );

    const data = {
      labels: filteredLabels, // Etiquetas filtradas
      datasets: [
        {
          label: `Cantidad de Bienes`,
          data: filteredData, // Datos filtrados
          backgroundColor: filteredColors, // Colores filtrados
          borderColor: filteredColors.map((color) => color.replace("0.8", "1")),
          borderWidth: 1,
        },
      ],
    };

    return res.json({ chartData: data, cantidadTotal: bienes.length });
  } catch (error) {
    console.error("Error al obtener los bienes inventariados:", error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const estadisticasTipo = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const bienes = await models.bienes.findAll({
      where: {
        inventariado: true,
      },
    });

    const conteosBienes = {
      activos: 0,
      sobrantes: 0,
      faltantes: 0,
    };

    bienes.forEach(({ tipo }) => {
      switch (tipo) {
        case "activo":
          conteosBienes.activos += 1;
          break;
        case "sobrante":
          conteosBienes.sobrantes += 1;
          break;
        case "faltante":
          conteosBienes.faltantes += 1;
          break;
        default:
          break;
      }
    });

    // Filtrar etiquetas y datos donde el valor es mayor que 0
    const filteredLabels = [
      "Bienes Activos",
      "Bienes Sobrantes",
      "Bienes Faltantes",
    ].filter((label, index) => Object.values(conteosBienes)[index] > 0);
    const filteredData = Object.values(conteosBienes).filter(
      (value) => value > 0
    );

    const predefinedColors = [
      "rgba(75, 192, 192, 0.8)", // Verde para bienes activos
      "rgba(255, 206, 86, 0.8)", // Amarillo para bienes sobrantes
      "rgba(255, 99, 132, 0.8)", // Rojo para bienes faltantes
    ];

    const filteredColors = predefinedColors.filter(
      (color, index) => Object.values(conteosBienes)[index] > 0
    );

    const data = {
      labels: filteredLabels, // Etiquetas filtradas
      datasets: [
        {
          label: `Cantidad de Bienes`,
          data: filteredData, // Datos filtrados
          backgroundColor: filteredColors, // Colores filtrados
          borderColor: filteredColors.map((color) => color.replace("0.8", "1")),
          borderWidth: 1,
        },
      ],
    };

    return res.json({ chartData: data, cantidadTotal: bienes.length });
  } catch (error) {
    console.error("Error al obtener los bienes inventariados por tipo:", error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const estadisticasPorSede = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    const bienes = await models.bienes.findAll({
      where: {
        inventariado: true,
        sede_id: { [Op.not]: null },
      },
      include: [{ model: models.sedes, attributes: ["nombre"] }],
    });

    const conteosSedes = {};

    bienes.forEach(({ sede }) => {
      const nombreSede = sede?.nombre;
      if (conteosSedes[nombreSede]) {
        conteosSedes[nombreSede] += 1;
      } else {
        conteosSedes[nombreSede] = 1;
      }
    });

    // Filtrar etiquetas y datos donde el valor es mayor que 0
    const filteredLabels = Object.keys(conteosSedes).filter(
      (label) => conteosSedes[label] > 0
    );
    const filteredData = Object.values(conteosSedes).filter(
      (value) => value > 0
    );

    const predefinedColors = Object.keys(conteosSedes).map(
      () =>
        `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(
          Math.random() * 255
        )}, ${Math.floor(Math.random() * 255)}, 0.8)`
    );

    const filteredColors = predefinedColors.filter(
      (color, index) => conteosSedes[filteredLabels[index]] > 0
    );

    const data = {
      labels: filteredLabels, // Etiquetas filtradas
      datasets: [
        {
          label: `Cantidad de Bienes por Sede`,
          data: filteredData, // Datos filtrados
          backgroundColor: filteredColors, // Colores filtrados
          borderColor: filteredColors.map((color) => color.replace("0.8", "1")),
          borderWidth: 1,
        },
      ],
    };

    return res.json({ chartData: data, cantidadTotal: bienes.length });
  } catch (error) {
    console.error("Error al obtener los bienes inventariados por sede:", error);
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const estadisticasPorEstadoPatrimonial = async (req, res) => {
  try {
    const { models } = await getDatabaseConnection();

    // Obtener los bienes inventariados
    const bienes = await models.bienes.findAll({
      where: {
        inventariado: true, // Filtrar solo los bienes inventariados
      },
      attributes: ["estado_patrimonial"], // Solo traer el estado patrimonial
    });

    // Mapeo de los valores numéricos de estado_patrimonial a sus etiquetas correspondientes
    const estadosMap = {
      5: "Nuevo",
      1: "Bueno",
      2: "Regular",
      3: "Malo",
      7: "RAEE",
      6: "Chatarra",
    };

    // Inicializar el conteo de bienes por estado patrimonial
    const conteosEstados = {
      Nuevo: 0,
      Bueno: 0,
      Regular: 0,
      Malo: 0,
      RAEE: 0,
      Chatarra: 0,
    };

    // Contabilizar los bienes según su estado patrimonial
    bienes.forEach(({ estado_patrimonial }) => {
      const estadoLabel = estadosMap[estado_patrimonial];
      if (estadoLabel) {
        conteosEstados[estadoLabel] += 1;
      }
    });

    // Filtrar las etiquetas y valores donde el conteo sea mayor a 0
    const filteredLabels = Object.keys(conteosEstados).filter(
      (key) => conteosEstados[key] > 0
    );
    const filteredData = Object.values(conteosEstados).filter(
      (value) => value > 0
    );

    // Definir colores para los estados patrimoniales, coincidiendo con las etiquetas filtradas
    const predefinedColors = [
      "rgba(75, 192, 192, 0.8)", // Verde para Nuevo
      "rgba(54, 162, 235, 0.8)", // Azul para Bueno
      "rgba(255, 206, 86, 0.8)", // Amarillo para Regular
      "rgba(255, 99, 132, 0.8)", // Rojo para Malo
      "rgba(153, 102, 255, 0.8)", // Morado para RAEE
      "rgba(255, 159, 64, 0.8)", // Naranja para Chatarra
    ];

    // Filtrar los colores para que coincidan con las etiquetas que se están mostrando
    const filteredColors = predefinedColors.filter(
      (color, index) => conteosEstados[filteredLabels[index]] > 0
    );

    // Preparar los datos para Chart.js
    const data = {
      labels: filteredLabels, // Etiquetas filtradas (sin valores 0)
      datasets: [
        {
          label: `Cantidad de Bienes por Estado Patrimonial`,
          data: filteredData, // Cantidades filtradas (sin valores 0)
          backgroundColor: filteredColors, // Colores de fondo filtrados
          borderColor: filteredColors.map((color) => color.replace("0.8", "1")), // Colores de borde
          borderWidth: 1, // Ancho del borde
        },
      ],
    };

    // Devolver la información de los bienes y los datos del gráfico
    return res.json({ chartData: data, cantidadTotal: bienes.length });
  } catch (error) {
    console.error(
      "Error al obtener los bienes inventariados por estado patrimonial:",
      error
    );
    res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

module.exports = {
  estadisticasUso,
  estadisticasTipo,
  estadisticasPorSede,
  estadisticasPorEstadoPatrimonial,
};
