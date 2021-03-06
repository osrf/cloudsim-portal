'use strict'

const csgrant = require('cloudsim-grant')
const zip = require('./zip')
const common = require('./common')

const log = function(){} // console.log

// initialise cloudServices, depending on the environment
let cloudServices = null

if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  cloudServices = require('./cloud_services.js')
} else {
  cloudServices = require('./fake_cloud_services.js')
}

// Sets the routes for downloading the keys
// app: the express app
// keysFilePath: the full path to the keys.zip file
function setRoutes(app) {
  console.log('sshkeys setRoutes')

  // list all resources
  app.get('/sshkeys',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('sshkey-'),
    csgrant.allResources)

  app.get('/sshkeys/:sshkey',
    // user must have valid token (in req.query)
    csgrant.authenticate,
    // user must have write access to download the resource
    // this middleware will set req.resourceData
    csgrant.ownsResource(':sshkey', false),
    // this middleware sets the file download information from
    // the resource in req.resourceData
    function(req,res, next) {
      const zipName = 'keys.zip'
      const zipPath = '/tmp/' + zipName
      const keyData = req.resourceData.data.ssh
      zip.zipSshKey(zipName, 'cloudsim.pem', keyData, (err)=>{
        if(err) {
          throw err
        }
        // setup the download
        req.fileInfo = { path: zipPath ,
          type: 'application/zip',
          name: zipName
        }
        next()
      })
    },
    // with a req.fileInfo in place, this middleware will
    // download the file from the disk
    csgrant.downloadFilePath
  )

  // create ssh key resource
  app.post('/sshkeys',
    csgrant.authenticate,
    // you can create a key if you can create a simulation
    csgrant.ownsResource('simulators', false), function (req, res) {
      // Call implementation function
      let opts = req.body
      let user = req.user
      createImpl(user, opts, function(resp) {
        if (resp.error)
          return res.status(400).jsonp(resp)
        // Send response
        res.jsonp(resp);
      })
    })

  // Delete ssh key
  app.delete('/sshkeys/:sshkey',
    csgrant.authenticate,
    csgrant.ownsResource(':sshkey', false),
    function(req, res) {
      log('delete sshkey "' + req.resourceName + '"')
      const r = {success: false}
      const user = req.user  // from previous middleware
      const resource = req.resourceName // from app.param (see below)
      const error = function(err) {
        res.status(500).jsonp({success: false, error: err})
      }
      csgrant.deleteResource(user, resource, (err) => {
        if(err) {
          return error(err)
        }
        const region = cloudServices.awsDefaults.region
        // remove key from AWS
        cloudServices.deleteKey(req.resourceData.data.keyName, region, (err)=> {
          if(err) {
            return error(err)
          }
          r.success = true
          r.result = req.resourceData
          res.jsonp(r)
        })
      })
    })

  // route parameter for ssh key
  app.param('sshkey', function( req, res, next, id) {
    req.sshkey = id
    next()
  })
}

/// Implementation for the create function. This doesn't finish the response.
const createImpl = function(user, opts, cb) {
  const op = 'create ssh Key'
  const keyName = opts.name

  // function to report errors
  const error = function(msg) {
    cb({operation: op,
      success: false,
      error: msg})
  }

  log('ssh key name: ' + keyName)
  log('user: ' + user)
  if (!keyName || keyName.length === 0) {
    return error('Invalid key name: ' + keyName)
  }
  // reserve a resource name, we'll use it with aws
  csgrant.getNextResourceId('sshkey', (err, resourceName)=>{
    if (err) {
      return error(err)
    }
    // generate the key using the resource name
    const region = cloudServices.awsDefaults.region
    cloudServices.generateKey(keyName, region, (err, sshkeyData )=>{
      if (err) {
        return error(err)
      }
      // save key to db
      const data = {
        keyname: keyName,
        ssh: sshkeyData
      }
      csgrant.createResource(user, resourceName, data, (err)=>{
        if(err) {
          return error(err)
        }
          // key is saved
        let r = { success: true,
          operation: op,
          // not returning the key data because of security concerns
          result: {name: keyName},
          id: resourceName,
          requester: user
        }
        // success
        cb(r)
      })
    })
  })
}


exports.setRoutes = setRoutes

exports.create = createImpl
