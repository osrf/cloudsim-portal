'use strict'
/// @module simulator_controller
/// Server side simulator controller.

/// Module dependencies.
const util = require('util')
const csgrant = require('cloudsim-grant')

// initialise cloudServices, depending on the environment
var cloudServices = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  console.log('using the real cloud services!');
  cloudServices = require('../cloud_services.js');
} else {
  console.log(
    'process.env.AWS_ACCESS_KEY_ID not defined: using the fake cloud services');
  cloudServices = require('../fake_cloud_services.js');
}

// global variables and settings
var instanceStatusUpdateInterval = 5000;
var instanceIpUpdateInterval = 10000;

if (process.env.NODE_ENV === 'test') {
  // reduce delays during testing
  instanceStatusUpdateInterval = 1;
  instanceIpUpdateInterval = 1;
}
//var terminatingInstanceList = [];


// The AWS server information
const awsDefaults = {
  region : 'us-west-1',
  keyName : 'cloudsim',
  security : 'cloudsim-sim',
  script: 'cloudsim_env.bash'
}

/// Create a simulator
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Simulator create function.
const create = function(req, res) {
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
  simulator.image = req.body.image
  if (req.body.sgroup)
    simulator.sgroup = req.body.sgroup
  if (!simulator.region || !simulator.image || !simulator.hardware)
  {
    error = {
      error: {
        msg: 'Missing required fields (image, region, hardware)'
      }
    }
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  // Set the simulator user
  simulator.creator = req.user;
  simulator.launch_date = new Date();
  simulator.termination_date = null;
  simulator.machine_ip = '';
  simulator.machine_id = '';

  csgrant.getNextResourceId('simulator', (err, resourceName) => {
    if(err) {
      res.jsonp(error(err))
      return
    }
    simulator.id = resourceName
    // add resource to csgrant
    csgrant.createResource(req.user, simulator.id, simulator,
      (err) => {
        if (err) {
          console.log('create resource error:' + err)
          res.jsonp(error(err));
          return;
        }

        // launch the simulator!
        const tagValue = resourceName + '_' + req.user
        const tag = {Name: tagValue}
        // use a script that will pass on the username,
        const scriptTxt = cloudServices.generateScript(req.user)
        let sgroups = [awsDefaults.security];
        if (req.body.sgroup)
          sgroups.push(req.body.sgroup)
        cloudServices.launchSimulator(
          simulator.region,
          awsDefaults.keyName,
          simulator.hardware,
          sgroups,
          simulator.image,
          tag,
          scriptTxt,
          function (err, machine) {
            if (err) {
              // Create an error
              const  error = {
                error: {
                  message: err.message,
                  error: err,
                  simulator: simulator
                }
              }
              console.log(error.msg)
              res.jsonp(error);
              return;
            }
            const info = machine;
            simulator.machine_id = info.id;
            // send json response object to update the
            // caller with new simulator data.
            res.jsonp(simulator)

            // update resource (this triggers socket notification)
            csgrant.updateResource(req.user, simulator.id, simulator, ()=>{
              console.log(simulator.id, 'launch!')
            })

            setTimeout(function() {
              cloudServices.simulatorStatus(info, function(err, state) {
                // update resource (this triggers socket notification)
                simulator.machine_ip = state.ip
                csgrant.updateResource(req.user, simulator.id, simulator, ()=>{
                  console.log(simulator.id, 'ip:', simulator.machine_ip)
                })

              })
            }, instanceIpUpdateInterval);
          })
      })
  })
}

// Terminates a simulator.
function terminateSimulator(user, simulator, cb) {

  var machineInfo = {region: simulator.region,
    id: simulator.machine_id};
  cloudServices.terminateSimulator(machineInfo, function(err) {
    if(err) {
      cb(err)
    }
    else {
      simulator.status = 'TERMINATING';
      simulator.termination_date = Date.now();
      // update resource (this triggers socket notification)
      csgrant.updateResource(user, simulator.id, simulator, ()=>{
        console.log(simulator.id, 'terminate')
      })
      cb(null, simulator)
    }
  }) // terminate
}


function getUserFromResource(resource) {
  const permissions = resource.permissions
  // look for a user with read/write
  let user
  for (let u in permissions) {
    if (!permissions[u].readOnly) {
      user = u
      break
    }
  }
  return user
}

/// Delete a simulator.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Destroy function
const destroy = function(req, res) {
  const simulator = req.resourceData
  if (!cloudServices) {
    // Create an error
    error = {error: {
      msg: 'Cloud services are not available'
    }};
    res.jsonp(error);
    return;
  }

  // delete resource from csgrant?
  // keep the resource since we only mark it as terminated.
  // user should still be able to see it using /simulators/:id
  // csgrant.deleteResource(req.user, simulator.id, (err, data) => {
  // if (err) {
  //   return res.jsonp({success: false, error: err})
  // }

  // finally terminate the simulator
  terminateSimulator(req.user,
                     simulator.data,
                     function(err) {
                       if (err) {
                         var error = {error: {
                           msg: 'Error terminating simulator'
                         }};
                         res.jsonp(error);
                         return;
                       }
                       else {
                         res.jsonp(simulator)
                       }
                     })
}


function getAllNonTerminatedSimulators() {
  const resources = csgrant.copyInternalDatabase()
  const sims = {}
  for (let id in resources) {
    const resource = resources[id]
    if (id.indexOf('simulator-') == 0) {
      // it's a simulator
      if (resource.data.status !== 'TERMINATED') {
        // it's not terminated
        sims[resource.data.machine_id] = resource
      }
    }
  }
  return sims
}

// This function is called periodically to check if simulators on AWS show a
// different status to the resource database. The resource database is updated
// if necessary
function updateInstanceStatus() {
  // get all active simulators in the portal
  const simulators = getAllNonTerminatedSimulators()
  if (simulators.length === 0)
    return

  // get region for awsDefaults
  const machineIds = []
  cloudServices.simulatorStatuses(awsDefaults.region,
    machineIds, function (err, awsData) {
      if (err) {
        console.log(util.inspect(err))
        return
      }
      if(!awsData) {
        return
      }

      // make a dict with machine states, from aws data
      const awsInstanceStates = {}
      for (var i = 0; i < awsData.InstanceStatuses.length; ++i) {
        const awsInstanceState = awsData.InstanceStatuses[i]
        const instanceId = awsInstanceState.InstanceId
        const awsState = awsInstanceState.InstanceState.Name
        // lets convert awsState to a cloudsim sate
        const aws2cs = {
          'pending': 'LAUNCHING',
          'running': 'RUNNING',
          'shutting-down': 'TERMINATING',
          'stopping': 'TERMINATING',
          'terminated' : 'TERMINATED',
          'stopped' : 'TERMINATED'
        }
        const cloudsimState = aws2cs[awsState] || 'UNKNOWN'
        // add the machine state
        awsInstanceStates[instanceId] = cloudsimState
      }

      // update sims where the status is different. AWS is always right
      for (let simId in simulators) {
        const simulator = simulators[simId]
        const oldState = simulator.data.status
        // state according to AWS. if simId is not in the data, the machine
        // is gone
        const awsState = awsInstanceStates[simId] || 'TERMINATED'
        // update if state has changed
        if (oldState !== awsState) {
          simulator.data.status = awsState
          const user = getUserFromResource(simulator)
          const resourceName = simulator.data.id
          csgrant.updateResource(user, resourceName, simulator.data, ()=>{
            if (simulator.data.status === 'TERMINATED') {
              // extra console.log for issue 13
              console.log('\n\n', awsInstanceStates,'\n*\n', simulator.data)
            }
            console.log(simId,simulator.data.id,
              'status update', oldState, '=>',
              simulator.data.status)
          })
        }
      }
    })
}

// used to start the periodicall resource database update (against the aws info)
exports.initInstanceStatus = function() {
  console.log('starting instance status update with interval (ms): ',
    instanceStatusUpdateInterval)
  setInterval(updateInstanceStatus, instanceStatusUpdateInterval);
}

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
    destroy)

  /// POST /simulators
  /// Create a new simulation
  app.post('/simulators',
    csgrant.authenticate,
    csgrant.ownsResource('simulators', false),
    create)

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  app.get('/simulators/:resourceId',
   csgrant.authenticate,
   csgrant.ownsResource(':resourceId', true),
   csgrant.resource)
}

