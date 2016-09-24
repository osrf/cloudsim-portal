'use strict'

const express = require('express')
const app = express()
const util = require('util')
const fs = require('fs')
const bodyParser = require('body-parser')
const machinetypes = require('./machinetypes')

const cors = require('cors')
const dotenv = require('dotenv');
dotenv.load();

// http server port (as specified in .env, or 4000)
const port = process.env.PORT || 4000

// Load configurations
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Redis
let permissionDbName = 'cloudsim-portal'

// Mongo
const mongoose = require('mongoose');
process.env.CLOUDSIM_PORTAL_DB = process.env.CLOUDSIM_PORTAL_DB || 'localhost'
let dbName = 'mongodb://' + process.env.CLOUDSIM_PORTAL_DB + '/cloudsim-portal'

if (process.env.NODE_ENV === 'test') {
  dbName = dbName + '-test'
  permissionDbName += '-test'
}

var db = mongoose.connect(dbName);

// cloudsim-grant
let adminUser = 'admin'
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN

const csgrant = require('cloudsim-grant');

const initialResources =  {
  'simulators': {},
  'machinetypes': {},
  'sgroups': {}
 }

csgrant.init(adminUser,
 initialResources,
 permissionDbName, ()=>{
  console.log( permissionDbName + ' redis database loaded')
});


console.log('\n\n')
console.log('============================================')
console.log('cloudsim-portal version: ', require('../package.json').version)
console.log('server: ', __filename)
console.log('port: ' + port)
console.log('cloudsim-grant version: ', require('cloudsim-grant/package.json').version)
console.log('admin user: ' + adminUser)
console.log('environment: ' + process.env.NODE_ENV)
console.log('mongo database: ' + dbName)
console.log('redis database: ' + permissionDbName)
console.log('============================================')
console.log('\n\n')

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
      if (!decoded.identities || decoded.identities.length == 0) {
        console.log('Invalid token. No identities provided')
        // return an error
        return res.status(401).send({
            success: false,
            msg: 'No identities field in token.'
        });
      }

      req.identities = decoded.identities;
      next();
    });
  }
  else if (process.env.NODE_ENV === 'test') {

    req.identities = [token] || [adminUser];
    req.user = {};
    req.user.identities = req.identities;
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

machinetypes.setRoutes(app)

// apply the routes to our application with the prefix /api
app.use('/', apiRoutes);

var Simulators = require('./controllers/simulator');
Simulators.initInstanceStatus();

// insert the admin user into the mongo database
var Identities = mongoose.model('Identities');
Identities.loadByIdentitiesname(adminUser, function(err, user) {
  if (err)
    return next(err)
  if (!user) {
    var newIdentities = new Identities({username: userID})
    newIdentities.save()
  }
})

// Expose app
exports = module.exports = app;

httpServer.listen(port, function(){
  console.log('ssl: ' + useHttps)
  console.log('listening on port ' + port);
});

