'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const assert = require('assert')
const debug = require('debug')('shapeofq')
const Redis = require('ioredis')

function ShapeOfQ (queueName, opts) {
  if (!(this instanceof ShapeOfQ)) {
    return new ShapeOfQ(queueName, opts)
  }

  assert(queueName, 'Missing queue name')
  opts = opts || {}
  this.queueName = queueName
  this.encoding = opts.encoding || null
  this.type = opts.type || 'fifo'
  this.redis = opts.client || new Redis({ host: opts.host })
  this.stopping = false
}

inherits(ShapeOfQ, EventEmitter)

ShapeOfQ.prototype.pull = function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts
    opts = {}
  }

  const polling = opts.polling === true
  const pollingInterval = opts.pollingInterval || 10
  const that = this
  process.nextTick(readQueue)

  function readQueue () {
    debug('Reading from the queue')
    that.redis.rpop(that.queueName, onResult)
  }

  function onResult (err, result) {
    if (err) {
      debug('An error occured while reading from the queue', err)
      that.emit('error', err)
      return
    }

    if (result === null) {
      if (polling === true && that.stopping === false) {
        debug(`Queue is empty, read again in ${pollingInterval} seconds`)
        setTimeout(readQueue, pollingInterval * 1000)
      } else {
        debug('Queue is empty')
      }
      return
    }

    debug('Got a message:', result)
    if (that.encoding === 'json') {
      try {
        result = JSON.parse(result)
      } catch (err) {
        that.emit('error', err)
        return
      }
    }

    const exec = callback(result, done)
    if (exec != null && typeof exec.then === 'function') {
      exec.then(() => done(), err => done(err))
    }

    function done (err) {
      if (err) that.push(result)
      if (polling === true && that.stopping === false) {
        process.nextTick(readQueue)
      }
    }
  }
}

ShapeOfQ.prototype.push = function (message) {
  if (this.encoding === 'json') {
    message = JSON.stringify(message)
  }

  const onPush = err => err && this.emit('error', err)

  if (this.type === 'fifo') {
    debug('Pushing message to fifo queue:', message)
    this.redis.lpush(this.queueName, message, onPush)
  } else if (this.type === 'lifo') {
    debug('Pushing message to lifo queue:', message)
    this.redis.rpush(this.queueName, message, onPush)
  }
}

ShapeOfQ.prototype.list = function (cb) {
  if (cb === undefined) {
    return new Promise((resolve, reject) => {
      this.redis.lrange(this.queueName, 0, -1, (err, elements) => {
        err ? reject(err) : resolve(elements)
      })
    })
  }

  this.redis.lrange(this.queueName, 0, -1, cb)
}

ShapeOfQ.prototype.stop = function (done) {
  debug('Closing queue')
  this.stopping = true

  if (done === undefined) {
    return new Promise((resolve, reject) => {
      this.redis.quit(err => {
        err ? reject(err) : resolve()
      })
    })
  }

  this.redis.quit(done)
}

module.exports = ShapeOfQ
