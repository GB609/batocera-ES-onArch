# node-test-parser

![CI](https://github.com/nearform/node-test-parser/actions/workflows/ci.yml/badge.svg?event=push)

## Installation

```shell
npm i -D node-test-parser
```

## Usage

Create a custom test reporter using the parser:

```js
// reporter.js
import parseReport from 'node-test-parser'

export default async function* jsonReporter(source) {
  const report = await parseReport(source)
  yield JSON.stringify(report, null, 2)
}
```

Run tests using the custom reporter:

```sh
node --test --test-reporter ./reporter.js
```
