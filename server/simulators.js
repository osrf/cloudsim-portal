'use strict'
/// @module simulator_controller
/// Server side simulator controller.

/// Module dependencies.
const parameters = require('parameters-middleware');
const util = require('util')
const csgrant = require('cloudsim-grant')
const moment = require('moment')
const _ = require('underscore')
const common = require('./common')
const metricConfigsModule = require('./metric_configs')

// initialise cloudServices, depending on the environment
var cloudServices = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  console.log('using the real cloud services!');
  cloudServices = require('./cloud_services.js');
} else {
  console.log(
    'process.env.AWS_ACCESS_KEY_ID not defined: using the fake cloud services');
  cloudServices = require('./fake_cloud_services.js');
}

// global variables and settings
var instanceStatusUpdateInterval = 5000;
var instanceIpUpdateInterval = 10000;

if (process.env.NODE_ENV === 'test') {
  // reduce delays during testing
  instanceStatusUpdateInterval = 1;
  instanceIpUpdateInterval = 1;
}

const awsDefaults = cloudServices.awsDefaults

/// Create a new simulator instance based on the content of the request
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Simulator create function.
const create = function(req, res) {

  // Call implementation function
  let opts = req.body
  let user = req.user
  createImpl(user, opts, function(resp) {

    // Send response
    res.jsonp(resp);
  })
}

/// Implementation for the create function. This doesn't finish the response.
const createImpl = function(user, opts, cb) {

  let error

  // Cloud services
  if (!cloudServices) {
    error = {error: {
      msg: 'Cloud services are not available'
    }};
    console.log(error.error.msg)
    cb(error);
    return;
  }

  // create the simulator data
  var simulator = {status: 'LAUNCHING'}
  simulator.region = opts.region
  simulator.hardware = opts.hardware
  simulator.image = opts.image

  // TODO: Check if user owns this SSH key resource, otherwise someone can
  // launch a machine with an ssh key they don't own, and download the key
  // from the machine later using the /download route
  simulator.sshkey = opts.sshkey
  if (!simulator.sshkey) {
    simulator.sshkey = awsDefaults.keyName
  }
  simulator.options = opts.options || {}

  // we use just one (1) security group
  if (opts.sgroup) {
    simulator.sgroup = opts.sgroup
  } else {
    simulator.sgroup = awsDefaults.security
  }
  // Set the simulator user
  simulator.creator = user;
  simulator.launch_date = new Date();
  simulator.termination_date = null;
  simulator.machine_ip = '';
  simulator.machine_id = '';

  csgrant.getNextResourceId('simulator', (err, resourceName) => {
    if(err) {
      cb(error(err))
      return
    }
    simulator.id = resourceName

    // add id to the options file
    if (simulator.options) {
      simulator.options.sim_id = simulator.id
      simulator.options.portal_url = common.portalUrl()
    }

    // add resource to csgrant
    csgrant.createResource(user, simulator.id, simulator,
      (err) => {
        if (err) {
          console.log('create resource error:' + err)
          cb(error(err));
          return;
        }

        // launch the simulator!
        const tagValue = resourceName + '_' + user
        const tag = {Name: tagValue}
        // use a script that will pass on the username,
        const scriptTxt = cloudServices.generateScript(
          simulator.creator,
          simulator.options)
        let sgroups = [simulator.sgroup];
        cloudServices.launchSimulator(
          simulator.region,
          simulator.sshkey,
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
              cb(error);
              return;
            }

            const info = machine;
            simulator.machine_id = info.id;
            // send json response object to update the
            // caller with new simulator data.
            cb(simulator)

            // update resource (this triggers socket notification)
            csgrant.updateResource(user, simulator.id, simulator, ()=>{
              // console.log(simulator.id, 'launch!')
            })

            getInstanceIp(info, instanceIpUpdateInterval, 10, (err, state) => {
              if (err) {
                console.log(JSON.stringify(err))
                return
              }

              // update resource (this triggers socket notification)
              simulator.machine_ip = state.ip
              simulator.aws_launch_time = state.launchTime
              simulator.aws_creation_time = state.creationTime
              csgrant.updateResource(user, simulator.id, simulator, ()=>{
                // console.log(simulator.id, 'ip:', simulator.machine_ip)
              })
            })
          })
      })
  })
}

// repeatedly poll machine_ip using cloud services
const getInstanceIp = function(info, delay, maxRetry, cb) {
  if (maxRetry < 0) {
    return cb({error: 'Cannot get instance ip'}, null)
  }

  setTimeout(() => {
    cloudServices.simulatorStatus(info, (err, state) => {
      if (!state.ip) {
        let retry = maxRetry-1
        getInstanceIp(info, 1000, retry, cb)
      }
      else {
        return cb(null, state)
      }
    })
  }, delay)
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
/// @return terminate function
const terminate = function(req, res) {

  // Call implementation function
  let opts = req.resourceData
  let user = req.user

  terminateImpl(user, opts, (resp) => {
    // Send response
    res.jsonp(resp);
  })
}

/// Implementation for the terminate function. This doesn't finish the response.
const terminateImpl = function(user, opts, cb) {

  if (!cloudServices) {
    // Create an error
    error = {error: {
      msg: 'Cloud services are not available'
    }}
    cb(error)
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
  terminateSimulator(user, opts.data, function(err) {
    if (err) {
      cb({error: {msg: 'Error terminating simulator'}})
      return
    }
    else {
      cb(opts)
    }
  })
}

// Terminates a simulator.
const terminateSimulator = function(user, simulator, cb) {

  const machineInfo = {region: simulator.region,
    id: simulator.machine_id};
  cloudServices.terminateSimulator(machineInfo, function(err) {
    if(err) {
      cb(err)
    }
    else {
      simulator.status = 'TERMINATING';
      simulator.termination_date = new Date();
      // send response . Aws timestamps will be updated afterwards
      cb(null, simulator)

      setTimeout(function() {
        cloudServices.simulatorStatus(machineInfo, function(err, state) {
          simulator.aws_termination_request_time = state.terminationTime
          // update resource (this triggers socket notification)
          csgrant.updateResource(user, simulator.id, simulator, ()=>{
            // console.log(simulator.id, 'terminate')
          })
        })
      }, instanceIpUpdateInterval);
    }
  }) // terminate
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
        // special case: launching new machine and there's no aws info yet
        if (!awsInstanceStates[simId] && oldState == 'LAUNCHING')
          continue  // skip changes for missing 'LAUNCHING' machines
        // update if state has changed
        if (oldState !== awsState) {
          simulator.data.status = awsState
          const user = getUserFromResource(simulator)
          const resourceName = simulator.data.id
          csgrant.updateResource(user, resourceName, simulator.data, ()=>{
            if (simulator.data.status === 'TERMINATED') {
              // extra console.log for issue 13
              // console.log('\n\n', awsInstanceStates,'\n*\n', simulator.data)
            }
            /* console.log(simId,simulator.data.id,
              'status update', oldState, '=>',
              simulator.data.status)*/
          })
        }
      }
    })
}

