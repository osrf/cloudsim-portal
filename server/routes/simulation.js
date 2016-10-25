'use strict';

// Simulations routes use Simulations controller
var Simulations = require('../controllers/simulation');

module.exports = function(router) {
  /// GET /simulations
  /// Return all the simulations, running and terminated
  router.get('/simulations', Simulations.all);

  /// DEL /simulations/:simulationId
  /// Delete one simulation instance
  router.delete('/simulations', Simulations.destroy);

  /// POST /simulations
  /// Create a new simulation
  router.post('/simulations', Simulations.create);

  /// GET /simulations/:simulationId
  /// Return properties for one simulation
  router.get('/simulations/:simulationId', Simulations.show);

  /// Finish with setting up the simulationId param
  router.param('simulationId', Simulations.simulation);
};
