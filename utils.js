var crypto = require('crypto');

var SCRYPT_KEYLEN = 64;

module.exports = {

  // Passwords are stored as "<salt hex>:<scrypt hash hex>" so that a database
  // dump never exposes usable credentials.
  hashPassword : function ( password ){
    var salt = crypto.randomBytes( 16 );
    var hash = crypto.scryptSync( String( password ), salt, SCRYPT_KEYLEN );

    return salt.toString( 'hex' ) + ':' + hash.toString( 'hex' );
  },

  verifyPassword : function ( password, stored ){
    if( typeof password !== 'string' || typeof stored !== 'string' ){
      return false;
    }

    var parts = stored.split( ':' );
    if( parts.length !== 2 ){
      return false;
    }

    var salt = Buffer.from( parts[ 0 ], 'hex' );
    var expected = Buffer.from( parts[ 1 ], 'hex' );
    if( expected.length !== SCRYPT_KEYLEN ){
      return false;
    }

    var actual = crypto.scryptSync( password, salt, SCRYPT_KEYLEN );

    return crypto.timingSafeEqual( actual, expected );
  },

  // Only same-origin, non protocol-relative paths are allowed as redirect
  // targets, so a crafted ?redirectPage cannot send users off-site.
  safeRedirectPath : function ( target, fallback ){
    if( typeof target !== 'string' || !/^\/[^/\\]/.test( target )){
      return fallback;
    }

    return target;
  },

  ran_no : function ( min, max ){
    return Math.floor( Math.random() * ( max - min + 1 )) + min;
  },

  uid : function ( len ){
    var str     = '';
    var src     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var src_len = src.length;
    var i       = len;

    for( ; i-- ; ){
      str += src.charAt( this.ran_no( 0, src_len - 1 ));
    }

    return str;
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  }
};
