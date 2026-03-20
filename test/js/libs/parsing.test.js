// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const fs = require('node:fs');

enableLogfile();

let parser = require("io/parsers");

TMP_DIR += '/ParsingTests'

function assertParsedFromFile(tmpFileName, tmpFileContent, expectedValue) {
  let filePath = `${TMP_DIR}/${tmpFileName}`;
  fs.writeFileSync(filePath, tmpFileContent);
  let result = parser.parseDict(filePath);
  assert.deepEqual(sanitizeDataObject(result), expectedValue);
}

class ParserTests {
  static beforeAll() { fs.mkdirSync(TMP_DIR, { recursive: true }) }
  static afterAll() { if (fs.existsSync(TMP_DIR)) { fs.rmSync(TMP_DIR, { recursive: true }) } }

  parserImplicitConfStyle() {
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
      system: { core: { default: "string with blank" } }
    };

    let result = parser.parseDict(source);
    assert.deepEqual(sanitizeDataObject(result), expected);

    result = parser.confToDict(source);
    assert.deepEqual(sanitizeDataObject(result), expected);
  }
  /*
    compareXml() {
      let file = `${ROOT_PATH}/tmp/FS_ROOT/opt/batocera-emulationstation/bin/es_features.cfg`;
      let old = parser.xmlToDict(file);
      let newStyle = parser.xmlNew(file);
  
      assert.deepEqual(
        sanitizeDataObject(old.features),
        sanitizeDataObject(newStyle.features)
      );
      //console.error(JSON.stringify(old.features.sharedFeatures.feature[0], null, 2))
    }
  */
  newYaml() {
    let file = `${ROOT_PATH}/tmp/es_features.yml`;
    let newStyle = parser.yamlToDict_IMPL(file);

    //file = `${ROOT_PATH}/tmp/es_systems.yml`;
    //newStyle = parser.yamlToDict_IMPL(file);
    //console.error(JSON.stringify(newStyle, null, 2));
    assert.fail()
  }

  parseLineCommentedJsonString() {
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

  parseYaml() {
    let sourceLines = `
root:
  subPropertyValue: true
  subDict:
    deeper: [9, 8, 7]
    inlineDict: { aKey: [arr] }
  up_again:  # inline comment
    - A
    - B
ml-mixed-flow: [
    45.6,
    { option: value, nodes: [
      3, 4, 5, 6,
      broken down
      multiline flow
      string,
      false
    ]}
  ]
# commented line
colonTest: some:thing
another-root:
  down: 2.5
  object_list:
    -
      key: some_str
      value: 609
aspect-ratios:
  '4:3' : '16:9'
  "16:9"      : "32:18"
ml-string:
  ABC
  123
  all LF folded

sublist-with-same-level-nest:
- E1
- obj:
    key: value
- sub-sub-list:
  - something

literal: |1
 nesting start  
 same
 
   deeper

 back
`;
    let expected = {
      root: {
        subPropertyValue: true,
        subDict: {
          deeper: [9, 8, 7],
          inlineDict: {
            aKey: ['arr']
          }
        },
        up_again: ['A', 'B']
      },
      'ml-mixed-flow': [
        45.6,
        {
          option: "value",
          nodes: [3, 4, 5, 6, "broken down multiline flow string", false]
        }
      ],
      colonTest: 'some:thing',
      'another-root': {
        down: 2.5,
        object_list: [{ key: "some_str", value: 609 }]
      },
      'aspect-ratios': {
        '4:3': '16:9',
        '16:9': '32:18'
      },
      'ml-string': "ABC 123 all LF folded",
      'sublist-with-same-level-nest': [
        "E1",
        { obj: { key: "value" } },
        { 'sub-sub-list': ["something"] }
      ],
      literal: 
`nesting start  
same

  deeper

back
`
    };

    let result = parser.yamlToDict(sourceLines);
    assert.deepEqual(sanitizeDataObject(result), expected);
    
    let newStyle = parser.yamlToDict_IMPL(sourceLines);
    assert.deepEqual(newStyle, result, "new parser sucks!")

    assertParsedFromFile('propertyTest.yml', sourceLines, expected);
  }
}

runTestClass(ParserTests)
