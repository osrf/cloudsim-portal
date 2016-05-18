'use strict';

// Simulations routes use Simulations controller
var Simulations = require('../controllers/simulation');

var mongoose = require('mongoose');
var User = mongoose.model('User');


// Simulation authorization helpers
var authenticateUser = function(req, res, next) {

  var userID = req.username;
  console.log('sim authenticate user: ' + userID);

  if (!userID)
    return res.status(401).send('User is not found');

  User.loadByUsername(userID, function(err, user) {
    if (err)
      return next(err);
    if (!user)
      return next(new Error('Failed to load User ' + userID));
    req.user = user;
    next();
  });
};


module.exports = function(router) {
  /// GET /simulations
  /// Return all the simulations, running and terminated
  router.get('/simulations', authenticateUser, Simulations.all);

  /// DEL /simulations/:simulationId
  /// Delete one simulation instance
  router.delete('/simulations', authenticateUser, Simulations.destroy);

  /// POST /simulations
  /// Create a new simulation
  router.post('/simulations', authenticateUser, Simulations.create);

  /// GET /simulations/:simulationId
  /// Return properties for one simulation
  router.get('/simulations/:simulationId', authenticateUser, Simulations.show);

  /// PUT /simulations/:simulationId
  /// Modify one simulation
  // router.put('/simulations/:simulationId', authenticateUser, Simulations.update);

  /// DEL /simulations/:simulationId
  /// Delete one simulation instance
  // router.delete('/simulations/:simulationId', authenticateUser, Simulations.destroy);

  /// Finish with setting up the simulationId param
  router.param('simulationId', Simulations.simulation);
};
