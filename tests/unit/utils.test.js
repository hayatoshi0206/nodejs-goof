const { test, describe } = require('node:test');
const assert = require('node:assert');

const utils = require('../../utils');

describe('utils.ran_no', () => {
  test('returns an integer within [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const n = utils.ran_no(3, 7);
      assert.ok(Number.isInteger(n));
      assert.ok(n >= 3 && n <= 7);
    }
  });

  test('returns min when min equals max', () => {
    assert.strictEqual(utils.ran_no(5, 5), 5);
  });
});

describe('utils.uid', () => {
  test('returns a string of the requested length', () => {
    assert.strictEqual(utils.uid(16).length, 16);
    assert.strictEqual(utils.uid(1).length, 1);
  });

  test('returns an empty string for length 0', () => {
    assert.strictEqual(utils.uid(0), '');
  });

  test('only contains alphanumeric characters', () => {
    assert.match(utils.uid(100), /^[A-Za-z0-9]+$/);
  });
});

describe('utils.forbidden', () => {
  test('sends a 403 plain-text Forbidden response', () => {
    const headers = {};
    let body;
    const res = {
      statusCode: null,
      setHeader(name, value) { headers[name] = value; },
      end(payload) { body = payload; },
    };

    utils.forbidden(res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(headers['Content-Type'], 'text/plain');
    assert.strictEqual(headers['Content-Length'], 'Forbidden'.length);
    assert.strictEqual(body, 'Forbidden');
  });
});
