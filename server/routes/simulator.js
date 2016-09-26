'use strict';

const csgrant = require('cloudsim-grant')
// Simulators routes use Simulators controller
var Simulators = require('../controllers/simulator');

var mongoose = require('mongoose');
var Identities = mongoose.model('Identities');


// Simulation authorization helpers
var authenticateIdentities = function(req, res, next) {
  var userID = req.username;
  // console.log('sim authenticate user: ' + userID);

  if (!userID)
    return res.status(401).send('Identities is not found');

  // TODO grant user permission is not implemented yet so let any one
  // who's authorized and has valid token launch a simulator
  Identities.loadByIdentitiesname(userID, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      var newIdentities = new Identities({username: userID});
      newIdentities.save(function() {
        req.user = newIdentities;
        next();
      });
    }
    else {
      req.user = user;
      next();
    }
  });
};


module.exports = function(router) {

  /// GET /simulators
  /// Return all the simulators, running and terminated
  router.get('/simulators', authenticateIdentities, Simulators.all);

  /// DEL /simulators
  /// Delete one simulation instance
  router.delete('/simulators/:simulatorId', authenticateIdentities, Simulators.destroy);

  /// POST /simulators
  /// Create a new simulation
  router.post('/simulators', authenticateIdentities, Simulators.create);

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  router.get('/simulators/:simulatorId', authenticateIdentities, Simulators.show);

  /// POST /permissions
  /// Grant permission for a resource.
  router.post('/permissions', authenticateIdentities, Simulators.grant);

  /// DEL /permissions
  /// Revoke permissions for a resource.
  router.delete('/permissions', authenticateIdentities, Simulators.revoke);

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
