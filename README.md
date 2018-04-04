# shape-of-q

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)

A simple and fast redis based queue, supports both *fifo* and *lifo*.

## Install
```
npm i shape-of-q
```

## Usage
```js
const q = require('shape-of-q')('myqueue')
q.on('error', console.log)

// push a new message
q.push('hello')

q.pull({ polling: true }, (msg, done) => {
  console.log(msg)
  done()
})
```

Async await is supported as well!
```js
q.pull({ polling: true }, async msg => {
  console.log(msg)
})
```

## API

### Constructor
Create a new queue, the queue name parameter is mandatory.<br>
Options:
```js
const q = require('shape-of-q')('myqueue', {
  encoding: 'json', // default: null
  type: 'lifo', // default: 'fifo'
  client: Object, // custom redis client
  host: '127.0.0.1' // redis host for the internal client
})
```

`shape-of-q` is an event emitter and you should listen for the `error` event.

#### `push`
Add a new message to the queue.<br>
If the encoding has been set to `'json'` you can pass plain objects.
```js
q.push('hello')
```

#### `pull`
Retrieve a single message from the queue.<br>
To enable polling, pass `{ polling: true }` as option and `pollingInterval` if you want to customize the interval (must be expressed in seconds).<br>
The api supports both classic callbacks and async await.
```js
// callbacks
q.pull({ polling: true }, (msg, done) => {
  console.log(msg)
  done()
})

// async-await
q.pull({ polling: true }, async msg => {
  console.log(msg)
})
```
If you pass an error to `done` or return an error in the async version the message will be put back in the queue.

#### `list`
Get all elements in the queue.
```js
q.list((err, msg) => {
  console.log(msg)
})
```

#### `stop`
Stops the polling and closes the connection to redis.
```js
q.stop()
```

## License
MIT

Copyright © 2018 Tomas Della Vedova
