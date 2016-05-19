'use strict';
/// @module simulator_controller
/// Server side simulator controller.

/// Module dependencies.
var uuid = require('node-uuid');
var mongoose = require('mongoose'),
    Simulator = mongoose.model('Simulator'),
    Simulation = mongoose.model('Simulation'),
    fs = require('fs'),
    _ = require('lodash');

var util = require('util');

// initialise cloudServices, depending on the environment
var cloudServices = null;
if (process.env.AWS_ACCESS_KEY_ID) {
  console.log('using the real cloud services!');
  cloudServices = require('../../cloud_services.js');
} else {
  console.log('process.env.AWS_ACCESS_KEY_ID not defined: using the fake cloud services');
//    cloudServices = require('../lib/fake_cloud_services.js');
}

var aws_ssh_key = 'cloudsim';

////////////////////////////////////
// The AWS server information
var awsData = { desc: 'Trusty + nvidia (CUDA 7.5)',
               region : 'us-west-1',
               keyName : aws_ssh_key,
               hardware : 'g2.2xlarge',
               security : 'cloudsim-sim',
//               image : 'ami-610c7801'}
               image : 'ami-d8e996b8'}



/////////////////////////////////////////////////
/// format json response object
var formatResponse = function(simulator)
{
  delete simulator._id;
  delete simulator.__v;
  return simulator;
}

/////////////////////////////////////////////////
/// Find Simulator by id
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @param[in] next The next Nodejs function to be executed.
/// @param[in] id ID of the simulator instance to retrieve.
/// @return Simulator instance retrieval function.
exports.simulatorId = function(req, res, next, id) {

  console.log('simulator param ' + id);

  Simulator.load(id, function(err, simulator) {
    // in case of error, hand it over to the next middleware
    if (err) return next(err);

    // If a simulator instance was not found, then return an error
    if (!simulator) {
      // Create an error
      var error = {error: {
        msg: 'Cannot find simulator'
      }};
      res.jsonp(error);
//        return next(new Error('Failed to load simulator ' + id));
    }

    // Add the new simulator to the request object
    // for future reference
    req.simulator = simulator;

    // hand over control to the next middleware
    next();
  });
};


/////////////////////////////////////////////////
/// Create a simulator
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Simulator create function.
exports.create = function(req, res) {

  // Create a new simulator instance based on the content of the
  // request
  console.log(util.inspect(req.body));

  if (!cloudServices) {
    // Create an error
    var error = {error: {
      msg: 'Cloud services are not available'
    }};
    res.jsonp(error);
    return;
  }

  // TODO verify permission!

  var simulator = {status: 'LAUNCHING'};
  simulator.region = req.body.region;

  if (!simulator.region)
  {
    var error = {error: {
      msg: 'Missing required fields'
    }};
    res.jsonp(error);
    return;
  }

  // Set the simulator user
  simulator.owner = req.user;
  simulator.launch_date = new Date();
  simulator.termination_date = null;
  simulator.machine_ip = '';
  simulator.machine_id = '';
  simulator.id = uuid.v4();

  var tagName = simulator.owner.username + '_' + simulator.region + '_' + Date.now();
  var tag = {Name: tagName};
  var scriptName = 'empty.bash';
  var script = fs.readFileSync(scriptName, 'utf8')

  console.log(util.inspect(awsData));

  cloudServices.launchSimulator(simulator.region, awsData.keyName, awsData.hardware, awsData.security, awsData.image, tag, script, function (err, machine) {
    if (err) {
      // Create an error
      var error = {error: {
        msg: 'Error launching a cloud instance'
      }};
      res.jsonp(error);
      return;
    }

    var info = machine;
    console.log('machine: ' + info.id);
    console.log(util.inspect(info));

    simulator.machine_id = info.id;

    var sim = new Simulator(simulator);
    sim.save(function(err) {
      if (err) {
        var error = {error: {
          msg: 'Error saving simulator'
        }};
        res.jsonp(error);
      } else {

        // send json response object to update the
        // caller with new simulator data.
        res.jsonp(formatResponse(simulator));

        setTimeout(function() {
          cloudServices.simulatorStatus(info, function(err, state) {
            console.log('sim status: ' + sim.id);
            console.log(util.inspect(state));
            sim.machine_ip = state.ip;
            sim.save();
          });
        }, 10000);
      }
    }); // simulator.save (simulatorInstance)
  });
};

