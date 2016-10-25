'use strict';
/// @module simulator_controller
/// Server side simulator controller.

/// Module dependencies.
const uuid = require('node-uuid')
const mongoose = require('mongoose')
const Simulator = mongoose.model('Simulator')
const Simulation = mongoose.model('Simulation')
const fs = require('fs')
const util = require('util')
const csgrant = require('cloudsim-grant')

// initialise cloudServices, depending on the environment
var cloudServices = null;
var useFakeCloudServices = true;
if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  console.log('using the real cloud services!');
  cloudServices = require('../../cloud_services.js');
  useFakeCloudServices = false;
} else {
  console.log(
    'process.env.AWS_ACCESS_KEY_ID not defined: using the fake cloud services');
  cloudServices = require('../../fake_cloud_services.js');
}

var adminResource = 'simulators';
var aws_ssh_key = 'cloudsim';

var sockets = require('../sockets.js');

var instanceList = [];
// status update frequency in ms
//var instanceStatusUpdateInterval = 30000;
var instanceStatusUpdateInterval = 5000;
var instanceIpUpdateInterval = 10000;

if (process.env.NODE_ENV === 'test') {
  instanceStatusUpdateInterval = 1;
  instanceIpUpdateInterval = 1;
}
//var terminatingInstanceList = [];


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
var formatResponse = function(simulator) {
  delete simulator._id;
  delete simulator.__v;
  return simulator;
}

var notifyStatusBySockets = function(simulator, event) {

  if (!simulator.owner || !simulator.owner)
    return;

  var socketUser = simulator.owner;

  // notify owner and users
  sockets.getUserSockets().notifyUser(socketUser, event, simulator);
  for (var i = 0; i < simulator.users.length; ++i) {
    sockets.getUserSockets().notifyUser(
        simulator.users[i].username, event, simulator);
  }
}

