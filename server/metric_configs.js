'use strict'
/// @module metrics
/// Server side metrics.

/// Module dependencies.
const csgrant = require('cloudsim-grant')
const _ = require('underscore')
const common = require('./common')

/**
 * Returns the list of enabled metric configs that apply for the
 * current user. Note: the list will also include configs that whitelist 
 * the user. These whitelisting configs override the concept of 
 * enabled/disabled config. 
 * @param {*} req
 * @param {*} resources
 */
function getEnabledConfigs(req, resources) {
  const configs = resources.filter( (obj)=>{
    if(obj.name.indexOf('metrics-configs-') == 0)
      return true
    return false
  }).map((config) => { return config.data })

  let filteredConfigs = configs.filter((config) =>{
    // keep configs targetted to current user
    return req.identities.indexOf(config.identity) != -1
  }).filter((config) => {
    // only keep enabled configs. And those whitelisting the user
    return config.whitelisted || config.check_enabled
  })
  return filteredConfigs
}

function updateMetricsConfig(req, res) {
  const resourceName = req.resourceName
  const newData = req.body
  console.log(' Update Metrics config, with new data: ', JSON.stringify(newData))
  const r = {success: false}
  csgrant.readResource(req.authorizedIdentity, resourceName, function(err, oldData) {
    if(err) {
      return res.jsonp({success: false,
        error: 'Error trying to read existing data: ' + err})
    }

    const futureData = oldData.data
    // merge with existing fields of the newData... thus keeping old fields intact
    _.extend(futureData,
            _.pick(newData, 'whitelisted', 'max_instance_hours', 'check_enabled'))
    csgrant.updateResource(req.authorizedIdentity, resourceName, futureData, (err, data) => {
      if(err) {
        return res.jsonp({success: false, error: err})
      }
      r.success = true
      r.result = data
      // success
      res.jsonp(r)
    })
  })
}

/**
 * Returns a metrics config targetting the given identity, if any.
 * @param {*} req 
 * @param {*} identity 
 * @param {*} cb a function with 3 arguments: err, found (boolean flag), config (the found config or undefined)  
 */
function findMetricConfigForIdentity(req, identity, cb) {
  csgrant.readAllResourcesForUser(req.identities, (err, resources) => {
    if(err) {
      cb(err)
    }
    const allConfigs = resources.filter( (obj)=>{
      return obj.name.indexOf('metrics-configs-') == 0
    }).map(config => { return config.data })

    const found = allConfigs.find(config => {
      return config.identity == identity
    })
    cb(null, found!==undefined, found)
  })  
}

function createMetricsConfig(req, res) {
  const newData = _.pick(req.body, 'identity', 'whitelisted',
    'max_instance_hours', 'check_enabled')
  const identity = req.body.identity
  const admin_identity = req.body.admin_identity
  console.log(' Create Metrics config, with data: ', JSON.stringify(newData))
  const user = req.user
  const op = 'create metrics-configs'
  const r = {operation: op, success: false}
  const error = function(msg, errCode) {
    r.error = msg
    res.status(errCode || 500).jsonp(r)
  }

  findMetricConfigForIdentity(req, identity, (err, found) => {
    if(err) {
      return error(err)
    }
    if(found) {
      return error("Duplicate config identity. Please use PUT method to update it.", 409)
    }
    csgrant.createResourceWithType(user, 'metrics-configs', newData,
      (err, data, resourceName) => {
        if(err) {
          return error(err)
        }
        // Give identity read access
        // This allows the identity to read this metrics-config when trying to launch a simulator
        csgrant.grantPermission(user, identity, resourceName, true, function(err) {
          if (err) {
            return error(err)
          }
          // Give admin_identity (if it exists) read/write access
          if (admin_identity !== undefined) {
            csgrant.grantPermission(user, admin_identity, resourceName, false, function(err) {
              if (err) {
                return error(err)
              }
              // The admin_identity is present and permission was correctly granted to both identities.
              r.success = true
              r.result = data
              r.id = resourceName
              res.jsonp(r)  
            })
          } else {
            // There is no admin_identity and the permission was granted correctly to the user identity.
            r.success = true
            r.result = data
            r.id = resourceName
            res.jsonp(r)            
          }
        })
      })    
  })
}

function setRoutes(app) {
  /// GET /metrics/config
  /// Return config associated to allowed instance-hours by team
  app.get('/metrics/configs',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('metrics-configs-'),
    csgrant.allResources)

  /// POST /metrics/config
  /// Create a new configuration to access instance-hours and metrics info
  app.post('/metrics/configs',
    csgrant.authenticate,
    csgrant.ownsResource('metrics-configs', false),
    createMetricsConfig)

  /// PUT /metrics/config
  /// Update a metrics configuration
  app.put('/metrics/configs/:resourceId',
    csgrant.authenticate,
    csgrant.ownsResource(':resourceId', false),
    updateMetricsConfig)
}

exports.getEnabledConfigs = getEnabledConfigs
exports.findMetricConfigForIdentity = findMetricConfigForIdentity
exports.setRoutes = setRoutes
