'use strict'

const csgrant = require('cloudsim-grant')
const request = require('request')

function setRoutes(app) {
  // Post to instance
  app.post('/srcproxy',
    csgrant.authenticate,
    function(req, res) {
      let host = req.body.host
      let path = req.body.path
      const target = 'http://' + host + path
      request({
        url: target,
        method: 'POST'
      }).on('error', function(e) {
        res.end(e);
      }).pipe(res);
    })
}

exports.setRoutes = setRoutes
