'use strict';

/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , fs = require('fs')
  , path = require('path')
  , camelCase = require('camel-case')
  , loadDir = require('load-dir')
  , onReady = require('on-ready')
  , async = require('async')
  , debug = require('debug')('redis-lua-loader')
  , slice = Array.prototype.slice

/**
 * Lua script loader and function wrapper
 *
 * @param {Object} redis client
 * @param {Object} options (optional)
 *   - `src` {String|Array} lua script directory
 *   - `iterator` {Function} filename to method namer
 *
 * @inherits EventEmitter
 * @event `ready`: Emitted when redis client connected and scripts loaded
 * @event `error`: Emitted when a file read or script loading error found
 */

function Lua(client, opts) {
  var self = this
    , len = 2

  this.client = client
  this.__shas = {}   // container for loaded SHA references (preload=true)
  this.__source = {} // container for direct EVAL (preload=false)

  this.options = opts || {}
  this.namer = this.options.iterator || camelCase
  this.dir = this.options.src || []

  if (!this.options.hasOwnProperty('preload')) this.options.preload = true

  // Ensure the directory is an array
  if (!Array.isArray(this.dir)) this.dir = [this.dir]

  onReady(this.client, function(err) {
    if (err) self.emit('error', err)
    
    self.scriptLoadAll(self.dir, function(err) {
      if (err) return self.emit('error', err)

      debug('[init] ready')
      self.ready = true
      self.emit('ready')
    })
  })
}

/*!
 * Inherit from EventEmitter.
 */

Lua.prototype.__proto__ = EventEmitter.prototype

/**
 * Create a function wrapper for executing a given Lua script name
 *
 * @param {String} script name (filename with no extention)
 * @return {Function} wrapper
 * @api public
 */

Lua.prototype.scriptWrap = function(name) {
  debug('[scriptWrap] wrapping: name=`%s`', name)

  var self = this
    , sha = this.__shas[name]
    , code = this.__source[name]
    , client = this.client
    , preload = this.options.preload

  if (preload && !sha) throw new Error('Script name `' + name + '` not loaded.')
  if (!preload && !code) throw new Error('No code found for script `' + name + '`')

  return function() {
    var args = [sha].concat(slice.call(arguments))
      , next = args.pop()
      , cmd = 'EVALSHA'

    // Create an error stub to get a more direct stack trace
    var error = new Error('Error running lua script: `' + name + '`.')
    error.source = code
    error.sha = sha

    // Script not loaded in redis, use the source luke
    if (!preload) {
      cmd = 'EVAL'
      args[0] = code
    }

    // Add a callback wrapper to the script call, we want to provide a cleaner 
    // error message with better context on what script was called
    args.push(function(err) {
      if (err) {
        error.message += ' ' + err.message

        if (next) return next(error)
        self.emit('error', error)
      }
      if (next) return next.apply(next, arguments)
    })
    client[cmd].apply(client, args)
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
  debug('[scriptLoad] wrapping: name=`%s`', name)

  var self = this
    , ok = true, fn

  // Prevent naming conflicts
  if (self.hasOwnProperty(name)) {
    var err = new Error('Script naming conflict for `' + name + '`.')
    if (next) return next(err)
    return self.emit('error', err)
  }
  this.client.send_command('SCRIPT', ['LOAD', source], function(err, sha) {
    if (err) {
      if (next) return next(err)
      return self.emit('error', new Error('Unable to load script: `' + name + '` - ' + err), err)
    }
    self.__shas[name] = sha
    var fn = self[name] = self.scriptWrap(name)
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

Lua.prototype.scriptLoadAll = function(dirs, next) {
  var self = this
  
  if (!Array.isArray(dirs)) dirs = [dirs]

  debug('[scriptLoadAll] loading: dirs=`[%s]`', dirs.join(', '))

  // This is syncronous
  dirs.forEach(function(dir) {
    loadDir(dir, function(fpath) {
      var ext = path.extname(fpath)
        , name = path.basename(fpath, ext)
        , fnName = self.namer(name)

      debug('[scriptLoadAll] found file: `%s`', fpath)

      if (ext !== '.lua') return
      
      self.__source[fnName] = fs.readFileSync(fpath, 'utf8')
    })
  })

  async.each(Object.keys(this.__source), function(fnName, cb) {
    self.scriptLoad(fnName, self.__source[fnName], cb)
  }, next)

  return this
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
