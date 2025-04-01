
const assert = require('node:assert/strict');
const fs = require('node:fs')

let writer = requireSrc('./config.libs/output-formats');

/*
assert.isInstance = function(instance, type){
  if(!(instance instanceof type)){
    assert.fail(`${Object.getPrototypeOf(instance).constructor.name} is not of type ${type}`);
  }
}
*/
function assertTempFile(fileName, expectedContent){
  let fileContent = fs.readFileSync(fileName, { encoding:'utf8' });
  assert.equal(fileContent, expectedContent)
}
function assertWrite(realWriterClass, testFileName, testData, expected, options){
  let writerClassProxy = generateTestWriter(realWriterClass);
  writerClassProxy.write(testData, testFileName, options);

  assert.ok(writerClassProxy.closeCalled, "static write() should call close() at the end!");
  assert.equal(writerClassProxy.writtenText, expected);

  assertTempFile(testFileName, expected);
}

function clearTempFile(fileName){
  if(fs.existsSync(fileName)){ fs.unlinkSync(fileName) }
}
function asString(data) {
  if (Array.isArray(data)) { return data.join('\n') }
  else { return data.valueOf().toString() }
}

// hook into the writing code by attaching a delegate
function generateTestWriter(realWriterClass){
  return class TestWriter extends realWriterClass {
    static writtenText = "";
    static closeCalled = false;

    constructor(...parameters){
      super(...parameters);
      TestWriter.writtenText = "";
      TestWriter.closeCalled = false;
    }
    write(data){
      TestWriter.writtenText += asString(data);
      super.write(data);
    }
    close(){ TestWriter.closeCalled = true }
  }
}

class WriterApiTest {
  static assertApi = parameterized(
    Object.entries(writer).filter(e => e[0] != e[1].name),
    function testWriterApi(name, type){
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

runTestClasses(
  WriterApiTest,

  class JsonWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.json'
    expected = JSON.stringify(testPropertyDict, null, 2);
    afterEach(){ clearTempFile(JsonWriterTests.TEST_FILE_NAME) }

    writeJson(){ assertWrite(writer.json, JsonWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected) }
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
    afterEach(){ clearTempFile(ConfWriterTests.TEST_FILE_NAME) }

    writeConf(){ assertWrite(writer.conf, ConfWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected) }
  },


  class ShellWriterTests {
    static TEST_FILE_NAME = TMP_DIR + '/writerTestOutput.sh'
    expected_noStripping = [
      'declare -A global',
      "global['emptyNestedString']=''",
      "global['deeperSubDict_number']='42'",
      "global['aString']='something'",
      "declare topLevel='true'",
      "declare beforeWithBlank='some string with blanks'\n"
    ].join('\n');
    expected_withStripping = [
      "declare emptyNestedString=''",
      "declare -A deeperSubDict",
      "deeperSubDict['number']='42'",
      "declare aString='something'",
      "declare topLevel='true'",
      "declare beforeWithBlank='some string with blanks'\n"
    ].join('\n');

    writeSh_changeDeclare(){
      let expected = this.expected_noStripping.replace(/declare/g, 'test_declare -X')
      assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, testPropertyDict, expected, {
        declareCommand: "test_declare -X"
      }) 
    }
    writeSh_NoStripPrefix(){ assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected_noStripping) }

    writeSh_StripPrefix(){ 
      assertWrite(writer.sh, ShellWriterTests.TEST_FILE_NAME, testPropertyDict, this.expected_withStripping, {
        stripPrefix: 1
      });
    }
  },

  /*
  class YamlWriterTests {

  }*/
)
