'use strict'

// once the benchmark has finished you must kill the process

const bench = require('fastbench')
const ShapeOfQ = require('./index')
const randomstring = require('randomstring')

const stringQ = ShapeOfQ(randomstring.generate())
const jsonQ = ShapeOfQ(randomstring.generate(), { encoding: 'json' })

const run = bench([
  function benchStringQPush (finish) {
    stringQ.push('hello world 42')
    finish()
  },
  function benchStringQPull (finish) {
    stringQ.pull((msg, done) => {
      done()
      finish()
    })
  },

  function benchJsonQPush (finish) {
    jsonQ.push({ hello: 'world', answer: 42 })
    finish()
  },
  function benchJsonQPull (finish) {
    jsonQ.pull((msg, done) => {
      done()
      finish()
    })
  }
], 1000)

run(run)
