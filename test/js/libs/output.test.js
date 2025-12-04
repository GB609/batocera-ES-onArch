Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const fs = require('node:fs');

TMP_DIR = TMP_DIR + '/WriterTests'

enableLogfile();

let writer = require('io/writers');

function assertTempFile(fileName, expectedContent) {
  let fileContent = fs.readFileSync(fileName, { encoding: 'utf8' });
  assert.equal(fileContent, expectedContent)
}
function assertWrite(realWriterClass, testFileName, testData, expected, options) {
  let writerClassProxy = generateTestWriter(realWriterClass);
  writerClassProxy.write(testData, testFileName, options);

  assert.ok(writerClassProxy.closeCalled, "static write() should call close() at the end!");
  assert.equal(writerClassProxy.writtenText, expected);

  assertTempFile(testFileName, expected);
}

function clearTempFile(fileName) {
  if (fs.existsSync(fileName)) { fs.unlinkSync(fileName) }
}
function asString(data) {
  if (Array.isArray(data)) { return data.join('\n') }
  else { return data.valueOf().toString() }
}

// hook into the writing code by attaching a delegate
function generateTestWriter(realWriterClass) {
  return class TestWriter extends realWriterClass {
    static writtenText = "";
    static closeCalled = false;

    constructor(...parameters) {
      super(...parameters);
      TestWriter.writtenText = "";
      TestWriter.closeCalled = false;
    }
    write(data) {
      TestWriter.writtenText += asString(data);
      super.write(data);
    }
    close() {
      TestWriter.closeCalled = true;
      super.close();
    }
  }
}

class WriterApiTest {
  static assertApi = parameterized(
    Object.entries(writer).filter(e => typeof e[1] == 'function' && e[0] != e[1].name),
    function testWriterApi(name, type) {
      assert.equal(typeof type.write, "function", "requires: static write(dict, file, options = {})");
      let testInstance = new type(process.stdout);
      assert.equal(typeof testInstance.writeDict, "function", "requires: writeDict(dict, options = {})");
    },
    (dict, fun, type, cls) => { return `${type}:${cls.name}` }
  )
}

const testPropertyDict = {
  global: {
    emptyNestedString: "",
    deeperSubDict: { number: 42 },
    aString: "something"
  },
  topLevel: true,
  beforeWithBlank: "some string with blanks"
}

const expectedFeatures =
  `<?xml version="1.0"?>
<!-- This file was generated from /opt/batocera-emulationstation/conf.d/es_features.yml during PKGBUILD -->
<features>
  <sharedFeatures>
    <feature name="DECORATION SET" value="bezel" prompt="DECORATION SET" submenu="DECORATIONS" preset="bezel">
    </feature>
    <feature name="STRETCH BEZELS (4K &amp; ULTRAWIDE)" value="bezel_stretch" prompt="STRETCH BEZELS (4K &amp; ULTRAWIDE)" submenu="DECORATIONS">
      <choice name="On" value="1" />
      <choice name="Off" value="0" />
    </feature>
  </sharedFeatures>
  <globalFeatures>
  </globalFeatures>
  <emulator name="wine" features="bezel">
  </emulator>
  <emulator name="xenia" features="bezel">
  </emulator>
</features>
`;

const expectedTemplateFeatures =
  `<?xml version="1.0"?>
<!-- This file was generated from /opt/batocera-emulationstation/conf.d/es_features.yml during PKGBUILD -->
<features>
  <sharedFeatures>
    <feature name="TEST #1:" value="test1" group="TEST" prompt="TEST #1:">
    </feature>
    <feature name="TEST #2:" value="test2" group="TEST" prompt="TEST #2:">
    </feature>
  </sharedFeatures>
</features>
`;

const expectedSystems =
  `
`;

const expectedGenericXml =
  `<?xml version="1.0" encoding="UTF-8"?>
<NO-ROOT>
  <global attribute="a &lt; b">
    <emptyNestedString/>
    <deeperSubDict>
      <number>42</number>
    </deeperSubDict>
    <aString>something</aString>
    <repeated>1</repeated>
    <repeated>2</repeated>
    <repeated>3</repeated>
  </global>
  <topLevel>true</topLevel>
  <beforeWithBlank>some string with blanks</beforeWithBlank>
</NO-ROOT>
`

const exptectedSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <string name="global.emptyNestedString" value=""/>
  <string name="global.aString" value="something"/>
  <string name="beforeWithBlank" value="some string with blanks"/>
  <int name="global.deeperSubDict.number" value="42"/>
  <bool name="topLevel" value="true"/>
  <float name="some_float" value="0.609"/>
</config>
`

runTestClasses(
  WriterApiTest,

  class JsonWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.json'
    expected = JSON.stringify(testPropertyDict, null, 2);
    afterEach() { clearTempFile(JsonWriterTests.TEST_FILE_NAME) }

    writeJson() { assertWrite(writer.json, JsonWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected) }
  },

  class PlainWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.txt'
    afterEach() { clearTempFile(PlainWriterTests.TEST_FILE_NAME) }

    // objects are just stringified
    testSimpleWriteObject() {
      assertWrite(writer.plain, PlainWriterTests.TEST_FILE_NAME, testPropertyDict, '[object Object]');
    }

    testSimpleWriteArrays() {
      assertWrite(writer.plain, PlainWriterTests.TEST_FILE_NAME, [1, 2, 3, 4], '1,2,3,4');
    }

    testSimpleWriteString() {
      assertWrite(writer.plain, PlainWriterTests.TEST_FILE_NAME, 'Some string data', 'Some string data');
    }
  },

  class ConfWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.conf'
    expected = [
      'beforeWithBlank=some string with blanks',
      'global.aString=something',
      "global.deeperSubDict.number=42",
      "global.emptyNestedString=",
      "topLevel=true\n"
    ].join('\n');
    afterEach() { clearTempFile(ConfWriterTests.TEST_FILE_NAME) }

    writeConf() { assertWrite(writer.conf, ConfWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected) }

    emptyObjectsAreIgnored() {
      let copy = JSON.parse(JSON.stringify(testPropertyDict));
      copy.emptyFirstOrder = {};
      copy.emptySub = { subkey: {} };
      assertWrite(writer.conf, ConfWriterTests.TEST_FILE_NAME, copy, this.expected);
    }

    commentsGenerateCorrectly() {
      let expected = [
        '# some comment with multiple lines',
        '# ',
        '# continues here\n\n'
      ].join('\n') + this.expected;

      assertWrite(writer.conf, ConfWriterTests.TEST_FILE_NAME, testPropertyDict, expected, {
        comment: 'some comment with multiple lines\n\ncontinues here'
      })
    }
  },

  class ShellWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.sh';
    expected_noStripping = [
      "declare idx0='varname must be [idx0]'",
      'declare -A global',
      "global['emptyNestedString']=''",
      "global['deeperSubDict_number']='42'",
      "global['aString']='something'",
      "declare topLevel='true'",
      "declare beforeWithBlank='some string with blanks'",
      "declare -A topLevelArray",
      "topLevelArray['0']='1'",
      "topLevelArray['1']='2'\n",
    ].join('\n');
    expected_withStripping = [
      "declare idx0='varname must be [idx0]'",
      "declare emptyNestedString=''",
      "declare -A deeperSubDict",
      "deeperSubDict['number']='42'",
      "declare aString='something'",
      "declare topLevel='true'",
      "declare beforeWithBlank='some string with blanks'",
      // don't strip when the resulting key would start with an index
      "declare -A topLevelArray",
      "topLevelArray['0']='1'",
      "topLevelArray['1']='2'\n"
    ].join('\n');

    beforeEach() {
      this.testPropertyDict = sanitizeDataObject(testPropertyDict);
      this.testPropertyDict.topLevelArray = [1, 2]
      this.testPropertyDict['0'] = 'varname must be [idx0]'
    }

    afterEach() { clearTempFile(ShellWriterTests.TEST_FILE_NAME) }

    writeSh_changeDeclare() {
      let expected = this.expected_noStripping.replace(/declare/g, 'test_declare -X')
      assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, this.testPropertyDict, expected, {
        declareCommand: "test_declare -X"
      })
    }
    writeSh_NoStripPrefix() {
      assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, this.testPropertyDict, this.expected_noStripping)
    }

    writeSh_StripPrefix() {
      assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, this.testPropertyDict, this.expected_withStripping, {
        stripPrefix: 1
      });
    }
  },

  class YamlWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.yml';
    expected = [
      'global:',
      '  emptyNestedString: ""',
      '  deeperSubDict:',
      '    number: 42',
      '  aString: "something"',
      'topLevel: true',
      'beforeWithBlank: "some string with blanks"'
    ].join('\n');
    afterEach() { clearTempFile(YamlWriterTests.TEST_FILE_NAME) }

    writeYaml() { assertWrite(writer.yml, YamlWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected) }
  },

  class FeaturesWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/featuresTestOutput.yml';
    featureConfig = {
      shared: {
        cfeatures: {
          bezel: {
            prompt: "DECORATION SET",
            submenu: "DECORATIONS",
            preset: "bezel"
          },
          bezel_stretch: {
            prompt: "STRETCH BEZELS (4K & ULTRAWIDE)",
            submenu: "DECORATIONS",
            choices: {
              "On": 1,
              "Off": 0
            }
          }
        }
      },
      global: {
        shared: [

        ]
      },
      wine: { features: ['bezel'] },
      xenia: { features: ['bezel'] }
    }
    templatedFeatures = {
      shared: {
        cfeatures: {
          test: {
            repeat: 2,
            template: {
              group: "TEST",
              prompt: "TEST #{{iteration}}:"
            }
          }
        }
      }
    }

    afterEach() { clearTempFile(FeaturesWriterTests.TEST_FILE_NAME) }

    writeFeatures() { assertWrite(writer.features, FeaturesWriterTests.TEST_FILE_NAME, this.featureConfig, expectedFeatures) }
    writeTemplatedFeatures() { assertWrite(writer.features, FeaturesWriterTests.TEST_FILE_NAME, this.templatedFeatures, expectedTemplateFeatures) }
  },

  class XmlWriterTest {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.xml';

    beforeEach() {
      let enhanced = JSON.parse(JSON.stringify(testPropertyDict));
      enhanced.global['@attribute'] = "a < b";
      enhanced.global['repeated'] = [1, 2, 3];
      this.testInput = enhanced;
    }
    afterEach() { clearTempFile(XmlWriterTest.TEST_FILE_NAME) }

    writeXmlNoRoot() {
      let enhanced = JSON.parse(JSON.stringify(testPropertyDict));
      enhanced.global['@attribute'] = "a < b";
      enhanced.global['repeated'] = [1, 2, 3]
      assertWrite(writer.xml, XmlWriterTest.TEST_FILE_NAME, this.testInput, expectedGenericXml)
    }

    writeXmlRegularRoot() {
      let testInput = { 'testRoot': this.testInput };
      assertWrite(writer.xml, XmlWriterTest.TEST_FILE_NAME, testInput, expectedGenericXml.replaceAll('NO-ROOT', 'testRoot'));
    }
  },

  class EsSettingsWriterTest {
    static TEST_FILE_NAME = TMP_DIR + '/es_settings.cfg';
    //afterEach() { clearTempFile(EsSettingsWriterTest.TEST_FILE_NAME) }

    writeSettingsNoComment() {
      this.testPropertyDict = sanitizeDataObject(testPropertyDict);
      this.testPropertyDict['some_float'] = 0.609;
      assertWrite(writer.settings, EsSettingsWriterTest.TEST_FILE_NAME, this.testPropertyDict, exptectedSettingsXml);
    }
    writeSettingsWithComment() {
      this.testPropertyDict = sanitizeDataObject(testPropertyDict);
      this.testPropertyDict['some_float'] = 0.609;
      let options = { comment: 'some comment' }
      let expectation = exptectedSettingsXml.replace('<config>', '<!-- some comment -->\n<config>');
      assertWrite(writer.settings, EsSettingsWriterTest.TEST_FILE_NAME, this.testPropertyDict, expectation, options);
    }
  }
)
