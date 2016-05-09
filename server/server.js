'use strict'

let express = require('express')
let app = express()
let util = require('util')
let fs = require('fs')
let bodyParser = require('body-parser')

let httpServer = null
let io = null

const useHttps = true
if(useHttps) {
  const keyPath = __dirname + '/key.pem'
  const certPath = __dirname + '/key-cert.pem'
  const privateKey  = fs.readFileSync(keyPath, 'utf8')
  const certificate = fs.readFileSync(certPath, 'utf8')
  httpServer = require('https').Server({key: privateKey, cert: certificate}, app)
}
else {
  httpServer = require('http').Server(app)
}

app.use(bodyParser.json())

io = require('socket.io')(httpServer)

var socketioJwt = require('socketio-jwt');
var dotenv = require('dotenv');

var xtend = require('xtend');
var jwt = require('jsonwebtoken');
var UnauthorizedError = require('./UnauthorizedError');

const spawn = require('child_process').spawn
const ansi_to_html = require('ansi-to-html')
const ansi2html = new ansi_to_html()

console.log('portal server.js')


dotenv.load();

var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
}

function autho(socket) {
    console.log('\n\nautho for new socket')

    var options = {
      // secret: Buffer(JSON.stringify(process.env.CLIENT_SECRET), 'base64'),
      secret: Buffer(JSON.stringify("gzsecret"), 'base64'),
      timeout: 15000 // 15 seconds to send the authentication message
    }

    var server = this.server || socket.server;

    if (!server.$emit) {
      //then is socket.io 1.0
      var Namespace = Object.getPrototypeOf(server.sockets).constructor;
      if (!~Namespace.events.indexOf('authenticated')) {
        Namespace.events.push('authenticated');
      }
    }
    if(options.required){
      var auth_timeout = setTimeout(function () {
        socket.disconnect('unauthorized');
      }, options.timeout || 5000);
    }

    socket.on('authenticate', function (data) {
      console.log('authenticate... token[' + data.token + ']')
      if(options.required){
        clearTimeout(auth_timeout);
      }
      // error handler
      var onError = function(err, code) {
          if (err) {
            code = code || 'unknown';
            var error = new UnauthorizedError(code, {
              message: (Object.prototype.toString.call(err) === '[object Object]' && err.message) ? err.message : err
            });
            socket.emit('unauthorized', error, function() {
              socket.disconnect('unauthorized');
            });
            return; // stop logic, socket will be close on next tick
          }
      };
      if(typeof data.token !== "string") {
        return onError({message: 'invalid token datatype'}, 'invalid_token');
      }

      var onJwtVerificationReady = function(err, decoded) {
        console.log('after token verification')
        // success handler
        var onSuccess = function() {
          console.log('on success decoded: ' + JSON.stringify(decoded))
          socket.decoded_token = decoded;
          socket.emit('authenticated');
          if (server.$emit) {
            server.$emit('authenticated', socket);
          } else {
            //try getting the current namespace otherwise fallback to all sockets.
            var namespace = (server.nsps && socket.nsp &&
                             server.nsps[socket.nsp.name]) ||
                            server.sockets;

            // explicit namespace
            namespace.emit('authenticated', socket);
          }
        };

        console.log('BYPASS!!')
        return onSuccess()

        if (err) {
          console.log('error during validation');
          return onError(err, 'invalid_token');
        }

        if(options.additional_auth && typeof options.additional_auth === 'function') {
          options.additional_auth(decoded, onSuccess, onError);
        } else {
          onSuccess();
        }
      };

      var onSecretReady = function(err, secret) {
        if (err || !secret) {
          return onError(err, 'invalid_secret');
        }
        console.log('secret: ' + secret)
        jwt.verify(data.token, secret, options, onJwtVerificationReady);

      };

      // console.log('call getSecret from socket.on("authenticate")')
      // getSecret(socket.request, options.secret, data.token, onSecretReady);
      console.log('onSecretReady')
      onSecretReady(null, options.secret)
    });
  }

io
  .on('connection', autho )
  .on('authenticated', function(socket){
    console.log('connected & authenticated: ' + JSON.stringify(socket.decoded_token));
    let gzlauncher = {proc:null, output:'', state: 'ready', cmdline:''}
    socket.on('gz-launcher', function(msg) {
      console.log('received: ' + JSON.stringify(msg))
      if (msg.cmd === 'run'){
        const items = msg.cmdline.split(' ')
        const proc = items[0]
        const args = items.slice(1)
        console.log('spwaning: ' + proc + ' ' + args)

        gzlauncher.proc = spawn(proc, args, {stdio:'pipe'})
        gzlauncher.state = 'running'
        gzlauncher.cmdline = msg.cmdline

        var onNewData = function (buf) {
          const txt = buf.toString()
          // replace new lines with html line breaks
          const html = txt.split('\n').join('<br>')
          // convert the console color codes to html
          //   ex: "[0m[1;31m:[0m[1;31m96[0m[1;31m] [0m[1;31m"
          const ansi = ansi2html.toHtml(html)
          gzlauncher.output += ansi
          const msg = {output: gzlauncher.output,
            state:gzlauncher.state,
            pid:gzlauncher.proc.pid }
          console.log(msg)
          return msg
        }

        gzlauncher.proc.stdout.on('data', (data)=> {
          io.emit('gz-launcher', onNewData(data))
        })
        gzlauncher.proc.stderr.on('data', (data)=> {
          io.emit('gz-launcher', onNewData(data))
        })
        gzlauncher.proc.on('close', (code)=>{
	        console.log('gzlauncher.proc.on close')
          gzlauncher.state = 'closed'
          // tell client
          io.emit('gz-launcher', {output: gzlauncher.output,
            state:gzlauncher.state,
            pid:gzlauncher.proc.pid })
          gzlauncher = null
        })
        // io.emit('gz-launcher', msg);
      }
      if (msg.cmd === 'kill'){
        console.log('kill message received')
        gzlauncher.proc.kill()
      }
		});
	});

// app.use(express.static(__dirname + '../public'));


app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/../public/index.html')
  let s = `
    <h1>Cloudloop portal running</h1>
`
  res.end(s)
})

let sims = []

app.get('/simulations', function (req, res) {

  console.log('body: ' + util.inspect(req.body))
  let s = `
    [{name:'walking', id:'1', score:'1.1'},
     {name:'manipulation', id:'2', score:'2.2'},
     {name:'navigation', id:'3', score:'3.3'}]`

  console.log('/simulations' +  s)
  res.end(s)
})

app.post('/simulation', function(req, res) {

  console.log('body: ' + util.inspect(req.body))
  console.log('query: ' + util.inspect(req.query))

  res.end('{"success":"true"}')
})

// app.post('/register', UserRoutes.register)
// app.post('/unregister', UserRoutes.unregister)

let port = 4000
if (process.argv.length > 2) {
  // console.log(process.argv[0])
  // console.log(process.argv[1])
  // console.log(process.argv[2])
  port = Number(process.argv[2])
}

httpServer.listen(port, function(){

  console.log('ssl: ' + useHttps)
	console.log('listening on *:' + port);
});

