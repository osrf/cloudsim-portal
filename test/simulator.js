'use strict';


let csgrant
let app


/// Module dependencies.
const should = require('should')
const supertest = require('supertest')

var adminUser = process.env.CLOUDSIM_ADMIN || 'admin'

let userToken
const userTokenData = {identities:[adminUser]}
let user2Token
const user2TokenData = {identities:['user2']}

// the server
let agent

const launchData = {
  region: 'us-west-1',
  hardware:'t2.small',
  image: 'bozo'
}

// parsing a response on steroids:
// this helper function parses a response into json.
// However, pass true as second argument and it prints
// the content of the cloudsim-grant database and the
// response, (all pretty printed)
function parseResponse(text, log) {
  if(log) {
    csgrant.dump()
  }
  let res
  try {
    res = JSON.parse(text)
  }
  catch (e) {
    console.log(text)
    throw e
  }
  if(log){
    const s = JSON.stringify(res, null, 2)
    console.log(s)
  }
  return res
}

describe('<Simulator controller test>', function() {

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

  describe('Check Empty Running Simulator', function() {
    it('should be no running simulators at the beginning',
      function(done) {
        agent
        .get('/simulators')
        .set('authorization', userToken)
        .end(function(err,res){
          const r = parseResponse(res.text)
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          r.result.length.should.be.exactly(0)
          done();
        });
      });
  });

  // verify admin permissions to root resources
  describe('Check All Admin Permissions', function() {
    it('admin should have write permission to all root resources',
    function(done) {
      agent
      .get('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const data = parseResponse(res.text)
        data.success.should.equal(true);
        data.requester.should.equal(adminUser);
        data.result.length.should.be.greaterThanOrEqual(2);

        data.result[0].name.should.be.equal("simulators");
        data.result[0].permissions[0].username.should.be.equal(adminUser);
        data.result[0].permissions[0].permissions.readOnly.should.be.equal(false);

        data.result[1].name.should.be.equal("machinetypes");
        data.result[1].permissions[0].username.should.be.equal(adminUser);
        data.result[1].permissions[0].permissions.readOnly.should.be.equal(false);

        data.result[2].name.should.be.equal("sgroups");
        data.result[2].permissions[0].username.should.be.equal(adminUser);
        data.result[2].permissions[0].permissions.readOnly.should.be.equal(false);

        done();
      });
    });
  });

  var simId1 ='';
  describe('Check Launch Simulator', function() {
    it('should be possible to launch a simulator', function(done) {
      agent
      .post('/simulators')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send(launchData)
      .end(function(err,res){
        should.not.exist(err);
        should.exist(res);
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const data = parseResponse(res.text)
        data.id.should.not.be.empty();
        simId1 = data.id
        data.status.should.equal('LAUNCHING');
        data.region.should.equal('us-west-1');
        done();
      });
    });
  });

  describe('Check One Simulator Launched', function() {
    it('should be one running simulator', function(done) {
      agent
      .get('/simulators')
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        const data  = parseResponse(res.text)
        data.result.length.should.be.exactly(1)
        data.result[0].permissions[0].username.should.equal(adminUser)
        data.result[0].name.should.equal(simId1)
        data.result[0].data.status.should.equal('LAUNCHING')
        data.result[0].data.region.should.equal('us-west-1')
        done()
      })
    })
  })

  let sshId
  describe('generate ssh key', function() {
    it('should be an error to generate a sshkey without a name', function(done) {
      agent
      .post('/sshkeys')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(400)
        const r = parseResponse(res.text, res.status != 400)
        r.success.should.equal(false)
        done()
      })
    })

    it('should be possible to generate an sshkey', function(done) {
      agent
      .post('/sshkeys')
      .set('authorization', userToken)
      .send({name: 'my key'})
      .end(function(err,res){
        res.status.should.be.equal(200)
        const r = parseResponse(res.text, res.status != 200)
        r.success.should.equal(true)
        r.result.name.should.equal('my key')
        sshId = r.id
        r.id.indexOf('sshkey-').should.equal(0)
        done()
      })
    })
  })

  describe('Check key', function() {
    it('ssh key for the simulator', function(done) {
      const url = '/sshkeys/' + sshId
      agent
      .get(url)
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        // no test to verify the data because it is compressed
        // see the zip test for that
        done()
      })
    })
  })

  describe('Remove ssh key', function() {
    it('ssh key for the simulator', function(done) {
      const url = '/sshkeys/' + sshId
      agent
      .delete(url)
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        const r = parseResponse(res.text, res.status != 200)
        r.success.should.equal(true)
        done()
      })
    })
  })

  describe('Check key after removal', function() {
    it('ssh key should be gone', function(done) {
      const url = '/sshkeys'
      agent
      .get(url)
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        const r = parseResponse(res.text, res.status != 200)
        r.success.should.equal(true)
        r.result.length.should.equal(0)
        done()
      })
    })
  })

  describe('Check Get Simulatior by ID', function() {
    it('should be possible to get the first running simulator',
      function(done) {
        const route = '/simulators/' + simId1
        agent
        .get(route)
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const r = parseResponse(res.text)
          r.result.data.id.should.equal(simId1)
          r.result.data.status.should.equal('LAUNCHING')
          r.requester.should.equal(adminUser)
          r.success.should.equal(true)
          r.result.data.region.should.equal('us-west-1')
          done();
        });
      });
  });

  describe('Check Get Simulatior by ID', function() {
    it('should be possible to get the first running simulator',
      function(done) {
        const route = '/simulators/' + simId1
        agent
        .get(route)
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const r = parseResponse(res.text)
          r.result.data.id.should.equal(simId1)
          r.result.data.status.should.equal('LAUNCHING')
          r.requester.should.equal(adminUser)
          r.success.should.equal(true)
          r.result.data.region.should.equal('us-west-1')
          done();
        });
      });
  });

  var simId2 ='';
  describe('Check Launch Second Simulator', function() {
    it('should be possible to create another simulator', function(done) {
      // let's change the region
      const data = JSON.parse(JSON.stringify(launchData))
      data.region = 'us-east-1'
      data.options = {user_data: 'test-data'};
      agent
      .post('/simulators')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send(data)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const r = parseResponse(res.text)
        r.id.should.not.be.empty();
        r.id.should.not.equal(simId1);
        simId2 = r.id
        r.status.should.equal('LAUNCHING')
        r.region.should.equal('us-east-1')
        r.options.user_data.should.equal('test-data')
        r.options.sim_id.should.equal(simId2)
        done();
      });
    });
  });

  describe('Check Two Simulators Launched', function() {
    it('should be two running simulators', function(done) {
      agent
      .get('/simulators')
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var r = parseResponse(res.text)
        r.result.length.should.be.exactly(2);

        var simId1Idx = r.result.map(
           function(e){return e.name}).indexOf(simId1)
        var simId2Idx = r.result.map(
           function(e){return e.name}).indexOf(simId2)

        simId1Idx.should.be.greaterThanOrEqual(0);
        simId2Idx.should.be.greaterThanOrEqual(0);
        simId1Idx.should.not.equal(simId2Idx);

        r.result[simId1Idx].name.should.not.be.empty();
        r.result[simId1Idx].name.should.equal(simId1);
        r.result[simId1Idx].data.status.should.equal('LAUNCHING');
        r.result[simId1Idx].data.region.should.equal('us-west-1');

        r.result[simId2Idx].name.should.not.be.empty();
        r.result[simId2Idx].name.should.equal(simId2);
        r.result[simId2Idx].data.status.should.equal('LAUNCHING');
        r.result[simId2Idx].data.region.should.equal('us-east-1');
        done();
      });
    });
  });

  describe('Check Terminate Simulator', function() {
    it('should be possible to terminate a running simulator', function(done) {
      agent
      .delete('/simulators/' + simId1)
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        done();
      });
    });
  });


  describe('Check One Simulator Remaining', function() {
    it('should be one running simulator and one terminated', function(done) {
      agent
      .get('/simulators')
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        const r = parseResponse(res.text)
        r.result.length.should.be.exactly(2)

        r.result[0].name.should.not.be.empty()
        r.result[0].name.should.equal(simId1)
        r.result[0].data.status.should.equal('TERMINATED')
        r.result[0].data.region.should.equal('us-west-1')

        r.result[1].name.should.not.be.empty()
        r.result[1].name.should.equal(simId2)
        r.result[1].data.status.should.equal('LAUNCHING')
        r.result[1].data.region.should.equal('us-east-1')
        done()
      });
    });
  });

  describe('Check Get Simulator By ID Valid State', function() {
    it('should be possible to get the first simulator by id and verify \
      its new state', function(done) {
      agent
      .get('/simulators/' + simId1)
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const r = parseResponse(res.text)
        r.success.should.equal(true)
        r.result.permissions[0].username.should.equal(adminUser)
        r.resource.should.equal(simId1)
        r.result.data.status.should.equal('TERMINATED');
        done();
      });
    });
  });

  describe('Check Get All Simulators Including Terminated Ones', function() {
    it('should be able to see running and terminated simulators',
      function(done) {
        agent
        .get('/simulators')
        .send()
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          const r = parseResponse(res.text)
          r.result.length.should.be.exactly(2);

          var simId1Idx = r.result.map(
             function(e){return e.name}).indexOf(simId1)
          var simId2Idx = r.result.map(
             function(e){return e.name}).indexOf(simId2)
          simId1Idx.should.be.greaterThanOrEqual(0);
          simId2Idx.should.be.greaterThanOrEqual(0);
          simId1Idx.should.not.equal(simId2Idx);

          r.result[simId1Idx].name.should.not.be.empty()
          r.result[simId1Idx].name.should.equal(simId1)
          r.result[simId1Idx].data.status.should.equal('TERMINATED')
          r.result[simId1Idx].data.region.should.equal('us-west-1')

          r.result[simId2Idx].name.should.not.be.empty();
          r.result[simId2Idx].name.should.equal(simId2);
          r.result[simId2Idx].data.status.should.equal('LAUNCHING');
          r.result[simId2Idx].data.region.should.equal('us-east-1');
          done();
        });
      });
  });

  // create simId3 for permission test
  var simId3 ='';
  describe('Check Launch Third Simulator', function() {
    it('should be possible to create the third simulator', function(done) {
      // let's change the region
      const data = JSON.parse(JSON.stringify(launchData))
      data.region = 'us-east-1'
      agent
      .post('/simulators')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send(data)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.id.should.not.be.empty();
        text.id.should.not.equal(simId1);
        text.id.should.not.equal(simId2);
        simId3 = text.id;
        text.status.should.equal('LAUNCHING');
        text.region.should.equal('us-east-1');
        done();
      });
    });
  });

  // verify admin permission query for launching simulator
  describe('Check Admin Permission to Launch Simulator', function() {
    it('should be possible for admins to access root resource', function(done) {
      agent
      .get('/permissions/simulators')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        var data  = JSON.parse(res.text)
        data.success.should.equal(true)
        data.result.permissions.should.not.be.empty()
        const p = data.result.permissions[0]
        p.username.should.equal(adminUser)
        p.permissions.readOnly.should.equal(false)
        done();
      });
    });
  });

  // verify admin permission query for accessing simulator
  describe('Check Admin Permission to Access Simulator', function() {
    it('should be possible for admins to access simulator',
      function(done) {
        agent
        .get('/permissions/' + simId2)
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          var r = JSON.parse(res.text)
          r.success.should.equal(true)
          r.result.name.should.equal(simId2)
          r.result.permissions.should.not.be.empty()
          const p = r.result.permissions[0]
          p.username.should.equal(adminUser)
          p.permissions.readOnly.should.equal(false)
          done()
        })
      })
  })

  // verify all user permissions
  describe('Check All User2 Permissions', function() {
    it('user2 should not have any permissions', function(done) {
      agent
      .get('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', user2Token)
      .send({})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var data  = JSON.parse(res.text);
        data.success.should.equal(true);
        data.requester.should.equal(user2TokenData.identities[0])
        data.result.length.should.be.equal(0);
        done();
      });
    });
  });

  // verify user permission query for launching simulator
  describe('Check User2 Permission to Launch Simulator:', function() {
    it('should not be possible for user2 to access root resource',
      function(done) {
        agent
        .get('/permissions/simulators')
        .set('Acccept', 'application/json')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(401);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
  });

  // verify user permission query for accessing simulator
  describe('Check User Permission to Access Simulator:', function() {
    it('should not have access to simulator without permission',
      function(done) {
        agent
        .get('/permissions/' + simId3)
        .set('Acccept', 'application/json')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(401);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
  });

  // user2 has no read/write permission to any simulators
  describe('Check Get Simulator without Read Permission', function() {
    it('should not be able to see any running simulators',
      function(done) {
        agent
        .get('/simulators')
        .set('Acccept', 'application/json')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          const r = parseResponse(res.text)
          r.result.length.should.equal(0)
          done();
        });
      });
  });

  // give user2 read permission to simId2
  describe('Grant Read Permission', function() {
    it('should be possible to grant user read permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({resource: simId2, grantee: user2TokenData.identities[0], readOnly: true})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text)
        text.success.should.equal(true);
        text.resource.should.equal(simId2);
        text.grantee.should.equal(user2TokenData.identities[0]);
        text.readOnly.should.equal(true);
        done();
      });
    });
  });

  // verify user permission query for accessing simulator after being granted
  // permision
  describe('Check User Permission to Access Simulator', function() {
    it('should have access to simulator with permission',
      function(done) {
        agent
        .get('/permissions/' + simId2)
        .set('authorization', user2Token)
        .set('Acccept', 'application/json')
        .end(function(err,res){
          const r = parseResponse(res.text)
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          r.success.should.equal(true);
          r.result.name.should.equal(simId2)
          r.result.permissions.should.not.be.empty()
          r.result.permissions.length.should.equal(2)
          // requester user permissions are at position 0
          let puser2 = r.result.permissions[0]
          puser2.username.should.equal(user2TokenData.identities[0])
          puser2.permissions.readOnly.should.equal(true)
          let padmin = r.result.permissions[1]
          padmin.username.should.equal(adminUser)
          padmin.permissions.readOnly.should.equal(false)
          done();
        });
      });
  });

  // user2 should be able to see simId2
  describe('Check Get Simulator with Read Permission', function() {
    it('should be able to see only one running simulator', function(done) {
      agent
      .get('/simulators')
      .set('authorization', user2Token)
      .end(function(err,res){
        const r = parseResponse(res.text)
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        r.result.length.should.be.exactly(1)
        r.result[0].name.should.equal(simId2)
        r.result[0].permissions.length.should.be.exactly(2)
        r.result[0].permissions[0].username.should.equal(user2TokenData.identities[0])
        r.result[0].permissions[0].permissions.readOnly.should.equal(true)
        done()
      });
    });
  });

  // user2 should not be able to terminate simId2 with only read permission
  describe('Check Terminate Simulator without Write Permission', function() {
    it('should not be able to terminate simulator without write permission',
      function(done) {
        agent
        .delete('/simulators/' + simId2)
        .set('Acccept', 'application/json')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(401)
          res.redirect.should.equal(false)
          var text = JSON.parse(res.text)
          text.success.should.equal(false)
          done();
        });
      });
  });

  // give user2 write permission to simId3
  describe('Grant Write Permission', function() {
    it('should be possible to grant user write permission', function(done) {
      agent
      .post('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({resource: simId3, grantee: user2TokenData.identities[0],
        readOnly: false
      }).end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(true);
        text.resource.should.equal(simId3);
        text.grantee.should.equal(user2TokenData.identities[0]);
        text.readOnly.should.equal(false);
        done();
      });
    });
  });

  // user2 should be able to see simId2 and simId3
  describe('Check Get Simulator with Read/Write Permission', function() {
    it('should be able to see only one running simulator', function(done) {
      agent
      .get('/simulators')
      .set('authorization', user2Token)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const r = parseResponse(res.text)
        r.result.length.should.be.exactly(2);
        r.result[0].name.should.not.be.empty();
        r.result[0].name.should.equal(simId2);
        r.result[0].permissions.length.should.be.exactly(2)
        r.result[0].permissions[0].username.should.equal(
          user2TokenData.identities[0]
        )
        r.result[0].permissions[0].permissions.readOnly.should.equal(true);
        r.result[1].name.should.not.be.empty();
        r.result[1].name.should.equal(simId3);
        r.result[1].permissions.length.should.be.exactly(2)
        r.result[1].permissions[0].username.should.equal(user2TokenData.identities[0])
        r.result[1].permissions[0].permissions.readOnly.should.equal(false);
        done();
      });
    });
  });

  // user2 should be able to terminate simId3
  describe('Check Terminate Simulator with Write Permission', function() {
    it('should be able to terminate simulator with write permission',
      function(done) {
        agent
        .delete('/simulators/' + simId3)
        .set('Acccept', 'application/json')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          done();
        });
      });
  });

  // verify simId3 is terminated
  describe('Check One Simulator Remaining', function() {
    it('should be 1 running simulator and 2 terminated ones', function(done) {
      agent
      .get('/simulators')
      .set('authorization', userToken)
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        const r = parseResponse(res.text)
        r.result.length.should.be.exactly(3)
        r.result[1].name.should.equal(simId2)
        r.result[1].data.region.should.equal('us-east-1')
        r.result[1].data.status.should.equal('LAUNCHING')
        r.result[0].data.status.should.equal('TERMINATED')
        r.result[2].data.status.should.equal('TERMINATED')
        done()
      })
    })
  })

  // create simId4 for revoke permission test
  var simId4 ='';
  describe('Check Launch Fourth Simulator', function() {
    it('should be possible to create the fourth simulator', function(done) {
      agent
      .post('/simulators')
      .set('authorization', userToken)
      .set('Acccept', 'application/json')
      .send(launchData)
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        const r = parseResponse(res.text)
        r.id.should.not.be.empty();
        r.id.should.not.equal(simId1);
        r.id.should.not.equal(simId2);
        r.id.should.not.equal(simId3);
        simId4 = r.id
        r.status.should.equal('LAUNCHING');
        r.region.should.equal('us-west-1');
        done();
      });
    });
  });

  // give user2 read permission to simId4
  describe('Grant Read Permission', function() {
    it('should be possible to grant user read permission to more simulators',
      function(done) {
        agent
        .post('/permissions')
        .set('authorization', userToken)
        .set('Acccept', 'application/json')
        .send({resource: simId4, grantee: user2TokenData.identities[0], readOnly: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.resource.should.equal(simId4);
          text.grantee.should.equal(user2TokenData.identities[0]);
          text.readOnly.should.equal(true);
          done();
        });
      });
  });

  // user2 should be able to see simId2 and simId4
  describe('Verify User Read/Write Permission', function() {
    it('should be able to see two running simulators', function(done) {
      agent
      .get('/simulators')
      .set('authorization', user2Token)
      .end(function(err,res){
        const r = parseResponse(res.text)
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        r.result.length.should.be.exactly(3)
        const sims = r.result
        sims[0].name.should.equal(simId2);
        sims[0].permissions.length.should.be.exactly(2);
        sims[0].permissions[0].username.should.equal(user2TokenData.identities[0]);
        sims[0].permissions[0].permissions.readOnly.should.equal(true);
        sims[1].name.should.equal(simId3)
        sims[1].data.status.should.equal('TERMINATED')
        sims[2].name.should.equal(simId4)
        sims[2].permissions.length.should.be.exactly(2)
        sims[2].permissions[0].username.should.equal(user2TokenData.identities[0])
        sims[2].permissions[0].permissions.readOnly.should.equal(true);
        done();
      });
    });
  });

  // revoke user2's read permission to simId4
  describe('Revoke Read Permission', function() {
    it('should be possible to revoke user read permission',
      function(done) {
        agent
        .delete('/permissions')
        .set('authorization', userToken)
        .set('Acccept', 'application/json')
        .send({resource: simId4, grantee: user2TokenData.identities[0], readOnly: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.resource.should.equal(simId4);
          text.grantee.should.equal(user2TokenData.identities[0])
          text.readOnly.should.equal(true);
          done();
        });
      });
  });

  // user2 should be able to see simId2 and simId3 but not simId4
  describe('Verify Revoke User Read Permission', function() {
    it('should be able to see one running simulators', function(done) {
      agent
      .get('/simulators')
      .set('authorization', user2Token)
      .end(function(err,res){
        const r = parseResponse(res.text)
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        r.result.length.should.be.exactly(2)
        r.result[0].name.should.not.be.empty()
        r.result[0].name.should.be.equal(simId2)
        r.result[1].name.should.be.equal(simId3)
        done();
      });
    });
  });

  // user2 should not be able to get simId4 without read permission
  describe('Check Get Simulator By ID No Read Permission', function() {
    it('should not be possible to get the simulator by id without permission',
      function(done) {
        agent
        .get('/simulators/' + simId4)
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(401)
          res.redirect.should.equal(false)
          done()
        })
      })
  })

  // update user2's read permission to write permission to simId2
  describe('Update Read to Write Permission', function() {
    it('should be possible to update user from read to write permission',
      function(done) {
        agent
        .post('/permissions')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send({resource: simId2, grantee: user2TokenData.identities[0], readOnly: false})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.resource.should.equal(simId2);
          text.grantee.should.equal(user2TokenData.identities[0]);
          text.readOnly.should.equal(false);
          done();
        });
      });
  });

  // verify user2 has write permission to simId2
  describe('Verify Update User Write Permission', function() {
    it('should be able to see write permission in user permission list',
      function(done) {
        agent
        .get('/simulators')
        .set('authorization', user2Token)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          const r = parseResponse(res.text)
          const sims = r.result
          sims.length.should.be.exactly(2)
          sims[0].name.should.equal(simId2)
          sims[0].permissions.length.should.be.exactly(2)
          sims[0].permissions[0].username.should.equal(user2TokenData.identities[0])
          sims[0].permissions[0].permissions.readOnly.should.equal(false)
          done();
        });
      });
  });

  // verify user2's write permission to simId2 cannot be revoke
  // using readOnly = true
  describe('Revoke Write Permission with ReadOnly flag', function() {
    it('should not be possible to revoke user write permission with read',
      function(done) {
        agent
        .delete('/permissions')
        .set('Acccept', 'application/json')
        .set('authorization', userToken)
        .send({resource: simId2, grantee: user2TokenData.identities[0], readOnly: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
  });

  // revoke user2's write permission to simId2
  describe('Revoke User Write Permission', function() {
    it('should be able to revoke write permission', function(done) {
      agent
      .delete('/permissions')
      .set('Acccept', 'application/json')
      .set('authorization', userToken)
      .send({resource: simId2, grantee: user2TokenData.identities[0], readOnly: false})
      .end(function(err,res){
        res.status.should.be.equal(200);
        res.redirect.should.equal(false);
        var text = JSON.parse(res.text);
        text.success.should.equal(true);
        text.resource.should.equal(simId2);
        text.grantee.should.equal(user2TokenData.identities[0])
        text.readOnly.should.equal(false);
        done();
      });
    });
  });

  // user2 should not be able to see any running simulators
  describe('Verify Revoke User Write Permission', function() {
    it('should not be able to see any running simulators', function(done) {
      agent
      .get('/simulators')
      .set('authorization', user2Token)
      .end(function(err,res){
        res.status.should.be.equal(200)
        res.redirect.should.equal(false)
        const r = parseResponse(res.text)
        r.result.length.should.be.exactly(1)
        r.result[0].data.status.should.equal('TERMINATED')
        done()
      });
    });
  });

  // verify simulators' user permission list
  describe('Verify Simulators User Permissions', function() {
    it('should be to get all simulators and verify no users have permissions',
      function(done) {
        agent
        .get('/simulators')
        .set('authorization', userToken)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          const r = parseResponse(res.text)
          const sims = r.result
          sims.length.should.be.exactly(4)
          sims[0].name.should.equal(simId1)
          sims[0].data.status.should.equal('TERMINATED')
          sims[0].permissions.length.should.be.exactly(1)

          sims[1].name.should.equal(simId2)
          sims[1].data.status.should.equal('LAUNCHING')
          sims[1].permissions.length.should.be.exactly(1)

          sims[2].name.should.equal(simId3)
          sims[2].data.status.should.equal('TERMINATED')
          sims[2].permissions.length.should.be.exactly(2)

          sims[3].name.should.equal(simId4)
          sims[3].data.status.should.equal('LAUNCHING')
          sims[3].permissions.length.should.be.exactly(1)
          done();
        });
      });
  });

  after(function(done) {
    csgrant.model.clearDb();
    done();
  });
})

