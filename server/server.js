'use strict'

const express = require('express')
const app = express()
const fs = require('fs')
const cors = require('cors')
const dotenv = require('dotenv');
const bodyParser = require('body-parser')

// cloudsim module(s)
const csgrant = require('cloudsim-grant')

// resources
const machinetypes = require('./machinetypes')
const sgroup = require('./routes/sgroup')

// MONGO jumbo
require('./models/simulation.js')
require('./models/simulator.js')
const simulator = require('./routes/simulator')

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

mongoose.connect(dbName);

// cloudsim-grant
let adminUser = 'admin'
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN

function details() {
  const date = new Date()
  const version = require('../package.json').version
  const csgrantVersion = require('cloudsim-grant/package.json').version
  const env = app.get('env')

  const s = `
date: ${date}
cloudsim-portal version: ${version}
port: ${port}
cloudsim-grant version: ${csgrantVersion}
admin user: ${adminUser}
environment: ${env}
redis database name: ${permissionDbName}
redis database url: ${process.env.CLOUDSIM_PORTAL_DB}
mongo database name: ${dbName}
mongo database url: ${process.env.CLOUDSIM_PORTAL_DB}
`
  return s
}

console.log('\n')
// write details to the console
console.log('============================================')
console.log(details())
console.log('============================================')
console.log('\n')

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

const initialResources =  {
  'simulators': {},
  'machinetypes': {},
  'sgroups': {}
}

csgrant.init(adminUser,
  initialResources,
  permissionDbName,
  process.env.CLOUDSIM_PORTAL_DB,
  httpServer,
  ()=>{
    console.log( permissionDbName + ' redis database loaded')
  })

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.json())
app.use(cors())

if (!process.env.CLOUDSIM_AUTH_PUB_KEY) {
  console.log('*** WARNING: No cloudsim auth public key found. \
      Did you forget to set "CLOUDSIM_AUTH_PUB_KEY"? ***')
}

simulator.setRoutes(app)
sgroup.setRoutes(app)
machinetypes.setRoutes(app)

app.get('/', function (req, res) {
  const info = details()
  const s = `
    <h1>Cloudsim-portal server</h1>
    <div>Gazebo controller is running</div>
    <pre>
    ${info}
    </pre>
  `
  res.end(s)
})


const Simulators = require('./controllers/simulator');
Simulators.initInstanceStatus();

// Expose app
exports = module.exports = app;

httpServer.listen(port, function(){
  console.log('ssl: ' + useHttps)
  console.log('listening on port ' + port);
})
