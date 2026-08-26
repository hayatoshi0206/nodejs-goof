const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const mongoose = require('mongoose');

// Register lightweight fake models in mongoose's registry so routes/index.js
// can be unit-tested without a MongoDB connection.
function Todo(doc) { Object.assign(this, doc); }
function User(doc) { Object.assign(this, doc); }
mongoose.modelSchemas.Todo = new mongoose.Schema({});
mongoose.modelSchemas.User = new mongoose.Schema({});
mongoose.models.Todo = Todo;
mongoose.models.User = User;

const routes = require('../../routes');

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    rendered: null,
    redirectedTo: null,
    sent: undefined,
    ended: false,
    render(view, locals) { res.rendered = { view, locals }; return res; },
    redirect(url) { res.redirectedTo = url; return res; },
    status(code) { res.statusCode = code; return res; },
    send(payload) { res.sent = payload; return res; },
    setHeader(name, value) { res.headers[name] = value; },
  };
  return res;
}

function stubTodoFind(todos) {
  Todo.find = () => ({
    sort: () => ({
      exec: (cb) => cb(null, todos),
    }),
  });
}

describe('index', () => {
  test('renders the todo list', () => {
    const todos = [{ content: 'a' }];
    stubTodoFind(todos);
    const res = mockRes();

    routes.index({}, res, () => {});

    assert.strictEqual(res.rendered.view, 'index');
    assert.strictEqual(res.rendered.locals.todos, todos);
    assert.strictEqual(res.rendered.locals.title, 'Patch TODO List');
  });
});

