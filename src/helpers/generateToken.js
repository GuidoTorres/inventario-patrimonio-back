const jwt = require('jsonwebtoken');

const tokenSign = async (user) => {
  console.log(user);
  const secret = "123456"
  return jwt.sign(
    {
      id: user.id,
      usuario: user.usuario,
    },
    secret,
    {
      expiresIn: "12h",
    }
  );
};
const verifyToken = async (token) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const error = new Error("Token inválido");
      error.status = 409;
      throw error;
    }
    return null;
  }
};

module.exports = {tokenSign, verifyToken};
