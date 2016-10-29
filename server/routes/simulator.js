'use strict'

const csgrant = require('cloudsim-grant')
// simulator routes use simulator controller
var simulator = require('../controllers/simulator')


exports.setRoutes = function (app) {
  /// GET /simulators
  /// Return all the simulators, running and terminated
  app.get('/simulators',
    csgrant.authenticate,
    csgrant.userResources,
    function (req, res, next) {
      const resources = req.userResources
      req.userResources = resources.filter( (obj)=>{
        if(obj.name.indexOf('simulator-') == 0)
          return true
        return false
      })
      next()
    },
    csgrant.allResources)

  /// DEL /simulators
  /// Delete one simulation instance
  app.delete('/simulators/:resourceId',
    csgrant.authenticate,
    csgrant.ownsResource(':resourceId', false),
    simulator.destroy)

  /// POST /simulators
  /// Create a new simulation
  app.post('/simulators',
    csgrant.authenticate,
    csgrant.ownsResource('simulators', false),
    simulator.create)

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  app.get('/simulators/:resourceId',
   csgrant.authenticate,
   csgrant.ownsResource(':resourceId', true),
   csgrant.resource)
}
