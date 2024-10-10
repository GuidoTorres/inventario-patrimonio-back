const {getDatabaseConnection} = require("./../../config/config");
const getSedes = async (req, res) => {
    try {
        const {models} = await getDatabaseConnection(); // Obtener la conexión adecuada (remota o local)

        const sedes = await models.sedes.findAll({
            attributes:["id", "nombre"]
        });

        return res.json(sedes);
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "Error fetching data", error: error.message });
    }
};

const postSedes = async (req, res) => {
    try {
    const {models} = await getDatabaseConnection(); 

        await models.sedes.create(req.body);

        return res.json({ msg: "Sede creada con éxito!" });
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo crear la sede.", error: error.message });
    }
};

const updateSedes = async (req, res) => {
    try {
    const {models} = await getDatabaseConnection(); 

        await models.sedes.update(req.body, {
            where: { id: id }
        });
        return res.json({ msg: "Sede actualizada con éxito!" });

    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo actualizar la sede.", error: error.message });
    }
};

const deleteSedes = async (req, res) => {
    try {
    const {models} = await getDatabaseConnection(); 

        await models.sedes.destroy({
            where: { id: id }
        });

        return res.json({ msg: "Sede eliminada con éxito!" });
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo eliminar la sede.", error: error.message });
    }
};





module.exports = { getSedes, postSedes, updateSedes, deleteSedes }