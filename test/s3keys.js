'use strict';

const should = require('should')
const supertest = require('supertest')
const clearRequire = require('clear-require');

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

const user = "user"
const userTokenData = {identities: [user]}
let userToken

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

describe('<Unit test S3 keys>', function() {

  before(function(done) {
    token.signToken(adminTokenData, (e, tok)=>{
      console.log('token signed for user "' + admin + '"')
      if(e) {
        console.log('sign error: ' + e)
        should.fail()
      }
      adminToken = tok
      csgrant.token.signToken(userTokenData, (e, tok)=>{
        if(e) {
          console.log('sign error: ' + e)
        }
        userToken = tok
        done()
      })
    })
  })

  describe('Get all S3 keys', function() {
    it('should be no resources yet', function(done) {
      agent
      .get('/s3keys')
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

  let s3keyId
  let identityData = 'aidentitii'
  let bucketData = 'baketto_neemu'
  let accessKeyData = 'akusesu_kii'
  let secretKeyData = 'shikuretto_kii'
  describe('Create S3 key with admin', function() {
    it('should be possible to create S3 key', function(done) {
      agent
      .post('/s3keys')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        identity: identityData,
        bucket_name: bucketData,
        access_key: accessKeyData,
        secret_key: secretKeyData
      })
      .end(function(err,res) {
        const response = parseResponse(res, res.status != 200)
        res.status.should.be.equal(200)
        response.success.should.equal(true)
        s3keyId = response.id
        done()
      })
    })
  })

  describe('Create S3 key with wrong parameters', function() {
    it('should not be possible to create a S3 key', function(done) {
      agent
      .post('/s3keys')
      .set('Accept', 'application/json')
      .set('authorization', adminToken)
      .send({
        banana: 'banana',
      })
      .end(function(err,res) {
        res.status.should.be.equal(400)
        done()
      })
    })
  })

  describe('Create S3 key with user', function() {
    it('should not have permission', function(done) {
      agent
      .post('/s3keys')
      .set('Accept', 'application/json')
      .set('authorization', userToken)
      .send({
        identity: identityData,
        bucket_name: bucketData,
        access_key: accessKeyData,
        secret_key: secretKeyData
      })
      .end(function(err,res) {
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  describe('Get all S3 keys', function() {
    it('should be possible for admin to get all resources', function(done) {
      agent
      .get('/s3keys')
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
        response.result[0].name.should.equal(s3keyId)
        response.result[0].data.identity.should.equal(identityData)
        response.result[0].data.bucket_name.should.equal(bucketData)
        response.result[0].data.access_key.should.equal(accessKeyData)
        response.result[0].data.secret_key.should.equal(secretKeyData)
        done()
      })
    })
  })

  describe('Update resource with admin', function() {
    it('should be successful', function(done) {
      agent
      .put('/s3keys/' + s3keyId)
      .set('Acccept', 'application/json')
      .set('authorization', adminToken)
      .send({
        identity: 'id'
      })
      .end(function(err,res){
        res.status.should.be.equal(200)
        const response = parseResponse(res)
        response.success.should.equal(true)
        done()
      })
    })
  })

  describe('Update resource with user', function() {
    it('should not be allowed', function(done) {
      agent
      .put('/s3keys/' + s3keyId)
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({
        identity: 'userId'
      })
      .end(function(err,res){
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  describe('Get all S3 keys', function() {
    it('should have the new id', function(done) {
      agent
      .get('/s3keys')
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
        response.result[0].name.should.equal(s3keyId)
        response.result[0].data.identity.should.equal('id')
        response.result[0].data.bucket_name.should.equal(bucketData)
        response.result[0].data.access_key.should.equal(accessKeyData)
        response.result[0].data.secret_key.should.equal(secretKeyData)
        done()
      })
    })
  })

  describe('Remove S3 key with user', function() {
    it('should not have permission', function(done) {
      agent
      .delete('/s3keys/' + s3keyId)
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(401)
        done()
      })
    })
  })

  describe('Remove S3 key with admin', function() {
    it('should not have permission', function(done) {
      agent
      .delete('/s3keys/' + s3keyId)
      .set('authorization', adminToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        done()
      })
    })
  })

  describe('Get all S3 keys', function() {
    it('should be empty', function(done) {
      agent
      .get('/s3keys')
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
