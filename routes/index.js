var utils = require('../utils');
var mongoose = require('mongoose');
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
// TODO:
var hms = require('humanize-ms');
var ms = require('ms');
var moment = require('moment');
var execFile = require('child_process').execFile;
var validator = require('validator');

var fileType = require('file-type');
var AdmZip = require('adm-zip');
var fs = require('fs');
var path = require('path');

exports.index = function (req, res, next) {
  Todo.find({}).sort('-updated_at').then(function (todos) {
    res.render('index', {
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      todos: todos,
    });
  }, next);
};

exports.loginHandler = function (req, res, next) {
  const username = req.body.username
  const password = req.body.password

  // Both fields must be plain strings: passing an object here would otherwise
  // reach the query as a Mongo operator (e.g. {"$gt": ""}).
  if (typeof username !== 'string' || typeof password !== 'string' || !validator.isEmail(username)) {
    return res.status(401).send()
  }

  User.findOne({ username: username }).then(function (user) {
    if (!user || !utils.verifyPassword(password, user.password)) {
      return res.status(401).send()
    }

    return adminLoginSuccess(req.body.redirectPage, req.session, username, res)
  }, next);
};

function adminLoginSuccess(redirectPage, session, username, res) {
  session.loggedIn = 1

  // Log the login action for audit
  console.log(`User logged in: ${username}`)

  return res.redirect(utils.safeRedirectPath(redirectPage, '/admin'))
}

exports.login = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: utils.safeRedirectPath(req.query.redirectPage, '')
  });
};

exports.admin = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access Granted',
    granted: true,
  });
};

exports.get_account_details = function(req, res, next) {
  // @TODO need to add a database call to get the profile from the database
  // and provide it to the view to display
 	return res.render('account.hbs', {})
}

exports.save_account_details = function(req, res, next) {
  // get the profile details from the JSON
	const submitted = req.body || {}
  // Only the known profile fields reach the template: rendering the request
  // body as-is lets a "layout" field make hbs include an arbitrary file.
  const field = function (value) {
    return typeof value === 'string' ? value : ''
  }
  const profile = {
    firstname: field(submitted.firstname),
    lastname: field(submitted.lastname),
    country: field(submitted.country),
    phone: field(submitted.phone),
    email: field(submitted.email)
  }
  // validate the input
  if (validator.isEmail(profile.email, { allow_display_name: true })
    // allow_display_name allows us to receive input as:
    // Display Name <email-address>
    // which we consider valid too
    && validator.isMobilePhone(profile.phone, 'he-IL')
    && validator.isAscii(profile.firstname)
    && validator.isAscii(profile.lastname)
    && validator.isAscii(profile.country)
  ) {
    // trim any extra spaces on the right of the name
    profile.firstname = validator.rtrim(profile.firstname)
    profile.lastname = validator.rtrim(profile.lastname)

    // render the view
    return res.render('account.hbs', profile)
  } else {
    // if input validation fails, we just render the view as is
    console.log('error in form details')
    return res.render('account.hbs', {})
  }
}

exports.isLoggedIn = function (req, res, next) {
  if (req.session.loggedIn === 1) {
    return next()
  } else {
    return res.redirect('/')
  }
}

exports.logout = function (req, res, next) {
  req.session.loggedIn = 0
  req.session.destroy(function(err) {
    if (err) return next(err)

    return res.redirect('/')
  })
}

function parse(todo) {
  var t = todo;

  var remindToken = ' in ';
  var reminder = t.toString().indexOf(remindToken);
  if (reminder > 0) {
    var time = t.slice(reminder + remindToken.length);
    time = time.replace(/\n$/, '');

    var period = hms(time);

    console.log('period: ' + period);

    // remove it
    t = t.slice(0, reminder);
    if (typeof period != 'undefined') {
      t += ' [' + ms(period) + ']';
    }
  }
  return t;
}

exports.create = function (req, res, next) {
  // console.log('req.body: ' + JSON.stringify(req.body));

  var item = req.body.content;
  var imgRegex = /\!\[alt text\]\((http.*)\s\".*/;
  if (typeof (item) == 'string' && item.match(imgRegex)) {
    var url = item.match(imgRegex)[1];
    console.log('found img: ' + url);

    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false
    })) {
      return res.status(400).send('Invalid image URL');
    }

    // execFile with an argument array: the URL is passed as a single argv entry
    // and never interpreted by a shell.
    execFile('identify', [url], function (err, stdout, stderr) {
      if (err) {
        console.error('Error running identify on ' + url + ': ' + err.message + ' ' + stderr);
      }
    });

  } else {
    item = parse(item);
  }

  new Todo({
    content: item,
    updated_at: Date.now(),
  }).save().then(function (todo) {
    res.setHeader('Location', '/');
    res.status(302).send(todo.content.toString('base64'));
  }, next);
};

