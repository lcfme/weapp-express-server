const cp = require('child_process');
const path = require('path');
const chalk = require('chalk');

const log = (...msg) => {
  return color => {
    if (!color) {
      color = 'yellow';
    }
    console.log(chalk[color](...msg));
  };
};

module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');
  const srcFiles = grunt.file.expand('src/**/*.js');
  const distFiles = {};
  let serverProcess;
  for (let i = srcFiles.length; i--; ) {
    distFiles[srcFiles[i].replace(/^src/, 'dist')] = srcFiles[i];
  }
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    babel: {
      options: {
        sourceMap: true
      },
      dist: {
        files: distFiles
      }
    },
    clean: {
      dist: ['dist/**/*']
    },
    watch: {
      scripts: {
        files: 'src/**/*.js',
        tasks: ['default', 'server:development'],
        options: {
          debounceDelay: 500,
          spawn: false
        }
      }
    }
  });
  grunt.registerTask('server', 'start-web-server', function(env) {
    if (serverProcess) {
      console.log('kill');
      serverProcess.kill('SIGKILL');
    }
    serverProcess = cp.spawn(process.argv[0], ['./server.js'], {
      cwd: path.resolve(process.cwd(), 'dist'),
      env: {
        NODE_ENV: env
      }
    });
    serverProcess.on('close', e => {
      log(e)('red');
    });
    serverProcess.stderr.on('data', data => {
      log(data)('red');
    });
    serverProcess.stdout.on('data', data => {
      log(data)('green');
    });
  });

  grunt.registerTask('default', ['clean', 'babel']);
  grunt.registerTask('build', ['default']);
  grunt.registerTask('start', ['default', 'server:development', 'watch']);
};
