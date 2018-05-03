'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const assert = require('assert')
const debug = require('debug')('shapeofq')
const Redis = require('ioredis')
const FJS = require('fast-json-stringify')

const serializeObjectMessage = FJS({
  type: 'object',
  properties: {
    retry: { type: 'integer' },
    payload: {
      type: 'object',
      additionalProperties: true
    }
  }
})

const serializeStringMessage = FJS({
  type: 'object',
  properties: {
    retry: { type: 'integer' },
    payload: { type: 'string' }
  }
})

function ShapeOfQ (queueName, opts) {
  if (!(this instanceof ShapeOfQ)) {
    return new ShapeOfQ(queueName, opts)
  }

  assert(queueName, 'Missing queue name')
  opts = opts || {}
  this.queueName = queueName
  this.encoding = opts.encoding || null
  this.type = opts.type || 'fifo'
  this.retries = opts.retries || 5
  this.redis = opts.client || new Redis({
    host: opts.host,
    dropBufferSupport: true
  })
  this.stopping = false
}

inherits(ShapeOfQ, EventEmitter)

ShapeOfQ.prototype.pull = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  const polling = opts.polling === true
  const pollingInterval = opts.pollingInterval || 10

  const readQueue = () => {
    if (this.stopping === true) return
    debug('Reading from the queue')
    this.redis.rpop(this.queueName, onResult)
  }

  const onResult = (err, message) => {
    const done = (err) => {
      if (err != null && message !== null) {
        if (message.retry < this.retries) {
          debug('Queue handler has errored, put the message back into the queue', err.message, message)
          this.push(message.payload, { _retry: message.retry + 1 })
        } else {
          this.emit('error', new Error('Broken message'), message.payload)
        }
      }

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

      try {
        message = JSON.parse(message)
      } catch (err) {
        this.emit('error', err)
        return
      }
    }

    const exec = cb(message ? message.payload : null, done)
    if (exec != null && typeof exec.then === 'function') {
      exec.then(() => done(), err => done(err))
    }
  }

  process.nextTick(readQueue)
}

ShapeOfQ.prototype.push = function (payload, opts) {
  opts = opts || {}

  const onPush = err => err && this.emit('error', err)
  const message = { retry: opts._retry || 0, payload }

  if (this.type === 'fifo') {
    debug('Pushing message to fifo queue:', message)
    this.redis.lpush(
      this.queueName,
      typeof payload === 'string'
        ? serializeStringMessage(message)
        : serializeObjectMessage(message),
      onPush
    )
  } else if (this.type === 'lifo') {
    debug('Pushing message to lifo queue:', message)
    this.redis.rpush(
      this.queueName,
      typeof payload === 'string'
        ? serializeStringMessage(message)
        : serializeObjectMessage(message),
      onPush
    )
  }
}

ShapeOfQ.prototype.list = function (cb) {
  const onMessages = (err, messages) => {
    if (err) return cb(err)

    try {
      var payloads = messages.map(msg => JSON.parse(msg).payload)
    } catch (err) {
      return cb(err)
    }

    cb(null, payloads)
  }

  if (cb === undefined) {
    return new Promise((resolve, reject) => {
      this.list((err, payloads) => {
        err ? reject(err) : resolve(payloads)
      })
    })
  }

  this.redis.lrange(this.queueName, 0, -1, onMessages)
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
