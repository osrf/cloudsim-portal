'use strict'

const csgrant = require('cloudsim-grant')

function setRoutes(app) {

  // Get all rounds for a user
  app.get('/srcrounds',
    csgrant.authenticate,
    csgrant.userResources,
    function(req, res, next) {

      // Filter
      req.allResources = req.userResources
      req.userResources = req.allResources.filter( (obj)=>{

        // Must be srcround
        if(obj.name.indexOf('srcround-') != 0)
          return false

        // If at least one of the user's indentities has write permission,
        // they are an admin, so they can see the whole data
        for (let i in req.identities) {

          const identity = req.identities[i]

          for (let o in obj.permissions) {

            const permUser = obj.permissions[o].username

            if (identity == permUser) {

              if (!obj.permissions[o].permissions.readOnly)
                return true
            }
          }
        }

        // For competitors, filter out secure information

        // They can't see users emails
        obj.permissions = undefined

        // They can't see secure information about the machines
        if (obj.data.secure)
          obj.data.secure = undefined

        return true
      })

      next()
    },
    csgrant.allResources)

  // Start a new round
  app.post('/srcrounds',
    csgrant.authenticate,
    function(req, res) {

      let team

      // Check if user is allowed to start rounds
      let isAdmin = false
      if (req.identities.indexOf('src-admins') >= 0)
        isAdmin = true

      let isCompetitor = false
      req.identities.forEach(function(id){
        if (id.indexOf("SRC-") > -1) {
          team = id
          isCompetitor = true
        }
      })

      // If both admin and competitor, be only admin
      if (isAdmin)
        isCompetitor = false

      if (!isAdmin && !isCompetitor) {
        res.status(403).jsonp('{"error":"Only SRC admins or competitors can start rounds."}')
        return
      }

      // Get round data
      const resourceData = req.body

      // A competitor can't start a round for another team
      if (isCompetitor && resourceData.team != undefined && resourceData.team != team) {

        res.status(403).jsonp('{"error":"Attempting to create a round for another team."}')
        return
      }

      // Fill team
      if (isCompetitor)
        resourceData.team = team

      // Check data is complete
      if (resourceData.dockerurl == undefined || resourceData.dockerurl == "" ||
          resourceData.team == undefined || resourceData.team == "") {

        res.status(400).jsonp('{"error":"Missing required field."}')
        return
      }

      // Add secure and public fields
      // These will be populated as we create other resources below
      resourceData.secure = {}
      resourceData.public = {}

      // Create srcround resource
      const operation = 'Start SRC round'

      const user = req.user
      csgrant.createResourceWithType(user, 'srcround', resourceData, (err, data, resourceName) => {
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
        csgrant.grantPermission(req.user, "src-admins", r.id, false, function(err) {
          if (err) {
            res.status(500).jsonp(error(err))
            return;
          }

          // Give team read access
          // This allows them to see "public" information
          csgrant.grantPermission(req.user, resourceData.team, r.id, true, function(err) {
            if (err) {
              res.status(500).jsonp(error(err))
              return;
            }

            // Revoke user permission, users should inherit permissions from teams
            csgrant.revokePermission(req.user, req.user, r.id, false, function(err) {
              if (err) {
                res.status(500).jsonp(error(err))
                return;
              }

              // TODO: Ask keys server to generate VPN bundle
              // TODO: Share VPN bundle with team and admins
              // TODO: Launch simulator
              // TODO: Share simulator with admins, write access so they have SSH keys and IP
              // TODO: How to get simulator status to competitors? Do we need to?
              // TODO: Launch FC
              // TODO: Share FC with admins, write access
              // TODO: Users can connect to FC through VPN

              res.jsonp(r);
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
