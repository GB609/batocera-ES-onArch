import * as assert from 'node:assert/strict';

let parser = require("./config.libs/parsing")

function propDictToBasic(props){ return JSON.parse(JSON.stringify(props.valueOf())) }

class ParserTests {
  parserImplicitConfStyle(){
    let source = `
      global.ui = false
      global.another = 42
      # some *.conf-style line comment
      system.core.default = "string with blank"
    `

    let result = parser.parseDict(source);
    assert.deepEqual(propDictToBasic(result), {
      global: {
        ui: false,
        another: 42
      },
      system: { core: {default:"string with blank"}}
    })
  }
  
  parseLineCommentedJsonString(){
    let source = `{
      "firstKey": "somestring",
      //"commented": true,
      "booleanValue": true,
      "some_number": 42609
    }`

    let result = parser.jsonToDict(source);
    assert.deepEqual(propDictToBasic(result), {
      firstKey: "somestring",
      booleanValue: true,
      some_number: 42609,
    });
  }
}

runTestClass(ParserTests)
