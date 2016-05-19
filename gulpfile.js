'use strict';

var gulp = require('gulp');
var browserSync = require('browser-sync');
var nodemon = require('gulp-nodemon');
var mocha = require('gulp-mocha');

gulp.task('default', ['serve'], function () {
});

gulp.task('serve', ['browser-sync'], function () {
});

gulp.task('browser-sync', ['nodemon'], function() {
	browserSync.init(null, {
//      middleware: [
//
//      ]

//     socket: {
//      domain: "localhost:5000"
//    }

//		proxy: "http://localhost:5000",
//        files: ["public/**/*.*"],
//        browser: "google chrome",
//        port: 7000,
	});
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


gulp.task('test', ['set-test-env'], function() {
  return gulp.src(['test/mocha/**/*.js'], {read: false})
    .pipe(mocha({
      reporter: 'spec',
      require: 'server/server.js'
  }));
});
