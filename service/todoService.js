var mongoose = require('mongoose');

function getTodoModel() {
  return mongoose.model('Todo');
}

module.exports = {

  findAllTodos: function (cb) {
    getTodoModel().
      find({}).
      sort('-updated_at').
      exec(cb);
  },

  findTodoById: function (id, cb) {
    getTodoModel().findById(id, cb);
  },

  createTodo: function (content, cb) {
    new (getTodoModel())({
      content: content,
      updated_at: Date.now(),
    }).save(cb);
  }
};
