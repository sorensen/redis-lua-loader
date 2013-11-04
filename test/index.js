'use strict';

var assert = require('assert')
  , ase = assert.strictEqual
  , fs = require('fs')
  , Lua = require('../index')
  , redis = require('redis')
  , path = __dirname + '/lua'
  , files = fs.readdirSync(path)

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

describe('Lua', function() {
  var db = redis.createClient()
    , lua = new Lua(db, path)

  it('should emit a `ready` event', function(done) {
    lua.ready ? done() : lua.on('ready', done)
  })

  it('should connect to redis', function(done) {
    db.ready ? done() : db.on('ready', done)
  })

  it('should have loaded all lua scripts', function() {
    ase(files.length, Object.keys(lua.__shas).length)
    files.forEach(function(file) {
      ase(typeof lua.getSHA(file.replace('.lua', '')), 'string')
    })
  })

  it('should create a script wrapper function', function() {
    var fn = lua.scriptWrap('test')
    ase(typeof fn, 'function')
  })

  it('should have created a method for each script loaded', function() {
    files.forEach(function(file) {
      var name = camelCase(file.replace('.lua', ''))
      ase(typeof lua[name], 'function')
    })
  })

  it('should work with a custom directory', function(done) {
    var lua2 = new Lua(db, __dirname + '/lua2')
    lua2.on('ready', function() {
      ase(typeof lua2.getSHA('returnOne'), 'string')
      ase(typeof lua2.returnOne, 'function')
      done()
    })
  })

  it('should load multiple directories', function(done) {
    var lua3 = new Lua(db, [
      __dirname + '/lua'
    , __dirname + '/lua2'
    ])
    lua3.on('ready', function() {
      ase(typeof lua3.__shas.test, 'string')
      ase(typeof lua3.test, 'function')
      files.forEach(function(file) {
        file = file.replace('.lua', '')
        ase(typeof lua3.getSHA(file), 'string')
        ase(typeof lua3[camelCase(file)], 'function')
      })
      done()
    })
  })

  it('should throw when wrapping a non-loaded script', function() {
    assert.throws(function() {
      lua.scriptWrap('foobar')
    })
  })

  it('should emit `error` events when loading bad scripts', function(done) {
    var eLua = new Lua(db, __dirname + '/lua3')
    eLua.on('error', function(err) {
      ase(err instanceof Error, true)
      done()
    })
    eLua.on('ready', function() {
      throw new Error('Should not have made it to `ready` state')
    })
  })

  it('should disconnect from redis', function(done) {
    db.on('end', done)
    db.quit()
  })
})