'use strict'

const express = require('express')
const app = express()
const fs = require('fs')
const cors = require('cors')
const dotenv = require('dotenv');
const bodyParser = require('body-parser')
const morgan = require('morgan')
const path = require('path')

// cloudsim module(s)
const csgrant = require('cloudsim-grant')

// resources
const machinetypes = require('./machinetypes')
const sgroups = require('./sgroups')
const simulators = require('./simulators')
const sshkeys = require('./sshkeys')
const srcrounds = require('./src/rounds')
const metrics = require('./metric_configs')

dotenv.load();

// http server port (as specified in .env, or 4000)
const port = process.env.PORT || 4000

// Load configurations
process.env.NODE_ENV = process.env.NODE_ENV || 'development'
process.env.CLOUDSIM_PORTAL_DB = process.env.CLOUDSIM_PORTAL_DB || 'localhost'

// Redis
let permissionDbName = 'cloudsim-portal'

if (process.env.NODE_ENV === 'test') {
  permissionDbName += '-test'
}

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
  const keyPath = __dirname + '/../key.pem'
  const certPath = __dirname + '/../key-cert.pem'
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
  'sgroups': {},
  'srcrounds': {},
  'metrics-configs': {},
  'metrics-configs-000': { "identity": adminUser, "whitelisted": true }
}

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.json())
app.use(cors())

// prints all requests to the terminal, but ignores the swagger api requests.
if (app.get('env') != 'test') {
  app.use(morgan('dev', {
    skip: function (req) {
      // skip /api stuff
      const isApi = req.originalUrl.startsWith('/api/')
      if (isApi) {
        return true
      }
      return false
    }
  }))
}

if (!process.env.CLOUDSIM_AUTH_PUB_KEY) {
  console.log('*** WARNING: No cloudsim auth public key found. \
      Did you forget to set "CLOUDSIM_AUTH_PUB_KEY"? ***')
}

// setup the /permissions routes
csgrant.setPermissionsRoutes(app)

simulators.setRoutes(app)
sgroups.setRoutes(app)
machinetypes.setRoutes(app)
sshkeys.setRoutes(app)
srcrounds.setRoutes(app)
metrics.setRoutes(app)

// a little home page for general info
app.get('/', function (req, res) {
  const info = details()
  const s = `
    <html>
    <body>
    <img src="api/images/cloudsim.svg" style="height: 2em"/>
    <h1>Cloudsim-portal server</h1>
    <div>Cloud service is running</div>
    <pre>
    ${info}
    </pre>
    <a href='/api'>API documentation</a>
    </body>
    </html>
  `
  res.end(s)
})

app.use("/api", express.static(path.join(__dirname, '/../api')))

app.get('/badges/pulls.svg', csgrant.bitbucketBadgeOpenPrs('osrf/cloudsim-portal'))

// start the periodical aws status merge
simulators.initInstanceStatus()

// Expose app
exports = module.exports = app
// Close function to let tests shutdown the server.
app.close = function(cb) {
  console.log('MANUAL SERVER SHUTDOWN')
  const socketsDict = csgrant.sockets.getUserSockets()
  socketsDict.io.close()
  httpServer.close(cb)
}

csgrant.init(adminUser,
  initialResources,
  permissionDbName,
  process.env.CLOUDSIM_PORTAL_DB,
  httpServer,
  ()=>{
    console.log( permissionDbName + ' redis database loaded')
    httpServer.listen(port, function(){
      console.log('ssl: ' + useHttps)
      console.log('listening on port ' + port);
    })
  }
)
