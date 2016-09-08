'use strict';

const csgrant = require('cloudsim-grant')
var Subnets = require('../controllers/subnet');


module.exports = function(router) {

  /// GET /simulators/:simulationId
  /// Create a new subnet
  router.post('/subnets',
              csgrant.authenticate,
              csgrant.ownsResource('subnet', false),
              Subnets.create);

  /// GET /subnets
  /// Get a list of subnets
  router.get('/subnets',
             csgrant.authenticate,
             csgrant.userResources,
             function (req, res, next) {
               // we're going to filter out the non
               // groups types before the next middleware.
               req.allResources = req.userResources
               req.userResources = req.allResources.filter( (obj)=>{
                 if(obj.name.indexOf('subnet-') == 0)
                   return true
                 return false
               })
               next()
             },
             csgrant.allResources)


  /// DEL /subnets
  /// delete a subnet
  router.delete('/subnets',
                csgrant.authenticate,
                function (req, res, next) {
                  // put the group name in req.group
                  req.subnet = req.body.resource
                  next()
                },
                csgrant.ownsResource(':subnet', false),
                Subnets.destroy);
}
