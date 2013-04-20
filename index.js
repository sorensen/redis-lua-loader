'use strict';

/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , fs = require('fs')
  , redis = require('redis')
  , slice = Array.prototype.slice
  , concat = Array.prototype.concat
  , toString = Object.prototype.toString

/**
 * Convert string into camel case
 *
 * @param {String} input
 * @return {String} output
 */

function camelCase(str) { 
  return str
    .replace('_', '-')
    .toLowerCase()
    .replace(/-(.)/g, function(match, group) {
      return group.toUpperCase()
    })
}

/**
 * Lua script loader and function wrapper
 *
 * @param {Object} redis client
 * @param {Object} options (optional)
 * @inherits EventEmitter
 * @event `ready`: Emitted when redis client connected and scripts loaded
 */

function Lua(client, options) {
  var self = this, len = 1
  this.ready = false
  this.client = client
  this.shas = {}
  this.dir = (options || {}).dirname
  if (!this.dir) {
    throw new Error('A directory path is required.')
  }
  // Ensure the directory is an array
  if (!Array.isArray(this.dir)) {
    this.dir = [this.dir]
  }
  // A ready event is needed for each directory load
  len += this.dir.length

  // Ready callback
  function ready() {
    if (!--len) {
      self.ready = true
      self.emit('ready')
    }
  }
  // Load all scripts for the given directories before emitting
  this.dir.forEach(function(dir) { 
    self.loadScripts(dir, ready)
  })

  // Wait for redis client ready event
  if (this.client.ready) ready()
  else this.client.on('ready', ready) 
}

/*!
 * Inherit from EventEmitter.
 */

Lua.prototype.__proto__ = EventEmitter.prototype

/**
 * Create a function wrapper for executing a given Lua
 * script, uses the camelCase version of the filename
 *
 * @param {String} script name
 * @return {Function} wrapper
 * @api public
 */

Lua.prototype.wrapScript = function(name) {
  var self = this
    , sha = this.shas[name]
    , client = this.client
  if (!sha) throw new Error('Script name `' + name + '` does not exist.')
  return function() {
    client.EVALSHA.apply(client, [sha].concat(slice.call(arguments)))
    return self
  }
}

/**
 * Load a single script into redis, saving the SHA
 *
 * @param {String} script name
 * @param {String} script contents
 * @param {Function} callback (optional)
 * @api public
 */

Lua.prototype.loadScript = function(name, source, next) {
  var self = this
    , camel = camelCase(name)

  this.client.send_command('SCRIPT', ['LOAD', source], function(err, sha) {
    if (err) {
      throw new Error('Unable to load script: `' + name + '` - ' + err)
    }
    self.shas[name] = sha
    self[camel] = self.wrapScript(name)
    return next && next(sha)
  })
}

/**
 * Load all scripts for the current directory
 *
 * @param {String} directory path
 * @param {Function} callback (optional)
 * @api public
 */

Lua.prototype.loadScripts = function(dir, next) {
  var self = this
  fs.readdir(dir, function(err, files) {
    var len = files.length
    if (err) {
      throw new Error('Could not load scripts from dir `' + dir + '` ' + err)
    }
    files.forEach(function(file, key) {
      fs.readFile(dir + '/' + file, 'utf-8', function(err, source) {
        self.loadScript(file.replace('.lua', ''), source, function(sha) {
          --len || next && next()    
        })
      })
    })
  })
  return this
}

/*!
 * Module exports.
 */

module.exports = Lua