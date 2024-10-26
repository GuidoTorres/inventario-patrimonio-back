const { getDatabaseConnection } = require("../../config/config");
const fetch = require("node-fetch");


const SigaDB = async () => {
    try {
        const { models } = await getDatabaseConnection(); // Asegúrate de tener la conexión configurada

        // Obtener las secuencias de todos los bienes ya existentes en la base de datos
        const bienesExistentes = await models.siga.findAll({
            attributes: ["secuencia"],
        });

        // Convertir los bienes existentes a un set de secuencias para una búsqueda rápida
        const secuenciasExistentes = new Set(
            bienesExistentes.map((bien) => bien.secuencia)
        );

        // Hacer fetch a la API externa
        let url = "http://10.30.1.42:8084/api/v1/bienes/prueba";
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const externalData = await response.json();

        // Filtrar los bienes que no están en la base de datos
        const nuevosBienes = externalData?.data?.filter((item) => {
            return !secuenciasExistentes.has(item.SECUENCIA); // Solo incluye bienes que no existen
        });

        // Si no hay bienes nuevos, finalizar la sincronización
        if (nuevosBienes.length === 0) {
            console.log("No hay nuevos bienes para sincronizar.");
            return;
        }


        // Insertar los nuevos bienes
        await models.siga.bulkCreate(nuevosBienes);

        console.log(
            "Sincronización completa. Nuevos bienes insertados:",
            nuevosBienes.length
        );
    } catch (error) {
        console.log(error);
    }
};

module.exports={SigaDB}