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
  this.encoder = opts.encoder || null
  this.decoder = opts.decoder || null
  this.binaryData = opts.binaryData || false
  this.redis = opts.client || new Redis({
    host: opts.host,
    dropBufferSupport: !this.binaryData
  })
  this.stopping = false
}

inherits(ShapeOfQ, EventEmitter)

ShapeOfQ.prototype.pull = function (opts, cb) {
  const readQueue = () => {
    debug('Reading from the queue')
    if (this.binaryData === true) {
      this.redis.rpopBuffer(this.queueName, onResult)
    } else {
      this.redis.rpop(this.queueName, onResult)
    }
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  const polling = opts.polling === true
  const pollingInterval = opts.pollingInterval || 10
  process.nextTick(readQueue)

  const onResult = (err, message) => {
    const done = (err) => {
      if (err) this.push(message)
      if (polling === true && this.stopping === false) {
        process.nextTick(readQueue)
      }
    }

    if (err) {
      debug('An error occured while reading from the queue', err)
      this.emit('error', err)
      return
    }

    if (message === null) {
      if (polling === true && this.stopping === false) {
        debug(`Queue is empty, read again in ${pollingInterval} seconds`)
        setTimeout(readQueue, pollingInterval * 1000)
        return
      } else {
        debug('Queue is empty')
      }
    } else {
      debug('Got a message:', message)
    }

    if (message !== null) {
      if (this.encoding === 'json') {
        try {
          message = JSON.parse(message)
        } catch (err) {
          this.emit('error', err)
          return
        }
      } else if (this.decoder !== null) {
        message = this.decoder(message)
      }
    }

    const exec = cb(message, done)
    if (exec != null && typeof exec.then === 'function') {
      exec.then(() => done(), err => done(err))
    }
  }
}

ShapeOfQ.prototype.push = function (message) {
  if (this.encoding === 'json') {
    message = JSON.stringify(message)
  } else if (this.encoder !== null) {
    message = this.encoder(message)
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

ShapeOfQ.prototype.stop = function (cb) {
  debug('Closing queue')
  this.stopping = true

  if (cb === undefined) {
    return new Promise((resolve, reject) => {
      this.redis.quit(err => {
        err ? reject(err) : resolve()
      })
    })
  }

  this.redis.quit(cb)
}

ShapeOfQ.prototype.flush = function (cb) {
  debug('Flushing queue')

  if (cb === undefined) {
    return new Promise((resolve, reject) => {
      this.redis.del(this.queueName, (err) => {
        err ? reject(err) : resolve()
      })
    })
  }

  this.redis.del(this.queueName, cb)
}

module.exports = ShapeOfQ
