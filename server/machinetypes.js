'use strict'

const parameters = require('parameters-middleware');
const csgrant = require('cloudsim-grant')
const common = require('./common')

function setRoutes(app) {
  // Get all machine types which this user has permission to
  app.get('/machinetypes',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('machinetype-'),
    csgrant.allResources)

  // Get a specific machine type
  app.get('/machinetypes/:machinetype',
    csgrant.authenticate,
    csgrant.ownsResource(':machinetype', true),
    csgrant.resource)

  // Create a new machine type
  app.post('/machinetypes',
    csgrant.authenticate,
    csgrant.ownsResource('machinetypes', false),
    parameters(
      {body : ['name', 'region', 'hardware', 'image']},
      {message : 'Missing required fields (name, region, hardware, image).'}
    ),
    function(req, res) {

      const resourceData = req.body

      const op = 'create machine type'
      const error = function(msg) {
        return {operation: op,
          success: false,
          error: msg}
      }

      const user = req.authorizedIdentity
      csgrant.getNextResourceId('machinetype', (err, resourceName) => {

        if(err) {
          res.jsonp(error(err))
          return
        }

        csgrant.createResource(user, resourceName, resourceData,
          (err, data) => {
            if(err) {
              res.jsonp(error(err))
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

  // Update a machine type
  app.put('/machinetypes/:machinetype',
    csgrant.authenticate,
    csgrant.ownsResource(':machinetype', false),
    function(req, res) {

      const resourceName = req.machinetype
      const newData = req.body
      const user = req.authorizedIdentity
      const oldData = req.resourceData

      const futureData = oldData.data
      // merge with existing fields of the newData... thus keeping old fields intact
      for (var attrname in newData) {
        futureData[attrname] = newData[attrname]
      }
      csgrant.updateResource(user, resourceName, futureData, (err, data) => {
        if(err) {
          return res.jsonp({success: false, error: err})
        }
        res.jsonp({success: true, result: data})
      })
    })

  // Delete a machine type
  app.delete('/machinetypes/:machinetype',
    csgrant.authenticate,
    csgrant.ownsResource(':machinetype', false),
    function(req, res) {
      const r = {success: false}
      const user = req.user  // from previous middleware
      const resource = req.machinetype // from app.param (see below)
      csgrant.deleteResource(user, resource, (err, data) => {
        if(err) {
          return res.jsonp({success: false, error: err})
        }
        r.success = true
        r.result = data
        // success
        res.jsonp(r)
      })
    })

  // machine type route parameter
  app.param('machinetype', function( req, res, next, id) {
    req.machinetype = id
    next()
  })
}

exports.setRoutes = setRoutes
