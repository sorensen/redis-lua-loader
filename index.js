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
  , info = require('./package.json')
  , noop = function() {}

/**
 * Convert string into camel case
 *
 * @param {String} input
 * @return {String} output
 */

function camelCase(str) { 
  return str
    .replace(/_/g, '-')
    .replace(/\//g, '-')
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

function Lua(client, dirname, iterator) {
  var self = this, len = 1
  this.ready = false
  this.client = client
  this.__shas = {}
  this.namer = iterator || camelCase
  this.dir = dirname || []

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
    self.scriptLoadAll(dir, ready)
  })

  // Wait for redis client ready event
  if (this.client.ready) ready()
  else this.client.on('ready', ready)
}

/*!
 * Inherit from EventEmitter.
 */

Lua.prototype.__proto__ = EventEmitter.prototype

/*!
 * Current library version, should match `package.json`
 */

Lua.VERSION = info.version

/**
 * Create a function wrapper for executing a given Lua script name
 *
 * @param {String} script name (filename with no extention)
 * @return {Function} wrapper
 * @api public
 */

Lua.prototype.scriptWrap = function(name) {
  var self = this
    , sha = this.__shas[name]
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

Lua.prototype.scriptLoad = function(name, source, next) {
  var self = this
    , ok = true, fn

  // Prevent naming conflicts
  if (self.hasOwnProperty(name)) {
    ok = false
    console.warn('Script naming conflict for `' + fnName + '`. Function not set.')
    console.trace()
  }
  this.client.send_command('SCRIPT', ['LOAD', source], function(err, sha) {
    if (err) {
      if (next) return next(err)
      throw new Error('Unable to load script: `' + name + '` - ' + err)
    }
    self.__shas[name] = sha
    fn = self.scriptWrap(name)
    ok && (self[name] = fn)
    return next && next(null, sha, fn)
  })
}

/**
 * Load all scripts for the current directory
 *
 * @param {String} directory path
 * @param {Function} callback (optional)
 * @api public
 */

Lua.prototype.scriptLoadAll = function(dir, next) {
  var self = this
    , resp = []
    , len = 0
    , fnName
  
  function callback() {
    --len || next && next(null, resp)
  }
  function isDir(path) {
    self.scriptLoadAll(path, function(err, resp) {
      resp && (resp = resp.concat(resp))
      callback()
    })
  }
  function isFile(path, file) {
    fs.readFile(path, 'utf-8', function(err, source) {
      if (err) {
        if (next) return next(err)
        throw new Error('Error reading file `' + file + '` - ' + err)
      }
      fnName = self.namer(file.replace('.lua', ''))
      self.scriptLoad(fnName, source, function(err) {
        resp.push(slice.call(arguments))
        callback()
      })
    })
  }
  fs.readdir(dir, function(err, files) {
    len = files.length
    if (!len) return next(null, resp)
    if (err) {
      if (next) return next(err)
      throw new Error('Could not load scripts from dir `' + dir + '` ' + err)
    }
    files.forEach(function(file, key) {
      var path = dir + '/' + file
      fs.stat(path, function(err, stats) {
        if (stats.isDirectory()) return isDir(path)
        if (stats.isFile() && !!~file.indexOf('.lua')) return isFile(path, file)
        callback()
      })
    })
  })
  return this
}

Lua.prototype.getSHA = function(name) {
  return this.__shas[name]
}

/**
 * Shortcut to redis `SCRIPT KILL` command
 *
 * @param {Function} callback
 */

Lua.prototype.scriptKill = function(next) {
  this.client.send_command('SCRIPT', 'KILL', next)
  return this
}

/*!
 * Module exports.
 */

module.exports = Lua