/*
Copyright 2013 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/
(function (global, factory) {
    var built = factory();
    /* istanbul ignore else */
    if (typeof module === 'object' && module) {
        module.exports = built;
    }
    /* istanbul ignore next */
    if (typeof define === 'function' && define.amd) {
        define(factory);
    }
    global.Promise = built;
}(this, function () {

    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }

    function assign(obj, props) {
        for (var prop in props) {
            /* istanbul ignore else */
            if (props.hasOwnProperty(prop)) {
                obj[prop] = props[prop];
            }
        }
    }

    /**
    A promise represents a value that may not yet be available. Promises allow
    you to chain asynchronous operations, write synchronous looking code and
    handle errors throughout the process.

    This constructor takes a function as a parameter where you can insert the logic
    that fulfills or rejects this promise. The fulfillment value and the rejection
    reason can be any JavaScript value. It's encouraged that rejection reasons be
    error objects

    <pre><code>
    var fulfilled = new Promise(function (resolve) {
        resolve('I am a fulfilled promise');
    });

    var rejected = new Promise(function (resolve, reject) {
        reject(new Error('I am a rejected promise'));
    });
    </code></pre>

    @class Promise
    @constructor
    @param {Function} fn A function where to insert the logic that resolves this
            promise. Receives `resolve` and `reject` functions as parameters.
            This function is called synchronously.
    **/
    function Promise(fn) {
        if (!(this instanceof Promise)) {
            Promise._log('Promises should always be created with new Promise(). This will throw an error in the future', 'error');
            return new Promise(fn);
        }

        var resolver = new Promise.Resolver(this);

        /**
        A reference to the resolver object that handles this promise

        @property _resolver
        @type Object
        @private
        */
        this._resolver = resolver;

        try {
            fn(function (value) {
                resolver.resolve(value);
            }, function (reason) {
                resolver.reject(reason);
            });
        } catch (e) {
            resolver.reject(e);
        }
    }

    assign(Promise.prototype, {
        /**
        Schedule execution of a callback to either or both of "fulfill" and
        "reject" resolutions for this promise. The callbacks are wrapped in a new
        promise and that promise is returned.  This allows operation chaining ala
        `functionA().then(functionB).then(functionC)` where `functionA` returns
        a promise, and `functionB` and `functionC` _may_ return promises.

        Asynchronicity of the callbacks is guaranteed.

        @method then
        @param {Function} [callback] function to execute if the promise
                    resolves successfully
        @param {Function} [errback] function to execute if the promise
                    resolves unsuccessfully
        @return {Promise} A promise wrapping the resolution of either "resolve" or
                    "reject" callback
        **/
        then: function (callback, errback) {
            // using this.constructor allows for customized promises to be
            // returned instead of plain ones
            var resolve, reject,
                promise = new this.constructor(function (res, rej) {
                    resolve = res;
                    reject = rej;
                });

            this._resolver._addCallbacks(
                typeof callback === 'function' ?
                    Promise._makeCallback(promise, resolve, reject, callback) : resolve,
                typeof errback === 'function' ?
                    Promise._makeCallback(promise, resolve, reject, errback) : reject
            );

            return promise;
        },

        /*
        A shorthand for `promise.then(undefined, callback)`.

        Returns a new promise and the error callback gets the same treatment as in
        `then`: errors get caught and turned into rejections, and the return value
        of the callback becomes the fulfilled value of the returned promise.

        @method catch
        @param [Function] errback Callback to be called in case this promise is
                            rejected
        @return {Promise} A new promise modified by the behavior of the error
                            callback
        */
        'catch': function (errback) {
            return this.then(undefined, errback);
        }
    });

    /**
    Wraps the callback in another function to catch exceptions and turn them
    into rejections.

    @method _makeCallback
    @param {Promise} promise Promise that will be affected by this callback
    @param {Function} fn Callback to wrap
    @return {Function}
    @static
    @private
    **/
    Promise._makeCallback = function (promise, resolve, reject, fn) {
        // callbacks and errbacks only get one argument
        return function (valueOrReason) {
            var result;

            // Promises model exception handling through callbacks
            // making both synchronous and asynchronous errors behave
            // the same way
            try {
                // Use the argument coming in to the callback/errback from the
                // resolution of the parent promise.
                // The function must be called as a normal function, with no
                // special value for |this|, as per Promises A+
                result = fn(valueOrReason);
            } catch (e) {
                // calling return only to stop here
                reject(e);
                return;
            }

            if (result === promise) {
                reject(new TypeError('Cannot resolve a promise with itself'));
                return;
            }

            resolve(result);
        };
    };

    /**
    Logs a message. This method is designed to be overwritten with  YUI's `log`
    function.

    @method _log
    @param {String} msg Message to log
    @param {String} type Log level. One of 'error', 'warn', 'info'.
    @static
    @private
    **/
    Promise._log = function (msg, type) { /* istanbul ignore else */ if (typeof console !== 'undefined') { console[type](msg); } };

    /*
    Ensures that a certain value is a promise. If it is not a promise, it wraps it
    in one.

    This method can be copied or inherited in subclasses. In that case it will
    check that the value passed to it is an instance of the correct class.
    This means that `PromiseSubclass.resolve()` will always return instances of
    `PromiseSubclass`.

    @method resolve
    @param {Any} Any object that may or may not be a promise
    @return {Promise}
    @static
    */
    Promise.resolve = function (value) {
        if (value && value.constructor === this) {
            return value;
        }
        /*jshint newcap: false */
        return new this(function (resolve) {
        /*jshint newcap: true */
            resolve(value);
        });
    };

    /*
    A shorthand for creating a rejected promise.

    @method reject
    @param {Any} reason Reason for the rejection of this promise. Usually an Error
        Object
    @return {Promise} A rejected promise
    @static
    */
    Promise.reject = function (reason) {
        /*jshint newcap: false */
        var promise = new this(function () {});
       /*jshint newcap: true */

       // Do not go through resolver.reject() because an immediately rejected promise
       // always has no callbacks which would trigger an unnecessary warnihg
       promise._resolver._result = reason;
       promise._resolver._status = 'rejected';

       return promise;
    };

    /*
    Returns a promise that is resolved or rejected when all values are resolved or
    any is rejected. This is useful for waiting for the resolution of multiple
    promises, such as reading multiple files in Node.js or making multiple XHR
    requests in the browser.

    @method all
    @param {Any[]} values An array of any kind of values, promises or not. If a value is not
    @return [Promise] A promise for an array of all the fulfillment values
    @static
    */
    Promise.all = function (values) {
        var Promise = this;
        return new Promise(function (resolve, reject) {
            if (!isArray(values)) {
                reject(new TypeError('Promise.all expects an array of values or promises'));
                return;
            }

            var remaining = values.length,
                i         = 0,
                length    = values.length,
                results   = [];

            function oneDone(index) {
                return function (value) {
                    results[index] = value;

                    remaining--;

                    if (!remaining) {
                        resolve(results);
                    }
                };
            }

            if (length < 1) {
                return resolve(results);
            }

            for (; i < length; i++) {
                Promise.resolve(values[i]).then(oneDone(i), reject);
            }
        });
    };

    /*
    Returns a promise that is resolved or rejected when any of values is either
    resolved or rejected. Can be used for providing early feedback in the UI
    while other operations are still pending.

    @method race
    @param {Any[]} values An array of values or promises
    @return {Promise}
    @static
    */
    Promise.race = function (values) {
        var Promise = this;
        return new Promise(function (resolve, reject) {
            if (!isArray(values)) {
                reject(new TypeError('Promise.race expects an array of values or promises'));
                return;
            }
            
            // just go through the list and resolve and reject at the first change
            // This abuses the fact that calling resolve/reject multiple times
            // doesn't change the state of the returned promise
            for (var i = 0, count = values.length; i < count; i++) {
                Promise.resolve(values[i]).then(resolve, reject);
            }
        });
    };

    /**
    Forces a function to be run asynchronously, but as fast as possible. In Node.js
    this is achieved using `setImmediate` or `process.nextTick`. In YUI this is
    replaced with `Y.soon`.

    @method async
    @param {Function} callback The function to call asynchronously
    @static
    **/
    /* istanbul ignore next */
    Promise.async = typeof setImmediate !== 'undefined' ?
                        function (fn) {setImmediate(fn);} :
                    typeof process !== 'undefined' && process.nextTick ?
                        process.nextTick :
                    function (fn) {setTimeout(fn, 0);};

    /**
    Represents an asynchronous operation. Provides a
    standard API for subscribing to the moment that the operation completes either
    successfully (`fulfill()`) or unsuccessfully (`reject()`).

    @class Promise.Resolver
    @constructor
    @param {Promise} promise The promise instance this resolver will be handling
    **/
    function Resolver(promise) {
        /**
        List of success callbacks

        @property _callbacks
        @type Array
        @private
        **/
        this._callbacks = [];

        /**
        List of failure callbacks

        @property _errbacks
        @type Array
        @private
        **/
        this._errbacks = [];

        /**
        The promise for this Resolver.

        @property promise
        @type Promise
        @deprecated
        **/
        this.promise = promise;

        /**
        The status of the operation. This property may take only one of the following
        values: 'pending', 'fulfilled' or 'rejected'.

        @property _status
        @type String
        @default 'pending'
        @private
        **/
        this._status = 'pending';

        /**
        This value that this promise represents.

        @property _result
        @type Any
        @private
        **/
        this._result = null;
    }

    assign(Resolver.prototype, {
        /**
        Resolves the promise, signaling successful completion of the
        represented operation. All "onFulfilled" subscriptions are executed and passed
        the value provided to this method. After calling `fulfill()`, `reject()` and
        `notify()` are disabled.

        @method fulfill
        @param {Any} value Value to pass along to the "onFulfilled" subscribers
        **/
        fulfill: function (value) {
            var status = this._status;

            if (status === 'pending' || status === 'accepted') {
                this._result = value;
                this._status = 'fulfilled';
            }

            if (this._status === 'fulfilled') {
                this._notify(this._callbacks, this._result);

                // Reset the callback list so that future calls to fulfill()
                // won't call the same callbacks again. Promises keep a list
                // of callbacks, they're not the same as events. In practice,
                // calls to fulfill() after the first one should not be made by
                // the user but by then()
                this._callbacks = [];

                // Once a promise gets fulfilled it can't be rejected, so
                // there is no point in keeping the list. Remove it to help
                // garbage collection
                this._errbacks = null;
            }
        },

        /**
        Resolves the promise, signaling *un*successful completion of the
        represented operation. All "onRejected" subscriptions are executed with
        the value provided to this method. After calling `reject()`, `resolve()`
        and `notify()` are disabled.

        @method reject
        @param {Any} value Value to pass along to the "reject" subscribers
        **/
        reject: function (reason) {
            var status = this._status;

            if (status === 'pending' || status === 'accepted') {
                this._result = reason;
                this._status = 'rejected';
                if (!this._errbacks.length) {Promise._log('Promise rejected but no error handlers were registered to it', 'warn');}
            }

            if (this._status === 'rejected') {
                this._notify(this._errbacks, this._result);

                // See fulfill()
                this._callbacks = null;
                this._errbacks = [];
            }
        },

        /*
        Given a certain value A passed as a parameter, this method resolves the
        promise to the value A.

        If A is a promise, `resolve` will cause the resolver to adopt the state of A
        and once A is resolved, it will resolve the resolver's promise as well.
        This behavior "flattens" A by calling `then` recursively and essentially
        disallows promises-for-promises.

        This is the default algorithm used when using the function passed as the
        first argument to the promise initialization function. This means that
        the following code returns a promise for the value 'hello world':

            var promise1 = new Promise(function (resolve) {
                resolve('hello world');
            });
            var promise2 = new Promise(function (resolve) {
                resolve(promise1);
            });
            promise2.then(function (value) {
                assert(value === 'hello world'); // true
            });

        @method resolve
        @param [Any] value A regular JS value or a promise
        */
        resolve: function (value) {
            if (this._status === 'pending') {
                this._status = 'accepted';
                this._value = value;

                if ((this._callbacks && this._callbacks.length) ||
                    (this._errbacks && this._errbacks.length)) {
                    this._unwrap(this._value);
                }
            }
        },

        /**
        If `value` is a promise or a thenable, it will be unwrapped by
        recursively calling its `then` method. If not, the resolver will be
        fulfilled with `value`.

        This method is called when the promise's `then` method is called and
        not in `resolve` to allow for lazy promises to be accepted and not
        resolved immediately.

        @method _unwrap
        @param {Any} value A promise, thenable or regular value
        @private
        **/
        _unwrap: function (value) {
            var self = this, unwrapped = false, then;

            if (!value || (typeof value !== 'object' &&
                typeof value !== 'function')) {
                self.fulfill(value);
                return;
            }

            try {
                then = value.then;

                if (typeof then === 'function') {
                    then.call(value, function (value) {
                        if (!unwrapped) {
                            unwrapped = true;
                            self._unwrap(value);
                        }
                    }, function (reason) {
                        if (!unwrapped) {
                            unwrapped = true;
                            self.reject(reason);
                        }
                    });
                } else {
                    self.fulfill(value);
                }
            } catch (e) {
                if (!unwrapped) {
                    self.reject(e);
                }
            }
        },

        /**
        Schedule execution of a callback to either or both of "resolve" and
        "reject" resolutions of this resolver. If the resolver is not pending,
        the correct callback gets called automatically.

        @method _addCallbacks
        @param {Function} [callback] function to execute if the Resolver
                    resolves successfully
        @param {Function} [errback] function to execute if the Resolver
                    resolves unsuccessfully
        **/
        _addCallbacks: function (callback, errback) {
            var callbackList = this._callbacks,
                errbackList  = this._errbacks;

            // Because the callback and errback are represented by a Resolver, it
            // must be fulfilled or rejected to propagate through the then() chain.
            // The same logic applies to resolve() and reject() for fulfillment.
            if (callbackList) {
                callbackList.push(callback);
            }
            if (errbackList) {
                errbackList.push(errback);
            }

            switch (this._status) {
                case 'accepted':
                    this._unwrap(this._value);
                    break;
                case 'fulfilled':
                    this.fulfill(this._result);
                    break;
                case 'rejected':
                    this.reject(this._result);
                    break;
            }
        },

        /**
        Executes an array of callbacks from a specified context, passing a set of
        arguments.

        @method _notify
        @param {Function[]} subs The array of subscriber callbacks
        @param {Any} result Value to pass the callbacks
        @protected
        **/
        _notify: function (subs, result) {
            // Since callback lists are reset synchronously, the subs list never
            // changes after _notify() receives it. Avoid calling Y.soon() for
            // an empty list
            if (subs.length) {
                // Calling all callbacks after Promise.async to guarantee
                // asynchronicity. Because setTimeout can cause unnecessary
                // delays that *can* become noticeable in some situations
                // (especially in Node.js)
                Promise.async(function () {
                    var i, len;

                    for (i = 0, len = subs.length; i < len; ++i) {
                        subs[i](result);
                    }
                });
            }
        }

    });

    Promise.Resolver = Resolver;

    return Promise;

}));


/* (The MIT License)
 *
 * Copyright (c) 2012 Brandon Benvie <http://bbenvie.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the 'Software'), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included with all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY  CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Original WeakMap implementation by Gozala @ https://gist.github.com/1269991
// Updated and bugfixed by Raynos @ https://gist.github.com/1638059
// Expanded by Benvie @ https://github.com/Benvie/harmony-collections

void function(string_, object_, function_, prototype_, toString_,
              Array, Object, Function, FP, global, exports, undefined_, undefined){

  var getProperties = Object.getOwnPropertyNames,
      es5 = typeof getProperties === function_ && !(prototype_ in getProperties);

  var callbind = FP.bind
    ? FP.bind.bind(FP.call)
    : (function(call){
        return function(func){
          return function(){
            return call.apply(func, arguments);
          };
        };
      }(FP.call));

  var functionToString = callbind(FP[toString_]),
      objectToString = callbind({}[toString_]),
      numberToString = callbind(.0.toString),
      call = callbind(FP.call),
      apply = callbind(FP.apply),
      hasOwn = callbind({}.hasOwnProperty),
      push = callbind([].push),
      splice = callbind([].splice);

  var name = function(func){
    if (typeof func !== function_)
      return '';
    else if ('name' in func)
      return func.name;

    return functionToString(func).match(/^\n?function\s?(\w*)?_?\(/)[1];
  };

  var create = es5
    ? Object.create
    : function(proto, descs){
        var Ctor = function(){};
        Ctor[prototype_] = Object(proto);
        var object = new Ctor;

        if (descs)
          for (var key in descs)
            defineProperty(object, key, descs[k]);

        return object;
      };


  function Hash(){}

  if (es5) {
    void function(ObjectCreate){
      Hash.prototype = ObjectCreate(null);
      function inherit(obj){
        return ObjectCreate(obj);
      }
      Hash.inherit = inherit;
    }(Object.create);
  } else {
    void function(F){
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.src = 'javascript:'
      Hash.prototype = iframe.contentWindow.Object.prototype;
      document.body.removeChild(iframe);
      iframe = null;

      var props = ['constructor', 'hasOwnProperty', 'propertyIsEnumerable',
                   'isProtoypeOf', 'toLocaleString', 'toString', 'valueOf'];

      for (var i=0; i < props.length; i++)
        delete Hash.prototype[props[i]];

      function inherit(obj){
        F.prototype = obj;
        obj = new F;
        F.prototype = null;
        return obj;
      }

      Hash.inherit = inherit;
    }(function(){});
  }

  var defineProperty = es5
    ? Object.defineProperty
    : function(object, key, desc) {
        object[key] = desc.value;
        return object;
      };

  var define = function(object, key, value){
    if (typeof key === function_) {
      value = key;
      key = name(value).replace(/_$/, '');
    }

    return defineProperty(object, key, { configurable: true, writable: true, value: value });
  };

  var isArray = es5
    ? (function(isArray){
        return function(o){
          return isArray(o) || o instanceof Array;
        };
      })(Array.isArray)
    : function(o){
        return o instanceof Array || objectToString(o) === '[object Array]';
      };

  // ############
  // ### Data ###
  // ############

  var builtinWeakMap = 'WeakMap' in global;

  var MapData = builtinWeakMap
    ? (function(){
      var BuiltinWeakMap = global.WeakMap,
          wmget = callbind(BuiltinWeakMap[prototype_].get),
          wmset = callbind(BuiltinWeakMap[prototype_].set),
          wmhas = callbind(BuiltinWeakMap[prototype_].has);

      function MapData(name){
        var map = new BuiltinWeakMap;

        this.get = function(o){
          return wmget(map, o);
        };
        this.set = function(o, v){
          wmset(map, o, v);
        };

        if (name) {
          this.wrap = function(o, v){
            if (wmhas(map, o))
              throw new TypeError("Object is already a " + name);
            wmset(map, o, v);
          };
          this.unwrap = function(o){
            var storage = wmget(map, o);
            if (!storage)
              throw new TypeError(name + " is not generic");
            return storage;
          };
        }
      }

      return MapData;
    })()
    : (function(){
      var locker = 'return function(k){if(k===s)return l}',
          random = Math.random,
          uids = new Hash,
          slice = callbind(''.slice),
          indexOf = callbind([].indexOf);

      var createUID = function(){
        var key = slice(numberToString(random(), 36), 2);
        return key in uids ? createUID() : uids[key] = key;
      };

      var globalID = createUID();

      // common per-object storage area made visible by patching getOwnPropertyNames'
      function getOwnPropertyNames(obj){
        var props = getProperties(obj);
        if (hasOwn(obj, globalID))
          splice(props, indexOf(props, globalID), 1);
        return props;
      }

      if (es5) {
        // check for the random key on an object, create new storage if missing, return it
        var storage = function(obj){
          if (!hasOwn(obj, globalID))
            defineProperty(obj, globalID, { value: new Hash });
          return obj[globalID];
        };

        define(Object, getOwnPropertyNames);
      } else {

        var toStringToString = function(s){
          function toString(){ return s }
          return toString[toString_] = toString;
        }(Object[prototype_][toString_]+'');

        // store the values on a custom valueOf in order to hide them but store them locally
        var storage = function(obj){
          if (hasOwn(obj, toString_) && globalID in obj[toString_])
            return obj[toString_][globalID];

          if (!(toString_ in obj))
            throw new Error("Can't store values for "+obj);

          var oldToString = obj[toString_];
          function toString(){ return oldToString.call(this) }
          obj[toString_] = toString;
          toString[toString_] = toStringToString;
          return toString[globalID] = {};
        };
      }



      // shim for [[MapData]] from es6 spec, and pulls double duty as WeakMap storage
      function MapData(name){
        var puid = createUID(),
            iuid = createUID(),
            secret = { value: undefined };

        var attach = function(obj){
          var store = storage(obj);
          if (hasOwn(store, puid))
            return store[puid](secret);

          var lockbox = new Hash;
          defineProperty(lockbox, iuid, secret);
          defineProperty(store, puid, {
            value: new Function('s', 'l', locker)(secret, lockbox)
          });
          return lockbox;
        };

        this.get = function(o){
          return attach(o)[iuid];
        };
        this.set = function(o, v){
          attach(o)[iuid] = v;
        };

        if (name) {
          this.wrap = function(o, v){
            var lockbox = attach(o);
            if (lockbox[iuid])
              throw new TypeError("Object is already a " + name);
            lockbox[iuid] = v;
          };
          this.unwrap = function(o){
            var storage = attach(o)[iuid];
            if (!storage)
              throw new TypeError(name + " is not generic");
            return storage;
          };
        }
      }

      return MapData;
    }());

  var exporter = (function(){
    // [native code] looks slightly different in each engine
    var src = (''+Object).split('Object');

    // fake [native code]
    function toString(){
      return src[0] + name(this) + src[1];
    }

    define(toString, toString);

    // attempt to use __proto__ so the methods don't all have an own toString
    var prepFunction = { __proto__: [] } instanceof Array
      ? function(func){ func.__proto__ = toString }
      : function(func){ define(func, toString) };

    // assemble an array of functions into a fully formed class
    var prepare = function(methods){
      var Ctor = methods.shift(),
          brand = '[object ' + name(Ctor) + ']';

      function toString(){ return brand }
      methods.push(toString);
      prepFunction(Ctor);

      for (var i=0; i < methods.length; i++) {
        prepFunction(methods[i]);
        define(Ctor[prototype_], methods[i]);
      }

      return Ctor;
    };

    return function(name, init){
      if (name in exports)
        return exports[name];

      var data = new MapData(name);

      return exports[name] = prepare(init(
        function(collection, value){
          data.wrap(collection, value);
        },
        function(collection){
          return data.unwrap(collection);
        }
      ));
    };
  }());


  // initialize collection with an iterable, currently only supports forEach function
  var initialize = function(iterable, callback){
    if (iterable !== null && typeof iterable === object_ && typeof iterable.forEach === function_) {
      iterable.forEach(function(item, i){
        if (isArray(item) && item.length === 2)
          callback(iterable[i][0], iterable[i][1]);
        else
          callback(iterable[i], i);
      });
    }
  }

  // attempt to fix the name of "delete_" methods, should work in V8 and spidermonkey
  var fixDelete = function(func, scopeNames, scopeValues){
    try {
      scopeNames[scopeNames.length] = ('return '+func).replace('e_', '\\u0065');
      return Function.apply(0, scopeNames).apply(0, scopeValues);
    } catch (e) {
      return func;
    }
  }

  var WM, HM, M;

  // ###############
  // ### WeakMap ###
  // ###############

  WM = builtinWeakMap ? (exports.WeakMap = global.WeakMap) : exporter('WeakMap', function(wrap, unwrap){
    var prototype = WeakMap[prototype_];
    var validate = function(key){
      if (key == null || typeof key !== object_ && typeof key !== function_)
        throw new TypeError("Invalid WeakMap key");
    };

    /**
     * @class        WeakMap
     * @description  Collection using objects with unique identities as keys that disallows enumeration
     *               and allows for better garbage collection.
     * @param        {Iterable} [iterable]  An item to populate the collection with.
     */
    function WeakMap(iterable){
      if (this === global || this == null || this === prototype)
        return new WeakMap(iterable);

      wrap(this, new MapData);

      var self = this;
      iterable && initialize(iterable, function(value, key){
        call(set, self, value, key);
      });
    }
    /**
     * @method       <get>
     * @description  Retrieve the value in the collection that matches key
     * @param        {Any} key
     * @return       {Any}
     */
    function get(key){
      validate(key);
      var value = unwrap(this).get(key);
      return value === undefined_ ? undefined : value;
    }
    /**
     * @method       <set>
     * @description  Add or update a pair in the collection. Enforces uniqueness by overwriting.
     * @param        {Any} key
     * @param        {Any} val
     **/
    function set(key, value){
      validate(key);
      // store a token for explicit undefined so that "has" works correctly
      unwrap(this).set(key, value === undefined ? undefined_ : value);
    }
    /*
     * @method       <has>
     * @description  Check if key is in the collection
     * @param        {Any} key
     * @return       {Boolean}
     **/
    function has(key){
      validate(key);
      return unwrap(this).get(key) !== undefined;
    }
    /**
     * @method       <delete>
     * @description  Remove key and matching value if found
     * @param        {Any} key
     * @return       {Boolean} true if item was in collection
     */
    function delete_(key){
      validate(key);
      var data = unwrap(this);

      if (data.get(key) === undefined)
        return false;

      data.set(key, undefined);
      return true;
    }

    delete_ = fixDelete(delete_, ['validate', 'unwrap'], [validate, unwrap]);
    return [WeakMap, get, set, has, delete_];
  });


  // ###############
  // ### HashMap ###
  // ###############

  HM = exporter('HashMap', function(wrap, unwrap){
    // separate numbers, strings, and atoms to compensate for key coercion to string

    var prototype = HashMap[prototype_],
        STRING = 0, NUMBER = 1, OTHER = 2,
        others = { 'true': true, 'false': false, 'null': null, 0: -0 };

    var proto = Math.random().toString(36).slice(2);

    var coerce = function(key){
      return key === '__proto__' ? proto : key;
    };

    var uncoerce = function(type, key){
      switch (type) {
        case STRING: return key === proto ? '__proto__' : key;
        case NUMBER: return +key;
        case OTHER: return others[key];
      }
    }


    var validate = function(key){
      if (key == null) return OTHER;
      switch (typeof key) {
        case 'boolean': return OTHER;
        case string_: return STRING;
        // negative zero has to be explicitly accounted for
        case 'number': return key === 0 && Infinity / key === -Infinity ? OTHER : NUMBER;
        default: throw new TypeError("Invalid HashMap key");
      }
    }

    /**
     * @class          HashMap
     * @description    Collection that only allows primitives to be keys.
     * @param          {Iterable} [iterable]  An item to populate the collection with.
     */
    function HashMap(iterable){
      if (this === global || this == null || this === prototype)
        return new HashMap(iterable);

      wrap(this, {
        size: 0,
        0: new Hash,
        1: new Hash,
        2: new Hash
      });

      var self = this;
      iterable && initialize(iterable, function(value, key){
        call(set, self, value, key);
      });
    }
    /**
     * @method       <get>
     * @description  Retrieve the value in the collection that matches key
     * @param        {Any} key
     * @return       {Any}
     */
    function get(key){
      return unwrap(this)[validate(key)][coerce(key)];
    }
    /**
     * @method       <set>
     * @description  Add or update a pair in the collection. Enforces uniqueness by overwriting.
     * @param        {Any} key
     * @param        {Any} val
     **/
    function set(key, value){
      var items = unwrap(this),
          data = items[validate(key)];

      key = coerce(key);
      key in data || items.size++;
      data[key] = value;
    }
    /**
     * @method       <has>
     * @description  Check if key exists in the collection.
     * @param        {Any} key
     * @return       {Boolean} is in collection
     **/
    function has(key){
      return coerce(key) in unwrap(this)[validate(key)];
    }
    /**
     * @method       <delete>
     * @description  Remove key and matching value if found
     * @param        {Any} key
     * @return       {Boolean} true if item was in collection
     */
    function delete_(key){
      var items = unwrap(this),
          data = items[validate(key)];

      key = coerce(key);
      if (key in data) {
        delete data[key];
        items.size--;
        return true;
      }

      return false;
    }
    /**
     * @method       <size>
     * @description  Retrieve the amount of items in the collection
     * @return       {Number}
     */
    function size(){
      return unwrap(this).size;
    }
    /**
     * @method       <forEach>
     * @description  Loop through the collection raising callback for each
     * @param        {Function} callback  `callback(value, key)`
     * @param        {Object}   context    The `this` binding for callbacks, default null
     */
    function forEach(callback, context){
      var data = unwrap(this);
      context = context == null ? global : context;
      for (var i=0; i < 3; i++)
        for (var key in data[i])
          call(callback, context, data[i][key], uncoerce(i, key), this);
    }

    delete_ = fixDelete(delete_, ['validate', 'unwrap', 'coerce'], [validate, unwrap, coerce]);
    return [HashMap, get, set, has, delete_, size, forEach];
  });


  // ###########
  // ### Map ###
  // ###########

  // if a fully implemented Map exists then use it
  if ('Map' in global && 'forEach' in global.Map.prototype) {
    M = exports.Map = global.Map;
  } else {
    M = exporter('Map', function(wrap, unwrap){
      // attempt to use an existing partially implemented Map
      var BuiltinMap = global.Map,
          prototype = Map[prototype_],
          wm = WM[prototype_],
          hm = (BuiltinMap || HM)[prototype_],
          mget    = [callbind(hm.get), callbind(wm.get)],
          mset    = [callbind(hm.set), callbind(wm.set)],
          mhas    = [callbind(hm.has), callbind(wm.has)],
          mdelete = [callbind(hm['delete']), callbind(wm['delete'])];

      var type = BuiltinMap
        ? function(){ return 0 }
        : function(o){ return +(typeof o === object_ ? o !== null : typeof o === function_) }

      // if we have a builtin Map we can let it do most of the heavy lifting
      var init = BuiltinMap
        ? function(){ return { 0: new BuiltinMap } }
        : function(){ return { 0: new HM, 1: new WM } };

      /**
       * @class         Map
       * @description   Collection that allows any kind of value to be a key.
       * @param         {Iterable} [iterable]  An item to populate the collection with.
       */
      function Map(iterable){
        if (this === global || this == null || this === prototype)
          return new Map(iterable);

        var data = init();
        data.keys = [];
        data.values = [];
        wrap(this, data);

        var self = this;
        iterable && initialize(iterable, function(value, key){
          call(set, self, value, key);
        });
      }
      /**
       * @method       <get>
       * @description  Retrieve the value in the collection that matches key
       * @param        {Any} key
       * @return       {Any}
       */
      function get(key){
        var data = unwrap(this),
            t = type(key);
        return data.values[mget[t](data[t], key)];
      }
      /**
       * @method       <set>
       * @description  Add or update a pair in the collection. Enforces uniqueness by overwriting.
       * @param        {Any} key
       * @param        {Any} val
       **/
      function set(key, value){
        var data = unwrap(this),
            t = type(key),
            index = mget[t](data[t], key);

        if (index === undefined) {
          mset[t](data[t], key, data.keys.length);
          push(data.keys, key);
          push(data.values, value);
        } else {
          data.keys[index] = key;
          data.values[index] = value;
        }
      }
      /**
       * @method       <has>
       * @description  Check if key exists in the collection.
       * @param        {Any} key
       * @return       {Boolean} is in collection
       **/
      function has(key){
        var t = type(key);
        return mhas[t](unwrap(this)[t], key);
      }
      /**
       * @method       <delete>
       * @description  Remove key and matching value if found
       * @param        {Any} key
       * @return       {Boolean} true if item was in collection
       */
      function delete_(key){
        var data = unwrap(this),
            t = type(key),
            index = mget[t](data[t], key);

        if (index === undefined)
          return false;

        mdelete[t](data[t], key);
        splice(data.keys, index, 1);
        splice(data.values, index, 1);
        return true;
      }
      /**
       * @method       <size>
       * @description  Retrieve the amount of items in the collection
       * @return       {Number}
       */
      function size(){
        return unwrap(this).keys.length;
      }
      /**
       * @method       <forEach>
       * @description  Loop through the collection raising callback for each
       * @param        {Function} callback  `callback(value, key)`
       * @param        {Object}   context    The `this` binding for callbacks, default null
       */
      function forEach(callback, context){
        var data = unwrap(this),
            keys = data.keys,
            values = data.values;

        context = context == null ? global : context;

        for (var i=0, len=keys.length; i < len; i++)
          call(callback, context, values[i], keys[i], this);
      }

      delete_ = fixDelete(delete_,
        ['type', 'unwrap', 'call', 'splice'],
        [type, unwrap, call, splice]
      );
      return [Map, get, set, has, delete_, size, forEach];
    });
  }


  // ###########
  // ### Set ###
  // ###########

  exporter('Set', function(wrap, unwrap){
    var prototype = Set[prototype_],
        m = M[prototype_],
        msize = callbind(m.size),
        mforEach = callbind(m.forEach),
        mget = callbind(m.get),
        mset = callbind(m.set),
        mhas = callbind(m.has),
        mdelete = callbind(m['delete']);

    /**
     * @class        Set
     * @description  Collection of values that enforces uniqueness.
     * @param        {Iterable} [iterable]  An item to populate the collection with.
     **/
    function Set(iterable){
      if (this === global || this == null || this === prototype)
        return new Set(iterable);

      wrap(this, new M);

      var self = this;
      iterable && initialize(iterable, function(value, key){
        call(add, self, key);
      });
    }
    /**
     * @method       <add>
     * @description  Insert value if not found, enforcing uniqueness.
     * @param        {Any} val
     */
    function add(key){
      mset(unwrap(this), key, key);
    }
    /**
     * @method       <has>
     * @description  Check if key exists in the collection.
     * @param        {Any} key
     * @return       {Boolean} is in collection
     **/
    function has(key){
      return mhas(unwrap(this), key);
    }
    /**
     * @method       <delete>
     * @description  Remove key and matching value if found
     * @param        {Any} key
     * @return       {Boolean} true if item was in collection
     */
    function delete_(key){
      return mdelete(unwrap(this), key);
    }
    /**
     * @method       <size>
     * @description  Retrieve the amount of items in the collection
     * @return       {Number}
     */
    function size(){
      return msize(unwrap(this));
    }
    /**
     * @method       <forEach>
     * @description  Loop through the collection raising callback for each. Index is simply the counter for the current iteration.
     * @param        {Function} callback  `callback(value, index)`
     * @param        {Object}   context    The `this` binding for callbacks, default null
     */
    function forEach(callback, context){
      var index = 0,
          self = this;
      mforEach(unwrap(this, function(key){
        call(callback, this, key, index++, self);
      }, context));
    }

    delete_ = fixDelete(delete_, ['mdelete', 'unwrap'], [mdelete, unwrap]);
    return [Set, add, has, delete_, size, forEach];
  });
}('string', 'object', 'function', 'prototype', 'toString',
  Array, Object, Function, Function.prototype, (0, eval)('this'),
  typeof exports === 'undefined' ? this : exports, {});

var $__TypeError = TypeError,
    $__Object = Object,
    $__toObject = function(value) {
      if (value == null) throw $__TypeError();
      return $__Object(value);
    },
    $__spread = function() {
      var rv = [],
          k = 0;
      for (var i = 0; i < arguments.length; i++) {
        var value = $__toObject(arguments[i]);
        for (var j = 0; j < value.length; j++) {
          rv[k++] = value[j];
        }
      }
      return rv;
    };
(function(global) {
  "use strict";
  var std_Function_call = Function.prototype.call;
  var std_Function_bind = Function.prototype.bind;
  var bind = std_Function_call.bind(std_Function_bind);
  var callFunction = bind(std_Function_call, std_Function_call);
  var std_Object_create = Object.create;
  var std_Object_defineProperty = Object.defineProperty;
  var std_Object_keys = Object.keys;
  var std_Object_preventExtensions = Object.preventExtensions;
  var std_Array_push = Array.prototype.push;
  var std_Array_sort = Array.prototype.sort;
  var std_Set = Set;
  var std_Set_get_size = Object.getOwnPropertyDescriptor(Set.prototype, "size").get;
  var std_Set_has = Set.prototype.has;
  var std_Set_add = Set.prototype.add;
  var std_Set_delete = Set.prototype.delete;
  var std_Set_clear = Set.prototype.clear;
  var std_Set_iterator = Set.prototype["@@iterator"];
  var std_Set_iterator_next = new Set()["@@iterator"]().next;
  var std_Map = Map;
  var std_Map_has = Map.prototype.has;
  var std_Map_get = Map.prototype.get;
  var std_Map_set = Map.prototype.set;
  var std_Map_delete = Map.prototype.delete;
  var std_Map_entries = Map.prototype.entries;
  var std_Map_keys = Map.prototype.keys;
  var std_Map_values = Map.prototype.values;
  var std_Map_iterator_next = new Map().keys().next;
  var std_WeakMap = WeakMap;
  var std_WeakMap_has = WeakMap.prototype.has;
  var std_WeakMap_get = WeakMap.prototype.get;
  var std_WeakMap_set = WeakMap.prototype.set;
  var std_Promise = Promise;
  var std_Promise_all = Promise.all;
  var std_Promise_resolve = Promise.resolve;
  var std_Promise_then = Promise.prototype.then;
  var std_Promise_catch = Promise.prototype. catch;
  var std_TypeError = TypeError;
  function ToBoolean(v) {
    return !!v;
  }
  function ToString(v) {
    return "" + v;
  }
  function IsObject(v) {
    return v !== null && v !== undefined && typeof v !== "boolean" && typeof v !== "number" && typeof v !== "string" && typeof v !== "symbol";
  }
  function IsCallable(v) {
    return typeof v === "function";
  }
  function CreateSet() {
    return new std_Set;
  }
  function CreateMap() {
    return new std_Map;
  }
  function CreateWeakMap() {
    return new std_WeakMap;
  }
  function IteratorToArray(iter, next) {
    var a = [];
    for (var x = callFunction(next, iter); !x.done; x = callFunction(next, iter)) callFunction(std_Array_push, a, x.value);
    return a;
  }
  function SetToArray(set) {
    return IteratorToArray(callFunction(std_Set_iterator, set), std_Set_iterator_next);
  }
  function MapValuesToArray(map) {
    return IteratorToArray(callFunction(std_Map_values, map), std_Map_iterator_next);
  }
  function PromiseOf(value) {
    return callFunction(std_Promise_resolve, std_Promise, value);
  }
  function Assert(condition) {
    if (typeof assert === "function") assert(condition); else if (typeof assertEq === "function") assertEq(condition, true);
    if (condition !== true) throw "assertion failed";
  }
  var moduleInternalDataMap = CreateWeakMap();
  function GetModuleInternalData(module) {
    return callFunction(std_WeakMap_get, moduleInternalDataMap, module);
  }
  function $CreateModule() {
    var module = std_Object_create(null);
    var moduleData = {
      dependencies: undefined,
      evaluated: false
    };
    callFunction(std_WeakMap_set, moduleInternalDataMap, module, moduleData);
    return module;
  }
  function $IsModule(module) {
    return GetModuleInternalData(module) !== undefined;
  }
  function $GetDependencies(module) {
    return GetModuleInternalData(module).dependencies;
  }
  function $SetDependencies(module, deps) {
    GetModuleInternalData(module).dependencies = deps;
  }
  function $HasBeenEvaluated(module) {
    return GetModuleInternalData(module).evaluated;
  }
  var loaderIteratorInternalDataMap = CreateWeakMap();
  function $SetLoaderIteratorPrivate(iter, value) {
    callFunction(std_WeakMap_set, loaderIteratorInternalDataMap, iter, value);
  }
  function $GetLoaderIteratorPrivate(iter) {
    if (!IsObject(iter)) {
      throw std_TypeError("Loader Iterator method called on an incompatible " + typeof iter);
    }
    if (!callFunction(std_WeakMap_has, loaderIteratorInternalDataMap, iter)) {
      throw std_TypeError("Loader Iterator method called on an incompatible object");
    }
    return callFunction(std_WeakMap_get, loaderIteratorInternalDataMap, iter);
  }
  function CreateLoad(name) {
    return {
      status: "loading",
      name: name,
      linkSets: CreateSet(),
      metadata: {},
      address: undefined,
      source: undefined,
      kind: undefined,
      body: undefined,
      execute: undefined,
      exception: undefined,
      module: null,
      then: undefined
    };
  }
  function MakeClosure_LoadFailed(load) {
    return function(exc) {
      Assert(load.status === "loading");
      load.status = "failed";
      load.exception = exc;
      var linkSets = SetToArray(load.linkSets);
      callFunction(std_Array_sort, linkSets, (function(a, b) {
        return b.timestamp - a.timestamp;
      }));
      {
        try {
          throw undefined;
        } catch ($i) {
          $i = 0;
          for (; $i < linkSets.length; $i++) {
            try {
              throw undefined;
            } catch (i) {
              i = $i;
              try {
                LinkSetFailed(linkSets[i], exc);
              } finally {
                $i = i;
              }
            }
          }
        }
      }
      Assert(callFunction(std_Set_get_size, load.linkSets) === 0);
    };
  }
  function RequestLoad(loader, request, referrerName, referrerAddress) {
    var F = MakeClosure_CallNormalize(loader, request, referrerName, referrerAddress);
    var p = new std_Promise(F);
    p = callFunction(std_Promise_then, p, MakeClosure_GetOrCreateLoad(loader));
    return p;
  }
  function MakeClosure_CallNormalize(loader, request, referrerName, referrerAddress) {
    return function(resolve, reject) {
      resolve(loader.normalize(request, referrerName, referrerAddress));
    };
  }
  function MakeClosure_GetOrCreateLoad(loader) {
    return function(name) {
      var loaderData = GetLoaderInternalData(loader);
      name = ToString(name);
      var existingModule = callFunction(std_Map_get, loaderData.modules, name);
      if (existingModule !== undefined) {
        var load = CreateLoad(name);
        load.status = "linked";
        load.module = existingModule;
        return load;
      }
      var load = callFunction(std_Map_get, loaderData.loads, name);
      if (load !== undefined) {
        Assert(load.status === "loading" || load.status === "loaded");
        return load;
      }
      load = CreateLoad(name);
      callFunction(std_Map_set, loaderData.loads, name, load);
      ProceedToLocate(loader, load);
      return load;
    };
  }
  function ProceedToLocate(loader, load) {
    var p = PromiseOf(undefined);
    p = callFunction(std_Promise_then, p, MakeClosure_CallLocate(loader, load));
    return ProceedToFetch(loader, load, p);
  }
  function ProceedToFetch(loader, load, p) {
    p = callFunction(std_Promise_then, p, MakeClosure_CallFetch(loader, load));
    return ProceedToTranslate(loader, load, p);
  }
  function ProceedToTranslate(loader, load, p) {
    p = callFunction(std_Promise_then, p, MakeClosure_CallTranslate(loader, load));
    p = callFunction(std_Promise_then, p, MakeClosure_CallInstantiate(loader, load));
    p = callFunction(std_Promise_then, p, MakeClosure_InstantiateSucceeded(loader, load));
    callFunction(std_Promise_catch, p, MakeClosure_LoadFailed(load));
  }
  function MakeClosure_CallLocate(loader, load) {
    return function(_) {
      return loader.locate({
        name: load.name,
        metadata: load.metadata
      });
    };
  }
  function MakeClosure_CallFetch(loader, load) {
    return function(address) {
      if (callFunction(std_Set_get_size, load.linkSets) === 0) return;
      load.address = address;
      return loader.fetch({
        name: load.name,
        metadata: load.metadata,
        address: address
      });
    };
  }
  function MakeClosure_CallTranslate(loader, load) {
    return function(source) {
      if (callFunction(std_Set_get_size, load.linkSets) === 0) return;
      return loader.translate({
        name: load.name,
        metadata: load.metadata,
        address: load.address,
        source: source
      });
    };
  }
  function MakeClosure_CallInstantiate(loader, load) {
    return function(source) {
      if (callFunction(std_Set_get_size, load.linkSets) === 0) return;
      load.source = source;
      return loader.instantiate({
        name: load.name,
        metadata: load.metadata,
        address: load.address,
        source: source
      });
    };
  }
  function MakeClosure_InstantiateSucceeded(loader, load) {
    return function(instantiateResult) {
      if (callFunction(std_Set_get_size, load.linkSets) === 0) return;
      var depsList;
      if (instantiateResult === undefined) {
        try {
          throw undefined;
        } catch (body) {
          body = $ParseModule(loader, load.source, load.name, load.address);
          load.body = body;
          load.kind = "declarative";
          depsList = $ModuleRequests(body);
        }
      } else if (IsObject(instantiateResult)) {
        var deps = instantiateResult.deps;
        depsList = deps === undefined ? []: $__spread(deps);
        var execute = instantiateResult.execute;
        load.execute = execute;
        load.kind = "dynamic";
      } else {
        throw std_TypeError("instantiate hook must return an object or undefined");
      }
      ;
      ;
      return ProcessLoadDependencies(load, loader, depsList);
    };
  }
  function ProcessLoadDependencies(load, loader, depsList) {
    var referrerName = load.name;
    load.dependencies = CreateMap();
    var loadPromises = [];
    for (var i = 0; i < depsList.length; i++) {
      var request = depsList[i];
      var p = RequestLoad(loader, request, referrerName, load.address);
      p = callFunction(std_Promise_then, p, MakeClosure_AddDependencyLoad(load, request));
      callFunction(std_Array_push, loadPromises, p);
    }
    var p = callFunction(std_Promise_all, std_Promise, loadPromises);
    p = callFunction(std_Promise_then, p, MakeClosure_LoadSucceeded(load));
    return p;
  }
  function MakeClosure_AddDependencyLoad(parentLoad, request) {
    return function(depLoad) {
      Assert(!callFunction(std_Map_has, parentLoad.dependencies, request));
      callFunction(std_Map_set, parentLoad.dependencies, request, depLoad.name);
      if (depLoad.status !== "linked") {
        var linkSets = SetToArray(parentLoad.linkSets);
        {
          try {
            throw undefined;
          } catch ($j) {
            $j = 0;
            for (; $j < linkSets.length; $j++) {
              try {
                throw undefined;
              } catch (j) {
                j = $j;
                try {
                  AddLoadToLinkSet(linkSets[j], depLoad);
                } finally {
                  $j = j;
                }
              }
            }
          }
        }
      }
    };
  }
  function MakeClosure_LoadSucceeded(load) {
    return function(_) {
      Assert(load.status === "loading");
      load.status = "loaded";
      var linkSets = SetToArray(load.linkSets);
      callFunction(std_Array_sort, linkSets, (function(a, b) {
        return b.timestamp - a.timestamp;
      }));
      {
        try {
          throw undefined;
        } catch ($i) {
          $i = 0;
          for (; $i < linkSets.length; $i++) {
            try {
              throw undefined;
            } catch (i) {
              i = $i;
              try {
                UpdateLinkSetOnLoad(linkSets[i], load);
              } finally {
                $i = i;
              }
            }
          }
        }
      }
    };
  }
  function CreateLinkSet(loader, startingLoad) {
    var loaderData = GetLoaderInternalData(loader);
    var resolve,
        reject;
    var done = new std_Promise(function(res, rej) {
      resolve = res;
      reject = rej;
    });
    var linkSet = {
      loader: loader,
      loads: CreateSet(),
      done: done,
      resolve: resolve,
      reject: reject,
      timestamp: loaderData.linkSetCounter++,
      loadingCount: 0
    };
    AddLoadToLinkSet(linkSet, startingLoad);
    return linkSet;
  }
  function AddLoadToLinkSet(linkSet, load) {
    Assert(load.status === "loading" || load.status === "loaded");
    var loaderData = GetLoaderInternalData(linkSet.loader);
    if (!callFunction(std_Set_has, linkSet.loads, load)) {
      callFunction(std_Set_add, linkSet.loads, load);
      callFunction(std_Set_add, load.linkSets, linkSet);
      if (load.status === "loaded") {
        try {
          throw undefined;
        } catch (names) {
          names = MapValuesToArray(load.dependencies);
          {
            try {
              throw undefined;
            } catch ($i) {
              $i = 0;
              for (; $i < names.length; $i++) {
                try {
                  throw undefined;
                } catch (i) {
                  i = $i;
                  try {
                    try {
                      throw undefined;
                    } catch (name) {
                      name = names[i];
                      if (!callFunction(std_Map_has, loaderData.modules, name)) {
                        try {
                          throw undefined;
                        } catch (depLoad) {
                          depLoad = callFunction(std_Map_get, loaderData.loads, name);
                          if (depLoad !== undefined) AddLoadToLinkSet(linkSet, depLoad);
                        }
                      }
                    }
                  } finally {
                    $i = i;
                  }
                }
              }
            }
          }
        }
      } else {
        linkSet.loadingCount++;
      }
    }
  }
  function UpdateLinkSetOnLoad(linkSet, load) {
    Assert(callFunction(std_Set_has, linkSet.loads, load));
    Assert(load.status === "loaded" || load.status === "linked");
    if (--linkSet.loadingCount !== 0) return;
    var startingLoad = callFunction(std_Set_iterator_next, callFunction(std_Set_iterator, linkSet.loads)).value;
    try {
      Link(linkSet.loads, linkSet.loader);
    } catch (exc) {
      LinkSetFailed(linkSet, exc);
      return;
    }
    Assert(callFunction(std_Set_get_size, linkSet.loads) === 0);
    linkSet.resolve(startingLoad);
  }
  function LinkSetFailed(linkSet, exc) {
    var loaderData = GetLoaderInternalData(linkSet.loader);
    var loads = SetToArray(linkSet.loads);
    for (var i = 0; i < loads.length; i++) {
      var load = loads[i];
      Assert(callFunction(std_Set_has, load.linkSets, linkSet));
      callFunction(std_Set_delete, load.linkSets, linkSet);
      if (callFunction(std_Set_get_size, load.linkSets) === 0) {
        try {
          throw undefined;
        } catch (name) {
          name = load.name;
          if (name !== undefined) {
            try {
              throw undefined;
            } catch (currentLoad) {
              currentLoad = callFunction(std_Map_get, loaderData.loads, name);
              if (currentLoad === load) {
                callFunction(std_Map_delete, loaderData.loads, name);
              }
            }
          }
        }
      }
    }
    return linkSet.reject(exc);
  }
  function FinishLoad(loader, load) {
    var loaderData = GetLoaderInternalData(loader);
    var name = load.name;
    if (name !== undefined) {
      Assert(!callFunction(std_Map_has, loaderData.modules, name));
      callFunction(std_Map_set, loaderData.modules, name, load.module);
    }
    var name = load.name;
    if (name !== undefined) {
      try {
        throw undefined;
      } catch (currentLoad) {
        currentLoad = callFunction(std_Map_get, loaderData.loads, name);
        if (currentLoad === load) {
          callFunction(std_Map_delete, loaderData.loads, name);
        }
      }
    }
    var linkSets = SetToArray(load.linkSets);
    for (var i = 0; i < linkSets.length; i++) {
      callFunction(std_Set_delete, linkSets[i].loads, load);
    }
    callFunction(std_Set_clear, load.linkSets);
  }
  function LoadModule(loader, name, options) {
    var loaderData = GetLoaderInternalData(loader);
    name = ToString(name);
    var address = GetOption(options, "address");
    var F = MakeClosure_AsyncStartLoadPartwayThrough(loader, loaderData, name, address === undefined ? "locate": "fetch", {}, address, undefined);
    return new std_Promise(F);
  }
  function MakeClosure_AsyncStartLoadPartwayThrough(loader, loaderData, name, step, metadata, address, source) {
    return function(resolve, reject) {
      if (callFunction(std_Map_has, loaderData.modules, name)) {
        throw std_TypeError("can't define module \"" + name + "\": already loaded");
      }
      if (callFunction(std_Map_has, loaderData.loads, name)) {
        throw std_TypeError("can't define module \"" + name + "\": already loading");
      }
      var load = CreateLoad(name);
      load.metadata = metadata;
      var linkSet = CreateLinkSet(loader, load);
      callFunction(std_Map_set, loaderData.loads, name, load);
      resolve(linkSet.done);
      if (step == "locate") {
        ProceedToLocate(loader, load);
      } else if (step == "fetch") {
        ProceedToFetch(loader, load, PromiseOf(address));
      } else {
        $Assert(step == "translate");
        load.address = address;
        var sourcePromise = PromiseOf(source);
        ProceedToTranslate(loader, load, sourcePromise);
      }
    };
  }
  function MakeClosure_EvaluateLoadedModule(loader) {
    return function(load) {
      Assert(load.status === "linked");
      var module = load.module;
      EnsureEvaluatedHelper(module, loader);
      return module;
    };
  }
  function Link(loads, loader) {
    loads = SetToArray(loads);
    for (var i = 0; i < loads.length; i++) {
      if (loads[i].kind !== "dynamic") throw new InternalError("Module linking is not implemented.");
    }
    LinkDynamicModules(loads, loader);
  }
  function LinkDynamicModules(loads, loader) {
    for (var i = 0; i < loads.length; i++) {
      var load = loads[i];
      var mod = callFunction(load.execute, undefined);
      if (!$IsModule(mod)) throw std_TypeError("factory.execute callback must return a Module object");
      load.module = mod;
      load.status = "linked";
      FinishLoad(loader, load);
    }
  }
  function EnsureEvaluated(mod, seen, loaderData) {
    callFunction(std_Set_add, seen, mod);
    var deps = $GetDependencies(mod);
    if (deps === undefined) return;
    {
      try {
        throw undefined;
      } catch ($i) {
        $i = 0;
        for (; $i < deps.length; $i++) {
          try {
            throw undefined;
          } catch (i) {
            i = $i;
            try {
              try {
                throw undefined;
              } catch (dep) {
                dep = deps[i];
                if (!callFunction(std_Set_has, seen, dep)) {
                  EnsureEvaluated(dep, seen, loaderData);
                }
              }
            } finally {
              $i = i;
            }
          }
        }
      }
    }
    if (!$HasBeenEvaluated(mod)) {
      $EvaluateModuleBody(loaderData.realm, mod);
    }
  }
  function EnsureEvaluatedHelper(mod, loader) {
    var seen = CreateSet();
    var loaderData = GetLoaderInternalData(loader);
    EnsureEvaluated(mod, seen, loaderData);
    seen = SetToArray(seen);
    {
      try {
        throw undefined;
      } catch ($i) {
        $i = 0;
        for (; $i < seen.length; $i++) {
          try {
            throw undefined;
          } catch (i) {
            i = $i;
            try {
              $SetDependencies(seen[i], undefined);
            } finally {
              $i = i;
            }
          }
        }
      }
    }
  }
  function CreateConstantGetter(key, value) {
    var getter = function() {
      return value;
    };
    return getter;
  }
  function Module(obj) {
    if (!IsObject(obj)) throw std_TypeError("Module argument must be an object");
    var mod = $CreateModule();
    var keys = std_Object_keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = obj[key];
      std_Object_defineProperty(mod, key, {
        configurable: false,
        enumerable: true,
        get: CreateConstantGetter(key, value),
        set: undefined
      });
    }
    std_Object_preventExtensions(mod);
    return mod;
  }
  Module.prototype = null;
  var realmInternalDataMap = CreateWeakMap();
  function GetRealmInternalData(value) {
    if (typeof value !== "object") throw std_TypeError("Realm method or accessor called on incompatible primitive");
    var realmData = callFunction(std_WeakMap_get, realmInternalDataMap, value);
    if (realmData === undefined) throw std_TypeError("Realm method or accessor called on incompatible object");
    return realmData;
  }
  function Realm(options, initializer) {
    var realmObject = callFunction(Realm["@@create"], Realm);
    if (!IsObject(realmObject)) throw std_TypeError("Realm object expected");
    var realmData = callFunction(std_WeakMap_get, realmInternalDataMap, realmObject);
    if (realmData.realm !== undefined) throw std_TypeError("Realm object cannot be intitialized more than once");
    if (options === undefined) options = std_Object_create(null);
    if (!IsObject(options)) throw std_TypeError("options must be an object or undefined");
    var realm = $CreateRealm(realmObject);
    var evalHooks = UnpackOption(options, "eval", (function() {
      return ({});
    }));
    if (!IsObject(evalHooks)) throw std_TypeError("options.eval must be an object or undefined");
    var directEval = UnpackOption(evalHooks, "direct", (function() {
      return ({});
    }));
    if (!IsObject(directEval)) throw std_TypeError("options.eval.direct must be an object or undefined");
    var translate = UnpackOption(directEval, "translate");
    if (translate !== undefined && !IsCallable(translate)) throw std_TypeError("translate hook is not callable");
    realm.translateDirectEvalHook = translate;
    var fallback = UnpackOption(directEval, "fallback");
    if (fallback !== undefined && !IsCallable(fallback)) throw std_TypeError("fallback hook is not callable");
    realm.fallbackDirectEvalHook = fallback;
    var indirectEval = UnpackOption(evalHooks, "indirect");
    if (indirectEval !== undefined && !IsCallable(indirectEval)) throw std_TypeError("indirect eval hook is not callable");
    realm.indirectEvalHook = indirectEval;
    var Function = UnpackOption(options, "Function");
    if (Function !== undefined && !IsCallable(Function)) throw std_TypeError("Function hook is not callable");
    realm.FunctionHook = Function;
    realmData.realm = realm;
    if (initializer !== undefined) {
      if (!IsCallable(initializer)) throw std_TypeError("initializer is not callable");
      callFunction(initializer, realmObject, realm.builtins);
    }
    return realmObject;
  }
  def(Realm.prototype, {
    get global() {
      var realmData = GetRealmInternalData(this);
      return realmData.realm.globalThis;
    },
    eval: function(source) {
      var realmData = GetRealmInternalData(this);
      return $IndirectEval(realmData.realm, source);
    }
  });
  var Realm_create = function create() {
    var realmObject = std_Object_create(this.prototype);
    var realmData = {realm: undefined};
    callFunction(std_WeakMap_set, realmInternalDataMap, realmObject, realmData);
    return realmObject;
  };
  def(Realm, {"@@create": Realm_create});
  var loaderInternalDataMap = CreateWeakMap();
  function GetLoaderInternalData(value) {
    if (typeof value !== "object") throw std_TypeError("Loader method called on incompatible primitive");
    var loaderData = callFunction(std_WeakMap_get, loaderInternalDataMap, value);
    if (loaderData === undefined) throw std_TypeError("Loader method called on incompatible object");
    return loaderData;
  }
  function GetOption(options, name) {
    if (options === undefined) return undefined;
    if (!IsObject(options)) throw std_TypeError("options must be either an object or undefined");
    return options[name];
  }
  function Loader() {
    var options = arguments[0] !== (void 0) ? arguments[0]: {};
    var loader = callFunction(Loader["@@create"], Loader);
    if (!IsObject(loader)) throw std_TypeError("Loader object expected");
    var loaderData = callFunction(std_WeakMap_get, loaderInternalDataMap, loader);
    if (loaderData === undefined) throw std_TypeError("Loader object expected");
    if (loaderData.modules !== undefined) throw std_TypeError("Loader object cannot be intitialized more than once");
    if (!IsObject(options)) throw std_TypeError("options must be an object or undefined");
    var realmObject = options.realm;
    var realm;
    if (realmObject === undefined) {
      realm = undefined;
    } else if (IsObject(realmObject) && callFunction(std_WeakMap_has, realmInternalDataMap, realmObject)) {
      realm = GetRealmInternalData(realmObject).realm;
    } else {
      throw std_TypeError("options.realm is not a Realm object");
    }
    var hooks = ["normalize", "locate", "fetch", "translate", "instantiate"];
    {
      try {
        throw undefined;
      } catch ($i) {
        $i = 0;
        for (; $i < hooks.length; $i++) {
          try {
            throw undefined;
          } catch (i) {
            i = $i;
            try {
              try {
                throw undefined;
              } catch (name) {
                name = hooks[i];
                var hook = options[name];
                if (hook !== undefined) {
                  std_Object_defineProperty(loader, name, {
                    configurable: true,
                    enumerable: true,
                    value: hook,
                    writable: true
                  });
                }
              }
            } finally {
              $i = i;
            }
          }
        }
      }
    }
    loaderData.modules = CreateMap();
    loaderData.loads = CreateMap();
    loaderData.realm = realm;
    return loader;
  }
  function def(obj, props) {
    var names = Object.getOwnPropertyNames(props);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var desc = Object.getOwnPropertyDescriptor(props, name);
      desc.enumerable = false;
      Object.defineProperty(obj, name, desc);
    }
  }
  def(global, {
    Module: Module,
    Loader: Loader
  });
  var Loader_create = function create() {
    var loader = std_Object_create(this.prototype);
    var loaderData = {
      modules: undefined,
      loads: undefined,
      realm: undefined,
      linkSetCounter: 0
    };
    callFunction(std_WeakMap_set, loaderInternalDataMap, loader, loaderData);
    return loader;
  };
  def(Loader, {"@@create": Loader_create});
  function UnpackOption(options, name, thunk) {
    var value;
    return (options === undefined || ((value = options[name]) === undefined)) ? (thunk ? thunk(): undefined): value;
  }
  def(Loader.prototype, {
    get realm() {
      if (!IsObject(this) || !callFunction(std_WeakMap_has, loaderInternalDataMap, this)) {
        throw std_TypeError("not a Loader object");
      }
      return GetLoaderInternalData(this).realm.realmObject;
    },
    get global() {
      if (!IsObject(this) || !callFunction(std_WeakMap_has, loaderInternalDataMap, this)) {
        throw std_TypeError("not a Loader object");
      }
      return GetLoaderInternalData(this).realm.globalThis;
    },
    define: function define(name, source) {
      var options = arguments[2];
      var loader = this;
      var loaderData = GetLoaderInternalData(this);
      name = ToString(name);
      var address = GetOption(options, "address");
      var metadata = GetOption(options, "metadata");
      if (metadata === undefined) metadata = {};
      var f = MakeClosure_AsyncStartLoadPartwayThrough(loader, loaderData, name, "translate", metadata, address, source);
      var p = new std_Promise(f);
      p = callFunction(std_Promise_then, p, function(_) {});
      return p;
    },
    load: function load(name) {
      var options = arguments[1];
      var p = LoadModule(this, name, options);
      p = callFunction(std_Promise_then, p, function(_) {});
      return p;
    },
    module: function module (source) {
      var options = arguments[1];
      var loader = this;
      GetLoaderInternalData(this);
      var address = GetOption(options, "address");
      var load = CreateLoad(undefined);
      load.address = address;
      var linkSet = CreateLinkSet(loader, load);
      var p = callFunction(std_Promise_then, linkSet.done, MakeClosure_EvaluateLoadedModule(loader));
      var sourcePromise = PromiseOf(source);
      ProceedToTranslate(loader, load, sourcePromise);
      return p;
    },
    import: function import_(name) {
      var options = arguments[1];
      var loader = this;
      var p = LoadModule(loader, name, options);
      p = callFunction(std_Promise_then, p, MakeClosure_EvaluateLoadedModule(loader));
      return p;
    },
    eval: function(source) {
      var loaderData = GetLoaderInternalData(this);
      return $IndirectEval(loaderData.realm, source);
    },
    get: function get(name) {
      var loaderData = GetLoaderInternalData(this);
      name = ToString(name);
      var m = callFunction(std_Map_get, loaderData.modules, name);
      if (m !== undefined) EnsureEvaluatedHelper(m, this);
      return m;
    },
    has: function has(name) {
      var loaderData = GetLoaderInternalData(this);
      name = ToString(name);
      return callFunction(std_Map_has, loaderData.modules, name);
    },
    set: function set(name, module) {
      var loaderData = GetLoaderInternalData(this);
      name = ToString(name);
      if (!$IsModule(module)) throw std_TypeError("Module object required");
      callFunction(std_Map_set, loaderData.modules, name, module);
      return this;
    },
    delete: function delete_(name) {
      var loaderData = GetLoaderInternalData(this);
      name = ToString(name);
      return callFunction(std_Map_delete, loaderData.modules, name);
    },
    entries: function entries() {
      var loaderData = GetLoaderInternalData(this);
      return new LoaderIterator(callFunction(std_Map_entries, loaderData.modules));
    },
    keys: function keys() {
      var loaderData = GetLoaderInternalData(this);
      return new LoaderIterator(callFunction(std_Map_keys, loaderData.modules));
    },
    values: function values() {
      var loaderData = GetLoaderInternalData(this);
      return new LoaderIterator(callFunction(std_Map_values, loaderData.modules));
    },
    normalize: function normalize(name, referrerName, referrerAddress) {
      return name;
    },
    locate: function locate(load) {
      return load.name;
    },
    fetch: function fetch(load) {
      throw std_TypeError("Loader.prototype.fetch was called");
    },
    translate: function translate(load) {
      return load.source;
    },
    instantiate: function instantiate(load) {}
  });
  def(Loader.prototype, {"@@iterator": Loader.prototype.entries});
  function LoaderIterator(iterator) {
    $SetLoaderIteratorPrivate(this, iterator);
  }
  LoaderIterator.prototype = {
    next: function next() {
      return callFunction(std_Map_iterator_next, $GetLoaderIteratorPrivate(this));
    },
    "@@iterator": function() {
      return this;
    },
    "@@toStringTag": "Loader Iterator"
  };
})(this);

//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9tb2R1bGVzL2pzLWxvYWRlcnMvTG9hZGVyLmpzLmVzNiIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL2pzLWxvYWRlcnMvTG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZ0NBLENBQUMsUUFBQSxDQUFVLE1BQUE7QUFDWCxjQUFBO0FBS0ksS0FBQSxrQkFBQSxFQUFvQixTQUFBLENBQUEsU0FBQSxDQUFBLElBQUE7QUFDcEIsS0FBQSxrQkFBQSxFQUFvQixTQUFBLENBQUEsU0FBQSxDQUFBLElBQUE7QUFDcEIsS0FBQSxLQUFBLEVBQU8sa0JBQUEsQ0FBQSxJQUFzQixDQUFDLGlCQUFBLENBQUE7QUFDOUIsS0FBQSxhQUFBLEVBQWUsS0FBSSxDQUFDLGlCQUFBLENBQW1CLGtCQUFBLENBQUE7QUFFdkMsS0FBQSxrQkFBQSxFQUFvQixPQUFBLENBQUEsTUFBQTtBQUNwQixLQUFBLDBCQUFBLEVBQTRCLE9BQUEsQ0FBQSxjQUFBO0FBQzVCLEtBQUEsZ0JBQUEsRUFBa0IsT0FBQSxDQUFBLElBQUE7QUFDbEIsS0FBQSw2QkFBQSxFQUErQixPQUFBLENBQUEsaUJBQUE7QUFDL0IsS0FBQSxlQUFBLEVBQWlCLE1BQUEsQ0FBQSxTQUFBLENBQUEsSUFBQTtBQUNqQixLQUFBLGVBQUEsRUFBaUIsTUFBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBO0FBQ2pCLEtBQUEsUUFBQSxFQUFVLElBQUE7QUFDVixLQUFBLGlCQUFBLEVBQW1CLE9BQUEsQ0FBQSx3QkFBK0IsQ0FBQyxHQUFBLENBQUEsU0FBQSxDQUFlLE9BQUEsQ0FBQSxDQUFBLEdBQUE7QUFDbEUsS0FBQSxZQUFBLEVBQWMsSUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBO0FBQ2QsS0FBQSxZQUFBLEVBQWMsSUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBO0FBQ2QsS0FBQSxlQUFBLEVBQWlCLElBQUEsQ0FBQSxTQUFBLENBQUEsTUFBQTtBQUNqQixLQUFBLGNBQUEsRUFB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QU0sRUFBQTtBQUFBLEdBQUEsQ0FBQTtBQVc1QyxLQUFHLENBQUMsTUFBQSxDQUFBLFNBQUEsQ0FBa0IsRUFBQyxZQUFBLENBQWMsT0FBQSxDQUFBLFNBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtBQXNDckMsVUFBUyxlQUFBLENBQWUsUUFBQSxDQUFVO0FBQzlCLDZCQUF5QixDQUFDLElBQUEsQ0FBTSxTQUFBLENBQUE7QUFBQTtBQVdwQyxnQkFBQSxDQUFBLFNBQUEsRUFBMkI7QUFxQ3ZCLFFBQUEsQ0FBTSxTQUFTLEtBQUEsQ0FBSyxDQUFFO0FBQ2xCLFlBQU8sYUFBWSxDQUFDLHFCQUFBLENBQXVCLDBCQUF5QixDQUFDLElBQUEsQ0FBQSxDQUFBO0FBQUEsS0FBQTtBQU96RSxnQkFBQSxDQUFjLFNBQUEsQ0FBVSxDQUFFO0FBRXRCLFlBQU8sS0FBQTtBQUFBLEtBQUE7QUFlWCxtQkFBQSxDQUFpQjtBQUFBLEdBQUE7QUFBQSxDQUFBLENBR25CLENBQUMsSUFBQSxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyogVGhpcyBTb3VyY2UgQ29kZSBGb3JtIGlzIHN1YmplY3QgdG8gdGhlIHRlcm1zIG9mIHRoZSBNb3ppbGxhIFB1YmxpY1xuICogTGljZW5zZSwgdi4gMi4wLiBJZiBhIGNvcHkgb2YgdGhlIE1QTCB3YXMgbm90IGRpc3RyaWJ1dGVkIHdpdGggdGhpc1xuICogZmlsZSwgWW91IGNhbiBvYnRhaW4gb25lIGF0IGh0dHA6Ly9tb3ppbGxhLm9yZy9NUEwvMi4wLy4gKi9cblxuLy8gIyBMb2FkZXIuanMgLSBFUzYgbW9kdWxlIGxvYWRlcnMgaWxsdXN0cmF0ZWRcbi8vXG4vLyBUaGlzIGlzIGEgc2FtcGxlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBFUzYgbW9kdWxlIGxvYWRlci4gIFRoZSBjb2RlIGlzXG4vLyBpbnRlcmxlYXZlZCB3aXRoIGNvbW1lbnRzIGNvbnRhaW5pbmcgZHJhZnQgc3BlY2lmaWNhdGlvbiBsYW5ndWFnZSBmb3IgdGhlXG4vLyBFUzYgbW9kdWxlIHN5c3RlbS5cbi8vXG4vLyBTb3VyY2UgY29kZSBpcyBvbiBnaXRodWI6XG4vLyBbam9yZW5kb3JmZi9qcy1sb2FkZXJzXShodHRwczovL2dpdGh1Yi5jb20vam9yZW5kb3JmZi9qcy1sb2FkZXJzKS5cblxuXG4vLyAjIyBDdXJyZW50IHN0YXR1c1xuLy9cbi8vIFRoaXMgY29kZSBkb2VzIG5vdCB3b3JrIHlldCwgdGhvdWdoIGl0IHBhc3NlcyBbYSBmZXcgdmVyeSBiYXNpY1xuLy8gdGVzdHNdKGh0dHBzOi8vZ2l0aHViLmNvbS9qb3JlbmRvcmZmL2pzLWxvYWRlcnMvdHJlZS9tYXN0ZXIvdGVzdCkuICBXZSdyZVxuLy8gZm9jdXNpbmcgb24gcHJvZHVjaW5nIGEgY29oZXJlbnQgc3BlYyBkb2N1bWVudC4gIEknbSBhbHNvIHZlcnkgaW50ZXJlc3RlZCBpblxuLy8gc3RhbmRpbmcgdGhlIHN5c3RlbSB1cCBhbmQgcnVubmluZyB0ZXN0cywgYnV0IHRoYXQgd2lsbCBoYXZlIHRvIHdhaXQgYSB3ZWVrXG4vLyBvciB0d28uXG4vL1xuLy8gVGhpcyBpcyBub3QgYW4gaW50cm9kdWN0aW9uIHRvIHRoZSBFUzYgbW9kdWxlIHN5c3RlbS4gSXQncyBub3QgYSB0dXRvcmlhbCBvclxuLy8gYSByYXRpb25hbGUgZG9jdW1lbnQuIEl0J3MgbWFpbmx5IHNwZWNpZmljYXRpb24gdGV4dCB3aXRoIGEgZmV3IGV4cGxhbmF0b3J5XG4vLyBjb21tZW50cy5cblxuXG4vLyAjIyBQcmVsdWRlXG4vL1xuLy8gVGhpcyBzZWN0aW9uIGlzIG5vdCBleGFjdGx5IHJpdmV0aW5nIHJlYWRpbmcuIEl0J3Mgc2FmZSB0byBza2lwIGRvd24gdG9cbi8vICZsZHF1bztQcmltaXRpdmVzJnJkcXVvOy5cbi8vXG4oZnVuY3Rpb24gKGdsb2JhbCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIFRoaXMgaW1wbGVtZW50YXRpb24gdXNlcyBzb21lIEVTIGJ1aWx0aW5zLiBVc2VyIHNjcmlwdHMgbWF5IG11dGF0ZSBvciBkZWxldGVcbi8vIHRob3NlIGJ1aWx0aW5zLCBzbyB3ZSBjYXB0dXJlIGV2ZXJ5dGhpbmcgd2UgbmVlZCB1cCBmcm9udC5cbi8vXG52YXIgc3RkX0Z1bmN0aW9uX2NhbGwgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbDtcbnZhciBzdGRfRnVuY3Rpb25fYmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kO1xudmFyIGJpbmQgPSBzdGRfRnVuY3Rpb25fY2FsbC5iaW5kKHN0ZF9GdW5jdGlvbl9iaW5kKTtcbnZhciBjYWxsRnVuY3Rpb24gPSBiaW5kKHN0ZF9GdW5jdGlvbl9jYWxsLCBzdGRfRnVuY3Rpb25fY2FsbCk7XG5cbnZhciBzdGRfT2JqZWN0X2NyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG52YXIgc3RkX09iamVjdF9kZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcbnZhciBzdGRfT2JqZWN0X2tleXMgPSBPYmplY3Qua2V5cztcbnZhciBzdGRfT2JqZWN0X3ByZXZlbnRFeHRlbnNpb25zID0gT2JqZWN0LnByZXZlbnRFeHRlbnNpb25zO1xudmFyIHN0ZF9BcnJheV9wdXNoID0gQXJyYXkucHJvdG90eXBlLnB1c2g7XG52YXIgc3RkX0FycmF5X3NvcnQgPSBBcnJheS5wcm90b3R5cGUuc29ydDtcbnZhciBzdGRfU2V0ID0gU2V0O1xudmFyIHN0ZF9TZXRfZ2V0X3NpemUgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKFNldC5wcm90b3R5cGUsIFwic2l6ZVwiKS5nZXQ7XG52YXIgc3RkX1NldF9oYXMgPSBTZXQucHJvdG90eXBlLmhhcztcbnZhciBzdGRfU2V0X2FkZCA9IFNldC5wcm90b3R5cGUuYWRkO1xudmFyIHN0ZF9TZXRfZGVsZXRlID0gU2V0LnByb3RvdHlwZS5kZWxldGU7XG52YXIgc3RkX1NldF9jbGVhciA9IFNldC5wcm90b3R5cGUuY2xlYXI7XG52YXIgc3RkX1NldF9pdGVyYXRvciA9IFNldC5wcm90b3R5cGVbXCJAQGl0ZXJhdG9yXCJdO1xudmFyIHN0ZF9TZXRfaXRlcmF0b3JfbmV4dCA9IG5ldyBTZXQoKVtcIkBAaXRlcmF0b3JcIl0oKS5uZXh0O1xudmFyIHN0ZF9NYXAgPSBNYXA7XG52YXIgc3RkX01hcF9oYXMgPSBNYXAucHJvdG90eXBlLmhhcztcbnZhciBzdGRfTWFwX2dldCA9IE1hcC5wcm90b3R5cGUuZ2V0O1xudmFyIHN0ZF9NYXBfc2V0ID0gTWFwLnByb3RvdHlwZS5zZXQ7XG52YXIgc3RkX01hcF9kZWxldGUgPSBNYXAucHJvdG90eXBlLmRlbGV0ZTtcbnZhciBzdGRfTWFwX2VudHJpZXMgPSBNYXAucHJvdG90eXBlLmVudHJpZXM7XG52YXIgc3RkX01hcF9rZXlzID0gTWFwLnByb3RvdHlwZS5rZXlzO1xudmFyIHN0ZF9NYXBfdmFsdWVzID0gTWFwLnByb3RvdHlwZS52YWx1ZXM7XG52YXIgc3RkX01hcF9pdGVyYXRvcl9uZXh0ID0gbmV3IE1hcCgpLmtleXMoKS5uZXh0O1xudmFyIHN0ZF9XZWFrTWFwID0gV2Vha01hcDtcbnZhciBzdGRfV2Vha01hcF9oYXMgPSBXZWFrTWFwLnByb3RvdHlwZS5oYXM7XG52YXIgc3RkX1dlYWtNYXBfZ2V0ID0gV2Vha01hcC5wcm90b3R5cGUuZ2V0O1xudmFyIHN0ZF9XZWFrTWFwX3NldCA9IFdlYWtNYXAucHJvdG90eXBlLnNldDtcbnZhciBzdGRfUHJvbWlzZSA9IFByb21pc2U7XG52YXIgc3RkX1Byb21pc2VfYWxsID0gUHJvbWlzZS5hbGw7XG52YXIgc3RkX1Byb21pc2VfcmVzb2x2ZSA9IFByb21pc2UucmVzb2x2ZTtcbnZhciBzdGRfUHJvbWlzZV90aGVuID0gUHJvbWlzZS5wcm90b3R5cGUudGhlbjtcbnZhciBzdGRfUHJvbWlzZV9jYXRjaCA9IFByb21pc2UucHJvdG90eXBlLmNhdGNoO1xudmFyIHN0ZF9UeXBlRXJyb3IgPSBUeXBlRXJyb3I7XG5cblxuLy8gQSBoYW5kZnVsIG9mIHV0aWxpdHkgZnVuY3Rpb25zIGJ1aWx0IGZyb20gRVMgc3RhbmRhcmQgZmFjaWxpdGllcy5cblxuLy8gRVM2IFRvQm9vbGVhbiBhYnN0cmFjdCBvcGVyYXRpb24uXG5mdW5jdGlvbiBUb0Jvb2xlYW4odikge1xuICAgIHJldHVybiAhIXY7XG59XG5cbi8vIEVTNiBUb1N0cmluZyBhYnN0cmFjdCBvcGVyYXRpb24uXG5mdW5jdGlvbiBUb1N0cmluZyh2KSB7XG4gICAgcmV0dXJuIFwiXCIgKyB2O1xufVxuXG4vLyAqKklzT2JqZWN0KHYpKiogJm5kYXNoOyBSZXR1cm4gdHJ1ZSBpZiBUeXBlKHYpIGlzIE9iamVjdC5cbi8vIFBlcmhhcHMgc3VycHJpc2luZ2x5LCBwcm9jZXNzIG9mIGVsaW1pbmF0aW9uIGlzIHRoZSBvbmx5IGNvcnJlY3Qgd2F5IHRvXG4vLyBpbXBsZW1lbnQgdGhpcy4gIFNlZSBbRVM1IDExLjQuMywgXCJUaGUgYHR5cGVvZmBcbi8vIE9wZXJhdG9yXCJdKGh0dHBzOi8vcGVvcGxlLm1vemlsbGEuY29tL35qb3JlbmRvcmZmL2VzNS4xLWZpbmFsLmh0bWwjc2VjLTExLjQuMykuXG4vL1xuZnVuY3Rpb24gSXNPYmplY3Qodikge1xuICAgIHJldHVybiB2ICE9PSBudWxsICYmXG4gICAgICAgICAgIHYgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICB0eXBlb2YgdiAhPT0gXCJib29sZWFuXCIgJiZcbiAgICAgICAgICAgdHlwZW9mIHYgIT09IFwibnVtYmVyXCIgJiZcbiAgICAgICAgICAgdHlwZW9mIHYgIT09IFwic3RyaW5nXCIgJiZcbiAgICAgICAgICAgdHlwZW9mIHYgIT09IFwic3ltYm9sXCI7XG59XG5cbi8vIEVTNiBJc0NhbGxhYmxlIGFic3RyYWN0IG9wZXJhdGlvbi5cbmZ1bmN0aW9uIElzQ2FsbGFibGUodikge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG4vLyBUaGlzIGltcGxlbWVudGF0aW9uIHVzZXMgRVM2IFNldCwgTWFwLCBhbmQgV2Vha01hcCBvYmplY3RzIGluIHNvbWUgcGxhY2VzXG4vLyB3aGVyZSB0aGUgc3BlYyB0ZXh0IHJlZmVycyB0byBMaXN0cyBhbmQgaW50ZXJuYWwgc2xvdHMuXG4vL1xuLy8gQnVnOiBJbiBpbXBsZW1lbnRhdGlvbnMgdGhhdCBzdXBwb3J0IEBAY3JlYXRlLCB0aGUgYENyZWF0ZVNldCgpYCBmdW5jdGlvblxuLy8gZ2l2ZW4gaGVyZSB3b3VsZCBiZSBhZmZlY3RlZCBieSBtb2RpZnlpbmcgdGhlIEBAY3JlYXRlIG1ldGhvZCBvZiB0aGUgU2V0XG4vLyBidWlsdGluICh3aGljaCBpcyBhIGNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSkuIFRoaXMgaW1wbGVtZW50YXRpb24gd2lsbCBjaGFuZ2Vcbi8vIHdoZW5ldmVyIEBAY3JlYXRlIGlzIGltcGxlbWVudGVkLiBUaGUgc2FtZSBpcyB0cnVlIGZvciBgQ3JlYXRlTWFwKClgIGFuZFxuLy8gYENyZWF0ZVdlYWtNYXAoKWAuXG4vL1xuZnVuY3Rpb24gQ3JlYXRlU2V0KCkge1xuICAgIHJldHVybiBuZXcgc3RkX1NldDtcbn1cblxuZnVuY3Rpb24gQ3JlYXRlTWFwKCkge1xuICAgIHJldHVybiBuZXcgc3RkX01hcDtcbn1cblxuZnVuY3Rpb24gQ3JlYXRlV2Vha01hcCgpIHtcbiAgICByZXR1cm4gbmV3IHN0ZF9XZWFrTWFwO1xufVxuXG5mdW5jdGlvbiBJdGVyYXRvclRvQXJyYXkoaXRlciwgbmV4dCkge1xuICAgIHZhciBhID0gW107XG4gICAgZm9yICh2YXIgeCA9IGNhbGxGdW5jdGlvbihuZXh0LCBpdGVyKTsgIXguZG9uZTsgeCA9IGNhbGxGdW5jdGlvbihuZXh0LCBpdGVyKSlcbiAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9BcnJheV9wdXNoLCBhLCB4LnZhbHVlKTtcbiAgICByZXR1cm4gYTtcbn1cblxuZnVuY3Rpb24gU2V0VG9BcnJheShzZXQpIHtcbiAgICByZXR1cm4gSXRlcmF0b3JUb0FycmF5KGNhbGxGdW5jdGlvbihzdGRfU2V0X2l0ZXJhdG9yLCBzZXQpLCBzdGRfU2V0X2l0ZXJhdG9yX25leHQpO1xufVxuXG5mdW5jdGlvbiBNYXBWYWx1ZXNUb0FycmF5KG1hcCkge1xuICAgIHJldHVybiBJdGVyYXRvclRvQXJyYXkoY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfdmFsdWVzLCBtYXApLCBzdGRfTWFwX2l0ZXJhdG9yX25leHQpO1xufVxuXG4vLyBUaGUgTG9hZGVyIHNwZWMgdXNlcyBhIGZldyBvcGVyYXRpb25zIHRoYXQgd2lsbCBsaWtlbHkgYmUgcHJvdmlkZWQgYnkgdGhlXG4vLyBQcm9taXNlIHNwZWMuXG5mdW5jdGlvbiBQcm9taXNlT2YodmFsdWUpIHtcbiAgICAvLyBJbXBsZW1lbnRhdGlvbiBub3RlOiBDYWxsaW5nIGBQcm9taXNlLnJlc29sdmUoKWAgaGVyZSBpcyB1c2VyLW9ic2VydmFibGVcbiAgICAvLyBzaW5jZSBgUHJvbWlzZVtTeW1ib2wuY3JlYXRlXWAgbWF5IGhhdmUgYmVlbiBtdXRhdGVkLiAgVGhpcyBpc1xuICAgIC8vIGNvbnNpZGVyZWQgYSBidWcuICBVc2VyIGNvZGUgc2hvdWxkIG5vdCBiZSBhYmxlIHRvIG9ic2VydmUgd2hldGhlciB0aGVcbiAgICAvLyBpbXBsZW1lbnRhdGlvbiB1c2VzIFByb21pc2VzIGludGVybmFsbHkgb3Igbm90LlxuICAgIC8vXG4gICAgLy8gRXZlcnkgdXNlIG9mIGBuZXcgUHJvbWlzZWAsIGBQcm9taXNlLmFsbGAsIGBQcm9taXNlLnByb3RvdHlwZS50aGVuYCwgYW5kXG4gICAgLy8gYFByb21pc2UucHJvdG90eXBlLmNhdGNoYCBpbiB0aGlzIHNwZWMgaGFzIHRoZSBzYW1lIHByb2JsZW0uXG4gICAgLy9cbiAgICAvLyBUaGUgcGxhbiBpcyBmb3IgdGhlIFByb21pc2Ugc3BlYyB0byBhZGRyZXNzIHRoaXMgYnkgZXhwb3NpbmcgcHJpbWl0aXZlc1xuICAgIC8vIHRoYXQgcGVyZm9ybSB0aGVzZSBvcGVyYXRpb25zIGJ1dCBhcmUgaW1tdW5lIHRvIHVzZXIgdGFtcGVyaW5nLiAgVGhpcyBpc1xuICAgIC8vIFtpc3N1ZSAjNzNdKGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvaXNzdWVzLzczKSBpblxuICAgIC8vIHRoZSBHaXRIdWIgcmVwb3NpdG9yeSB3aGVyZSB0aGUgUHJvbWlzZSBzcGVjIGlzIGJlaW5nIGRldmVsb3BlZC5cbiAgICAvL1xuICAgIHJldHVybiBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfcmVzb2x2ZSwgc3RkX1Byb21pc2UsIHZhbHVlKTtcbn1cblxuLy8gYEFzc2VydChjb25kaXRpb24pYCBpcyB5b3VyIGJvZy1zdGFuZGFyZCBhc3NlcnQgZnVuY3Rpb24uIEluIHRoZW9yeSwgaXQgZG9lc1xuLy8gbm90aGluZy4gVGhlIGdpdmVuIGBjb25kaXRpb25gIGlzIGFsd2F5cyB0cnVlLlxuZnVuY3Rpb24gQXNzZXJ0KGNvbmRpdGlvbikge1xuICAgIGlmICh0eXBlb2YgYXNzZXJ0ID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgIGFzc2VydChjb25kaXRpb24pO1xuICAgIGVsc2UgaWYgKHR5cGVvZiBhc3NlcnRFcSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICBhc3NlcnRFcShjb25kaXRpb24sIHRydWUpO1xuXG4gICAgaWYgKGNvbmRpdGlvbiAhPT0gdHJ1ZSlcbiAgICAgICAgdGhyb3cgXCJhc3NlcnRpb24gZmFpbGVkXCI7XG59XG5cblxuLy8gIyMgUHJpbWl0aXZlc1xuLy9cbi8vIFdlIHJlbHkgb24gdGhlIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gdG8gcHJvdmlkZSBhIGZldyBwcmltaXRpdmVzLiAgWW91XG4vLyBjYW4gc2tpcCBvdmVyIHRoaXMgc3R1ZmYgdG9vLiAgT24gdGhlIG90aGVyIGhhbmQsIGl0IHRlbGxzIHdoYXQgc29ydCBvZlxuLy8gdGhpbmcgd2UnbGwgYmUgZG9pbmcgaGVyZS5cblxuLy8gVGhlIGZpcnN0IHR3byBwcmltaXRpdmVzIHBhcnNlIEVDTUFTY3JpcHQgY29kZS5cbi8vXG4vLyAgICogYCRQYXJzZU1vZHVsZShsb2FkZXIsIHNvdXJjZSwgbW9kdWxlTmFtZSwgYWRkcmVzcylgIHBhcnNlcyB0aGUgc3RyaW5nXG4vLyAgICAgYHNvdXJjZWAgYXMgYW4gRVM2IE1vZHVsZS4gIFJldHVybnMgYSBNb2R1bGVCb2R5IG9iamVjdC5cbi8vXG4vLyAgICogYCRQYXJzZVNjcmlwdChzb3VyY2UpYCBwYXJzZXMgdGhlIHN0cmluZyBgc291cmNlYCBhcyBhbiBFUzYgU2NyaXB0LlxuLy8gICAgIFJldHVybnMgYSBTdGF0ZW1lbnRMaXN0IG9iamVjdC5cbi8vXG4vLyBCb3RoIHByaW1pdGl2ZXMgZGV0ZWN0IEVTIFwiZWFybHkgZXJyb3JzXCIgYW5kIHRocm93IGBTeW50YXhFcnJvcmAgb3Jcbi8vIGBSZWZlcmVuY2VFcnJvcmAuXG4vL1xuLy8gTm90ZSB0aGF0IG5laXRoZXIgcHJpbWl0aXZlIHJ1bnMgYW55IG9mIHRoZSBjb2RlIGluIGBzb3VyY2VgLlxuLy9cbi8vIE1vZHVsZUJvZHkgYW5kIFN0YXRlbWVudExpc3Qgb2JqZWN0cyBhcmUgbmV2ZXIgZXhwb3NlZCB0byB1c2VyIGNvZGUuIFRoZXlcbi8vIGFyZSBmb3IgdXNlIHdpdGggdGhlIHByaW1pdGl2ZXMgYmVsb3cgb25seS4gVGhlc2UgdHdvIHBhcnNpbmcgcHJpbWl0aXZlcyBhcmVcbi8vIHRoZSBvbmx5IHdheSBvYmplY3RzIG9mIHRoZXNlIHR5cGVzIGFyZSBjcmVhdGVkLlxuLy9cbi8vIFRoZSBmb2xsb3dpbmcgcHJpbWl0aXZlIGV4dHJhY3RzIGluZm9ybWF0aW9uIGZyb20gYSBNb2R1bGVCb2R5IG9iamVjdC5cbi8vXG4vLyAgICogYCRNb2R1bGVSZXF1ZXN0cyhib2R5KWAgcmV0dXJucyBhbiBBcnJheSBvZiBzdHJpbmdzLCB0aGUgbW9kdWxlXG4vLyAgICAgc3BlY2lmaWVycyBhcyB0aGV5IGFwcGVhciBpbiBpbXBvcnQgZGVjbGFyYXRpb25zIGFuZCBtb2R1bGUgZGVjbGFyYXRpb25zXG4vLyAgICAgaW4gdGhlIGdpdmVuIG1vZHVsZSBib2R5LCB3aXRoIGR1cGxpY2F0ZXMgcmVtb3ZlZC4gKFRoaXMgY29ycmVzcG9uZHMgdG9cbi8vICAgICB0aGUgTW9kdWxlUmVxdWVzdHMgc3RhdGljIHNlbWFudGljcyBvcGVyYXRpb24uKVxuLy9cbi8vIFRoZSBmb2xsb3dpbmcgcHJpbWl0aXZlcyBvcGVyYXRlIG9uIE1vZHVsZSBvYmplY3RzLlxuXG4vLyAgICogYCRDcmVhdGVNb2R1bGUoKWAgcmV0dXJucyBhIG5ldyBgTW9kdWxlYCBvYmplY3QuIFRoZSBvYmplY3QgaXNcbi8vICAgICBleHRlbnNpYmxlLiAgSXQgbXVzdCBub3QgYmUgZXhwb3NlZCB0byBzY3JpcHRzIHVudGlsIGl0IGhhcyBiZWVuXG4vLyAgICAgcG9wdWxhdGVkIGFuZCBmcm96ZW4uXG4vL1xudmFyIG1vZHVsZUludGVybmFsRGF0YU1hcCA9IENyZWF0ZVdlYWtNYXAoKTtcbmZ1bmN0aW9uIEdldE1vZHVsZUludGVybmFsRGF0YShtb2R1bGUpIHtcbiAgICByZXR1cm4gY2FsbEZ1bmN0aW9uKHN0ZF9XZWFrTWFwX2dldCwgbW9kdWxlSW50ZXJuYWxEYXRhTWFwLCBtb2R1bGUpO1xufVxuXG5mdW5jdGlvbiAkQ3JlYXRlTW9kdWxlKCkge1xuICAgIHZhciBtb2R1bGUgPSBzdGRfT2JqZWN0X2NyZWF0ZShudWxsKTtcbiAgICB2YXIgbW9kdWxlRGF0YSA9IHtcbiAgICAgICAgZGVwZW5kZW5jaWVzOiB1bmRlZmluZWQsXG4gICAgICAgIGV2YWx1YXRlZDogZmFsc2VcbiAgICB9O1xuICAgIGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9zZXQsIG1vZHVsZUludGVybmFsRGF0YU1hcCwgbW9kdWxlLCBtb2R1bGVEYXRhKTtcbiAgICByZXR1cm4gbW9kdWxlO1xufVxuXG4vLyAgICogYCRJc01vZHVsZSh2KWAgcmV0dXJucyB0cnVlIGlmIGB2YCBpcyBhIGBNb2R1bGVgIG9iamVjdC5cbi8vXG5mdW5jdGlvbiAkSXNNb2R1bGUobW9kdWxlKSB7XG4gICAgcmV0dXJuIEdldE1vZHVsZUludGVybmFsRGF0YShtb2R1bGUpICE9PSB1bmRlZmluZWQ7XG59XG5cbi8vICAgKiBgJEdldERlcGVuZGVuY2llcyhtb2R1bGUpYCByZXR1cm5zIG1vZHVsZS5bW0RlcGVuZGVuY2llc11dLiAgVGhpcyBpc1xuLy8gICAgIGVpdGhlciB1bmRlZmluZWQgb3IgYW4gYXJyYXkgb2YgTW9kdWxlIG9iamVjdHMsIHRoZSBtb2R1bGVzIHdob3NlIGJvZGllc1xuLy8gICAgIGFyZSB0byBiZSBldmFsdWF0ZWQgYmVmb3JlIHRoZSBnaXZlbiBtb2R1bGUncyBib2R5LiAgQSByZXR1cm4gdmFsdWUgb2Zcbi8vICAgICB1bmRlZmluZWQgbWVhbnMgdGhlIHNhbWUgdGhpbmcgYXMgcmV0dXJuaW5nIGFuIGVtcHR5IGFycmF5IHRvIHRoZSBzb2xlXG4vLyAgICAgY2FsbGVyLCBFbnN1cmVFdmFsdWF0ZWQoKS5cbi8vXG5mdW5jdGlvbiAkR2V0RGVwZW5kZW5jaWVzKG1vZHVsZSkge1xuICAgIHJldHVybiBHZXRNb2R1bGVJbnRlcm5hbERhdGEobW9kdWxlKS5kZXBlbmRlbmNpZXM7XG59XG5cbi8vICAgKiBgJFNldERlcGVuZGVuY2llcyhtb2R1bGUsIGRlcHMpYCBzZXRzIG1vZHVsZS5bW0RlcGVuZGVuY2llc11dLlxuLy9cbmZ1bmN0aW9uICRTZXREZXBlbmRlbmNpZXMobW9kdWxlLCBkZXBzKSB7XG4gICAgR2V0TW9kdWxlSW50ZXJuYWxEYXRhKG1vZHVsZSkuZGVwZW5kZW5jaWVzID0gZGVwcztcbn1cblxuLy8gICAqIGAkRXZhbHVhdGVNb2R1bGVCb2R5KHJlYWxtLCBtb2QpYCBydW5zIHRoZSBib2R5IG9mIHRoZSBnaXZlbiBtb2R1bGUgaW5cbi8vICAgICB0aGUgY29udGV4dCBvZiBhIGdpdmVuIHJlYWxtLiBSZXR1cm5zIHVuZGVmaW5lZC5cbi8vXG4vLyAgICogYCRIYXNCZWVuRXZhbHVhdGVkKG1vZClgIHJldHVybnMgdHJ1ZSBpZiBtb2QgaGFzIGV2ZXIgYmVlbiBwYXNzZWQgdG9cbi8vICAgICAkRXZhbHVhdGVNb2R1bGVCb2R5LlxuLy9cbmZ1bmN0aW9uICRIYXNCZWVuRXZhbHVhdGVkKG1vZHVsZSkge1xuICAgIHJldHVybiBHZXRNb2R1bGVJbnRlcm5hbERhdGEobW9kdWxlKS5ldmFsdWF0ZWQ7XG59XG5cbi8vIExvYWRlciBpdGVyYXRvcnMgcmVxdWlyZSBhIGxpdHRsZSBwcml2YXRlIHN0YXRlLlxuLy9cbi8vICAgKiBgJFNldExvYWRlckl0ZXJhdG9yUHJpdmF0ZShpdGVyLCB2YWx1ZSlgIHN0b3JlcyBgdmFsdWVgIGluIGFuIGludGVybmFsXG4vLyAgICAgc2xvdCBvZiBgaXRlcmAuXG4vL1xudmFyIGxvYWRlckl0ZXJhdG9ySW50ZXJuYWxEYXRhTWFwID0gQ3JlYXRlV2Vha01hcCgpO1xuZnVuY3Rpb24gJFNldExvYWRlckl0ZXJhdG9yUHJpdmF0ZShpdGVyLCB2YWx1ZSkge1xuICAgIGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9zZXQsIGxvYWRlckl0ZXJhdG9ySW50ZXJuYWxEYXRhTWFwLCBpdGVyLCB2YWx1ZSk7XG59XG5cbi8vICAgKiBgJEdldExvYWRlckl0ZXJhdG9yUHJpdmF0ZShpdGVyKWAgcmV0cmlldmVzIHRoZSB2YWx1ZSBwcmV2aW91c2x5IHN0b3JlZFxuLy8gICAgIHVzaW5nICRTZXRMb2FkZXJJdGVyYXRvclByaXZhdGUuIElmIG5vIHZhbHVlIHdhcyBwcmV2aW91c2x5IHN0b3JlZCxcbi8vICAgICB0aHJvdyBhIFR5cGVFcnJvci5cbi8vXG5mdW5jdGlvbiAkR2V0TG9hZGVySXRlcmF0b3JQcml2YXRlKGl0ZXIpIHtcbiAgICBpZiAoIUlzT2JqZWN0KGl0ZXIpKSB7XG4gICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXG4gICAgICAgICAgICBcIkxvYWRlciBJdGVyYXRvciBtZXRob2QgY2FsbGVkIG9uIGFuIGluY29tcGF0aWJsZSBcIiArIHR5cGVvZiBpdGVyKTtcbiAgICB9XG4gICAgaWYgKCFjYWxsRnVuY3Rpb24oc3RkX1dlYWtNYXBfaGFzLCBsb2FkZXJJdGVyYXRvckludGVybmFsRGF0YU1hcCwgaXRlcikpIHtcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcbiAgICAgICAgICAgIFwiTG9hZGVyIEl0ZXJhdG9yIG1ldGhvZCBjYWxsZWQgb24gYW4gaW5jb21wYXRpYmxlIG9iamVjdFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9nZXQsIGxvYWRlckl0ZXJhdG9ySW50ZXJuYWxEYXRhTWFwLCBpdGVyKTtcbn1cblxuLy8gVGhlIGZvbGxvd2luZyBwcmltaXRpdmVzIGRlYWwgd2l0aCByZWFsbXMuXG4vL1xuLy8gICAqIGAkQ3JlYXRlUmVhbG0ocmVhbG1PYmplY3QpYCBjcmVhdGVzIGEgbmV3IHJlYWxtIGZvciBldmFsdWF0aW5nIG1vZHVsZVxuLy8gICAgIGFuZCBzY3JpcHQgY29kZS4gVGhpcyBjYW4gYmUgcG9seWZpbGxlZCBpbiB0aGUgYnJvd3NlciB1c2luZyBhbiBpZnJhbWUsXG4vLyAgICAgW2FzIHNob3duIGluIHRoaXMgc2FtcGxlXG4vLyAgICAgY29kZV0oaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vd3ljYXRzLzhmNTI2M2EwYmNjOGU4MThiOGU1KS5cbi8vXG4vLyAgICogYCRJbmRpcmVjdEV2YWwocmVhbG0sIHNvdXJjZSlgIHBlcmZvcm1zIGFuIGluZGlyZWN0IGV2YWwgaW4gdGhlIGdpdmVuXG4vLyAgICAgcmVhbG0gZm9yIHRoZSBnaXZlbiBzY3JpcHQgc291cmNlLlxuLy9cblxuXG5cblxuLy8+ICMgTW9kdWxlczogU2VtYW50aWNzXG4vLz5cbi8vPiAjIyBNb2R1bGUgTG9hZGluZ1xuLy8+XG4vLz4gIyMjIExvYWQgUmVjb3Jkc1xuLy8+XG4vLz4gVGhlIExvYWQgUmVjb3JkIHR5cGUgcmVwcmVzZW50cyBhbiBhdHRlbXB0IHRvIGxvY2F0ZSwgZmV0Y2gsIHRyYW5zbGF0ZSwgYW5kXG4vLz4gcGFyc2UgYSBzaW5nbGUgbW9kdWxlLlxuLy8+XG4vLz4gRWFjaCBMb2FkIFJlY29yZCBoYXMgdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4vLz5cbi8vPiAgICogbG9hZC5bW1N0YXR1c11dICZuZGFzaDsgT25lIG9mOiBgXCJsb2FkaW5nXCJgLCBgXCJsb2FkZWRcImAsIGBcImxpbmtlZFwiYCwgb3Jcbi8vPiAgICAgYFwiZmFpbGVkXCJgLlxuLy8+XG4vLz4gICAqIGxvYWQuW1tOYW1lXV0gJm5kYXNoOyBUaGUgbm9ybWFsaXplZCBuYW1lIG9mIHRoZSBtb2R1bGUgYmVpbmcgbG9hZGVkLFxuLy8+ICAgICBvciAqKnVuZGVmaW5lZCoqIGlmIGxvYWRpbmcgYW4gYW5vbnltb3VzIG1vZHVsZS5cbi8vPlxuLy8+ICAgKiBsb2FkLltbTGlua1NldHNdXSAmbmRhc2g7IEEgTGlzdCBvZiBhbGwgTGlua1NldHMgdGhhdCByZXF1aXJlIHRoaXMgbG9hZFxuLy8+ICAgICB0byBzdWNjZWVkLiAgVGhlcmUgaXMgYSBtYW55LXRvLW1hbnkgcmVsYXRpb24gYmV0d2VlbiBMb2FkcyBhbmRcbi8vPiAgICAgTGlua1NldHMuICBBIHNpbmdsZSBgaW1wb3J0KClgIGNhbGwgY2FuIGhhdmUgYSBsYXJnZSBkZXBlbmRlbmN5IHRyZWUsXG4vLz4gICAgIGludm9sdmluZyBtYW55IExvYWRzLiAgTWFueSBgaW1wb3J0KClgIGNhbGxzIGNhbiBiZSB3YWl0aW5nIGZvciBhXG4vLz4gICAgIHNpbmdsZSBMb2FkLCBpZiB0aGV5IGRlcGVuZCBvbiB0aGUgc2FtZSBtb2R1bGUuXG4vLz5cbi8vPiAgICogbG9hZC5bW01ldGFkYXRhXV0gJm5kYXNoOyBBbiBvYmplY3Qgd2hpY2ggbG9hZGVyIGhvb2tzIG1heSB1c2UgZm9yIGFueVxuLy8+ICAgICBwdXJwb3NlLiAgU2VlIExvYWRlci5wcm90b3R5cGUubG9jYXRlLlxuLy8+XG4vLz4gICAqIGxvYWQuW1tBZGRyZXNzXV0gJm5kYXNoOyBUaGUgcmVzdWx0IG9mIHRoZSBsb2NhdGUgaG9vay5cbi8vPlxuLy8+ICAgKiBsb2FkLltbU291cmNlXV0gJm5kYXNoOyBUaGUgcmVzdWx0IG9mIHRoZSB0cmFuc2xhdGUgaG9vay5cbi8vPlxuLy8+ICAgKiBsb2FkLltbS2luZF1dICZuZGFzaDsgT25jZSB0aGUgTG9hZCByZWFjaGVzIHRoZSBgXCJsb2FkZWRcImAgc3RhdGUsXG4vLz4gICAgIGVpdGhlciAqKmRlY2xhcmF0aXZlKiogb3IgKipkeW5hbWljKiouICBJZiB0aGUgYGluc3RhbnRpYXRlYCBob29rXG4vLz4gICAgIHJldHVybmVkIHVuZGVmaW5lZCwgdGhlIG1vZHVsZSBpcyBkZWNsYXJhdGl2ZSwgYW5kIGxvYWQuW1tCb2R5XV1cbi8vPiAgICAgY29udGFpbnMgYSBNb2R1bGUgcGFyc2UuICBPdGhlcndpc2UsIHRoZSBgaW5zdGFudGlhdGVgIGhvb2sgcmV0dXJuZWQgYVxuLy8+ICAgICBNb2R1bGVGYWN0b3J5IG9iamVjdDsgbG9hZC5bW0V4ZWN1dGVdXSBjb250YWlucyB0aGUgYC5leGVjdXRlYCBjYWxsYWJsZVxuLy8+ICAgICBvYmplY3QuXG4vLz5cbi8vPiAgICogbG9hZC5bW0JvZHldXSAmbmRhc2g7IEEgTW9kdWxlIHBhcnNlLCBpZiBsb2FkLltbS2luZF1dIGlzXG4vLz4gICAgICoqZGVjbGFyYXRpdmUqKi4gT3RoZXJ3aXNlIHVuZGVmaW5lZC5cbi8vPlxuLy8+ICAgKiBsb2FkLltbRXhlY3V0ZV1dICZuZGFzaDsgVGhlIHZhbHVlIG9mIGBmYWN0b3J5LmV4ZWN1dGVgLCBpZlxuLy8+ICAgICBsb2FkLltbS2luZF1dIGlzICoqZHluYW1pYyoqLiBPdGhlcndpc2UgdW5kZWZpbmVkLlxuLy8+XG4vLz4gICAqIGxvYWQuW1tEZXBlbmRlbmNpZXNdXSAmbmRhc2g7IE9uY2UgdGhlIExvYWQgcmVhY2hlcyB0aGUgYFwibG9hZGVkXCJgXG4vLz4gICAgIHN0YXRlLCBhIExpc3Qgb2YgcGFpcnMuIEVhY2ggcGFpciBjb25zaXN0cyBvZiB0d28gc3RyaW5nczogYSBtb2R1bGVcbi8vPiAgICAgbmFtZSBhcyBpdCBhcHBlYXJzIGluIGEgYG1vZHVsZWAsIGBpbXBvcnRgLCBvciBgZXhwb3J0IGZyb21gXG4vLz4gICAgIGRlY2xhcmF0aW9uIGluIGxvYWQuW1tCb2R5XV0sIGFuZCB0aGUgY29ycmVzcG9uZGluZyBub3JtYWxpemVkIG1vZHVsZVxuLy8+ICAgICBuYW1lLlxuLy8+XG4vLz4gICAqIGxvYWQuW1tFeGNlcHRpb25dXSAmbmRhc2g7IElmIGxvYWQuW1tTdGF0dXNdXSBpcyBgXCJmYWlsZWRcImAsIHRoZVxuLy8+ICAgICBleGNlcHRpb24gdmFsdWUgdGhhdCB3YXMgdGhyb3duLCBjYXVzaW5nIHRoZSBsb2FkIHRvIGZhaWwuIE90aGVyd2lzZSxcbi8vPiAgICAgKipudWxsKiouXG4vLz5cbi8vPiAgICogbG9hZC5bW01vZHVsZV1dICZuZGFzaDsgVGhlIE1vZHVsZSBvYmplY3QgcHJvZHVjZWQgYnkgdGhpcyBsb2FkLCBvclxuLy8+ICAgICB1bmRlZmluZWQuXG4vLz5cbi8vPiAgICAgSWYgdGhlIGBpbnN0YW50aWF0ZWAgaG9vayByZXR1cm5zIHVuZGVmaW5lZCwgbG9hZC5bW01vZHVsZV1dIGlzXG4vLz4gICAgIHBvcHVsYXRlZCBhdCB0aGF0IHBvaW50LCBpZiBwYXJzaW5nIHN1Y2NlZWRzIGFuZCB0aGVyZSBhcmUgbm8gZWFybHlcbi8vPiAgICAgZXJyb3JzLlxuLy8+XG4vLz4gICAgIE90aGVyd2lzZSB0aGUgYGluc3RhbnRpYXRlYCBob29rIHJldHVybnMgYSBmYWN0b3J5IG9iamVjdCwgYW5kXG4vLz4gICAgIGxvYWQuW1tNb2R1bGVdXSBpcyBzZXQgZHVyaW5nIHRoZSBsaW5rIHBoYXNlLCB3aGVuIHRoZVxuLy8+ICAgICBgZmFjdG9yeS5leGVjdXRlKClgIG1ldGhvZCByZXR1cm5zIGEgTW9kdWxlLlxuLy8+XG5cbi8vIEEgTG9hZCBpcyBpbiBvbmUgb2YgZm91ciBzdGF0ZXM6XG4vL1xuLy8gMS4gIExvYWRpbmc6ICBTb3VyY2UgaXMgbm90IGF2YWlsYWJsZSB5ZXQuXG4vL1xuLy8gICAgICAgICAuc3RhdHVzID09PSBcImxvYWRpbmdcIlxuLy8gICAgICAgICAubGlua1NldHMgaXMgYSBTZXQgb2YgTGlua1NldHNcbi8vXG4vLyAgICAgVGhlIGxvYWQgbGVhdmVzIHRoaXMgc3RhdGUgd2hlbiAoYSkgdGhlIHNvdXJjZSBpcyBzdWNjZXNzZnVsbHkgcGFyc2VkO1xuLy8gICAgIChiKSBhbiBlcnJvciBjYXVzZXMgdGhlIGxvYWQgdG8gZmFpbDsgb3IgKGMpIHRoZSBgaW5zdGFudGlhdGVgIGxvYWRlclxuLy8gICAgIGhvb2sgcmV0dXJucyBhIE1vZHVsZSBvYmplY3QuXG4vL1xuLy8gMi4gIExvYWRlZDogIFNvdXJjZSBpcyBhdmFpbGFibGUgYW5kIGhhcyBiZWVuIHRyYW5zbGF0ZWQgYW5kIHBhcnNlZC5cbi8vICAgICBEZXBlbmRlbmNpZXMgaGF2ZSBiZWVuIGlkZW50aWZpZWQuICBCdXQgdGhlIG1vZHVsZSBoYXNuJ3QgYmVlbiBsaW5rZWQgb3Jcbi8vICAgICBldmFsdWF0ZWQgeWV0LiAgV2UgYXJlIHdhaXRpbmcgZm9yIGRlcGVuZGVuY2llcy5cbi8vXG4vLyAgICAgVGhpcyBpbXBsZW1lbnRhdGlvbiB0cmVhdHMgdGhlIGBNb2R1bGVgIG9iamVjdCBhcyBhbHJlYWR5IGV4aXN0aW5nIGF0XG4vLyAgICAgdGhpcyBwb2ludCAoZXhjZXB0IGZvciBmYWN0b3J5LW1hZGUgbW9kdWxlcykuICBCdXQgaXQgaGFzIG5vdCBiZWVuXG4vLyAgICAgbGlua2VkIGFuZCB0aHVzIG11c3Qgbm90IGJlIGV4cG9zZWQgdG8gc2NyaXB0IHlldC5cbi8vXG4vLyAgICAgVGhlIGBcImxvYWRlZFwiYCBzdGF0ZSBzYXlzIG5vdGhpbmcgYWJvdXQgdGhlIHN0YXR1cyBvZiB0aGUgZGVwZW5kZW5jaWVzO1xuLy8gICAgIHRoZXkgbWF5IGFsbCBiZSBsaW5rZWQgYW5kIGV2YWx1YXRlZCBhbmQgeWV0IHRoZXJlIG1heSBub3QgYmUgYW55XG4vLyAgICAgYExpbmtTZXRgIHRoYXQncyByZWFkeSB0byBsaW5rIGFuZCBldmFsdWF0ZSB0aGlzIG1vZHVsZS4gIFRoZSBgTGlua1NldGBcbi8vICAgICBtYXkgYmUgd2FpdGluZyBmb3IgdW5yZWxhdGVkIGRlcGVuZGVuY2llcyB0byBsb2FkLlxuLy9cbi8vICAgICAgICAgLnN0YXR1cyA9PT0gXCJsb2FkZWRcIlxuLy8gICAgICAgICAuYm9keSBpcyBhIE1vZHVsZUJvZHksIG9yIG51bGxcbi8vICAgICAgICAgLmRlcGVuZGVuY2llcyBpcyBhIE1hcCBvZiBzdHJpbmdzIChtb2R1bGUgcmVxdWVzdHMpXG4vLyAgICAgICAgICAgICB0byBzdHJpbmdzIChmdWxsIG1vZHVsZSBuYW1lcylcbi8vICAgICAgICAgLmZhY3RvcnkgaXMgYSBjYWxsYWJsZSBvYmplY3Qgb3IgbnVsbFxuLy9cbi8vICAgICBFeGFjdGx5IG9uZSBvZiBgWy5ib2R5LCAuZmFjdG9yeV1gIGlzIG5vbi1udWxsLlxuLy8gICAgIElmIC5ib2R5IGlzIG51bGwsIHRoZW4gLmRlcGVuZGVuY2llcyBpcyBudWxsLlxuLy9cbi8vICAgICBUaGUgbG9hZCBsZWF2ZXMgdGhpcyBzdGF0ZSB3aGVuIGEgTGlua1NldCBzdWNjZXNzZnVsbHkgbGlua3MgdGhlIG1vZHVsZVxuLy8gICAgIGFuZCBtb3ZlcyBpdCBpbnRvIHRoZSBsb2FkZXIncyBtb2R1bGUgcmVnaXN0cnkuXG4vL1xuLy8gMy4gIExpbmtlZDogIFRoZSBtb2R1bGUgaGFzIGJlZW4gbGlua2VkIGFuZCBhZGRlZCB0byB0aGUgbG9hZGVyJ3MgbW9kdWxlXG4vLyAgICAgcmVnaXN0cnkuICBJdHMgYm9keSBtYXkgb3IgbWF5IG5vdCBoYXZlIGJlZW4gZXZhbHVhdGVkIHlldCAoc2VlXG4vLyAgICAgYEVuc3VyZUV2YWx1YXRlZGApLlxuLy9cbi8vICAgICAgICAgLnN0YXR1cyA9PT0gXCJsaW5rZWRcIlxuLy8gICAgICAgICAubW9kdWxlIGlzIGEgTW9kdWxlIG9iamVjdFxuLy9cbi8vICAgICAoVE9ETzogdGhpcyBpcyBub3QgdHJ1ZSBpbiB0aGUgY2FzZSBvZiB0aGUgYGluc3RhbnRpYXRlYCBsb2FkZXIgaG9va1xuLy8gICAgIHJldHVybmluZyBhIE1vZHVsZSBvYmplY3Q7IG1heSB3YW50IGEgc2VwYXJhdGUgc3RhdHVzIGZvciB0aGF0KSBMb2Fkc1xuLy8gICAgIHRoYXQgZW50ZXIgdGhpcyBzdGF0ZSBhcmUgcmVtb3ZlZCBmcm9tIHRoZSBgbG9hZGVyLmxvYWRzYCB0YWJsZSBhbmQgZnJvbVxuLy8gICAgIGFsbCBMaW5rU2V0czsgdGhleSBiZWNvbWUgZ2FyYmFnZS5cbi8vXG4vLyA0LiAgRmFpbGVkOiAgVGhlIGxvYWQgZmFpbGVkLiAgVGhlIGxvYWQgbmV2ZXIgbGVhdmVzIHRoaXMgc3RhdGUuXG4vL1xuLy8gICAgICAgICAuc3RhdHVzID09PSBcImZhaWxlZFwiXG4vLyAgICAgICAgIC5leGNlcHRpb24gaXMgYW4gZXhjZXB0aW9uIHZhbHVlXG4vL1xuXG4vLz4gIyMjIyBDcmVhdGVMb2FkKG5hbWUpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIGFic3RyYWN0IG9wZXJhdGlvbiBDcmVhdGVMb2FkIGNyZWF0ZXMgYW5kIHJldHVybnMgYSBuZXcgTG9hZCBSZWNvcmQuXG4vLz4gVGhlIGFyZ3VtZW50IG5hbWUgaXMgZWl0aGVyIGB1bmRlZmluZWRgLCBpbmRpY2F0aW5nIGFuIGFub255bW91cyBtb2R1bGUsIG9yXG4vLz4gYSBub3JtYWxpemVkIG1vZHVsZSBuYW1lLlxuLy8+XG4vLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIENyZWF0ZUxvYWQobmFtZSkge1xuICAgIC8vPiAxLiAgTGV0IGxvYWQgYmUgYSBuZXcgTG9hZCBSZWNvcmQuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgLy8+IDIuICBTZXQgdGhlIFtbU3RhdHVzXV0gZmllbGQgb2YgbG9hZCB0byBgXCJsb2FkaW5nXCJgLlxuICAgICAgICBzdGF0dXM6IFwibG9hZGluZ1wiLFxuICAgICAgICAvLz4gMy4gIFNldCB0aGUgW1tOYW1lXV0gZmllbGQgb2YgbG9hZCB0byBuYW1lLlxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAvLz4gNC4gIFNldCB0aGUgW1tMaW5rU2V0c11dIGZpZWxkIG9mIGxvYWQgdG8gYSBuZXcgZW1wdHkgTGlzdC5cbiAgICAgICAgbGlua1NldHM6IENyZWF0ZVNldCgpLFxuICAgICAgICAvLz4gNS4gIExldCBtZXRhZGF0YSBiZSB0aGUgcmVzdWx0IG9mIE9iamVjdENyZWF0ZSglT2JqZWN0UHJvdG90eXBlJSkuXG4gICAgICAgIC8vPiA2LiAgU2V0IHRoZSBbW01ldGFkYXRhXV0gZmllbGQgb2YgbG9hZCB0byBtZXRhZGF0YS5cbiAgICAgICAgbWV0YWRhdGE6IHt9LFxuICAgICAgICAvLz4gNy4gIFNldCB0aGUgW1tBZGRyZXNzXV0gZmllbGQgb2YgbG9hZCB0byB1bmRlZmluZWQuXG4gICAgICAgIGFkZHJlc3M6IHVuZGVmaW5lZCxcbiAgICAgICAgLy8+IDguICBTZXQgdGhlIFtbU291cmNlXV0gZmllbGQgb2YgbG9hZCB0byB1bmRlZmluZWQuXG4gICAgICAgIHNvdXJjZTogdW5kZWZpbmVkLFxuICAgICAgICAvLz4gOS4gIFNldCB0aGUgW1tLaW5kXV0gZmllbGQgb2YgbG9hZCB0byB1bmRlZmluZWQuXG4gICAgICAgIGtpbmQ6IHVuZGVmaW5lZCxcbiAgICAgICAgLy8+IDEwLiBTZXQgdGhlIFtbQm9keV1dIGZpZWxkIG9mIGxvYWQgdG8gdW5kZWZpbmVkLlxuICAgICAgICBib2R5OiB1bmRlZmluZWQsXG4gICAgICAgIC8vPiAxMS4gU2V0IHRoZSBbW0V4ZWN1dGVdXSBmaWVsZCBvZiBsb2FkIHRvIHVuZGVmaW5lZC5cbiAgICAgICAgZXhlY3V0ZTogdW5kZWZpbmVkLFxuICAgICAgICAvLz4gMTIuIFNldCB0aGUgW1tFeGNlcHRpb25dXSBmaWVsZCBvZiBsb2FkIHRvIHVuZGVmaW5lZC5cbiAgICAgICAgZXhjZXB0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgIC8vPiAxMy4gU2V0IHRoZSBbW01vZHVsZV1dIGZpZWxkIG9mIGxvYWQgdG8gdW5kZWZpbmVkLlxuICAgICAgICBtb2R1bGU6IG51bGwsXG4gICAgICAgIHRoZW46IHVuZGVmaW5lZFxuICAgIH07XG4gICAgLy8+IDE0LiBSZXR1cm4gbG9hZC5cbn1cbi8vPlxuLy9cbi8vIEluIHRoaXMgaW1wbGVtZW50YXRpb24sIExvYWQgb2JqZWN0cyBoYXZlIGFuIGV4dHJhIHByb3BlcnR5IGB0aGVuOlxuLy8gdW5kZWZpbmVkYCB0byBwcmV2ZW50IHRoZW0gZnJvbSBhcHBlYXJpbmcgdGhlbmFibGUgZXZlbiBpZiB0aGUgdXNlciBhc3NpZ25zXG4vLyB0byBPYmplY3QucHJvdG90eXBlLnRoZW4uICBBbiBhbHRlcm5hdGl2ZSB3b3VsZCBiZSB0byB1c2Vcbi8vIE9iamVjdC5jcmVhdGUobnVsbCkgaGVyZS5cblxuXG4vLz4gIyMjIyBMb2FkRmFpbGVkIEZ1bmN0aW9uc1xuLy8+XG4vLz4gQSBMb2FkRmFpbGVkIGZ1bmN0aW9uIGlzIGFuIGFub255bW91cyBmdW5jdGlvbiB0aGF0IG1hcmtzIGEgTG9hZCBSZWNvcmQgYXNcbi8vPiBoYXZpbmcgZmFpbGVkLiAgQWxsIExpbmtTZXRzIHRoYXQgZGVwZW5kIG9uIHRoZSBMb2FkIGFsc28gZmFpbC5cbi8vPlxuLy8+IEVhY2ggTG9hZEZhaWxlZCBmdW5jdGlvbiBoYXMgYSBbW0xvYWRdXSBpbnRlcm5hbCBzbG90LlxuLy8+XG4vLz4gV2hlbiBhIExvYWRGYWlsZWQgZnVuY3Rpb24gRiBpcyBjYWxsZWQgd2l0aCBhcmd1bWVudCBleGMsIHRoZSBmb2xsb3dpbmdcbi8vPiBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0xvYWRGYWlsZWQobG9hZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXhjKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWQgYmUgRi5bW0xvYWRdXS5cbiAgICAgICAgLy8+IDIuICBBc3NlcnQ6IGxvYWQuW1tTdGF0dXNdXSBpcyBgXCJsb2FkaW5nXCJgLlxuICAgICAgICBBc3NlcnQobG9hZC5zdGF0dXMgPT09IFwibG9hZGluZ1wiKTtcblxuICAgICAgICAvLz4gMy4gIFNldCBsb2FkLltbU3RhdHVzXV0gdG8gYFwiZmFpbGVkXCIuXG4gICAgICAgIGxvYWQuc3RhdHVzID0gXCJmYWlsZWRcIjtcblxuICAgICAgICAvLz4gNC4gIFNldCBsb2FkLltbRXhjZXB0aW9uXV0gdG8gZXhjLlxuICAgICAgICBsb2FkLmV4Y2VwdGlvbiA9IGV4YztcblxuICAgICAgICAvLz4gNS4gIExldCBsaW5rU2V0cyBiZSBhIGNvcHkgb2YgdGhlIExpc3QgbG9hZC5bW0xpbmtTZXRzXV0uXG4gICAgICAgIC8vPiA2LiAgRm9yIGVhY2ggbGlua1NldCBpbiBsaW5rU2V0cywgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZSBMaW5rU2V0XG4gICAgICAgIC8vPiAgICAgUmVjb3JkcyB3ZXJlIGNyZWF0ZWQsXG4gICAgICAgIGxldCBsaW5rU2V0cyA9IFNldFRvQXJyYXkobG9hZC5saW5rU2V0cyk7XG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfQXJyYXlfc29ydCwgbGlua1NldHMsXG4gICAgICAgICAgICAgICAgICAgICAoYSwgYikgPT4gYi50aW1lc3RhbXAgLSBhLnRpbWVzdGFtcCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlua1NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIENhbGwgTGlua1NldEZhaWxlZChsaW5rU2V0LCBleGMpLlxuICAgICAgICAgICAgTGlua1NldEZhaWxlZChsaW5rU2V0c1tpXSwgZXhjKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vPiA3LiAgQXNzZXJ0OiBsb2FkLltbTGlua1NldHNdXSBpcyBlbXB0eS5cbiAgICAgICAgQXNzZXJ0KGNhbGxGdW5jdGlvbihzdGRfU2V0X2dldF9zaXplLCBsb2FkLmxpbmtTZXRzKSA9PT0gMCk7XG4gICAgfTtcbn1cbi8vXG4vLyBUaGUgYXR0YWNoZWQgTGlua1NldHMgZmFpbCBpbiB0aW1lc3RhbXAgb3JkZXIuICAqUmF0aW9uYWxlKjogIEFueVxuLy8gZGV0ZXJtaW5pc3RpYyBvcmRlciB3b3VsZCBkby5cblxuXG4vLyAjIyBUaGUgbG9hZGVyIHBpcGVsaW5lXG5cbi8vPiAjIyMjIFJlcXVlc3RMb2FkKGxvYWRlciwgcmVxdWVzdCwgcmVmZXJyZXJOYW1lLCByZWZlcnJlckFkZHJlc3MpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIFJlcXVlc3RMb2FkIGFic3RyYWN0IG9wZXJhdGlvbiBub3JtYWxpemVzIHRoZSBnaXZlbiBtb2R1bGUgbmFtZSxcbi8vPiByZXF1ZXN0LCBhbmQgcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0aGUgdmFsdWUgb2YgYSBMb2FkIG9iamVjdFxuLy8+IGZvciB0aGUgZ2l2ZW4gbW9kdWxlLlxuLy8+XG4vLz4gVGhlIGxvYWRlciBhcmd1bWVudCBpcyBhIExvYWRlciBvYmplY3QuXG4vLz5cbi8vPiByZXF1ZXN0IGlzIHRoZSAobm9uLW5vcm1hbGl6ZWQpIG5hbWUgb2YgdGhlIG1vZHVsZSB0byBiZSBpbXBvcnRlZCwgYXMgaXRcbi8vPiBhcHBlYXJzIGluIHRoZSBpbXBvcnQtZGVjbGFyYXRpb24gb3IgYXMgdGhlIGFyZ3VtZW50IHRvIGBsb2FkZXIubG9hZCgpYCBvclxuLy8+IGBsb2FkZXIuaW1wb3J0KClgLlxuLy8+XG4vLz4gcmVmZXJyZXJOYW1lIGFuZCByZWZlcnJlckFkZHJlc3MgcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY29udGV4dCBvZlxuLy8+IHRoZSBgaW1wb3J0KClgIGNhbGwgb3IgaW1wb3J0LWRlY2xhcmF0aW9uLiAgVGhpcyBpbmZvcm1hdGlvbiBpcyBwYXNzZWQgdG9cbi8vPiBhbGwgdGhlIGxvYWRlciBob29rcy5cbi8vPlxuLy8+IElmIHRoZSByZXF1ZXN0ZWQgbW9kdWxlIGlzIGFscmVhZHkgaW4gdGhlIGxvYWRlcidzIG1vZHVsZSByZWdpc3RyeSxcbi8vPiBSZXF1ZXN0TG9hZCByZXR1cm5zIGEgcHJvbWlzZSBmb3IgYSBMb2FkIHdpdGggdGhlIFtbU3RhdHVzXV0gZmllbGQgc2V0IHRvXG4vLz4gYFwibGlua2VkXCJgLiBJZiB0aGUgcmVxdWVzdGVkIG1vZHVsZSBpcyBsb2FkaW5nIG9yIGxvYWRlZCBidXQgbm90IHlldFxuLy8+IGxpbmtlZCwgUmVxdWVzdExvYWQgcmV0dXJucyBhIHByb21pc2UgZm9yIGFuIGV4aXN0aW5nIExvYWQgb2JqZWN0IGZyb21cbi8vPiBsb2FkZXIuW1tMb2Fkc11dLiBPdGhlcndpc2UsIFJlcXVlc3RMb2FkIHN0YXJ0cyBsb2FkaW5nIHRoZSBtb2R1bGUgYW5kXG4vLz4gcmV0dXJucyBhIHByb21pc2UgZm9yIGEgbmV3IExvYWQgUmVjb3JkLlxuLy8+XG4vLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIFJlcXVlc3RMb2FkKGxvYWRlciwgcmVxdWVzdCwgcmVmZXJyZXJOYW1lLCByZWZlcnJlckFkZHJlc3MpIHtcbiAgICAvLz4gMS4gIExldCBGIGJlIGEgbmV3IGFub255bW91cyBmdW5jdGlvbiBhcyBkZWZpbmVkIGJ5IENhbGxOb3JtYWxpemUuXG4gICAgLy8+IDIuICBTZXQgdGhlIFtbTG9hZGVyXV0gaW50ZXJuYWwgc2xvdCBvZiBGIHRvIGxvYWRlci5cbiAgICAvLz4gMy4gIFNldCB0aGUgW1tSZXF1ZXN0XV0gaW50ZXJuYWwgc2xvdCBvZiBGIHRvIHJlcXVlc3QuXG4gICAgLy8+IDQuICBTZXQgdGhlIFtbUmVmZXJyZXJOYW1lXV0gaW50ZXJuYWwgc2xvdCBvZiBGIHRvIHJlZmVycmVyTmFtZS5cbiAgICAvLz4gNS4gIFNldCB0aGUgW1tSZWZlcnJlckFkZHJlc3NdXSBpbnRlcm5hbCBzbG90IG9mIEYgdG8gcmVmZXJyZXJBZGRyZXNzLlxuICAgIHZhciBGID0gTWFrZUNsb3N1cmVfQ2FsbE5vcm1hbGl6ZShsb2FkZXIsIHJlcXVlc3QsIHJlZmVycmVyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVmZXJyZXJBZGRyZXNzKTtcblxuICAgIC8vPiA2LiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIE9yZGluYXJ5Q29uc3RydWN0KCVQcm9taXNlJSwgKEYpKS5cbiAgICB2YXIgcCA9IG5ldyBzdGRfUHJvbWlzZShGKTtcblxuICAgIC8vPiA3LiAgTGV0IEcgYmUgYSBuZXcgYW5vbnltb3VzIGZ1bmN0aW9uIGFzIGRlZmluZWQgYnkgR2V0T3JDcmVhdGVMb2FkLlxuICAgIC8vPiA4LiAgU2V0IHRoZSBbW0xvYWRlcl1dIGludGVybmFsIHNsb3Qgb2YgRyB0byBsb2FkZXIuXG4gICAgLy8+IDkuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgUHJvbWlzZVRoZW4ocCwgRykuXG4gICAgcCA9IGNhbGxGdW5jdGlvbihzdGRfUHJvbWlzZV90aGVuLCBwLCBcbiAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0dldE9yQ3JlYXRlTG9hZChsb2FkZXIpKTtcblxuICAgIC8vPiAxMC4gUmV0dXJuIHAuXG4gICAgcmV0dXJuIHA7XG59XG4vLz5cblxuLy8+ICMjIyMgQ2FsbE5vcm1hbGl6ZSBGdW5jdGlvbnNcbi8vPlxuLy8+IEEgQ2FsbE5vcm1hbGl6ZSBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gdGhhdCBjYWxscyBhIGxvYWRlcidzXG4vLz4gbm9ybWFsaXplIGhvb2suXG4vLz5cbi8vPiBFYWNoIENhbGxOb3JtYWxpemUgZnVuY3Rpb24gaGFzIGludGVybmFsIHNsb3RzIFtbTG9hZGVyXV0sIFtbUmVxdWVzdF1dLFxuLy8+IFtbUmVmZXJyZXJOYW1lXV0sIGFuZCBbW1JlZmVycmVyQWRkcmVzc11dLlxuLy8+XG4vLz4gV2hlbiBhIENhbGxOb3JtYWxpemUgZnVuY3Rpb24gRiBpcyBjYWxsZWQgd2l0aCBhcmd1bWVudHMgcmVzb2x2ZSBhbmRcbi8vPiByZWplY3QsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuLlxuLy8+XG5mdW5jdGlvbiBNYWtlQ2xvc3VyZV9DYWxsTm9ybWFsaXplKGxvYWRlciwgcmVxdWVzdCwgcmVmZXJyZXJOYW1lLCByZWZlcnJlckFkZHJlc3MpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgRi5bW0xvYWRlcl1dLlxuICAgICAgICAvLz4gMi4gIExldCByZXF1ZXN0IGJlIEYuW1tSZXF1ZXN0XV0uXG4gICAgICAgIC8vPiAzLiAgTGV0IHJlZmVycmVyTmFtZSBiZSBGLltbUmVmZXJyZXJOYW1lXV0uXG4gICAgICAgIC8vPiA0LiAgTGV0IHJlZmVycmVyQWRkcmVzcyBiZSBGLltbUmVmZXJyZXJBZGRyZXNzXV0uXG4gICAgICAgIC8vPiA1LiAgTGV0IG5vcm1hbGl6ZUhvb2sgYmUgdGhlIHJlc3VsdCBvZiBHZXQobG9hZGVyLCBgXCJub3JtYWxpemVcImApLlxuICAgICAgICAvLz4gNi4gIExldCBuYW1lIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgW1tDYWxsXV0gaW50ZXJuYWwgbWV0aG9kXG4gICAgICAgIC8vPiAgICAgb2Ygbm9ybWFsaXplSG9vayBwYXNzaW5nIGxvYWRlciBhbmQgKHJlcXVlc3QsIHJlZmVycmVyTmFtZSxcbiAgICAgICAgLy8+ICAgICByZWZlcnJlckFkZHJlc3MpIGFzIGFyZ3VtZW50cy5cbiAgICAgICAgLy8+IDcuICBSZXR1cm5JZkFicnVwdChuYW1lKS5cbiAgICAgICAgLy8+IDguICBDYWxsIHRoZSBbW0NhbGxdXSBpbnRlcm5hbCBtZXRob2Qgb2YgcmVzb2x2ZSBwYXNzaW5nIHVuZGVmaW5lZFxuICAgICAgICAvLz4gICAgIGFuZCAobmFtZSkgYXMgYXJndW1lbnRzLlxuICAgICAgICByZXNvbHZlKGxvYWRlci5ub3JtYWxpemUocmVxdWVzdCwgcmVmZXJyZXJOYW1lLCByZWZlcnJlckFkZHJlc3MpKTtcbiAgICB9O1xufVxuXG4vLz4gIyMjIyBHZXRPckNyZWF0ZUxvYWQgRnVuY3Rpb25zXG4vLz5cbi8vPiBBIEdldE9yQ3JlYXRlTG9hZCBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gdGhhdCBnZXRzIG9yIGNyZWF0ZXMgYSBMb2FkXG4vLz4gUmVjb3JkIGZvciBhIGdpdmVuIG1vZHVsZSBuYW1lLlxuLy8+XG4vLz4gRWFjaCBHZXRPckNyZWF0ZUxvYWQgZnVuY3Rpb24gaGFzIGEgW1tMb2FkZXJdXSBpbnRlcm5hbCBzbG90LlxuLy8+XG4vLz4gV2hlbiBhIEdldE9yQ3JlYXRlTG9hZCBmdW5jdGlvbiBGIGlzIGNhbGxlZCB3aXRoIGFyZ3VtZW50IG5hbWUsIHRoZSBmb2xsb3dpbmdcbi8vPiBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0dldE9yQ3JlYXRlTG9hZChsb2FkZXIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobG9hZGVyKTtcblxuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgRi5bW0xvYWRlcl1dLlxuICAgICAgICAvLz4gMi4gIExldCBuYW1lIGJlIFRvU3RyaW5nKG5hbWUpLlxuICAgICAgICAvLz4gMy4gIFJldHVybklmQWJydXB0KG5hbWUpLlxuICAgICAgICBuYW1lID0gVG9TdHJpbmcobmFtZSk7XG5cbiAgICAgICAgLy8+IDQuICBJZiB0aGVyZSBpcyBhIFJlY29yZCBpbiBsb2FkZXIuW1tNb2R1bGVzXV0gd2hvc2UgW1trZXldXSBmaWVsZFxuICAgICAgICAvLz4gICAgIGlzIGVxdWFsIHRvIG5hbWUsIHRoZW5cbiAgICAgICAgdmFyIGV4aXN0aW5nTW9kdWxlID0gY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfZ2V0LCBsb2FkZXJEYXRhLm1vZHVsZXMsIG5hbWUpO1xuICAgICAgICBpZiAoZXhpc3RpbmdNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8+ICAgICAxLiAgTGV0IGV4aXN0aW5nTW9kdWxlIGJlIHRoZSBbW3ZhbHVlXV0gZmllbGQgb2YgdGhhdCBSZWNvcmQuXG4gICAgICAgICAgICAvLz4gICAgIDIuICBMZXQgbG9hZCBiZSB0aGUgcmVzdWx0IG9mIENyZWF0ZUxvYWQobmFtZSkuXG4gICAgICAgICAgICAvLz4gICAgIDMuICBTZXQgdGhlIFtbU3RhdHVzXV0gZmllbGQgb2YgbG9hZCB0byBgXCJsaW5rZWRcImAuXG4gICAgICAgICAgICAvLz4gICAgIDQuICBTZXQgdGhlIFtbTW9kdWxlXV0gZmllbGQgb2YgbG9hZCB0byBleGlzdGluZ01vZHVsZS5cbiAgICAgICAgICAgIC8vPiAgICAgNS4gIFJldHVybiBsb2FkLlxuICAgICAgICAgICAgdmFyIGxvYWQgPSBDcmVhdGVMb2FkKG5hbWUpO1xuICAgICAgICAgICAgbG9hZC5zdGF0dXMgPSBcImxpbmtlZFwiO1xuICAgICAgICAgICAgbG9hZC5tb2R1bGUgPSBleGlzdGluZ01vZHVsZTtcbiAgICAgICAgICAgIHJldHVybiBsb2FkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8+IDUuICBFbHNlLCBpZiB0aGVyZSBpcyBhIExvYWQgUmVjb3JkIGluIHRoZSBMaXN0IGxvYWRlci5bW0xvYWRzXV1cbiAgICAgICAgLy8+ICAgICB3aG9zZSBbW05hbWVdXSBmaWVsZCBpcyBlcXVhbCB0byBuYW1lLCB0aGVuXG4gICAgICAgIHZhciBsb2FkID0gY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfZ2V0LCBsb2FkZXJEYXRhLmxvYWRzLCBuYW1lKTtcbiAgICAgICAgaWYgKGxvYWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8+ICAgICAxLiBMZXQgbG9hZCBiZSB0aGF0IExvYWQgUmVjb3JkLlxuICAgICAgICAgICAgLy8+ICAgICAyLiBBc3NlcnQ6IGxvYWQuc3RhdHVzIGlzIGVpdGhlciBgXCJsb2FkaW5nXCJgIG9yIGBcImxvYWRlZFwiYC5cbiAgICAgICAgICAgIEFzc2VydChsb2FkLnN0YXR1cyA9PT0gXCJsb2FkaW5nXCIgfHwgbG9hZC5zdGF0dXMgPT09IFwibG9hZGVkXCIpO1xuXG4gICAgICAgICAgICAvLz4gICAgIDMuIFJldHVybiBsb2FkLlxuICAgICAgICAgICAgcmV0dXJuIGxvYWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLz4gNi4gIExldCBsb2FkIGJlIHRoZSByZXN1bHQgb2YgQ3JlYXRlTG9hZChuYW1lKS5cbiAgICAgICAgbG9hZCA9IENyZWF0ZUxvYWQobmFtZSk7XG5cbiAgICAgICAgLy8+IDcuICBBZGQgbG9hZCB0byB0aGUgTGlzdCBsb2FkZXIuW1tMb2Fkc11dLlxuICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX01hcF9zZXQsIGxvYWRlckRhdGEubG9hZHMsIG5hbWUsIGxvYWQpO1xuXG4gICAgICAgIC8vPiA4LiAgQ2FsbCBQcm9jZWVkVG9Mb2NhdGUobG9hZGVyLCBsb2FkKS5cbiAgICAgICAgUHJvY2VlZFRvTG9jYXRlKGxvYWRlciwgbG9hZCk7XG5cbiAgICAgICAgLy8+IDkuICBSZXR1cm4gbG9hZC5cbiAgICAgICAgcmV0dXJuIGxvYWQ7XG4gICAgfTtcbn1cblxuLy8+ICMjIyMgUHJvY2VlZFRvTG9jYXRlKGxvYWRlciwgbG9hZCwgcCkgQWJzdHJhY3QgT3BlcmF0aW9uXG4vLz5cbi8vPiBUaGUgUHJvY2VlZFRvTG9jYXRlIGFic3RyYWN0IG9wZXJhdGlvbiBjb250aW51ZXMgdGhlIGFzeW5jaHJvbm91cyBsb2FkaW5nXG4vLz4gcHJvY2VzcyBhdCB0aGUgYGxvY2F0ZWAgaG9vay5cbi8vPlxuLy8+IFByb2NlZWRUb0xvY2F0ZSBwZXJmb3JtcyB0aGUgZm9sbG93aW5nIHN0ZXBzOlxuLy8+XG5mdW5jdGlvbiBQcm9jZWVkVG9Mb2NhdGUobG9hZGVyLCBsb2FkKSB7XG4gICAgLy8+IDEuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIFByb21pc2VSZXNvbHZlKHVuZGVmaW5lZCkuXG4gICAgdmFyIHAgPSBQcm9taXNlT2YodW5kZWZpbmVkKTtcbiAgICAvLz4gMS4gIExldCBGIGJlIGEgbmV3IGFub255bW91cyBmdW5jdGlvbiBvYmplY3QgYXMgZGVmaW5lZCBpblxuICAgIC8vPiAgICAgQ2FsbExvY2F0ZS5cbiAgICAvLz4gMS4gIFNldCBGLltbTG9hZGVyXV0gdG8gbG9hZGVyLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkXV0gdG8gbG9hZC5cbiAgICAvLz4gMS4gIExldCBwIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyBQcm9taXNlVGhlbihwLCBGKS5cbiAgICBwID0gY2FsbEZ1bmN0aW9uKHN0ZF9Qcm9taXNlX3RoZW4sIHAsXG4gICAgICAgICAgICAgICAgICAgICBNYWtlQ2xvc3VyZV9DYWxsTG9jYXRlKGxvYWRlciwgbG9hZCkpO1xuICAgIC8vPiAxLiAgUmV0dXJuIFByb2NlZWRUb0ZldGNoKGxvYWRlciwgbG9hZCwgcCkuXG4gICAgcmV0dXJuIFByb2NlZWRUb0ZldGNoKGxvYWRlciwgbG9hZCwgcCk7XG59XG5cbi8vPiAjIyMjIFByb2NlZWRUb0ZldGNoKGxvYWRlciwgbG9hZCwgcCkgQWJzdHJhY3QgT3BlcmF0aW9uXG4vLz5cbi8vPiBUaGUgUHJvY2VlZFRvRmV0Y2ggYWJzdHJhY3Qgb3BlcmF0aW9uIGNvbnRpbnVlcyB0aGUgYXN5bmNocm9ub3VzIGxvYWRpbmdcbi8vPiBwcm9jZXNzIGF0IHRoZSBgZmV0Y2hgIGhvb2suXG4vLz5cbi8vPiBQcm9jZWVkVG9GZXRjaCBwZXJmb3JtcyB0aGUgZm9sbG93aW5nIHN0ZXBzOlxuLy8+XG5mdW5jdGlvbiBQcm9jZWVkVG9GZXRjaChsb2FkZXIsIGxvYWQsIHApIHtcbiAgICAvLz4gMS4gIExldCBGIGJlIGEgbmV3IGFub255bW91cyBmdW5jdGlvbiBvYmplY3QgYXMgZGVmaW5lZCBpblxuICAgIC8vPiAgICAgQ2FsbEZldGNoLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkZXJdXSB0byBsb2FkZXIuXG4gICAgLy8+IDEuICBTZXQgRi5bW0xvYWRdXSB0byBsb2FkLlxuICAgIC8vPiAxLiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIFByb21pc2VUaGVuKHAsIEYpLlxuICAgIHAgPSBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfdGhlbiwgcCxcbiAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0NhbGxGZXRjaChsb2FkZXIsIGxvYWQpKTtcbiAgICAvLz4gMS4gIFJldHVybiBQcm9jZWVkVG9UcmFuc2xhdGUobG9hZGVyLCBsb2FkLCBwKS5cbiAgICByZXR1cm4gUHJvY2VlZFRvVHJhbnNsYXRlKGxvYWRlciwgbG9hZCwgcCk7XG59XG5cbi8vPiAjIyMjIFByb2NlZWRUb1RyYW5zbGF0ZShsb2FkZXIsIGxvYWQsIHApIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIFByb2NlZWRUb1RyYW5zbGF0ZSBhYnN0cmFjdCBvcGVyYXRpb24gY29udGludWVzIHRoZSBhc3luY2hyb25vdXMgbG9hZGluZ1xuLy8+IHByb2Nlc3MgYXQgdGhlIGB0cmFuc2xhdGVgIGhvb2suXG4vLz5cbi8vPiBQcm9jZWVkVG9UcmFuc2xhdGUgcGVyZm9ybXMgdGhlIGZvbGxvd2luZyBzdGVwczpcbi8vPlxuZnVuY3Rpb24gUHJvY2VlZFRvVHJhbnNsYXRlKGxvYWRlciwgbG9hZCwgcCkge1xuICAgIC8vPiAxLiAgTGV0IEYgYmUgYSBuZXcgYW5vbnltb3VzIGZ1bmN0aW9uIG9iamVjdCBhcyBkZWZpbmVkIGluXG4gICAgLy8+ICAgICBDYWxsVHJhbnNsYXRlLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkZXJdXSB0byBsb2FkZXIuXG4gICAgLy8+IDEuICBTZXQgRi5bW0xvYWRdXSB0byBsb2FkLlxuICAgIC8vPiAxLiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIFByb21pc2VUaGVuKHAsIEYpLlxuICAgIHAgPSBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfdGhlbiwgcCxcbiAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0NhbGxUcmFuc2xhdGUobG9hZGVyLCBsb2FkKSk7XG4gICAgLy8+IDEuICBMZXQgRiBiZSBhIG5ldyBhbm9ueW1vdXMgZnVuY3Rpb24gb2JqZWN0IGFzIGRlZmluZWQgaW5cbiAgICAvLz4gICAgIENhbGxJbnN0YW50aWF0ZS5cbiAgICAvLz4gMS4gIFNldCBGLltbTG9hZGVyXV0gdG8gbG9hZGVyLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkXV0gdG8gbG9hZC5cbiAgICAvLz4gMS4gIExldCBwIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyBQcm9taXNlVGhlbihwLCBGKS5cbiAgICBwID0gY2FsbEZ1bmN0aW9uKHN0ZF9Qcm9taXNlX3RoZW4sIHAsXG4gICAgICAgICAgICAgICAgICAgICBNYWtlQ2xvc3VyZV9DYWxsSW5zdGFudGlhdGUobG9hZGVyLCBsb2FkKSk7XG4gICAgLy8+IDEuICBMZXQgRiBiZSBhIG5ldyBhbm9ueW1vdXMgZnVuY3Rpb24gb2JqZWN0IGFzIGRlZmluZWQgaW5cbiAgICAvLz4gICAgIEluc3RhbnRpYXRlU3VjY2VlZGVkLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkZXJdXSB0byBsb2FkZXIuXG4gICAgLy8+IDEuICBTZXQgRi5bW0xvYWRdXSB0byBsb2FkLlxuICAgIC8vPiAxLiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIFByb21pc2VUaGVuKHAsIEYpLlxuICAgIHAgPSBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfdGhlbiwgcCxcbiAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0luc3RhbnRpYXRlU3VjY2VlZGVkKGxvYWRlciwgbG9hZCkpO1xuICAgIC8vPiAxLiAgTGV0IEYgYmUgYSBuZXcgYW5vbnltb3VzIGZ1bmN0aW9uIG9iamVjdCBhcyBkZWZpbmVkIGluXG4gICAgLy8+ICAgICBMb2FkRmFpbGVkLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkXV0gdG8gbG9hZC5cbiAgICAvLz4gMS4gIExldCBwIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyBQcm9taXNlQ2F0Y2gocCwgRikuXG4gICAgY2FsbEZ1bmN0aW9uKHN0ZF9Qcm9taXNlX2NhdGNoLCBwLFxuICAgICAgICAgICAgICAgICBNYWtlQ2xvc3VyZV9Mb2FkRmFpbGVkKGxvYWQpKTtcbn1cblxuLy8+ICMjIyMgU2ltcGxlRGVmaW5lKG9iaiwgbmFtZSwgdmFsdWUpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIFNpbXBsZURlZmluZSBvcGVyYXRpb24gZGVmaW5lcyBhIHdyaXRhYmxlLCBjb25maWd1cmFibGUsIGVudW1lcmFibGVcbi8vPiBkYXRhIHByb3BlcnR5IG9uIGFuIG9yZGluYXJ5IG9iamVjdCBieSB0YWtpbmcgdGhlIGZvbGxvd2luZyBzdGVwczpcbi8vPlxuLy8+IDEuICBSZXR1cm4gdGhlIHJlc3VsdCBvZiBjYWxsaW5nIE9yZGluYXJ5RGVmaW5lT3duUHJvcGVydHkgd2l0aCBhcmd1bWVudHNcbi8vPiAgICAgb2JqLCBuYW1lLCBhbmQgUHJvcGVydHlEZXNjcmlwdG9ye1tbVmFsdWVdXTogdmFsdWUsIFtbV3JpdGFibGVdXTogdHJ1ZSxcbi8vPiAgICAgW1tFbnVtZXJhYmxlXV06IHRydWUsIFtbQ29uZmlndXJhYmxlXV06IHRydWV9LlxuLy8+XG5cbi8vPiAjIyMjIENhbGxMb2NhdGUgRnVuY3Rpb25zXG4vLz5cbi8vPiBBIENhbGxMb2NhdGUgZnVuY3Rpb24gaXMgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIHRoYXQgY2FsbHMgdGhlIGBsb2NhdGVgXG4vLz4gbG9hZGVyIGhvb2suXG4vLz5cbi8vPiBFYWNoIENhbGxMb2NhdGUgZnVuY3Rpb24gaGFzIFtbTG9hZGVyXV0gYW5kIFtbTG9hZF1dIGludGVybmFsIHNsb3RzLlxuLy8+XG4vLz4gV2hlbiBhIENhbGxMb2NhdGUgZnVuY3Rpb24gRiBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBNYWtlQ2xvc3VyZV9DYWxsTG9jYXRlKGxvYWRlciwgbG9hZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoXykge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgRi5bW0xvYWRlcl1dLlxuICAgICAgICAvLz4gMi4gIExldCBsb2FkIGJlIEYuW1tMb2FkXV0uXG4gICAgICAgIC8vPiAzLiAgTGV0IGhvb2sgYmUgdGhlIHJlc3VsdCBvZiBHZXQobG9hZGVyLCBgXCJsb2NhdGVcImApLlxuICAgICAgICAvLz4gNC4gIFJldHVybklmQWJydXB0KGhvb2spLlxuICAgICAgICAvLz4gNS4gIElmIElzQ2FsbGFibGUoaG9vaykgaXMgZmFsc2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAgICAgLy8+IDYuICBMZXQgb2JqIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZ1xuICAgICAgICAvLz4gICAgIE9iamVjdENyZWF0ZSglT2JqZWN0UHJvdG90eXBlJSwgKCkpLlxuICAgICAgICAvLz4gNy4gIENhbGwgU2ltcGxlRGVmaW5lKG9iaiwgYFwibmFtZVwiYCwgbG9hZC5bW05hbWVdXSkuXG4gICAgICAgIC8vPiA4LiAgQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJtZXRhZGF0YVwiYCwgbG9hZC5bW01ldGFkYXRhXV0pLlxuICAgICAgICAvLz4gOS4gIFJldHVybiB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlIFtbQ2FsbF1dIGludGVybmFsIG1ldGhvZCBvZlxuICAgICAgICAvLz4gICAgIGhvb2sgd2l0aCBsb2FkZXIgYW5kIChvYmopIGFzIGFyZ3VtZW50cy5cbiAgICAgICAgcmV0dXJuIGxvYWRlci5sb2NhdGUoe1xuICAgICAgICAgICAgbmFtZTogbG9hZC5uYW1lLFxuICAgICAgICAgICAgbWV0YWRhdGE6IGxvYWQubWV0YWRhdGFcbiAgICAgICAgfSk7XG4gICAgfTtcbn1cbi8vPlxuXG4vLz4gIyMjIyBDYWxsRmV0Y2ggRnVuY3Rpb25zXG4vLz5cbi8vPiBBIENhbGxGZXRjaCBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gdGhhdCBjYWxscyB0aGUgYGZldGNoYFxuLy8+IGxvYWRlciBob29rLlxuLy8+XG4vLz4gRWFjaCBDYWxsRmV0Y2ggZnVuY3Rpb24gaGFzIFtbTG9hZGVyXV0gYW5kIFtbTG9hZF1dIGludGVybmFsIHNsb3RzLlxuLy8+XG4vLz4gV2hlbiBhIENhbGxGZXRjaCBmdW5jdGlvbiBGIGlzIGNhbGxlZCB3aXRoIGFyZ3VtZW50IGFkZHJlc3MsIHRoZSBmb2xsb3dpbmdcbi8vPiBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0NhbGxGZXRjaChsb2FkZXIsIGxvYWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGFkZHJlc3MpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIEYuW1tMb2FkZXJdXS5cbiAgICAgICAgLy8+IDIuICBMZXQgbG9hZCBiZSBGLltbTG9hZF1dLlxuXG4gICAgICAgIC8vPiAzLiAgSWYgbG9hZC5bW0xpbmtTZXRzXV0gaXMgYW4gZW1wdHkgTGlzdCwgcmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgICAgaWYgKGNhbGxGdW5jdGlvbihzdGRfU2V0X2dldF9zaXplLCBsb2FkLmxpbmtTZXRzKSA9PT0gMClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLz4gNC4gIFNldCB0aGUgW1tBZGRyZXNzXV0gZmllbGQgb2YgbG9hZCB0byBhZGRyZXNzLlxuICAgICAgICBsb2FkLmFkZHJlc3MgPSBhZGRyZXNzO1xuXG4gICAgICAgIC8vPiA1LiAgTGV0IGhvb2sgYmUgdGhlIHJlc3VsdCBvZiBHZXQobG9hZGVyLCBgXCJmZXRjaFwiYCkuXG4gICAgICAgIC8vPiA2LiAgUmV0dXJuSWZBYnJ1cHQoaG9vaykuXG4gICAgICAgIC8vPiA3LiAgSWYgSXNDYWxsYWJsZShob29rKSBpcyBmYWxzZSwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgICAgICAvLz4gOC4gIExldCBvYmogYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nXG4gICAgICAgIC8vPiAgICAgT2JqZWN0Q3JlYXRlKCVPYmplY3RQcm90b3R5cGUlLCAoKSkuXG4gICAgICAgIC8vPiA5LiAgQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJuYW1lXCJgLCBsb2FkLltbTmFtZV1dKS5cbiAgICAgICAgLy8+IDEwLiBDYWxsIFNpbXBsZURlZmluZShvYmosIGBcIm1ldGFkYXRhXCJgLCBsb2FkLltbTWV0YWRhdGFdXSkuXG4gICAgICAgIC8vPiAxMS4gQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJhZGRyZXNzXCJgLCBhZGRyZXNzKS5cbiAgICAgICAgLy8+IDEyLiBSZXR1cm4gdGhlIHJlc3VsdCBvZiBjYWxsaW5nIHRoZSBbW0NhbGxdXSBpbnRlcm5hbCBtZXRob2Qgb2ZcbiAgICAgICAgLy8+ICAgICBob29rIHdpdGggbG9hZGVyIGFuZCAob2JqKSBhcyBhcmd1bWVudHMuXG4gICAgICAgIHJldHVybiBsb2FkZXIuZmV0Y2goe1xuICAgICAgICAgICAgbmFtZTogbG9hZC5uYW1lLFxuICAgICAgICAgICAgbWV0YWRhdGE6IGxvYWQubWV0YWRhdGEsXG4gICAgICAgICAgICBhZGRyZXNzOiBhZGRyZXNzXG4gICAgICAgIH0pO1xuICAgIH07XG59XG4vLz5cblxuLy8+ICMjIyMgQ2FsbFRyYW5zbGF0ZSBGdW5jdGlvbnNcbi8vPlxuLy8+IEEgQ2FsbFRyYW5zbGF0ZSBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gdGhhdCBjYWxscyB0aGUgYHRyYW5zbGF0ZWBcbi8vPiBsb2FkZXIgaG9vay5cbi8vPlxuLy8+IEVhY2ggQ2FsbFRyYW5zbGF0ZSBmdW5jdGlvbiBoYXMgW1tMb2FkZXJdXSBhbmQgW1tMb2FkXV0gaW50ZXJuYWwgc2xvdHMuXG4vLz5cbi8vPiBXaGVuIGEgQ2FsbFRyYW5zbGF0ZSBmdW5jdGlvbiBGIGlzIGNhbGxlZCB3aXRoIGFyZ3VtZW50IHNvdXJjZSwgdGhlIGZvbGxvd2luZ1xuLy8+IHN0ZXBzIGFyZSB0YWtlbjpcbi8vPlxuZnVuY3Rpb24gTWFrZUNsb3N1cmVfQ2FsbFRyYW5zbGF0ZShsb2FkZXIsIGxvYWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgRi5bW0xvYWRlcl1dLlxuICAgICAgICAvLz4gMi4gIExldCBsb2FkIGJlIEYuW1tMb2FkXV0uXG5cbiAgICAgICAgLy8+IDMuICBJZiBsb2FkLltbTGlua1NldHNdXSBpcyBhbiBlbXB0eSBMaXN0LCByZXR1cm4gdW5kZWZpbmVkLlxuICAgICAgICBpZiAoY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfZ2V0X3NpemUsIGxvYWQubGlua1NldHMpID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vPiA1LiAgTGV0IGhvb2sgYmUgdGhlIHJlc3VsdCBvZiBHZXQobG9hZGVyLCBgXCJ0cmFuc2xhdGVcImApLlxuICAgICAgICAvLz4gNi4gIFJldHVybklmQWJydXB0KGhvb2spLlxuICAgICAgICAvLz4gNy4gIElmIElzQ2FsbGFibGUoaG9vaykgaXMgZmFsc2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAgICAgLy8+IDguICBMZXQgb2JqIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZ1xuICAgICAgICAvLz4gICAgIE9iamVjdENyZWF0ZSglT2JqZWN0UHJvdG90eXBlJSwgKCkpLlxuICAgICAgICAvLz4gOS4gIENhbGwgU2ltcGxlRGVmaW5lKG9iaiwgYFwibmFtZVwiYCwgbG9hZC5bW05hbWVdXSkuXG4gICAgICAgIC8vPiAxMC4gQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJtZXRhZGF0YVwiYCwgbG9hZC5bW01ldGFkYXRhXV0pLlxuICAgICAgICAvLz4gMTEuIENhbGwgU2ltcGxlRGVmaW5lKG9iaiwgYFwiYWRkcmVzc1wiYCwgbG9hZC5bW0FkZHJlc3NdXSkuXG4gICAgICAgIC8vPiAxMi4gQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJzb3VyY2VcImAsIHNvdXJjZSkuXG4gICAgICAgIC8vPiAxMy4gUmV0dXJuIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgW1tDYWxsXV0gaW50ZXJuYWwgbWV0aG9kIG9mXG4gICAgICAgIC8vPiAgICAgaG9vayB3aXRoIGxvYWRlciBhbmQgKG9iaikgYXMgYXJndW1lbnRzLlxuICAgICAgICByZXR1cm4gbG9hZGVyLnRyYW5zbGF0ZSh7XG4gICAgICAgICAgICBuYW1lOiBsb2FkLm5hbWUsXG4gICAgICAgICAgICBtZXRhZGF0YTogbG9hZC5tZXRhZGF0YSxcbiAgICAgICAgICAgIGFkZHJlc3M6IGxvYWQuYWRkcmVzcyxcbiAgICAgICAgICAgIHNvdXJjZTogc291cmNlXG4gICAgICAgIH0pO1xuICAgIH07XG59XG4vLz5cblxuLy8+ICMjIyMgQ2FsbEluc3RhbnRpYXRlIEZ1bmN0aW9uc1xuLy8+XG4vLz4gQSBDYWxsSW5zdGFudGlhdGUgZnVuY3Rpb24gaXMgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIHRoYXQgY2FsbHMgdGhlXG4vLz4gYGluc3RhbnRpYXRlYCBsb2FkZXIgaG9vay5cbi8vPlxuLy8+IEVhY2ggQ2FsbEluc3RhbnRpYXRlIGZ1bmN0aW9uIGhhcyBbW0xvYWRlcl1dIGFuZCBbW0xvYWRdXSBpbnRlcm5hbCBzbG90cy5cbi8vPlxuLy8+IFdoZW4gYSBDYWxsSW5zdGFudGlhdGUgZnVuY3Rpb24gRiBpcyBjYWxsZWQgd2l0aCBhcmd1bWVudCBzb3VyY2UsIHRoZVxuLy8+IGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0NhbGxJbnN0YW50aWF0ZShsb2FkZXIsIGxvYWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgRi5bW0xvYWRlcl1dLlxuICAgICAgICAvLz4gMi4gIExldCBsb2FkIGJlIEYuW1tMb2FkXV0uXG5cbiAgICAgICAgLy8+IDMuICBJZiBsb2FkLltbTGlua1NldHNdXSBpcyBhbiBlbXB0eSBMaXN0LCByZXR1cm4gdW5kZWZpbmVkLlxuICAgICAgICBpZiAoY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfZ2V0X3NpemUsIGxvYWQubGlua1NldHMpID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vPiA0LiAgU2V0IHRoZSBbW1NvdXJjZV1dIGludGVybmFsIHNsb3Qgb2YgbG9hZCB0byBzb3VyY2UuXG4gICAgICAgIGxvYWQuc291cmNlID0gc291cmNlO1xuXG4gICAgICAgIC8vPiA1LiAgTGV0IGhvb2sgYmUgdGhlIHJlc3VsdCBvZiBHZXQobG9hZGVyLCBgXCJpbnN0YW50aWF0ZVwiYCkuXG4gICAgICAgIC8vPiA2LiAgUmV0dXJuSWZBYnJ1cHQoaG9vaykuXG4gICAgICAgIC8vPiA3LiAgSWYgSXNDYWxsYWJsZShob29rKSBpcyBmYWxzZSwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgICAgICAvLz4gOC4gIExldCBvYmogYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nXG4gICAgICAgIC8vPiAgICAgT2JqZWN0Q3JlYXRlKCVPYmplY3RQcm90b3R5cGUlLCAoKSkuXG4gICAgICAgIC8vPiA5LiAgQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJuYW1lXCJgLCBsb2FkLltbTmFtZV1dKS5cbiAgICAgICAgLy8+IDEwLiBDYWxsIFNpbXBsZURlZmluZShvYmosIGBcIm1ldGFkYXRhXCJgLCBsb2FkLltbTWV0YWRhdGFdXSkuXG4gICAgICAgIC8vPiAxMS4gQ2FsbCBTaW1wbGVEZWZpbmUob2JqLCBgXCJhZGRyZXNzXCJgLCBsb2FkLltbQWRkcmVzc11dKS5cbiAgICAgICAgLy8+IDEyLiBDYWxsIFNpbXBsZURlZmluZShvYmosIGBcInNvdXJjZVwiYCwgc291cmNlKS5cbiAgICAgICAgLy8+IDEzLiBSZXR1cm4gdGhlIHJlc3VsdCBvZiBjYWxsaW5nIHRoZSBbW0NhbGxdXSBpbnRlcm5hbCBtZXRob2Qgb2ZcbiAgICAgICAgLy8+ICAgICBob29rIHdpdGggbG9hZGVyIGFuZCAob2JqKSBhcyBhcmd1bWVudHMuXG4gICAgICAgIHJldHVybiBsb2FkZXIuaW5zdGFudGlhdGUoe1xuICAgICAgICAgICAgbmFtZTogbG9hZC5uYW1lLFxuICAgICAgICAgICAgbWV0YWRhdGE6IGxvYWQubWV0YWRhdGEsXG4gICAgICAgICAgICBhZGRyZXNzOiBsb2FkLmFkZHJlc3MsXG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZVxuICAgICAgICB9KTtcbiAgICB9O1xufVxuLy8+XG5cbi8vPiAjIyMjIEluc3RhbnRpYXRlU3VjY2VlZGVkIEZ1bmN0aW9uc1xuLy8+XG4vLz4gQW4gSW5zdGFudGlhdGVTdWNjZWVkZWQgZnVuY3Rpb24gaXMgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIHRoYXQgaGFuZGxlc1xuLy8+IHRoZSByZXN1bHQgb2YgdGhlIGBpbnN0YW50aWF0ZWAgaG9vay5cbi8vPlxuLy8+IEVhY2ggSW5zdGFudGlhdGVTdWNjZWVkZWQgZnVuY3Rpb24gaGFzIFtbTG9hZGVyXV0gYW5kIFtbTG9hZF1dIGludGVybmFsXG4vLz4gc2xvdHMuXG4vLz5cbi8vPiBXaGVuIGFuIEluc3RhbnRpYXRlU3VjY2VlZGVkIGZ1bmN0aW9uIEYgaXMgY2FsbGVkIHdpdGggYXJndW1lbnRcbi8vPiBpbnN0YW50aWF0ZVJlc3VsdCwgdGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0luc3RhbnRpYXRlU3VjY2VlZGVkKGxvYWRlciwgbG9hZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoaW5zdGFudGlhdGVSZXN1bHQpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIEYuW1tMb2FkZXJdXS5cbiAgICAgICAgLy8+IDIuICBMZXQgbG9hZCBiZSBGLltbTG9hZF1dLlxuXG4gICAgICAgIC8vPiAzLiAgSWYgbG9hZC5bW0xpbmtTZXRzXV0gaXMgYW4gZW1wdHkgTGlzdCwgcmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgICAgaWYgKGNhbGxGdW5jdGlvbihzdGRfU2V0X2dldF9zaXplLCBsb2FkLmxpbmtTZXRzKSA9PT0gMClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgZGVwc0xpc3Q7XG5cbiAgICAgICAgLy8+IDQuICBJZiBpbnN0YW50aWF0ZVJlc3VsdCBpcyB1bmRlZmluZWQsIHRoZW5cbiAgICAgICAgaWYgKGluc3RhbnRpYXRlUmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIExldCBib2R5IGJlIHRoZSByZXN1bHQgb2YgcGFyc2luZyBsb2FkLltbU291cmNlXV0sXG4gICAgICAgICAgICAvLz4gICAgICAgICBpbnRlcnByZXRlZCBhcyBVVEYtMTYgZW5jb2RlZCBVbmljb2RlIHRleHQgYXMgZGVzY3JpYmVkXG4gICAgICAgICAgICAvLz4gICAgICAgICBpbiBjbGF1c2UgMTAuMS4xLCB1c2luZyBNb2R1bGUgYXMgdGhlIGdvYWxcbiAgICAgICAgICAgIC8vPiAgICAgICAgIHN5bWJvbC4gVGhyb3cgYSBTeW50YXhFcnJvciBleGNlcHRpb24gaWYgdGhlIHBhcnNlXG4gICAgICAgICAgICAvLz4gICAgICAgICBmYWlscyBvciBpZiBhbnkgc3RhdGljIHNlbWFudGljcyBlcnJvcnMgYXJlIGRldGVjdGVkLlxuICAgICAgICAgICAgbGV0IGJvZHkgPSAkUGFyc2VNb2R1bGUobG9hZGVyLCBsb2FkLnNvdXJjZSwgbG9hZC5uYW1lLCBsb2FkLmFkZHJlc3MpO1xuXG4gICAgICAgICAgICAvLz4gICAgIDIuICBTZXQgdGhlIFtbQm9keV1dIGZpZWxkIG9mIGxvYWQgdG8gYm9keS5cbiAgICAgICAgICAgIGxvYWQuYm9keSA9IGJvZHk7XG5cbiAgICAgICAgICAgIC8vPiAgICAgMy4gIFNldCB0aGUgW1tLaW5kXV0gZmllbGQgb2YgbG9hZCB0byAqKmRlY2xhcmF0aXZlKiouXG4gICAgICAgICAgICBsb2FkLmtpbmQgPSBcImRlY2xhcmF0aXZlXCI7XG5cbiAgICAgICAgICAgIC8vPiAgICAgNC4gIExldCBkZXBzTGlzdCBiZSB0aGUgTW9kdWxlUmVxdWVzdHMgb2YgYm9keS5cbiAgICAgICAgICAgIGRlcHNMaXN0ID0gJE1vZHVsZVJlcXVlc3RzKGJvZHkpO1xuXG4gICAgICAgIC8vPiA1LiAgRWxzZSBpZiBUeXBlKGluc3RhbnRpYXRlUmVzdWx0KSBpcyBPYmplY3QsIHRoZW5cbiAgICAgICAgfSBlbHNlIGlmIChJc09iamVjdChpbnN0YW50aWF0ZVJlc3VsdCkpIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIExldCBkZXBzIGJlIHRoZSByZXN1bHQgb2YgR2V0KGluc3RhbnRpYXRlUmVzdWx0LCBgXCJkZXBzXCJgKS5cbiAgICAgICAgICAgIC8vPiAgICAgMi4gIFJldHVybklmQWJydXB0KGRlcHMpLlxuICAgICAgICAgICAgdmFyIGRlcHMgPSBpbnN0YW50aWF0ZVJlc3VsdC5kZXBzO1xuXG4gICAgICAgICAgICAvLz4gICAgIDMuICBJZiBkZXBzIGlzIHVuZGVmaW5lZCwgdGhlbiBsZXQgZGVwc0xpc3QgYmUgYSBuZXcgZW1wdHkgTGlzdC5cbiAgICAgICAgICAgIC8vPiAgICAgNC4gIEVsc2U6XG4gICAgICAgICAgICAvLz4gICAgICAgICAxLiAgTGV0IGRlcHNMaXN0IGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgSXRlcmFibGVUb0FycmF5XG4gICAgICAgICAgICAvLz4gICAgICAgICAgICAgYWJzdHJhY3Qgb3BlcmF0aW9uIHBhc3NpbmcgZGVwcyBhcyB0aGUgc2luZ2xlIGFyZ3VtZW50LlxuICAgICAgICAgICAgLy8+ICAgICAgICAgMi4gIFJldHVybklmQWJydXB0KGRlcHNMaXN0KS5cbiAgICAgICAgICAgIGRlcHNMaXN0ID0gZGVwcyA9PT0gdW5kZWZpbmVkID8gW10gOiBbLi4uZGVwc107XG5cbiAgICAgICAgICAgIC8vPiAgICAgNS4gIExldCBleGVjdXRlIGJlIHRoZSByZXN1bHQgb2YgR2V0KGluc3RhbnRpYXRlUmVzdWx0LFxuICAgICAgICAgICAgLy8+ICAgICAgICAgYFwiZXhlY3V0ZVwiYCkuXG4gICAgICAgICAgICAvLz4gICAgIDYuICBSZXR1cm5JZkFicnVwdChleGVjdXRlKS5cbiAgICAgICAgICAgIHZhciBleGVjdXRlID0gaW5zdGFudGlhdGVSZXN1bHQuZXhlY3V0ZTtcblxuICAgICAgICAgICAgLy8+ICAgICA3LiAgU2V0IHRoZSBbW0V4ZWN1dGVdXSBmaWVsZCBvZiBsb2FkIHRvIGV4ZWN1dGUuXG4gICAgICAgICAgICBsb2FkLmV4ZWN1dGUgPSBleGVjdXRlO1xuXG4gICAgICAgICAgICAvLz4gICAgIDguICBTZXQgdGhlIFtbS2luZF1dIGZpZWxkIG9mIGxvYWQgdG8gKipkeW5hbWljKiouXG4gICAgICAgICAgICBsb2FkLmtpbmQgPSBcImR5bmFtaWNcIjtcbiAgICAgICAgLy8+IDYuIEVsc2UsXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLz4gICAgIDEuICBUaHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiaW5zdGFudGlhdGUgaG9vayBtdXN0IHJldHVybiBhbiBvYmplY3Qgb3IgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8+IDcuICBSZXR1cm4gdGhlIHJlc3VsdCBvZiBjYWxsaW5nIFByb2Nlc3NMb2FkRGVwZW5kZW5jaWVzKGxvYWQsXG4gICAgICAgIC8vPiAgICAgbG9hZGVyLCBkZXBzTGlzdCkuXG4gICAgICAgIDsvLyBQcm9jZXNzTG9hZERlcGVuZGVuY2llcyByZXR1cm5zIGEgcHJvbWlzZS4gVGhlIG9ubHkgd2F5IHRvXG4gICAgICAgIDsvLyBwcm9wYWdhdGUgZXJyb3JzIGlzIHRvIHJldHVybiBpdC5cbiAgICAgICAgcmV0dXJuIFByb2Nlc3NMb2FkRGVwZW5kZW5jaWVzKGxvYWQsIGxvYWRlciwgZGVwc0xpc3QpO1xuICAgIH07XG59XG5cbi8vPiAjIyMjIFByb2Nlc3NMb2FkRGVwZW5kZW5jaWVzKGxvYWQsIGxvYWRlciwgZGVwc0xpc3QpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIFByb2Nlc3NMb2FkRGVwZW5kZW5jaWVzIGFic3RyYWN0IG9wZXJhdGlvbiBpcyBjYWxsZWQgYWZ0ZXIgb25lIG1vZHVsZVxuLy8+IGhhcyBuZWFybHkgZmluaXNoZWQgbG9hZGluZy4gSXQgc3RhcnRzIG5ldyBsb2FkcyBhcyBuZWVkZWQgdG8gbG9hZCB0aGVcbi8vPiBtb2R1bGUncyBkZXBlbmRlbmNpZXMuXG4vLz5cbi8vPiBQcm9jZXNzTG9hZERlcGVuZGVuY2llcyBhbHNvIGFycmFuZ2VzIGZvciBMb2FkU3VjY2VlZGVkIHRvIGJlIGNhbGxlZC5cbi8vPlxuLy8+IFRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBQcm9jZXNzTG9hZERlcGVuZGVuY2llcyhsb2FkLCBsb2FkZXIsIGRlcHNMaXN0KSB7XG4gICAgLy8+IDEuICBMZXQgcmVmZXJyZXJOYW1lIGJlIGxvYWQuW1tOYW1lXV0uXG4gICAgdmFyIHJlZmVycmVyTmFtZSA9IGxvYWQubmFtZTtcblxuICAgIC8vPiAyLiAgU2V0IHRoZSBbW0RlcGVuZGVuY2llc11dIGZpZWxkIG9mIGxvYWQgdG8gYSBuZXcgZW1wdHkgTGlzdC5cbiAgICBsb2FkLmRlcGVuZGVuY2llcyA9IENyZWF0ZU1hcCgpO1xuXG4gICAgLy8+IDMuICBMZXQgbG9hZFByb21pc2VzIGJlIGEgbmV3IGVtcHR5IExpc3QuXG4gICAgdmFyIGxvYWRQcm9taXNlcyA9IFtdO1xuXG4gICAgLy8+IDQuICBGb3IgZWFjaCByZXF1ZXN0IGluIGRlcHNMaXN0LCBkb1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVwc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBkZXBzTGlzdFtpXTtcblxuICAgICAgICAvLz4gICAgIDEuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIFJlcXVlc3RMb2FkKGxvYWRlciwgcmVxdWVzdCxcbiAgICAgICAgLy8+ICAgICAgICAgcmVmZXJyZXJOYW1lLCBsb2FkLltbQWRkcmVzc11dKS5cbiAgICAgICAgdmFyIHAgPSBSZXF1ZXN0TG9hZChsb2FkZXIsIHJlcXVlc3QsIHJlZmVycmVyTmFtZSwgbG9hZC5hZGRyZXNzKTtcblxuICAgICAgICAvLz4gICAgIDIuICBMZXQgRiBiZSBhIG5ldyBhbm9ueW1vdXMgZnVuY3Rpb24gYXMgZGVmaW5lZCBieVxuICAgICAgICAvLz4gICAgICAgICBBZGREZXBlbmRlbmN5TG9hZC5cbiAgICAgICAgLy8+ICAgICAzLiAgU2V0IHRoZSBbW1BhcmVudExvYWRdXSBpbnRlcm5hbCBzbG90IG9mIEYgdG8gbG9hZC5cbiAgICAgICAgLy8+ICAgICA0LiAgU2V0IHRoZSBbW1JlcXVlc3RdXSBpbnRlcm5hbCBzbG90IG9mIEYgdG8gcmVxdWVzdC5cbiAgICAgICAgLy8+ICAgICA1LiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBQcm9taXNlVGhlbihwLCBGKS5cbiAgICAgICAgcCA9IGNhbGxGdW5jdGlvbihzdGRfUHJvbWlzZV90aGVuLCBwLFxuICAgICAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0FkZERlcGVuZGVuY3lMb2FkKGxvYWQsIHJlcXVlc3QpKTtcblxuICAgICAgICAvLz4gICAgIDYuICBBcHBlbmQgcCBhcyB0aGUgbGFzdCBlbGVtZW50IG9mIGxvYWRQcm9taXNlcy5cbiAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9BcnJheV9wdXNoLCBsb2FkUHJvbWlzZXMsIHApO1xuICAgIH1cblxuICAgIC8vPiA1LiAgTGV0IHAgYmUgUHJvbWlzZUFsbChsb2FkUHJvbWlzZXMpLlxuICAgIHZhciBwID0gY2FsbEZ1bmN0aW9uKHN0ZF9Qcm9taXNlX2FsbCwgc3RkX1Byb21pc2UsIGxvYWRQcm9taXNlcyk7XG5cbiAgICAvLz4gNi4gIExldCBGIGJlIGEgbmV3IGFub255bW91cyBmdW5jdGlvbiBhcyBkZWZpbmVkIGJ5XG4gICAgLy8+ICAgICBMb2FkU3VjY2VlZGVkLlxuICAgIC8vPiA3LiAgU2V0IHRoZSBbW0xvYWRdXSBpbnRlcm5hbCBzbG90IG9mIEYgdG8gbG9hZC5cbiAgICAvLz4gOC4gIExldCBwIGJlIHRoZSByZXN1bHQgb2YgUHJvbWlzZVRoZW4ocCwgRikuXG4gICAgcCA9IGNhbGxGdW5jdGlvbihzdGRfUHJvbWlzZV90aGVuLCBwLFxuICAgICAgICAgICAgICAgICAgICAgTWFrZUNsb3N1cmVfTG9hZFN1Y2NlZWRlZChsb2FkKSk7XG5cbiAgICAvLz4gOS4gIFJldHVybiBwLlxuICAgIHJldHVybiBwO1xufVxuXG4vLz4gIyMjIyBBZGREZXBlbmRlbmN5TG9hZCBGdW5jdGlvbnNcbi8vPlxuLy8+IEFuIEFkZERlcGVuZGVuY3lMb2FkIGZ1bmN0aW9uIGlzIGFuIGFub255bW91cyBmdW5jdGlvbiB0aGF0IGFkZHMgYSBMb2FkXG4vLz4gUmVjb3JkIGZvciBhIGRlcGVuZGVuY3kgdG8gYW55IExpbmtTZXRzIGFzc29jaWF0ZWQgd2l0aCB0aGUgcGFyZW50IExvYWQuXG4vLz5cbi8vPiBFYWNoIEFkZERlcGVuZGVuY3lMb2FkIGZ1bmN0aW9uIGhhcyBbW1BhcmVudExvYWRdXSBhbmQgW1tSZXF1ZXN0XV0gaW50ZXJuYWxcbi8vPiBzbG90cy5cbi8vPlxuLy8+IFdoZW4gYW4gQWRkRGVwZW5kZW5jeUxvYWQgZnVuY3Rpb24gRiBpcyBjYWxsZWQgd2l0aCBhcmd1bWVudCBkZXBMb2FkLCB0aGVcbi8vPiBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBNYWtlQ2xvc3VyZV9BZGREZXBlbmRlbmN5TG9hZChwYXJlbnRMb2FkLCByZXF1ZXN0KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChkZXBMb2FkKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IHBhcmVudExvYWQgYmUgRi5bW1BhcmVudExvYWRdXS5cbiAgICAgICAgLy8+IDIuICBMZXQgcmVxdWVzdCBiZSBGLltbUmVxdWVzdF1dLlxuXG4gICAgICAgIC8vPiAzLiAgQXNzZXJ0OiBUaGVyZSBpcyBubyBSZWNvcmQgaW4gdGhlIExpc3RcbiAgICAgICAgLy8+ICAgICBwYXJlbnRMb2FkLltbRGVwZW5kZW5jaWVzXV0gd2hvc2UgW1trZXldXSBmaWVsZCBpcyBlcXVhbCB0b1xuICAgICAgICAvLz4gICAgIHJlcXVlc3QuXG4gICAgICAgIEFzc2VydCghY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfaGFzLCBwYXJlbnRMb2FkLmRlcGVuZGVuY2llcywgcmVxdWVzdCkpO1xuXG4gICAgICAgIC8vPiA0LiAgQWRkIHRoZSBSZWNvcmQge1tba2V5XV06IHJlcXVlc3QsIFtbdmFsdWVdXTogZGVwTG9hZC5bW05hbWVdXX1cbiAgICAgICAgLy8+ICAgICB0byB0aGUgTGlzdCBwYXJlbnRMb2FkLltbRGVwZW5kZW5jaWVzXV0uXG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfTWFwX3NldCwgcGFyZW50TG9hZC5kZXBlbmRlbmNpZXMsIHJlcXVlc3QsIGRlcExvYWQubmFtZSk7XG5cbiAgICAgICAgLy8+IDUuICBJZiBkZXBMb2FkLltbU3RhdHVzXV0gaXMgbm90IGBcImxpbmtlZFwiYCwgdGhlblxuICAgICAgICBpZiAoZGVwTG9hZC5zdGF0dXMgIT09IFwibGlua2VkXCIpIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIExldCBsaW5rU2V0cyBiZSBhIGNvcHkgb2YgdGhlIExpc3QgcGFyZW50TG9hZC5bW0xpbmtTZXRzXV0uXG4gICAgICAgICAgICB2YXIgbGlua1NldHMgPSBTZXRUb0FycmF5KHBhcmVudExvYWQubGlua1NldHMpO1xuXG4gICAgICAgICAgICAvLz4gICAgIDIuICBGb3IgZWFjaCBsaW5rU2V0IGluIGxpbmtTZXRzLCBkb1xuICAgICAgICAgICAgLy8+ICAgICAgICAgMS4gIENhbGwgQWRkTG9hZFRvTGlua1NldChsaW5rU2V0LCBkZXBMb2FkKS5cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGlua1NldHMubGVuZ3RoOyBqKyspXG4gICAgICAgICAgICAgICAgQWRkTG9hZFRvTGlua1NldChsaW5rU2V0c1tqXSwgZGVwTG9hZCk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuLy8+XG5cbi8vPiAjIyMjIExvYWRTdWNjZWVkZWQgRnVuY3Rpb25zXG4vLz5cbi8vPiBBIExvYWRTdWNjZWVkZWQgZnVuY3Rpb24gaXMgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIHRoYXQgdHJhbnNpdGlvbnMgYSBMb2FkXG4vLz4gUmVjb3JkIGZyb20gYFwibG9hZGluZ1wiYCB0byBgXCJsb2FkZWRcImAgYW5kIG5vdGlmaWVzIGFsbCBhc3NvY2lhdGVkIExpbmtTZXRcbi8vPiBSZWNvcmRzIG9mIHRoZSBjaGFuZ2UuIFRoaXMgZnVuY3Rpb24gY29uY2x1ZGVzIHRoZSBsb2FkZXIgcGlwZWxpbmUuIEl0IGlzXG4vLz4gY2FsbGVkIGFmdGVyIGFsbCBhIG5ld2x5IGxvYWRlZCBtb2R1bGUncyBkZXBlbmRlbmNpZXMgYXJlIHN1Y2Nlc3NmdWxseVxuLy8+IHByb2Nlc3NlZC5cbi8vPlxuLy8+IEVhY2ggTG9hZFN1Y2NlZWRlZCBmdW5jdGlvbiBoYXMgYSBbW0xvYWRdXSBpbnRlcm5hbCBzbG90LlxuLy8+XG4vLz4gV2hlbiBhIExvYWRTdWNjZWVkZWQgZnVuY3Rpb24gRiBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBNYWtlQ2xvc3VyZV9Mb2FkU3VjY2VlZGVkKGxvYWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKF8pIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZCBiZSBGLltbTG9hZF1dLlxuICAgICAgICAvLz4gMi4gIEFzc2VydDogbG9hZC5bW1N0YXR1c11dIGlzIGBcImxvYWRpbmdcImAuXG4gICAgICAgIEFzc2VydChsb2FkLnN0YXR1cyA9PT0gXCJsb2FkaW5nXCIpO1xuXG4gICAgICAgIC8vPiAzLiAgU2V0IHRoZSBbW1N0YXR1c11dIGZpZWxkIG9mIGxvYWQgdG8gYFwibG9hZGVkXCJgLlxuICAgICAgICBsb2FkLnN0YXR1cyA9IFwibG9hZGVkXCI7XG5cbiAgICAgICAgLy8+IDQuICBMZXQgbGlua1NldHMgYmUgYSBjb3B5IG9mIGxvYWQuW1tMaW5rU2V0c11dLlxuICAgICAgICB2YXIgbGlua1NldHMgPSBTZXRUb0FycmF5KGxvYWQubGlua1NldHMpO1xuXG4gICAgICAgIC8vPiA1LiAgRm9yIGVhY2ggbGlua1NldCBpbiBsaW5rU2V0cywgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZSBMaW5rU2V0XG4gICAgICAgIC8vPiAgICAgUmVjb3JkcyB3ZXJlIGNyZWF0ZWQsXG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfQXJyYXlfc29ydCwgbGlua1NldHMsXG4gICAgICAgICAgICAgICAgICAgICAoYSwgYikgPT4gYi50aW1lc3RhbXAgLSBhLnRpbWVzdGFtcCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlua1NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIENhbGwgVXBkYXRlTGlua1NldE9uTG9hZChsaW5rU2V0LCBsb2FkKS5cbiAgICAgICAgICAgIFVwZGF0ZUxpbmtTZXRPbkxvYWQobGlua1NldHNbaV0sIGxvYWQpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuXG5cbi8vICMjIE5vdGVzIG9uIGVycm9yIGhhbmRsaW5nXG4vL1xuLy8gTW9zdCBlcnJvcnMgdGhhdCBjYW4gb2NjdXIgZHVyaW5nIG1vZHVsZSBsb2FkaW5nIGFyZSByZWxhdGVkIHRvIGVpdGhlciBhXG4vLyBzcGVjaWZpYyBpbi1mbGlnaHQgYExvYWRgIChpbiBgbG9hZGVyLmxvYWRzYCkgb3IgYSBzcGVjaWZpYyBgTGlua1NldGAuXG4vL1xuLy8gV2hlbiBzdWNoIGFuIGVycm9yIG9jY3Vyczpcbi8vXG4vLyAgMS4gQ29tcHV0ZSB0aGUgc2V0IEYgb2YgYExpbmtTZXRgcyB3ZSBhcmUgZ29pbmcgdG8gZmFpbC5cbi8vXG4vLyAgICAgICAqIElmIHRoZSBlcnJvciBpcyByZWxhdGVkIHRvIGEgc2luZ2xlIGBMaW5rU2V0YCAodGhhdCBpcywgaXQgaXMgYSBsaW5rXG4vLyAgICAgICAgIGVycm9yIG9yIGFuIHJ1bnRpbWUgZXJyb3IgaW4gYSBtb2R1bGUpLCB0aGVuIEYgPSBhIHNldCBjb250YWluaW5nXG4vLyAgICAgICAgIGp1c3QgdGhhdCBgTGlua1NldGAuXG4vL1xuLy8gICAgICAgKiBJZiB0aGUgZXJyb3IgaXMgcmVsYXRlZCB0byBhbiBpbi1mbGlnaHQgYExvYWRgICh0aGF0IGlzLCBpdCBoYXMgdG9cbi8vICAgICAgICAgZG8gd2l0aCBhIGhvb2sgdGhyb3dpbmcsIHJldHVybmluZyBhbiBpbnZhbGlkIHZhbHVlLCBvciByZXR1cm5pbmcgYVxuLy8gICAgICAgICB0aGVuYWJsZSB0aGF0IGJlY29tZXMgcmVqZWN0ZWQpLCB0aGVuIEYgPSBgbG9hZC5saW5rU2V0c2AuXG4vL1xuLy8gIDIuIERldGFjaCBlYWNoIGBMaW5rU2V0YCBpbiBGIGZyb20gYWxsIGBMb2FkYHMgaXQgcmVxdWlyZWQuXG4vL1xuLy8gIDMuIExldCBNID0gdGhlIHNldCBvZiBhbGwgaW4tZmxpZ2h0IGxvYWRzIChpbiBsb2FkZXIuW1tMb2Fkc11dKSB0aGF0IGFyZSBub1xuLy8gICAgIGxvbmdlciBuZWVkZWQgYnkgYW55IExpbmtTZXQuXG4vL1xuLy8gIDQuIFJlbW92ZSBhbGwgbG9hZHMgaW4gTSBmcm9tIGxvYWRlci5bW0xvYWRzXV0uICBJZiBhbnkgYXJlIGluIGBcImxvYWRpbmdcImBcbi8vICAgICBzdGF0ZSwgd2FpdGluZyBmb3IgYSBwcm9taXNlLCBtYWtlIGFueSBgZnVsZmlsbGAgYW5kIGByZWplY3RgIGNhbGxiYWNrc1xuLy8gICAgIGludG8gbm8tb3BzLlxuLy9cbi8vICA1LiBSZWplY3QgdGhlIHByb21pc2VzIGFzc29jaWF0ZWQgd2l0aCBlYWNoIGBMaW5rU2V0YCBpbiBGLlxuLy9cbi8vIEFmdGVyIHRoYXQsIHdlIGRyb3AgdGhlIGZhaWxlZCBgTGlua1NldGBzIGFuZCB0aGV5IGJlY29tZSBnYXJiYWdlLlxuLy9cbi8vIE1vZHVsZXMgdGhhdCBhcmUgYWxyZWFkeSBsaW5rZWQgYW5kIGNvbW1pdHRlZCB0byB0aGUgbW9kdWxlIHJlZ2lzdHJ5IGFyZVxuLy8gdW5hZmZlY3RlZCBieSB0aGUgZXJyb3IuXG4vL1xuLy9cbi8vICMjIyBFbmN5Y2xvcGVkaWEgb2YgZXJyb3JzXG4vL1xuLy8gRm9yIHJlZmVyZW5jZSwgaGVyZSBhcmUgYWxsIHRoZSBraW5kcyBvZiBlcnJvcnMgdGhhdCBjYW4gb2NjdXIgdGhhdCBhcmVcbi8vIHJlbGF0ZWQgdG8gb25lIG9yIG1vcmUgbG9hZHMgaW4gcHJvZ3Jlc3MuIFRoaXMgbGlzdCBpcyBtZWFudCB0byBiZVxuLy8gZXhoYXVzdGl2ZS5cbi8vXG4vLyBFcnJvcnMgcmVsYXRlZCB0byBhIGBMb2FkYDpcbi8vXG4vLyAgIC0gRm9yIGVhY2ggbG9hZCwgd2UgY2FsbCBvbmUgb3IgbW9yZSBvZiB0aGUgbG9hZGVyIGhvb2tzLiAgR2V0dGluZyB0aGVcbi8vICAgICBob29rIGZyb20gdGhlIExvYWRlciBvYmplY3QgY2FuIHRyaWdnZXIgYSBnZXR0ZXIgdGhhdCB0aHJvd3MuICBUaGUgdmFsdWVcbi8vICAgICBvZiB0aGUgaG9vayBwcm9wZXJ0eSBjYW4gYmUgbm9uLWNhbGxhYmxlLiAgVGhlIGhvb2sgY2FuIHRocm93LiAgVGhlIGhvb2tcbi8vICAgICBjYW4gcmV0dXJuIGFuIGludmFsaWQgcmV0dXJuIHZhbHVlLlxuLy9cbi8vICAgLSBUaGUgYG5vcm1hbGl6ZWAsIGBsb2NhdGVgLCBhbmQgYGluc3RhbnRpYXRlYCBob29rcyBtYXkgcmV0dXJuIG9iamVjdHNcbi8vICAgICB0aGF0IGFyZSB0aGVuIGRlc3RydWN0dXJlZC4gIFRoZXNlIG9iamVjdHMgY291bGQgdGhyb3cgZnJvbSBhIGdldHRlciBvclxuLy8gICAgIHByb3h5IHRyYXAgZHVyaW5nIGRlc3RydWN0dXJpbmcuXG4vL1xuLy8gICAtIFRoZSBmZXRjaCBob29rIGNhbiByZXBvcnQgYW4gZXJyb3IgdmlhIHRoZSBgcmVqZWN0KClgIGNhbGxiYWNrLlxuLy9cbi8vICAgLSBXZSBjYW4gZmV0Y2ggYmFkIGNvZGUgYW5kIGdldCBhIGBTeW50YXhFcnJvcmAgdHJ5aW5nIHRvIHBhcnNlIGl0LlxuLy9cbi8vICAgLSBPbmNlIHRoZSBjb2RlIGlzIHBhcnNlZCwgd2UgY2FsbCB0aGUgYG5vcm1hbGl6ZWAgaG9vayBmb3IgZWFjaCBpbXBvcnQgaW5cbi8vICAgICB0aGF0IGNvZGU7IHRoYXQgaG9vayBjYW4gdGhyb3cgb3IgcmV0dXJuIGFuIGludmFsaWQgdmFsdWUuXG4vL1xuLy8gRXJyb3JzIHJlbGF0ZWQgdG8gYSBgTGlua1NldGA6XG4vL1xuLy8gICAtIER1cmluZyBsaW5raW5nLCB3ZSBjYW4gZmluZCB0aGF0IGEgZHluYW1pYyBtb2R1bGUgaXMgaW52b2x2ZWQgaW4gYW5cbi8vICAgICBpbXBvcnQgY3ljbGUuIFRoaXMgaXMgYW4gZXJyb3IuXG4vL1xuLy8gICAtIExpbmtpbmcgYSBzZXQgb2YgZGVjbGFyYXRpdmUgbW9kdWxlcyBjYW4gZmFpbCBpbiBzZXZlcmFsIHdheXMuXG4vLyAgICAgVGhlc2UgYXJlIGRlc2NyaWJlZCB1bmRlciBcIlJ1bnRpbWUgU2VtYW50aWNzOiBMaW5rIEVycm9yc1wiLlxuLy9cbi8vICAgLSBBIGR5bmFtaWMgYGZhY3RvcnkuZXhlY3V0ZSgpYCBmdW5jdGlvbiBjYW4gdGhyb3cgb3IgcmV0dXJuIGFuIGludmFsaWRcbi8vICAgICB2YWx1ZS5cbi8vXG4vLyAgIC0gRXZhbHVhdGlvbiBvZiBhIG1vZHVsZSBib2R5IG9yIGEgc2NyaXB0IGNhbiB0aHJvdy5cbi8vXG5cbi8vPiAjIyMgTGlua1NldCBSZWNvcmRzXG4vLz5cbi8vPiBBIExpbmtTZXQgUmVjb3JkIHJlcHJlc2VudHMgYSBjYWxsIHRvIGBsb2FkZXIuZGVmaW5lKClgLCBgLmxvYWQoKWAsXG4vLz4gYC5tb2R1bGUoKWAsIG9yIGAuaW1wb3J0KClgLlxuLy8+XG4vLz4gRWFjaCBMaW5rU2V0IFJlY29yZCBoYXMgdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4vLz5cbi8vPiAgICogbGlua1NldC5bW0xvYWRlcl1dIC0gVGhlIExvYWRlciBvYmplY3QgdGhhdCBjcmVhdGVkIHRoaXMgTGlua1NldC5cbi8vPlxuLy8+ICAgKiBsaW5rU2V0LltbTG9hZHNdXSAtIEEgTGlzdCBvZiB0aGUgTG9hZCBSZWNvcmRzIHRoYXQgbXVzdCBmaW5pc2ggbG9hZGluZ1xuLy8+ICAgICBiZWZvcmUgdGhlIG1vZHVsZXMgY2FuIGJlIGxpbmtlZCBhbmQgZXZhbHVhdGVkLlxuLy8+XG4vLz4gICAqIGxpbmtTZXQuW1tEb25lXV0gLSBBIFByb21pc2UgdGhhdCBiZWNvbWVzIGZ1bGZpbGxlZCB3aGVuIGFsbFxuLy8+ICAgICBkZXBlbmRlbmNpZXMgYXJlIGxvYWRlZCBhbmQgbGlua2VkIHRvZ2V0aGVyLlxuLy8+XG4vLz4gICAqIGxpbmtTZXQuW1tSZXNvbHZlXV0gYW5kIGxpbmtTZXQuW1tSZWplY3RdXSAtIEZ1bmN0aW9ucyB1c2VkIHRvIHJlc29sdmVcbi8vPiAgICAgb3IgcmVqZWN0IGxpbmtTZXQuW1tEb25lXV0uXG4vLz5cblxuLy8+ICMjIyMgQ3JlYXRlTGlua1NldChsb2FkZXIsIHN0YXJ0aW5nTG9hZCkgQWJzdHJhY3QgT3BlcmF0aW9uXG4vLz5cbi8vPiBUaGUgQ3JlYXRlTGlua1NldCBhYnN0cmFjdCBvcGVyYXRpb24gY3JlYXRlcyBhIG5ldyBMaW5rU2V0IHJlY29yZCBieVxuLy8+IHBlcmZvcm1pbmcgdGhlIGZvbGxvd2luZyBzdGVwczpcbi8vPlxuZnVuY3Rpb24gQ3JlYXRlTGlua1NldChsb2FkZXIsIHN0YXJ0aW5nTG9hZCkge1xuICAgIC8vPiAxLiAgSWYgVHlwZShsb2FkZXIpIGlzIG5vdCBPYmplY3QsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAvLz4gMi4gIElmIGxvYWRlciBkb2VzIG5vdCBoYXZlIGFsbCBvZiB0aGUgaW50ZXJuYWwgcHJvcGVydGllcyBvZiBhIExvYWRlclxuICAgIC8vPiAgICAgSW5zdGFuY2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICB2YXIgbG9hZGVyRGF0YSA9IEdldExvYWRlckludGVybmFsRGF0YShsb2FkZXIpO1xuXG4gICAgLy8+IDMuICBMZXQgZGVmZXJyZWQgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIEdldERlZmVycmVkKCVQcm9taXNlJSkuXG4gICAgLy8+IDQuICBSZXR1cm5JZkFicnVwdChkZWZlcnJlZCkuXG4gICAgdmFyIHJlc29sdmUsIHJlamVjdDtcbiAgICB2YXIgZG9uZSA9IG5ldyBzdGRfUHJvbWlzZShmdW5jdGlvbiAocmVzLCByZWopIHtcbiAgICAgICAgcmVzb2x2ZSA9IHJlcztcbiAgICAgICAgcmVqZWN0ID0gcmVqO1xuICAgIH0pO1xuXG4gICAgLy8+IDUuICBMZXQgbGlua1NldCBiZSBhIG5ldyBMaW5rU2V0IFJlY29yZC5cbiAgICB2YXIgbGlua1NldCA9IHtcbiAgICAgICAgLy8+IDYuICBTZXQgdGhlIFtbTG9hZGVyXV0gZmllbGQgb2YgbGlua1NldCB0byBsb2FkZXIuXG4gICAgICAgIGxvYWRlcjogbG9hZGVyLFxuICAgICAgICAvLz4gNy4gIFNldCB0aGUgW1tMb2Fkc11dIGZpZWxkIG9mIGxpbmtTZXQgdG8gYSBuZXcgZW1wdHkgTGlzdC5cbiAgICAgICAgbG9hZHM6IENyZWF0ZVNldCgpLFxuICAgICAgICAvLz4gOC4gIFNldCB0aGUgW1tEb25lXV0gZmllbGQgb2YgbGlua1NldCB0byBkZWZlcnJlZC5bW1Byb21pc2VdXS5cbiAgICAgICAgZG9uZTogZG9uZSxcbiAgICAgICAgLy8+IDkuICBTZXQgdGhlIFtbUmVzb2x2ZV1dIGZpZWxkIG9mIGxpbmtTZXQgdG8gZGVmZXJyZWQuW1tSZXNvbHZlXV0uXG4gICAgICAgIHJlc29sdmU6IHJlc29sdmUsXG4gICAgICAgIC8vPiAxMC4gU2V0IHRoZSBbW1JlamVjdF1dIGZpZWxkIG9mIGxpbmtTZXQgdG8gZGVmZXJyZWQuW1tSZWplY3RdXS5cbiAgICAgICAgcmVqZWN0OiByZWplY3QsXG5cbiAgICAgICAgdGltZXN0YW1wOiBsb2FkZXJEYXRhLmxpbmtTZXRDb3VudGVyKyssXG4gICAgICAgIGxvYWRpbmdDb3VudDogMFxuICAgIH07XG5cbiAgICAvLz4gMTEuIENhbGwgQWRkTG9hZFRvTGlua1NldChsaW5rU2V0LCBzdGFydGluZ0xvYWQpLlxuICAgIEFkZExvYWRUb0xpbmtTZXQobGlua1NldCwgc3RhcnRpbmdMb2FkKTtcblxuICAgIC8vPiAxMi4gUmV0dXJuIGxpbmtTZXQuXG4gICAgcmV0dXJuIGxpbmtTZXQ7XG59XG4vL1xuLy8gKipgbGlua1NldC50aW1lc3RhbXBgKiogJm5kYXNoOyBUaGlzIGZpZWxkIGlzIG5vdCBpbiB0aGUgc3BlYywgYnV0IHNldmVyYWxcbi8vIHBsYWNlcyBpbiB0aGUgc3BlYyByZXF1aXJlIHNvcnRpbmcgYSBMaXN0IG9mIExpbmtTZXRzIGJ5IHRoZSBvcmRlciBpbiB3aGljaFxuLy8gdGhleSB3ZXJlIGNyZWF0ZWQuXG4vL1xuLy8gKipgbGlua1NldC5sb2FkaW5nQ291bnRgKiogJm5kYXNoOyBUaGlzIGZpZWxkIGlzIG5vdCBpbiB0aGUgc3BlYyBlaXRoZXIuXG4vLyBJdHMgdmFsdWUgaXMgYWx3YXlzIHRoZSBudW1iZXIgb2YgYExvYWRgcyBpbiBgdGhpcy5sb2Fkc2Agd2hvc2UgYC5zdGF0dXNgIGlzXG4vLyBgXCJsb2FkaW5nXCJgLiAgVGhpcyBpbXBsZW1lbnRhdGlvbiBzdG9yZXMgdGhpcyB2YWx1ZSBhcyBhbiBvcHRpbWl6YXRpb24sIHRvXG4vLyBhdm9pZCBoYXZpbmcgdG8gd2FsayBgdGhpcy5sb2Fkc2AgYW5kIGNvbXB1dGUgdGhpcyB2YWx1ZSBldmVyeSB0aW1lIGl0J3Ncbi8vIG5lZWRlZC5cblxuXG4vLz4gIyMjIyBBZGRMb2FkVG9MaW5rU2V0KGxpbmtTZXQsIGxvYWQpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIEFkZExvYWRUb0xpbmtTZXQgYWJzdHJhY3Qgb3BlcmF0aW9uIGFzc29jaWF0ZXMgYSBMaW5rU2V0IFJlY29yZCB3aXRoIGFcbi8vPiBMb2FkIFJlY29yZCBhbmQgZWFjaCBvZiBpdHMgY3VycmVudGx5IGtub3duIGRlcGVuZGVuY2llcywgaW5kaWNhdGluZyB0aGF0XG4vLz4gdGhlIExpbmtTZXQgY2Fubm90IGJlIGxpbmtlZCB1bnRpbCB0aG9zZSBMb2FkcyBoYXZlIGZpbmlzaGVkIHN1Y2Nlc3NmdWxseS5cbi8vPlxuLy8+IFRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBBZGRMb2FkVG9MaW5rU2V0KGxpbmtTZXQsIGxvYWQpIHtcbiAgICAvLz4gMS4gIEFzc2VydDogbG9hZC5bW1N0YXR1c11dIGlzIGVpdGhlciBgXCJsb2FkaW5nXCJgIG9yIGBcImxvYWRlZFwiYC5cbiAgICBBc3NlcnQobG9hZC5zdGF0dXMgPT09IFwibG9hZGluZ1wiIHx8IGxvYWQuc3RhdHVzID09PSBcImxvYWRlZFwiKTtcblxuICAgIC8vPiAyLiAgTGV0IGxvYWRlciBiZSBsaW5rU2V0LltbTG9hZGVyXV0uXG4gICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobGlua1NldC5sb2FkZXIpO1xuXG4gICAgLy8+IDMuICBJZiBsb2FkIGlzIG5vdCBhbHJlYWR5IGFuIGVsZW1lbnQgb2YgdGhlIExpc3QgbGlua1NldC5bW0xvYWRzXV0sXG4gICAgaWYgKCFjYWxsRnVuY3Rpb24oc3RkX1NldF9oYXMsIGxpbmtTZXQubG9hZHMsIGxvYWQpKSB7XG4gICAgICAgIC8vPiAgICAgMS4gIEFkZCBsb2FkIHRvIHRoZSBMaXN0IGxpbmtTZXQuW1tMb2Fkc11dLlxuICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX1NldF9hZGQsIGxpbmtTZXQubG9hZHMsIGxvYWQpO1xuXG4gICAgICAgIC8vPiAgICAgMi4gIEFkZCBsaW5rU2V0IHRvIHRoZSBMaXN0IGxvYWQuW1tMaW5rU2V0c11dLlxuICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX1NldF9hZGQsIGxvYWQubGlua1NldHMsIGxpbmtTZXQpO1xuXG4gICAgICAgIC8vPiAgICAgMy4gIElmIGxvYWQuW1tTdGF0dXNdXSBpcyBgXCJsb2FkZWRcImAsIHRoZW5cbiAgICAgICAgaWYgKGxvYWQuc3RhdHVzID09PSBcImxvYWRlZFwiKSB7XG4gICAgICAgICAgICAvLz4gICAgICAgICAxLiAgRm9yIGVhY2ggbmFtZSBpbiB0aGUgTGlzdCBsb2FkLltbRGVwZW5kZW5jaWVzXV0sIGRvXG4gICAgICAgICAgICBsZXQgbmFtZXMgPSBNYXBWYWx1ZXNUb0FycmF5KGxvYWQuZGVwZW5kZW5jaWVzKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IG5hbWVzW2ldO1xuXG4gICAgICAgICAgICAgICAgLy8+ICAgICAgICAgICAgIDEuICBJZiB0aGVyZSBpcyBubyBlbGVtZW50IG9mXG4gICAgICAgICAgICAgICAgLy8+ICAgICAgICAgICAgICAgICBsb2FkZXIuW1tNb2R1bGVzXV0gd2hvc2UgW1trZXldXSBmaWVsZCBpc1xuICAgICAgICAgICAgICAgIC8vPiAgICAgICAgICAgICAgICAgZXF1YWwgdG8gbmFtZSxcbiAgICAgICAgICAgICAgICBpZiAoIWNhbGxGdW5jdGlvbihzdGRfTWFwX2hhcywgbG9hZGVyRGF0YS5tb2R1bGVzLCBuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAvLz4gICAgICAgICAgICAgICAgIDEuICBJZiB0aGVyZSBpcyBhbiBlbGVtZW50IG9mXG4gICAgICAgICAgICAgICAgICAgIC8vPiAgICAgICAgICAgICAgICAgICAgIGxvYWRlci5bW0xvYWRzXV0gd2hvc2UgW1tOYW1lXV1cbiAgICAgICAgICAgICAgICAgICAgLy8+ICAgICAgICAgICAgICAgICAgICAgZmllbGQgaXMgZXF1YWwgdG8gbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgLy8+ICAgICAgICAgICAgICAgICAgICAgMS4gIExldCBkZXBMb2FkIGJlIHRoYXQgTG9hZFxuICAgICAgICAgICAgICAgICAgICAvLz4gICAgICAgICAgICAgICAgICAgICAgICAgUmVjb3JkLlxuICAgICAgICAgICAgICAgICAgICAvLz4gICAgICAgICAgICAgICAgICAgICAyLiAgQ2FsbCBBZGRMb2FkVG9MaW5rU2V0KGxpbmtTZXQsXG4gICAgICAgICAgICAgICAgICAgIC8vPiAgICAgICAgICAgICAgICAgICAgICAgICBkZXBMb2FkKS5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGRlcExvYWQgPSBjYWxsRnVuY3Rpb24oc3RkX01hcF9nZXQsIGxvYWRlckRhdGEubG9hZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGVwTG9hZCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgQWRkTG9hZFRvTGlua1NldChsaW5rU2V0LCBkZXBMb2FkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5rU2V0LmxvYWRpbmdDb3VudCsrOyAgLy8gU2VlIGNvbW1lbnQgYXQgQ3JlYXRlTGlua1NldCgpLlxuICAgICAgICB9XG4gICAgfVxufVxuLy8+XG4vL1xuLy8gVGhlIGNhc2UgaW4gc3RlcCAzLmMuaS4xLiB3aGVyZSB0aGVyZSBpcyBubyBtYXRjaGluZyBlbnRyeSBlaXRoZXIgaW5cbi8vIGxvYWRlci5bW01vZHVsZXNdXSBvciBpbiBsb2FkZXIuW1tMb2Fkc11dIGNhbiBvY2N1ciwgYnV0IG9ubHkgdGhyb3VnaCB0aGVcbi8vIHVzZSBvZiBgTG9hZGVyLnByb3RvdHlwZS5kZWxldGVgLlxuXG5cbi8vPiAjIyMjIFVwZGF0ZUxpbmtTZXRPbkxvYWQobGlua1NldCwgbG9hZCkgQWJzdHJhY3QgT3BlcmF0aW9uXG4vLz5cbi8vPiBUaGUgVXBkYXRlTGlua1NldE9uTG9hZCBhYnN0cmFjdCBvcGVyYXRpb24gaXMgY2FsbGVkIGltbWVkaWF0ZWx5IGFmdGVyIGFcbi8vPiBMb2FkIHN1Y2Nlc3NmdWxseSBmaW5pc2hlcywgYWZ0ZXIgc3RhcnRpbmcgTG9hZHMgZm9yIGFueSBkZXBlbmRlbmNpZXMgdGhhdFxuLy8+IHdlcmUgbm90IGFscmVhZHkgbG9hZGluZywgbG9hZGVkLCBvciBpbiB0aGUgbW9kdWxlIHJlZ2lzdHJ5LlxuLy8+XG4vLz4gVGhpcyBvcGVyYXRpb24gZGV0ZXJtaW5lcyB3aGV0aGVyIGxpbmtTZXQgaXMgcmVhZHkgdG8gbGluaywgYW5kIGlmIHNvLFxuLy8+IGNhbGxzIExpbmsuXG4vLz5cbi8vPiBUaGUgZm9sbG93aW5nIHN0ZXBzIGFyZSB0YWtlbjpcbi8vPlxuZnVuY3Rpb24gVXBkYXRlTGlua1NldE9uTG9hZChsaW5rU2V0LCBsb2FkKSB7XG4gICAgLy8+IDEuICBBc3NlcnQ6IGxvYWQgaXMgYW4gZWxlbWVudCBvZiBsaW5rU2V0LltbTG9hZHNdXS5cbiAgICBBc3NlcnQoY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfaGFzLCBsaW5rU2V0LmxvYWRzLCBsb2FkKSk7XG5cbiAgICAvLz4gMi4gIEFzc2VydDogbG9hZC5bW1N0YXR1c11dIGlzIGVpdGhlciBgXCJsb2FkZWRcImAgb3IgYFwibGlua2VkXCJgLlxuICAgIEFzc2VydChsb2FkLnN0YXR1cyA9PT0gXCJsb2FkZWRcIiB8fCBsb2FkLnN0YXR1cyA9PT0gXCJsaW5rZWRcIik7XG5cbiAgICAvLz4gMy4gIFJlcGVhdCBmb3IgZWFjaCBsb2FkIGluIGxpbmtTZXQuW1tMb2Fkc11dLFxuICAgIC8vPiAgICAgMS4gIElmIGxvYWQuW1tTdGF0dXNdXSBpcyBgXCJsb2FkaW5nXCJgLCB0aGVuIHJldHVybi5cbiAgICBpZiAoLS1saW5rU2V0LmxvYWRpbmdDb3VudCAhPT0gMClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8+IDQuICBMZXQgc3RhcnRpbmdMb2FkIGJlIHRoZSBmaXJzdCBlbGVtZW50IG9mIHRoZSBMaXN0XG4gICAgLy8+ICAgICBsaW5rU2V0LltbTG9hZHNdXS5cbiAgICB2YXIgc3RhcnRpbmdMb2FkID0gY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfaXRlcmF0b3JfbmV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGdW5jdGlvbihzdGRfU2V0X2l0ZXJhdG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmtTZXQubG9hZHMpKS52YWx1ZTtcblxuICAgIHRyeSB7XG4gICAgICAgIC8vPiA1LiAgTGV0IHN0YXR1cyBiZSB0aGUgcmVzdWx0IG9mIExpbmsobGlua1NldC5bW0xvYWRzXV0sXG4gICAgICAgIC8vPiAgICAgbGlua1NldC5bW0xvYWRlcl1dKS5cbiAgICAgICAgTGluayhsaW5rU2V0LmxvYWRzLCBsaW5rU2V0LmxvYWRlcik7XG4gICAgfSBjYXRjaCAoZXhjKSB7XG4gICAgICAgIC8vPiA2LiAgSWYgc3RhdHVzIGlzIGFuIGFicnVwdCBjb21wbGV0aW9uLCB0aGVuXG4gICAgICAgIC8vPiAgICAgMS4gIENhbGwgTGlua1NldEZhaWxlZChsaW5rU2V0LCBzdGF0dXMuW1t2YWx1ZV1dKS5cbiAgICAgICAgTGlua1NldEZhaWxlZChsaW5rU2V0LCBleGMpO1xuXG4gICAgICAgIC8vPiAgICAgMi4gIFJldHVybi5cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vPiA3LiAgQXNzZXJ0OiBsaW5rU2V0LltbTG9hZHNdXSBpcyBhbiBlbXB0eSBMaXN0LlxuICAgIEFzc2VydChjYWxsRnVuY3Rpb24oc3RkX1NldF9nZXRfc2l6ZSwgbGlua1NldC5sb2FkcykgPT09IDApO1xuXG4gICAgLy8+IDguICBDYWxsIHRoZSBbW0NhbGxdXSBpbnRlcm5hbCBtZXRob2Qgb2YgbGlua1NldC5bW1Jlc29sdmVdXSBwYXNzaW5nXG4gICAgLy8+ICAgICB1bmRlZmluZWQgYW5kIChzdGFydGluZ0xvYWQpIGFzIGFyZ3VtZW50cy5cbiAgICAvLz4gOS4gIEFzc2VydDogVGhlIGNhbGwgcGVyZm9ybWVkIGJ5IHN0ZXAgOCBjb21wbGV0ZWQgbm9ybWFsbHkuXG4gICAgbGlua1NldC5yZXNvbHZlKHN0YXJ0aW5nTG9hZCk7XG59XG4vLz5cblxuXG4vLz4gIyMjIyBMaW5rU2V0RmFpbGVkKGxpbmtTZXQsIGV4YykgQWJzdHJhY3QgT3BlcmF0aW9uXG4vLz5cbi8vPiBUaGUgTGlua1NldEZhaWxlZCBhYnN0cmFjdCBvcGVyYXRpb24gaXMgY2FsbGVkIHdoZW4gYSBMaW5rU2V0IGZhaWxzLiAgSXRcbi8vPiBkZXRhY2hlcyB0aGUgZ2l2ZW4gTGlua1NldCBSZWNvcmQgZnJvbSBhbGwgTG9hZCBSZWNvcmRzIGFuZCByZWplY3RzIHRoZVxuLy8+IGxpbmtTZXQuW1tEb25lXV0gUHJvbWlzZS5cbi8vPlxuLy8+IFRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG5mdW5jdGlvbiBMaW5rU2V0RmFpbGVkKGxpbmtTZXQsIGV4Yykge1xuICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSBsaW5rU2V0LltbTG9hZGVyXV0uXG4gICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobGlua1NldC5sb2FkZXIpO1xuXG4gICAgLy8+IDIuICBMZXQgbG9hZHMgYmUgYSBjb3B5IG9mIHRoZSBMaXN0IGxpbmtTZXQuW1tMb2Fkc11dLlxuICAgIHZhciBsb2FkcyA9IFNldFRvQXJyYXkobGlua1NldC5sb2Fkcyk7XG5cbiAgICAvLz4gMy4gIEZvciBlYWNoIGxvYWQgaW4gbG9hZHMsXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2Fkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbG9hZCA9IGxvYWRzW2ldO1xuXG4gICAgICAgIC8vPiAgICAgMS4gIEFzc2VydDogbGlua1NldCBpcyBhbiBlbGVtZW50IG9mIHRoZSBMaXN0XG4gICAgICAgIC8vPiAgICAgICAgIGxvYWQuW1tMaW5rU2V0c11dLlxuICAgICAgICBBc3NlcnQoY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfaGFzLCBsb2FkLmxpbmtTZXRzLCBsaW5rU2V0KSk7XG5cbiAgICAgICAgLy8+ICAgICAyLiAgUmVtb3ZlIGxpbmtTZXQgZnJvbSB0aGUgTGlzdCBsb2FkLltbTGlua1NldHNdXS5cbiAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfZGVsZXRlLCBsb2FkLmxpbmtTZXRzLCBsaW5rU2V0KTtcblxuICAgICAgICAvLz4gICAgIDMuICBJZiBsb2FkLltbTGlua1NldHNdXSBpcyBlbXB0eSBhbmQgbG9hZCBpcyBhbiBlbGVtZW50IG9mIHRoZVxuICAgICAgICAvLz4gICAgICAgICBMaXN0IGxvYWRlci5bW0xvYWRzXV0sIHRoZW5cbiAgICAgICAgaWYgKGNhbGxGdW5jdGlvbihzdGRfU2V0X2dldF9zaXplLCBsb2FkLmxpbmtTZXRzKSA9PT0gMCkge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSBsb2FkLm5hbWU7XG4gICAgICAgICAgICBpZiAobmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRMb2FkID1cbiAgICAgICAgICAgICAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfZ2V0LCBsb2FkZXJEYXRhLmxvYWRzLCBuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudExvYWQgPT09IGxvYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8+ICAgICAgICAgMS4gIFJlbW92ZSBsb2FkIGZyb20gdGhlIExpc3QgbG9hZGVyLltbTG9hZHNdXS5cbiAgICAgICAgICAgICAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfZGVsZXRlLCBsb2FkZXJEYXRhLmxvYWRzLCBuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLz4gNC4gIENhbGwgdGhlIFtbQ2FsbF1dIGludGVybmFsIG1ldGhvZCBvZiBsaW5rU2V0LltbUmVqZWN0XV0gcGFzc2luZ1xuICAgIC8vPiAgICAgdW5kZWZpbmVkIGFuZCAoZXhjKSBhcyBhcmd1bWVudHMuXG4gICAgLy8+IDUuICBBc3NlcnQ6IFRoZSBjYWxsIHBlcmZvcm1lZCBieSBzdGVwIDQgY29tcGxldGVkIG5vcm1hbGx5LlxuICAgIHJldHVybiBsaW5rU2V0LnJlamVjdChleGMpO1xufVxuLy8+XG5cblxuLy8+ICMjIyMgRmluaXNoTG9hZChsb2FkZXIsIGxvYWQpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIEZpbmlzaExvYWQgQWJzdHJhY3QgT3BlcmF0aW9uIHJlbW92ZXMgYSBjb21wbGV0ZWQgTG9hZCBSZWNvcmQgZnJvbSBhbGxcbi8vPiBMaW5rU2V0cyBhbmQgY29tbWl0cyB0aGUgbmV3bHkgbG9hZGVkIE1vZHVsZSB0byB0aGUgcmVnaXN0cnkuICBJdCBwZXJmb3Jtc1xuLy8+IHRoZSBmb2xsb3dpbmcgc3RlcHM6XG4vLz5cbmZ1bmN0aW9uIEZpbmlzaExvYWQobG9hZGVyLCBsb2FkKSB7XG4gICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobG9hZGVyKTtcblxuICAgIC8vPiAxLiAgTGV0IG5hbWUgYmUgbG9hZC5bW05hbWVdXS5cbiAgICB2YXIgbmFtZSA9IGxvYWQubmFtZTtcblxuICAgIC8vPiAyLiAgSWYgbmFtZSBpcyBub3QgdW5kZWZpbmVkLCB0aGVuXG4gICAgaWYgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLz4gICAgIDEuICBBc3NlcnQ6IFRoZXJlIGlzIG5vIFJlY29yZCB7W1trZXldXSwgW1t2YWx1ZV1dfSBwIHRoYXQgaXNcbiAgICAgICAgLy8+ICAgICAgICAgYW4gZWxlbWVudCBvZiBsb2FkZXIuW1tNb2R1bGVzXV0sIHN1Y2ggdGhhdCBwLltba2V5XV0gaXNcbiAgICAgICAgLy8+ICAgICAgICAgZXF1YWwgdG8gbG9hZC5bW05hbWVdXS5cbiAgICAgICAgQXNzZXJ0KCFjYWxsRnVuY3Rpb24oc3RkX01hcF9oYXMsIGxvYWRlckRhdGEubW9kdWxlcywgbmFtZSkpO1xuXG4gICAgICAgIC8vPiAgICAgMi4gIEFwcGVuZCB0aGUgUmVjb3JkIHtbW2tleV1dOiBsb2FkLltbTmFtZV1dLCBbW3ZhbHVlXV06XG4gICAgICAgIC8vPiAgICAgICAgIGxvYWQuW1tNb2R1bGVdXX0gYXMgdGhlIGxhc3QgZWxlbWVudCBvZiBsb2FkZXIuW1tNb2R1bGVzXV0uXG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfTWFwX3NldCwgbG9hZGVyRGF0YS5tb2R1bGVzLCBuYW1lLCBsb2FkLm1vZHVsZSk7XG4gICAgfVxuXG4gICAgLy8+IDMuICBJZiBsb2FkIGlzIGFuIGVsZW1lbnQgb2YgdGhlIExpc3QgbG9hZGVyLltbTG9hZHNdXSwgdGhlblxuICAgIHZhciBuYW1lID0gbG9hZC5uYW1lO1xuICAgIGlmIChuYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGV0IGN1cnJlbnRMb2FkID1cbiAgICAgICAgICAgIGNhbGxGdW5jdGlvbihzdGRfTWFwX2dldCwgbG9hZGVyRGF0YS5sb2FkcywgbmFtZSk7XG4gICAgICAgIGlmIChjdXJyZW50TG9hZCA9PT0gbG9hZCkge1xuICAgICAgICAgICAgLy8+ICAgICAxLiAgUmVtb3ZlIGxvYWQgZnJvbSB0aGUgTGlzdCBsb2FkZXIuW1tMb2Fkc11dLlxuICAgICAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfZGVsZXRlLCBsb2FkZXJEYXRhLmxvYWRzLCBuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vPiA0LiAgRm9yIGVhY2ggbGlua1NldCBpbiBsb2FkLltbTGlua1NldHNdXSxcbiAgICB2YXIgbGlua1NldHMgPSBTZXRUb0FycmF5KGxvYWQubGlua1NldHMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlua1NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLy8+ICAgICAxLiAgUmVtb3ZlIGxvYWQgZnJvbSBsaW5rU2V0LltbTG9hZHNdXS5cbiAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfZGVsZXRlLCBsaW5rU2V0c1tpXS5sb2FkcywgbG9hZCk7XG4gICAgfVxuXG4gICAgLy8+IDUuICBSZW1vdmUgYWxsIGVsZW1lbnRzIGZyb20gdGhlIExpc3QgbG9hZC5bW0xpbmtTZXRzXV0uXG4gICAgY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfY2xlYXIsIGxvYWQubGlua1NldHMpO1xufVxuLy8+XG5cblxuLy8gKipUaW1pbmcgYW5kIGdyb3VwaW5nIG9mIGRlcGVuZGVuY2llcyoqICZuZGFzaDsgQ29uc2lkZXJcbi8vXG4vLyAgICAgbG9hZGVyLm1vZHVsZSgnbW9kdWxlIHggZnJvbSBcInhcIjsgbW9kdWxlIHkgZnJvbSBcInlcIjsnKTtcbi8vXG4vLyBUaGUgYWJvdmUgY29kZSBpbXBsaWVzIHRoYXQgd2Ugd2FpdCB0byBldmFsdWF0ZSBcInhcIiB1bnRpbCBcInlcIiBoYXMgYWxzbyBiZWVuXG4vLyBmZXRjaGVkLiBFdmVuIGlmIFwieFwiIHR1cm5zIG91dCB0byBiZSBsaW5rYWJsZSBhbmQgcnVubmFibGUsIGl0cyBkZXBlbmRlbmNpZXNcbi8vIGFyZSBhbGwgc2F0aXNmaWVkLCBpdCBsaW5rcyBjb3JyZWN0bHksIGFuZCBpdCBoYXMgbm8gZGlyZWN0IG9yIGluZGlyZWN0XG4vLyBkZXBlbmRlbmN5IG9uIFwieVwiLCB3ZSBzdGlsbCB3YWl0LlxuLy9cbi8vICpSYXRpb25hbGU6KiBEZXBlbmRlbmNpZXMgY291bGQgYmUgaW5pdGlhbGl6ZWQgbW9yZSBlYWdlcmx5LCBidXQgdGhlIG9yZGVyXG4vLyB3b3VsZCBiZSBsZXNzIGRldGVybWluaXN0aWMuIFRoZSBkZXNpZ24gb3B0cyBmb3IgYSBiaXQgbW9yZSBkZXRlcm1pbmlzbSBpblxuLy8gY29tbW9uIGNhc2VzJm1kYXNoO3Rob3VnaCBpdCBpcyBzdGlsbCBwb3NzaWJsZSB0byB0cmlnZ2VyIG5vbi1kZXRlcm1pbmlzbVxuLy8gc2luY2UgbXVsdGlwbGUgbGluayBzZXRzIGNhbiBiZSBpbi1mbGlnaHQgYXQgb25jZS5cblxuXG4vLyAjIyBNb2R1bGUgbG9hZGluZyBlbnRyeSBwb2ludHNcblxuLy8+ICMjIyMgTG9hZE1vZHVsZShsb2FkZXIsIG5hbWUsIG9wdGlvbnMpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIExvYWRNb2R1bGUobG9hZGVyLCBuYW1lLCBvcHRpb25zKSB7XG4gICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobG9hZGVyKTtcblxuICAgIC8vPiAxLiAgTGV0IG5hbWUgYmUgVG9TdHJpbmcobmFtZSkuXG4gICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChuYW1lKS5cbiAgICBuYW1lID0gVG9TdHJpbmcobmFtZSk7XG5cbiAgICAvLz4gMS4gIExldCBhZGRyZXNzIGJlIEdldE9wdGlvbihvcHRpb25zLCBgXCJhZGRyZXNzXCJgKS5cbiAgICAvLz4gMS4gIFJldHVybklmQWJydXB0KGFkZHJlc3MpLlxuICAgIHZhciBhZGRyZXNzID0gR2V0T3B0aW9uKG9wdGlvbnMsIFwiYWRkcmVzc1wiKTtcblxuICAgIC8vPiAxLiAgTGV0IEYgYmUgYSBuZXcgYW5vbnltb3VzIGZ1bmN0aW9uIG9iamVjdCBhcyBkZWZpbmVkIGluXG4gICAgLy8+ICAgICBBc3luY1N0YXJ0TG9hZFBhcnR3YXlUaHJvdWdoLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tMb2FkZXJdXSB0byBsb2FkZXIuXG4gICAgLy8+IDEuICBTZXQgRi5bW01vZHVsZU5hbWVdXSB0byBuYW1lLlxuICAgIC8vPiAxLiAgSWYgYWRkcmVzcyBpcyB1bmRlZmluZWQsIHNldCBGLltbU3RlcF1dIHRvIGBcImxvY2F0ZVwiYC5cbiAgICAvLz4gMS4gIEVsc2UsIHNldCBGLltbU3RlcF1dIHRvIGBcImZldGNoXCJgLlxuICAgIC8vPiAxLiAgTGV0IG1ldGFkYXRhIGJlIHRoZSByZXN1bHQgb2YgT2JqZWN0Q3JlYXRlKCVPYmplY3RQcm90b3R5cGUlLFxuICAgIC8vPiAgICAgKCkpLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tNb2R1bGVNZXRhZGF0YV1dIHRvIG1ldGFkYXRhLlxuICAgIC8vPiAxLiAgU2V0IEYuW1tNb2R1bGVTb3VyY2VdXSB0byB1bmRlZmluZWQuXG4gICAgLy8+IDEuICBTZXQgRi5bW01vZHVsZUFkZHJlc3NdXSB0byBhZGRyZXNzLlxuICAgIHZhciBGID0gTWFrZUNsb3N1cmVfQXN5bmNTdGFydExvYWRQYXJ0d2F5VGhyb3VnaChcbiAgICAgICAgbG9hZGVyLCBsb2FkZXJEYXRhLCBuYW1lLFxuICAgICAgICBhZGRyZXNzID09PSB1bmRlZmluZWQgPyBcImxvY2F0ZVwiIDogXCJmZXRjaFwiLFxuICAgICAgICB7fSwgYWRkcmVzcywgdW5kZWZpbmVkKTtcblxuICAgIC8vPiAxLiAgUmV0dXJuIHRoZSByZXN1bHQgb2YgY2FsbGluZyBPcmRpbmFyeUNvbnN0cnVjdCglUHJvbWlzZSUsIChGKSkuXG4gICAgcmV0dXJuIG5ldyBzdGRfUHJvbWlzZShGKTtcbn1cbi8vPlxuXG4vLz4gIyMjIEFzeW5jU3RhcnRMb2FkUGFydHdheVRocm91Z2ggRnVuY3Rpb25zXG4vLz5cbi8vPiBBbiBBc3luY1N0YXJ0TG9hZFBhcnR3YXlUaHJvdWdoIGZ1bmN0aW9uIGlzIGFuIGFub255bW91cyBmdW5jdGlvbiB0aGF0XG4vLz4gY3JlYXRlcyBhIG5ldyBMb2FkIFJlY29yZCBhbmQgcG9wdWxhdGVzIGl0IHdpdGggc29tZSBpbmZvcm1hdGlvbiBwcm92aWRlZFxuLy8+IGJ5IHRoZSBjYWxsZXIsIHNvIHRoYXQgbG9hZGluZyBjYW4gcHJvY2VlZCBmcm9tIGVpdGhlciB0aGUgYGxvY2F0ZWAgaG9vayxcbi8vPiB0aGUgYGZldGNoYCBob29rLCBvciB0aGUgYHRyYW5zbGF0ZWAgaG9vay4gVGhpcyBmdW5jdGlvbmFsaXR5IGlzIHVzZWQgdG9cbi8vPiBpbXBsZW1lbnQgYnVpbHRpbiBtZXRob2RzIGxpa2UgYExvYWRlci5wcm90b3R5cGUubG9hZGAsIHdoaWNoIHBlcm1pdHMgdGhlXG4vLz4gdXNlciB0byBzcGVjaWZ5IGJvdGggdGhlIG5vcm1hbGl6ZWQgbW9kdWxlIG5hbWUgYW5kIHRoZSBhZGRyZXNzLlxuLy8+XG4vLz4gRWFjaCBBc3luY1N0YXJ0TG9hZFBhcnR3YXlUaHJvdWdoIGZ1bmN0aW9uIGhhcyBpbnRlcm5hbCBzbG90cyBbW0xvYWRlcl1dLFxuLy8+IFtbTW9kdWxlTmFtZV1dLCBbW1N0ZXBdXSwgW1tNb2R1bGVNZXRhZGF0YV1dLCBbW01vZHVsZUFkZHJlc3NdXSwgYW5kXG4vLz4gW1tNb2R1bGVTb3VyY2VdXS5cbi8vPlxuLy8+IFdoZW4gYW4gQXN5bmNTdGFydExvYWRQYXJ0d2F5VGhyb3VnaCBmdW5jdGlvbiBGIGlzIGNhbGxlZCB3aXRoIGFyZ3VtZW50c1xuLy8+IHJlc29sdmUgYW5kIHJlamVjdCwgdGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1ha2VDbG9zdXJlX0FzeW5jU3RhcnRMb2FkUGFydHdheVRocm91Z2goXG4gICAgbG9hZGVyLCBsb2FkZXJEYXRhLCBuYW1lLCBzdGVwLCBtZXRhZGF0YSwgYWRkcmVzcywgc291cmNlKVxue1xuICAgIHJldHVybiBmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSBGLltbTG9hZGVyXV0uXG4gICAgICAgIC8vPiAxLiAgTGV0IG5hbWUgYmUgRi5bW01vZHVsZU5hbWVdXS5cbiAgICAgICAgLy8+IDEuICBMZXQgc3RlcCBiZSBGLltbU3RlcF1dLlxuICAgICAgICAvLz4gMS4gIExldCBtZXRhZGF0YSBiZSBGLltbTW9kdWxlTWV0YWRhdGFdXS5cbiAgICAgICAgLy8+IDEuICBMZXQgYWRkcmVzcyBiZSBGLltbTW9kdWxlQWRkcmVzc11dLlxuICAgICAgICAvLz4gMS4gIExldCBzb3VyY2UgYmUgRi5bW01vZHVsZVNvdXJjZV1dLlxuXG4gICAgICAgIC8vPiAxLiAgSWYgbG9hZGVyLltbTW9kdWxlc11dIGNvbnRhaW5zIGFuIGVudHJ5IHdob3NlIFtba2V5XV0gaXMgZXF1YWxcbiAgICAgICAgLy8+ICAgICB0byBuYW1lLCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgIGlmIChjYWxsRnVuY3Rpb24oc3RkX01hcF9oYXMsIGxvYWRlckRhdGEubW9kdWxlcywgbmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXG4gICAgICAgICAgICAgICAgXCJjYW4ndCBkZWZpbmUgbW9kdWxlIFxcXCJcIiArIG5hbWUgKyBcIlxcXCI6IGFscmVhZHkgbG9hZGVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8+IDEuICBJZiBsb2FkZXIuW1tMb2Fkc11dIGNvbnRhaW5zIGEgTG9hZCBSZWNvcmQgd2hvc2UgW1tOYW1lXV0gZmllbGRcbiAgICAgICAgLy8+ICAgICBpcyBlcXVhbCB0byBuYW1lLCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgIGlmIChjYWxsRnVuY3Rpb24oc3RkX01hcF9oYXMsIGxvYWRlckRhdGEubG9hZHMsIG5hbWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgIFwiY2FuJ3QgZGVmaW5lIG1vZHVsZSBcXFwiXCIgKyBuYW1lICsgXCJcXFwiOiBhbHJlYWR5IGxvYWRpbmdcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLz4gMS4gIExldCBsb2FkIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgQ3JlYXRlTG9hZCBhYnN0cmFjdFxuICAgICAgICAvLz4gICAgIG9wZXJhdGlvbiBwYXNzaW5nIG5hbWUgYXMgdGhlIHNpbmdsZSBhcmd1bWVudC5cbiAgICAgICAgbGV0IGxvYWQgPSBDcmVhdGVMb2FkKG5hbWUpO1xuXG4gICAgICAgIC8vPiAxLiAgU2V0IGxvYWQuW1tNZXRhZGF0YV1dIHRvIG1ldGFkYXRhLlxuICAgICAgICBsb2FkLm1ldGFkYXRhID0gbWV0YWRhdGE7XG5cbiAgICAgICAgLy8+IDEuICBMZXQgbGlua1NldCBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlIENyZWF0ZUxpbmtTZXQgYWJzdHJhY3RcbiAgICAgICAgLy8+ICAgICBvcGVyYXRpb24gcGFzc2luZyBsb2FkZXIgYW5kIGxvYWQgYXMgYXJndW1lbnRzLlxuICAgICAgICBsZXQgbGlua1NldCA9IENyZWF0ZUxpbmtTZXQobG9hZGVyLCBsb2FkKTtcblxuICAgICAgICAvLz4gMS4gIEFkZCBsb2FkIHRvIHRoZSBMaXN0IGxvYWRlci5bW0xvYWRzXV0uXG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfTWFwX3NldCwgbG9hZGVyRGF0YS5sb2FkcywgbmFtZSwgbG9hZCk7XG5cbiAgICAgICAgLy8+IDEuICBDYWxsIHRoZSBbW0NhbGxdXSBpbnRlcm5hbCBtZXRob2Qgb2YgcmVzb2x2ZSB3aXRoIGFyZ3VtZW50c1xuICAgICAgICAvLz4gICAgIG51bGwgYW5kIChsaW5rU2V0LltbRG9uZV1dKS5cbiAgICAgICAgcmVzb2x2ZShsaW5rU2V0LmRvbmUpO1xuXG4gICAgICAgIC8vPiAxLiAgSWYgc3RlcCBpcyBgXCJsb2NhdGVcImAsXG4gICAgICAgIGlmIChzdGVwID09IFwibG9jYXRlXCIpIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIENhbGwgUHJvY2VlZFRvTG9jYXRlKGxvYWRlciwgbG9hZCkuXG4gICAgICAgICAgICBQcm9jZWVkVG9Mb2NhdGUobG9hZGVyLCBsb2FkKTtcbiAgICAgICAgLy8+IDEuICBFbHNlIGlmIHN0ZXAgaXMgYFwiZmV0Y2hcImAsXG4gICAgICAgIH0gZWxzZSBpZiAoc3RlcCA9PSBcImZldGNoXCIpIHtcbiAgICAgICAgICAgIC8vPiAgICAgMS4gIExldCBhZGRyZXNzUHJvbWlzZSBiZSBQcm9taXNlT2YoYWRkcmVzcykuXG4gICAgICAgICAgICAvLz4gICAgIDEuICBDYWxsIFByb2NlZWRUb0ZldGNoKGxvYWRlciwgbG9hZCwgYWRkcmVzc1Byb21pc2UpLlxuICAgICAgICAgICAgUHJvY2VlZFRvRmV0Y2gobG9hZGVyLCBsb2FkLCBQcm9taXNlT2YoYWRkcmVzcykpO1xuICAgICAgICAvLz4gMS4gIEVsc2UsXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLz4gICAgIDEuICBBc3NlcnQ6IHN0ZXAgaXMgYFwidHJhbnNsYXRlXCJgLlxuICAgICAgICAgICAgJEFzc2VydChzdGVwID09IFwidHJhbnNsYXRlXCIpO1xuXG4gICAgICAgICAgICAvLz4gICAgIDEuICBTZXQgbG9hZC5bW0FkZHJlc3NdXSB0byBhZGRyZXNzLlxuICAgICAgICAgICAgbG9hZC5hZGRyZXNzID0gYWRkcmVzcztcblxuICAgICAgICAgICAgLy8+ICAgICAxLiAgTGV0IHNvdXJjZVByb21pc2UgYmUgUHJvbWlzZU9mKHNvdXJjZSkuXG4gICAgICAgICAgICB2YXIgc291cmNlUHJvbWlzZSA9IFByb21pc2VPZihzb3VyY2UpO1xuXG4gICAgICAgICAgICAvLz4gICAgIDEuICBDYWxsIFByb2NlZWRUb1RyYW5zbGF0ZShsb2FkZXIsIGxvYWQsIHNvdXJjZVByb21pc2UpLlxuICAgICAgICAgICAgUHJvY2VlZFRvVHJhbnNsYXRlKGxvYWRlciwgbG9hZCwgc291cmNlUHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5cbi8vPiAjIyMgRXZhbHVhdGVMb2FkZWRNb2R1bGUgRnVuY3Rpb25zXG4vLz5cbi8vPiBBbiBFdmFsdWF0ZUxvYWRlZE1vZHVsZSBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIGJ5XG4vLz4gTG9hZGVyLnByb3RvdHlwZS5tb2R1bGUgYW5kIExvYWRlci5wcm90b3R5cGUuaW1wb3J0IHRvIGVuc3VyZSB0aGF0IGEgbW9kdWxlXG4vLz4gaGFzIGJlZW4gZXZhbHVhdGVkIGJlZm9yZSBpdCBpcyBwYXNzZWQgdG8gc2NyaXB0IGNvZGUuXG4vLz5cbi8vPiBFYWNoIEV2YWx1YXRlTG9hZGVkTW9kdWxlIGZ1bmN0aW9uIGhhcyBhIFtbTG9hZGVyXV0gaW50ZXJuYWwgc2xvdC5cbi8vPlxuLy8+IFdoZW4gYSBFdmFsdWF0ZUxvYWRlZE1vZHVsZSBmdW5jdGlvbiBGIGlzIGNhbGxlZCwgdGhlIGZvbGxvd2luZyBzdGVwcyBhcmVcbi8vPiB0YWtlbjpcbi8vPlxuZnVuY3Rpb24gTWFrZUNsb3N1cmVfRXZhbHVhdGVMb2FkZWRNb2R1bGUobG9hZGVyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChsb2FkKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSBGLltbTG9hZGVyXV0uXG5cbiAgICAgICAgLy8+IDIuICBBc3NlcnQ6IGxvYWQuW1tTdGF0dXNdXSBpcyBgXCJsaW5rZWRcImAuXG4gICAgICAgIEFzc2VydChsb2FkLnN0YXR1cyA9PT0gXCJsaW5rZWRcIik7XG5cbiAgICAgICAgLy8+IDMuICBMZXQgbW9kdWxlIGJlIGxvYWQuW1tNb2R1bGVdXS5cbiAgICAgICAgdmFyIG1vZHVsZSA9IGxvYWQubW9kdWxlO1xuXG4gICAgICAgIC8vPiA0LiAgTGV0IHJlc3VsdCBiZSB0aGUgcmVzdWx0IG9mIEVuc3VyZUV2YWx1YXRlZChtb2R1bGUsICgpLFxuICAgICAgICAvLz4gICAgIGxvYWRlcikuXG4gICAgICAgIC8vPiA1LiAgUmV0dXJuSWZBYnJ1cHQocmVzdWx0KS5cbiAgICAgICAgRW5zdXJlRXZhbHVhdGVkSGVscGVyKG1vZHVsZSwgbG9hZGVyKTtcblxuICAgICAgICAvLz4gNi4gIFJldHVybiBtb2R1bGUuXG4gICAgICAgIHJldHVybiBtb2R1bGU7XG4gICAgfTtcbiAgICAvLz5cbn1cblxuXG5cbi8vPiAjIyBNb2R1bGUgTGlua2luZ1xuLy8+XG4vL1xuLy8gUGxlYXNlIHNlZSBzcGVjcy9saW5raW5nLmRvY3guXG4vL1xuLy8gSGVyZSB3ZSBpbmNsdWRlIGEgc3R1YiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgTGluayBmdW5jdGlvbiBkZXNjcmliZWRcbi8vIGluIHRoZSBzcGVjaWZpY2F0aW9uIHRoYXQgaXMgZ29vZCBlbm91Z2ggdG8gcGFzcyBzb21lIHRyaXZpYWwgdGVzdHMuXG4vL1xuZnVuY3Rpb24gTGluayhsb2FkcywgbG9hZGVyKSB7XG4gICAgbG9hZHMgPSBTZXRUb0FycmF5KGxvYWRzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvYWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsb2Fkc1tpXS5raW5kICE9PSBcImR5bmFtaWNcIilcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbEVycm9yKFwiTW9kdWxlIGxpbmtpbmcgaXMgbm90IGltcGxlbWVudGVkLlwiKTtcbiAgICB9XG5cbiAgICBMaW5rRHluYW1pY01vZHVsZXMobG9hZHMsIGxvYWRlcik7XG59XG5cbmZ1bmN0aW9uIExpbmtEeW5hbWljTW9kdWxlcyhsb2FkcywgbG9hZGVyKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2Fkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbG9hZCA9IGxvYWRzW2ldO1xuICAgICAgICB2YXIgbW9kID0gY2FsbEZ1bmN0aW9uKGxvYWQuZXhlY3V0ZSwgdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKCEkSXNNb2R1bGUobW9kKSlcbiAgICAgICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXCJmYWN0b3J5LmV4ZWN1dGUgY2FsbGJhY2sgbXVzdCByZXR1cm4gYSBNb2R1bGUgb2JqZWN0XCIpO1xuICAgICAgICBsb2FkLm1vZHVsZSA9IG1vZDtcbiAgICAgICAgbG9hZC5zdGF0dXMgPSBcImxpbmtlZFwiO1xuICAgICAgICBGaW5pc2hMb2FkKGxvYWRlciwgbG9hZCk7XG4gICAgfVxufVxuXG4vLz4gIyMgTW9kdWxlIEV2YWx1YXRpb25cbi8vPlxuLy8+IE1vZHVsZSBib2RpZXMgYXJlIGV2YWx1YXRlZCBvbiBkZW1hbmQsIGFzIGxhdGUgYXMgcG9zc2libGUuICBUaGUgbG9hZGVyXG4vLz4gdXNlcyB0aGUgZnVuY3Rpb24gYEVuc3VyZUV2YWx1YXRlZGAsIGRlZmluZWQgYmVsb3csIHRvIHJ1biBzY3JpcHRzLiAgVGhlXG4vLz4gbG9hZGVyIGFsd2F5cyBjYWxscyBgRW5zdXJlRXZhbHVhdGVkYCBiZWZvcmUgcmV0dXJuaW5nIGEgTW9kdWxlIG9iamVjdCB0b1xuLy8+IHVzZXIgY29kZS5cbi8vPlxuLy8+IFRoZXJlIGlzIG9uZSB3YXkgYSBtb2R1bGUgY2FuIGJlIGV4cG9zZWQgdG8gc2NyaXB0IGJlZm9yZSBpdHMgYm9keSBoYXMgYmVlblxuLy8+IGV2YWx1YXRlZC4gIEluIHRoZSBjYXNlIG9mIGFuIGltcG9ydCBjeWNsZSwgd2hpY2hldmVyIG1vZHVsZSBpcyBldmFsdWF0ZWRcbi8vPiBmaXJzdCBjYW4gb2JzZXJ2ZSB0aGUgb3RoZXJzIGJlZm9yZSB0aGV5IGFyZSBldmFsdWF0ZWQuICBTaW1wbHkgcHV0LCB3ZVxuLy8+IGhhdmUgdG8gc3RhcnQgc29tZXdoZXJlOiBvbmUgb2YgdGhlIG1vZHVsZXMgaW4gdGhlIGN5Y2xlIG11c3QgcnVuIGJlZm9yZVxuLy8+IHRoZSBvdGhlcnMuXG5cblxuLy8+ICMjIyBFbnN1cmVFdmFsdWF0ZWQobW9kLCBzZWVuLCBsb2FkZXIpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIGFic3RyYWN0IG9wZXJhdGlvbiBFbnN1cmVFdmFsdWF0ZWQgd2Fsa3MgdGhlIGRlcGVuZGVuY3kgZ3JhcGggb2YgdGhlXG4vLz4gbW9kdWxlIG1vZCwgZXZhbHVhdGluZyBhbnkgbW9kdWxlIGJvZGllcyB0aGF0IGhhdmUgbm90IGFscmVhZHkgYmVlblxuLy8+IGV2YWx1YXRlZCAoaW5jbHVkaW5nLCBmaW5hbGx5LCBtb2QgaXRzZWxmKS4gIE1vZHVsZXMgYXJlIGV2YWx1YXRlZCBpblxuLy8+IGRlcHRoLWZpcnN0LCBsZWZ0LXRvLXJpZ2h0LCBwb3N0IG9yZGVyLCBzdG9wcGluZyBhdCBjeWNsZXMuXG4vLz5cbi8vPiBtb2QgYW5kIGl0cyBkZXBlbmRlbmNpZXMgbXVzdCBhbHJlYWR5IGJlIGxpbmtlZC5cbi8vPlxuLy8+IFRoZSBMaXN0IHNlZW4gaXMgdXNlZCB0byBkZXRlY3QgY3ljbGVzLiBtb2QgbXVzdCBub3QgYWxyZWFkeSBiZSBpbiB0aGUgTGlzdFxuLy8+IHNlZW4uXG4vLz5cbi8vPiBPbiBzdWNjZXNzLCBtb2QgYW5kIGFsbCBpdHMgZGVwZW5kZW5jaWVzLCB0cmFuc2l0aXZlbHksIHdpbGwgaGF2ZSBzdGFydGVkXG4vLz4gdG8gZXZhbHVhdGUgZXhhY3RseSBvbmNlLlxuLy8+XG4vLz4gRW5zdXJlRXZhbHVhdGVkIHBlcmZvcm1zIHRoZSBmb2xsb3dpbmcgc3RlcHM6XG4vLz5cbmZ1bmN0aW9uIEVuc3VyZUV2YWx1YXRlZChtb2QsIHNlZW4sIGxvYWRlckRhdGEpIHtcbiAgICAvLz4gMS4gQXBwZW5kIG1vZCBhcyB0aGUgbGFzdCBlbGVtZW50IG9mIHNlZW4uXG4gICAgY2FsbEZ1bmN0aW9uKHN0ZF9TZXRfYWRkLCBzZWVuLCBtb2QpO1xuXG4gICAgLy8+IDIuIExldCBkZXBzIGJlIG1vZC5bW0RlcGVuZGVuY2llc11dLlxuICAgIGxldCBkZXBzID0gJEdldERlcGVuZGVuY2llcyhtb2QpO1xuICAgIGlmIChkZXBzID09PSB1bmRlZmluZWQpXG4gICAgICAgIHJldHVybjsgIC8vIEFuIG9wdGltaXphdGlvbi4gU2VlIHRoZSBjb21tZW50IGJlbG93LlxuXG4gICAgLy8+IDMuIEZvciBlYWNoIHBhaXIgaW4gZGVwcywgaW4gTGlzdCBvcmRlcixcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLy8+ICAgICAxLiAgTGV0IGRlcCBiZSBwYWlyLltbdmFsdWVdXS5cbiAgICAgICAgbGV0IGRlcCA9IGRlcHNbaV07XG5cbiAgICAgICAgLy8+ICAgICAyLiBJZiBkZXAgaXMgbm90IGFuIGVsZW1lbnQgb2Ygc2VlbiwgdGhlblxuICAgICAgICBpZiAoIWNhbGxGdW5jdGlvbihzdGRfU2V0X2hhcywgc2VlbiwgZGVwKSkge1xuICAgICAgICAgICAgLy8+ICAgICAgICAgMS4gQ2FsbCBFbnN1cmVFdmFsdWF0ZWQgd2l0aCB0aGUgYXJndW1lbnRzIGRlcCwgc2VlbixcbiAgICAgICAgICAgIC8vPiAgICAgICAgICAgIGFuZCBsb2FkZXIuXG4gICAgICAgICAgICBFbnN1cmVFdmFsdWF0ZWQoZGVwLCBzZWVuLCBsb2FkZXJEYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vPiA0LiBJZiBtb2QuW1tCb2R5XV0gaXMgbm90IHVuZGVmaW5lZCBhbmQgbW9kLltbRXZhbHVhdGVkXV0gaXMgZmFsc2UsXG4gICAgaWYgKCEkSGFzQmVlbkV2YWx1YXRlZChtb2QpKSB7XG4gICAgICAgIC8vPiAgICAgMS4gU2V0IG1vZC5bW0V2YWx1YXRlZF1dIHRvIHRydWUuXG4gICAgICAgIC8vPiAgICAgMi4gTGV0IGluaXRDb250ZXh0IGJlIGEgbmV3IEVDTUFTY3JpcHQgY29kZSBleGVjdXRpb24gY29udGV4dC5cbiAgICAgICAgLy8+ICAgICAzLiBTZXQgaW5pdENvbnRleHQncyBSZWFsbSB0byBsb2FkZXIuW1tSZWFsbV1dLlxuICAgICAgICAvLz4gICAgIDQuIFNldCBpbml0Q29udGV4dCdzIFZhcmlhYmxlRW52aXJvbm1lbnQgdG8gbW9kLltbRW52aXJvbm1lbnRdXS5cbiAgICAgICAgLy8+ICAgICA1LiBTZXQgaW5pdENvbnRleHQncyBMZXhpY2FsRW52aXJvbm1lbnQgdG8gbW9kLltbRW52aXJvbm1lbnRdXS5cbiAgICAgICAgLy8+ICAgICA2LiBJZiB0aGVyZSBpcyBhIGN1cnJlbnRseSBydW5uaW5nIGV4ZWN1dGlvbiBjb250ZXh0LCBzdXNwZW5kIGl0LlxuICAgICAgICAvLz4gICAgIDcuIFB1c2ggaW5pdENvbnRleHQgb24gdG8gdGhlIGV4ZWN1dGlvbiBjb250ZXh0IHN0YWNrOyBpbml0Q29udGV4dCBpc1xuICAgICAgICAvLz4gICAgICAgICBub3cgdGhlIHJ1bm5pbmcgZXhlY3V0aW9uIGNvbnRleHQuXG4gICAgICAgIC8vPiAgICAgOC4gTGV0IHIgYmUgdGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIG1vZC5bW0JvZHldXS5cbiAgICAgICAgLy8+ICAgICA5LiBTdXNwZW5kIGluaXRDb250ZXh0IGFuZCByZW1vdmUgaXQgZnJvbSB0aGUgZXhlY3V0aW9uIGNvbnRleHQgc3RhY2suXG4gICAgICAgIC8vPiAgICAgMTAuIFJlc3VtZSB0aGUgY29udGV4dCwgaWYgYW55LCB0aGF0IGlzIG5vdyBvbiB0aGUgdG9wIG9mIHRoZSBleGVjdXRpb25cbiAgICAgICAgLy8+ICAgICAgICAgY29udGV4dCBzdGFjayBhcyB0aGUgcnVubmluZyBleGVjdXRpb24gY29udGV4dC5cbiAgICAgICAgLy8+ICAgICAxMS4gUmV0dXJuSWZBYnJ1cHQocikuXG4gICAgICAgICRFdmFsdWF0ZU1vZHVsZUJvZHkobG9hZGVyRGF0YS5yZWFsbSwgbW9kKTtcbiAgICB9XG59XG4vLz5cbi8vICoqU2F2aW5nIHdvcmsqKiAmbmRhc2g7IFRoaXMgaW1wbGVtZW50YXRpb24gb3B0aW1pemVzIGF3YXkgZnV0dXJlXG4vLyBFbnN1cmVFdmFsdWF0ZWQgcGFzc2VzIGJ5IGNsZWFyaW5nIG1vZC5bW0RlcGVuZGVuY2llc11dIGZvciBhbGwgbW9kdWxlcyBpblxuLy8gdGhlIGRlcGVuZGVuY3kgdHJlZSB3aGVuIEVuc3VyZUV2YWx1YXRlZEhlbHBlciBmaW5pc2hlcyBzdWNjZXNzZnVsbHkuXG4vL1xuLy8gU28gaW4gdGhlIHBhcnQgb2YgdGhlIGNvZGUgdGhhdCBpbXBsZW1lbnRzIHN0ZXAgMiwgYGRlcHNgIGlzIHVuZGVmaW5lZCBpZmZcbi8vIGVpdGhlciAoYSkgYSBwcmV2aW91cyBFbnN1cmVFdmFsdWF0ZWRIZWxwZXIgY2FsbCBhbHJlYWR5IGV2YWx1YXRlZCB0aGVcbi8vIG1vZHVsZSBhbmQgYWxsIGl0cyBkZXBlbmRlbmNpZXM7IG9yIChiKSBtb2Qgd2FzIGNyZWF0ZWQgdmlhIHRoZSBgTW9kdWxlKClgXG4vLyBjb25zdHJ1Y3RvciByYXRoZXIgdGhhbiBmcm9tIGEgc2NyaXB0LlxuLy9cbi8vICoqRXhjZXB0aW9ucyBkdXJpbmcgZXZhbHVhdGlvbioqICZuZGFzaDsgTW9kdWxlIGJvZGllcyBjYW4gdGhyb3cgZXhjZXB0aW9ucyxcbi8vIHdoaWNoIGFyZSBwcm9wYWdhdGVkIHRvIHRoZSBjYWxsZXIuXG4vL1xuLy8gV2hlbiB0aGlzIGhhcHBlbnMsIHdlIGxlYXZlIHRoZSBtb2R1bGUgaW4gdGhlIHJlZ2lzdHJ5IChwZXIgc2FtdGgsIDIwMTNcbi8vIEFwcmlsIDE2KSBiZWNhdXNlIHJlLWxvYWRpbmcgdGhlIG1vZHVsZSBhbmQgcnVubmluZyBpdCBhZ2FpbiBpcyBub3QgbGlrZWx5XG4vLyB0byBtYWtlIHRoaW5ncyBiZXR0ZXIuXG4vL1xuLy8gT3RoZXIgZnVsbHkgbGlua2VkIG1vZHVsZXMgaW4gdGhlIHNhbWUgTGlua1NldCBhcmUgYWxzbyBsZWZ0IGluIHRoZSByZWdpc3RyeVxuLy8gKHBlciBkaGVybWFuLCAyMDEzIEFwcmlsIDE4KS4gIFNvbWUgb2YgdGhvc2UgbWF5IGJlIHVucmVsYXRlZCB0byB0aGUgbW9kdWxlXG4vLyB0aGF0IHRocmV3LiAgU2luY2UgdGhlaXIgXCJoYXMgZXZlciBzdGFydGVkIGJlaW5nIGV2YWx1YXRlZFwiIGJpdCBpcyBub3QgeWV0XG4vLyBzZXQsIHRoZXkgd2lsbCBiZSBldmFsdWF0ZWQgb24gZGVtYW5kLiAgVGhpcyBhbGxvd3MgdW5yZWxhdGVkIG1vZHVsZXMgdG9cbi8vIGZpbmlzaCBsb2FkaW5nIGFuZCBpbml0aWFsaXppbmcgc3VjY2Vzc2Z1bGx5LCBpZiB0aGV5IGFyZSBuZWVkZWQuXG4vL1xuLy8gKipOZXN0aW5nKiogJm5kYXNoOyBXaGlsZSBldmFsdWF0aW5nIGEgbW9kdWxlIGJvZHksIGNhbGxpbmcgYGV2YWwoKWAgb3Jcbi8vIGBTeXN0ZW0uZ2V0KClgIGNhbiBjYXVzZSBvdGhlciBtb2R1bGUgYm9kaWVzIHRvIGJlIGV2YWx1YXRlZC4gIFRoYXQgaXMsXG4vLyBtb2R1bGUgYm9keSBldmFsdWF0aW9uIGNhbiBuZXN0LiAgSG93ZXZlciBubyBpbmRpdmlkdWFsIG1vZHVsZSdzIGJvZHkgd2lsbFxuLy8gYmUgZXZhbHVhdGVkIG1vcmUgdGhhbiBvbmNlLlxuLy9cbi8vICoqV2h5IHRoZSBncmFwaCB3YWxrIGRvZXNuJ3Qgc3RvcCBhdCBhbHJlYWR5LWV2YWx1YXRlZCBtb2R1bGVzKiogJm5kYXNoO1xuLy8gSXQncyBhIG1hdHRlciBvZiBjb3JyZWN0bmVzcy4gIEhlcmUgaXMgdGhlIHRlc3QgY2FzZTpcbi8vXG4vLyAgICAgLy8gbW9kdWxlIFwieFwiXG4vLyAgICAgaW1wb3J0IHkgZnJvbSBcInlcIjtcbi8vICAgICB0aHJvdyBmaXQ7XG4vL1xuLy8gICAgIC8vIG1vZHVsZSBcInlcIlxuLy8gICAgIGltcG9ydCB4IGZyb20gXCJ4XCI7XG4vLyAgICAgZ2xvYmFsLm9rID0gdHJ1ZTtcbi8vXG4vLyAgICAgLy8gYW5vbnltb3VzIG1vZHVsZSAjMVxuLy8gICAgIG1vZHVsZSB5IGZyb20gXCJ5XCI7ICAvLyBtYXJrcyBcInhcIiBhcyBldmFsdWF0ZWQsIGJ1dCBub3QgXCJ5XCJcbi8vXG4vLyAgICAgLy8gYW5vbnltb3VzIG1vZHVsZSAjMlxuLy8gICAgIG1vZHVsZSB4IGZyb20gXCJ4XCI7ICAvLyBtdXN0IGV2YWx1YXRlIFwieVwiIGJ1dCBub3QgXCJ4XCJcbi8vXG4vLyBXaGVuIHdlIGBFbnN1cmVFdmFsdWF0ZWRgIGFub255bW91cyBtb2R1bGUgIzIsIG1vZHVsZSBgeGAgaXMgYWxyZWFkeSBtYXJrZWRcbi8vIGFzIGV2YWx1YXRlZCwgYnV0IG9uZSBvZiBpdHMgZGVwZW5kZW5jaWVzLCBgeWAsIGlzbid0LiAgSW4gb3JkZXIgdG8gYWNoaWV2ZVxuLy8gdGhlIGRlc2lyZWQgcG9zdGNvbmRpdGlvbiwgd2UgbXVzdCBmaW5kIGB5YCBhbnl3YXkgYW5kIGV2YWx1YXRlIGl0LlxuLy9cbi8vIEN5Y2xpYyBpbXBvcnRzLCBjb21iaW5lZCB3aXRoIGV4Y2VwdGlvbnMgZHVyaW5nIG1vZHVsZSBldmFsdWF0aW9uXG4vLyBpbnRlcnJ1cHRpbmcgdGhpcyBhbGdvcml0aG0sIGFyZSB0aGUgY3VscHJpdC5cbi8vXG4vLyBUaGUgcmVtZWR5OiB3aGVuIHdhbGtpbmcgdGhlIGRlcGVuZGVuY3kgZ3JhcGgsIGRvIG5vdCBzdG9wIGF0XG4vLyBhbHJlYWR5LW1hcmtlZC1ldmFsdWF0ZWQgbW9kdWxlcy5cbi8vXG5cbmZ1bmN0aW9uIEVuc3VyZUV2YWx1YXRlZEhlbHBlcihtb2QsIGxvYWRlcikge1xuICAgIGxldCBzZWVuID0gQ3JlYXRlU2V0KCk7XG4gICAgbGV0IGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEobG9hZGVyKTtcbiAgICBFbnN1cmVFdmFsdWF0ZWQobW9kLCBzZWVuLCBsb2FkZXJEYXRhKTtcblxuICAgIC8vIEFsbCBldmFsdWF0aW9uIHN1Y2NlZWRlZC4gQXMgYW4gb3B0aW1pemF0aW9uIGZvciBmdXR1cmUgRW5zdXJlRXZhbHVhdGVkXG4gICAgLy8gY2FsbHMsIGRyb3AgdGhpcyBwb3J0aW9uIG9mIHRoZSBkZXBlbmRlbmN5IGdyYXBoLlxuICAgIC8vXG4gICAgLy8gVGhpcyBsb29wIGNhbm5vdCBiZSBmdXNlZCB3aXRoIHRoZSBsb29wIGluIEVuc3VyZUV2YWx1YXRlZC4gSXQgd291bGRcbiAgICAvLyBpbnRyb2R1Y2UgYSBidWcuXG4gICAgc2VlbiA9IFNldFRvQXJyYXkoc2Vlbik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWVuLmxlbmd0aDsgaSsrKVxuICAgICAgICAkU2V0RGVwZW5kZW5jaWVzKHNlZW5baV0sIHVuZGVmaW5lZCk7XG59XG5cblxuXG4vLz4gIyMgTW9kdWxlIE9iamVjdHNcbi8vPlxuLy8+IEEgTW9kdWxlIG9iamVjdCBoYXMgdGhlIGZvbGxvd2luZyBpbnRlcm5hbCBzbG90czpcbi8vPlxuLy8+ICAgKiBtb2R1bGUuW1tFbnZpcm9ubWVudF1dICZuZGFzaDsgYSBEZWNsYXJhdGl2ZSBFbnZpcm9ubWVudCBSZWNvcmRcbi8vPiAgICAgY29uc2lzdGluZyBvZiBhbGwgYmluZGluZ3MgZGVjbGFyZWQgYXQgdG9wbGV2ZWwgaW4gdGhlIG1vZHVsZS4gVGhlXG4vLz4gICAgIG91dGVyRW52aXJvbm1lbnQgb2YgdGhpcyBlbnZpcm9ubWVudCByZWNvcmQgaXMgYSBHbG9iYWwgRW52aXJvbm1lbnRcbi8vPiAgICAgUmVjb3JkLlxuLy8+XG4vLz4gICAqIG1vZHVsZS5bW0V4cG9ydHNdXSAmbmRhc2g7IGEgTGlzdCBvZiBFeHBvcnQgUmVjb3Jkcywge1tbRXhwb3J0TmFtZV1dOiBhXG4vLz4gICAgIFN0cmluZywgW1tTb3VyY2VNb2R1bGVdXTogYSBNb2R1bGUsIFtbQmluZGluZ05hbWVdXTogYSBTdHJpbmd9LCBzdWNoXG4vLz4gICAgIHRoYXQgdGhlIFtbRXhwb3J0TmFtZV1dcyBvZiB0aGUgcmVjb3JkcyBpbiB0aGUgTGlzdCBhcmUgZWFjaCB1bmlxdWUuXG4vLz5cbi8vPiAgICogbW9kdWxlLltbRGVwZW5kZW5jaWVzXV0gJm5kYXNoOyBhIExpc3Qgb2YgTW9kdWxlcyBvciB1bmRlZmluZWQuICBUaGlzXG4vLz4gICAgIGlzIHBvcHVsYXRlZCBhdCBsaW5rIHRpbWUgYnkgdGhlIGxvYWRlciBhbmQgdXNlZCBieSBFbnN1cmVFdmFsdWF0ZWQuXG4vLz5cbi8vPiBUaGUgW1tQcm90b3R5cGVdXSBvZiBhIE1vZHVsZSBvYmplY3QgaXMgYWx3YXlzIG51bGwuXG4vLz5cbi8vPiBBIE1vZHVsZSBvYmplY3QgaGFzIGFjY2Vzc29yIHByb3BlcnRpZXMgdGhhdCBjb3JyZXNwb25kIGV4YWN0bHkgdG8gaXRzXG4vLz4gW1tFeHBvcnRzXV0sIGFuZCBubyBvdGhlciBwcm9wZXJ0aWVzLiBJdCBpcyBhbHdheXMgbm9uLWV4dGVuc2libGUgYnkgdGhlXG4vLz4gdGltZSBpdCBpcyBleHBvc2VkIHRvIEVDTUFTY3JpcHQgY29kZS5cbi8vPlxuLy8+ICMjIyBUaGUgTW9kdWxlIEZhY3RvcnkgRnVuY3Rpb25cbi8vPlxuLy8+IFRoZSBgTW9kdWxlYCBmYWN0b3J5IGZ1bmN0aW9uIHJlZmxlY3RpdmVseSBjcmVhdGVzIG1vZHVsZSBpbnN0YW5jZSBvYmplY3RzLlxuLy8+XG5cbi8vPiAjIyMjIENvbnN0YW50IEZ1bmN0aW9uc1xuLy8+XG4vLz4gQSBDb25zdGFudCBmdW5jdGlvbiBpcyBhIGZ1bmN0aW9uIHRoYXQgYWx3YXlzIHJldHVybnMgdGhlIHNhbWUgdmFsdWUuXG4vLz5cbi8vPiBFYWNoIENvbnN0YW50IGZ1bmN0aW9uIGhhcyBhIFtbQ29uc3RhbnRWYWx1ZV1dIGludGVybmFsIHNsb3QuXG4vLz5cbi8vPiBXaGVuIGEgQ29uc3RhbnQgZnVuY3Rpb24gRiBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuLy8+XG4vLz4gMS4gIFJldHVybiBGLltbQ29uc3RhbnRWYWx1ZV1dLlxuLy8+XG5cbi8vPiAjIyMjIENyZWF0ZUNvbnN0YW50R2V0dGVyKGtleSwgdmFsdWUpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIENyZWF0ZUNvbnN0YW50R2V0dGVyIGFic3RyYWN0IG9wZXJhdGlvbiBjcmVhdGVzIGFuZCByZXR1cm5zIGEgbmV3XG4vLz4gRnVuY3Rpb24gb2JqZWN0IHRoYXQgdGFrZXMgbm8gYXJndW1lbnRzIGFuZCByZXR1cm5zIHZhbHVlLiAgSXQgcGVyZm9ybXMgdGhlXG4vLz4gZm9sbG93aW5nIHN0ZXBzOlxuLy8+XG5mdW5jdGlvbiBDcmVhdGVDb25zdGFudEdldHRlcihrZXksIHZhbHVlKSB7XG4gICAgLy8+IDEuICBMZXQgZ2V0dGVyIGJlIGEgbmV3IENvbnN0YW50IGZ1bmN0aW9uLlxuICAgIC8vPiAyLiAgU2V0IHRoZSBbW0NvbnN0YW50VmFsdWVdXSBpbnRlcm5hbCBzbG90IG9mIGdldHRlciB0byB2YWx1ZS5cbiAgICB2YXIgZ2V0dGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdmFsdWU7IH07XG5cbiAgICAvLz4gMy4gIENhbGwgU2V0RnVuY3Rpb25OYW1lKGdldHRlciwga2V5LCBgXCJnZXRcImApLlxuLypcbiAgICBkZWxldGUgZ2V0dGVyLm5hbWU7XG4gICAgc3RkX09iamVjdF9kZWZpbmVQcm9wZXJ0eShnZXR0ZXIsIFwibmFtZVwiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHZhbHVlOiBcImdldCBcIiArIGtleSxcbiAgICAgICAgd3JpdGFibGU6IGZhbHNlXG4gICAgfSk7XG4qL1xuXG4gICAgLy8+IDQuICBSZXR1cm4gZ2V0dGVyLlxuICAgIHJldHVybiBnZXR0ZXI7XG59XG5cbi8vPiAjIyMjIE1vZHVsZSAoIG9iaiApXG4vLz5cbi8vPiBXaGVuIHRoZSBgTW9kdWxlYCBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBvcHRpb25hbCBhcmd1bWVudCBvYmosIHRoZVxuLy8+IGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIE1vZHVsZShvYmopIHtcbiAgICAvLz4gMS4gIElmIFR5cGUob2JqKSBpcyBub3QgT2JqZWN0LCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgaWYgKCFJc09iamVjdChvYmopKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiTW9kdWxlIGFyZ3VtZW50IG11c3QgYmUgYW4gb2JqZWN0XCIpO1xuXG4gICAgLy8+IDEuICBMZXQgbW9kIGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgQ3JlYXRlTGlua2VkTW9kdWxlSW5zdGFuY2VcbiAgICAvLz4gICAgIGFic3RyYWN0IG9wZXJhdGlvbi5cbiAgICB2YXIgbW9kID0gJENyZWF0ZU1vZHVsZSgpO1xuXG4gICAgLy8+IDEuICBMZXQga2V5cyBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlIE9iamVjdEtleXMgYWJzdHJhY3Qgb3BlcmF0aW9uXG4gICAgLy8+ICAgICBwYXNzaW5nIG9iaiBhcyB0aGUgYXJndW1lbnQuXG4gICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChrZXlzKS5cbiAgICB2YXIga2V5cyA9IHN0ZF9PYmplY3Rfa2V5cyhvYmopO1xuXG4gICAgLy8+IDEuICBGb3IgZWFjaCBrZXkgaW4ga2V5cywgZG9cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG5cbiAgICAgICAgLy8+ICAgICAxLiAgTGV0IHZhbHVlIGJlIHRoZSByZXN1bHQgb2YgR2V0KG9iaiwga2V5KS5cbiAgICAgICAgLy8+ICAgICAxLiAgUmV0dXJuSWZBYnJ1cHQodmFsdWUpLlxuICAgICAgICB2YXIgdmFsdWUgPSBvYmpba2V5XTtcblxuICAgICAgICAvLz4gICAgIDEuICBMZXQgRiBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmdcbiAgICAgICAgLy8+ICAgICAgICAgQ3JlYXRlQ29uc3RhbnRHZXR0ZXIoa2V5LCB2YWx1ZSkuXG4gICAgICAgIC8vPiAgICAgMS4gIExldCBkZXNjIGJlIHRoZSBQcm9wZXJ0eURlc2NyaXB0b3Ige1tbQ29uZmlndXJhYmxlXV06XG4gICAgICAgIC8vPiAgICAgICAgIGZhbHNlLCBbW0VudW1lcmFibGVdXTogdHJ1ZSwgW1tHZXRdXTogRiwgW1tTZXRdXTpcbiAgICAgICAgLy8+ICAgICAgICAgdW5kZWZpbmVkfS5cbiAgICAgICAgLy8+ICAgICAxLiAgTGV0IHN0YXR1cyBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlXG4gICAgICAgIC8vPiAgICAgICAgIERlZmluZVByb3BlcnR5T3JUaHJvdyBhYnN0cmFjdCBvcGVyYXRpb24gcGFzc2luZyBtb2QsIGtleSxcbiAgICAgICAgLy8+ICAgICAgICAgYW5kIGRlc2MgYXMgYXJndW1lbnRzLlxuICAgICAgICAvLz4gICAgIDEuICBSZXR1cm5JZkFicnVwdChzdGF0dXMpLlxuICAgICAgICBzdGRfT2JqZWN0X2RlZmluZVByb3BlcnR5KG1vZCwga2V5LCB7XG4gICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGdldDogQ3JlYXRlQ29uc3RhbnRHZXR0ZXIoa2V5LCB2YWx1ZSksXG4gICAgICAgICAgICBzZXQ6IHVuZGVmaW5lZFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLz4gMS4gIENhbGwgdGhlIFtbUHJldmVudEV4dGVuc2lvbnNdXSBpbnRlcm5hbCBtZXRob2Qgb2YgbW9kLlxuICAgIHN0ZF9PYmplY3RfcHJldmVudEV4dGVuc2lvbnMobW9kKTtcblxuICAgIC8vPiAxLiAgUmV0dXJuIG1vZC5cbiAgICByZXR1cm4gbW9kO1xufVxuLy8+XG5cbi8vPiAjIyMjIE1vZHVsZS5wcm90b3R5cGVcbi8vPlxuLy8+IFRoZSBpbml0aWFsIHZhbHVlIG9mIGBNb2R1bGUucHJvdG90eXBlYCBpcyBudWxsLlxuLy8+XG4vLyAqUmF0aW9uYWxlOiogVGhlIGBNb2R1bGVgIGZ1bmN0aW9uIGlzIG5vdCBhIGNvbnN0cnVjdG9yLCBhbmQgYWxsIE1vZHVsZVxuLy8gaW5zdGFuY2Ugb2JqZWN0cyBoYXZlIG51bGwgW1tQcm90b3R5cGVdXS5cbk1vZHVsZS5wcm90b3R5cGUgPSBudWxsO1xuXG5cbi8vICMjIFRoZSBSZWFsbSBjbGFzc1xuXG4vLz4gIyMgUmVhbG0gT2JqZWN0c1xuXG4vLyBJbXBsZW1lbnRhdGlvbiBub3RlOiAgQXMgd2l0aCBMb2FkZXIgYW5kIE1vZHVsZSBvYmplY3RzLCB3ZSB1c2UgYSBXZWFrTWFwIHRvXG4vLyBzdG9yZSBSZWFsbSBvYmplY3RzJyBpbnRlcm5hbCBzdGF0ZS5cbmxldCByZWFsbUludGVybmFsRGF0YU1hcCA9IENyZWF0ZVdlYWtNYXAoKTtcblxuLy8gR2V0IHRoZSBpbnRlcm5hbCBkYXRhIGZvciBhIGdpdmVuIGBSZWFsbWAgb2JqZWN0LlxuZnVuY3Rpb24gR2V0UmVhbG1JbnRlcm5hbERhdGEodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiUmVhbG0gbWV0aG9kIG9yIGFjY2Vzc29yIGNhbGxlZCBvbiBpbmNvbXBhdGlibGUgcHJpbWl0aXZlXCIpO1xuXG4gICAgbGV0IHJlYWxtRGF0YSA9IGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9nZXQsIHJlYWxtSW50ZXJuYWxEYXRhTWFwLCB2YWx1ZSk7XG4gICAgaWYgKHJlYWxtRGF0YSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiUmVhbG0gbWV0aG9kIG9yIGFjY2Vzc29yIGNhbGxlZCBvbiBpbmNvbXBhdGlibGUgb2JqZWN0XCIpO1xuICAgIHJldHVybiByZWFsbURhdGE7XG59XG5cbi8vPiAjIyMgVGhlIFJlYWxtIENvbnN0cnVjdG9yXG4vLz5cbi8vPiAjIyMjIG5ldyBSZWFsbSAoIG9wdGlvbnMsIGluaXRpYWxpemVyIClcbi8vPlxuZnVuY3Rpb24gUmVhbG0ob3B0aW9ucywgaW5pdGlhbGl6ZXIpIHtcbiAgICAvLyBJbXBsZW1lbnRhdGlvbiBidWc6IEluIHN0ZXAgMSwgdGhpcyBpbXBsZW1lbnRhdGlvbiBjYWxscyBSZWFsbVtAQGNyZWF0ZV1cbiAgICAvLyBkaXJlY3RseS4gIFRoZSBzcGVjIGluc3RlYWQgbWFrZXMgYG5ldyBSZWFsbShvcHRpb25zKWAgZXF1aXZhbGVudCB0b1xuICAgIC8vIGBSZWFsbS5bW0NhbGxdXShSZWFsbVtAQGNyZWF0ZV0oKSwgTGlzdCBbb3B0aW9uc10pYC4gIEluIG90aGVyIHdvcmRzLFxuICAgIC8vIFJlYWxtW0BAY3JlYXRlXSBpcyBjYWxsZWQgKmJlZm9yZSogUmVhbG0uICBXZSdsbCBjaGFuZ2UgdGhhdCB3aGVuXG4gICAgLy8gc3ltYm9scyBhbmQgQEBjcmVhdGUgYXJlIGltcGxlbWVudGVkLiBGb3Igbm93IGl0IGlzIGp1c3QgdmVyeSB2ZXJ5XG4gICAgLy8gc2xpZ2h0bHkgb3V0IG9mIGxpbmUgd2l0aCB0aGUgc3BlYy4gVGhlIExvYWRlciBjb25zdHJ1Y3RvciBoYXMgdGhlIHNhbWVcbiAgICAvLyBkaXNjcmVwYW5jeS5cbiAgICAvL1xuICAgIC8vPiAxLiAgTGV0IHJlYWxtT2JqZWN0IGJlIHRoZSB0aGlzIHZhbHVlLlxuICAgIHZhciByZWFsbU9iamVjdCA9IGNhbGxGdW5jdGlvbihSZWFsbVtcIkBAY3JlYXRlXCJdLCBSZWFsbSk7XG5cbiAgICAvLz4gMS4gIElmIFR5cGUocmVhbG1PYmplY3QpIGlzIG5vdCBPYmplY3QsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAoIUlzT2JqZWN0KHJlYWxtT2JqZWN0KSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIlJlYWxtIG9iamVjdCBleHBlY3RlZFwiKTtcblxuICAgIC8vPiAxLiAgSWYgcmVhbG1PYmplY3QgZG9lcyBub3QgaGF2ZSBhbGwgb2YgdGhlIGludGVybmFsIHByb3BlcnRpZXMgb2YgYVxuICAgIC8vPiAgICAgUmVhbG0gb2JqZWN0LCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgdmFyIHJlYWxtRGF0YSA9XG4gICAgICAgIGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9nZXQsIHJlYWxtSW50ZXJuYWxEYXRhTWFwLCByZWFsbU9iamVjdCk7XG5cbiAgICAvLz4gMS4gIElmIHJlYWxtT2JqZWN0LltbUmVhbG1dXSBpcyBub3QgdW5kZWZpbmVkLCB0aHJvdyBhIFR5cGVFcnJvclxuICAgIC8vPiAgICAgZXhjZXB0aW9uLlxuICAgIGlmIChyZWFsbURhdGEucmVhbG0gIT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIlJlYWxtIG9iamVjdCBjYW5ub3QgYmUgaW50aXRpYWxpemVkIG1vcmUgdGhhbiBvbmNlXCIpO1xuXG4gICAgLy8+IDEuICBJZiBvcHRpb25zIGlzIHVuZGVmaW5lZCwgdGhlbiBsZXQgb3B0aW9ucyBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmdcbiAgICAvLz4gICAgIE9iamVjdENyZWF0ZShudWxsLCAoKSkuXG4gICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZClcbiAgICAgICAgb3B0aW9ucyA9IHN0ZF9PYmplY3RfY3JlYXRlKG51bGwpO1xuXG4gICAgLy8+IDEuICBFbHNlLCBpZiBUeXBlKG9wdGlvbnMpIGlzIG5vdCBPYmplY3QsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAoIUlzT2JqZWN0KG9wdGlvbnMpKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwib3B0aW9ucyBtdXN0IGJlIGFuIG9iamVjdCBvciB1bmRlZmluZWRcIik7XG5cbiAgICAvLz4gMS4gIExldCByZWFsbSBiZSB0aGUgcmVzdWx0IG9mIENyZWF0ZVJlYWxtKHJlYWxtT2JqZWN0KS5cbiAgICBsZXQgcmVhbG0gPSAkQ3JlYXRlUmVhbG0ocmVhbG1PYmplY3QpO1xuXG4gICAgLy8+IDEuICBMZXQgZXZhbEhvb2tzIGJlIHRoZSByZXN1bHQgb2YgR2V0KG9wdGlvbnMsIGBcImV2YWxcImApLlxuICAgIC8vPiAxLiAgUmV0dXJuSWZBYnJ1cHQoZXZhbEhvb2tzKS5cbiAgICAvLz4gMS4gIElmIGV2YWxIb29rcyBpcyB1bmRlZmluZWQgdGhlbiBsZXQgZXZhbEhvb2tzIGJlIHRoZSByZXN1bHQgb2ZcbiAgICAvLz4gICAgIGNhbGxpbmcgT2JqZWN0Q3JlYXRlKCVPYmplY3RQcm90b3R5cGUlLCAoKSkuXG4gICAgbGV0IGV2YWxIb29rcyA9IFVucGFja09wdGlvbihvcHRpb25zLCBcImV2YWxcIiwgKCkgPT4gKHt9KSk7XG5cbiAgICAvLz4gMS4gIEVsc2UsIGlmIFR5cGUoZXZhbEhvb2tzKSBpcyBub3QgT2JqZWN0LCB0aHJvdyBhIFR5cGVFcnJvclxuICAgIC8vPiAgICAgZXhjZXB0aW9uLlxuICAgIGlmICghSXNPYmplY3QoZXZhbEhvb2tzKSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIm9wdGlvbnMuZXZhbCBtdXN0IGJlIGFuIG9iamVjdCBvciB1bmRlZmluZWRcIik7XG5cbiAgICAvLz4gMS4gIExldCBkaXJlY3RFdmFsIGJlIHRoZSByZXN1bHQgb2YgR2V0KGV2YWxIb29rcywgYFwiZGlyZWN0XCJgKS5cbiAgICAvLz4gMS4gIFJldHVybklmQWJydXB0KGRpcmVjdEV2YWwpLlxuICAgIC8vPiAxLiAgSWYgZGlyZWN0RXZhbCBpcyB1bmRlZmluZWQgdGhlbiBsZXQgZGlyZWN0RXZhbCBiZSB0aGUgcmVzdWx0IG9mXG4gICAgLy8+ICAgICBjYWxsaW5nIE9iamVjdENyZWF0ZSglT2JqZWN0UHJvdG90eXBlJSwgKCkpLlxuICAgIGxldCBkaXJlY3RFdmFsID0gVW5wYWNrT3B0aW9uKGV2YWxIb29rcywgXCJkaXJlY3RcIiwgKCkgPT4gKHt9KSk7XG5cbiAgICAvLz4gMS4gIEVsc2UsIGlmIFR5cGUoZGlyZWN0RXZhbCkgaXMgbm90IE9iamVjdCwgdGhyb3cgYSBUeXBlRXJyb3JcbiAgICAvLz4gICAgIGV4Y2VwdGlvbi5cbiAgICBpZiAoIUlzT2JqZWN0KGRpcmVjdEV2YWwpKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwib3B0aW9ucy5ldmFsLmRpcmVjdCBtdXN0IGJlIGFuIG9iamVjdCBvciB1bmRlZmluZWRcIik7XG5cbiAgICAvLz4gMS4gIExldCB0cmFuc2xhdGUgYmUgdGhlIHJlc3VsdCBvZiBHZXQoZGlyZWN0RXZhbCwgYFwidHJhbnNsYXRlXCJgKS5cbiAgICAvLz4gMS4gIFJldHVybklmQWJydXB0KHRyYW5zbGF0ZSkuXG4gICAgbGV0IHRyYW5zbGF0ZSA9IFVucGFja09wdGlvbihkaXJlY3RFdmFsLCBcInRyYW5zbGF0ZVwiKTtcblxuICAgIC8vPiAxLiAgSWYgdHJhbnNsYXRlIGlzIG5vdCB1bmRlZmluZWQgYW5kIElzQ2FsbGFibGUodHJhbnNsYXRlKSBpcyBmYWxzZSxcbiAgICAvLz4gICAgIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAodHJhbnNsYXRlICE9PSB1bmRlZmluZWQgJiYgIUlzQ2FsbGFibGUodHJhbnNsYXRlKSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcInRyYW5zbGF0ZSBob29rIGlzIG5vdCBjYWxsYWJsZVwiKTtcblxuICAgIC8vPiAxLiAgU2V0IHJlYWxtLltbdHJhbnNsYXRlRGlyZWN0RXZhbEhvb2tdXSB0byB0cmFuc2xhdGUuXG4gICAgcmVhbG0udHJhbnNsYXRlRGlyZWN0RXZhbEhvb2sgPSB0cmFuc2xhdGU7XG5cbiAgICAvLz4gMS4gIExldCBmYWxsYmFjayBiZSB0aGUgcmVzdWx0IG9mIEdldChkaXJlY3RFdmFsLCBgXCJmYWxsYmFja1wiYCkuXG4gICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChmYWxsYmFjaykuXG4gICAgbGV0IGZhbGxiYWNrID0gVW5wYWNrT3B0aW9uKGRpcmVjdEV2YWwsIFwiZmFsbGJhY2tcIik7XG5cbiAgICAvLz4gMS4gIElmIGZhbGxiYWNrIGlzIG5vdCB1bmRlZmluZWQgYW5kIElzQ2FsbGFibGUoZmFsbGJhY2spIGlzIGZhbHNlLFxuICAgIC8vPiAgICAgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgIGlmIChmYWxsYmFjayAhPT0gdW5kZWZpbmVkICYmICFJc0NhbGxhYmxlKGZhbGxiYWNrKSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcImZhbGxiYWNrIGhvb2sgaXMgbm90IGNhbGxhYmxlXCIpO1xuXG4gICAgLy8+IDEuICBTZXQgcmVhbG0uW1tmYWxsYmFja0RpcmVjdEV2YWxIb29rXV0gdG8gZmFsbGJhY2suXG4gICAgcmVhbG0uZmFsbGJhY2tEaXJlY3RFdmFsSG9vayA9IGZhbGxiYWNrO1xuXG4gICAgLy8+IDEuICBMZXQgaW5kaXJlY3RFdmFsIGJlIHRoZSByZXN1bHQgb2YgR2V0KG9wdGlvbnMsIGBcImluZGlyZWN0XCJgKS5cbiAgICAvLz4gMS4gIFJldHVybklmQWJydXB0KGluZGlyZWN0RXZhbCkuXG4gICAgbGV0IGluZGlyZWN0RXZhbCA9IFVucGFja09wdGlvbihldmFsSG9va3MsIFwiaW5kaXJlY3RcIik7XG5cbiAgICAvLz4gMS4gIElmIGluZGlyZWN0RXZhbCBpcyBub3QgdW5kZWZpbmVkIGFuZCBJc0NhbGxhYmxlKGluZGlyZWN0RXZhbCkgaXNcbiAgICAvLz4gICAgIGZhbHNlLCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgaWYgKGluZGlyZWN0RXZhbCAhPT0gdW5kZWZpbmVkICYmICFJc0NhbGxhYmxlKGluZGlyZWN0RXZhbCkpXG4gICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXCJpbmRpcmVjdCBldmFsIGhvb2sgaXMgbm90IGNhbGxhYmxlXCIpO1xuXG4gICAgLy8+IDEuICBTZXQgcmVhbG0uW1tpbmRpcmVjdEV2YWxIb29rXV0gdG8gaW5kaXJlY3RFdmFsLlxuICAgIHJlYWxtLmluZGlyZWN0RXZhbEhvb2sgPSBpbmRpcmVjdEV2YWw7XG5cbiAgICAvLz4gMS4gIExldCBGdW5jdGlvbiBiZSB0aGUgcmVzdWx0IG9mIEdldChvcHRpb25zLCBgXCJGdW5jdGlvblwiYCkuXG4gICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChGdW5jdGlvbikuXG4gICAgbGV0IEZ1bmN0aW9uID0gVW5wYWNrT3B0aW9uKG9wdGlvbnMsIFwiRnVuY3Rpb25cIik7XG5cbiAgICAvLz4gMS4gIElmIEZ1bmN0aW9uIGlzIG5vdCB1bmRlZmluZWQgYW5kIElzQ2FsbGFibGUoRnVuY3Rpb24pIGlzIGZhbHNlLFxuICAgIC8vPiAgICAgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgIGlmIChGdW5jdGlvbiAhPT0gdW5kZWZpbmVkICYmICFJc0NhbGxhYmxlKEZ1bmN0aW9uKSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIkZ1bmN0aW9uIGhvb2sgaXMgbm90IGNhbGxhYmxlXCIpO1xuXG4gICAgLy8+IDEuICBTZXQgcmVhbG0uW1tGdW5jdGlvbkhvb2tdXSB0byBGdW5jdGlvbi5cbiAgICByZWFsbS5GdW5jdGlvbkhvb2sgPSBGdW5jdGlvbjtcblxuICAgIC8vPiAxLiAgU2V0IHJlYWxtT2JqZWN0LltbUmVhbG1dXSB0byByZWFsbS5cbiAgICByZWFsbURhdGEucmVhbG0gPSByZWFsbTtcblxuICAgIC8vPiAxLiAgSWYgaW5pdGlhbGl6ZXIgaXMgbm90IHVuZGVmaW5lZCwgdGhlblxuICAgIGlmIChpbml0aWFsaXplciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vPiAgICAgMS4gIElmIElzQ2FsbGFibGUoaW5pdGlhbGl6ZXIpIGlzIGZhbHNlLCB0aHJvdyBhIFR5cGVFcnJvclxuICAgICAgICAvLz4gICAgICAgICBleGNlcHRpb24uXG4gICAgICAgIGlmICghSXNDYWxsYWJsZShpbml0aWFsaXplcikpXG4gICAgICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiaW5pdGlhbGl6ZXIgaXMgbm90IGNhbGxhYmxlXCIpO1xuXG4gICAgICAgIC8vPiAgICAgMS4gIExldCBidWlsdGlucyBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmdcbiAgICAgICAgLy8+ICAgICAgICAgT2JqZWN0Q3JlYXRlKCVPYmplY3RQcm90b3R5cGUlLCAoKSkuXG4gICAgICAgIC8vPiAgICAgMS4gIENhbGwgdGhlIERlZmluZUJ1aWx0aW5Qcm9wZXJ0aWVzIGFic3RyYWN0IG9wZXJhdGlvbiBwYXNzaW5nXG4gICAgICAgIC8vPiAgICAgICAgIHJlYWxtIGFuZCBidWlsdGlucyBhcyBhcmd1bWVudHMuXG4gICAgICAgIC8vPiAgICAgMS4gIExldCBzdGF0dXMgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIHRoZSBbW0NhbGxdXSBpbnRlcm5hbFxuICAgICAgICAvLz4gICAgICAgICBtZXRob2Qgb2YgdGhlIGluaXRpYWxpemVyIGZ1bmN0aW9uLCBwYXNzaW5nIHJlYWxtT2JqZWN0IGFzXG4gICAgICAgIC8vPiAgICAgICAgIHRoZSB0aGlzIHZhbHVlIGFuZCBidWlsdGlucyBhcyB0aGUgc2luZ2xlIGFyZ3VtZW50LlxuICAgICAgICAvLz4gICAgIDEuICBSZXR1cm5JZkFicnVwdChzdGF0dXMpLlxuICAgICAgICBjYWxsRnVuY3Rpb24oaW5pdGlhbGl6ZXIsIHJlYWxtT2JqZWN0LCByZWFsbS5idWlsdGlucyk7XG4gICAgfVxuXG4gICAgLy8+IDEuICBSZXR1cm4gcmVhbG1PYmplY3QuXG4gICAgcmV0dXJuIHJlYWxtT2JqZWN0O1xufVxuXG4vLz4gIyMjIFByb3BlcnRpZXMgb2YgdGhlIFJlYWxtIFByb3RvdHlwZSBPYmplY3Rcbi8vPlxuXG5kZWYoUmVhbG0ucHJvdG90eXBlLCB7XG5cbiAgICAvLz4gIyMjIyBSZWFsbS5wcm90b3R5cGUuZ2xvYmFsXG4gICAgLy8+XG4gICAgLy8+IGBSZWFsbS5wcm90b3R5cGUuZ2xvYmFsYCBpcyBhbiBhY2Nlc3NvciBwcm9wZXJ0eSB3aG9zZSBzZXQgYWNjZXNzb3JcbiAgICAvLz4gZnVuY3Rpb24gaXMgdW5kZWZpbmVkLiBJdHMgZ2V0IGFjY2Vzc29yIGZ1bmN0aW9uIHBlcmZvcm1zIHRoZSBmb2xsb3dpbmdcbiAgICAvLz4gc3RlcHM6XG4gICAgLy8+XG4gICAgZ2V0IGdsb2JhbCgpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgcmVhbG1PYmplY3QgYmUgdGhpcyBSZWFsbSBvYmplY3QuXG4gICAgICAgIC8vPiAxLiAgSWYgVHlwZShyZWFsbU9iamVjdCkgaXMgbm90IE9iamVjdCBvciByZWFsbU9iamVjdCBkb2VzIG5vdCBoYXZlXG4gICAgICAgIC8vPiAgICAgYWxsIHRoZSBpbnRlcm5hbCBwcm9wZXJ0aWVzIG9mIGEgUmVhbG0gb2JqZWN0LCB0aHJvdyBhXG4gICAgICAgIC8vPiAgICAgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAgICAgbGV0IHJlYWxtRGF0YSA9IEdldFJlYWxtSW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAxLiBSZXR1cm4gcmVhbG1PYmplY3QuW1tSZWFsbV1dLltbZ2xvYmFsVGhpc11dLlxuICAgICAgICByZXR1cm4gcmVhbG1EYXRhLnJlYWxtLmdsb2JhbFRoaXM7XG4gICAgfSxcbiAgICAvLz5cblxuICAgIC8vPiAjIyMjIFJlYWxtLnByb3RvdHlwZS5ldmFsICggc291cmNlIClcbiAgICAvLz5cbiAgICAvLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgZXZhbDogZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IHJlYWxtT2JqZWN0IGJlIHRoaXMgUmVhbG0gb2JqZWN0LlxuICAgICAgICAvLz4gMS4gIElmIFR5cGUocmVhbG1PYmplY3QpIGlzIG5vdCBPYmplY3Qgb3IgcmVhbG1PYmplY3QgZG9lcyBub3QgaGF2ZVxuICAgICAgICAvLz4gICAgIGFsbCB0aGUgaW50ZXJuYWwgcHJvcGVydGllcyBvZiBhIFJlYWxtIG9iamVjdCwgdGhyb3cgYVxuICAgICAgICAvLz4gICAgIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgIGxldCByZWFsbURhdGEgPSBHZXRSZWFsbUludGVybmFsRGF0YSh0aGlzKTtcblxuICAgICAgICAvLz4gMS4gIFJldHVybiB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlIEluZGlyZWN0RXZhbCBhYnN0cmFjdCBvcGVyYXRpb25cbiAgICAgICAgLy8+ICAgICBwYXNzaW5nIHJlYWxtT2JqZWN0LltbUmVhbG1dXSBhbmQgc291cmNlIGFzIGFyZ3VtZW50cy5cbiAgICAgICAgcmV0dXJuICRJbmRpcmVjdEV2YWwocmVhbG1EYXRhLnJlYWxtLCBzb3VyY2UpO1xuICAgIH1cblxufSk7XG5cbi8vPiAjIyMjIFJlYWxtIFsgQEBjcmVhdGUgXSAoIClcbi8vPlxuLy8+IFRoZSBAQGNyZWF0ZSBtZXRob2Qgb2YgdGhlIGJ1aWx0aW4gUmVhbG0gY29uc3RydWN0b3IgcGVyZm9ybXMgdGhlXG4vLz4gZm9sbG93aW5nIHN0ZXBzOlxuLy8+XG52YXIgUmVhbG1fY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKCkge1xuICAgIC8vPiAxLiAgTGV0IEYgYmUgdGhlIHRoaXMgdmFsdWUuXG4gICAgLy8+IDIuICBMZXQgcmVhbG1PYmplY3QgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nXG4gICAgLy8+ICAgICBPcmRpbmFyeUNyZWF0ZUZyb21Db25zdHJ1Y3RvcihGLCBcIiVSZWFsbVByb3RvdHlwZSVcIiwgKFtbUmVhbG1dXSkpLlxuICAgIHZhciByZWFsbU9iamVjdCA9IHN0ZF9PYmplY3RfY3JlYXRlKHRoaXMucHJvdG90eXBlKTtcblxuICAgIC8vIFRoZSBmaWVsZHMgYXJlIGluaXRpYWxseSB1bmRlZmluZWQgYnV0IGFyZSBwb3B1bGF0ZWQgd2hlbiB0aGVcbiAgICAvLyBjb25zdHJ1Y3RvciBydW5zLlxuICAgIHZhciByZWFsbURhdGEgPSB7XG4gICAgICAgIC8vICoqYHJlYWxtRGF0YS5yZWFsbWAqKiBpcyBhbiBFQ01BU2NyaXB0IFJlYWxtLiBJdCBkZXRlcm1pbmVzIHRoZVxuICAgICAgICAvLyBnbG9iYWwgc2NvcGUgYW5kIGludHJpbnNpY3Mgb2YgYWxsIGNvZGUgdGhpcyBSZWFsbSBvYmplY3QgcnVucy5cbiAgICAgICAgcmVhbG06IHVuZGVmaW5lZFxuICAgIH07XG5cbiAgICBjYWxsRnVuY3Rpb24oc3RkX1dlYWtNYXBfc2V0LCByZWFsbUludGVybmFsRGF0YU1hcCwgcmVhbG1PYmplY3QsIHJlYWxtRGF0YSk7XG5cbiAgICAvLz4gMy4gIFJldHVybiByZWFsbS5cbiAgICByZXR1cm4gcmVhbG1PYmplY3Q7XG59O1xuXG5kZWYoUmVhbG0sIHtcIkBAY3JlYXRlXCI6IFJlYWxtX2NyZWF0ZX0pO1xuXG5cbi8vICMjIFRoZSBMb2FkZXIgY2xhc3Ncbi8vXG4vLyBUaGUgcHVibGljIEFQSSBvZiB0aGUgbW9kdWxlIGxvYWRlciBzeXN0ZW0gaXMgdGhlIGBMb2FkZXJgIGNsYXNzLiAgQSBMb2FkZXJcbi8vIGlzIHJlc3BvbnNpYmxlIGZvciBhc3luY2hyb25vdXNseSBmaW5kaW5nLCBmZXRjaGluZywgbGlua2luZywgYW5kIHJ1bm5pbmdcbi8vIG1vZHVsZXMgYW5kIHNjcmlwdHMuXG5cblxuLy8+ICMjIExvYWRlciBPYmplY3RzXG4vLz5cbi8vPiBFYWNoIExvYWRlciBvYmplY3QgaGFzIHRoZSBmb2xsb3dpbmcgaW50ZXJuYWwgc2xvdHM6XG4vLz5cbi8vPiAgICogbG9hZGVyLltbUmVhbG1dXSAmbmRhc2g7IFRoZSBSZWFsbSBhc3NvY2lhdGVkIHdpdGggdGhlIGxvYWRlci4gQWxsXG4vLz4gICAgIHNjcmlwdHMgYW5kIG1vZHVsZXMgZXZhbHVhdGVkIGJ5IHRoZSBsb2FkZXIgcnVuIGluIHRoZSBzY29wZSBvZiB0aGVcbi8vPiAgICAgZ2xvYmFsIG9iamVjdCBhc3NvY2lhdGVkIHdpdGggdGhpcyBSZWFsbS5cbi8vPlxuLy8+ICAgICBUaGlzIHByb3BlcnR5IGlzIGZpeGVkIHdoZW4gdGhlIExvYWRlciBpcyBjcmVhdGVkIGFuZCBjYW4ndCBiZSBjaGFuZ2VkLlxuLy8+XG4vLz4gICAqIGxvYWRlci5bW01vZHVsZXNdXSAmbmRhc2g7IEEgTGlzdCBvZiBNb2R1bGUgUmVjb3JkczogdGhlIG1vZHVsZVxuLy8+ICAgICByZWdpc3RyeS5cbi8vPlxuLy8+ICAgICBUaGlzIExpc3Qgb25seSBldmVyIGNvbnRhaW5zIE1vZHVsZSBvYmplY3RzIHRoYXQgYXJlIGZ1bGx5IGxpbmtlZC5cbi8vPiAgICAgSG93ZXZlciBpdCBjYW4gY29udGFpbiBtb2R1bGVzIHdob3NlIGNvZGUgaGFzIG5vdCB5ZXQgYmVlbiBldmFsdWF0ZWQuXG4vLz4gICAgIEV4Y2VwdCBpbiB0aGUgY2FzZSBvZiBjeWNsaWMgaW1wb3J0cywgc3VjaCBtb2R1bGVzIGFyZSBub3QgZXhwb3NlZCB0b1xuLy8+ICAgICB1c2VyIGNvZGUuICBTZWUgYEVuc3VyZUV2YWx1YXRlZCgpYC5cbi8vPlxuLy8+ICAgKiBsb2FkZXIuW1tMb2Fkc11dICZuZGFzaDsgQSBMaXN0IG9mIExvYWQgUmVjb3Jkcy4gVGhlc2UgcmVwcmVzZW50XG4vLz4gICAgIG9uZ29pbmcgYXN5bmNocm9ub3VzIG1vZHVsZSBsb2Fkcy5cbi8vPlxuLy8+ICAgICBUaGlzIExpc3QgaXMgc3RvcmVkIGluIHRoZSBsb2FkZXIgc28gdGhhdCBtdWx0aXBsZSBjYWxscyB0b1xuLy8+ICAgICBgbG9hZGVyLmRlZmluZSgpLy5sb2FkKCkvLm1vZHVsZSgpLy5pbXBvcnQoKWAgY2FuIGNvb3BlcmF0ZSB0byBmZXRjaFxuLy8+ICAgICB3aGF0IHRoZXkgbmVlZCBvbmx5IG9uY2UuXG5cbi8vIEltcGxlbWVudGF0aW9uIG5vdGU6IFNpbmNlIEVTNiBkb2VzIG5vdCBoYXZlIHN1cHBvcnQgZm9yIHByaXZhdGUgc3RhdGUgb3Jcbi8vIHByaXZhdGUgbWV0aG9kcywgdGhlIGludGVybmFsIHNsb3RzIG9mIExvYWRlciBvYmplY3RzIGFyZSBzdG9yZWQgb24gYVxuLy8gc2VwYXJhdGUgb2JqZWN0IHdoaWNoIHVzZXIgY29kZSBjYW5ub3QgYWNjZXNzLlxuLy9cbi8vIFNvIHdoYXQgdGhlIHNwZWNpZmljYXRpb24gcmVmZXJzIHRvIGFzIGBsb2FkZXIuW1tNb2R1bGVzXV1gIGlzIGltcGxlbWVudGVkXG4vLyBhcyBgR2V0TG9hZGVySW50ZXJuYWxEYXRhKGxvYWRlcikubW9kdWxlc2AuXG4vL1xuLy8gVGhlIHNpbXBsZXN0IHdheSB0byBjb25uZWN0IHRoZSB0d28gb2JqZWN0cyB3aXRob3V0IGV4cG9zaW5nIHRoaXMgaW50ZXJuYWxcbi8vIGRhdGEgdG8gdXNlciBjb2RlIGlzIHRvIHVzZSBhIGBXZWFrTWFwYC5cbi8vXG52YXIgbG9hZGVySW50ZXJuYWxEYXRhTWFwID0gQ3JlYXRlV2Vha01hcCgpO1xuXG4vLyBHZXQgdGhlIGludGVybmFsIGRhdGEgZm9yIGEgZ2l2ZW4gYExvYWRlcmAgb2JqZWN0LlxuZnVuY3Rpb24gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHZhbHVlKSB7XG4gICAgLy8gTG9hZGVyIG1ldGhvZHMgY291bGQgYmUgcGxhY2VkIG9uIHdyYXBwZXIgcHJvdG90eXBlcyBsaWtlXG4gICAgLy8gU3RyaW5nLnByb3RvdHlwZS5cbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiTG9hZGVyIG1ldGhvZCBjYWxsZWQgb24gaW5jb21wYXRpYmxlIHByaW1pdGl2ZVwiKTtcblxuICAgIGxldCBsb2FkZXJEYXRhID0gY2FsbEZ1bmN0aW9uKHN0ZF9XZWFrTWFwX2dldCwgbG9hZGVySW50ZXJuYWxEYXRhTWFwLCB2YWx1ZSk7XG4gICAgaWYgKGxvYWRlckRhdGEgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIkxvYWRlciBtZXRob2QgY2FsbGVkIG9uIGluY29tcGF0aWJsZSBvYmplY3RcIik7XG4gICAgcmV0dXJuIGxvYWRlckRhdGE7XG59XG5cbi8vIFRoZSBsaXN0cyByZWZlcnJlZCB0byBpbiB0aGUgc3BlYyBhcmUgbm90IGFjdHVhbGx5IHN0b3JlZCB0aGF0IHdheSBpbiB0aGlzXG4vLyBpbXBsZW1lbnRhdGlvbi5cbi8vXG4vLyBgbG9hZGVyRGF0YS5tb2R1bGVzYCBpcyBhIE1hcCBmcm9tIHN0cmluZ3MgKG1vZHVsZSBuYW1lcykgdG8gTW9kdWxlIG9iamVjdHMuXG4vL1xuLy8gYGxvYWRlckRhdGEubG9hZHNgIGlzIGEgTWFwIGZyb20gc3RyaW5ncyAobW9kdWxlIG5hbWVzKSB0byBMb2Fkcy5cbi8vXG4vLyBNYXBzIHN1cHBvcnQgZmFzdGVyIGxvb2t1cCB0aGFuIHRoZSBsaW5lYXIgTGlzdCBzY2FucyBkZXNjcmliZWQgYnkgdGhlXG4vLyBzcGVjaWZpY2F0aW9uLlxuLy9cbi8vIGBsb2FkZXJEYXRhLmxpbmtTZXRDb3VudGVyYCBpcyBub3QgbWVudGlvbmVkIGluIHRoZSBzcGVjaWZpY2F0aW9uIGF0IGFsbC5cbi8vIFRoaXMgY291bnRlciBpcyB1c2VkIHRvIGdpdmUgZWFjaCBMaW5rU2V0IHJlY29yZCBhbiBpZCAobGlua1NldC50aW1lc3RhbXApXG4vLyB0aGF0IGltcG9zZXMgYSB0b3RhbCBvcmRlcmluZyBvbiBMaW5rU2V0cy4gIFRoaXMgaXMgdXNlZCB3aGVuIG11bHRpcGxlXG4vLyBMaW5rU2V0cyBhcmUgY29tcGxldGVkIG9yIHJlamVjdGVkIGF0IG9uY2UgKExvYWRGYWlsZWQsIExvYWRTdWNjZWVkZWQpLlxuLy8gVGhpcyBjb3VudGVyIGlzIGFuIGltcGxlbWVudGF0aW9uIGRldGFpbDsgdGhlIHNwZWMganVzdCBzYXlzIFwiaW4gdGhlIG9yZGVyXG4vLyBpbiB3aGljaCB0aGUgTGlua1NldCBSZWNvcmRzIHdlcmUgY3JlYXRlZFwiLlxuXG5cbi8vPiAjIyMgR2V0T3B0aW9uKG9wdGlvbnMsIG5hbWUpIEFic3RyYWN0IE9wZXJhdGlvblxuLy8+XG4vLz4gVGhlIEdldE9wdGlvbiBhYnN0cmFjdCBvcGVyYXRpb24gaXMgdXNlZCB0byBleHRyYWN0IGEgcHJvcGVydHkgZnJvbSBhblxuLy8+IG9wdGlvbmFsIG9wdGlvbnMgYXJndW1lbnQuXG4vLz5cbi8vPiBUaGUgZm9sbG93aW5nIHN0ZXBzIGFyZSB0YWtlbjpcbi8vPlxuZnVuY3Rpb24gR2V0T3B0aW9uKG9wdGlvbnMsIG5hbWUpIHtcbiAgICAvLz4gMS4gIElmIG9wdGlvbnMgaXMgdW5kZWZpbmVkLCB0aGVuIHJldHVybiB1bmRlZmluZWQuXG4gICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgIC8vPiAyLiAgSWYgVHlwZShvcHRpb25zKSBpcyBub3QgT2JqZWN0LCB0aGVuIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAoIUlzT2JqZWN0KG9wdGlvbnMpKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwib3B0aW9ucyBtdXN0IGJlIGVpdGhlciBhbiBvYmplY3Qgb3IgdW5kZWZpbmVkXCIpO1xuXG4gICAgLy8+IDMuICBSZXR1cm4gdGhlIHJlc3VsdCBvZiBHZXQob3B0aW9ucywgbmFtZSkuXG4gICAgcmV0dXJuIG9wdGlvbnNbbmFtZV07XG59XG5cblxuLy8+ICMjIyBUaGUgTG9hZGVyIENvbnN0cnVjdG9yXG4vLz5cblxuLy8+ICMjIyMgTG9hZGVyICggb3B0aW9ucyApXG4vLz5cbi8vPiBXaGVuIHRoZSBgTG9hZGVyYCBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBvcHRpb25hbCBhcmd1bWVudCBvcHRpb25zIHRoZVxuLy8+IGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4vLz5cbmZ1bmN0aW9uIExvYWRlcihvcHRpb25zPXt9KSB7XG4gICAgLy8gSW1wbGVtZW50YXRpb24gbm90ZTogU2VlIHRoZSBjb21tZW50IGFib3V0IEBAY3JlYXRlIG1ldGhvZHMgb24gc3RlcCAxIG9mXG4gICAgLy8gdGhlIFJlYWxtIGNvbnN0cnVjdG9yLCBhYm92ZS5cbiAgICAvL1xuICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSB0aGUgdGhpcyB2YWx1ZS5cbiAgICB2YXIgbG9hZGVyID0gY2FsbEZ1bmN0aW9uKExvYWRlcltcIkBAY3JlYXRlXCJdLCBMb2FkZXIpO1xuXG4gICAgLy8+IDIuICBJZiBUeXBlKGxvYWRlcikgaXMgbm90IE9iamVjdCwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgIGlmICghSXNPYmplY3QobG9hZGVyKSlcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIkxvYWRlciBvYmplY3QgZXhwZWN0ZWRcIik7XG5cbiAgICAvLz4gMy4gIElmIGxvYWRlciBkb2VzIG5vdCBoYXZlIGFsbCBvZiB0aGUgaW50ZXJuYWwgcHJvcGVydGllcyBvZiBhIExvYWRlclxuICAgIC8vPiAgICAgSW5zdGFuY2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICB2YXIgbG9hZGVyRGF0YSA9IGNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9nZXQsIGxvYWRlckludGVybmFsRGF0YU1hcCwgbG9hZGVyKTtcbiAgICBpZiAobG9hZGVyRGF0YSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiTG9hZGVyIG9iamVjdCBleHBlY3RlZFwiKTtcblxuICAgIC8vPiA0LiAgSWYgbG9hZGVyLltbTW9kdWxlc11dIGlzIG5vdCB1bmRlZmluZWQsIHRocm93IGEgVHlwZUVycm9yXG4gICAgLy8+ICAgICBleGNlcHRpb24uXG4gICAgaWYgKGxvYWRlckRhdGEubW9kdWxlcyAhPT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwiTG9hZGVyIG9iamVjdCBjYW5ub3QgYmUgaW50aXRpYWxpemVkIG1vcmUgdGhhbiBvbmNlXCIpO1xuXG4gICAgLy8+IDUuICBJZiBUeXBlKG9wdGlvbnMpIGlzIG5vdCBPYmplY3QsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAoIUlzT2JqZWN0KG9wdGlvbnMpKVxuICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwib3B0aW9ucyBtdXN0IGJlIGFuIG9iamVjdCBvciB1bmRlZmluZWRcIik7XG5cbiAgICAvLz4gNi4gIExldCByZWFsbU9iamVjdCBiZSB0aGUgcmVzdWx0IG9mIEdldChvcHRpb25zLCBgXCJyZWFsbVwiYCkuXG4gICAgLy8+IDcuICBSZXR1cm5JZkFicnVwdChyZWFsbU9iamVjdCkuXG4gICAgdmFyIHJlYWxtT2JqZWN0ID0gb3B0aW9ucy5yZWFsbTtcblxuICAgIC8vPiA4LiAgSWYgcmVhbG1PYmplY3QgaXMgdW5kZWZpbmVkLCBsZXQgcmVhbG0gYmUgdGhlIFJlYWxtIG9mIHRoZSBydW5uaW5nXG4gICAgLy8+ICAgICBleGVjdXRpb24gY29udGV4dC5cbiAgICAvLz4gOS4gIEVsc2UgaWYgVHlwZShyZWFsbU9iamVjdCkgaXMgbm90IE9iamVjdCBvciByZWFsbU9iamVjdCBkb2VzIG5vdFxuICAgIC8vPiAgICAgaGF2ZSBhbGwgdGhlIGludGVybmFsIHByb3BlcnRpZXMgb2YgYSBSZWFsbSBvYmplY3QsIHRocm93IGFcbiAgICAvLz4gICAgIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgLy8+IDEwLiBFbHNlIGxldCByZWFsbSBiZSByZWFsbU9iamVjdC5bW1JlYWxtXV0uXG4gICAgdmFyIHJlYWxtO1xuICAgIGlmIChyZWFsbU9iamVjdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlYWxtID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAoSXNPYmplY3QocmVhbG1PYmplY3QpICYmXG4gICAgICAgICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX1dlYWtNYXBfaGFzLCByZWFsbUludGVybmFsRGF0YU1hcCwgcmVhbG1PYmplY3QpKVxuICAgIHtcbiAgICAgICAgcmVhbG0gPSBHZXRSZWFsbUludGVybmFsRGF0YShyZWFsbU9iamVjdCkucmVhbG07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgc3RkX1R5cGVFcnJvcihcIm9wdGlvbnMucmVhbG0gaXMgbm90IGEgUmVhbG0gb2JqZWN0XCIpO1xuICAgIH1cblxuICAgIC8vPiAxMS4gRm9yIGVhY2ggbmFtZSBpbiB0aGUgTGlzdCAoYFwibm9ybWFsaXplXCJgLCBgXCJsb2NhdGVcImAsIGBcImZldGNoXCJgLFxuICAgIC8vPiAgICAgYFwidHJhbnNsYXRlXCJgLCBgXCJpbnN0YW50aWF0ZVwiYCksXG4gICAgbGV0IGhvb2tzID0gW1wibm9ybWFsaXplXCIsIFwibG9jYXRlXCIsIFwiZmV0Y2hcIiwgXCJ0cmFuc2xhdGVcIiwgXCJpbnN0YW50aWF0ZVwiXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBuYW1lID0gaG9va3NbaV07XG4gICAgICAgIC8vPiAgICAgMS4gIExldCBob29rIGJlIHRoZSByZXN1bHQgb2YgR2V0KG9wdGlvbnMsIG5hbWUpLlxuICAgICAgICAvLz4gICAgIDIuICBSZXR1cm5JZkFicnVwdChob29rKS5cbiAgICAgICAgdmFyIGhvb2sgPSBvcHRpb25zW25hbWVdO1xuICAgICAgICAvLz4gICAgIDMuICBJZiBob29rIGlzIG5vdCB1bmRlZmluZWQsXG4gICAgICAgIGlmIChob29rICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vPiAgICAgICAgIDEuICBMZXQgcmVzdWx0IGJlIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGVcbiAgICAgICAgICAgIC8vPiAgICAgICAgICAgICBbW0RlZmluZU93blByb3BlcnR5XV0gaW50ZXJuYWwgbWV0aG9kIG9mIGxvYWRlclxuICAgICAgICAgICAgLy8+ICAgICAgICAgICAgIHBhc3NpbmcgbmFtZSBhbmQgdGhlIFByb3BlcnR5IERlc2NyaXB0b3JcbiAgICAgICAgICAgIC8vPiAgICAgICAgICAgICB7W1tWYWx1ZV1dOiBob29rLCBbW1dyaXRhYmxlXV06IHRydWUsXG4gICAgICAgICAgICAvLz4gICAgICAgICAgICAgW1tFbnVtZXJhYmxlXV06IHRydWUsIFtbQ29uZmlndXJhYmxlXV06IHRydWV9IGFzXG4gICAgICAgICAgICAvLz4gICAgICAgICAgICAgYXJndW1lbnRzLlxuICAgICAgICAgICAgLy8+ICAgICAgICAgMi4gIFJldHVybklmQWJydXB0KHJlc3VsdCkuXG4gICAgICAgICAgICBzdGRfT2JqZWN0X2RlZmluZVByb3BlcnR5KGxvYWRlciwgbmFtZSwge1xuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBob29rLFxuICAgICAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vPiAxMi4gU2V0IGxvYWRlci5bW01vZHVsZXNdXSB0byBhIG5ldyBlbXB0eSBMaXN0LlxuICAgIGxvYWRlckRhdGEubW9kdWxlcyA9IENyZWF0ZU1hcCgpO1xuICAgIC8vPiAxMy4gU2V0IGxvYWRlci5bW0xvYWRzXV0gdG8gYSBuZXcgZW1wdHkgTGlzdC5cbiAgICBsb2FkZXJEYXRhLmxvYWRzID0gQ3JlYXRlTWFwKCk7XG4gICAgLy8+IDE0LiBTZXQgbG9hZGVyLltbUmVhbG1dXSB0byByZWFsbS5cbiAgICBsb2FkZXJEYXRhLnJlYWxtID0gcmVhbG07XG5cbiAgICAvLz4gMTUuIFJldHVybiBsb2FkZXIuXG4gICAgcmV0dXJuIGxvYWRlcjtcbn1cbi8vXG4vLyBJbiBzdGVwIDgsIHRoaXMgaW1wbGVtZW50YXRpb24gcmVwcmVzZW50cyB0aGUgaW1wbGljaXQgUmVhbG0gYXNcbi8vIHVuZGVmaW5lZCwgc28gd2UgZG8gbm90aGluZy5cbi8vXG4vLyBJbiBzdGVwIDExLCBob29rcyBwcm92aWRlZCB2aWEgYG9wdGlvbnNgIGFyZSBzdG9yZWQgYXMgb3JkaW5hcnkgZGF0YVxuLy8gcHJvcGVydGllcyBvZiB0aGUgbmV3IExvYWRlciBvYmplY3QuICAqUmF0aW9uYWxlKjogVGhlIExvYWRlciBjbGFzcyBjb250YWluc1xuLy8gZGVmYXVsdCBpbXBsZW1lbnRhdGlvbnMgb2YgZWFjaCBob29rLiBUaGlzIHdheSB0aGUgaG9va3MgY2FuIGJlIGNhbGxlZFxuLy8gdW5jb25kaXRpb25hbGx5LCBhbmQgZWl0aGVyIHRoZSB1c2VyLXByb3ZpZGVkIGhvb2sgb3IgdGhlIGRlZmF1bHQgaXNcbi8vIGNhbGxlZC4gRnVydGhlcm1vcmUsIExvYWRlciBzdWJjbGFzc2VzIGNhbiBhZGQgbWV0aG9kcyB3aXRoIHRoZSBhcHByb3ByaWF0ZVxuLy8gbmFtZXMgYW5kIHVzZSBgc3VwZXIoKWAgdG8gaW52b2tlIHRoZSBiYXNlLWNsYXNzIGJlaGF2aW9yLlxuLy9cbi8vIFRoZSBhbGdvcml0aG0gaXMgZGVzaWduZWQgc28gdGhhdCBhbGwgc3RlcHMgdGhhdCBjb3VsZCBjb21wbGV0ZSBhYnJ1cHRseVxuLy8gcHJlY2VkZSB0aGUgc3RlcHMgdGhhdCBpbml0aWFsaXplIHRoZSBpbnRlcm5hbCBzbG90cyBvZiB0aGUgbmV3IExvYWRlci5cblxuLy8gRGVmaW5lIHByb3BlcnRpZXMgb24gYW4gb2JqZWN0LiBUaGUgcHJvcGVydGllcyBkZWZpbmVkIHRoaXMgd2F5IGFyZSBleGFjdGx5XG4vLyBsaWtlIHRoZSBvcmlnaW5hbHMgb24gKnByb3BzKiwgYnV0IG5vbi1lbnVtZXJhYmxlLiBUaGlzIGlzIHVzZWQgdG8gYnVpbGRcbi8vIHByb3RvdHlwZSBvYmplY3RzIGFuZCB0byBhdHRhY2ggTW9kdWxlIGFuZCBMb2FkZXIgdG8gdGhlIGdsb2JhbC5cbmZ1bmN0aW9uIGRlZihvYmosIHByb3BzKSB7XG4gICAgLy8gVGhpcyBoZWxwZXIgZnVuY3Rpb24gY2FsbHMgT2JqZWN0IG1ldGhvZHMgZGlyZWN0bHkgYmVjYXVzZSBpdCBpcyBvbmx5XG4gICAgLy8gY2FsbGVkIGR1cmluZyBwb2x5ZmlsbCBpbml0aWFsaXphdGlvbiwgYW5kIHRoZW4gbmV2ZXIgYWdhaW4uICBJbiBhbGxcbiAgICAvLyBvdGhlciBwbGFjZXMgd2hlcmUgc3RhbmRhcmQgbGlicmFyeSBmZWF0dXJlcyBhcmUgdXNlZCwgd2UgbWFrZSBhbiBlZmZvcnRcbiAgICAvLyB0byBiZSByb2J1c3QgYWdhaW5zdCBtdXRhdGlvbiBvZiB0aGUgYnVpbHQtaW4gb2JqZWN0cy5cbiAgICB2YXIgbmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbmFtZSA9IG5hbWVzW2ldO1xuICAgICAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvcHMsIG5hbWUpO1xuICAgICAgICBkZXNjLmVudW1lcmFibGUgPSBmYWxzZTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwgZGVzYyk7XG4gICAgfVxufVxuXG5kZWYoZ2xvYmFsLCB7TW9kdWxlOiBNb2R1bGUsIExvYWRlcjogTG9hZGVyfSk7XG5cblxuXG4vLz4gIyMjIyBMb2FkZXIgWyBAQGNyZWF0ZSBdICggKVxuLy8+XG4vLz4gVGhlIEBAY3JlYXRlIG1ldGhvZCBvZiB0aGUgYnVpbHRpbiBMb2FkZXIgY29uc3RydWN0b3IgcGVyZm9ybXMgdGhlXG4vLz4gZm9sbG93aW5nIHN0ZXBzOlxuLy8+XG52YXIgTG9hZGVyX2NyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSgpIHtcbiAgICAvLz4gMS4gIExldCBGIGJlIHRoZSB0aGlzIHZhbHVlLlxuICAgIC8vPiAyLiAgTGV0IGxvYWRlciBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmdcbiAgICAvLz4gICAgIE9yZGluYXJ5Q3JlYXRlRnJvbUNvbnN0cnVjdG9yKEYsIFwiJUxvYWRlclByb3RvdHlwZSVcIiwgKFtbTW9kdWxlc11dLFxuICAgIC8vPiAgICAgW1tMb2Fkc11dLCBbW1JlYWxtXV0pKS5cbiAgICB2YXIgbG9hZGVyID0gc3RkX09iamVjdF9jcmVhdGUodGhpcy5wcm90b3R5cGUpO1xuICAgIHZhciBsb2FkZXJEYXRhID0ge1xuICAgICAgICBtb2R1bGVzOiB1bmRlZmluZWQsXG4gICAgICAgIGxvYWRzOiB1bmRlZmluZWQsXG4gICAgICAgIHJlYWxtOiB1bmRlZmluZWQsXG4gICAgICAgIGxpbmtTZXRDb3VudGVyOiAwXG4gICAgfTtcbiAgICBjYWxsRnVuY3Rpb24oc3RkX1dlYWtNYXBfc2V0LCBsb2FkZXJJbnRlcm5hbERhdGFNYXAsIGxvYWRlciwgbG9hZGVyRGF0YSk7XG5cbiAgICAvLz4gMy4gIFJldHVybiBsb2FkZXIuXG4gICAgcmV0dXJuIGxvYWRlcjtcbn07XG4vLz5cblxuZGVmKExvYWRlciwge1wiQEBjcmVhdGVcIjogTG9hZGVyX2NyZWF0ZX0pO1xuXG4vLz4gIyMjIFByb3BlcnRpZXMgb2YgdGhlIExvYWRlciBQcm90b3R5cGUgT2JqZWN0XG4vLz5cbi8vPiBUaGUgYWJzdHJhY3Qgb3BlcmF0aW9uIHRoaXNMb2FkZXIoKnZhbHVlKikgcGVyZm9ybXMgdGhlIGZvbGxvd2luZyBzdGVwczpcbi8vPlxuLy8+IDEuICBJZiBUeXBlKCp2YWx1ZSopIGlzIE9iamVjdCBhbmQgdmFsdWUgaGFzIGEgW1tNb2R1bGVzXV0gaW50ZXJuYWwgc2xvdCxcbi8vPiAgICAgdGhlblxuLy8+ICAgICAxLiAgTGV0IG0gYmUgKnZhbHVlKi5bW01vZHVsZXNdXS5cbi8vPiAgICAgMi4gIElmIG0gaXMgbm90ICoqdW5kZWZpbmVkKiosIHRoZW4gcmV0dXJuICp2YWx1ZSouXG4vLz4gMi4gIFRocm93IGEgKipUeXBlRXJyb3IqKiBleGNlcHRpb24uXG4vLz5cbi8vPiBUaGUgcGhyYXNlIFwidGhpcyBMb2FkZXJcIiB3aXRoaW4gdGhlIHNwZWNpZmljYXRpb24gb2YgYSBtZXRob2QgcmVmZXJzIHRvIHRoZVxuLy8+IHJlc3VsdCByZXR1cm5lZCBieSBjYWxsaW5nIHRoZSBhYnN0cmFjdCBvcGVyYXRpb24gdGhpc0xvYWRlciB3aXRoIHRoZSB0aGlzXG4vLz4gdmFsdWUgb2YgdGhlIG1ldGhvZCBpbnZvY2F0aW9uIHBhc3NlZCBhcyB0aGUgYXJndW1lbnQuXG4vLz5cblxuLy8gKipgVW5wYWNrT3B0aW9uYCoqIC0gVXNlZCBieSBzZXZlcmFsIExvYWRlciBtZXRob2RzIHRvIGdldCBvcHRpb25zXG4vLyBvZmYgb2YgYW4gb3B0aW9ucyBvYmplY3QgYW5kLCBpZiBkZWZpbmVkLCBjb2VyY2UgdGhlbSB0byBzdHJpbmdzLlxuLy9cbmZ1bmN0aW9uIFVucGFja09wdGlvbihvcHRpb25zLCBuYW1lLCB0aHVuaykge1xuICAgIGxldCB2YWx1ZTtcbiAgICByZXR1cm4gKG9wdGlvbnMgPT09IHVuZGVmaW5lZCB8fCAoKHZhbHVlID0gb3B0aW9uc1tuYW1lXSkgPT09IHVuZGVmaW5lZCkpXG4gICAgICAgICA/ICh0aHVuayA/IHRodW5rKCkgOiB1bmRlZmluZWQpXG4gICAgICAgICA6IHZhbHVlO1xufVxuXG5kZWYoTG9hZGVyLnByb3RvdHlwZSwge1xuXG4gICAgLy8+ICMjIyMgTG9hZGVyLnByb3RvdHlwZS5yZWFsbVxuICAgIC8vPlxuICAgIC8vPiBgTG9hZGVyLnByb3RvdHlwZS5yZWFsbWAgaXMgYW4gYWNjZXNzb3IgcHJvcGVydHkgd2hvc2Ugc2V0IGFjY2Vzc29yXG4gICAgLy8+IGZ1bmN0aW9uIGlzIHVuZGVmaW5lZC4gSXRzIGdldCBhY2Nlc3NvciBmdW5jdGlvbiBwZXJmb3JtcyB0aGUgZm9sbG93aW5nXG4gICAgLy8+IHN0ZXBzOlxuICAgIC8vPlxuICAgIGdldCByZWFsbSgpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMS4gIElmIFR5cGUobG9hZGVyKSBpcyBub3QgT2JqZWN0IG9yIGxvYWRlciBkb2VzIG5vdCBoYXZlIGFsbCB0aGVcbiAgICAgICAgLy8+ICAgICBpbnRlcm5hbCBwcm9wZXJ0aWVzIG9mIGEgTG9hZGVyIG9iamVjdCwgdGhyb3cgYSBUeXBlRXJyb3JcbiAgICAgICAgLy8+ICAgICBleGNlcHRpb24uXG4gICAgICAgIGlmICghSXNPYmplY3QodGhpcykgfHxcbiAgICAgICAgICAgICFjYWxsRnVuY3Rpb24oc3RkX1dlYWtNYXBfaGFzLCBsb2FkZXJJbnRlcm5hbERhdGFNYXAsIHRoaXMpKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aHJvdyBzdGRfVHlwZUVycm9yKFwibm90IGEgTG9hZGVyIG9iamVjdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vPiAxLiAgUmV0dXJuIGxvYWRlci5bW1JlYWxtXV0uW1tyZWFsbU9iamVjdF1dLlxuICAgICAgICByZXR1cm4gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpLnJlYWxtLnJlYWxtT2JqZWN0O1xuICAgIH0sXG4gICAgLy8+XG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmdsb2JhbFxuICAgIC8vPlxuICAgIC8vPiBgTG9hZGVyLnByb3RvdHlwZS5nbG9iYWxgIGlzIGFuIGFjY2Vzc29yIHByb3BlcnR5IHdob3NlIHNldCBhY2Nlc3NvclxuICAgIC8vPiBmdW5jdGlvbiBpcyB1bmRlZmluZWQuIEl0cyBnZXQgYWNjZXNzb3IgZnVuY3Rpb24gcGVyZm9ybXMgdGhlIGZvbGxvd2luZ1xuICAgIC8vPiBzdGVwczpcbiAgICAvLz5cbiAgICBnZXQgZ2xvYmFsKCkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgdGhpcyBMb2FkZXIuXG4gICAgICAgIC8vPiAxLiAgSWYgVHlwZShsb2FkZXIpIGlzIG5vdCBPYmplY3Qgb3IgbG9hZGVyIGRvZXMgbm90IGhhdmUgYWxsIHRoZVxuICAgICAgICAvLz4gICAgIGludGVybmFsIHByb3BlcnRpZXMgb2YgYSBMb2FkZXIgb2JqZWN0LCB0aHJvdyBhIFR5cGVFcnJvclxuICAgICAgICAvLz4gICAgIGV4Y2VwdGlvbi5cbiAgICAgICAgaWYgKCFJc09iamVjdCh0aGlzKSB8fFxuICAgICAgICAgICAgIWNhbGxGdW5jdGlvbihzdGRfV2Vha01hcF9oYXMsIGxvYWRlckludGVybmFsRGF0YU1hcCwgdGhpcykpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXCJub3QgYSBMb2FkZXIgb2JqZWN0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8+IDEuICBSZXR1cm4gbG9hZGVyLltbUmVhbG1dXS5bW2dsb2JhbFRoaXNdXS5cbiAgICAgICAgcmV0dXJuIEdldExvYWRlckludGVybmFsRGF0YSh0aGlzKS5yZWFsbS5nbG9iYWxUaGlzO1xuICAgIH0sXG4gICAgLy8+XG5cbiAgICAvLyAjIyMgTG9hZGluZyBhbmQgcnVubmluZyBjb2RlXG4gICAgLy9cbiAgICAvLyBUaGUgaGlnaC1sZXZlbCBpbnRlcmZhY2Ugb2YgYExvYWRlcmAgY29uc2lzdHMgb2YgYSBmZXcgbWV0aG9kcyBmb3JcbiAgICAvLyBsb2FkaW5nIGFuZCBydW5uaW5nIGNvZGUuXG4gICAgLy9cbiAgICAvLyBUaGVzZSBhcmUgaW1wbGVtZW50ZWQgaW4gdGVybXMgb2Ygc2xpZ2h0bHkgbG93ZXItbGV2ZWwgYnVpbGRpbmcgYmxvY2tzLlxuICAgIC8vIEVhY2ggb2YgdGhlc2UgbWV0aG9kcyBkaXJlY3RseSBvciBpbmRpcmVjdGx5IGNyZWF0ZXMgYSBgTGlua1NldGAgb2JqZWN0LFxuICAgIC8vIHdoaWNoIGlzIGluIGNoYXJnZSBvZiBsaW5raW5nLCBhbmQgYXQgbGVhc3Qgb25lIGBMb2FkYC5cblxuICAgIC8vICoqb3B0aW9ucy5hZGRyZXNzKiogJm5kYXNoOyBTZXZlcmFsIExvYWRlciBtZXRob2RzIGFjY2VwdCBhbiBgb3B0aW9uc2BcbiAgICAvLyBwYXJhbWV0ZXIuICBGb3IgdGhlc2UgbWV0aG9kcywgYG9wdGlvbnMuYWRkcmVzc2AsIGlmIHByZXNlbnQsIGlzIHBhc3NlZFxuICAgIC8vIHRvIHRoZSBgdHJhbnNsYXRlYCBhbmQgYGluc3RhbnRpYXRlYCBob29rcyBhcyBgbG9hZC5hZGRyZXNzYCwgYW5kIHRvIHRoZVxuICAgIC8vIGBub3JtYWxpemVgIGhvb2sgZm9yIGVhY2ggZGVwZW5kZW5jeSwgYXMgYHJlZmVycmVyQWRkcmVzc2AuICBUaGUgZGVmYXVsdFxuICAgIC8vIGxvYWRlciBob29rcyBpZ25vcmUgaXQsIHRob3VnaC5cbiAgICAvL1xuICAgIC8vIEltcGxlbWVudGF0aW9ucyBtYXkgYWxzbyBzdG9yZSBgb3B0aW9ucy5hZGRyZXNzYCBpbiB0aGUgY29tcGlsZWQgbW9kdWxlXG4gICAgLy8gYm9keSBhbmQgdXNlIGl0IGZvciBgRXJyb3IoKS5maWxlTmFtZWAsIGBFcnJvcigpLnN0YWNrYCwgYW5kIGRldmVsb3BlclxuICAgIC8vIHRvb2xzOyBidXQgc3VjaCB1c2UgaXMgb3V0c2lkZSB0aGUgc2NvcGUgb2YgdGhlIGxhbmd1YWdlIHNwZWNpZmljYXRpb24uXG5cblxuICAgIC8vPiAjIyMjIExvYWRlci5wcm90b3R5cGUuZGVmaW5lICggbmFtZSwgc291cmNlLCBvcHRpb25zID0gdW5kZWZpbmVkIClcbiAgICAvLz5cbiAgICAvLz4gVGhlIGBkZWZpbmVgIG1ldGhvZCBpbnN0YWxscyBhIG1vZHVsZSBpbiB0aGUgcmVnaXN0cnkgZnJvbSBzb3VyY2UuICBUaGVcbiAgICAvLz4gbW9kdWxlIGlzIG5vdCBpbW1lZGlhdGVseSBhdmFpbGFibGUuIFRoZSBgdHJhbnNsYXRlYCBhbmQgYGluc3RhbnRpYXRlYFxuICAgIC8vPiBob29rcyBhcmUgY2FsbGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgZGVwZW5kZW5jaWVzIGFyZSBsb2FkZWRcbiAgICAvLz4gYXN5bmNocm9ub3VzbHkuXG4gICAgLy8+XG4gICAgLy8+IGBkZWZpbmVgIHJldHVybnMgYSBQcm9taXNlIG9iamVjdCB0aGF0IHJlc29sdmVzIHRvIHVuZGVmaW5lZCB3aGVuIHRoZVxuICAgIC8vPiBuZXcgbW9kdWxlIGFuZCBpdHMgZGVwZW5kZW5jaWVzIGFyZSBpbnN0YWxsZWQgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgIC8vPlxuICAgIC8vPiBOT1RFIFRoaXMgaXMgdGhlIGR5bmFtaWMgZXF1aXZhbGVudCBvZiB0aGUgcHJvcG9zZWQgYDxtb2R1bGUgbmFtZT0+YFxuICAgIC8vPiBlbGVtZW50IGluIEhUTUwuXG4gICAgLy8+XG4gICAgZGVmaW5lOiBmdW5jdGlvbiBkZWZpbmUobmFtZSwgc291cmNlLCBvcHRpb25zID0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSB0aGlzIExvYWRlci5cbiAgICAgICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChsb2FkZXIpLlxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcbiAgICAgICAgdmFyIGxvYWRlckRhdGEgPSBHZXRMb2FkZXJJbnRlcm5hbERhdGEodGhpcyk7XG5cbiAgICAgICAgLy8+IDEuICBMZXQgbmFtZSBiZSBUb1N0cmluZyhuYW1lKS5cbiAgICAgICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChuYW1lKS5cbiAgICAgICAgbmFtZSA9IFRvU3RyaW5nKG5hbWUpO1xuXG4gICAgICAgIC8vPiAxLiAgTGV0IGFkZHJlc3MgYmUgR2V0T3B0aW9uKG9wdGlvbnMsIGBcImFkZHJlc3NcImApLlxuICAgICAgICAvLz4gMS4gIFJldHVybklmQWJydXB0KGFkZHJlc3MpLlxuICAgICAgICB2YXIgYWRkcmVzcyA9IEdldE9wdGlvbihvcHRpb25zLCBcImFkZHJlc3NcIik7XG5cbiAgICAgICAgLy8+IDEuICBMZXQgbWV0YWRhdGEgYmUgR2V0T3B0aW9uKG9wdGlvbnMsIGBcIm1ldGFkYXRhXCJgKS5cbiAgICAgICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChtZXRhZGF0YSkuXG4gICAgICAgIHZhciBtZXRhZGF0YSA9IEdldE9wdGlvbihvcHRpb25zLCBcIm1ldGFkYXRhXCIpO1xuXG4gICAgICAgIC8vPiAxLiAgSWYgbWV0YWRhdGEgaXMgdW5kZWZpbmVkIHRoZW4gbGV0IG1ldGFkYXRhIGJlIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgLy8+ICAgICBjYWxsaW5nIE9iamVjdENyZWF0ZSglT2JqZWN0UHJvdG90eXBlJSwgKCkpLlxuICAgICAgICBpZiAobWV0YWRhdGEgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIG1ldGFkYXRhID0ge307XG5cbiAgICAgICAgLy8+IDEuICBMZXQgRiBiZSBhIG5ldyBhbm9ueW1vdXMgZnVuY3Rpb24gb2JqZWN0IGFzIGRlZmluZWQgaW5cbiAgICAgICAgLy8+ICAgICBBc3luY1N0YXJ0TG9hZFBhcnR3YXlUaHJvdWdoLlxuICAgICAgICAvLz4gMS4gIFNldCBGLltbTG9hZGVyXV0gdG8gbG9hZGVyLlxuICAgICAgICAvLz4gMS4gIFNldCBGLltbTW9kdWxlTmFtZV1dIHRvIG5hbWUuXG4gICAgICAgIC8vPiAxLiAgU2V0IEYuW1tTdGVwXV0gdG8gdGhlIFN0cmluZyBgXCJ0cmFuc2xhdGVcImAuXG4gICAgICAgIC8vPiAxLiAgU2V0IEYuW1tNb2R1bGVNZXRhZGF0YV1dIHRvIG1ldGFkYXRhLlxuICAgICAgICAvLz4gMS4gIFNldCBGLltbTW9kdWxlU291cmNlXV0gdG8gc291cmNlLlxuICAgICAgICAvLz4gMS4gIFNldCBGLltbTW9kdWxlQWRkcmVzc11dIHRvIGFkZHJlc3MuXG4gICAgICAgIHZhciBmID0gTWFrZUNsb3N1cmVfQXN5bmNTdGFydExvYWRQYXJ0d2F5VGhyb3VnaChcbiAgICAgICAgICAgIGxvYWRlciwgbG9hZGVyRGF0YSwgbmFtZSwgXCJ0cmFuc2xhdGVcIiwgbWV0YWRhdGEsIGFkZHJlc3MsIHNvdXJjZSk7XG5cbiAgICAgICAgLy8+IDEuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgT3JkaW5hcnlDb25zdHJ1Y3QoJVByb21pc2UlLCAoRikpLlxuICAgICAgICB2YXIgcCA9IG5ldyBzdGRfUHJvbWlzZShmKTtcblxuICAgICAgICAvLz4gMS4gIExldCBHIGJlIGEgbmV3IGFub255bW91cyBmdW5jdGlvbiBhcyBkZWZpbmVkIGJ5IFJldHVyblVuZGVmaW5lZC5cbiAgICAgICAgLy8+IDEuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgUHJvbWlzZVRoZW4ocCwgRykuXG4gICAgICAgIHAgPSBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfdGhlbiwgcCwgZnVuY3Rpb24gKF8pIHt9KTtcblxuICAgICAgICAvLz4gMS4gIFJldHVybiBwLlxuICAgICAgICByZXR1cm4gcDtcbiAgICB9LFxuICAgIC8vPlxuICAgIC8vPiBUaGUgYGxlbmd0aGAgcHJvcGVydHkgb2YgdGhlIGBkZWZpbmVgIG1ldGhvZCBpcyAqKjIqKi5cbiAgICAvLz5cblxuXG4gICAgLy8+ICMjIyMgUmV0dXJuVW5kZWZpbmVkIEZ1bmN0aW9uc1xuICAgIC8vPlxuICAgIC8vPiBBIFJldHVyblVuZGVmaW5lZCBmdW5jdGlvbiBpcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24uXG4gICAgLy8+XG4gICAgLy8+IFdoZW4gYSBSZXR1cm5VbmRlZmluZWQgZnVuY3Rpb24gaXMgY2FsbGVkLCB0aGUgZm9sbG93aW5nIHN0ZXBzIGFyZVxuICAgIC8vPiB0YWtlbjpcbiAgICAvLz5cbiAgICAvLz4gMS4gIFJldHVybiB1bmRlZmluZWQuXG4gICAgLy8+XG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmxvYWQgKCByZXF1ZXN0LCBvcHRpb25zID0gdW5kZWZpbmVkIClcbiAgICAvLz5cbiAgICAvLz4gVGhlIGBsb2FkYCBtZXRob2QgaW5zdGFsbHMgYSBtb2R1bGUgaW50byB0aGUgcmVnaXN0cnkgYnkgbmFtZS5cbiAgICAvLz5cbiAgICAvLz4gTk9URSBDb21iaW5lZCB3aXRoIHRoZSBgbm9ybWFsaXplYCBob29rIGFuZCBgTG9hZGVyLnByb3RvdHlwZS5nZXRgLFxuICAgIC8vPiB0aGlzIHByb3ZpZGVzIGEgY2xvc2UgZHluYW1pYyBhcHByb3hpbWF0aW9uIG9mIGFuIEltcG9ydERlY2xhcmF0aW9uLlxuICAgIC8vPlxuICAgIGxvYWQ6IGZ1bmN0aW9uIGxvYWQobmFtZSwgb3B0aW9ucyA9IHVuZGVmaW5lZCkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgdGhpcyBMb2FkZXIuXG4gICAgICAgIC8vPiAyLiAgUmV0dXJuSWZBYnJ1cHQobG9hZGVyKS5cbiAgICAgICAgLy8+IDMuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIExvYWRNb2R1bGUobG9hZGVyLCBuYW1lLCBvcHRpb25zKS5cbiAgICAgICAgLy8+IDQuICBSZXR1cm5JZkFicnVwdChwKS5cbiAgICAgICAgdmFyIHAgPSBMb2FkTW9kdWxlKHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xuXG4gICAgICAgIC8vPiA1LiAgTGV0IGYgYmUgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGFzIGRlc2NyaWJlZCBieSBSZXR1cm5VbmRlZmluZWQuXG4gICAgICAgIC8vPiA2LiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBQcm9taXNlVGhlbihwLCBmKS5cbiAgICAgICAgcCA9IGNhbGxGdW5jdGlvbihzdGRfUHJvbWlzZV90aGVuLCBwLCBmdW5jdGlvbiAoXykge30pO1xuXG4gICAgICAgIC8vPiA3LiAgUmV0dXJuIHAuXG4gICAgICAgIHJldHVybiBwO1xuICAgIH0sXG4gICAgLy8+XG4gICAgLy8+IFRoZSBgbGVuZ3RoYCBwcm9wZXJ0eSBvZiB0aGUgYGxvYWRgIG1ldGhvZCBpcyAqKjEqKi5cbiAgICAvLz5cblxuXG4gICAgLy8+ICMjIyMgTG9hZGVyLnByb3RvdHlwZS5tb2R1bGUgKCBzb3VyY2UsIG9wdGlvbnMgKVxuICAgIC8vPlxuICAgIC8vPiBUaGUgYG1vZHVsZWAgbWV0aG9kIGFzeW5jaHJvbm91c2x5IGV2YWx1YXRlcyBhIHRvcC1sZXZlbCwgYW5vbnltb3VzXG4gICAgLy8+IG1vZHVsZSBmcm9tIHNvdXJjZS5cbiAgICAvLz5cbiAgICAvLz4gVGhlIG1vZHVsZSdzIGRlcGVuZGVuY2llcywgaWYgYW55LCBhcmUgbG9hZGVkIGFuZCBjb21taXR0ZWQgdG8gdGhlXG4gICAgLy8+IHJlZ2lzdHJ5LiAgVGhlIGFub255bW91cyBtb2R1bGUgaXRzZWxmIGlzIG5vdCBhZGRlZCB0byB0aGUgcmVnaXN0cnkuXG4gICAgLy8+XG4gICAgLy8+IGBtb2R1bGVgIHJldHVybnMgYSBQcm9taXNlIG9iamVjdCB0aGF0IHJlc29sdmVzIHRvIGEgbmV3IE1vZHVsZVxuICAgIC8vPiBpbnN0YW5jZSBvYmplY3Qgb25jZSB0aGUgZ2l2ZW4gbW9kdWxlIGJvZHkgaGFzIGJlZW4gZXZhbHVhdGVkLlxuICAgIC8vPlxuICAgIC8vPiBOT1RFIFRoaXMgaXMgdGhlIGR5bmFtaWMgZXF1aXZhbGVudCBvZiBhbiBhbm9ueW1vdXMgYDxtb2R1bGU+YCBpbiBIVE1MLlxuICAgIC8vPlxuICAgIG1vZHVsZTogZnVuY3Rpb24gbW9kdWxlKHNvdXJjZSwgb3B0aW9ucyA9IHVuZGVmaW5lZCkge1xuICAgICAgICAvLz4gMS4gIExldCBsb2FkZXIgYmUgdGhpcyBMb2FkZXIuXG4gICAgICAgIC8vPiAxLiAgUmV0dXJuSWZBYnJ1cHQobG9hZGVyKS5cbiAgICAgICAgdmFyIGxvYWRlciA9IHRoaXM7XG4gICAgICAgIEdldExvYWRlckludGVybmFsRGF0YSh0aGlzKTtcblxuICAgICAgICAvLz4gMS4gIExldCBhZGRyZXNzIGJlIEdldE9wdGlvbihvcHRpb25zLCBgXCJhZGRyZXNzXCJgKS5cbiAgICAgICAgLy8+IDEuICBSZXR1cm5JZkFicnVwdChhZGRyZXNzKS5cbiAgICAgICAgdmFyIGFkZHJlc3MgPSBHZXRPcHRpb24ob3B0aW9ucywgXCJhZGRyZXNzXCIpO1xuXG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWQgYmUgQ3JlYXRlTG9hZCh1bmRlZmluZWQpLlxuICAgICAgICBsZXQgbG9hZCA9IENyZWF0ZUxvYWQodW5kZWZpbmVkKTtcblxuICAgICAgICAvLz4gMS4gIFNldCB0aGUgW1tBZGRyZXNzXV0gZmllbGQgb2YgbG9hZCB0byBhZGRyZXMuXG4gICAgICAgIGxvYWQuYWRkcmVzcyA9IGFkZHJlc3M7XG5cbiAgICAgICAgLy8+IDEuICBMZXQgbGlua1NldCBiZSBDcmVhdGVMaW5rU2V0KGxvYWRlciwgbG9hZCkuXG4gICAgICAgIGxldCBsaW5rU2V0ID0gQ3JlYXRlTGlua1NldChsb2FkZXIsIGxvYWQpO1xuXG4gICAgICAgIC8vPiAxLiAgTGV0IHN1Y2Nlc3NDYWxsYmFjayBiZSBhIG5ldyBhbm9ueW1vdXMgZnVuY3Rpb24gb2JqZWN0IGFzXG4gICAgICAgIC8vPiAgICAgZGVmaW5lZCBieSBFdmFsdWF0ZUxvYWRlZE1vZHVsZS5cbiAgICAgICAgLy8+IDEuICBTZXQgc3VjY2Vzc0NhbGxiYWNrLltbTG9hZGVyXV0gdG8gbG9hZGVyLlxuICAgICAgICAvLz4gMS4gIFNldCBzdWNjZXNzQ2FsbGJhY2suW1tMb2FkXV0gdG8gbG9hZC5cbiAgICAgICAgLy8+IDEuICBMZXQgcCBiZSB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgUHJvbWlzZVRoZW4obGlua1NldC5bW0RvbmVdXSwgc3VjY2Vzc0NhbGxiYWNrKS5cbiAgICAgICAgbGV0IHAgPSBjYWxsRnVuY3Rpb24oc3RkX1Byb21pc2VfdGhlbiwgbGlua1NldC5kb25lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYWtlQ2xvc3VyZV9FdmFsdWF0ZUxvYWRlZE1vZHVsZShsb2FkZXIpKTtcblxuICAgICAgICAvLz4gMS4gIExldCBzb3VyY2VQcm9taXNlIGJlIFByb21pc2VPZihzb3VyY2UpLlxuICAgICAgICB2YXIgc291cmNlUHJvbWlzZSA9IFByb21pc2VPZihzb3VyY2UpO1xuXG4gICAgICAgIC8vPiAxLiAgQ2FsbCB0aGUgUHJvY2VlZFRvVHJhbnNsYXRlIGFic3RyYWN0IG9wZXJhdGlvbiBwYXNzaW5nIGxvYWRlcixcbiAgICAgICAgLy8+ICAgICBsb2FkLCBhbmQgc291cmNlUHJvbWlzZSBhcyBhcmd1bWVudHMuXG4gICAgICAgIFByb2NlZWRUb1RyYW5zbGF0ZShsb2FkZXIsIGxvYWQsIHNvdXJjZVByb21pc2UpO1xuXG4gICAgICAgIC8vPiAxLiAgUmV0dXJuIHAuXG4gICAgICAgIHJldHVybiBwO1xuICAgIH0sXG4gICAgLy8+XG4gICAgLy8+IFRoZSBgbGVuZ3RoYCBwcm9wZXJ0eSBvZiB0aGUgYG1vZHVsZWAgbWV0aG9kIGlzICoqMSoqLlxuICAgIC8vPlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmltcG9ydCAoIG5hbWUsIG9wdGlvbnMgKVxuICAgIC8vPlxuICAgIC8vPiBUaGUgYGltcG9ydGAgbWV0aG9kIGFzeW5jaHJvbm91c2x5IGxvYWRzLCBsaW5rcywgYW5kIGV2YWx1YXRlcyBhIG1vZHVsZVxuICAgIC8vPiBhbmQgYWxsIGl0cyBkZXBlbmRlbmNpZXMuXG4gICAgLy8+XG4gICAgLy8+IGBpbXBvcnRgIHJldHVybnMgYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIHJlcXVlc3RlZCBgTW9kdWxlYFxuICAgIC8vPiBvYmplY3Qgb25jZSBpdCBoYXMgYmVlbiBjb21taXR0ZWQgdG8gdGhlIHJlZ2lzdHJ5IGFuZCBldmFsdWF0ZWQuXG4gICAgLy8+XG4gICAgLy8+IE5PVEUgVGhpcyBpcyB0aGUgZHluYW1pYyBlcXVpdmFsZW50ICh3aGVuIGNvbWJpbmVkIHdpdGggbm9ybWFsaXphdGlvbilcbiAgICAvLz4gb2YgYW4gSW1wb3J0RGVjbGFyYXRpb24uXG4gICAgLy8+XG4gICAgaW1wb3J0OiBmdW5jdGlvbiBpbXBvcnRfKG5hbWUsIG9wdGlvbnMgPSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIC8vPiAzLiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nXG4gICAgICAgIC8vPiAgICAgTG9hZE1vZHVsZShsb2FkZXIsIG5hbWUsIG9wdGlvbnMpLlxuICAgICAgICAvLz4gNC4gIFJldHVybklmQWJydXB0KHApLlxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcbiAgICAgICAgdmFyIHAgPSBMb2FkTW9kdWxlKGxvYWRlciwgbmFtZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgLy8+IDUuICBMZXQgRiBiZSBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gb2JqZWN0IGFzIGRlZmluZWQgYnlcbiAgICAgICAgLy8+ICAgICBFdmFsdWF0ZUxvYWRlZE1vZHVsZS5cbiAgICAgICAgLy8+IDYuICBTZXQgdGhlIFtbTG9hZGVyXV0gZmllbGQgb2YgRiB0byBsb2FkZXIuXG4gICAgICAgIC8vPiA3LiAgTGV0IHAgYmUgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIFByb21pc2VUaGVuKHAsIEYpLlxuICAgICAgICBwID0gY2FsbEZ1bmN0aW9uKHN0ZF9Qcm9taXNlX3RoZW4sIHAsIFxuICAgICAgICAgICAgICAgICAgICAgICAgIE1ha2VDbG9zdXJlX0V2YWx1YXRlTG9hZGVkTW9kdWxlKGxvYWRlcikpO1xuXG4gICAgICAgIC8vPiA4LiAgUmV0dXJuIHAuXG4gICAgICAgIHJldHVybiBwO1xuICAgIH0sXG4gICAgLy8+XG4gICAgLy8+IFRoZSBgbGVuZ3RoYCBwcm9wZXJ0eSBvZiB0aGUgYGltcG9ydGAgbWV0aG9kIGlzICoqMSoqLlxuICAgIC8vPlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmV2YWwgKCBzb3VyY2UgKVxuICAgIC8vPlxuICAgIC8vPiBUaGUgZm9sbG93aW5nIHN0ZXBzIGFyZSB0YWtlbjpcbiAgICAvLz5cbiAgICBldmFsOiBmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgUmV0dXJuIHRoZSByZXN1bHQgb2YgY2FsbGluZyB0aGUgSW5kaXJlY3RFdmFsIGFic3RyYWN0IG9wZXJhdGlvblxuICAgICAgICAvLz4gICAgIHBhc3NpbmcgbG9hZGVyLltbUmVhbG1dXSBhbmQgc291cmNlIGFzIGFyZ3VtZW50cy5cbiAgICAgICAgcmV0dXJuICRJbmRpcmVjdEV2YWwobG9hZGVyRGF0YS5yZWFsbSwgc291cmNlKTtcbiAgICB9LFxuXG5cbiAgICAvLyAjIyMgTW9kdWxlIHJlZ2lzdHJ5XG4gICAgLy9cbiAgICAvLyBFYWNoIGBMb2FkZXJgIGhhcyBhICoqbW9kdWxlIHJlZ2lzdHJ5KiosIGEgY2FjaGUgb2YgYWxyZWFkeSBsb2FkZWQgYW5kXG4gICAgLy8gbGlua2VkIG1vZHVsZXMuICBUaGUgTG9hZGVyIHVzZXMgdGhpcyBtYXAgdG8gYXZvaWQgZmV0Y2hpbmcgbW9kdWxlc1xuICAgIC8vIG11bHRpcGxlIHRpbWVzLlxuICAgIC8vXG4gICAgLy8gVGhlIG1ldGhvZHMgYmVsb3cgc3VwcG9ydCBkaXJlY3RseSBxdWVyeWluZyBhbmQgbW9kaWZ5aW5nIHRoZSByZWdpc3RyeS5cbiAgICAvLyBUaGV5IGFyZSBzeW5jaHJvbm91cyBhbmQgbmV2ZXIgZmlyZSBhbnkgbG9hZGVyIGhvb2tzIG9yIHRyaWdnZXIgbmV3XG4gICAgLy8gbG9hZHMuXG4gICAgLy9cbiAgICAvLyBUaGUgcG9seWZpbGwgZm9yIHRoZXNlIG1ldGhvZHMgZW5kcyB1cCBiZWluZyBzaG9ydGVyIHRoYW4gdGhlXG4gICAgLy8gc3BlY2lmaWNhdGlvbiB0ZXh0IGJlY2F1c2UgdGhleSB1c2UgTWFwcyBpbnRlcm5hbGx5LiBQZXJoYXBzIHRoZVxuICAgIC8vIHNwZWMgd2lsbCBnYWluIGEgZmV3IGFic3RyYWN0aW9ucyBmb3IgJmxkcXVvO2Fzc29jaWF0aW9uIExpc3RzJnJkcXVvOyxcbiAgICAvLyBidXQgdGhlcmUmcnNxdW87cyBub3RoaW5nIGF0IHRoZSBtb21lbnQuXG4gICAgLy9cblxuICAgIC8vPiAjIyMjIExvYWRlci5wcm90b3R5cGUuZ2V0ICggbmFtZSApXG4gICAgLy8+XG4gICAgLy8+IElmIHRoaXMgTG9hZGVyJ3MgbW9kdWxlIHJlZ2lzdHJ5IGNvbnRhaW5zIGEgTW9kdWxlIHdpdGggdGhlIGdpdmVuXG4gICAgLy8+IG5vcm1hbGl6ZWQgbmFtZSwgcmV0dXJuIGl0LiAgT3RoZXJ3aXNlLCByZXR1cm4gdW5kZWZpbmVkLlxuICAgIC8vPlxuICAgIC8vPiBJZiB0aGUgbW9kdWxlIGlzIGluIHRoZSByZWdpc3RyeSBidXQgaGFzIG5ldmVyIGJlZW4gZXZhbHVhdGVkLCBmaXJzdFxuICAgIC8vPiBzeW5jaHJvbm91c2x5IGV2YWx1YXRlIHRoZSBib2RpZXMgb2YgdGhlIG1vZHVsZSBhbmQgYW55IGRlcGVuZGVuY2llc1xuICAgIC8vPiB0aGF0IGhhdmUgbm90IGV2YWx1YXRlZCB5ZXQuXG4gICAgLy8+XG4gICAgLy8+IFdoZW4gdGhlIGBnZXRgIG1ldGhvZCBpcyBjYWxsZWQgd2l0aCBvbmUgYXJndW1lbnQsIHRoZSBmb2xsb3dpbmcgc3RlcHNcbiAgICAvLz4gYXJlIHRha2VuOlxuICAgIC8vPlxuICAgIGdldDogZnVuY3Rpb24gZ2V0KG5hbWUpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgTGV0IG5hbWUgYmUgVG9TdHJpbmcobmFtZSkuXG4gICAgICAgIC8vPiA0LiAgUmV0dXJuSWZBYnJ1cHQobmFtZSkuXG4gICAgICAgIG5hbWUgPSBUb1N0cmluZyhuYW1lKTtcblxuICAgICAgICAvLz4gNS4gIFJlcGVhdCBmb3IgZWFjaCBSZWNvcmQge1tba2V5XV0sIFtbdmFsdWVdXX0gcCB0aGF0IGlzIGFuXG4gICAgICAgIC8vPiAgICAgZWxlbWVudCBvZiBsb2FkZXIuW1tNb2R1bGVzXV0sXG4gICAgICAgIC8vPiAgICAgMS4gIElmIHAuW1trZXldXSBpcyBlcXVhbCB0byBuYW1lLCB0aGVuXG4gICAgICAgIC8vPiAgICAgICAgIDEuICBMZXQgbW9kdWxlIGJlIHAuW1t2YWx1ZV1dLlxuICAgICAgICAvLz4gICAgICAgICAyLiAgTGV0IHJlc3VsdCBiZSB0aGUgcmVzdWx0IG9mIEVuc3VyZUV2YWx1YXRlZChtb2R1bGUsICgpLFxuICAgICAgICAvLz4gICAgICAgICAgICAgbG9hZGVyKS5cbiAgICAgICAgLy8+ICAgICAgICAgMy4gIFJldHVybklmQWJydXB0KHJlc3VsdCkuXG4gICAgICAgIC8vPiAgICAgICAgIDQuICBSZXR1cm4gcC5bW3ZhbHVlXV0uXG4gICAgICAgIC8vPiA2LiAgUmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgICAgbGV0IG0gPSBjYWxsRnVuY3Rpb24oc3RkX01hcF9nZXQsIGxvYWRlckRhdGEubW9kdWxlcywgbmFtZSk7XG4gICAgICAgIGlmIChtICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICBFbnN1cmVFdmFsdWF0ZWRIZWxwZXIobSwgdGhpcyk7XG4gICAgICAgIHJldHVybiBtO1xuICAgIH0sXG4gICAgLy8+XG5cblxuICAgIC8vPiAjIyMjIExvYWRlci5wcm90b3R5cGUuaGFzICggbmFtZSApXG4gICAgLy8+XG4gICAgLy8+IFJldHVybiB0cnVlIGlmIHRoaXMgTG9hZGVyJ3MgbW9kdWxlIHJlZ2lzdHJ5IGNvbnRhaW5zIGEgTW9kdWxlIHdpdGggdGhlXG4gICAgLy8+IGdpdmVuIG5hbWUuIFRoaXMgbWV0aG9kIGRvZXMgbm90IGNhbGwgYW55IGhvb2tzIG9yIHJ1biBhbnkgbW9kdWxlIGNvZGUuXG4gICAgLy8+XG4gICAgLy8+IFRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuICAgIC8vPlxuICAgIGhhczogZnVuY3Rpb24gaGFzKG5hbWUpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgTGV0IG5hbWUgYmUgVG9TdHJpbmcobmFtZSkuXG4gICAgICAgIC8vPiA0LiAgUmV0dXJuSWZBYnJ1cHQobmFtZSkuXG4gICAgICAgIG5hbWUgPSBUb1N0cmluZyhuYW1lKTtcblxuICAgICAgICAvLz4gNS4gIFJlcGVhdCBmb3IgZWFjaCBSZWNvcmQge1tbbmFtZV1dLCBbW3ZhbHVlXV19IHAgdGhhdCBpcyBhblxuICAgICAgICAvLz4gICAgIGVsZW1lbnQgb2YgbG9hZGVyLltbTW9kdWxlc11dLFxuICAgICAgICAvLz4gICAgIDEuICBJZiBwLltba2V5XV0gaXMgZXF1YWwgdG8gbmFtZSwgdGhlbiByZXR1cm4gdHJ1ZS5cbiAgICAgICAgLy8+IDYuICBSZXR1cm4gZmFsc2UuXG4gICAgICAgIHJldHVybiBjYWxsRnVuY3Rpb24oc3RkX01hcF9oYXMsIGxvYWRlckRhdGEubW9kdWxlcywgbmFtZSk7XG4gICAgfSxcbiAgICAvLz5cblxuXG4gICAgLy8+ICMjIyMgTG9hZGVyLnByb3RvdHlwZS5zZXQgKCBuYW1lLCBtb2R1bGUgKVxuICAgIC8vPlxuICAgIC8vPiBTdG9yZSBhIG1vZHVsZSBpbiB0aGlzIExvYWRlcidzIG1vZHVsZSByZWdpc3RyeSwgb3ZlcndyaXRpbmcgYW55XG4gICAgLy8+IGV4aXN0aW5nIGVudHJ5IHdpdGggdGhlIHNhbWUgbmFtZS5cbiAgICAvLz5cbiAgICAvLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgc2V0OiBmdW5jdGlvbiBzZXQobmFtZSwgbW9kdWxlKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSB0aGlzIExvYWRlci5cbiAgICAgICAgLy8+IDIuICBSZXR1cm5JZkFicnVwdChsb2FkZXIpLlxuICAgICAgICBsZXQgbG9hZGVyRGF0YSA9IEdldExvYWRlckludGVybmFsRGF0YSh0aGlzKTtcblxuICAgICAgICAvLz4gMy4gIExldCBuYW1lIGJlIFRvU3RyaW5nKG5hbWUpLlxuICAgICAgICAvLz4gNC4gIFJldHVybklmQWJydXB0KG5hbWUpLlxuICAgICAgICBuYW1lID0gVG9TdHJpbmcobmFtZSk7XG5cbiAgICAgICAgLy8+IDUuICBJZiBtb2R1bGUgZG9lcyBub3QgaGF2ZSBhbGwgdGhlIGludGVybmFsIHNsb3RzIG9mIGEgTW9kdWxlXG4gICAgICAgIC8vPiAgICAgaW5zdGFuY2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAgICAgaWYgKCEkSXNNb2R1bGUobW9kdWxlKSlcbiAgICAgICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXCJNb2R1bGUgb2JqZWN0IHJlcXVpcmVkXCIpO1xuXG4gICAgICAgIC8vPiA2LiAgUmVwZWF0IGZvciBlYWNoIFJlY29yZCB7W1tuYW1lXV0sIFtbdmFsdWVdXX0gcCB0aGF0IGlzIGFuXG4gICAgICAgIC8vPiAgICAgZWxlbWVudCBvZiBsb2FkZXIuW1tNb2R1bGVzXV0sXG4gICAgICAgIC8vPiAgICAgMS4gIElmIHAuW1trZXldXSBpcyBlcXVhbCB0byBuYW1lLFxuICAgICAgICAvLz4gICAgICAgICAxLiAgU2V0IHAuW1t2YWx1ZV1dIHRvIG1vZHVsZS5cbiAgICAgICAgLy8+ICAgICAgICAgMi4gIFJldHVybiBsb2FkZXIuXG4gICAgICAgIC8vPiA3LiAgTGV0IHAgYmUgdGhlIFJlY29yZCB7W1trZXldXTogbmFtZSwgW1t2YWx1ZV1dOiBtb2R1bGV9LlxuICAgICAgICAvLz4gOC4gIEFwcGVuZCBwIGFzIHRoZSBsYXN0IHJlY29yZCBvZiBsb2FkZXIuW1tNb2R1bGVzXV0uXG4gICAgICAgIC8vPiA5LiAgUmV0dXJuIGxvYWRlci5cbiAgICAgICAgY2FsbEZ1bmN0aW9uKHN0ZF9NYXBfc2V0LCBsb2FkZXJEYXRhLm1vZHVsZXMsIG5hbWUsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLy8+XG4gICAgLy9cbiAgICAvLyAqKlRoZSBNb2R1bGUgdHlwZSBjaGVjayBpbiBzZXQoKSoqICZuZGFzaDsgSWYgdGhlIG1vZHVsZSBhcmd1bWVudCBpcyBub3RcbiAgICAvLyBhY3R1YWxseSBhIE1vZHVsZSBpbnN0YW5jZSBvYmplY3QsIGBzZXRgIGZhaWxzLiBUaGlzIGVuZm9yY2VzIGFuXG4gICAgLy8gaW52YXJpYW50IG9mIHRoZSBtb2R1bGUgcmVnaXN0cnk6IGFsbCB0aGUgdmFsdWVzIGFyZSBgTW9kdWxlYFxuICAgIC8vIGluc3RhbmNlcy4gKlJhdGlvbmFsZToqIFdlIHVzZSBgTW9kdWxlYC1zcGVjaWZpYyBvcGVyYXRpb25zIG9uIHRoZW0sXG4gICAgLy8gcGFydGljdWxhcmx5IGZvciBsaW5raW5nIGFuZCBldmFsdWF0aW9uLlxuICAgIC8vXG4gICAgLy8gKipzZXQoKSBhbmQgYWxyZWFkeS1saW5rZWQgbW9kdWxlcyoqICZuZGFzaDsgSWYgdGhlcmUgaXMgYWxyZWFkeSBhXG4gICAgLy8gbW9kdWxlIGluIHRoZSByZWdpc3RyeSB3aXRoIHRoZSBnaXZlbiBmdWxsIG5hbWUsIGBzZXRgIHJlcGxhY2VzIGl0LCBidXRcbiAgICAvLyBhbnkgc2NyaXB0cyBvciBtb2R1bGVzIHRoYXQgYXJlIGxpbmtlZCB0byB0aGUgb2xkIG1vZHVsZSByZW1haW4gbGlua2VkXG4gICAgLy8gdG8gaXQuICpSYXRpb25hbGU6KiBSZS1saW5raW5nIGFscmVhZHktbGlua2VkIG1vZHVsZXMgbWlnaHQgbm90IHdvcmssXG4gICAgLy8gc2luY2UgdGhlIG5ldyBtb2R1bGUgbWF5IGV4cG9ydCBhIGRpZmZlcmVudCBzZXQgb2YgbmFtZXMuIEFsc28sIHRoZSBuZXdcbiAgICAvLyBtb2R1bGUgbWF5IGJlIGxpbmtlZCB0byB0aGUgb2xkIG9uZSEgVGhpcyBpcyBhIGNvbnZlbmllbnQgd2F5IHRvXG4gICAgLy8gbW9ua2V5cGF0Y2ggbW9kdWxlcy4gT25jZSBtb2R1bGVzIGFyZSB3aWRlc3ByZWFkLCB0aGlzIHRlY2huaXF1ZSBjYW4gYmVcbiAgICAvLyB1c2VkIGZvciBwb2x5ZmlsbGluZy5cbiAgICAvL1xuICAgIC8vICoqc2V0KCkgYW5kIGNvbmN1cnJlbnQgbG9hZHMqKiAmbmRhc2g7IElmIGEgTG9hZCBSZWNvcmQgZm9yIGBuYW1lYCBpcyBpblxuICAgIC8vIGB0aGlzLmxvYWRzYCwgYC5zZXQoKWAgc3VjY2VlZHMsIHdpdGggbm8gaW1tZWRpYXRlIGVmZmVjdCBvbiB0aGUgcGVuZGluZ1xuICAgIC8vIGxvYWQ7IGJ1dCBpZiB0aGF0IGxvYWQgaXMgZXZlbnR1YWxseSBsaW5rZWQsIGFuIGVycm9yIHdpbGwgb2NjdXIgYXQgdGhlXG4gICAgLy8gZW5kIG9mIHRoZSBsaW5rIHBoYXNlLCBqdXN0IGJlZm9yZSBhbnkgb2YgdGhlIG5ldyBsaW5rZWQgbW9kdWxlcyBhcmVcbiAgICAvLyBjb21taXR0ZWQgdG8gdGhlIHJlZ2lzdHJ5LlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmRlbGV0ZSAoIG5hbWUgKVxuICAgIC8vPlxuICAgIC8vPiBSZW1vdmUgYW4gZW50cnkgZnJvbSB0aGlzIGxvYWRlcidzIG1vZHVsZSByZWdpc3RyeS5cbiAgICAvLz5cbiAgICAvLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgZGVsZXRlOiBmdW5jdGlvbiBkZWxldGVfKG5hbWUpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgTGV0IG5hbWUgYmUgVG9TdHJpbmcobmFtZSkuXG4gICAgICAgIC8vPiA0LiAgUmV0dXJuSWZBYnJ1cHQobmFtZSkuXG4gICAgICAgIG5hbWUgPSBUb1N0cmluZyhuYW1lKTtcblxuICAgICAgICAvLz4gNS4gIFJlcGVhdCBmb3IgZWFjaCBSZWNvcmQge1tbbmFtZV1dLCBbW3ZhbHVlXV19IHAgdGhhdCBpcyBhblxuICAgICAgICAvLz4gICAgIGVsZW1lbnQgb2YgbG9hZGVyLltbTW9kdWxlc11dLFxuICAgICAgICAvLz4gICAgIDEuICBJZiBwLltba2V5XV0gaXMgZXF1YWwgdG8gbmFtZSxcbiAgICAgICAgLy8+ICAgICAgICAgMS4gIFNldCBwLltba2V5XV0gdG8gZW1wdHkuXG4gICAgICAgIC8vPiAgICAgICAgIDIuICBTZXQgcC5bW3ZhbHVlXV0gdG8gZW1wdHkuXG4gICAgICAgIC8vPiAgICAgICAgIDMuICBSZXR1cm4gdHJ1ZS5cbiAgICAgICAgLy8+IDYuICBSZXR1cm4gZmFsc2UuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIG1vZHVsZSB3aXRoIHRoZSBnaXZlbiBuYW1lIGluIHRoZSByZWdpc3RyeSwgdGhpcyBkb2VzXG4gICAgICAgIC8vIG5vdGhpbmcuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIGBsb2FkZXIuZGVsZXRlKFwiQVwiKWAgaGFzIG5vIGVmZmVjdCBhdCBhbGwgaWZcbiAgICAgICAgLy8gYCFsb2FkZXJEYXRhLm1vZHVsZXMuaGFzKFwiQVwiKWAsIGV2ZW4gaWYgXCJBXCIgaXMgY3VycmVudGx5IGxvYWRpbmcgKGFuXG4gICAgICAgIC8vIGVudHJ5IGV4aXN0cyBpbiBgbG9hZGVyRGF0YS5sb2Fkc2ApLiAgVGhpcyBpcyBhbmFsb2dvdXMgdG8gYC5zZXQoKWAuXG4gICAgICAgIC8vXG4gICAgICAgIHJldHVybiBjYWxsRnVuY3Rpb24oc3RkX01hcF9kZWxldGUsIGxvYWRlckRhdGEubW9kdWxlcywgbmFtZSk7XG4gICAgfSxcbiAgICAvLz5cbiAgICAvL1xuICAgIC8vICoqZGVsZXRlKCkgYW5kIGNvbmN1cnJlbnQgbG9hZHMqKiAmbmRhc2g7IENhbGxpbmcgYC5kZWxldGUoKWAgaGFzIG5vXG4gICAgLy8gaW1tZWRpYXRlIGVmZmVjdCBvbiBpbi1mbGlnaHQgbG9hZHMsIGJ1dCBpdCBjYW4gY2F1c2Ugc3VjaCBhIGxvYWQgdG9cbiAgICAvLyBmYWlsIGxhdGVyLlxuICAgIC8vXG4gICAgLy8gVGhhdCdzIGJlY2F1c2UgdGhlIGRlcGVuZGVuY3ktbG9hZGluZyBhbGdvcml0aG0gKGFib3ZlKSBhc3N1bWVzIHRoYXQgaWZcbiAgICAvLyBpdCBmaW5kcyBhIG1vZHVsZSBpbiB0aGUgcmVnaXN0cnksIGl0IGRvZXNuJ3QgbmVlZCB0byBsb2FkIHRoYXQgbW9kdWxlLlxuICAgIC8vIElmIHNvbWVvbmUgZGVsZXRlcyB0aGF0IG1vZHVsZSBmcm9tIHRoZSByZWdpc3RyeSAoYW5kIGRvZXNuJ3QgcmVwbGFjZSBpdFxuICAgIC8vIHdpdGggc29tZXRoaW5nIGNvbXBhdGlibGUpLCB0aGVuIHdoZW4gbG9hZGluZyBmaW5pc2hlcywgaXQgd2lsbCBmaW5kXG4gICAgLy8gdGhhdCBhIG1vZHVsZSBpdCB3YXMgY291bnRpbmcgb24gaGFzIHZhbmlzaGVkLiAgTGlua2luZyB3aWxsIGZhaWwuXG4gICAgLy9cbiAgICAvLyAqKmRlbGV0ZSgpIGFuZCBhbHJlYWR5LWxpbmtlZCBtb2R1bGVzKiogJm5kYXNoOyBgbG9hZGVyLmRlbGV0ZShcIkFcIilgXG4gICAgLy8gcmVtb3ZlcyBvbmx5IGBBYCBmcm9tIHRoZSByZWdpc3RyeSwgYW5kIG5vdCBvdGhlciBtb2R1bGVzIGxpbmtlZCBhZ2FpbnN0XG4gICAgLy8gYEFgLCBmb3Igc2V2ZXJhbCByZWFzb25zOlxuICAgIC8vXG4gICAgLy8gMS4gV2hhdCBhIG1vZHVsZSBpcyBsaW5rZWQgYWdhaW5zdCBpcyBwcm9wZXJseSBhbiBpbXBsZW1lbnRhdGlvblxuICAgIC8vICAgIGRldGFpbCwgd2hpY2ggdGhlIFwicmVtb3ZlIGV2ZXJ5dGhpbmdcIiBiZWhhdmlvciB3b3VsZCBsZWFrLlxuICAgIC8vXG4gICAgLy8gMi4gVGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZiB3aGF0IGlzIGxpbmtlZCBhZ2FpbnN0IHdoYXQgaXMgYW5cbiAgICAvLyAgICB1bnByZWRpY3RhYmxlIGFtb3VudCBvZiBzdHVmZiwgcG90ZW50aWFsbHkgYSBsb3QuXG4gICAgLy9cbiAgICAvLyAzLiBTb21lIHVzZXMgb2YgbW9kdWxlcyZtZGFzaDtpbiBwYXJ0aWN1bGFyIHBvbHlmaWxsaW5nJm1kYXNoO2ludm9sdmVcbiAgICAvLyAgICBkZWZpbmluZyBhIG5ldyBtb2R1bGUgYE15WGAsIGxpbmtpbmcgaXQgYWdhaW5zdCBzb21lIGJ1c3RlZCBidWlsdC1pblxuICAgIC8vICAgIG1vZHVsZSBgWGAsIHRoZW4gcmVwbGFjaW5nIGBYYCBpbiB0aGUgcmVnaXN0cnkgd2l0aCBgTXlYYC4gU28gaGF2aW5nXG4gICAgLy8gICAgbXVsdGlwbGUgXCJ2ZXJzaW9uc1wiIG9mIGEgbW9kdWxlIGxpbmtlZCB0b2dldGhlciBpcyBhIGZlYXR1cmUsIG5vdCBhXG4gICAgLy8gICAgYnVnLlxuICAgIC8vXG5cblxuICAgIC8vPiAjIyMjIExvYWRlci5wcm90b3R5cGUuZW50cmllcyAoIClcbiAgICAvLz5cbiAgICAvLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW4uXG4gICAgLy8+XG4gICAgZW50cmllczogZnVuY3Rpb24gZW50cmllcygpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgUmV0dXJuIHRoZSByZXN1bHQgb2YgQ3JlYXRlTG9hZGVySXRlcmF0b3IobG9hZGVyLFxuICAgICAgICAvLz4gICAgIGBcImtleSt2YWx1ZVwiYCkuXG4gICAgICAgIHJldHVybiBuZXcgTG9hZGVySXRlcmF0b3IoXG4gICAgICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX01hcF9lbnRyaWVzLCBsb2FkZXJEYXRhLm1vZHVsZXMpKTtcbiAgICB9LFxuICAgIC8vPlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmtleXMgKCApXG4gICAgLy8+XG4gICAgLy8+IFRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuLlxuICAgIC8vPlxuICAgIGtleXM6IGZ1bmN0aW9uIGtleXMoKSB7XG4gICAgICAgIC8vPiAxLiAgTGV0IGxvYWRlciBiZSB0aGlzIExvYWRlci5cbiAgICAgICAgLy8+IDIuICBSZXR1cm5JZkFicnVwdChsb2FkZXIpLlxuICAgICAgICBsZXQgbG9hZGVyRGF0YSA9IEdldExvYWRlckludGVybmFsRGF0YSh0aGlzKTtcblxuICAgICAgICAvLz4gMy4gIFJldHVybiB0aGUgcmVzdWx0IG9mIENyZWF0ZUxvYWRlckl0ZXJhdG9yKGxvYWRlciwgYFwia2V5XCJgKS5cbiAgICAgICAgcmV0dXJuIG5ldyBMb2FkZXJJdGVyYXRvcihcbiAgICAgICAgICAgIGNhbGxGdW5jdGlvbihzdGRfTWFwX2tleXMsIGxvYWRlckRhdGEubW9kdWxlcykpO1xuICAgIH0sXG4gICAgLy8+XG5cblxuICAgIC8vPiAjIyMjIExvYWRlci5wcm90b3R5cGUudmFsdWVzICggKVxuICAgIC8vPlxuICAgIC8vPiBUaGUgZm9sbG93aW5nIHN0ZXBzIGFyZSB0YWtlbi5cbiAgICAvLz5cbiAgICB2YWx1ZXM6IGZ1bmN0aW9uIHZhbHVlcygpIHtcbiAgICAgICAgLy8+IDEuICBMZXQgbG9hZGVyIGJlIHRoaXMgTG9hZGVyLlxuICAgICAgICAvLz4gMi4gIFJldHVybklmQWJydXB0KGxvYWRlcikuXG4gICAgICAgIGxldCBsb2FkZXJEYXRhID0gR2V0TG9hZGVySW50ZXJuYWxEYXRhKHRoaXMpO1xuXG4gICAgICAgIC8vPiAzLiAgUmV0dXJuIHRoZSByZXN1bHQgb2YgQ3JlYXRlTG9hZGVySXRlcmF0b3IobG9hZGVyLCBgXCJ2YWx1ZVwiYCkuXG4gICAgICAgIHJldHVybiBuZXcgTG9hZGVySXRlcmF0b3IoXG4gICAgICAgICAgICBjYWxsRnVuY3Rpb24oc3RkX01hcF92YWx1ZXMsIGxvYWRlckRhdGEubW9kdWxlcykpO1xuICAgIH0sXG5cblxuICAgIC8vICMjIyBMb2FkZXIgaG9va3NcbiAgICAvL1xuICAgIC8vIFRoZXNlIGZpdmUgbWV0aG9kcyBtYXkgYmUgb3ZlcmxvYWRlZCBpbiBhIHN1YmNsYXNzIG9yIGluIGFueSBwYXJ0aWN1bGFyXG4gICAgLy8gTG9hZGVyIGluc3RhbmNlLiBUb2dldGhlciwgdGhleSBnb3Zlcm4gdGhlIHByb2Nlc3Mgb2YgbG9hZGluZyBhIHNpbmdsZVxuICAgIC8vIG1vZHVsZS4gKFRoZXJlIGFyZSBubyBob29rcyBpbnRvIHRoZSBsaW5rIHBoYXNlIG9yIHRoZSBtb2R1bGUgcmVnaXN0cnlcbiAgICAvLyBpdHNlbGYuKVxuICAgIC8vXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLm5vcm1hbGl6ZSAoIG5hbWUsIHJlZmVycmVyTmFtZSwgcmVmZXJyZXJBZGRyZXNzIClcbiAgICAvLz5cbiAgICAvLz4gVGhpcyBob29rIHJlY2VpdmVzIHRoZSBtb2R1bGUgbmFtZSBhcyB3cml0dGVuIGluIHRoZSBpbXBvcnRcbiAgICAvLz4gZGVjbGFyYXRpb24uICBJdCByZXR1cm5zIGEgc3RyaW5nIG9yIGEgdGhlbmFibGUgZm9yIGEgc3RyaW5nLCB0aGUgZnVsbFxuICAgIC8vPiBtb2R1bGUgbmFtZSwgd2hpY2ggaXMgdXNlZCBmb3IgdGhlIHJlc3Qgb2YgdGhlIGltcG9ydCBwcm9jZXNzLiAgSW5cbiAgICAvLz4gcGFydGljdWxhciwgbG9hZGVyLltbTG9hZHNdXSBhbmQgbG9hZGVyLltbTW9kdWxlc11dIGFyZSBib3RoIGtleWVkIGJ5XG4gICAgLy8+IG5vcm1hbGl6ZWQgbW9kdWxlIG5hbWVzLiAgT25seSBhIHNpbmdsZSBsb2FkIGNhbiBiZSBpbiBwcm9ncmVzcyBmb3IgYVxuICAgIC8vPiBnaXZlbiBub3JtYWxpemVkIG1vZHVsZSBuYW1lIGF0IGEgdGltZS4gIFRoZSBtb2R1bGUgcmVnaXN0cnkgY2FuXG4gICAgLy8+IGNvbnRhaW4gYXQgbW9zdCBvbmUgbW9kdWxlIGZvciBhIGdpdmVuIG1vZHVsZSBuYW1lLlxuICAgIC8vPlxuICAgIC8vPiAqV2hlbiB0aGlzIGhvb2sgaXMgY2FsbGVkOiogIFdoZW4gYSBtb2R1bGUgYm9keSBpcyBwYXJzZWQsIG9uY2UgcGVyXG4gICAgLy8+IGRpc3RpbmN0IG1vZHVsZSBzcGVjaWZpZXIgaW4gdGhhdCBtb2R1bGUgYm9keS5cbiAgICAvLz5cbiAgICAvLz4gQWZ0ZXIgY2FsbGluZyB0aGlzIGhvb2ssIGlmIHRoZSBmdWxsIG1vZHVsZSBuYW1lIGlzIGluIHRoZSByZWdpc3RyeSBvclxuICAgIC8vPiB0aGUgbG9hZCB0YWJsZSwgbm8gbmV3IExvYWQgUmVjb3JkIGlzIGNyZWF0ZWQuIE90aGVyd2lzZSB0aGUgbG9hZGVyXG4gICAgLy8+IGtpY2tzIG9mZiBhIG5ldyBMb2FkLCBzdGFydGluZyBieSBjYWxsaW5nIHRoZSBgbG9jYXRlYCBob29rLlxuICAgIC8vPlxuICAgIC8vPiAqRGVmYXVsdCBiZWhhdmlvcjoqICBSZXR1cm4gdGhlIG1vZHVsZSBuYW1lIHVuY2hhbmdlZC5cbiAgICAvLz5cbiAgICAvLz4gV2hlbiB0aGUgbm9ybWFsaXplIG1ldGhvZCBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuICAgIC8vPlxuICAgIG5vcm1hbGl6ZTogZnVuY3Rpb24gbm9ybWFsaXplKG5hbWUsIHJlZmVycmVyTmFtZSwgcmVmZXJyZXJBZGRyZXNzKSB7XG4gICAgICAgIC8vPiAxLiBSZXR1cm4gbmFtZS5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfSxcbiAgICAvLz5cblxuXG4gICAgLy8+ICMjIyMgTG9hZGVyLnByb3RvdHlwZS5sb2NhdGUgKCBsb2FkIClcbiAgICAvLz5cbiAgICAvLz4gR2l2ZW4gYSBub3JtYWxpemVkIG1vZHVsZSBuYW1lLCBkZXRlcm1pbmUgdGhlIHJlc291cmNlIGFkZHJlc3MgKFVSTCxcbiAgICAvLz4gcGF0aCwgZXRjLikgdG8gbG9hZC5cbiAgICAvLz5cbiAgICAvLz4gVGhlIGxvYWRlciBwYXNzZXMgYW4gYXJndW1lbnQsIGxvYWQsIHdoaWNoIGlzIGFuIG9yZGluYXJ5IE9iamVjdCB3aXRoXG4gICAgLy8+IHR3byBvd24gcHJvcGVydGllcy4gYGxvYWQubmFtZWAgaXMgdGhlIG5vcm1hbGl6ZWQgbmFtZSBvZiB0aGUgbW9kdWxlIHRvXG4gICAgLy8+IGJlIGxvY2F0ZWQuICBgbG9hZC5tZXRhZGF0YWAgaXMgYSBuZXcgT2JqZWN0IHdoaWNoIHRoZSBob29rIG1heSB1c2UgZm9yXG4gICAgLy8+IGFueSBwdXJwb3NlLiBUaGUgTG9hZGVyIGRvZXMgbm90IHVzZSB0aGlzIE9iamVjdCBleGNlcHQgdG8gcGFzcyBpdCB0b1xuICAgIC8vPiB0aGUgc3Vic2VxdWVudCBsb2FkZXIgaG9va3MuXG4gICAgLy8+XG4gICAgLy8+IFRoZSBob29rIHJldHVybnMgZWl0aGVyIHRoZSByZXNvdXJjZSBhZGRyZXNzIChhbnkgbm9uLXRoZW5hYmxlIHZhbHVlKVxuICAgIC8vPiBvciBhIHRoZW5hYmxlIGZvciB0aGUgcmVzb3VyY2UgYWRkcmVzcy4gSWYgdGhlIGhvb2sgcmV0dXJucyBhIHRoZW5hYmxlLFxuICAgIC8vPiBsb2FkaW5nIHdpbGwgY29udGludWUgd2l0aCB0aGUgYGZldGNoKClgIGhvb2sgb25jZSB0aGUgcHJvbWlzZSBpc1xuICAgIC8vPiBmdWxmaWxsZWQuXG4gICAgLy8+XG4gICAgLy8+ICpXaGVuIHRoaXMgaG9vayBpcyBjYWxsZWQ6KiAgRm9yIGFsbCBpbXBvcnRzLCBpbW1lZGlhdGVseSBhZnRlciB0aGVcbiAgICAvLz4gYG5vcm1hbGl6ZWAgaG9vayByZXR1cm5zIHN1Y2Nlc3NmdWxseSwgdW5sZXNzIHRoZSBtb2R1bGUgaXMgYWxyZWFkeVxuICAgIC8vPiBsb2FkZWQgb3IgbG9hZGluZy5cbiAgICAvLz5cbiAgICAvLz4gKkRlZmF1bHQgYmVoYXZpb3I6KiAgUmV0dXJuIHRoZSBtb2R1bGUgbmFtZSB1bmNoYW5nZWQuXG4gICAgLy8+XG4gICAgLy8+IE5PVEUgVGhlIGJyb3dzZXIncyBgU3lzdGVtLmxvY2F0ZWAgaG9vayBtYXkgYmUgY29uc2lkZXJhYmx5IG1vcmVcbiAgICAvLz4gY29tcGxleC5cbiAgICAvLz5cbiAgICAvLz4gV2hlbiB0aGUgbG9jYXRlIG1ldGhvZCBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuICAgIC8vPlxuICAgIGxvY2F0ZTogZnVuY3Rpb24gbG9jYXRlKGxvYWQpIHtcbiAgICAgICAgLy8+IDEuIFJldHVybiB0aGUgcmVzdWx0IG9mIEdldChsb2FkLCBgXCJuYW1lXCJgKS5cbiAgICAgICAgcmV0dXJuIGxvYWQubmFtZTtcbiAgICB9LFxuICAgIC8vPlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmZldGNoICggbG9hZCApXG4gICAgLy8+XG4gICAgLy8+IEZldGNoIHRoZSByZXF1ZXN0ZWQgc291cmNlIGZyb20gdGhlIGdpdmVuIGFkZHJlc3MgKHByb2R1Y2VkIGJ5IHRoZVxuICAgIC8vPiBgbG9jYXRlYCBob29rKS5cbiAgICAvLz5cbiAgICAvLz4gVGhpcyBpcyB0aGUgaG9vayB0aGF0IG11c3QgYmUgb3ZlcmxvYWRlZCBpbiBvcmRlciB0byBtYWtlIHRoZSBgaW1wb3J0YFxuICAgIC8vPiBrZXl3b3JkIHdvcmsuXG4gICAgLy8+XG4gICAgLy8+IFRoZSBsb2FkZXIgcGFzc2VzIGFuIGFyZ3VtZW50LCBsb2FkLCB3aGljaCBpcyBhbiBvcmRpbmFyeSBPYmplY3Qgd2l0aFxuICAgIC8vPiB0aHJlZSBvd24gcHJvcGVydGllcy4gYGxvYWQubmFtZWAgYW5kIGBsb2FkLm1ldGFkYXRhYCBhcmUgdGhlIHNhbWVcbiAgICAvLz4gdmFsdWVzIHBhc3NlZCB0byB0aGUgYGxvY2F0ZWAgaG9vay4gYGxvYWQuYWRkcmVzc2AgaXMgdGhlIGFkZHJlc3Mgb2ZcbiAgICAvLz4gdGhlIHJlc291cmNlIHRvIGZldGNoLiAoVGhpcyBpcyB0aGUgdmFsdWUgcHJvZHVjZWQgYnkgdGhlIGBsb2NhdGVgXG4gICAgLy8+IGhvb2suKVxuICAgIC8vPlxuICAgIC8vPiBUaGUgZmV0Y2ggaG9vayByZXR1cm5zIGVpdGhlciBtb2R1bGUgc291cmNlIChhbnkgbm9uLXRoZW5hYmxlIHZhbHVlKSBvclxuICAgIC8vPiBhIHRoZW5hYmxlIGZvciBtb2R1bGUgc291cmNlLlxuICAgIC8vPlxuICAgIC8vPiAqV2hlbiB0aGlzIGhvb2sgaXMgY2FsbGVkOiogIEZvciBhbGwgbW9kdWxlcyB3aG9zZSBzb3VyY2UgaXMgbm90XG4gICAgLy8+IGRpcmVjdGx5IHByb3ZpZGVkIGJ5IHRoZSBjYWxsZXIuICBJdCBpcyBub3QgY2FsbGVkIGZvciB0aGUgbW9kdWxlXG4gICAgLy8+IGJvZGllcyBwcm92aWRlZCBhcyBhcmd1bWVudHMgdG8gYGxvYWRlci5tb2R1bGUoKWAgb3IgYGxvYWRlci5kZWZpbmUoKWAsXG4gICAgLy8+IHNpbmNlIHRob3NlIGRvIG5vdCBuZWVkIHRvIGJlIGZldGNoZWQuIChIb3dldmVyLCB0aGlzIGhvb2sgbWF5IGJlXG4gICAgLy8+IGNhbGxlZCB3aGVuIGxvYWRpbmcgZGVwZW5kZW5jaWVzIG9mIHN1Y2ggbW9kdWxlcy4pXG4gICAgLy8+XG4gICAgLy8+ICpEZWZhdWx0IGJlaGF2aW9yOiogIFRocm93IGEgYFR5cGVFcnJvcmAuXG4gICAgLy8+XG4gICAgLy8+IFdoZW4gdGhlIGZldGNoIG1ldGhvZCBpcyBjYWxsZWQsIHRoZSBmb2xsb3dpbmcgc3RlcHMgYXJlIHRha2VuOlxuICAgIC8vPlxuICAgIGZldGNoOiBmdW5jdGlvbiBmZXRjaChsb2FkKSB7XG4gICAgICAgIC8vPiAxLiBUaHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgIHRocm93IHN0ZF9UeXBlRXJyb3IoXCJMb2FkZXIucHJvdG90eXBlLmZldGNoIHdhcyBjYWxsZWRcIik7XG4gICAgfSxcbiAgICAvLz5cblxuXG4gICAgLy8+ICMjIyMgTG9hZGVyLnByb3RvdHlwZS50cmFuc2xhdGUgKCBsb2FkIClcbiAgICAvLz5cbiAgICAvLz4gT3B0aW9uYWxseSB0cmFuc2xhdGUgdGhlIGdpdmVuIHNvdXJjZSBmcm9tIHNvbWUgb3RoZXIgbGFuZ3VhZ2UgaW50b1xuICAgIC8vPiBFQ01BU2NyaXB0LlxuICAgIC8vPlxuICAgIC8vPiBUaGUgbG9hZGVyIHBhc3NlcyBhbiBhcmd1bWVudCwgbG9hZCwgd2hpY2ggaXMgYW4gb3JkaW5hcnkgT2JqZWN0IHdpdGhcbiAgICAvLz4gZm91ciBvd24gcHJvcGVydGllcy4gYGxvYWQubmFtZWAsIGBsb2FkLm1ldGFkYXRhYCwgYW5kIGBsb2FkLmFkZHJlc3NgXG4gICAgLy8+IGFyZSB0aGUgc2FtZSB2YWx1ZXMgcGFzc2VkIHRvIHRoZSBgZmV0Y2hgIGhvb2suIGBsb2FkLnNvdXJjZWAgaXMgdGhlXG4gICAgLy8+IHNvdXJjZSBjb2RlIHRvIGJlIHRyYW5zbGF0ZWQuIChUaGlzIGlzIHRoZSB2YWx1ZSBwcm9kdWNlZCBieSB0aGVcbiAgICAvLz4gYGZldGNoYCBob29rLilcbiAgICAvLz5cbiAgICAvLz4gVGhlIGhvb2sgcmV0dXJucyBlaXRoZXIgYW4gRUNNQVNjcmlwdCBNb2R1bGVCb2R5IChhbnkgbm9uLVByb21pc2VcbiAgICAvLz4gdmFsdWUpIG9yIGEgdGhlbmFibGUgZm9yIGEgTW9kdWxlQm9keS5cbiAgICAvLz5cbiAgICAvLz4gKldoZW4gdGhpcyBob29rIGlzIGNhbGxlZDoqICBGb3IgYWxsIG1vZHVsZXMsIGluY2x1ZGluZyBtb2R1bGUgYm9kaWVzXG4gICAgLy8+IHBhc3NlZCB0byBgbG9hZGVyLm1vZHVsZSgpYCBvciBgbG9hZGVyLmRlZmluZSgpYC5cbiAgICAvLz5cbiAgICAvLz4gKkRlZmF1bHQgYmVoYXZpb3I6KiAgUmV0dXJuIHRoZSBzb3VyY2UgdW5jaGFuZ2VkLlxuICAgIC8vPlxuICAgIC8vPiBXaGVuIHRoZSB0cmFuc2xhdGUgbWV0aG9kIGlzIGNhbGxlZCwgdGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgdHJhbnNsYXRlOiBmdW5jdGlvbiB0cmFuc2xhdGUobG9hZCkge1xuICAgICAgICAvLz4gMS4gUmV0dXJuIHRoZSByZXN1bHQgb2YgR2V0KGxvYWQsIGBcInNvdXJjZVwiYCkuXG4gICAgICAgIHJldHVybiBsb2FkLnNvdXJjZTtcbiAgICB9LFxuICAgIC8vPlxuXG5cbiAgICAvLz4gIyMjIyBMb2FkZXIucHJvdG90eXBlLmluc3RhbnRpYXRlICggbG9hZCApXG4gICAgLy8+XG4gICAgLy8+IEFsbG93IGEgbG9hZGVyIHRvIG9wdGlvbmFsbHkgcHJvdmlkZSBpbnRlcm9wZXJhYmlsaXR5IHdpdGggb3RoZXIgbW9kdWxlXG4gICAgLy8+IHN5c3RlbXMuXG4gICAgLy8+XG4gICAgLy8+IFRoZSBsb2FkZXIgcGFzc2VzIGFuIGFyZ3VtZW50LCBsb2FkLCB3aGljaCBpcyBhbiBvcmRpbmFyeSBPYmplY3Qgd2l0aFxuICAgIC8vPiBmb3VyIG93biBwcm9wZXJ0aWVzLiBgbG9hZC5uYW1lYCwgYGxvYWQubWV0YWRhdGFgLCBhbmQgYGxvYWQuYWRkcmVzc2BcbiAgICAvLz4gYXJlIHRoZSBzYW1lIHZhbHVlcyBwYXNzZWQgdG8gdGhlIGBmZXRjaGAgYW5kIGB0cmFuc2xhdGVgIGhvb2tzLlxuICAgIC8vPiBgbG9hZC5zb3VyY2VgIGlzIHRoZSB0cmFuc2xhdGVkIG1vZHVsZSBzb3VyY2UuIChUaGlzIGlzIHRoZSB2YWx1ZVxuICAgIC8vPiBwcm9kdWNlZCBieSB0aGUgYHRyYW5zbGF0ZWAgaG9vay4pXG4gICAgLy8+XG4gICAgLy8+IElmIHRoZSBgaW5zdGFudGlhdGVgIGhvb2sgcmV0dXJucyAqKnVuZGVmaW5lZCoqIG9yIGEgdGhlbmFibGUgZm9yIHRoZVxuICAgIC8vPiB2YWx1ZSAqKnVuZGVmaW5lZCoqLCB0aGVuIHRoZSBsb2FkZXIgdXNlcyB0aGUgZGVmYXVsdCBsaW5raW5nIGJlaGF2aW9yLlxuICAgIC8vPiBJdCBwYXJzZXMgc3JjIGFzIGEgTW9kdWxlLCBsb29rcyBhdCBpdHMgaW1wb3J0cywgbG9hZHMgaXRzIGRlcGVuZGVuY2llc1xuICAgIC8vPiBhc3luY2hyb25vdXNseSwgYW5kIGZpbmFsbHkgbGlua3MgdGhlbSB0b2dldGhlciBhbmQgYWRkcyB0aGVtIHRvIHRoZVxuICAgIC8vPiByZWdpc3RyeS5cbiAgICAvLz5cbiAgICAvLz4gT3RoZXJ3aXNlLCB0aGUgaG9vayBzaG91bGQgcmV0dXJuIGEgZmFjdG9yeSBvYmplY3QgKG9yIGEgdGhlbmFibGUgZm9yIGFcbiAgICAvLz4gZmFjdG9yeSBvYmplY3QpIHdoaWNoIHRoZSBsb2FkZXIgd2lsbCB1c2UgdG8gY3JlYXRlIHRoZSBtb2R1bGUgYW5kIGxpbmtcbiAgICAvLz4gaXQgd2l0aCBpdHMgY2xpZW50cyBhbmQgZGVwZW5kZW5jaWVzLlxuICAgIC8vPlxuICAgIC8vPiBUaGUgZm9ybSBvZiBhIGZhY3Rvcnkgb2JqZWN0IGlzOlxuICAgIC8vPlxuICAgIC8vPiAgICAge1xuICAgIC8vPiAgICAgICAgIGRlcHM6IDxhcnJheSBvZiBzdHJpbmdzIChtb2R1bGUgbmFtZXMpPixcbiAgICAvLz4gICAgICAgICBleGVjdXRlOiA8ZnVuY3Rpb24gKE1vZHVsZSwgTW9kdWxlLCAuLi4pIC0+IE1vZHVsZT5cbiAgICAvLz4gICAgIH1cbiAgICAvLz5cbiAgICAvLz4gVGhlIG1vZHVsZSBpcyBleGVjdXRlZCBkdXJpbmcgdGhlIGxpbmtpbmcgcHJvY2Vzcy4gIEZpcnN0IGFsbCBvZiBpdHNcbiAgICAvLz4gZGVwZW5kZW5jaWVzIGFyZSBleGVjdXRlZCBhbmQgbGlua2VkLCBhbmQgdGhlbiBwYXNzZWQgdG8gdGhlIGBleGVjdXRlYFxuICAgIC8vPiBmdW5jdGlvbi4gIFRoZW4gdGhlIHJlc3VsdGluZyBtb2R1bGUgaXMgbGlua2VkIHdpdGggdGhlIGRvd25zdHJlYW1cbiAgICAvLz4gZGVwZW5kZW5jaWVzLlxuICAgIC8vPlxuICAgIC8vPiBOT1RFIFRoaXMgZmVhdHVyZSBpcyBwcm92aWRlZCBpbiBvcmRlciB0byBwZXJtaXQgY3VzdG9tIGxvYWRlcnMgdG9cbiAgICAvLz4gc3VwcG9ydCB1c2luZyBgaW1wb3J0YCB0byBpbXBvcnQgcHJlLUVTNiBtb2R1bGVzIHN1Y2ggYXMgQU1EIG1vZHVsZXMuXG4gICAgLy8+IFRoZSBkZXNpZ24gcmVxdWlyZXMgaW5jcmVtZW50YWwgbGlua2luZyB3aGVuIHN1Y2ggbW9kdWxlcyBhcmUgcHJlc2VudCxcbiAgICAvLz4gYnV0IGl0IGVuc3VyZXMgdGhhdCBtb2R1bGVzIGltcGxlbWVudGVkIHdpdGggc3RhbmRhcmQgc291cmNlLWxldmVsXG4gICAgLy8+IG1vZHVsZSBkZWNsYXJhdGlvbnMgY2FuIHN0aWxsIGJlIHN0YXRpY2FsbHkgdmFsaWRhdGVkLlxuICAgIC8vPlxuICAgIC8vPiAqV2hlbiB0aGlzIGhvb2sgaXMgY2FsbGVkOiogRm9yIGFsbCBtb2R1bGVzLCBhZnRlciB0aGUgYHRyYW5zbGF0ZWBcbiAgICAvLz4gaG9vay5cbiAgICAvLz5cbiAgICAvLz4gKkRlZmF1bHQgYmVoYXZpb3I6KiAgUmV0dXJuIHVuZGVmaW5lZC5cbiAgICAvLz5cbiAgICAvLz4gV2hlbiB0aGUgaW5zdGFudGlhdGUgbWV0aG9kIGlzIGNhbGxlZCwgdGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgaW5zdGFudGlhdGU6IGZ1bmN0aW9uIGluc3RhbnRpYXRlKGxvYWQpIHtcbiAgICAgICAgLy8+IDEuIFJldHVybiAqKnVuZGVmaW5lZCoqLlxuICAgIH1cbiAgICAvLz5cbn0pO1xuXG5cbi8vPiAjIyMjIExvYWRlci5wcm90b3R5cGVbQEBpdGVyYXRvcl0gKCApXG4vLz5cbi8vPiBUaGUgaW5pdGlhbCB2YWx1ZSBvZiB0aGUgQEBpdGVyYXRvciBwcm9wZXJ0eSBpcyB0aGUgc2FtZSBmdW5jdGlvblxuLy8+IG9iamVjdCBhcyB0aGUgaW5pdGlhbCB2YWx1ZSBvZiB0aGUgZW50cmllcyBwcm9wZXJ0eS5cbmRlZihMb2FkZXIucHJvdG90eXBlLCB7XCJAQGl0ZXJhdG9yXCI6IExvYWRlci5wcm90b3R5cGUuZW50cmllc30pO1xuXG5cblxuLy8+ICMjIyBMb2FkZXIgSXRlcmF0b3IgT2JqZWN0c1xuLy8+XG4vLz4gQSBMb2FkZXIgSXRlcmF0b3Igb2JqZWN0IHJlcHJlc2VudHMgYSBzcGVjaWZpYyBpdGVyYXRpb24gb3ZlciB0aGUgbW9kdWxlXG4vLz4gcmVnaXN0cnkgb2Ygc29tZSBzcGVjaWZpYyBMb2FkZXIgaW5zdGFuY2Ugb2JqZWN0LlxuLy8+XG4vLz4gTG9hZGVyIEl0ZXJhdG9yIG9iamVjdHMgYXJlIHNpbWlsYXIgaW4gc3RydWN0dXJlIHRvIE1hcCBJdGVyYXRvciBvYmplY3RzLlxuLy8+IFRoZXkgYXJlIGNyZWF0ZWQgd2l0aCB0aHJlZSBpbnRlcm5hbCBzbG90czpcbi8vPlxuLy8+ICAgKiBbW0xvYWRlcl1dICZuZGFzaDsgVGhlIExvYWRlciBvYmplY3Qgd2hvc2UgbW9kdWxlIHJlZ2lzdHJ5IGlzIGJlaW5nXG4vLz4gICAgIGl0ZXJhdGVkLlxuLy8+XG4vLz4gICAqIFtbTW9kdWxlTWFwTmV4dEluZGV4XV0gJm5kYXNoOyBUaGUgaW50ZWdlciBpbmRleCBvZiB0aGUgbmV4dCBlbGVtZW50IG9mXG4vLz4gICAgIFtbTG9hZGVyXV0uW1tNb2R1bGVzXV0gdG8gYmUgZXhhbWluZWQgYnkgdGhpcyBpdGVyYXRpb24uXG4vLz5cbi8vPiAgICogW1tNYXBJdGVyYXRpb25LaW5kXV0gJm5kYXNoOyBBIHN0cmluZyB2YWx1ZSB0aGF0IGlkZW50aWZpZXMgd2hhdCBpcyB0b1xuLy8+ICAgICBiZSByZXR1cm5lZCBmb3IgZWFjaCBlbGVtZW50IG9mIHRoZSBpdGVyYXRpb24uIFRoZSBwb3NzaWJsZSB2YWx1ZXMgYXJlOlxuLy8+ICAgICBgXCJrZXlcImAsIGBcInZhbHVlXCJgLCBgXCJrZXkrdmFsdWVcImAuXG4vLz5cblxuLy8+ICMjIyMgQ3JlYXRlTG9hZGVySXRlcmF0b3IobG9hZGVyLCBraW5kKSBBYnN0cmFjdCBPcGVyYXRpb25cbi8vPlxuLy8+IFNldmVyYWwgbWV0aG9kcyBvZiBMb2FkZXIgb2JqZWN0cyByZXR1cm4gTG9hZGVyIEl0ZXJhdG9yIG9iamVjdHMuIFRoZVxuLy8+IGFic3RyYWN0IGl0ZXJhdGlvbiBDcmVhdGVMb2FkZXJJdGVyYXRvciBpcyB1c2VkIHRvIGNyZWF0ZSBzdWNoIGl0ZXJhdG9yXG4vLz4gb2JqZWN0cy4gSXQgcGVyZm9ybXMgdGhlIGZvbGxvd2luZyBzdGVwczpcbi8vPlxuLy8+IDEuICBBc3NlcnQ6IFR5cGUobG9hZGVyKSBpcyBPYmplY3QuXG4vLz4gMi4gIEFzc2VydDogbG9hZGVyIGhhcyBhbGwgdGhlIGludGVybmFsIHNsb3RzIG9mIGEgTG9hZGVyIG9iamVjdC5cbi8vPiAzLiAgTGV0IGl0ZXJhdG9yIGJlIHRoZSByZXN1bHQgb2YgT2JqZWN0Q3JlYXRlKCVMb2FkZXJJdGVyYXRvclByb3RvdHlwZSUsXG4vLz4gICAgIChbW0xvYWRlcl1dLCBbW01vZHVsZU1hcE5leHRJbmRleF1dLCBbW01hcEl0ZXJhdGlvbktpbmRdXSkpLlxuLy8+IDQuICBTZXQgaXRlcmF0b3IuW1tMb2FkZXJdXSB0byBsb2FkZXIuXG4vLz4gNS4gIFNldCBpdGVyYXRvci5bW01vZHVsZU1hcE5leHRJbmRleF1dIHRvIDAuXG4vLz4gNi4gIFNldCBpdGVyYXRvci5bW01hcEl0ZXJhdGlvbktpbmRdXSB0byBraW5kLlxuLy8+IDcuICBSZXR1cm4gaXRlcmF0b3IuXG4vLz5cbmZ1bmN0aW9uIExvYWRlckl0ZXJhdG9yKGl0ZXJhdG9yKSB7XG4gICAgJFNldExvYWRlckl0ZXJhdG9yUHJpdmF0ZSh0aGlzLCBpdGVyYXRvcik7XG59XG5cbi8vPiAjIyMjIFRoZSAlTG9hZGVySXRlcmF0b3JQcm90b3R5cGUlIE9iamVjdFxuLy8+XG4vLz4gQWxsIExvYWRlciBJdGVyYXRvciBPYmplY3RzIGluaGVyaXQgcHJvcGVydGllcyBmcm9tIHRoZVxuLy8+ICVMb2FkZXJJdGVyYXRvclByb3RvdHlwZSUgaW50cmluc2ljIG9iamVjdC4gIFRoZSAlTG9hZGVySXRlcmF0b3JQcm90b3R5cGUlXG4vLz4gaW50cmluc2ljIG9iamVjdCBpcyBhbiBvcmRpbmFyeSBvYmplY3QgYW5kIGl0cyBbW1Byb3RvdHlwZV1dIGludGVybmFsIHNsb3Rcbi8vPiBpcyB0aGUgJU9iamVjdFByb3RvdHlwZSUgaW50cmluc2ljIG9iamVjdC4gSW4gYWRkaXRpb24sXG4vLz4gJUxvYWRlckl0ZXJhdG9yUHJvdG90eXBlJSBoYXMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuLy8+XG5Mb2FkZXJJdGVyYXRvci5wcm90b3R5cGUgPSB7XG4gICAgLy8+ICMjIyMjICVMb2FkZXJJdGVyYXRvclByb3RvdHlwZSUubmV4dCAoIClcbiAgICAvLz5cbiAgICAvLz4gMS4gIExldCBPIGJlIHRoZSB0aGlzIHZhbHVlLlxuICAgIC8vPiAyLiAgSWYgVHlwZShPKSBpcyBub3QgT2JqZWN0LCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgLy8+IDMuICBJZiBPIGRvZXMgbm90IGhhdmUgYWxsIG9mIHRoZSBpbnRlcm5hbCBwcm9wZXJ0aWVzIG9mIGEgTG9hZGVyXG4gICAgLy8+ICAgICBJdGVyYXRvciBJbnN0YW5jZSwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgIC8vPiA0LiAgTGV0IGxvYWRlciBiZSB0aGUgdmFsdWUgb2YgdGhlIFtbTG9hZGVyXV0gaW50ZXJuYWwgc2xvdCBvZiBPLlxuICAgIC8vPiA1LiAgTGV0IGluZGV4IGJlIHRoZSB2YWx1ZSBvZiB0aGUgW1tNb2R1bGVNYXBOZXh0SW5kZXhdXSBpbnRlcm5hbCBzbG90XG4gICAgLy8+ICAgICBvZiBPLlxuICAgIC8vPiA2LiAgTGV0IGl0ZW1LaW5kIGJlIHRoZSB2YWx1ZSBvZiB0aGUgW1tNYXBJdGVyYXRpb25LaW5kXV0gaW50ZXJuYWwgc2xvdFxuICAgIC8vPiAgICAgb2YgTy5cbiAgICAvLz4gNy4gIEFzc2VydDogbG9hZGVyIGhhcyBhIFtbTW9kdWxlc11dIGludGVybmFsIHNsb3QgYW5kIGxvYWRlciBoYXMgYmVlblxuICAgIC8vPiAgICAgaW5pdGlhbGlzZWQgc28gdGhlIHZhbHVlIG9mIGxvYWRlci5bW01vZHVsZXNdXSBpcyBub3QgdW5kZWZpbmVkLlxuICAgIC8vPiA4LiAgUmVwZWF0IHdoaWxlIGluZGV4IGlzIGxlc3MgdGhhbiB0aGUgdG90YWwgbnVtYmVyIG9mIGVsZW1lbnRzIG9mXG4gICAgLy8+ICAgICBsb2FkZXIuW1tNb2R1bGVzXV0sXG4gICAgLy8+ICAgICAxLiAgTGV0IGUgYmUgdGhlIFJlY29yZCB7W1trZXldXSwgW1t2YWx1ZV1dfSBhdCAwLW9yaWdpbmVkXG4gICAgLy8+ICAgICAgICAgaW5zZXJ0aW9uIHBvc2l0aW9uIGluZGV4IG9mIGxvYWRlci5bW01vZHVsZXNdXS5cbiAgICAvLz4gICAgIDIuICBTZXQgaW5kZXggdG8gaW5kZXggKyAxLlxuICAgIC8vPiAgICAgMy4gIFNldCB0aGUgW1tNb2R1bGVNYXBOZXh0SW5kZXhdXSBpbnRlcm5hbCBzbG90IG9mIE8gdG8gaW5kZXguXG4gICAgLy8+ICAgICA0LiAgSWYgZS5bW2tleV1dIGlzIG5vdCBlbXB0eSwgdGhlblxuICAgIC8vPiAgICAgICAgIDEuICBJZiBpdGVtS2luZCBpcyBgXCJrZXlcImAsIHRoZW4gbGV0IHJlc3VsdCBiZSBlLltba2V5XV0uXG4gICAgLy8+ICAgICAgICAgMi4gIEVsc2UgaWYgaXRlbUtpbmQgaXMgYFwidmFsdWVcImAsIHRoZW4gbGV0IHJlc3VsdCBiZVxuICAgIC8vPiAgICAgICAgICAgICBlLltbdmFsdWVdXS5cbiAgICAvLz4gICAgICAgICAzLiAgRWxzZSxcbiAgICAvLz4gICAgICAgICAgICAgMS4gIEFzc2VydDogaXRlbUtpbmQgaXMgYFwia2V5K3ZhbHVlXCJgLlxuICAgIC8vPiAgICAgICAgICAgICAyLiAgTGV0IHJlc3VsdCBiZSB0aGUgcmVzdWx0IG9mIEFycmF5Q3JlYXRlKDIpLlxuICAgIC8vPiAgICAgICAgICAgICAzLiAgQXNzZXJ0OiByZXN1bHQgaXMgYSBuZXcsIHdlbGwtZm9ybWVkIEFycmF5IG9iamVjdCBzb1xuICAgIC8vPiAgICAgICAgICAgICAgICAgdGhlIGZvbGxvd2luZyBvcGVyYXRpb25zIHdpbGwgbmV2ZXIgZmFpbC5cbiAgICAvLz4gICAgICAgICAgICAgNC4gIENhbGwgQ3JlYXRlT3duRGF0YVByb3BlcnR5KHJlc3VsdCwgYFwiMFwiYCwgZS5bW2tleV1dKS5cbiAgICAvLz4gICAgICAgICAgICAgNS4gIENhbGwgQ3JlYXRlT3duRGF0YVByb3BlcnR5KHJlc3VsdCwgYFwiMVwiYCwgZS5bW3ZhbHVlXV0pLlxuICAgIC8vPiAgICAgICAgIDQuICBSZXR1cm4gQ3JlYXRlSXRlclJlc3VsdE9iamVjdChyZXN1bHQsIGZhbHNlKS5cbiAgICAvLz4gOS4gIFJldHVybiBDcmVhdGVJdGVyUmVzdWx0T2JqZWN0KHVuZGVmaW5lZCwgdHJ1ZSkuXG4gICAgLy8+XG4gICAgLy8gVGhlIGltcGxlbWVudGF0aW9uIGlzIG9uZSBsaW5lIG9mIGNvZGUsIGRlbGVnYXRpbmcgdG9cbiAgICAvLyBNYXBJdGVyYXRvci5wcm90b3R5cGUubmV4dC5cbiAgICAvL1xuICAgIG5leHQ6IGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICAgIHJldHVybiBjYWxsRnVuY3Rpb24oc3RkX01hcF9pdGVyYXRvcl9uZXh0LCAkR2V0TG9hZGVySXRlcmF0b3JQcml2YXRlKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgLy8+ICMjIyMjICVMb2FkZXJJdGVyYXRvclByb3RvdHlwZSUgWyBAQGl0ZXJhdG9yIF0gKClcbiAgICAvLz5cbiAgICAvLz4gVGhlIGZvbGxvd2luZyBzdGVwcyBhcmUgdGFrZW46XG4gICAgLy8+XG4gICAgXCJAQGl0ZXJhdG9yXCI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8+IDEuICBSZXR1cm4gdGhlIHRoaXMgdmFsdWUuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLy8+XG4gICAgLy8+IFRoZSB2YWx1ZSBvZiB0aGUgYG5hbWVgIHByb3BlcnR5IG9mIHRoaXMgZnVuY3Rpb24gaXNcbiAgICAvLz4gYFwiW1N5bWJvbC5pdGVyYXRvcl1cImAuXG4gICAgLy8+XG4gICAgLy8gSW1wbGVtZW50YXRpb24gYnVnOiBcIkBAaXRlcmF0b3JcIiBzaG91bGQgb2YgY291cnNlIGJlIFtTeW1ib2wuaXRlcmF0b3JdLlxuICAgIC8vIFRoaXMgd2lsbCBiZSB1cGRhdGVkIG9uY2UgU3ltYm9scyBhcmUgaW1wbGVtZW50ZWQuXG4gICAgLy9cblxuICAgIC8vPiAjIyMjIyAlTG9hZGVySXRlcmF0b3JQcm90b3R5cGUlIFsgQEB0b1N0cmluZ1RhZyBdXG4gICAgLy8+XG4gICAgLy8+IFRoZSBpbml0aWFsIHZhbHVlIG9mIHRoZSBAQHRvU3RyaW5nVGFnIHByb3BlcnR5IGlzIHRoZSBzdHJpbmcgdmFsdWVcbiAgICAvLz4gYFwiTG9hZGVyIEl0ZXJhdG9yXCJgLlxuICAgIC8vPlxuICAgIFwiQEB0b1N0cmluZ1RhZ1wiOiBcIkxvYWRlciBJdGVyYXRvclwiXG59O1xuXG59KSh0aGlzKTtcbiJdfQ==
(function() {})();

//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGliL3lsb2FkZXIuanMuZXM2Iiwic291cmNlcyI6WyJsaWIveWxvYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxDQUFDLFFBQUEsQ0FBVSxDQUFFLEVBQUEsQ0FBQSxDQUVYLENBQUEsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiAoKSB7XG4gICAgLy8geWxvYWRlclxufSkoKTtcbiJdfQ==