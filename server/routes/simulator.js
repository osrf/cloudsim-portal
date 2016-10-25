'use strict';

const csgrant = require('cloudsim-grant')
// Simulators routes use Simulators controller
var Simulators = require('../controllers/simulator');

module.exports = function(router) {

  /// GET /simulators
  /// Return all the simulators, running and terminated
  router.get('/simulators', Simulators.all);

  /// DEL /simulators
  /// Delete one simulation instance
  router.delete('/simulators/:simulatorId', Simulators.destroy);

  /// POST /simulators
  /// Create a new simulation
  router.post('/simulators', Simulators.create);

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  router.get('/simulators/:simulatorId', Simulators.show);

  /// POST /permissions
  /// Grant permission for a resource.
  router.post('/permissions', Simulators.grant);

  /// DEL /permissions
  /// Revoke permissions for a resource.
  router.delete('/permissions', Simulators.revoke);

  /// query user permissions for all resources
  router.get('/permissions',
    csgrant.authenticate,
    csgrant.userResources,
    csgrant.allResources)

  /// query permissions for a single resource
  router.get('/permissions/:resourceId', csgrant.authenticate,
    csgrant.ownsResource(':resourceId', true), csgrant.resource)

  /// Finish with setting up the simulationId param
  router.param('simulatorId', Simulators.simulatorId);

  /// param for resource name
  router.param('resourceId', function( req, res, next, id) {
    req.resourceId = id
    next()
  })

}
