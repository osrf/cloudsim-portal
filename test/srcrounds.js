'use strict';

let agent
let app
let csgrant

const io = require('socket.io-client')
const clearRequire = require('clear-require');
const should = require('should')
const supertest = require('supertest')

// Three users for testing:
// * admin
// * competitor
// * non-participant
const srcAdmin = "src-admin"
const srcAdminTokenData = {identities: [srcAdmin, "src-admins"]}
let srcAdminToken

const srcAdmin2 = "src-admin2"
const srcAdmin2TokenData = {identities: [srcAdmin2, "src-admins"]}
let srcAdmin2Token

const competitorA = "competitor-A"
const teamA = "SRC-TeamA"
const competitorATokenData = {identities: [competitorA, teamA]}
let competitorAToken

const competitorB = "competitor-B"
const teamB = "SRC-teamB"
const competitorBTokenData = {identities: [competitorB, teamB]}
let competitorBToken

const notCompetitor = "not-competitor"
const notCompetitorTokenData = {identities: [notCompetitor]}
let notCompetitorToken

const adminUser = process.env.CLOUDSIM_ADMIN || 'admin'
const adminTokenData = {identities:[adminUser]}
let adminToken


// Fake simulator data
let simData = {
  region: 'region',
  hardware: 'hardware',
  image: 'image'
}

// Fake field computer data
let fcData = {
  region: 'region',
  hardware: 'hardware',
  image: 'image'
}

function getResponse(res, print) {
  const response = JSON.parse(res.text)
  if (print) {
    csgrant.dump()
    console.trace(JSON.stringify(response, null, 2 ))
  }
  return response
}

// this function creates a socket.io socket connection for the token's user.
// events will be added to the events array
const socketAddress = 'http://localhost:' + process.env.PORT
function createSocket(token) {
  const query = 'token=' + token
  const client = io.connect(socketAddress, {
    reconnection: false,
    query: query,
    transports: ['websocket'],
    rejectUnauthorized: false
  })
  client.on('error', (e)=>{
    should.fail('should have no error: ' + JSONS.stringify(e))
  })
  client.on('disconnect', ()=>{
  })
  client.on('reconnect', (n)=>{
    should.fail('should have no reconnect: ' + JSONS.stringify(n))
  })
  client.on('reconnect_attempt', ()=>{
    should.fail('should have no reconnect attempt')
  })
  client.on('reconnecting', (n)=>{
    should.fail('should have no reconnecting: ' + + JSONS.stringify(n))
  })
  client.on('reconnect_error',  function(err){
    should.fail('should have no reconnect error: ' + + JSONS.stringify(err))
  })
  return client
}

