var mongoose = require('mongoose');
var crypto = require('crypto');
var cfenv = require("cfenv");
var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var User = new Schema({
  username: String,
  password: String,
});

mongoose.model('User', User);

// CloudFoundry env vars
var mongoCFUri = cfenv.getAppEnv().getServiceURL('goof-mongo');

// Default Mongo URI is local
const DOCKER = process.env.DOCKER
if (DOCKER === '1') {
  var mongoUri = 'mongodb://goof-mongo/express-todo';
} else {
  var mongoUri = 'mongodb://localhost/express-todo';
}


// CloudFoundry Mongo URI
if (mongoCFUri) {
  mongoUri = mongoCFUri;
} else if (process.env.MONGOLAB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGOLAB_URI;
} else if (process.env.MONGODB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGODB_URI;
}

mongoose.connect(mongoUri);

var adminUsername = process.env.ADMIN_USERNAME || 'admin@snyk.io';

User = mongoose.model('User');
User.find({ username: adminUsername }).exec(function (err, users) {
  if (users && users.length === 0) {
    // no admin seeded yet: use the configured password or a throwaway random one
    var adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('hex');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('ADMIN_PASSWORD is not set, seeding admin user with a random password');
    }
    new User({ username: adminUsername, password: adminPassword }).save(function (err, user, count) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  }
});