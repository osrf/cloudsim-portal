'use strict'

const parameters = require('parameters-middleware')
const request = require('request')
const csgrant = require('cloudsim-grant')
const common = require('../common')
const simulators = require('../simulators')
const sshkeys = require('../sshkeys')
const srcsimulations = require('./simulations')
const s3keys = require('../s3keys')

// global variables and settings
const srcAdmin = 'src-admins'
let keysurl = process.env.CLOUDSIM_KEYS_URL
let instanceIpUpdateInterval = 10000

if (process.env.NODE_ENV === 'test') {
  // reduce delays during testing
  instanceIpUpdateInterval = 1

  console.log(' VPN keys will not be generated in test')
  keysurl = ''
}

// teams have permission to launch and terminate rounds, and download ssh keys
// during practice
let practice = process.env.SRC_PRACTICE || true

const adminUser = process.env.CLOUDSIM_ADMIN || 'admin'

function setRoutes(app) {

  // Get all rounds for a user
  app.get('/srcrounds',
    csgrant.authenticate,
    csgrant.userResources,
    common.filterResources('srcround-'),
    common.redactFromResources('permissions'),
    common.redactFromResources('data.secure'),
    csgrant.allResources)

  // Start a new round
  app.post('/srcrounds',
    csgrant.authenticate,
    parameters(
      {body : ['dockerurl']},
      {message : 'Missing required fields.'}
    ),
    simulators.checkAvailableInstanceHours,
    csgrant.userResources,
    function(req, res) {

      // Get round data
      const resourceData = req.body

      // Check if user is allowed to start rounds
      let isAdmin = false
      if (req.identities.indexOf(srcAdmin) >= 0 ||
          req.identities.indexOf(adminUser) >= 0) {
        isAdmin = true
      }

      // competitor starts with capital SRC prefix
      let isCompetitor = false
      if (!isAdmin) {
        req.identities.forEach(function(id){
          if (id.indexOf("SRC-") > -1) {
            resourceData.team = id
            isCompetitor = true
          }
        })
      }

      if (!isAdmin && !isCompetitor) {
        let error = {error: {
          msg: 'Only SRC admins or competitors can start rounds.'
        }}
        return res.status(403).jsonp(error)
      }

      if (!practice && !isAdmin) {
        let error = {error: {
          msg: 'Only SRC admins can start rounds in competition mode.'
        }}
        return res.status(403).jsonp(error)
      }

      // Admin must specify a team
      if (isAdmin && !resourceData.team) {
        let error = {error: {
          msg: 'Admin must specify a team to create a round.'
        }}
        res.status(400).jsonp(error)
        return
      }

      // Create srcround resource
      const operation = 'Start SRC round'

      // Machine types
      let simMachine
      let fcMachine

      // Find machine types
      for (let r in req.userResources) {
        let resource = req.userResources[r]
        if (!resource.data.name)
          continue
        if (resource.data.name == "src-simulator")
          simMachine = resource.data
        if (resource.data.name == "src-fieldcomputer")
          fcMachine = resource.data
      }

      // Only admin is able to override predefined machine types
      if (isAdmin && resourceData.simulator)
        simMachine = resourceData.simulator

      if (isAdmin && resourceData.fieldcomputer)
        fcMachine = resourceData.fieldcomputer

      if (!simMachine || !fcMachine) {
        let error = {
          operation: operation,
          success: false,
          error: "Failed to get machine types."
        }
        res.status(500).jsonp(error)
        return
      }

      resourceData.simulator = simMachine
      resourceData.fieldcomputer = fcMachine

      // Add secure and public fields
      // These will be populated as we create other resources below
      resourceData.secure = {}
      resourceData.public = {}

      // cloudsim-sim options resources
      // this will be used to initialize cloudsim-sim on the simulator and the
      // field computer instances
      const simResources = [{
        name: "simulations",
        data: {},
        permissions: [
          {
            username: srcAdmin,
            permissions: {
              readOnly: false
            }
          },
          {
            username: resourceData.team,
            permissions: {
              readOnly: false
            }
          }
        ]
      }]

      // create src round resource
      csgrant.createResourceWithType(req.user, 'srcround', resourceData,
      (err, data, resourceName) => {
        if(err) {
          let error = {
            operation: operation,
            success: false,
            error: err
          }
          res.status(500).jsonp(error)
          return
        }

        // create src simulation data that will keep track of
        // application-specific data like scores, time remaining, etc
        const simulationData = {srcround: resourceName}
        srcsimulations.createSimulationData(req.user, resourceData.team,
        simulationData, (dataResp) => {
          if (dataResp.error)
            return res.status(500).jsonp(dataResp.error)

          const simDataId = dataResp.id
          const simDataUrl = common.portalUrl() + '/srcsimulations/' +
            simDataId

          const r = {
            success: true,
            operation: operation,
            result: data,
            id: resourceName
          }

          // Give all admins write access to srcround
          // This allows them to see secure information
          csgrant.grantPermission(req.user, srcAdmin, r.id, false,
          function(err) {
            if (err) {
              res.status(500).jsonp(err)
              return
            }

            // Give team access to srcound
            // This allows them to see "public" information
            csgrant.grantPermission(req.user, resourceData.team, r.id,
            !practice, function(err) {
              if (err) {
                res.status(500).jsonp(err)
                return
              }

              // Revoke user permission, users should inherit permissions from
              // teams
              csgrant.revokePermission(req.user, req.user, r.id, false,
              function(err) {
                if (err) {
                  res.status(500).jsonp(err)
                  return
                }

                // post to keys server to generate server key
                // this will return us the id of the vpn key resource
                const userToken = req.headers.authorization
                const vpnKeyName = resourceName + '_vpnkey'
                generateVpnKey(userToken, vpnKeyName, resourceData.team,
                (vpnKeyResp) => {
                  if (vpnKeyResp.error) {
                    res.status(500).jsonp(vpnKeyResp)
                    return
                  }

                  getS3Keys(resourceData.team, (err, keys) => {
                    if (err) {
                      res.status(500).jsonp(err)
                      return
                    }
                    const s3key = (keys.length && keys[0].data) || undefined 

                    // Create simulator
                    // the options will be passed to the simulator instance and
                    // used for downloading the vpn keys. Note:
                    // write permission is needed to download server vpn keys
                    const keyResourceId = vpnKeyResp.id
                    const serverVpnKeyUrl = keysurl + '/tap/src/server/'
                        + keyResourceId
                    const serverSshkeyName = resourceName + '_sim_sshkey_' +
                      (new Date()).valueOf()
                    let simulator = resourceData.simulator
                    let options =  simulator.options || {}
                    options.role = 'simulator'
                    options.token = req.headers.authorization
                    options.route = serverVpnKeyUrl
                    options.subnet = '192.168.2'
                    options.resources = simResources
                    // route to post back sim data
                    options.simulation_data_route = simDataUrl
                    if (!s3key) {
                      options.s3bucket = 'undefined'
                    } else {
                      options.s3bucket = s3key.bucket_name
                      options.s3accesskey = s3key.access_key
                      options.s3privatekey = s3key.secret_key
                    }

                    simulator.options = options

                    // create sim instance using user identity and share with team
                    // During practice, the user and team will have write access
                    // that lets them download ssh key and terminate the instances
                    createInstance(req.user, resourceData.team, !practice,
                    serverSshkeyName, simulator, (resp) => {
                      if (resp.error) {
                        res.status(500).jsonp(resp)
                        return
                      }
                      // remove simulator options data
                      delete simulator.options

                      // respond without waiting for fc to be ready
                      res.jsonp(r)

                      const simId = resp.id
                      const simSsh = resp.ssh
                      const simMachineId = resp.machine_id

                      // wait till simulator has its ip before creating the field
                      // computer instance as we need to pass the ip onto the
                      // fieldcomputer via options
                      getInstanceIp(req.user, simId,
                      instanceIpUpdateInterval+10, 50, (err, server_ip) => {
                        if (err) {
                          console.log (JSON.stringify(err, null, 2))
                          return
                        }
                        // Create field computer
                        // the options will be passed to the fieldcomputer
                        // instance and used for downloading the vpn keys. Note:
                        // onlyread permission is needed to download client vpn
                        // keys
                        const clientSshkeyName = resourceName + '_fc_sshkey_' +
                          (new Date()).valueOf()
                        const clientVpnKeyUrl = keysurl + '/tap/src/client/'
                            + keyResourceId
                        // route for sim instance to post data (.e.g. status)
                        // back
                        const portalDataRoute = common.portalUrl() +
                          '/srcsimulations/'
                        let fieldcomputer = resourceData.fieldcomputer
                        options = fieldcomputer.options || {}
                        options.role = 'fieldcomputer'
                        options.token = userToken
                        options.server_ip = server_ip
                        options.client_id = 'fieldcomputer'
                        options.client_route = clientVpnKeyUrl
                        options.dockerurl = resourceData.dockerurl
                        options.github_deploy_key = resourceData.github_deploy_key || 'undefined'
                        options.resources = simResources
                        options.portal_data_route = portalDataRoute
                        fieldcomputer.options = options
                        // create fc instance using user identity and share with
                        // team
                        createInstance(req.user, resourceData.team, !practice,
                        clientSshkeyName, fieldcomputer, (resp) => {
                          if (resp.error) {
                            console.log(JSON.stringify(resp.error, null, 2))
                            return
                          }
                          const fcId = resp.id
                          const fcSsh = resp.ssh
                          const fcMachineId = resp.machine_id

                          // populate resource data with more info
                          resourceData.public.simulation_data_id = simDataId
                          resourceData.public.simulator_id = simId
                          resourceData.public.fieldcomputer_id = fcId
                          resourceData.public.vpn = clientVpnKeyUrl
                          resourceData.secure.simulator_ssh = simSsh
                          resourceData.secure.fieldcomputer_ssh = fcSsh
                          resourceData.secure.simulator_machine_id = simMachineId
                          resourceData.secure.fieldcomputer_machine_id =
                            fcMachineId

                          // remove fieldcompuer options data
                          delete fieldcomputer.options

                          // save simulator and field computer id and ssh data
                          // this triggers websocket notifications
                          csgrant.updateResource(srcAdmin, r.id, resourceData,
                          (err) => {
                            if (err) {
                              console.log('Update round error: ' +
                                JSON.stringify(err, null, 2))
                              return
                            }
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

  // Finish a round
  // Requires write access
  app.delete('/srcrounds/:srcround',
    csgrant.authenticate,
    csgrant.ownsResource(':srcround', false),
    function(req, res) {
      const resource = req.srcround
      const user = req.authorizedIdentity

      // read simulator and field computer info from srcround resource data
      // so we can terminate them
      csgrant.readResource(req.authorizedIdentity, resource, (err, data) => {
        if (err) {
          resp.status(500).jsonp(err)
          return
        }

        // create machineInfo data needed for terminating instances
        const simulatorData = {
          data: {
            id: data.data.public.simulator_id,
            region: data.data.simulator.region,
            machine_id: data.data.secure.simulator_machine_id
          }
        }
        const fieldcomputerData = {
          data: {
            id: data.data.public.fieldcomputer_id,
            region: data.data.fieldcomputer.region,
            machine_id: data.data.secure.fieldcomputer_machine_id
          }
        }

        // Terminate simulator
        // During practice, the user and team have write access so will be
        // able to terminate the instance.
        // During competition, the instances will be terminated by
        // cloudsim-sim using the src-admins token after uploading the logs
        terminateInstance(user, simulatorData, practice, (resp) => {
          let simError
          if (resp.error) {
            console.log('Error terminating simulator: ' +
              JSON.stringify(resp.error))
            simError = resp.error
          }

          // Terminate field computer
          terminateInstance(user, fieldcomputerData, practice, (resp) => {
            let fcError
            if (resp.error) {
              console.log('Error terminating field computer: ' +
                JSON.stringify(resp.error))
              fcError = resp.error
            }

            // delete srcround resource
            csgrant.deleteResource(req.user, resource, (err, data) => {
              if(err) {
                return res.status(500).jsonp({success: false, error: err})
              }
              let r = {
                success: true,
                result: data
              }
              if (simError || fcError) {
                r.error = {
                  simulator: simError,
                  fieldcomputer: fcError
                }
                return res.status(500).jsonp(r)
              }
              return res.jsonp(r)
            })
          })
        })
      })
    })

  // srcround route parameter
  app.param('srcround', function(req, res, next, id) {
    req.srcround = id
    next()
  })

  // Set practice mode - to be used by admin only
  app.post('/srcrounds_practice',
    csgrant.authenticate,
    function(req, res) {
      if (req.user !== adminUser) {
        res.status(403).jsonp({error: 'Access Forbidden'})
        return
      }
      if (!req.body.hasOwnProperty('practice')) {
        res.status(400).jsonp({error: 'Missing required field'})
        return
      }
      practice = req.body.practice
      res.status(200).jsonp({success: true})
      return
    })

  // Get practice mode - to be used by admin only
  app.get('/srcrounds_practice',
    csgrant.authenticate,
    function(req, res) {
      if (req.user !== adminUser) {
        res.status(403).jsonp({error: 'Access Forbidden'})
        return
      }
      return res.jsonp({practice: practice})
    })
}

// Create an instance and generate ssh keys. The src-admins will be granted
//  write access. The team will have write access only during practice
const createInstance = function(user, team, teamPerm, keyName, resource, cb) {
  // Create new sshkey for simulator
  const sshOps = {name: keyName}
  sshkeys.create(user, sshOps, function(sshResp){
    if (sshResp.error) {
      cb(sshResp)
      return
    }
    // Give all admins write access to ssh key
    csgrant.grantPermission(user, srcAdmin, sshResp.id, false,
    function(err) {
      if (err) {
        cb(err)
        return
      }

      // Give team write access to ssh key only in practice.
      // ssh key download needs write access
      csgrant.grantPermission(user, team, sshResp.id, teamPerm,
      function(err) {
        if (err) {
          cb(err)
          return
        }
        resource.sshkey = sshResp.result.name
        resource.sgroup = 'cloudsim-sim-src'
        // Launch instance
        simulators.create(user, resource, function(simResp){
          if (simResp.error) {
            cb(simResp)
            return
          }
          // Give all admins write access to instance
          csgrant.grantPermission(user, srcAdmin, simResp.id, false,
          function(err) {
            if (err) {
              cb(err)
              return
            }
            // Give team write access to instance only during practice
            csgrant.grantPermission(user, team, simResp.id,
            teamPerm, function(err) {
              if (err) {
                cb(err)
                return
              }
              simResp.ssh = common.portalUrl() + '/sshkeys/' + sshResp.id
              // returned simResp is the created "simulator" resource
              cb(simResp)
            })
          })
        })
      })
    })
  })
}

// terminate instance only in practice mode but keep the machines running
// in the competition so that the logs can be uploaded
// Note: machineInfo must contain the simulator's resource id.
const terminateInstance = function(user, machineInfo, term, cb) {
  if (term)
    simulators.terminate(user, machineInfo, cb)
  else
    cb({success: true})
}

// generate vpn key by posting to the keys server
const generateVpnKey = function(userToken, keyName, grantee, cb) {
  // skip vpn key generation if url is not specified.
  // This is mainly used in tests
  if (!keysurl) {
    cb({id: 'vpn_key'})
    return
  }

  // Post to keys server to generate VPN server key and share resource with
  // a grantee (team)
  const vpnKeyGenUrl = keysurl + '/tap/src/key'
  const vpnKeyGenData = {
    name: keyName,
    port: 1196,
    user: grantee
  }

  const requestOptions = {
    method: 'post',
    body: vpnKeyGenData,
    json: true,
    url: vpnKeyGenUrl,
    headers: {
      Authorization: userToken
    }
  }
  request(requestOptions, (err, response, body) => {
    if (err || response.statusCode != 200) {
      cb({error: 'Unable to generate vpn keys'})
      return
    }
    const vpnKeyResponse = body

    // grant admin access
    const keyResource = vpnKeyResponse.id
    const vpnKeyGrantUrl = keysurl + '/permissions'
    const vpnKeyGrantData = {
      grantee: srcAdmin,
      resource: keyResource,
      readOnly: false
    }

    const grantOptions = {
      method: 'post',
      body: vpnKeyGrantData,
      json: true,
      url: vpnKeyGrantUrl,
      headers: {
        Authorization: userToken
      }
    }
    request(grantOptions, (err, response) => {
      if (err || response.statusCode != 200) {
        cb({error: 'Unable to share vpn keys'})
        return
      }

      cb(vpnKeyResponse)
    })
  })
}

// Reads the s3key associated with the given team name
// cb is a callback(err, items)
const getS3Keys = function(team, cb) {
  s3keys.getS3Keys([team], cb)
}

// read simulator resource to get machine_ip
const getInstanceIp = function(user, simId, delay, maxRetry, cb) {
  if (maxRetry < 0) {
    cb({error: 'Cannot get instance ip'}, null)
    return
  }

  setTimeout(() => {
    csgrant.readResource(user, simId, (err, data) => {
      if (err) {
        cb(err)
        return
      }
      if (!data.data.machine_ip) {
        let retry = maxRetry-1
        getInstanceIp(user, simId, 500, retry, cb)
      }
      else {
        cb(null, data.data.machine_ip)
      }
    })
  }, delay)
}

exports.setRoutes = setRoutes
