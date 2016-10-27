'use strict';

const csgrant = require('cloudsim-grant')
// Simulators routes use Simulators controller
var Simulators = require('../controllers/simulator');


exports.setRoutes = function (app) {
  /// GET /simulators
  /// Return all the simulators, running and terminated
  app.get('/simulators',
    csgrant.authenticate,
    Simulators.all)

  /// DEL /simulators
  /// Delete one simulation instance
  app.delete('/simulators/:simulatorId',
    csgrant.authenticate,
    csgrant.ownsResource(':simulatorId'),
    Simulators.destroy)

  /// POST /simulators
  /// Create a new simulation
  app.post('/simulators',
    csgrant.authenticate,
function (req, res, next) {
  console.log('POST /simulators, body:', req.body)
  next()
},
    csgrant.ownsResource('simulators'),
    Simulators.create)

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  app.get('/simulators/:simulatorId',
   csgrant.authenticate,
   csgrant.ownsResource(':simulatorId'),
   Simulators.show);

  /// POST /permissions
  /// Grant permission for a resource.
  app.post('/permissions',
    csgrant.authenticate,
    Simulators.grant);

  /// DEL /permissions
  /// Revoke permissions for a resource.
  app.delete('/permissions',
    csgrant.authenticate,
    Simulators.revoke);

  /// query user permissions for all resources
  app.get('/permissions',
    csgrant.authenticate,
    csgrant.userResources,
    csgrant.allResources)

  /// query permissions for a single resource
  app.get('/permissions/:resourceId',
    csgrant.authenticate,
    csgrant.ownsResource(':resourceId', true),
    csgrant.resource)

  /// Finish with setting up the simulationId param
  app.param('simulatorId', Simulators.simulatorId);

  /// param for resource name
  app.param('resourceId', function( req, res, next, id) {
    req.resourceId = id
    next()
  })

}
