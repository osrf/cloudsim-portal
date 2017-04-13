'use strict';

console.log('test/machinetypes.js')

const should = require('should')
const supertest = require('supertest')
const clearRequire = require('clear-require');

// current dir: test
const app = require('../server/cloudsim_portal')
const agent = supertest.agent(app)

const csgrant = require('cloudsim-grant')
const token = csgrant.token


// we need fresh keys for this test
const keys = csgrant.token.generateKeys()
token.initKeys(keys.public, keys.private)

const admin = process.env.CLOUDSIM_ADMIN?process.env.CLOUDSIM_ADMIN:'admin'


const adminTokenData = {identities: [admin]}
let adminToken

console.log('adminTokenData', adminTokenData)

// parsing a response on steroids:
// this helper function parses a response into json.
// However, pass true as second argument and it prints
// the content of the cloudsim-grant database and the
// response, (all pretty printed)
function parseResponse(res, log) {
  const text = res.text
  if(log) {
    console.log('\n\n========',log,'==========')
    csgrant.dump()
  }
  let result
  try {
    result = JSON.parse(text)
  }
  catch (e) {
    console.log(text)
  }
  if(log){
    console.log('======== status:', res.status,'==========')
    console.log(res.headers)
    console.log('======== header ==============')
    console.log(res.header)
    console.log('==== response text =====')
    const s = JSON.stringify(result, null, 2)
    console.log(s)
    console.log('========================================\n\n')
  }
  return result
}

describe('<Unit test Machine types>', function() {

  before(function(done) {
    token.signToken(adminTokenData, (e, tok)=>{
      console.log('token signed for user "' + admin + '"')
      if(e) {
        console.log('sign error: ' + e)
        should.fail()
      }
      adminToken = tok
      done()
    })
  })

  let machinetypeId
  describe('Create machine type', function() {
    it('should be possible to create a machine type', function(done) {
      agent
      .post('/machinetypes')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        name: 'test-1',
        region: 'us-west-1',
        hardware: 'hard',
        image: 'soft'
      })
      .end(function(err,res) {
        const response = parseResponse(res, res.status != 200)
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        response.success.should.equal(true)
        machinetypeId = response.id
        done()
      })
    })
  })

  // get all resources
  describe('Get all machine types', function() {
    it('should be possible for admin to get all resources', function(done) {
      agent
      .get('/machinetypes')
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = parseResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(1)
        response.result[0].name.should.equal(machinetypeId)
        response.result[0].data.name.should.equal('test-1')
        response.result[0].data.region.should.equal('us-west-1')
        response.result[0].data.hardware.should.equal('hard')
        response.result[0].data.image.should.equal('soft')
        done()
      })
    })
  })

  // update resource
  describe('Update resource', function() {
    it('change the region', function(done) {
      agent
      .put('/machinetypes/' + machinetypeId)
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({
        region: 'us-east-1'
      })
      .end(function(err,res){
        res.status.should.be.equal(200)
        const response = parseResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  // get all resources
  describe('Get all machine types', function() {
    it('region has changed', function(done) {
      agent
      .get('/machinetypes')
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = parseResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(1)
        response.result[0].name.should.equal(machinetypeId)
        response.result[0].data.name.should.equal('test-1')
        response.result[0].data.region.should.equal('us-east-1')
        response.result[0].data.hardware.should.equal('hard')
        response.result[0].data.image.should.equal('soft')
        done()
      })
    })
  })

  // update resource
  describe('Update resource', function() {
    it('change the region', function(done) {
      agent
      .delete('/machinetypes/' + machinetypeId)
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        const response = parseResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  // get all resources
  describe('Get all machine types', function() {
    it('no resources left', function(done) {
      agent
      .get('/machinetypes')
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        let response = parseResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Create machine type with wrong parameters', function() {
    it('should not be possible to create a machine type', function(done) {
      agent
      .post('/machinetypes')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        name: 'test-1',
        region: 'us-west-1',
        hardware: 'hard',
        software: 'soft'
      })
      .end(function(err,res) {
        res.status.should.be.equal(400)
        done()
      })
    })
  })

  // after all tests have run, we need to clean up our mess
  after(function(done) {
    console.log('after everything')
    csgrant.model.clearDb()
    app.close(function() {
      clearRequire.all()
      done()
    })
  })
})
