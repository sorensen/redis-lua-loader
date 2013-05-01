
Redis Lua Loader
================

[![Build Status](https://secure.travis-ci.org/sorensen/redis-lua-loader.png)](http://travis-ci.org/sorensen/redis-lua-loader) 

Lua scripting for redis utility library. Load a directory of lua scripts, cache them 
in redis, and create a function wrapper for executing that script.

Usage
-----

Using the library is as simple as creating an isntance with a redis client and 
the path to the lua scripts, once the instance is ready you can use the wrapped 
methods to call any of the scripts found in the directory.


Methods
-------

### new Lua(client, directories, iterator)

Constructor method, will automatically read the directories provided, load the 
files, and save them into redis, normally this is the only thing you will have 
to do to start using the library. This will emit a `ready` event when all scripts 
have been loaded and the redis client is ready to use.

* `client` - redis client
* `directories` - a string directory or array of string directories
* `iterator` - custom naming iterator, (optional, default camel casing function)

```js
var Lua = require('redis-lua-loader')
  , redis = require('redis')
  , db = redis.createClient()

var lua = new Lua(db, 'path/to/lua/scripts')

lua.on('ready', function() {
  // start using your lua scripts!
})
```


### instance.scriptWrap(name)

Create a function wrapper for a given script name.

* `name` - filename sans extention that has been loaded into redis

```js
```


### instance.scriptLoad(name, source, [callback])

Load the given lua `source` code into redis, assigning a function wrapper 
with the given `name` to the current instance. If there is a naming conflict, 
a wrapper will not be created.  Callback will have the saved SHA and unassigned 
script wrapper.

* `name` - name alias to save script as, will be saved as a wrapped method
* `source` - lua source code of the script
* `callback` - standard callback

```js
var Lua = require('redis-lua-loader')
  , redis = require('redis')
  , db = redis.createClient()
  , lua = new Lua(db)

fs.readFile('/path/to/script.lua', 'utf8', function(err, source) {
  lua.scriptLoad('fancy', source, function(err, sha, wrapped) {
    typeof lua.fancy === 'function'
    lua.fancy === wrapped
  })  
})
```


### instance.scriptLoadAll(directory, [callback])

Load all files in a given directory and pass each one into `instance.scriptLoad` 
with the filename and source code. All filenames found will be passed through the 
`iterator` used to create the instance, or by default it will camelCase the filename 
by splitting `-` and `_`.

* `directory` - string directory path
* `callback` - standard callback


### instance.scriptKill([callback])

Proxy to redis `SCRIPT KILL` command.

* `callback` - standard callback

```js
instance.scriptKill(function() {
  console.log('It took too long')
})
```


Install
-------

With [npm](https://npmjs.org)

```
npm install redis-lua-loader
```


License
-------

(The MIT License)

Copyright (c) 2013 Beau Sorensen <mail@beausorensen.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.