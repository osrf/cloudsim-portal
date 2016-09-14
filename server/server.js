'use strict'

let express = require('express')
let app = express()
let util = require('util')
let fs = require('fs')
let bodyParser = require('body-parser')

const cors = require('cors')

var dotenv = require('dotenv');
dotenv.load();

// http server port (as specified in .env, or 4000)
const port = process.env.PORT || 4000

// Load configurations
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log('ENV ' + process.env.NODE_ENV);

var adminUser = 'admin';
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN;

// redis
let permissionDbName = 'cloudsim-portal';

// Mongo
let mongoose = require('mongoose');
let dbName = 'mongodb://localhost/cloudsim-portal';

if (process.env.CLOUDSIM_PORTAL_DB)
  dbName = 'mongodb://' + process.env.CLOUDSIM_PORTAL_DB + '/cloudsim-portal';

if (process.env.NODE_ENV === 'test') {
  dbName = dbName + '-test'
  permissionDbName += '-test'
}
console.log('Using mongo database: ' + dbName)
console.log('Using redis database: ' + permissionDbName)
var db = mongoose.connect(dbName);

// cloudsim-grant
var adminResource = 'simulators_list';
const csgrant = require('cloudsim-grant');
csgrant.init(adminUser, {'simulators_list': {}, 'sgroup': {} }, permissionDbName, ()=>{
  console.log( permissionDbName + ' redis database loaded')
});

console.log('\n\ncloudsim-grant version', require('cloudsim-grant/package.json').version)


// server
let httpServer = null
const useHttps = false
if(useHttps) {
  const keyPath = __dirname + '/key.pem'
  const certPath = __dirname + '/key-cert.pem'
  const privateKey  = fs.readFileSync(keyPath, 'utf8')
  const certificate = fs.readFileSync(certPath, 'utf8')
  httpServer = require('https').Server(
      {key: privateKey, cert: certificate}, app)
}
else {
  httpServer = require('http').Server(app)
}

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.json())
app.use(cors())

// socket io
let io = require('socket.io')(httpServer)
let userSockets = require('./sockets')
userSockets.init(io);

// var UnauthorizedError = require('./UnauthorizedError');

// const spawn = require('child_process').spawn

var auth_pub_key ='';
if (!process.env.CLOUDSIM_AUTH_PUB_KEY) {
  console.log('*** WARNING: No cloudsim auth public key found. \
      Did you forget to set "CLOUDSIM_AUTH_PUB_KEY"? ***');
}
else {
  auth_pub_key = '' + process.env.CLOUDSIM_AUTH_PUB_KEY;
  auth_pub_key = auth_pub_key.replace(/\\n/g, "\n");
  process.env.CLOUDSIM_AUTH_PUB_KEY = auth_pub_key;
}

console.log('portal server.js')

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

  var header = req.headers['authorization'] || '';
  var token=header.split(/\s+/).pop()||''

  // console.log('  token: ' + token);

  // decode token
  if (token && process.env.NODE_ENV !== 'test') {

    csgrant.verifyToken(token, (err, decoded) => {
    // verify a token
      if (err) {
        console.log('Error: ' + err.message)

        // return an error
        return res.status(401).send({
            success: false,
            msg: 'Couldn\'t verify token: ' + err.message
        });
      }
      console.log(util.inspect(decoded))
      if (!decoded.username) {
        console.log('Invalid token. No username provided')
        // return an error
        return res.status(401).send({
            success: false,
            msg: 'No user field in token.'
        });
      }

      req.username = decoded.username;
      next();
    });
  }
  else if (process.env.NODE_ENV === 'test') {

    req.username = token || adminUser;
    req.user = {};
    req.user.username = req.username;
    next();
  }
  else {
    // if there is no token
    // return an error
    return res.status(401).send({
        success: false,
        msg: 'No token provided.'
    });
  }
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


var Simulators = require('./controllers/simulator');
Simulators.initInstanceStatus();

var User = mongoose.model('User');
User.loadByUsername(adminUser, function(err, user) {
  if (err)
    return next(err);
  if (!user) {
    var newUser = new User({username: userID});
    newUser.save();
  }
});


// Expose app
exports = module.exports = app;

httpServer.listen(port, function(){
  console.log('ssl: ' + useHttps)
  console.log('listening on port ' + port);
});
