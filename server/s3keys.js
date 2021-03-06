'use strict'

const parameters = require('parameters-middleware');
const csgrant = require('cloudsim-grant')
const common = require('./common')

// Reads the s3key associated with the given team name
// cb is a callback(err, items)
const getS3Keys = function(identities, cb) {
  csgrant.readAllResourcesForUser(identities, (err, items) => {
    const keys = items.filter((obj)=>{
      return obj.name.indexOf('s3key-') == 0
    })
    cb(null, keys)
  })
}


function setRoutes(app) {

  // Get all S3 keys which this user has permission to
  app.get('/s3keys',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('s3key-'),
    csgrant.allResources)

  // Get a specific S3 key
  app.get('/s3keys/:s3key',
    csgrant.authenticate,
    csgrant.ownsResource(':s3key', true),
    csgrant.resource)

  // Create an S3 key
  app.post('/s3keys',
    csgrant.authenticate,
    csgrant.ownsResource('s3keys', false),
    parameters(
      {body : ['bucket_name', 'access_key', 'secret_key']},
      {message :
        'Missing required fields (bucket_name, access_key, secret_key).'}
    ),
    function(req, res) {

      const resourceData = req.body

      const op = 'create S3 key'
      const error = function(msg) {
        return {
          operation: op,
          success: false,
          error: msg
        }
      }

      const user = req.authorizedIdentity
      csgrant.getNextResourceId('s3key', (err, resourceName) => {

        if(err) {
          res.status(500).jsonp(error(err))
          return
        }

        csgrant.createResource(user, resourceName, resourceData,
          (err, data) => {
            if(err) {
              res.status(500).jsonp(error(err))
              return
            }

            const r = { success: true,
              operation: op,
              result: data,
              id: resourceName}
            res.jsonp(r)
          })
      })
    })

  // Update S3 key
  app.put('/s3keys/:s3key',
    csgrant.authenticate,
    csgrant.ownsResource(':s3key', false),
    function(req, res) {

      const resourceName = req.s3key
      const newData = req.body
      const user = req.authorizedIdentity
      const oldData = req.resourceData

      const futureData = oldData.data
      // merge with existing fields of the newData...
      // thus keeping old fields intact
      for (var attrname in newData) {
        futureData[attrname] = newData[attrname]
      }
      csgrant.updateResource(user, resourceName, futureData, (err, data) => {
        if(err) {
          return res.status(500).jsonp({success: false, error: err})
        }
        res.jsonp({success: true, result: data})
      })
    })

  // Delete an S3 key
  app.delete('/s3keys/:s3key',
    csgrant.authenticate,
    csgrant.ownsResource(':s3key', false),
    function(req, res) {
      const r = {success: false}
      const user = req.user
      const resource = req.s3key
      csgrant.deleteResource(user, resource, (err, data) => {
        if(err) {
          return res.status(500).jsonp({success: false, error: err})
        }
        r.success = true
        r.result = data
        res.jsonp(r)
      })
    })

  // s3key parameter
  app.param('s3key', function( req, res, next, id) {
    req.s3key = id
    next()
  })
}

exports.setRoutes = setRoutes
exports.getS3Keys = getS3Keys