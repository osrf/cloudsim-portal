'use strict'

let express = require('express')
let app = express()
let util = require('util')
let fs = require('fs')
let bodyParser = require('body-parser')

let httpServer = null
let io = null

const cors = require('cors')

var dotenv = require('dotenv');
dotenv.load();

// Load configurations
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log('ENV ' + process.env.NODE_ENV);

let mongoose = require('mongoose');
// Bootstrap db connection
var dbName = 'mongodb://localhost/cloudsim-portal';
if (process.env.NODE_ENV === 'test')
  dbName = dbName + '-test';

console.log('Using database: ' + dbName);
var db = mongoose.connect(dbName);


const useHttps = true
if(useHttps) {
  const keyPath = __dirname + '/key.pem'
  const certPath = __dirname + '/key-cert.pem'
  const privateKey  = fs.readFileSync(keyPath, 'utf8')
  const certificate = fs.readFileSync(certPath, 'utf8')
  httpServer = require('https').Server({key: privateKey, cert: certificate}, app)
}
else {
  httpServer = require('http').Server(app)
}

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.json())
app.use(cors())

io = require('socket.io')(httpServer)

var socketioJwt = require('socketio-jwt');

var xtend = require('xtend');
var jwt = require('jsonwebtoken');
var UnauthorizedError = require('./UnauthorizedError');

const spawn = require('child_process').spawn
const ansi_to_html = require('ansi-to-html')
const ansi2html = new ansi_to_html()

if (!process.env.CLOUDSIM_AUTH_PUB_KEY) {
  console.log('*** WARNING: No cloudsim auth public key found. Did you forget to set "CLOUDSIM_AUTH_PUB_KEY"? ***');
}


console.log('portal server.js')


/*var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
}

function autho(socket) {
    console.log('\n\nautho for new socket')

    var options = {
      // secret: Buffer(JSON.stringify(process.env.CLIENT_SECRET), 'base64'),
      secret: Buffer(JSON.stringify("gzsecret"), 'base64'),
      timeout: 15000 // 15 seconds to send the authentication message
    }

    var server = this.server || socket.server;

    if (!server.$emit) {
      //then is socket.io 1.0
      var Namespace = Object.getPrototypeOf(server.sockets).constructor;
      if (!~Namespace.events.indexOf('authenticated')) {
        Namespace.events.push('authenticated');
      }
    }
    if(options.required){
      var auth_timeout = setTimeout(function () {
        socket.disconnect('unauthorized');
      }, options.timeout || 5000);
    }

    socket.on('authenticate', function (data) {
      console.log('authenticate... token[' + data.token + ']')
      if(options.required){
        clearTimeout(auth_timeout);
      }
      // error handler
      var onError = function(err, code) {
          if (err) {
            code = code || 'unknown';
            var error = new UnauthorizedError(code, {
              message: (Object.prototype.toString.call(err) === '[object Object]' && err.message) ? err.message : err
            });
            socket.emit('unauthorized', error, function() {
              socket.disconnect('unauthorized');
            });
            return; // stop logic, socket will be close on next tick
          }
      };
      if(typeof data.token !== "string") {
        return onError({message: 'invalid token datatype'}, 'invalid_token');
      }

      var onJwtVerificationReady = function(err, decoded) {
        console.log('after token verification')
        // success handler
        var onSuccess = function() {
          console.log('on success decoded: ' + JSON.stringify(decoded))
          socket.decoded_token = decoded;
          socket.emit('authenticated');
          if (server.$emit) {
            server.$emit('authenticated', socket);
          } else {
            //try getting the current namespace otherwise fallback to all sockets.
            var namespace = (server.nsps && socket.nsp &&
                             server.nsps[socket.nsp.name]) ||
                            server.sockets;

            // explicit namespace
            namespace.emit('authenticated', socket);
          }
        };

        console.log('BYPASS!!')
        return onSuccess()

        if (err) {
          console.log('error during validation');
          return onError(err, 'invalid_token');
        }

        if(options.additional_auth && typeof options.additional_auth === 'function') {
          options.additional_auth(decoded, onSuccess, onError);
        } else {
          onSuccess();
        }
      };

      var onSecretReady = function(err, secret) {
        if (err || !secret) {
          return onError(err, 'invalid_secret');
        }
        console.log('secret: ' + secret)
        jwt.verify(data.token, secret, options, onJwtVerificationReady);

      };

      // console.log('call getSecret from socket.on("authenticate")')
      // getSecret(socket.request, options.secret, data.token, onSecretReady);
      console.log('onSecretReady')
      onSecretReady(null, options.secret)
    });
  }

io
  .on('connection', autho )
  .on('authenticated', function(socket){
    console.log('connected & authenticated: ' + JSON.stringify(socket.decoded_token));
    let gzlauncher = {proc:null, output:'', state: 'ready', cmdline:''}

    socket.on('gz-simulatorlauncher', function(msg) {

      console.log('received: ' + JSON.stringify(msg))
		});
	});
*/

