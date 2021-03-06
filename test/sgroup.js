'use strict';

console.log('test/mocha/sgroup/controller.js');

let app
let csgrant
/// Module dependencies.
const should = require('should');
const supertest = require('supertest');
const clearRequire = require('clear-require');

let adminUser
let userTokenData
let userToken

let agent;

describe('<SGroup Unit Test>', function() {

  before(function(done) {
    // Important: the database has to be cleared early, before
    // the server is launched (otherwise, root resources will be missing)
    csgrant = require('cloudsim-grant')
    csgrant.model.clearDb()
    done()
  })

  before(function(done) {
    app = require('../server/cloudsim_portal')
    app.on('ready', () => {
      agent = supertest.agent(app)
      done()
    })
  })

  before(function(done) {
    // we need fresh keys for this test
    const keys = csgrant.token.generateKeys()
    csgrant.token.initKeys(keys.public, keys.private)
    done()
  })

  before(function(done) {
    adminUser = process.env.CLOUDSIM_ADMIN || 'admin'
    userTokenData = {identities:[adminUser]}

    csgrant.token.signToken(userTokenData, (e, tok)=>{
      if(e) {
        console.log('sign error: ' + e)
      }
      userToken = tok
      done()
    })
  })

  describe('Security Group Controller:', function() {
    // no security groups at beginning
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

    // create group 1
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

    // verify group 1 data
    describe('Check One Security Group Created', function() {
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

    // create group 1
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

    // verify group 1 and 2 data
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

    // remove group 1
    describe('Check Remove Security Group', function() {
      it('should be possible to remove a security group', function(done) {
        agent
        .delete('/sgroups/' + sgroupId1)
        .send({})
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

    // verify group 1 no longer exists
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

    // create group 3 for testing rules
    const sgroup3Name ='sn3';
    let sgroupId3;
    describe('Check Create Third Security Group', function() {
      it('should be possible to create another security group', function(done) {
        const data = {resource: sgroup3Name};
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
          sgroupId3 = response.id;
          done();
        });
      });
    });

    // check that group 3 has inbound rules that enable traffic from
    // the group itself
    describe('Check Default Security Group Rule', function() {
      it('should be have default security group rules', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(2);
          response.result[0].name.should.equal(sgroupId2);
          response.result[0].data.name.should.equal(sgroup2Name);
          response.result[0].data.rules.length.should.equal(1);
          const rule = response.result[0].data.rules;
          rule[0].type.should.equal('inbound');
          rule[0].sourceGroupName.should.equal(sgroup2Name);
          response.result[1].name.should.equal(sgroupId3);
          response.result[1].data.name.should.equal(sgroup3Name);
          response.result[1].data.rules.length.should.equal(1);
          const rule1 = response.result[1].data.rules;
          rule1[0].type.should.equal('inbound');
          rule1[0].sourceGroupName.should.equal(sgroup3Name);
          done();
        });
      });
    });

    // update group 3 rules to allow inbound traffic from group 2
    describe('Check Update Security Group with New Rule', function() {
      it('should be possible to update security group rules', function(done) {
        const data = {rules: [{type:'inbound', sourceGroupName: sgroup2Name},
                              {type:'inbound', sourceGroupName: sgroup3Name}]}
        agent
        .put('/sgroups/' + sgroupId3)
        .send(data)
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

    // verify that group 3 has rules to allow inbound traffic from group 2
    describe('Check New Security Group Rules Added', function() {
      it('should have two security group rules for group 3', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(2);
          response.result[0].name.should.equal(sgroupId2);
          response.result[0].data.name.should.equal(sgroup2Name);
          response.result[0].data.rules.length.should.equal(1);
          const rule = response.result[0].data.rules;
          rule[0].type.should.equal('inbound');
          rule[0].sourceGroupName.should.equal(sgroup2Name);
          response.result[1].name.should.equal(sgroupId3);
          response.result[1].data.name.should.equal(sgroup3Name);
          response.result[1].data.rules.length.should.equal(2);
          const rule1 = response.result[1].data.rules;
          rule1[0].type.should.equal('inbound');
          rule1[0].sourceGroupName.should.equal(sgroup2Name);
          rule1[1].type.should.equal('inbound');
          rule1[1].sourceGroupName.should.equal(sgroup3Name);
          done();
        });
      });
    });

    // update group 3 rules to remove inbound traffic from itself
    // (instances launched in this group will no longer be able to talk to
    // each other)
    describe('Check Update Security Group with One Fewer Rule', function() {
      it('should be possible to update security group rules', function(done) {
        const data = {rules: [{type:'inbound', sourceGroupName: sgroup2Name}]}
        agent
        .put('/sgroups/' + sgroupId3)
        .send(data)
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

    // verify that group 3 no longer has rules to allow inbound traffic from
    // itself
    describe('Check Security Group Rules Updated', function() {
      it('should have one security group rules for group 3', function(done) {
        agent
        .get('/sgroups')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          response.result.length.should.be.exactly(2);
          response.result[0].name.should.equal(sgroupId2);
          response.result[0].data.name.should.equal(sgroup2Name);
          response.result[0].data.rules.length.should.equal(1);
          const rule = response.result[0].data.rules;
          rule[0].type.should.equal('inbound');
          rule[0].sourceGroupName.should.equal(sgroup2Name);
          response.result[1].name.should.equal(sgroupId3);
          response.result[1].data.name.should.equal(sgroup3Name);
          response.result[1].data.rules.length.should.equal(1);
          const rule1 = response.result[1].data.rules;
          rule1[0].type.should.equal('inbound');
          rule1[0].sourceGroupName.should.equal(sgroup2Name);
          done();
        });
      });
    });

    // remove group 3
    describe('Check Remove a Security Group by ID', function() {
      it('should be possible to remove security group by ID', function(done) {
        agent
        .delete('/sgroups/' + sgroupId3)
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send({})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const response = JSON.parse(res.text);
          response.success.should.equal(true);
          done();
        });
      });
    });

    // verify group 3 no longer exists
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

    // invalid params
    describe('Create security group missing params', function() {
      it('should not be possible to create a security group', function(done) {
        const data = {banana: sgroup1Name};
        agent
        .post('/sgroups')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(400);
          done();
        });
      });
    });

    // after all tests have run, we need to clean up our mess
    after(function(done) {
      app.close(function() {
        csgrant.model.clearDb(() => {
          clearRequire.all()
          done()
        })
      })
    })
  });
});