/**
 * Internal function that calculates and returns metrics corresponding
 * to all the simulators accessible by the invoking user, grouped by groups/roles.
 * Retuns an array in which the values are the grouped simulator metrics.
 */
function _computeSimulatorMetrics(user, simulators) {
  //const simulators = req.userResources
  // result
  const metrics = {}
  // at a minimum, the current user must be returned
  metrics[user] = {
    'identity': user,
    'running_time': 0
  }
  for(let sId in simulators) {
    const s = simulators[sId]
    // compute time in running status
    const launchTime = moment.utc(s.data.aws_launch_time || s.data.launch_date)
    let terminationTime = moment.utc(s.data.aws_termination_request_time
      || s.data.termination_date
      || new Date())
    const runningTime = moment.duration(terminationTime.diff(launchTime))
    const roundUpHours = Math.floor(runningTime.asHours() + 1)
    for(let pId in s.permissions) {
      const username = s.permissions[pId].username
      if (!metrics[username]) {
        metrics[username] = {
          'identity': username,
          'running_time': 0
        }
      }
      metrics[username].running_time += roundUpHours
    }
  }
  let result = []
  for(let uId in metrics) {
    result.push(metrics[uId])
  }
  return result
}

/**
 * Returns simulator metrics grouped by user.
 * If the request has a team parameter then the returned result will only contain
 * the metrics for the given team name, if applicable.
 * The queried simulators are gathered just from the list of simulators for which the
 * current user has read permissions.
 */
function getSimulatorMetrics(req, res) {
  let metrics = _computeSimulatorMetrics(req.user, req.userResources)

  if (req.query.team) {
    metrics = metrics.filter((metric) => {
      return metric.username === req.query.team
    })
  }

  // prepare response
  const r = {
    success: false,
    operation: 'get simulator metrics for user',
    requester: req.user,
  }
  r.success = true
  r.result = metrics
  res.jsonp(r)
}

/**
 * Middleware to check instance-hours availability for the current user's identities.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function checkAvailableInstanceHours(req, res, next) {
  csgrant.readAllResourcesForUser(req.identities, (err, items) => {
    if(err) {
      return res.status(500).jsonp({
        success: false,
        "error": err
      })
    }
    // this filtered list will only contain enabled configurations (or whitelisted ones)
    const metricsConfigs = metricConfigsModule.getEnabledConfigs(req, items)
    if (_.isEmpty(metricsConfigs)) {
      next()
      return
    }

    // is this a whitelisted user? (ie. any of his identities is whitelisted)
    if (metricsConfigs.find((config) => { return config.whitelisted})) {
      next()
      return
    }

    // Get the config with the minimum number of allowed instance-hours
    const config = _.min(metricsConfigs, config => { return config.max_instance_hours })

    const simulators = filterSimulators(items)
    const metrics = _computeSimulatorMetrics(req.user, simulators)

    const exhausted = metrics.find( (metric) => {
      return metric.running_time >= config.max_instance_hours
    })

    if (!exhausted) {
      next()
      return
    }
    // Don't launch machines if limit is reached.
    const error = {
      success: false,
      error: 'Unable to launch more instances. Instance-hours limit '
        + ' reached for identity: ' + config.identity
    }
    return res.status(403).jsonp(error);
  })
}

function filterSimulators(resources) {
  return resources.filter( (obj)=>{
    if(obj.name.indexOf('simulator-') == 0)
      return true
    return false
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
    common.filterResources('simulator-'),
    csgrant.allResources)

  /// DEL /simulators
  /// Delete one simulation instance
  app.delete('/simulators/:resourceId',
    csgrant.authenticate,
    csgrant.ownsResource(':resourceId', false),
    terminate)

  /// POST /simulators
  /// Create a new simulation
  app.post('/simulators',
    csgrant.authenticate,
    csgrant.ownsResource('simulators', false),
    parameters(
      {body : ['region', 'hardware', 'image']},
      {message : 'Missing required fields (image, region, hardware).'}
    ),
    checkAvailableInstanceHours,
    create)

  /// GET /simulators/:simulationId
  /// Return properties for one simulation
  app.get('/simulators/:resourceId',
   csgrant.authenticate,
   csgrant.ownsResource(':resourceId', true),
   csgrant.resource)

  /// GET /metrics/simulators
  /// Return metrics associated to simulators grouped by user
  app.get('/metrics/simulators',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('simulator-'),
    getSimulatorMetrics)
}

exports.create = createImpl
exports.terminate = terminateImpl
