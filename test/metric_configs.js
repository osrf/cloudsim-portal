'use strict';

console.log('test/metrics.js')

let csgrant
let app
let agent

const should = require('should')
const supertest = require('supertest')

var adminUser = process.env.CLOUDSIM_ADMIN || 'admin'

// Users
let userToken
const userTokenData = {identities:[adminUser]}
let user2Token
const user2TokenData = {identities:['user2']}

const competitorA = "competitor-A"
const teamA = "SRC-TeamA"
const competitorATokenData = {identities: [competitorA, teamA]}
let competitorAToken

const competitorB = "competitor-B"
const teamB = "SRC-teamB"
const competitorBTokenData = {identities: [competitorB, teamB]}
let competitorBToken

describe('<Unit test Metrics>', function() {

  before(function(done) {
    // Important: the database has to be cleared early, before
    // the server is launched (otherwise, root resources will be missing)
    csgrant = require('cloudsim-grant')
    csgrant.model.clearDb()
    done()
  })

  before(function(done) {
    app = require('../server/cloudsim_portal')
    agent = supertest.agent(app)
    done()
  })

  before(function(done) {
    // we need fresh keys for this test
    const keys = csgrant.token.generateKeys()
    csgrant.token.initKeys(keys.public, keys.private)
    // csgrant.model.clearDb()
    csgrant.token.signToken(userTokenData, (e, tok)=>{
      console.log('token signed for user "' + userTokenData.identities[0]  + '"')
      if(e) {
        should.fail('sign error: ' + e)
      }
      userToken = tok
      should.exist(userToken)
      done()
    })
  })

  before(function(done) {
    csgrant.token.signToken(user2TokenData, (e, tok)=>{
      console.log('token signed for "user2"')
      if(e) {
        should.fail('sign error: ' + e)
      }
      user2Token = tok
      should.exist(user2Token)
      done()
    })
  })

  before(function(done) {
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
        done()
      })
    })
  })

  describe('Test Metrics Configs', function() {
    it('should be possible to get all configs accessible by admin user', function(done) {
      agent
      .get('/metrics/configs')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.result[0].data.should.not.be.empty();
        text.result[0].data.identity.should.equal(adminUser);
        done();
      });
    });
    let configId
    it('the admin should be possible to post a new metrics config targetting TeamA', function(done) {
      agent
      .post('/metrics/configs/')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({ identity: teamA, check_enabled: true, max_instance_hours: 7 })
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(true)
        should.exist(text.id)
        configId = text.id
        text.result.data.should.not.be.empty();
        text.result.data.identity.should.equal(teamA);
        should.not.exist(text.result.data.whitelisted);
        text.result.data.check_enabled.should.equal(true);
        text.result.data.max_instance_hours.should.equal(7);
        should.exist(text.result.permissions[teamA])
        text.result.permissions[teamA].readOnly.should.equal(true);
        done();
      });
    });
    it('should NOT be possible to post a new metrics config targetting a duplicated identity', function(done) {
      agent
      .post('/metrics/configs/')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({ identity: teamA, check_enabled: true, max_instance_hours: 10 })
      .end(function(err,res){
        res.status.should.be.equal(409);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(false)
        done();
      });
    });
    it('should be possible to get configs by users from the targetted team', function(done) {
      agent
      .get('/metrics/configs')
      .set('Acccept', 'application/json')
      .set('authorization', competitorAToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.result[0].data.should.not.be.empty();
        text.result[0].data.identity.should.equal(teamA);
        text.result[0].data.check_enabled.should.equal(true);
        text.result[0].data.max_instance_hours.should.equal(7);
        done();
      });
    });
    it('should NOT be possible to update specific config by users from the targetted team (readonly)', function(done) {
      agent
      .put('/metrics/configs/' + configId)
      .set('Acccept', 'application/json')
      .set('authorization', competitorAToken)
      .send({ max_instance_hours: 5 })
      .end(function(err,res){
        res.status.should.be.equal(401);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(false);
        done();
      });
    });
    it('should not be possible to get configs by non authorized users', function(done) {
      agent
      .get('/metrics/configs')
      .set('Acccept', 'application/json')
      .set('authorization', competitorBToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.result.should.be.empty();
        done();
      });
    });
    it('should not be possible to update specific config by non authorized users', function(done) {
      agent
      .put('/metrics/configs/' + configId)
      .set('Acccept', 'application/json')
      .set('authorization', competitorBToken)
      .send({ max_instance_hours: 8 })
      .end(function(err,res){
        res.status.should.be.equal(401);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(false);
        done();
      });
    });
    it('should be possible to update any config by admin user', function(done) {
      agent
      .put('/metrics/configs/' + configId)
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({ max_instance_hours: 9 })
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.result.data.should.not.be.empty();
        text.result.data.identity.should.equal(teamA);
        text.result.data.check_enabled.should.equal(true);
        text.result.data.max_instance_hours.should.equal(9);
        done();
      });
    });
    it('should NOT be possible to update main config 000 by a non admin user', function(done) {
      agent
      .put('/metrics/configs/metrics-configs-000')
      .set('Acccept', 'application/json')
      .set('authorization', competitorAToken)
      .send({ check_enabled: false})
      .end(function(err,res){
        res.status.should.be.equal(401);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(false);
        done();
      });
    });
  });

  describe('Check Metrics Invalid HTTP Methods', function() {
    it('should not be possible to DEL to metrics/config', function(done) {
      agent
      .del('/metrics/configs')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(404);
        done();
      });
    });
    it('should not be possible to DEL to metrics/config', function(done) {
      agent
      .del('/metrics/configs/:resourceId')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(404);
        done();
      });
    });
    it('should not be possible to PUT to metric configs collection url', function(done) {
      agent
      .put('/metrics/configs')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(404);
        done();
      });
    });    
  });

  after(function(done) {
    console.log('after everything')
    csgrant.model.clearDb()
    // the following readDb is just to make sure we've cleared the db
    csgrant.model.readDb((err2, items) => {
      console.log('items after clearing DB', JSON.stringify(items))
      done()
    })
  })
})
