'use strict'

const fs = require('fs')
const archiver = require('archiver')
const csgrant = require('cloudsim-grant')
const zip = require('./zip')

const log = console.log

// initialise cloudServices, depending on the environment
let cloudServices = null

if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  cloudServices = require('../cloud_services.js')
} else {
  cloudServices = require('../fake_cloud_services.js')
}

// The AWS server information
const awsDefaults = {
  region : 'us-west-1',
  keyName : 'cloudsim',
}

// Sets the routes for downloading the keys
// app: the express app
// keysFilePath: the full path to the keys.zip file
function setRoutes(app) {
  console.log('sshkeys setRoutes')

  app.get('/sshkeys/:sshkey',
    // user must have valid token (in req.query)
    csgrant.authenticate,
    // user must have access to 'downloads' resource
    // this middleware will set req.resourceData
    csgrant.ownsResource(':sshkey', false),
    // this middleware sets the file download information from
    // the resource in req.resourceData
    function(req,res, next) {
      const localPath = '/tmp/' + req.resourceName
      const zipContents = {'cloudsim.pem' : req.resourceData.data.ssh}
      zip.compressTextFilesToZip(localPath, zipContents, (err)=>{
        if(err) {
          throw err
        }
        // setup the download
        req.fileInfo = { path: localPath ,
          type: 'application/zip',
          name: 'keys.zip'
        }
        next()
      })
    },
    // with a req.fileInfo in place, this middleware will
    // download the file from the disk
    csgrant.downloadFilePath
  )


  // create vpn key resource
  app.post('/sshkeys',
    csgrant.authenticate,
    // you can create a key if you can create a simulation
    csgrant.ownsResource('simulators', false),
    function (req, res) {
      const op = 'create ssh Key'
      const user = req.user
      const keyName = req.body.name

      const error = function(msg) {
        return {operation: op,
          success: false,
          error: msg}
      }

      console.log('ssh key name: ' + keyName)
      console.log('user: ' + user)

      if (!keyName || keyName.length === 0) {
        res.jsonp(error('Invalid key name: ' + keyName))
        return
      }
      // reserve a resource name, we'll use it with aws
      csgrant.getNextResourceId('sshkey', (err, resourceName)=>{
        if (err) {
          res.jsonp(error(err))
          return
        }
        // generate the key using the resource name
        const region = cloudServices.awsDefaults.region
        cloudServices.generateKey(resourceName, region, (err, sshkeyData )=>{
          if(err) {
            res.jsonp(error(err))
            return
          }
          // save key to db
          const data = {
            keyname: keyName,
            ssh: sshkeyData
          }
          csgrant.createResource(req.user, resourceName, data, (err)=>{
            if(err) {
              res.jsonp(error(err))
              return
            }
              // key is saved
            let r = { success: true,
              operation: op,
              // not returning the key data because of security concerns
              result: {name: keyName},
              id: resourceName,
              requester: req.user
            }
            res.jsonp(r)

          })
        })
      })
  })

  // route parameter for ssh key
  app.param('sshkey', function( req, res, next, id) {
    req.sshkey = id
    next()
  })
}

exports.setRoutes = setRoutes
