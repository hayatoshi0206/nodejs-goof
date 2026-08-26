var mongoose = require('mongoose');
var cfenv = require("cfenv");
var crypto = require('crypto');
var utils = require('./utils');
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
console.log(JSON.stringify(cfenv.getAppEnv()));

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

console.log("Using Mongo URI " + mongoUri);

mongoose.connection.on('error', function (err) {
  console.error('MongoDB connection error:', err);
});

User = mongoose.model('User');

mongoose.connect(mongoUri)
  .then(function () {
    return User.findOne({ username: 'admin@snyk.io' });
  })
  .then(function (admin) {
    if (admin) return;

    console.log('no admin');
    var adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('ADMIN_PASSWORD is not set, generated admin password: ' + adminPassword);
    }

    return new User({ username: 'admin@snyk.io', password: utils.hashPassword(adminPassword) }).save();
  })
  .catch(function (err) {
    console.error('Failed to connect to MongoDB at ' + mongoUri + ' or seed the admin user:', err);
  });