// app.use(express.static(__dirname + '../public'));


// Bootstrap models
var models_path = __dirname + '/models';
var walk = function(path) {
    fs.readdirSync(path).forEach(function(file) {
        var newPath = path + '/' + file;
        var stat = fs.statSync(newPath);
        if (stat.isFile()) {
            if (/(.*)\.(js$|coffee$)/.test(file)) {
                require(newPath);
            }
        } else if (stat.isDirectory()) {
            walk(newPath);
        }
    });
};
walk(models_path);

// API ROUTES -------------------

// get an instance of the router for api routes
var apiRoutes = express.Router();

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

  console.log('decoding token');

//  var token = req.body.token;
  var header = req.headers['authorization'] || '';
  var token=header.split(/\s+/).pop()||''

  console.log('token: ' + token);

  // decode token
  if (token) {
    // verify a token
    jwt.verify(token,
      process.env.CLOUDSIM_AUTH_PUB_KEY, function(err, decoded) {
      console.log(util.inspect(decoded))
      if (!decoded.user) {
        console.log('Invalid token. No username provided')
        // return an error
        return res.status(403).send({
            success: false,
            msg: 'No user field in token.'
        });
      }

      req.username = decoded.user;
      next();
    });
  }
  else if (process.env.NODE_ENV === 'test') {
    req.username = 'admin'
    next();
  }
  else {
    // if there is no token
    // return an error
    return res.status(403).send({
        success: false,
        msg: 'No token provided.'
    });
  }

/*  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({
        success: false,
        message: 'No token provided.'
    });

  }*/
});

// Bootstrap routes
var routes_path = __dirname + '/routes';
var walk = function(path) {
    fs.readdirSync(path).forEach(function(file) {
        var newPath = path + '/' + file;
        var stat = fs.statSync(newPath);
        if (stat.isFile()) {
            console.log('## loading: ' + newPath);
            if (/(.*)\.(js$|coffee$)/.test(file)) {
                require(newPath)(apiRoutes);
            }
        // We skip the app/routes/middlewares directory as it is meant to be
        // used and shared by routes as further middlewares and is not a
        // route by itself
        } else if (stat.isDirectory() && file !== 'middlewares') {
            walk(newPath);
        }
    });
};
walk(routes_path);


// apply the routes to our application with the prefix /api
app.use('/', apiRoutes);


// Expose app
exports = module.exports = app;


/*
app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/../public/index.html')
  let s = `
    <h1>Cloudloop portal running</h1>
`
  res.end(s)
})


let sims = []
app.get('/simulations', function (req, res) {

  console.log('body: ' + util.inspect(req.body))
  let s = `
    [{name:'walking', id:'1', score:'1.1'},
     {name:'manipulation', id:'2', score:'2.2'},
     {name:'navigation', id:'3', score:'3.3'}]`

  console.log('/simulations' +  s)
  res.end(s)
})

app.post('/simulation', function(req, res) {

  console.log('body: ' + util.inspect(req.body))
  console.log('query: ' + util.inspect(req.query))

  res.end('{"success":"true"}')
})*/

// app.post('/register', UserRoutes.register)
// app.post('/unregister', UserRoutes.unregister)

let port = 4000
/*if (process.argv.length > 2) {
  // console.log(process.argv[0])
  // console.log(process.argv[1])
  // console.log(process.argv[2])
  port = Number(process.argv[2])
}*/

httpServer.listen(port, function(){

  console.log('ssl: ' + useHttps)
	console.log('listening on *:' + port);
});
