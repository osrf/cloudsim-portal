'use strict'

//
// using Redis list for all the events
// leaderboard/events is the list name
//

let util = require('util')
let redis = require("redis").createClient();

var exports = module.exports = {}
let eventsList= 'leaderboard/events'

redis.on("error", function (err) {
        console.log("REDIS Error (events model): " + err);
    });

exports.getAll = function(cb) {

  console.log('events.getAll');
  redis.lrange(eventsList, 0, -1, function (err, events) {
    if(err) {
      console.log(eventsList + ' error: ' + err)
      cb(err)
    }
    if(!events) {
      console.log(eventsList + ' Not found')
      cb(null)
    }
    else {
      let eventList = []
      for(let i=0; i < events.length; i++) {
        let js = JSON.parse(events[i])
        eventList.push(js)
      }
      cb(null, eventList)
    }
  })
}



exports.add = function (eventJson, cb) {
  let eventStr = JSON.stringify(eventJson)
  console.log('[add event] ' + eventStr)
    redis.rpush( eventsList, eventStr, function (err) {
      if(err) {
        console.error(eventsList + ' add event error ' + err)
        cb(err)
        return
      }
      cb(null, eventJson )
  });
}

exports.deleteAll = function (cb) {
  console.log('[deleteAll events] ')
  // remove events list
  redis.del(eventsList, function(err, userId) {
    if (err) {
      console.error(eventsList + ' [del error]: ' + err)
      cb(err)
      return
    }
    cb(null)
  })
}


