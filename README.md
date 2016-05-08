# README #

This is the portal  server for Cloudsim

### What is this repository for? ###

* A web app that manages simulation runs (create, view log)
* Has different types of users (to create, share and start simulation runs)
* Launches new AWS gpu instances with simulators and field computers
* Must be run from an AWS instance when using SSL certificates

### How do I get set up? ###

You need AWS keys (AWSAccessKeyId and AWSSecretKey). Get them from the AWS
console.

![IMAGE](aws_keys.png)


* npm install
* gulp
* Dependencies: nodejs 4 and above, gulp (sudo npm install gulp -g)
* Database configuration: Redis for now
* How to run tests: gulp test?
* Deployment instructions

### Contribution guidelines ###

### Who do I talk to? ###

* Repo owner or admin: hugo@osrfoundation.org
