'use strict';

console.log('test/machinetypes.js')

const util = require('util')
const should = require('should')
const supertest = require('supertest')

// current dir: test
const app = require('../server/server')
const agent = supertest.agent(app)

const csgrant = require('cloudsim-grant')
const token = csgrant.token


// we need fresh keys for this test
const keys = csgrant.token.generateKeys()
token.initKeys(keys.public, keys.private)

const admin = process.env.CLOUDSIM_ADMIN?process.env.CLOUDSIM_ADMIN:'admin'


const adminTokenData = {username: admin}
let adminToken

console.log('adminTokenData', adminTokenData)

function getResponse(res, print) {
  const response = JSON.parse(res.text)
  if(print) {
    csgrant.dump()
    console.trace(JSON.stringify(response, null, 2 ))
  }
  return response
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

  let mtId
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
        software: 'soft'
       })
      .end(function(err,res) {
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        const response = getResponse(res)
        response.success.should.equal(true)
        mtId = response.id
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
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(1)
        response.result[0].name.should.equal(mtId)
        response.result[0].data.name.should.equal('test-1')
        response.result[0].data.region.should.equal('us-west-1')
        response.result[0].data.hardware.should.equal('hard')
        response.result[0].data.software.should.equal('soft')
        done()
      })
    })
  })

  // update resource
  describe('Update resource', function() {
    it('change the region', function(done) {
      agent
      .put('/machinetypes/' + mtId)
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({
        region: 'us-east-1'

      })
      .end(function(err,res){
        res.status.should.be.equal(200)
        const response = getResponse(res)
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
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(1)
        response.result[0].name.should.equal(mtId)
        response.result[0].data.name.should.equal('test-1')
        response.result[0].data.region.should.equal('us-east-1')
        response.result[0].data.hardware.should.equal('hard')
        response.result[0].data.software.should.equal('soft')
        done()
      })
    })
  })

  // update resource
  describe('Update resource', function() {
    it('change the region', function(done) {
      agent
      .delete('/machinetypes/' + mtId)
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        const response = getResponse(res)
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
        let response = getResponse(res)
        response.success.should.equal(true)
        response.requester.should.equal(admin)
        response.result.length.should.equal(0)
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
