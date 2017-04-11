'use strict';

const should = require('should')
const supertest = require('supertest')

// current dir: test
const app = require('../server/cloudsim_portal')
const agent = supertest.agent(app)

const csgrant = require('cloudsim-grant')
const token = csgrant.token

// we need fresh keys for this test
const keys = csgrant.token.generateKeys()
token.initKeys(keys.public, keys.private)

// Cloudsim admin
const admin = process.env.CLOUDSIM_ADMIN ?
    process.env.CLOUDSIM_ADMIN : 'admin'

// Users for testing:
// * Cloudsim + SRC admin
// * SRC admin
// * competitor
// * non-participant
const srcAdmin = "src-admin"
const srcAdminTokenData = {identities: [srcAdmin, "src-admins", admin]}
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

// Fake official machine type params
let officialRegion = "officialRegion"
let officialHardware = "officialHardware"
let officialImage = "officialImage"

// Fake custom simulator data
let simData = {
  region: 'region',
  hardware: 'hardware',
  image: 'image'
}

// Fake custom field computer data
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

describe('<Unit test SRC rounds>', function() {

  before(function(done) {
    csgrant.model.clearDb()

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
              done()
            })
          })
        })
      })
    })
  })

  let simMachineId
  describe('Create simulator machine type', function() {
    it('should be possible to create machine type', function(done) {
      agent
      .post('/machinetypes')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({
        name: 'src-simulator',
        region: officialRegion,
        hardware: officialHardware,
        image: officialImage
      })
      .end(function(err,res) {
        const response = getResponse(res, res.status != 200)
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        response.success.should.equal(true)
        simMachineId = response.id
        done()
      })
    })
  })

  let fcMachineId
  describe('Create field computer machine type', function() {
    it('should be possible to create machine type', function(done) {
      agent
      .post('/machinetypes')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({
        name: 'src-fieldcomputer',
        region: officialRegion,
        hardware: officialHardware,
        image: officialImage
      })
      .end(function(err,res) {
        const response = getResponse(res, res.status != 200)
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        response.success.should.equal(true)
        fcMachineId = response.id
        done()
      })
    })
  })

  describe('Share sim machine type with team A', function() {
    it('should be possible to grant team A read permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({resource: simMachineId, grantee: teamA, readOnly: true})
      .end(function(err,res){
        res.status.should.be.equal(200);
        let text = JSON.parse(res.text)
        text.success.should.equal(true);
        text.resource.should.equal(simMachineId);
        text.grantee.should.equal(teamA);
        text.readOnly.should.equal(true);
        done();
      });
    });
  });

  describe('Share sim machine type with team B', function() {
    it('should be possible to grant team B read permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({resource: simMachineId, grantee: teamB, readOnly: true})
      .end(function(err,res){
        res.status.should.be.equal(200);
        let text = JSON.parse(res.text)
        text.success.should.equal(true);
        text.resource.should.equal(simMachineId);
        text.grantee.should.equal(teamB);
        text.readOnly.should.equal(true);
        done();
      });
    });
  });

  describe('Share fc machine type with team A', function() {
    it('should be possible to grant team A read permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({resource: fcMachineId, grantee: teamA, readOnly: true})
      .end(function(err,res){
        res.status.should.be.equal(200);
        let text = JSON.parse(res.text)
        text.success.should.equal(true);
        text.resource.should.equal(fcMachineId);
        text.grantee.should.equal(teamA);
        text.readOnly.should.equal(true);
        done();
      });
    });
  });

  describe('Share fc machine type with team B', function() {
    it('should be possible to grant team B read permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({resource: fcMachineId, grantee: teamB, readOnly: true})
      .end(function(err,res){
        res.status.should.be.equal(200);
        let text = JSON.parse(res.text)
        text.success.should.equal(true);
        text.resource.should.equal(fcMachineId);
        text.grantee.should.equal(teamB);
        text.readOnly.should.equal(true);
        done();
      });
    });
  });

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
      .send({
        'dockerurl': dockerUrl,
      })
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
    it('should create a resource with the correct permissions and custom machines', function(done) {
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

        // Input data
        response.result.data.dockerurl.should.equal(dockerUrl)
        response.result.data.team.should.equal(debugTeam)
        response.result.data.simulator.image.should.equal(simData.image)
        response.result.data.fieldcomputer.image.should.equal(fcData.image)

        // Permissions
        should.not.exist(response.result.permissions[srcAdmin])
        response.result.permissions['src-admins'].readOnly.should.equal(false)
        response.result.permissions[debugTeam].readOnly.should.equal(true)
        done()
      })
    })
  })

  describe('Start a new round with competitor', function() {
    it('should create a resource with the correct permissions and official machine types', function(done) {
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', competitorAToken)
      .send({
        'dockerurl': dockerUrl,
      })
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)

        // Input data
        response.result.data.dockerurl.should.equal(dockerUrl)
        response.result.data.team.should.equal(teamA)

        // Official machines
        response.result.data.simulator.image.should.equal(officialImage)
        response.result.data.fieldcomputer.image.should.equal(officialImage)

        // Permissions
        should.not.exist(response.result.permissions[competitorA])
        response.result.permissions['src-admins'].readOnly.should.equal(false)
        response.result.permissions[teamA].readOnly.should.equal(true)
        done()
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

        response.result[0].permissions.length.should.equal(2)
        response.result[0].permissions[0].username.should.equal(
          'src-admins')
        response.result[0].permissions[0].permissions.readOnly.should.equal(
          false)
        response.result[0].permissions[1].username.should.equal(debugTeam)
        response.result[0].permissions[1].permissions.readOnly.should.equal(
          true)

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
          true)

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
          true)

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
          true)

        done()
      })
    })
  })

  describe('Get rounds with competitor A', function() {
    it('should have one round and no access to secure data', function(done) {
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
        should.not.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamA)

        // Permissions
        should.not.exist(response.result[0].permissions)

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
    it('should create a resource with the correct permissions and official machines', function(done) {
      agent
      .post('/srcrounds')
      .set('Accept', 'application/json')
      .set('authorization', srcAdminToken)
      .send({
        'dockerurl': dockerUrl,
        'team': teamB,
      })
      .end(function(err,res) {
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)

        // Official machines
        response.result.data.simulator.image.should.equal(officialImage)
        response.result.data.fieldcomputer.image.should.equal(officialImage)

        done()
      })
    })
  })

  let roundB
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
        should.not.exist(response.result[0].data.secure)
        should.exist(response.result[0].data.public)

        response.result[0].data.dockerurl.should.equal(dockerUrl)
        response.result[0].data.team.should.equal(teamB)

        // Permissions
        should.not.exist(response.result[0].permissions)

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

  describe('Start a round for B with competitor A', function() {
    it('should start a round for A, not B, and use official machines, not the input', function(done) {
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
        res.status.should.be.equal(200)
        let response = getResponse(res)
        response.success.should.equal(true)
        response.result.data.team.should.equal(teamA)

        // Official machines
        response.result.data.simulator.image.should.equal(officialImage)
        response.result.data.fieldcomputer.image.should.equal(officialImage)

        done()
      })
    })
  })

  after(function(done) {
    console.log('after everything')
    csgrant.model.clearDb()
    done()
  })

})
