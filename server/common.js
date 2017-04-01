'use strict'

// Middleware to filter req.userResources so only resources with the given
// prefix are left.
function filterResources(_prefix) {

  return function (req, res, next) {
    req.allResources = req.userResources
    req.userResources = req.allResources.filter((obj)=>{
      return obj.name.indexOf(_prefix) == 0
    })
    next()
  }
}

exports.filterResources = filterResources
