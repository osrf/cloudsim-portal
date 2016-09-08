'use strict';

console.log('test/mocha/sgroup/controller.js');

require('../../../server/server.js')


/// Module dependencies.
var app = require('../../../server/server')

var util = require('util');
var should = require('should');
var supertest = require('supertest');

// we need fresh keys for this test
const csgrant = require('cloudsim-grant')
const keys = csgrant.token.generateKeys()
csgrant.token.initKeys(keys.public, keys.private)

var adminUser = 'admin';
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN;

let userToken
const userTokenData = {username:adminUser}
let user2Token
const user2TokenData = {username:'user2'}

var user;
var user2;
var agent;

describe('<Unit Test>', function() {

  before(function(done) {
    csgrant.model.clearDb()
    csgrant.token.signToken(userTokenData, (e, tok)=>{
      console.log('token signed for user "' + userTokenData.username  + '"')
      if(e) {
        console.log('sign error: ' + e)
      }
      userToken = tok
      csgrant.token.signToken(user2TokenData, (e, tok)=>{
        console.log('token signed for user "' + user2TokenData.username  + '"')
        if(e) {
          console.log('sign error: ' + e)
        }
        user2Token = tok
        done()
      })
    })
  })

  describe('Security Group Controller:', function() {
    before(function(done) {
      agent = supertest.agent(app);
      done();
    });

    describe('Check Empty Security Groups', function() {
      it('should be no security groups at the beginning',
          function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const data = JSON.parse(res.text);
          data.success.should.equal(true);
          data.result.length.should.be.exactly(0);
          done();
        });
      });
    });

    const sgroup1Name = 'sg1';
    let sgroupId1;
    describe('Check Create Security Group', function() {
      it('should be possible to create a security group', function(done) {
        const data = {resource: sgroup1Name};
        agent
        .post('/sgroups')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send(data)
        .end(function(err,res){
          should.not.exist(err);
          should.exist(res);
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          sgroupId1 = response.id;
          done();
        });
      });
    });

    describe('Check One Security Group Launched', function() {
      it('should be one security group', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(1);
          response.result.length.should.be.exactly(1);
          response.result[0].name.should.equal(sgroupId1);
          response.result[0].data.name.should.equal(sgroup1Name);
          done();
        });
      });
    });

    const sgroup2Name ='sn2';
    let sgroupId2;
    describe('Check Create Second Security Group', function() {
      it('should be possible to create another security group', function(done) {
        const data = {resource: sgroup2Name};
        agent
        .post('/sgroups')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          sgroupId2 = response.id;
          done();
        });
      });
    });

    describe('Check Two Security Groups Created', function() {
      it('should be two security groups', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(2);
          response.result[0].name.should.equal(sgroupId1);
          response.result[0].data.name.should.equal(sgroup1Name);
          response.result[1].name.should.equal(sgroupId2);
          response.result[1].data.name.should.equal(sgroup2Name);
          done();
        });
      });
    });

    describe('Check Remove Security Group', function() {
      it('should be possible to remove a security group', function(done) {
        agent
        .delete('/sgroups')
        .send({resource: sgroupId1})
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          done();
        });
      });
    });

    describe('Check One Security Group Remaining', function() {
      it('should be one security group', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(1);
          response.result[0].name.should.equal(sgroupId2);
          response.result[0].data.name.should.equal(sgroup2Name);
          done();
        });
      });
    });

    after(function(done) {
      csgrant.model.clearDb();
      done();
    });
  });
});
