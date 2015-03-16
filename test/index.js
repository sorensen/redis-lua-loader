'use strict';

// require('./mock')

var assert = require('assert')
  , ase = assert.strictEqual
  , fs = require('fs')
  , redis = require('redis')
  , path = __dirname + '/lua'
  , camelCase = require('camel-case')
  , files = fs.readdirSync(path)

// These tests run against a local redis instance
describe('Lua', function() {
  var Lua = require('../index')
    , db = redis.createClient()
    , lua = new Lua(db, {src: path})

  lua.on('error', function(err) {
    throw err
  })

  it('should emit a `ready` event', function(done) {
    lua.ready ? done() : lua.on('ready', done)
  })

  it('should connect to redis', function(done) {
    db.ready ? done() : db.on('ready', done)
  })

  it('should have loaded all lua scripts', function() {
    ase(files.length, Object.keys(lua.__shas).length)
    ase(files.length, Object.keys(lua.__source).length)
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
    var lua2 = new Lua(db, {
      src: __dirname + '/lua2'
    })
    lua2.on('ready', function() {
      ase(typeof lua2.returnOne, 'function')
      done()
    })
  })

  it('should load multiple directories', function(done) {
    var lua3 = new Lua(db, {
      src: [
        __dirname + '/lua'
      , __dirname + '/lua2'
      ]
    })
    lua3.on('ready', function() {
      ase(typeof lua3.__shas.test, 'string')
      ase(typeof lua3.test, 'function')
      files.forEach(function(file) {
        file = file.replace('.lua', '')
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
    var eLua = new Lua(db, {
      src: __dirname + '/lua3'
    })
    eLua.on('error', function(err) {
      ase(err instanceof Error, true)
      done()
    })
    eLua.on('ready', function() {
      throw new Error('Should not have made it to `ready` state')
    })
  })

  it('should return custom `error` script error', function(done) {
    var eLua = new Lua(db, {
      src: __dirname + '/lua4'
    })
    eLua.on('ready', function() {
      eLua.badJson(1, '{hi}', function(err) {
        assert(err instanceof Error)

        var source = fs.readFileSync(__dirname + '/lua4/bad-json.lua', 'utf8')

        ase(typeof err.source, 'string')
        ase(err.source, source)
        ase(typeof err.sha, 'string')
        done()
      })
    })
  })

  it('should disconnect from redis', function(done) {
    db.on('end', done)
    db.quit()
  })
})