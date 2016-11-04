'use strict';

const csgrant = require('cloudsim-grant')
var SecurityGroup = require('../controllers/sgroup');


exports.setRoutes = function(app) {

  /// Create a new security group
  app.post('/sgroups',
              csgrant.authenticate,
              csgrant.ownsResource('sgroups', false),
              SecurityGroup.create);

  /// Get a list of security groups
  app.get('/sgroups',
             csgrant.authenticate,
             csgrant.userResources,
             function (req, res, next) {
               // we're going to filter out the non
               // groups types before the next middleware.
               req.allResources = req.userResources
               req.userResources = req.allResources.filter( (obj)=>{
                 if(obj.name.indexOf('sgroup-') == 0)
                   return true
                 return false
               })
               next()
             },
             csgrant.allResources)

  /// Delete a security group
  app.delete('/sgroups/:sgroup',
                csgrant.authenticate,
                csgrant.ownsResource(':sgroup', false),
                SecurityGroup.destroy);


  /// Update security group rules
  app.put('/sgroups/:sgroup',
             csgrant.authenticate,
             csgrant.ownsResource(':sgroup', false),
             SecurityGroup.update)

  // sgroup route parameter
  app.param('sgroup', function(req, res, next, id) {
    req.sgroup = id
    next()
  })
}