describe('<Unit test SRC rounds>', function() {

  // before hook used to require modules used by this test.
  // IMPORTANT: remember to clear-require these modules in the after hook.
  before(function(done) {
    // Important: the database has to be cleared early, before
    // the server is launched (otherwise, root resources will be missing)
    csgrant = require('cloudsim-grant')
    csgrant.model.clearDb()

    app = require('../server/cloudsim_portal')
    agent = supertest.agent(app)
    done()
  })

  before(function(done) {
    // we need fresh keys for this test
    const keys = csgrant.token.generateKeys()
    csgrant.token.initKeys(keys.public, keys.private)
    done()
  })

  before(function(done) {

    csgrant.token.signToken(srcAdminTokenData, (e, tok)=>{
      if(e) {
        console.log('sign error: ' + e)
      }
      srcAdminToken = tok
      csgrant.token.signToken(srcAdmin2TokenData, (e, tok)=>{
        if(e) {
          console.log('sign error: ' + e)
        }
        srcAdmin2Token = tok
        csgrant.token.signToken(competitorATokenData, (e, tok)=>{
          if(e) {
            console.log('sign error: ' + e)
          }
          competitorAToken = tok
          csgrant.token.signToken(competitorBTokenData, (e, tok)=>{
            if(e) {
              console.log('sign error: ' + e)
            }
            competitorBToken = tok
            csgrant.token.signToken(notCompetitorTokenData, (e, tok)=>{
              if(e) {
                console.log('sign error: ' + e)
              }
              notCompetitorToken = tok
              csgrant.token.signToken(adminTokenData, (e, tok)=>{
                if(e) {
                  console.log('sign error: ' + e)
                }
                adminToken = tok
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('Check initial rounds with admin', function() {
    it('should be empty', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(srcAdmin)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Check initial rounds with a competitor', function() {
    it('should be empty', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(competitorA)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Check initial rounds with non-competitor', function() {
    it('should be empty', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', notCompetitorToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(notCompetitor)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Start a new round with non competitor', function() {
    it('should not be authorized', function(done) {
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', notCompetitorToken)
      .end(function(err,res) {
        res.status.should.be.equal(403)
        done()
      })
    })
  })

  describe('Start a new round with admin, missing fields', function() {
    it('should return a bad request error', function(done) {
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(400)
        done()
      })
    })
  })

  let dockerUrl = 'docker smth here'
  let debugTeam = "SRC-debug"
  describe('Start a new round with admin, for debugging', function() {
    it('should create a resource with the correct permissions', function(done) {
      let roundId
      let socAdmin = createSocket(srcAdminToken)
      socAdmin.on('connect', function() {
        agent
        .post('/srcrounds')
        .set('Accept', 'application/json')
        .set('authorization', srcAdminToken)
        .send({
          'dockerurl': dockerUrl,
          'team': debugTeam,
          'simulator': simData,
          'fieldcomputer': fcData
        })
        .end(function(err,res) {
          res.status.should.be.equal(200)
          let response = getResponse(res)
          response.success.should.equal(true)
          response.id.should.not.be.empty()
          roundId = response.id

          // Input data
          response.result.data.dockerurl.should.equal(dockerUrl)
          response.result.data.team.should.equal(debugTeam)

          // Permissions
          should.not.exist(response.result.permissions[srcAdmin])
          response.result.permissions['src-admins'].readOnly.should.equal(false)
          response.result.permissions[debugTeam].readOnly.should.equal(false)
        })
      })
      socAdmin.on('resource', res => {
        if (res.operation === 'update' && res.resource.indexOf('src') >= 0) {
          roundId.should.not.be.empty()
          res.resource.should.equal(roundId)
          socAdmin.disconnect()
          socAdmin.close()
          done()
        }
      })
    })
  })

  describe('Start a new round with competitor', function() {
    it('should create a resource with the correct permissions', function(done) {
      let roundId
      let socCompetitorA = createSocket(competitorAToken)
      socCompetitorA.on('connect', function() {
        agent
        .post('/srcrounds')
        .set('Accept', 'application/json')
        .set('authorization', competitorAToken)
        .send({
          'dockerurl': dockerUrl,
          'simulator': simData,
          'fieldcomputer': fcData
        })
        .end(function(err,res) {
          res.status.should.be.equal(200)
          let response = getResponse(res)
          response.success.should.equal(true)
          response.id.should.not.be.empty()
          roundId = response.id

          // Input data
          response.result.data.dockerurl.should.equal(dockerUrl)
          response.result.data.team.should.equal(teamA)

          // Permissions
          should.not.exist(response.result.permissions[competitorA])
          response.result.permissions['src-admins'].readOnly.should.equal(false)
          response.result.permissions[teamA].readOnly.should.equal(false)
        })
      })
      socCompetitorA.on('resource', res => {
        if (res.operation === 'update' && res.resource.indexOf('src') >= 0) {
          roundId.should.not.be.empty()
          res.resource.should.equal(roundId)
          socCompetitorA.disconnect()
          socCompetitorA.close()
          done()
        }
      })
    })
  })

  let roundDebug
  let roundA
  describe('Get rounds with admin', function() {
    it('should have two rounds and full access to secure data', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(srcAdmin)
        response.result.length.should.equal(2)

        // Debug round
        roundDebug = response.result[0].name
        roundDebug.indexOf('srcround').should.be.above(-1)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(debugTeam)
        should.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)
        should.exist(response.result[0].data.secure.simulator_ssh)
        should.exist(response.result[0].data.secure.fieldcomputer_ssh)
        should.exist(response.result[0].data.secure.simulator_machine_id)
        should.exist(response.result[0].data.secure.fieldcomputer_machine_id)
        should.exist(response.result[0].data.public.simulator_id)
        should.exist(response.result[0].data.public.fieldcomputer_id)

        response.result[0].permissions.length.should.equal(2)
        response.result[0].permissions[0].username.should.equal(
          'src-admins')
        response.result[0].permissions[0].permissions.readOnly.should.equal(
          false)
        response.result[0].permissions[1].username.should.equal(debugTeam)
        response.result[0].permissions[1].permissions.readOnly.should.equal(
          false)

        // Team A's round
        roundA = response.result[1].name
        roundA.indexOf('srcround').should.be.above(-1)

        response.result[1].data.dockerurl.should.equal(dockerUrl)
        response.result[1].data.team.should.equal(teamA)
        should.exist(response.result[1].data.secure)
        should.exist(response.result[1].data.public)
        should.exist(response.result[1].data.secure.simulator_ssh)
        should.exist(response.result[1].data.secure.fieldcomputer_ssh)
        should.exist(response.result[1].data.secure.simulator_machine_id)
        should.exist(response.result[1].data.secure.fieldcomputer_machine_id)
        should.exist(response.result[1].data.public.simulator_id)
        should.exist(response.result[1].data.public.fieldcomputer_id)

        response.result[1].permissions.length.should.equal(2)
        response.result[1].permissions[0].username.should.equal('src-admins')
        response.result[1].permissions[0].permissions.readOnly.should.equal(
          false)
        response.result[1].permissions[1].username.should.equal(teamA)
        response.result[1].permissions[1].permissions.readOnly.should.equal(
          false)

        done()
      })
    })
  })

  describe('Get rounds with a different admin', function() {
    it('should have two rounds and full access to secure data', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdmin2Token)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(srcAdmin2)
        response.result.length.should.equal(2)

        // Debug round
        roundDebug = response.result[0].name
        roundDebug.indexOf('srcround').should.be.above(-1)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(debugTeam)
        should.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)

        response.result[0].permissions.length.should.equal(2)
        response.result[0].permissions[0].username.should.equal(
          'src-admins')
        response.result[0].permissions[0].permissions.readOnly.should.equal(
          false)
        response.result[0].permissions[1].username.should.equal(debugTeam)
        response.result[0].permissions[1].permissions.readOnly.should.equal(
          false)

        // Team A's round
        roundA = response.result[1].name
        roundA.indexOf('srcround').should.be.above(-1)

        response.result[1].data.dockerurl.should.equal(dockerUrl)
        response.result[1].data.team.should.equal(teamA)
        should.exist(response.result[1].data.secure)
        should.exist(response.result[1].data.public)

        response.result[1].permissions.length.should.equal(2)
        response.result[1].permissions[0].username.should.equal('src-admins')
        response.result[1].permissions[0].permissions.readOnly.should.equal(
          false)
        response.result[1].permissions[1].username.should.equal(teamA)
        response.result[1].permissions[1].permissions.readOnly.should.equal(
          false)

        done()
      })
    })
  })

  let roundASimSsh
  let roundAFCSsh
  describe('Get rounds with competitor A', function() {
    it('should have one round and access to secure data', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(competitorA)
        response.result.length.should.equal(1)

        // Round data
        response.result[0].name.should.equal(roundA)
        should.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)
        should.exist(response.result[0].data.secure.simulator_ssh)
        should.exist(response.result[0].data.secure.fieldcomputer_ssh)
        roundASimSsh = response.result[0].data.secure.simulator_ssh
        roundAFCSsh = response.result[0].data.secure.fieldcomputer_ssh
        should.exist(response.result[0].data.public.simulator_id)
        should.exist(response.result[0].data.public.fieldcomputer_id)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamA)

        // Permissions
        should.exist(response.result[0].permissions)

        done()
      })
    })
  })

  describe('Check rounds with non-competitor', function() {
    it('should be empty', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', notCompetitorToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(notCompetitor)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Start a new round with admin, for team B', function() {
    it('should create a resource with the correct permissions', function(done) {
      let roundId
      let socAdmin = createSocket(srcAdminToken)
      socAdmin.on('connect', function() {
        agent
        .post('/srcrounds')
        .set('Accept', 'application/json')
        .set('authorization', srcAdminToken)
        .send({
          'dockerurl': dockerUrl,
          'team': teamB,
          'simulator': simData,
          'fieldcomputer': fcData
        })
        .end(function(err,res) {
          res.status.should.be.equal(200)
          let response = getResponse(res)
          response.success.should.equal(true)
          roundId = response.id
        })
      })
      socAdmin.on('resource', res => {
        if (res.operation === 'update' && res.resource.indexOf('src') >= 0) {
          roundId.should.not.be.empty()
          res.resource.should.equal(roundId)
          socAdmin.disconnect()
          socAdmin.close()
          done()
        }
      })
    })
  })

  let roundB
  let roundBSimSsh
  let roundBFCSsh
  describe('Get rounds with competitor B', function() {
    it('should have one round', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(competitorB)
        response.result.length.should.equal(1)

        // Round data
        roundB = response.result[0].name
        roundB.indexOf('srcround').should.be.above(-1)
        should.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)
        should.exist(response.result[0].data.secure.simulator_ssh)
        should.exist(response.result[0].data.secure.fieldcomputer_ssh)
        roundBSimSsh = response.result[0].data.secure.simulator_ssh
        roundBFCSsh = response.result[0].data.secure.fieldcomputer_ssh
        should.exist(response.result[0].data.public.simulator_id)
        should.exist(response.result[0].data.public.fieldcomputer_id)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamB)

        // Permissions
        should.exist(response.result[0].permissions)

        done()
      })
    })
  })

  describe('Get rounds with competitor A', function() {
    it('should not see team B round', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.result.length.should.equal(1)
        response.result[0].data.team.should.equal(teamA)
        done()
      })
    })
  })

  describe('Start a round for B with competitor A', function() {
    it('should not be authorized', function(done) {
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .send({
        'dockerurl': dockerUrl,
        'team': teamB,
        'simulator': simData,
        'fieldcomputer': fcData
      })
      .end(function(err,res) {
        res.status.should.be.equal(403)
        done()
      })
    })
  })

  // Competitor A should be able to download simulator ssh keys
  describe('Check download simulator SSH keys with competitor A',
  function() {
    it('should be able to download ssh keys', function(done) {
      let sshId = roundASimSsh.substring(roundASimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Competitor A should be able to download its field computer ssh keys
  describe('Check download field computer SSH keys with competitor A',
  function() {
    it('should be able to download ssh keys', function(done) {
      let sshId = roundAFCSsh.substring(roundAFCSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Admin should be able to download simulator ssh key
  describe('Check download simulator SSH keys with admin',
  function() {
    it('should be able to download ssh keys', function(done) {
      let sshId = roundASimSsh.substring(roundASimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Admin should be able to download field computer ssh key
  describe('Check download field computer SSH keys with admin',
  function() {
    it('should be able to download ssh keys',
    function(done) {
      let sshId = roundAFCSsh.substring(roundAFCSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Competitor B should not be able to download team A's simulator ssh keys
  describe('Check download team A\'s simulator SSH keys with competitor B',
  function() {
    it('should not be authorized', function(done) {
      let sshId = roundASimSsh.substring(roundASimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  // Simulator started by admin but competitor B should still be able to
  // download the ssh key during practice
  describe('Check download simulator SSH keys with competitor B',
  function() {
    it('should be able to download ssh keys during practice',
    function(done) {
      let sshId = roundBSimSsh.substring(roundBSimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Field computer started by admin but competitor B should still be able to
  // download the ssh key during practice
  describe('Check download field computer SSH keys with competitor B',
  function() {
    it('should be able to download ssh keys during pactice',
    function(done) {
      let sshId = roundBFCSsh.substring(roundBFCSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  describe('Delete round A with competitor B', function() {
    it('should not be authorized', function(done) {
      agent
      .delete('/srcrounds/' + roundA)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  describe('Delete round A with admin', function() {
    it('should be successful', function(done) {
      agent
      .delete('/srcrounds/' + roundA)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  describe('Delete round B with competitor B', function() {
    it('should be successful', function(done) {
      agent
      .delete('/srcrounds/' + roundB)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  describe('Delete debug round with admin', function() {
    it('should be successful', function(done) {
      agent
      .delete('/srcrounds/' + roundDebug)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  describe('Check rounds with admin', function() {
    it('should be empty again', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(srcAdmin)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  // Test in competition mode
  describe('Set SRC competiton mode', function() {

    // Post as competitor to set practice mode to false
    it('should not be possible for a competitor to change mode', function(done) {
      agent
      .post('/srcrounds_practice')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .send({
        'practice': false
      })
      .end(function(err,res) {
        res.status.should.be.equal(403)
        done()
      })
    })

    // Post as SRC admin to set practice mode to false
    it('should not be possible for an SRC admin to change mode', function(done) {
      agent
      .post('/srcrounds_practice')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({
        'practice': false
      })
      .end(function(err,res) {
        res.status.should.be.equal(403)
        done()
      })
    })

    // Post as admin missing required fields
    it('should fail to change mode with malformed request', function(done) {
      agent
      .post('/srcrounds_practice')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        'banana': false
      })
      .end(function(err,res) {
        res.status.should.be.equal(400)
        done()
      })
    })

    // Post as admin to set practice mode to false
    it('should be possible for Cloudsim admin to change mode', function(done) {
      agent
      .post('/srcrounds_practice')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        'practice': false
      })
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  // Post as admin to set practice mode to false
  describe('Get SRC competiton mode', function() {
    it('should be able to see mode changed', function(done) {
      // post to set practice to false
      agent
      .get('/srcrounds_practice')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.practice.should.equal(false)
        done()
      })
    })
  })

  // Start new round with competitor B in competition mode
  describe('Start a new round with team B in competition mode',
  function() {
    it('should not be able for competitor B to start new round',
    function(done) {
      // create a round in competition mode
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .send({
        'dockerurl': dockerUrl,
        'team': teamB,
        'simulator': simData,
        'fieldcomputer': fcData
      })
      .end(function(err,res) {
        res.status.should.be.equal(403)
        done()
      })
    })
  })

  // Start new round with admin for competitor B in competition mode
  describe('Start a new round with admin in competition mode, for team B',
  function() {
    it('should create a resource with the correct permissions', function(done) {
      // create a round in competition mode
      let roundId
      let socAdmin = createSocket(srcAdminToken)
      socAdmin.on('connect', function() {
        agent
        .post('/srcrounds')
        .set('Accept', 'application/json')
        .set('authorization', srcAdminToken)
        .send({
          'dockerurl': dockerUrl,
          'team': teamB,
          'simulator': simData,
          'fieldcomputer': fcData
        })
        .end(function(err,res) {
          res.status.should.be.equal(200)
          let response = getResponse(res)
          response.success.should.equal(true)
          roundId = response.id
        })
      })
      socAdmin.on('resource', res => {
        if (res.operation === 'update' && res.resource.indexOf('src') >= 0) {
          roundId.should.not.be.empty()
          res.resource.should.equal(roundId)
          socAdmin.disconnect()
          socAdmin.close()
          done()
        }
      })
    })
  })

  let compRoundB
  let compFCBId
  // Competitor B should be able to see round data in competition mode
  describe('Get rounds with competitor B in competition mode', function() {
    it('should be able to see round resource', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(competitorB)
        response.result.length.should.equal(1)

        // Round data
        compRoundB = response.result[0].name
        compRoundB.indexOf('srcround').should.be.above(-1)

        // competition data permission
        // secure data are hidden
        should.not.exist(response.result[0].data.secure)
        // resource permissions are hidden
        should.not.exist(response.result[0].permissions)
        // only public data are avaialble
        should.exist(response.result[0].data.public)
        should.exist(response.result[0].data.public.simulator_id)
        should.exist(response.result[0].data.public.fieldcomputer_id)
        compFCBId = response.result[0].data.public.fieldcomputer_id

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamB)

        done()
      })
    })
  })

  describe('Get field computer with competitor B in competiton mode',
  function() {
    it('should be possible to see the field computer resource', function(done) {
      const route = '/simulators/' + compFCBId
      agent
      .get(route)
      .set('authorization', competitorBToken)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const r = getResponse(res)
        r.result.data.id.should.equal(compFCBId)
        r.success.should.equal(true)
        done()
      })
    })
  })

  let compRoundBSimSsh
  let compRoundBFCSsh
  // Admins should be able to see round data in competition mode
  describe('Get rounds with admin in competition mode', function() {
    it('should be able to see round resource', function(done) {
      agent
      .get('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdmin2Token)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(srcAdmin2)
        response.result.length.should.equal(1)

        // Round data
        compRoundB = response.result[0].name
        compRoundB.indexOf('srcround').should.be.above(-1)

        // competition data permission
        // secure, public, and permissions data should all be available
        should.exist(response.result[0].data.secure)
        should.exist(response.result[0].permissions)
        should.exist(response.result[0].data.public)

        // admins should be able to get ssh key data
        compRoundBSimSsh = response.result[0].data.secure.simulator_ssh
        compRoundBFCSsh = response.result[0].data.secure.fieldcomputer_ssh

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamB)

        done()
      })
    })
  })

  // Simulator started by admin so competitor B should not be able to download
  // the ssh key in competition mode
  describe('Check download simulator SSH keys with competitor B',
  function() {
    it('should not be able to download ssh keys in competition mode',
    function(done) {
      let sshId = compRoundBSimSsh.substring(
        compRoundBSimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  // Field computer started by admin so competitor B should not be able to
  // download the ssh key in competition mode
  describe('Check download field computer SSH keys with competitor B',
  function() {
    it('should not be able to download ssh keys in competition mode',
    function(done) {
      let sshId = compRoundBFCSsh.substring(
        compRoundBFCSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  // Admin should be able to download simulator ssh key
  describe('Check download simulator SSH keys with admin',
  function() {
    it('should be able to download ssh keys', function(done) {
      let sshId = compRoundBSimSsh.substring(
        compRoundBSimSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Admin should be able to download field computer ssh key
  describe('Check download field computer SSH keys with admin',
  function() {
    it('should be able to download ssh keys',
    function(done) {
      let sshId = compRoundBFCSsh.substring(
        compRoundBFCSsh.lastIndexOf('/')+1)
      sshId.should.not.be.empty()
      agent
      .get('/sshkeys/' + sshId)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  // Competitor B should not be able to delete round in competition mode
  describe('Delete round B with competitor B', function() {
    it('should not be successful', function(done) {
      agent
      .delete('/srcrounds/' + compRoundB)
      .set('Accept', 'application/json')
      .set('authorization', competitorBToken)
      .end(function(err,res) {
        res.status.should.be.equal(401)
        let response = getResponse(res)
        response.success.should.equal(false)
        done()
      })
    })
  })

  // Only admins can delete a round in competition mode
  describe('Delete round with admin', function() {
    it('should be successful', function(done) {
      agent
      .delete('/srcrounds/' + compRoundB)
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  // after all tests have run, we need to clean up our mess
  after(function(done) {
    csgrant.model.clearDb()
    app.close(function() {
      clearRequire.all()
      done()
    })
  })
})
