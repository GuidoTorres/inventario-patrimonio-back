const { models } = require("./../../config/config");
const getUbicaciones = async (req, res) => {
    try {
        const ubicaciones = await models.ubicaciones.findAll({
            attributes: ["id", "nombre", "dependencia_id", "tipo_ubicac", "ubicac_fisica"]

        });

        return res.json(ubicaciones);
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "Error fetching data", error: error.message });
    }
};

const postUbicaciones = async (req, res) => {
    try {
        await models.ubicaciones.create(req.body);

        return res.json({ msg: "Ubicación creada con éxito!" });
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo crear la ubicación.", error: error.message });
    }
};

const updateUbicaciones = async (req, res) => {
    try {
        await models.ubicaciones.update(req.body, {
            where: { id: id }
        });
        return res.json({ msg: "Ubiación actualizada con éxito!" });

    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo actualizar la ubicación.", error: error.message });
    }
};

const deleteUbicaciones = async (req, res) => {
    try {
        await models.ubicaciones.destroy({
            where: { id: id }
        });

        return res.json({ msg: "Ubicación eliminada con éxito!" });
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ message: "No se pudo eliminar la ubicación.", error: error.message });
    }
};





module.exports = { getUbicaciones, postUbicaciones, updateUbicaciones, deleteUbicaciones }