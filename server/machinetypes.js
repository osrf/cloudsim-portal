'use strict'

const csgrant = require('cloudsim-grant')

function setRoutes(app) {

  console.log('MACHINE TYPES setRoutes')

  // list all resources
  app.get('/machinetypes',
    csgrant.authenticate,
    csgrant.userResources,
    function(req, res, next) {
      // we're going to filter out the non
      // machine types before the next middleware.
      req.allResources = req.userResources
      req.userResources = req.allResources.filter( (obj)=>{
        if(obj.name.indexOf('machinetype-') == 0)
          return true
        return false
      })
      next()
    },
    csgrant.allResources)

  app.get('/machinetypes/:machinetype',
    csgrant.authenticate,
    csgrant.ownsResource(':machinetype', true),
    csgrant.resource)

  // create a new simulation
  app.post('/machinetypes',
           csgrant.authenticate,
           csgrant.ownsResource('machinetypes', false),
           function(req, res) {

    console.log('create machine type:')
    console.log('  body:' +  JSON.stringify(req.body))

    const resourceData = req.body

    const op = 'create machine type'
    const error = function(msg) {
      return {operation: op,
              success: false,
              error: msg}
    }

    const user = req.user
    const r = {success: false}
    csgrant.getNextResourceId('machinetype', (err, resourceName) => {
      if(err) {
        res.jsonp(error(err))
        return
      }
      // final step: add machine type
      csgrant.createResource(user, resourceName, resourceData,
                            (err, data) => {
        if(err) {
          res.jsonp(error(err))
          return
        }
        // step 5. success!
        const r = { success: true,
                    operation: op,
                    result: data,
                    id: resourceName}
        res.jsonp(r)
      })
    })
  })

  // Update a simulation
  app.put('/machinetypes/:machinetype',
          csgrant.authenticate,
          csgrant.ownsResource(':machinetype', true),
          function(req, res) {

    const resourceName = req.machinetype
    const newData = req.body
    console.log(' Update machine type: ' + resourceName)
    console.log(' new data: ' + JSON.stringify(newData))
    const user = req.user

    const r = {success: false}

    csgrant.readResource(user, resourceName, function(err, oldData) {
      if(err) {
        return res.jsonp({success: false,
                          error: 'error trying to read existing data: ' + err})
      }

      const futureData = oldData.data
      // merge with existing fields of the newData... thus keeping old fields intact
      for (var attrname in newData) {
        futureData[attrname] = newData[attrname]
      }
      csgrant.updateResource(user, resourceName, futureData, (err, data) => {
        if(err) {
          return res.jsonp({success: false, error: err})
        }
        r.success = true
        r.result = data
        // success
        res.jsonp(r)
      })
    })
  })

  // Delete a simulation
  app.delete('/machinetypes/:machinetype',
             csgrant.authenticate,
             csgrant.ownsResource(':machinetype', false),
             function(req, res) {
    console.log('delete machine type ' + req.machinetype)
    const resourceName = req.machinetype
    const r = {success: false}
    const user = req.user  // from previous middleware
    const resource = req.machinetype // from app.param (see below)
    csgrant.deleteResource(user, resource, (err, data) => {
      if(err) {
        return res.jsonp({success: false, error: err})
      }
      r.success = true
      r.result = data
      // success
      res.jsonp(r)
    })
  })

  // machine type route parameter
  app.param('machinetype', function( req, res, next, id) {
    req.machinetype = id
    next()
  })
}

exports.setRoutes = setRoutes
