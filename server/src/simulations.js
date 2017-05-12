'use strict'

const common = require('../common')
const csgrant = require('cloudsim-grant')

// when false, log output is suppressed
exports.showLog = false

// log to console
function log(str, o) {
  if (exports.showLog) {
    console.log(str, o)
  }
}

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
    csgrant.ownsResource(':srcsimulation', false),
    function(req, res) {

      const user = req.user
      const id = req.srcsimulation
      const newData = req.body
      // update simulation data
      // this triggers websocket notifications
      log("new data", newData)
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


  // srcsimulation route parameter
  app.param('srcsimulation', function(req, res, next, id) {
    req.srcsimulation = id
    next()
  })
}


// Create simulation data resource. The src-admins will be granted
//  write access. The team will have read access. During practice, we don't
// prevent the user from updating the data (e.g. score) since they are the owner
// of the resource. In the final competition, src-admins will be the one
// creating this resource so only they can update the data.
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