/////////////////////////////////////////////////
/// Find Simulator by id
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @param[in] next The next Nodejs function to be executed.
/// @param[in] id ID of the simulator instance to retrieve.
/// @return Simulator instance retrieval function.
exports.simulatorId = function(req, res, next, id) {

  // console.log('simulator param ' + id);

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
  // console.log('simulator controller create')
  // Create a new simulator instance based on the content of the request
  let error
  if (!cloudServices) {
    // Create an error
    error = {error: {
      msg: 'Cloud services are not available'
    }};
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  // create the simulator data
  var simulator = {status: 'LAUNCHING'}
  simulator.region = req.body.region
  simulator.hardware = req.body.hardware
  simulator.image = req.body.machineImage
  if (req.body.sgroup)
    simulator.sgroup = req.body.sgroup
  if (!simulator.region || !simulator.image || !simulator.hardware)
  {
    error = {
      error: {
        msg: 'Missing required fields (machineImage, region, hardware)'
      }
    }
    console.log(error.msg)
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

  // check permission - only users with write access to adminResource
  // can create resources
  csgrant.isAuthorized(req.user, adminResource, false,
    (err, authorized) => {
      if (err) {
        console.log('is authorized error:' + err)
        return res.jsonp({success: false, error: err})
      }
      if (!authorized) {
        const msg = 'insufficient permission for user "'
            + req.user + '"';
        console.log(msg)
        return res.jsonp({success: false, error: msg});
      }
      // add resource to csgrant
      csgrant.createResource(req.user, simulator.id, {},
        (err) => {
          if (err) {
            console.log('create resource error:' + err)
            res.jsonp(error(err));
            return;
          }

          // launch the simulator!
          var tagName = simulator.owner + '_' + simulator.region + '_'
              + Date.now();
          var tag = {Name: tagName};
          var scriptName = 'empty.bash';
          var script = fs.readFileSync(scriptName, 'utf8')

          let sgroups = [awsData.security];
          if (req.body.sgroup)
            sgroups.push(req.body.sgroup)
          cloudServices.launchSimulator(simulator.region, awsData.keyName,
            simulator.hardware, sgroups, simulator.image, tag, script,
            function (err, machine) {
              if (err) {
                // Create an error
                var error = {error: {
                  message: err.message,
                  error: err,
                  awsData: awsData
                }};
                console.log(error.msg)
                res.jsonp(error);
                return;
              }

              var info = machine;
              simulator.machine_id = info.id;

              var sim = new Simulator(simulator);
              sim.save(function(err) {
                if (err) {
                  var error = {error: {
                    msg: 'Error saving simulator'
                  }};
                  console.log(error.msg)
                  res.jsonp(error);
                }
                else {
                  // send json response object to update the
                  // caller with new simulator data.
                  res.jsonp(formatResponse(simulator));

                  // notify via sockets
                  notifyStatusBySockets(sim, 'simulator_launch');

                  setTimeout(function() {
                    cloudServices.simulatorStatus(info, function(err, state) {
                      sim.machine_ip = state.ip;
                      sim.save();
                      // add to monitor list
                      instanceList.push(sim.machine_id);

                      // console.log('instance update: ' + JSON.stringify(sim))

                      // notify via sockets
                      notifyStatusBySockets(sim, 'simulator_status');

                    });
                  }, instanceIpUpdateInterval);
                }
              }); // simulator.save (simulatorInstance)
            });
        });
    });
};

/////////////////////////////////////////////////
// Terminates a simulator.
function terminateSimulator(simulator, cb) {

  var awsRegion = simulator.region;
  var machineInfo = {region: awsRegion,
                     id: simulator.machine_id};

  cloudServices.terminateSimulator(machineInfo, function(err) {
    if(err) {
      cb(err);
    }
    else {
      simulator.status = 'TERMINATING';
      simulator.termination_date = Date.now();
      simulator.save(function(err) {
        if (err) {
          console.log('Error saving sim state after shutdown: ' + err);
          cb(err);
        } else {
          // notify via sockets
          notifyStatusBySockets(simulator, 'simulator_terminate');
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
  var simulatorId = req.simulator.id;

  var error
  if (!simulatorId || simulatorId.length == 0)
  {
    error = {error: {
      msg: 'Missing required fields to destroy simulator'
    }};
    res.jsonp(error);
    return;
  }

  if (!cloudServices) {
    // Create an error
    error = {error: {
      msg: 'Cloud services are not available'
    }};
    res.jsonp(error);
    return;
  }

  Simulator.findOne({id: simulatorId}).exec(
    function(err, simulator) {
      // in case of error, hand it over to the next middleware
      if (err) {
        error = {error: {
          msg: 'Error removing simulator'
        }};
        res.jsonp(error);
        return;
      }

      // If a simulator instance was not found, then return an error
      if (!simulator) {
        error = {error: {
          msg: 'Cannot find simulator'
        }};
        res.jsonp(error);
        return;
      }

      // check permission
      csgrant.isAuthorized(req.user, simulator.id, false,
        (err, authorized) => {
          if (err) {
            return res.jsonp({success: false, error: err})
          }
          if (!authorized) {
            const msg = 'insufficient permission for user "'
                + req.user + '"'
            return res.jsonp({success: false, error: msg})
          }

          // delete resource from csgrant?
          // keep the resource since we only mark it as terminated.
          // user should still be able to see it using /simulators/:id
          // csgrant.deleteResource(req.user, simulator.id, (err, data) => {
          // if (err) {
          //   return res.jsonp({success: false, error: err})
          // }

          // finally terminate the simulator
          terminateSimulator(simulator, function(err) {
            if (err) {
              var error = {error: {
                msg: 'Error terminating simulator'
              }};
              res.jsonp(error);
              return;
            } else {
              res.jsonp(formatResponse(simulator.toObject()));
            }
          });
          // })
        })

    });
};


/////////////////////////////////////////////////
/// Show a simulator.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
exports.show = function(req, res) {

  // check permission
  csgrant.isAuthorized(req.user, req.simulator.id, true,
    (err, authorized) => {
      if (err) {
        return res.jsonp({success: false, error: err})
      }

      if (!authorized) {
        const msg = 'insufficient permission for user "'
            + req.user + '"'
        return res.jsonp({success: false, error: msg})
      }

      res.jsonp(formatResponse(req.simulator.toObject()));
    });
};

/////////////////////////////////////////////////
/// List of simulators for a user.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to get all simulator instances for a user.
exports.all = function(req, res) {

  var all = req.body.all || false;
  var result = [];

  var populateSimulations = function(index, simulators, cb) {
    if (index == simulators.length) {
      return cb(null, result);
    }

    var sim = simulators[index];
    var filter = {simulator: sim};
    Simulation.find(filter)
        .exec(function(err, simulations) {
          if (err) {
            // Do something?
          }
          else {
            result[index] = formatResponse(simulators[index].toObject());
            result[index].simulations = simulations;
            index++;
            populateSimulations(index, simulators, cb);
          }
        });
  }


  // filter simulators based on permission
  var filtered = [];
  var filterSimulators = function(s, simList, cb) {
    if (s == simList.length) {
      return cb(null, filtered);
    }

    // check permission - get simulators that the user has read permission to
    csgrant.isAuthorized(req.user, simList[s].id, true,
      (err, authorized) => {
        if (err) {
          return cb(err, filtered);
        }

        if (authorized) {
          filtered.push(simList[s]);
        }

        s++;
        filterSimulators(s, simList, cb);
      });
  }

  var filter = {};
  if (!all)
    filter = {$where: 'this.status != "TERMINATED"'};

  // Get all simulators
  Simulator.find(filter).sort()
    .exec(function(err, simulators) {
      if (err) {
        var error = {error: {
          msg: 'Error finding simulators'
        }};
        res.jsonp(error);
      } else {

        // filter based on user permission
        filterSimulators(0, simulators, function(err, f){
          if (err) {
            var error = {error: {
              msg: 'Error filtering simulators'
            }};
            res.jsonp(error);
            return;
          }

          // populate with simulations data and send response
          populateSimulations(0, f, function(err, result) {
            if (err) {
              var error = {error: {
                msg: 'Error finding simulations'
              }};
              res.jsonp(error);
            } else {
              res.jsonp(result);
            }
          });
        });
      }
    });
};

/////////////////////////////////////////////////
/// Get user permission on a simulator.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return user permission function
exports.permissions = function(req, res) {
  var responseObj = {};
  var simulatorId = req.body.resource || adminResource;

  // check write permission first
  csgrant.isAuthorized(req.user, simulatorId, false,
    (err, authorized) => {
      if (err) {
        responseObj.success = false;
        responseObj.error = err;
        return res.jsonp(responseObj);
      }
      // check read permission if no write permission
      if (!authorized) {
        csgrant.isAuthorized(req.user, simulatorId, true,
          (err, authorized) => {
            if (err) {
              responseObj.success = false;
              responseObj.error = err;
              return res.jsonp(responseObj);
            }
            responseObj.readOnly = true;
            responseObj.success = authorized;
            res.jsonp(responseObj);
            return;
          });
      }
      else
      {
        responseObj.readOnly = false;
        responseObj.success = true;
        res.jsonp(responseObj);
        return;
      }
    });
}

/////////////////////////////////////////////////
/// Grant user permission.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Grant function
exports.grant = function(req, res) {
  const simulatorId = req.body.resource;
  const grantee = req.body.grantee;
  const readOnly = req.body.readOnly;

  if (!simulatorId || simulatorId.length == 0)
  {
    var error = {error: {
      msg: 'Missing required fields to grant permission'
    }};
    res.jsonp(error);
    return;
  }

  Simulator.findOne({id: simulatorId}).exec(
    function(err, simulator) {
      // in case of error, respond with error msg
      let error
      if (err) {
        error = {error: {
          msg: 'Error removing simulator'
        }};
        res.jsonp(error);
        return;
      }

      // If a simulator instance was not found, then return an error
      if (!simulator && simulatorId !== adminResource) {
        error = {error: {
          msg: 'Cannot find simulator'
        }};
        res.jsonp(error);
        return;
      }

      // check permission - only user with write access can grant permission
      csgrant.isAuthorized(req.user, simulatorId, false,
        (err, authorized) => {
          if (err) {
            return res.jsonp({success: false, error: err})
          }
          if (!authorized) {
            const msg = 'insufficient permission for user "'
                + req.user + '"'
            return res.jsonp({success: false, error: msg})
          }

          // grant the permission
          csgrant.grantPermission(req.user, grantee, simulatorId, readOnly,
            function(err, success, message) {
              if (err) {
                var error = {error: {
                  msg: message
                }};
                res.jsonp(error);
                return;
              }

              // update simulator user permission list
              if (success && simulator) {

                var result = simulator.users.map(
                    function(e){return e.username}).indexOf(grantee);

                if (result >= 0) {
                  simulator.users[result].readOnly = readOnly;
                  // console.log('update user in permission list')
                }
                else {
                  var permission = {username: grantee, readOnly: readOnly};
                  simulator.users.push(permission);
                  // console.log('insert new user to permission list')
                }

                simulator.save();
              }

              req.body.success = success;
              // console.log('grant grantor: ' + req.user + ', grantee: '
              //     + grantee + ', readOnly: ' + readOnly + ', simulator: '
              //     + simulatorId);
              res.jsonp(req.body);
            });
        });
    });
}

/////////////////////////////////////////////////
/// Revoke user permission.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Grant function
exports.revoke = function(req, res) {
  var simulatorId = req.body.resource;
  var grantee = req.body.grantee;
  var readOnly = req.body.readOnly;

  if (!simulatorId || simulatorId.length === 0)
  {
    var error = {error: {
      msg: 'Missing required fields'
    }};
    res.jsonp(error);
    return;
  }

  Simulator.findOne({id: simulatorId}).exec(
    function(err, simulator) {
      // in case of error, respond with error msg
      let error
      if (err) {
        error = {error: {
          msg: 'Error removing simulator'
        }};
        res.jsonp(error);
        return;
      }

      // If a simulator instance was not found, then return an error
      if (!simulator && simulatorId !== adminResource) {
        error = {error: {
          msg: 'Cannot find simulator'
        }};
        res.jsonp(error);
        return;
      }

      // check permission - only user with write access can revoke permission
      csgrant.isAuthorized(req.user, simulatorId, false,
        (err, authorized) => {
          if (err) {
            return res.jsonp({success: false, error: err})
          }
          if (!authorized) {
            const msg = 'insufficient permission for user "'
                + req.user + '"'
            return res.jsonp({success: false, error: msg})
          }

          csgrant.revokePermission(req.user, grantee, simulatorId,
            readOnly, function(err, success, message) {
              if (err) {
                var error = {error: {
                  msg: message
                }};
                res.jsonp(error);
                return;
              }

              // update simulator user permission list
              if (success && simulator) {

                var result = simulator.users.map(
                    function(e){return e.username}).indexOf(grantee);

                if (result >= 0) {
                  simulator.users.splice(result, 1);
                  simulator.save();
                  // console.log('removing user from permission list')
                }
              }

              // console.log('revoke grantor: ' + req.user + ', grantee: '
              //     + grantee + ', readOnly: ' + readOnly + ', simulator: '
              //     + simulatorId);
              req.body.success = success;
              res.jsonp(req.body);
            });
        });
    });
}

/////////////////////////////////////////////////
var updateInstanceStatus = function() {

  if (instanceList.length === 0)
    return;

  var info = {};

  // get region for awsData for now
  info.region = awsData.region;
  // TODO for now just get all instances instead of keeping
  // a local cache of instance list
  // info.machineIds = instanceList;
  info.machineIds = [];

  cloudServices.simulatorStatuses(info, function (err, data) {
    if (err) {
      console.log(util.inspect(err))
      return;
    }

    if (data) {
      // console.log('====');
      // console.log(util.inspect(data.InstanceStatuses));

      var filter = {$where: 'this.status != "TERMINATED"'};
      Simulator.find(filter).exec(
        function(err, simulators) {

          if (simulators.length === 0)
            return;

          for (var i = 0; i < data.InstanceStatuses.length; ++i) {
            var status = data.InstanceStatuses[i];
            var instanceId = status.InstanceId;

            var idx = simulators.map(
              function(e){return e.machine_id}).indexOf(instanceId);

            if (idx >= 0) {
              var sim = simulators[idx];
              var state = status.InstanceState.Name;
              var oldSimStatus = sim.status;

              if (state === 'pending')
                sim.status = 'LAUNCHING';
              else if (state === 'running')
                sim.status = 'RUNNING';
              else if (state === 'shutting-down' || state === 'stopping')
                sim.status = 'TERMINATING';
              else
              {
                if (state === 'terminated' || state === 'stopped')
                  sim.status = 'TERMINATED';
                else {
                  console.log('unknown state ' + state);
                  sim.status = 'UNKNOWN';
                }
                // remove from monitor list
                instanceList.splice(instanceList.indexOf(sim.machine_id), 1);
              }

              // console.log('new status ' + sim.status);
              if (oldSimStatus !== sim.status)
                sim.save();

              // notify via sockets
              notifyStatusBySockets(sim, 'simulator_status');
            }
          }
        });
    }
  });
}

/////////////////////////////////////////////////
exports.initInstanceStatus = function() {

  // clear the array
  instanceList = [];

  var filter = {$where: 'this.status != "TERMINATED"'};
  Simulator.find(filter, function(err, simulators) {
    for (var i = 0; i < simulators.length; ++i) {
      if (simulators[i].machine_id) {
        // don't add fake data if using real aws service
        if (!useFakeCloudServices &&
            simulators[i].machine_id.indexOf('fake') < 0)
          instanceList.push(simulators[i].machine_id);
      }
    }
  });

  console.log('init instance status update');
  setInterval(updateInstanceStatus, instanceStatusUpdateInterval);
}