/////////////////////////////////////////////////
/// Update a simulator
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object
/// @return Simulator update function.
exports.update = function(req, res) {

  // TODO verify permission!

/*  // Get the simulator from the request
  var simulator = req.simulator;

  if (simulator.state === 'Terminated') {
    // don't rewrite history, just return.
    res.jsonp(simulator);
    return;
  }

  // Check if the update operation is to terminate a simulator
 if (req.body.state !== simulator.state &&
    req.body.state === 'Terminated') {
    exports.terminate(req, res);
    return;
  }

  // Check to make sure the region is not modified.
  if (req.body.region && simulator.region !== req.body.region) {
    // Create an error message.
    var error = {error: {
        msg: 'Cannot change the region of a running simulator',
        id: req.simulator.sim_id
    }};

    // Can't change the world.
    res.jsonp(error);
    return;
  }

  // use the lodash library to populate each
  // simulator attribute with the values in the
  // request body
  simulator = _.extend(simulator, req.body);

  // Save the updated simulator to the database
  simulator.save(function(err) {
    if (err) {
      // Create an error message.
      var error = {error: {
          msg: 'Cannot update simulator',
          id: req.simulator.sim_id
      }};
      res.jsonp(error);
    } else {
        res.jsonp(simulator);
//            sockets.getUserSockets().notifyUser(req.user.id,
//                                            'simulator_update',
//                                             {data:simulator});
    }
  });*/
};


/////////////////////////////////////////////////
// Terminates a simulator.
function terminateSimulator(simulator, cb) {

  var awsRegion = simulator.region;
  var machineInfo = {region: awsRegion,
                     id: simulator.machine_id};

  cloudServices.terminateSimulator(machineInfo, function(err, info) {
    if(err) {
      cb(err);
    } else {
      simulator.status = 'TERMINATED';
      simulator.termination_date = Date.now();
      simulator.save(function(err) {
        if (err) {
          console.log('Error saving sim state after shutdown: ' + err);
          cb(err);
        } else {
          var msg = 'Simulator terminated: ';
          msg += util.inspect(info);
          console.log(msg);
          // notify everyone
//          sockets.getUserSockets().notifyUser(simulation.user.id,
//                                              'simulation_terminate',
//                                              {data:simulation});
          cb(null, simulator);
        }
      });
    }
  }); // terminate
}


/////////////////////////////////////////////////
/// Delete a simulator.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Destroy function
exports.destroy = function(req, res) {
  var simulatorId = req.body.id;

  if (!simulatorId || simulatorId.length == 0)
  {
    var error = {error: {
      msg: 'Missing required fields'
    }};
    res.jsonp(error);
    return;
  }

  if (!cloudServices) {
    // Create an error
    var error = {error: {
      msg: 'Cloud services are not available'
    }};
    res.jsonp(error);
    return;
  }

  Simulator.findOne({owner: req.user, id: simulatorId}, function(err, simulator) {
    // in case of error, hand it over to the next middleware
    if (err) {
      var error = {error: {
        msg: 'Error removing simulator'
      }};
      res.jsonp(error);
      return;
    }

    // If a simulator instance was not found, then return an error
    if (!simulator) {
      var error = {error: {
        msg: 'Cannot find simulator'
      }};
      res.jsonp(error);
      return;
    }

    terminateSimulator(simulator, function(err, sim) {
        if(err) {
          var error = {error: {
            msg: 'Error terminating simulator'
          }};
          res.jsonp(error);
          return;
        } else {
          res.jsonp(formatResponse(simulator.toObject()));
        }
    });


/*    // Remove the simulator model from the database
    // TODO: We need to check to make sure the simulator instance has been
    // terminated
    simulator.remove(function(err) {
        if (err) {
          var error = {error: {
            msg: 'Error removing simulator'
          }};
          res.jsonp(error);
        } else {
          res.jsonp(formatResponse(simulator.toObject()));
        }
    });
*/
  });
};


/////////////////////////////////////////////////
/// Show a simulator.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
exports.show = function(req, res) {
  res.jsonp(formatResponse(req.simulator.toObject()));
};

/////////////////////////////////////////////////
/// List of simulators for a user.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to get all simulator instances for a user.
exports.all = function(req, res) {

  var result = [];

  var populateSimulations = function(index, simulators, res) {
//    console.log('populating simulations ' + index);
    if (index == simulators.length) {
      res.jsonp(result);
      return;
    }

    var sim = simulators[index];
    var filter = {owner: req.user, simulator: sim};
    Simulation.find(filter)
        .exec(function(err, simulations) {
          if (err) {}
          else {
//            console.log('filling simulations ' + index);
            result[index] = formatResponse(simulators[index].toObject());
            result[index].simulations = simulations;
            index++;
            populateSimulations(index, simulators, res);
          }
        });
  }

  var filter = {owner: req.user, $where: 'this.status != "TERMINATED"'};

  // Get all simulator models, in creation order, for a user
  Simulator.find(filter).sort().populate('owner', 'username')
    .exec(function(err, simulators) {
      if (err) {
          var error = {error: {
            msg: 'Error finding simulators'
          }};
          res.jsonp(error);
      } else {
        populateSimulations(0, simulators, res)
      }
  });

/*  var filter = {owner: req.user}

  // Get all simulator models, in creation order, for a user
  Simulation.find(filter).sort().populate('owner', 'username').populate('simulator')
    .exec(function(err, simulations) {
      if (err) {
          var error = {error: {
            msg: 'Error finding simulations'
          }};
          res.jsonp(error);
      } else {
        res.jsonp(simulations);
      }
  });
*/
};
