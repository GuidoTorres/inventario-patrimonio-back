const { models } = require("./../../config/config");
const getTrabajadores = async (req, res) => {

    try {
        const Trabajador = await models.trabajadores.findOne({
            attributes: ["nombre"],
            where: { dni: req.query.dni }
        });
        if(!Trabajador){

            return res.status(500).json({msg:"Trabajador no encontrado!"});
        }

        return res.json(Trabajador);
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json({ msg: "Trabajador no encontrado.", error: error.message });
    }
};

module.exports = {
    getTrabajadores
}