exports.destroy = function (req, res, next) {
  Todo.findById(req.params.id).then(function (todo) {
    if (!todo) return res.status(404).send('Todo not found');

    return todo.deleteOne().then(function () {
      res.redirect('/');
    });
  }, next).catch(next);
};

exports.edit = function (req, res, next) {
  Todo.find({}).sort('-updated_at').then(function (todos) {
    res.render('edit', {
      title: 'TODO',
      todos: todos,
      current: req.params.id
    });
  }, next);
};

exports.update = function (req, res, next) {
  Todo.findById(req.params.id).then(function (todo) {
    if (!todo) return res.status(404).send('Todo not found');

    todo.content = req.body.content;
    todo.updated_at = Date.now();

    return todo.save().then(function () {
      res.redirect('/');
    });
  }, next).catch(next);
};

// ** express turns the cookie key to lowercase **
exports.current_user = function (req, res, next) {

  next();
};

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

exports.import = function (req, res, next) {
  if (!req.files || !req.files.importFile) {
    return res.status(400).send('No files were uploaded.');
  }

  var importFile = req.files.importFile;
  var importedFileType = fileType(importFile.data);
  var zipFileExt = { ext: "zip", mime: "application/zip" };
  if (importedFileType === null) {
    importedFileType = { ext: "txt", mime: "text/plain" };
  }
  if (importedFileType["mime"] !== zipFileExt["mime"]) {
    return importTodos(importFile.data.toString('ascii'), res, next);
  }

  var extracted_path = "/tmp/extracted_files";
  try {
    var zip = new AdmZip(importFile.data);

    // zip-slip: reject archives whose entries resolve outside the extraction
    // directory ("../../etc/cron.d/x", absolute paths, ...) before writing.
    var unsafeEntry = zip.getEntries().find(function (entry) {
      var target = path.resolve(extracted_path, entry.entryName);
      return target !== extracted_path && !target.startsWith(extracted_path + path.sep);
    });
    if (unsafeEntry) {
      return res.status(400).send('Archive contains an illegal entry path: ' + unsafeEntry.entryName);
    }

    zip.extractAllTo(extracted_path, true);
  } catch (e) {
    return next(e);
  }

  fs.readFile(path.join(extracted_path, 'backup.txt'), 'ascii', function (err, data) {
    if (err) {
      if (err.code !== 'ENOENT') return next(err);

      return importTodos('No backup.txt file found', res, next);
    }

    return importTodos(data, res, next);
  });
};

function importTodos(data, res, next) {
  var items = [];
  try {
    data.split('\n').forEach(function (line) {
      var parts = line.split(',');
      var what = parts[0];
      var when = parts[1];
      var locale = parts[2];
      var format = parts[3];
      if (isBlank(what)) return;

      console.log('importing ' + what);
      var item = what;
      if (!isBlank(when) && !isBlank(locale) && !isBlank(format)) {
        console.log('setting locale ' + locale);
        moment.locale(locale);
        var d = moment(when);
        console.log('formatting ' + d);
        item += ' [' + d.format(format) + ']';
      }
      items.push(item);
    });
  } catch (e) {
    return next(e);
  }

  if (items.length === 0) return res.redirect('/');

  Promise.all(items.map(function (item) {
    return new Todo({
      content: item,
      updated_at: Date.now(),
    }).save();
  })).then(function () {
    res.redirect('/');
  }, next);
}

exports.about_new = function (req, res, next) {
  console.log(JSON.stringify(req.query));
  return res.render("about_new.dust",
    {
      layout: false,
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: req.query.device
    });
};

// Prototype Pollution

///////////////////////////////////////////////////////////////////////////////
// In order of simplicity we are not using any database. But you can write the
// same logic using MongoDB.
const users = [
  // You know password for the user.
  { name: 'user', password: 'pwd' },
  // You don't know password for the admin.
  { name: 'admin', password: Math.random().toString(32), canDelete: true },
];

let messages = [];
let lastId = 1;

function findUser(auth) {
  return users.find((u) =>
    u.name === auth.name &&
    u.password === auth.password);
}
///////////////////////////////////////////////////////////////////////////////

exports.chat = {
  get(req, res) {
    res.send(messages);
  },
  add(req, res) {
    const user = findUser(req.body.auth || {});

    if (!user) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    const submitted = req.body.message || {};
    const message = {
      // Default message icon. Cen be overwritten by user.
      icon: typeof submitted.icon === 'string' ? submitted.icon : '👋',
      text: typeof submitted.text === 'string' ? submitted.text : '',
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
    };

    messages.push(message);
    res.send({ ok: true });
  },
  delete(req, res) {
    const user = findUser(req.body.auth || {});

    if (!user || !user.canDelete) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  }
};