describe('loginHandler', () => {
  test('responds 401 when username is not an email', () => {
    const res = mockRes();
    routes.loginHandler({ body: { username: 'not-an-email', password: 'x' } }, res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });

  test('responds 401 when credentials do not match a user', () => {
    User.find = (query, cb) => cb(null, []);
    const res = mockRes();
    routes.loginHandler({ body: { username: 'a@b.com', password: 'wrong' } }, res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });

  test('logs the session in and redirects to /admin by default', () => {
    User.find = (query, cb) => cb(null, [{ username: 'a@b.com' }]);
    const req = { body: { username: 'a@b.com', password: 'pw' }, session: {} };
    const res = mockRes();

    routes.loginHandler(req, res, () => {});

    assert.strictEqual(req.session.loggedIn, 1);
    assert.strictEqual(res.redirectedTo, '/admin');
  });

  test('redirects to redirectPage when provided', () => {
    User.find = (query, cb) => cb(null, [{ username: 'a@b.com' }]);
    const req = {
      body: { username: 'a@b.com', password: 'pw', redirectPage: '/somewhere' },
      session: {},
    };
    const res = mockRes();

    routes.loginHandler(req, res, () => {});

    assert.strictEqual(res.redirectedTo, '/somewhere');
  });
});

describe('login / admin views', () => {
  test('login renders the admin view without access granted', () => {
    const res = mockRes();
    routes.login({ query: { redirectPage: '/next' } }, res, () => {});
    assert.strictEqual(res.rendered.view, 'admin');
    assert.strictEqual(res.rendered.locals.granted, false);
    assert.strictEqual(res.rendered.locals.redirectPage, '/next');
  });

  test('admin renders the admin view with access granted', () => {
    const res = mockRes();
    routes.admin({}, res, () => {});
    assert.strictEqual(res.rendered.view, 'admin');
    assert.strictEqual(res.rendered.locals.granted, true);
  });
});

describe('account details', () => {
  test('get_account_details renders the account view', () => {
    const res = mockRes();
    routes.get_account_details({}, res, () => {});
    assert.strictEqual(res.rendered.view, 'account.hbs');
  });

  test('save_account_details renders the trimmed profile when input is valid', () => {
    const res = mockRes();
    const req = {
      body: {
        email: 'a@b.com',
        phone: '0501234567',
        firstname: 'John  ',
        lastname: 'Doe  ',
        country: 'IL',
      },
    };

    routes.save_account_details(req, res, () => {});

    assert.strictEqual(res.rendered.view, 'account.hbs');
    assert.strictEqual(res.rendered.locals.firstname, 'John');
    assert.strictEqual(res.rendered.locals.lastname, 'Doe');
  });

  test('save_account_details renders without profile when input is invalid', () => {
    const res = mockRes();
    const req = {
      body: {
        email: 'not-an-email',
        phone: '123',
        firstname: 'John',
        lastname: 'Doe',
        country: 'IL',
      },
    };

    routes.save_account_details(req, res, () => {});

    assert.strictEqual(res.rendered.view, 'account.hbs');
    assert.strictEqual(res.rendered.locals, undefined);
  });
});

describe('session helpers', () => {
  test('isLoggedIn calls next when logged in', () => {
    let called = false;
    routes.isLoggedIn({ session: { loggedIn: 1 } }, mockRes(), () => { called = true; });
    assert.strictEqual(called, true);
  });

  test('isLoggedIn redirects to / when not logged in', () => {
    const res = mockRes();
    routes.isLoggedIn({ session: {} }, res, () => {});
    assert.strictEqual(res.redirectedTo, '/');
  });

  test('logout clears the session and redirects to /', () => {
    const req = { session: { loggedIn: 1, destroy(cb) { cb(); } } };
    const res = mockRes();
    routes.logout(req, res, () => {});
    assert.strictEqual(req.session.loggedIn, 0);
    assert.strictEqual(res.redirectedTo, '/');
  });

  test('current_user calls next', () => {
    let called = false;
    routes.current_user({}, mockRes(), () => { called = true; });
    assert.strictEqual(called, true);
  });
});

describe('create', () => {
  beforeEach(() => {
    Todo.prototype.save = function (cb) {
      cb(null, { content: Buffer.from(String(this.content)) }, 1);
    };
  });

  test('parses reminder syntax and responds 302 with base64 content', () => {
    const res = mockRes();

    routes.create({ body: { content: 'buy milk in 10 minutes' } }, res, () => {});

    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(res.headers.Location, '/');
    const decoded = Buffer.from(res.sent, 'base64').toString();
    assert.strictEqual(decoded, 'buy milk [10m]');
  });

  test('saves plain content unchanged', () => {
    const res = mockRes();

    routes.create({ body: { content: 'plain item' } }, res, () => {});

    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(Buffer.from(res.sent, 'base64').toString(), 'plain item');
  });
});

describe('edit / update / destroy', () => {
  test('edit renders the edit view with the current id', () => {
    const todos = [{ content: 'a' }];
    stubTodoFind(todos);
    const res = mockRes();

    routes.edit({ params: { id: '42' } }, res, () => {});

    assert.strictEqual(res.rendered.view, 'edit');
    assert.strictEqual(res.rendered.locals.current, '42');
    assert.strictEqual(res.rendered.locals.todos, todos);
  });

  test('update saves the new content and redirects', () => {
    let saved;
    Todo.findById = (id, cb) => cb(null, {
      save(cb2) { saved = this.content; cb2(null, this, 1); },
    });
    const res = mockRes();

    routes.update({ params: { id: '1' }, body: { content: 'updated' } }, res, () => {});

    assert.strictEqual(saved, 'updated');
    assert.strictEqual(res.redirectedTo, '/');
  });

  test('destroy removes the todo and redirects', () => {
    let removed = false;
    Todo.findById = (id, cb) => cb(null, {
      remove(cb2) { removed = true; cb2(null, this); },
    });
    const res = mockRes();

    routes.destroy({ params: { id: '1' } }, res, () => {});

    assert.strictEqual(removed, true);
    assert.strictEqual(res.redirectedTo, '/');
  });
});

describe('import', () => {
  test('responds with a message when no files are uploaded', () => {
    const res = mockRes();
    routes.import({}, res, () => {});
    assert.strictEqual(res.sent, 'No files were uploaded.');
  });

  test('imports todos from a plain-text upload and redirects', () => {
    const contents = [];
    Todo.prototype.save = function (cb) {
      contents.push(String(this.content));
      cb(null, this, 1);
    };
    const res = mockRes();
    const req = {
      files: { importFile: { data: Buffer.from('first\nsecond\n') } },
    };

    routes.import(req, res, () => {});

    assert.deepStrictEqual(contents, ['first', 'second']);
    assert.strictEqual(res.redirectedTo, '/');
  });
});

describe('about_new', () => {
  test('renders the about view with the device query param', () => {
    const res = mockRes();
    routes.about_new({ query: { device: 'mobile' } }, res, () => {});
    assert.strictEqual(res.rendered.view, 'about_new.dust');
    assert.strictEqual(res.rendered.locals.device, 'mobile');
  });
});

describe('chat', () => {
  const auth = { name: 'user', password: 'pwd' };

  test('add rejects unauthenticated requests', () => {
    const res = mockRes();
    routes.chat.add({ body: {} }, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.sent.ok, false);
  });

  test('add stores a message with defaults and metadata', () => {
    const res = mockRes();
    routes.chat.add({ body: { auth, message: { text: 'hello' } } }, res);
    assert.deepStrictEqual(res.sent, { ok: true });

    const getRes = mockRes();
    routes.chat.get({}, getRes);
    const message = getRes.sent[getRes.sent.length - 1];
    assert.strictEqual(message.text, 'hello');
    assert.strictEqual(message.userName, 'user');
    assert.strictEqual(message.icon, '👋');
    assert.ok(message.id >= 1);
    assert.ok(message.timestamp > 0);
  });

  test('delete rejects users without delete permission', () => {
    const res = mockRes();
    routes.chat.delete({ body: { auth, messageId: 1 } }, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.sent.ok, false);
  });

  test('delete rejects unauthenticated requests', () => {
    const res = mockRes();
    routes.chat.delete({ body: { messageId: 1 } }, res);
    assert.strictEqual(res.statusCode, 403);
  });
});
