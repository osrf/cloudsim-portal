'use strict';

var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var coveralls = require('gulp-coveralls');

gulp.task('default', ['nodemon'], function () {
});

gulp.task('nodemon', function (cb) {
  var started = false;
  return nodemon({
    script: 'server/server.js',
    watch: ['server/**/*.*']
  }).on('start', function () {
    console.log('start nodemon')
    // to avoid nodemon being started multiple times
    // thanks @matthisk
    if (!started) {
      cb();
      started = true;
    }
  });
});

gulp.task('set-test-env', function () {
  return process.env.NODE_ENV = 'test';
});

gulp.task('pre-test', function () {
  return gulp.src(['server/**/*.js'])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('test', ['set-test-env', 'pre-test'], function() {
  return gulp.src(['test/**/*.js'], {read: false})
    .pipe(mocha({
      reporter: 'spec'
    }))
    // Creating the reports after tests ran
    .pipe(istanbul.writeReports())
    // Enforce a coverage of at least 45%
    .pipe(istanbul.enforceThresholds({ thresholds: { global: 60 } }))
    .once('end', function () {
      process.exit();
    });
});

gulp.task('coveralls', function() {
  return gulp.src('./coverage/lcov.info')
    .pipe(coveralls());
});
