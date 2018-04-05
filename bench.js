'use strict'

// once the benchmark has finished you must kill the process

const bench = require('fastbench')
const ShapeOfQ = require('./index')
const randomstring = require('randomstring')
const msgpack = require('msgpack5')()
const protobuf = require('protocol-buffers')
const messages = protobuf(`
  message hello {
    required string hello = 1;
    required float answer = 2;
  }
`)

const stringQ = ShapeOfQ(randomstring.generate())
const jsonQ = ShapeOfQ(randomstring.generate(), { encoding: 'json' })
const msgpackQ = ShapeOfQ(randomstring.generate(), {
  encoder: msgpack.encode,
  decoder: msgpack.decode,
  binaryData: true
})
const protobufQ = ShapeOfQ(randomstring.generate(), {
  encoder: messages.hello.encode,
  decoder: messages.hello.decode,
  binaryData: true
})

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
  },

  function benchMsgpackQPush (finish) {
    msgpackQ.push({ hello: 'world', answer: 42 })
    finish()
  },
  function benchMsgpackQPull (finish) {
    msgpackQ.pull((msg, done) => {
      done()
      finish()
    })
  },

  function benchjProtobufQPush (finish) {
    protobufQ.push({ hello: 'world', answer: 42 })
    finish()
  },
  function benchjProtobufQPull (finish) {
    protobufQ.pull((msg, done) => {
      done()
      finish()
    })
  }
], 1000)

run(run)
