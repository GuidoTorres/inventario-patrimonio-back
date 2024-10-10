const bcrypt = require('bcrypt');

const encrypt = async (text) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(text, salt);
  return hash;
};

const compare = async (password, hashPassword) => {
  return await bcrypt.compare(password, hashPassword);
};

module.exports = { encrypt, compare };
