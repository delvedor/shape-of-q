'use strict'

const test = require('tap').test
const randomstring = require('randomstring')
const ShapeOfQ = require('./index')

test('Should create a fifo queue', t => {
  t.plan(3)
  const q = ShapeOfQ(randomstring.generate())
  q.on('error', t.error)
  const messages = ['hello', 'world', 'last']
  messages.forEach(msg => q.push(msg))

  q.pull({ polling: true, pollingInterval: 1 }, (msg, done) => {
    t.strictEqual(msg, messages.shift())
    if (messages.length === 0) q.stop()
    done()
  })
})

test('Should create a lifo queue', t => {
  t.plan(3)
  const q = ShapeOfQ(randomstring.generate(), { type: 'lifo' })
  q.on('error', t.error)
  const messages = ['hello', 'world', 'first']
  messages.forEach(msg => q.push(msg))

  q.pull({ polling: true, pollingInterval: 1 }, (msg, done) => {
    t.strictEqual(msg, messages.pop())
    if (messages.length === 0) q.stop()
    done()
  })
})

test('Should handle json encoding', t => {
  t.plan(1)
  const q = ShapeOfQ(randomstring.generate(), { encoding: 'json' })
  q.on('error', t.error)
  q.push({ hello: 'world' })

  q.pull({ polling: true, pollingInterval: 1 }, (msg, done) => {
    t.deepEqual(msg, { hello: 'world' })
    q.stop()
    done()
  })
})

test('Should support promises', t => {
  t.plan(3)
  const q = ShapeOfQ(randomstring.generate())
  q.on('error', t.error)
  const messages = ['hello', 'world', 'last']
  messages.forEach(msg => q.push(msg))

  q.pull({ polling: true, pollingInterval: 1 }, (msg) => {
    return new Promise((resolve, reject) => {
      t.strictEqual(msg, messages.shift())
      if (messages.length === 0) q.stop()
      resolve()
    })
  })
})

test('If an error is returned it should put it again in the queue', t => {
  t.plan(2)
  const q = ShapeOfQ(randomstring.generate())
  q.on('error', t.error)
  q.push('hello')
  var first = true

  q.pull({ polling: true, pollingInterval: 1 }, (msg, done) => {
    t.strictEqual(msg, 'hello')
    if (first) {
      first = false
      done(new Error('kaboom'))
    } else {
      q.stop()
      done()
    }
  })
})

test('List elements of a queue', t => {
  t.plan(2)
  const q = ShapeOfQ(randomstring.generate())
  q.on('error', t.error)
  const messages = ['hello', 'world', 'last']
  messages.forEach(msg => q.push(msg))

  q.list((err, elements) => {
    t.error(err)
    t.deepEqual(elements, messages.reverse())
    q.stop()
  })
})

test('List elements of a queue (with promises)', t => {
  t.plan(1)
  const q = ShapeOfQ(randomstring.generate())
  q.on('error', t.error)
  const messages = ['hello', 'world', 'last']
  messages.forEach(msg => q.push(msg))

  q.list()
    .then(elements => {
      t.deepEqual(elements, messages.reverse())
      q.stop()
    })
    .catch(err => {
      t.fail(err)
      q.stop()
    })
})
