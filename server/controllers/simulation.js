'use strict';
/// @module simulation_controller
/// Server side simulation controller.

/// Module dependencies.
const uuid = require('node-uuid')
const mongoose = require('mongoose')
const Simulation = mongoose.model('Simulation')
const Simulator = mongoose.model('Simulator')
const util = require('util');

/////////////////////////////////////////////////
/// format json response object
var formatResponse = function(simulation)
{
  delete simulation._id;
  delete simulation.__v;
  return simulation;
}


/////////////////////////////////////////////////
/// Find Simulation by id
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @param[in] next The next Nodejs function to be executed.
/// @param[in] id ID of the simulation instance to retrieve.
/// @return Simulation instance retrieval function.
exports.simulation = function(req, res, next, id) {

  console.log('simulation param ' + id);

  Simulation.load(id, function(err, simulation) {
    // in case of error, hand it over to the next middleware
    if (err) return next(err);

    // If a simulation instance was not found, then return an error
    if (!simulation) {
      // Create an error
      var error = {error: {
        msg: 'Cannot find simulation'
      }};
      res.jsonp(error);
      return;
//        return next(new Error('Failed to load simulation ' + id));
    }

    // Add the new simulation to the request object
    // for future reference
    req.simulation = simulation;

    // hand over control to the next middleware
    next();
  });
};

/////////////////////////////////////////////////
/// Create a simulation
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Simulation create function.
exports.create = function(req, res) {

  // Create a new simulation instance based on the content of the
  // request
  console.log(util.inspect(req.body));

  // TODO verify permission!
  Simulator.load(req.body.simulator_id, function(err, simulator) {
    var error;
    if (err) {
      // Create an error
      error = {error: {
        msg: 'Error creating simulation'
      }};
      res.jsonp(error);
    }
    else if (!simulator) {
      // Create an error
      error = {error: {
        msg: 'Cannot find simulator',
        id: req.body.simulator_id
      }};
      res.jsonp(error);
    }
    else {
      if (simulator.owner != req.user)
      {
        console.log('not the owner!');
        // Create an error
        error = {error: {
          msg: 'Cannot create simulation. Permission denied',
          id: req.body.simulator_id
        }};
        res.jsonp(error);
        return;
      }

      var simulation = {state: 'RUNNING'};
      simulation.scenario = req.body.scenario;
      simulation.task = req.body.task;
      simulation.owner = req.user;
      simulation.start_date = new Date();
      simulation.end_date = null;
      simulation.simulator = simulator;
      simulation.id = uuid.v4();
      var sim = new Simulation(simulation);
      sim.save(function(err) {
        if (err) {
          // Create an error
          var error = {error: {
            msg: 'Cannot save simulation'
          }};
          res.jsonp(error);
        } else {
          res.jsonp(formatResponse(simulation));
        }
      }); // simulation.save
    }
  });
};

/////////////////////////////////////////////////
/// Update a simulation
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object
/// @return Simulation update function.
exports.update = function(/*req, res*/) {

  // TODO verify permission!

/*  // Get the simulation from the request
  var simulation = req.simulation;

  if (simulation.state === 'Terminated') {
    // don't rewrite history, just return.
    res.jsonp(simulation);
    return;
  }

  // Check if the update operation is to terminate a simulation
 if (req.body.state !== simulation.state &&
    req.body.state === 'Terminated') {
    exports.terminate(req, res);
    return;
  }

  // Check to make sure the region is not modified.
  if (req.body.region && simulation.region !== req.body.region) {
    // Create an error message.
    var error = {error: {
        msg: 'Cannot change the region of a running simulation',
        id: req.simulation.sim_id
    }};

    // Can't change the world.
    res.jsonp(error);
    return;
  }

  // use the lodash library to populate each
  // simulation attribute with the values in the
  // request body
  simulation = _.extend(simulation, req.body);

  // Save the updated simulation to the database
  simulation.save(function(err) {
    if (err) {
      // Create an error message.
      var error = {error: {
          msg: 'Cannot update simulation',
          id: req.simulation.sim_id
      }};
      res.jsonp(error);
    } else {
        res.jsonp(simulation);
//            sockets.getUserSockets().notifyUser(req.user.id,
//                                            'simulation_update',
//                                             {data:simulation});
    }
  });*/
};

/////////////////////////////////////////////////
/// Delete a simulation.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Destroy function
exports.destroy = function(req, res) {
  // Get the simulation model
  var simulationId = req.body.id;
  // Remove the simulation model from the database
  // TODO: We need to check to make sure the simulation instance has been
  // terminated

  if (!simulationId || simulationId.length == 0)
  {
    var error = {error: {
      msg: 'Missing required fields'
    }};
    res.jsonp(error);
    return;
  }

  Simulation.findOne({id: simulationId}, function(err, simulation) {
    // in case of error, hand it over to the next middleware
    var error
    if (err) {
      error = {error: {
        msg: 'Error removing simulation'
      }};
      res.jsonp(error);
      return;
    }

    // If a simulator instance was not found, then return an error
    if (!simulation) {
      error = {error: {
        msg: 'Cannot find simulation'
      }};
      res.jsonp(error);
      return;
    }

    simulation.remove(function(err) {
      if (err) {
        // Create an error
        error = {error: {
          msg: 'Error removing simulation'
        }};
        res.jsonp(error);
      } else {
        res.jsonp(formatResponse(simulation.toObject()));
      }
    });

  });
};


/////////////////////////////////////////////////
/// Show a simulation.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
exports.show = function(req, res) {
  res.jsonp(req.simulation);
};

/////////////////////////////////////////////////
/// List of simulations for a user.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to get all simulation instances for a user.
exports.all = function(req, res) {

  var filter = {owner: req.user};

  // Get all simulation models, in creation order, for a user
  Simulation.find(filter).sort()
    .exec(function(err, simulations) {
      if (err) {
        // Create an error
        // var error = {error: {
        //   msg: 'Error finding simulations'
        // }};
      }
      else {
        var result = [];
        for (var i = 0; i < simulations.length; ++i) {
          result.push(formatResponse(simulations[i].toObject()));
        }
        res.jsonp(result);
      }
    });
};
