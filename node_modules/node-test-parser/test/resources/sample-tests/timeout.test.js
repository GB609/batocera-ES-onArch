import test from 'node:test'

test('callback timing out', { timeout: 100 }, (_, done) => {
  setTimeout(done, 200)
})
