'use strict';

console.log('test/mocha/subnet/controller.js');

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

  describe('Subnet Controller:', function() {
    before(function(done) {
      agent = supertest.agent(app);
      done();
    });

    describe('Check Empty Subnets', function() {
      it('should be no subnets at the beginning',
          function(done) {
        agent
        .get('/subnets')
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

//    var subnetId1 ='sn1';
    const subnet1Name = 'sn1';
    let subnetId1;
    describe('Check Create Subnet', function() {
      it('should be possible to create a subnet', function(done) {
        const data = {resource: subnet1Name};
        agent
        .post('/subnets')
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
          subnetId1 = response.id;
          done();
        });
      });
    });

    describe('Check One Subnet Launched', function() {
      it('should be one running subnet', function(done) {
        agent
        .get('/subnets')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(1);
          done();
        });
      });
    });

    const subnet2Name ='sn2';
    let subnetId2;
    describe('Check Launch Second Subnet', function() {
      it('should be possible to create another subnet', function(done) {
        const data = {resource: subnet2Name};
        agent
        .post('/subnets')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          subnetId2 = response.id;
          done();
        });
      });
    });

    describe('Check Two Subnets Launched', function() {
      it('should be two subnets', function(done) {
        agent
        .get('/subnets')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(2);
          done();
        });
      });
    });

    describe('Check Remove Subnet', function() {
      it('should be possible to remove a subnet', function(done) {
        agent
        .delete('/subnets')
        .send({resource: subnetId1})
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

    describe('Check One Subnet Remaining', function() {
      it('should be one subnet', function(done) {
        agent
        .get('/subnets')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(1);
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
