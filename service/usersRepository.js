var typeorm = require('typeorm');

module.exports = {

  getUsersRepository: function () {
    return typeorm.getConnection('mysql').getRepository('Users');
  }
};
