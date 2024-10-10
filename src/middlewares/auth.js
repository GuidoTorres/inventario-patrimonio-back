const { verifyToken } = require("../helpers/generateToken");

const checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.replace(/"/g, "").split(" ").pop();
    const tokenData = await verifyToken(token);
    if (tokenData && tokenData.id) {
      next();
    } else {
      const error = new Error("Token inválido");
      error.status = 409;
      throw error;
    }
  } catch (error) {
    next(error); // Pasar el error al siguiente middleware o controlador de errores
  }
};



module.exports= checkAuth
