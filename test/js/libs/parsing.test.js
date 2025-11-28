Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');

enableLogfile();

let parser = require("io/parsers");

function assertParsedFromFile(tmpFileName, tmpFileContent, expectedValue){
  let filePath = `${TMP_DIR}/${tmpFileName}`;
  writeFileSync(filePath, tmpFileContent);
  let result = parser.parseDict(filePath);
  assert.deepEqual(sanitizeDataObject(result), expectedValue);
}

class ParserTests {
  parserImplicitConfStyle(){
    let source = `
      global.ui = false
      global.another = 42
      # some *.conf-style line comment
      system.core.default = "string with blank"
    `
    let expected = {
      global: {
        ui: false,
        another: 42
      },
      system: { core: {default:"string with blank"}}
    };
    
    let result = parser.parseDict(source);
    assert.deepEqual(sanitizeDataObject(result), expected);

    result = parser.confToDict(source);
    assert.deepEqual(sanitizeDataObject(result), expected);
  }

  parseLineCommentedJsonString(){
    let source = `{
      "firstKey": "somestring",
      //"commented": true,
      "booleanValue": true,
      "some_number": 42609
    }`

    let expected = {
      firstKey: "somestring",
      booleanValue: true,
      some_number: 42609,
    };

    let result = parser.jsonToDict(source);
    assert.deepEqual(sanitizeDataObject(result), expected);

    assertParsedFromFile('propertyTest.json', source, expected);
  }

  parseYaml(){
    let sourceLines = [
      "root:",
      "  subPropertyValue: true",
      "  subDict:",
      "    deeper: [9, 8, 7]",
      "    inlineDict: { aKey: [arr] }",
      "  up_again:  # inline comment",
      "    - A",
      "    - B",
      "# commented line",
      "colonTest: some:thing",
      "another-root:",
      "  down: 2.5",
      "  object_list:",
      "    -",
      "      key: some_str",
      "      value: 609",
      "aspect-ratios:",
      "  '4:3' : '16:9'",
      '  "16:9"      : "32:18"'
    ];
    let expected = {
      root: {
        subPropertyValue: true,
        subDict: { 
          deeper : [9, 8, 7],
          inlineDict: { 
            aKey: ['arr'] 
          }
        },
        up_again: ['A', 'B']
      },
      colonTest: 'some:thing',
      'another-root': { 
        down: 2.5,
        object_list: [ {key: "some_str", value: 609 } ]
      },
      'aspect-ratios':{
        '4:3': '16:9',
        '16:9': '32:18'
      }
    };

    let result = parser.yamlToDict(sourceLines.join("\n"));
    assert.deepEqual(sanitizeDataObject(result), expected);

    assertParsedFromFile('propertyTest.yml', sourceLines.join("\n"), expected);
  }
}

runTestClass(ParserTests)
