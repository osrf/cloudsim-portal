'use strict'

const parameters = require('parameters-middleware');
const csgrant = require('cloudsim-grant')
const common = require('../common')
const simulators = require('../simulators')

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
      {body : ['dockerurl', 'fieldcomputer', 'simulator']},
      {message : 'Missing required fields.'}
    ),
    function(req, res) {

      // Get round data
      const resourceData = req.body

      // Check if user is allowed to start rounds
      let isAdmin = false
      if (req.identities.indexOf('src-admins') >= 0)
        isAdmin = true

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
        }};
        res.status(403).jsonp(error)
        return
      }

      // Add secure and public fields
      // These will be populated as we create other resources below
      resourceData.secure = {}
      resourceData.public = {}

      // Create srcround resource
      const operation = 'Start SRC round'

      const user = req.user
      csgrant.createResourceWithType(user, 'srcround', resourceData,
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
        const r = {
          success: true,
          operation: operation,
          result: data,
          id: resourceName
        }

        // Give all admins write access
        // This allows them to see secure information
        csgrant.grantPermission(req.user, "src-admins", r.id, false,
        function(err) {
          if (err) {
            res.status(500).jsonp(error(err))
            return;
          }

          // Give team read access
          // This allows them to see "public" information
          csgrant.grantPermission(req.user, resourceData.team, r.id, true,
          function(err) {
            if (err) {
              res.status(500).jsonp(error(err))
              return;
            }

            // Revoke user permission, users should inherit permissions from
            // teams
            csgrant.revokePermission(req.user, req.user, r.id, false,
            function(err) {
              if (err) {
                res.status(500).jsonp(error(err))
                return;
              }

              // TODO: Ask keys server to generate VPN bundle
              // TODO: Share VPN bundle with team and admins
              // TODO: Insert VPN resource info into resourceData

              // Launch simulator
              simulators.create(resourceData.team, resourceData.simulator, function(resp){

                // TODO: Share simulator with admins,
                //   write access so they have SSH keys and IP
                // TODO: Launch FC
                // TODO: Share FC with admins, write access
                // TODO: Users can connect to FC through VPN
                if (resp.error) {
                  res.jsonp(resp)
                  return
                }
                // TODO Launch field computer
                res.jsonp(r);
              })
            })
          })
        })
      })
    })

  // Finish a round
  // Anyone with read (team) or write (admins) access can do it
  app.delete('/srcrounds/:srcround',
    csgrant.authenticate,
    csgrant.ownsResource(':srcround', true),
    function(req, res) {
      const resource = req.srcround
      csgrant.deleteResource(req.user, resource, (err, data) => {
        if(err) {
          return res.status(500).jsonp({success: false, error: err})
        }
        let r = {
          success: true,
          result: data
        }

        // TODO: Also delete all simulators and keys generated for this round

        res.jsonp(r)
      })
    })

  // srcround route parameter
  app.param('srcround', function(req, res, next, id) {
    req.srcround = id
    next()
  })
}

exports.setRoutes = setRoutes
