'use strict'

const common = require('../common')
const csgrant = require('cloudsim-grant')

// global variables and settings
const srcAdmin = 'src-admins'

function setRoutes(app) {

  // Get all simulation data for a user
  app.get('/srcsimulations',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('srcsimulations-'),
    csgrant.allResources)

  app.get('/srcsimulations/:srcsimulation',
    csgrant.authenticate,
    csgrant.ownsResource(':srcsimulation', true),
    csgrant.resource)

  // Update simulation data
  app.put('/srcsimulations/:srcsimulation',
    csgrant.authenticate,
    csgrant.ownsResource(':srcsimulation'),
    function(req, res) {

      const user = req.user
      const id = req.srcsimulation
      const newData = req.body
      // update simulation data
      // this triggers websocket notifications

      csgrant.updateResource(user, id, newData, (err, data) => {
        let r = {
          success: false
        }
        if (err) {
          r.error = err
          return res.status(500).jsonp(r)
        }
        r.success =  true
        r.result = data
        res.jsonp(r)
      })
    })


  // srcround route parameter
  app.param('srcsimulation', function(req, res, next, id) {
    req.srcsimulation = id
    next()
  })
}


// Create simulation data resource. The src-admins will be granted
//  write access. The team will have read access.
const createSimulationData = function(user, team, resource, cb) {
  csgrant.createResourceWithType(user, 'srcsimulations', resource,
  (err, data, resourceName) => {

    if (err)
      return cb({error: err})

    // Give all admins write access to simulation data
    csgrant.grantPermission(user, srcAdmin, resourceName, false,
    (err) => {
      if (err) {
        return cb ({error: err})
      }

      // Give team read access
      csgrant.grantPermission(user, team, resourceName, true, (err) => {
        if (err)
          return cb({error: err})

        return cb({result: data, id: resourceName, success: true})
      })
    })
  })
}

exports.setRoutes = setRoutes
exports.createSimulationData = createSimulationData
