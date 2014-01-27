var querystring = require("querystring");
var https = require('https');
var _ = require('underscore');
var crypto = require("crypto");

_.mixin({
  // compact for objects
  compactObject: function(to_clean) {
    _.map(to_clean, function(value, key, to_clean) {
      if (value === undefined) {
        delete to_clean[key];
      }
    });
    return to_clean;
  }
});  

var getAssets = function(pair) {
  assets = pair.toUpperCase().split('_');
  return assets;
}

var CEXIO = function(pair, clientId, key, secret) {
  this.pair = pair;
  this.clientId = clientId;
  this.key = key;
  this.secret = secret;
  var self = this;
  _.each(_.functions(self), function(f) {
    self[f] = _.bind(self[f], self);
  });
}

CEXIO.prototype._request = function(method, path, data, callback, args) {
  if (data) {
    contentLength = data.length;
  } else {
    contentLength = 0;
  }
  var options = {
    host: 'cex.io',
    path: path,
    method: method,
    headers: {
      'User-Agent': 'Mozilla/4.0 (Node.js CEXIO client)',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': contentLength
    }
  };
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    var buffer = '';
    res.on('data', function(data) {
      buffer += data;
    });
    res.on('end', function() {
      try {
        var json = JSON.parse(buffer);
      } catch (err) {
        return callback(err);
      }
      if (json.error) {
        callback(json.error);
      } else {
        callback(null, json);
      }
    });
  });
  req.on('error', function(err) {
    callback(err);
  });
  req.setTimeout(60000, function() {
    req.abort();
  });
  req.end(data);
}

CEXIO.prototype._get = function(action, pair, callback, args) {
  args = _.compactObject(args);
  var path;
  if (pair) {
    assets = getAssets(pair);
    path = '/api/' + action + '/' + assets[0] + '/' + assets[1];
  } else {
    path = '/api/' + action;
  }
  path += '/?' + querystring.stringify(args);
  this._request('get', path, undefined, callback, args);
}

CEXIO.prototype._post = function(action, pair, callback, args) {
  if(!this.key)
    return callback('Must provide key to make this API request.');
  var path;
  if (pair) {
    assets = getAssets(pair);
    path = '/api/' + action + '/' + assets[0] + '/' + assets[1] + '/';
  } else {
    path = '/api/' + action + '/';
  }
  var nonce = new Date().getTime();
  args = _.extend({nonce: nonce, key: this.key}, args);
  args = _.compactObject(args);
  var message = nonce.toString() + this.clientId + this.key;
  var hmac = crypto.createHmac("sha256", new Buffer(this.secret));
  hmac.update(message);
  signature = hmac.digest("hex").toUpperCase();
  args.signature = signature;
  var data = querystring.stringify(args);
  this._request('post', path, data, callback, args);
}

// 
// Public API
// 

CEXIO.prototype.trades = function(options, callback) {
  if(!callback) {
    callback = options;
    options = undefined;
  }
  this._get('trade_history', this.pair, callback, options);
}

CEXIO.prototype.ticker = function(callback) {
  this._get('ticker', this.pair, callback);
}

CEXIO.prototype.order_book = function(callback) {
  this._get('order_book', this.pair, callback);
}

CEXIO.prototype.balance = function(callback) {
  this._post('balance', null, callback);
}

CEXIO.prototype.open_orders = function(callback) {
  this._post('open_orders', this.pair, callback);
}

CEXIO.prototype.cancel_order = function(id, callback) {
  this._post('cancel_order', null, callback, {id: id});
}

CEXIO.prototype.place_order = function(type, amount, price, callback) {
  this._post('place_order', this.pair, callback, {type: type, amount: amount, price: price});
}


module.exports = CEXIO;
