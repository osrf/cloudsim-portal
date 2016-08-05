'use strict';

// Simulators routes use Simulators controller
var Simulators = require('../controllers/simulator');

var mongoose = require('mongoose');
var User = mongoose.model('User');


// Simulation authorization helpers
var authenticateUser = function(req, res, next) {

  var userID = req.username;
  // console.log('sim authenticate user: ' + userID);

  if (!userID)
    return res.status(401).send('User is not found');

  // TODO grant user permission is not implemented yet so let any one
  // who's authorized and has valid token launch a simulator
  User.loadByUsername(userID, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      var newUser = new User({username: userID});
      newUser.save(function() {
        req.user = newUser;
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
  router.get('/simulators', authenticateUser, Simulators.all);

  /// DEL /simulators
  /// Delete one simulation instance
  router.delete('/simulators', authenticateUser, Simulators.destroy);

  /// POST /simulators
  /// Create a new simulation
  router.post('/simulators', authenticateUser, Simulators.create);

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  router.get('/simulators/:simulatorId', authenticateUser, Simulators.show);

  /// POST /permissions
  /// Grant permission for a resource.
  router.post('/permissions', authenticateUser, Simulators.grant);
  /// DEL /permissions
  /// Revoke permissions for a resource.
  router.delete('/permissions', authenticateUser, Simulators.revoke);


  /// query user permissions for a simulator
  router.get('/users/permissions', authenticateUser,
      Simulators.permissions);
  /// Finish with setting up the simulationId param
  router.param('simulatorId', Simulators.simulatorId);
};
