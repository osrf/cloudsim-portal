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

// Middleware to remove fields from each resource in req.userResources
// unless user has write permission to the resource.
function redactFromResources(_prop) {

  return function (req, res, next) {

    req.userResources.forEach(function (obj) {

      // Check all identities
      for (let i in req.identities) {

        const identity = req.identities[i]

        // Against all permissions for this resource
        for (let perm in obj.permissions) {

          if (obj.permissions[perm].username != identity)
            continue

          // Keep resource as is if has write permission
          if (!obj.permissions[perm].permissions.readOnly)
            return
        }
      }

      // If we got here, we don't have write permission to the resource
      let a = _prop.split('.');
      let o = obj
      for (let i = 0; i < a.length; ++i) {
        let k = a[i]
        if (!(k in o))
          return

        if (i == a.length - 1)
          o[k] = undefined
        else
          o = o[k]
      }
    })
    next()
  }
}

exports.filterResources = filterResources
exports.redactFromResources = redactFromResources
