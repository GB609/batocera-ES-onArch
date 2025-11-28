Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');

enableLogfile();

const utils = require('utils/data');

const testData = {
  firstObj: {
    firstObjSub1: true,
    firstObjSub2: 42,
    firstObjSub3: {
      evenDeeper: []
    },
    'with blank': false
  },
  secondArr: [2, 3, 4, 5, 6],
  thirdScalar: "string",
  'top-level blank': 88
}

function assertHierarchicKeyValue(key, testObject, expected) {
  let hkey = utils.HierarchicKey.from(key);
  let actual = hkey.get(testObject);
  assert.deepEqual(actual, expected, `${hkey.toString()} returned wrong value: ${actual} != ${expected}`);
}

class HierarchicKeyTests {
  static testGetWithArrayKeys = parameterized(
    [
      [[], testData, testData],
      [['firstObj'], testData, testData.firstObj],
      [['firstObj', 'firstObjSub1'], testData, true],
      [['firstObj', 'firstObjSub2'], testData, 42],
      [['firstObj', 'firstObjSub3'], testData, { evenDeeper: [] }],
      [['firstObj', 'with blank'], testData, false],
      [['secondArr'], testData, testData.secondArr],
      [['secondArr', 2], testData, 4],
      [['top-level blank'], testData, 88],
    ],
    assertHierarchicKeyValue,
    "key:${0}"
  )

  static testGetWithStringKeys = parameterized(
    [
      ['', testData, testData],
      ['firstObj', testData, testData.firstObj],
      ['firstObj.firstObjSub1', testData, true],
      ['firstObj.firstObjSub2', testData, 42],
      ['firstObj.firstObjSub3', testData, { evenDeeper: [] }],
      ['firstObj."with blank"', testData, false],
      ['secondArr', testData, testData.secondArr],
      ['secondArr.2', testData, 4],
      ['"top-level blank"', testData, 88],
    ],
    assertHierarchicKeyValue,
    "key:${0}"
  )
}

class DataTransformationTests {
  beforeEach() { this.testData = sanitizeDataObject(testData) }

  deepImplode() {
    const expected = {
      'firstObj.firstObjSub1': true,
      'firstObj.firstObjSub2': 42,
      'firstObj.firstObjSub3.evenDeeper': [],
      'firstObj["with blank"]': false,
      'secondArr[0]': 2,
      'secondArr[1]': 3,
      'secondArr[2]': 4,
      'secondArr[3]': 5,
      'secondArr[4]': 6,
      'thirdScalar': 'string',
      '["top-level blank"]': 88
    }
    assert.deepEqual(utils.deepImplode(this.testData), expected);
  }

  removeEmpty() {
    const expected = {
      firstObj: {
        firstObjSub1: true,
        firstObjSub2: 42,
        'with blank': false
      },
      secondArr: [2, 3, 4, 5, 6],
      thirdScalar: "string",
      'top-level blank': 88
    }
    assert.deepEqual(utils.removeEmpty(this.testData), expected);
  }

  diffObjects() {
    let base = utils.removeEmpty(sanitizeDataObject(this.testData));
    this.testData.firstObj.firstObjSub3.evenDeeper.push("abc");
    let result = utils.diff(base, this.testData);
    assert.deepEqual(result, {
      firstObj: {
        firstObjSub3: { evenDeeper: ['abc'] }
      }
    })
  }
}

class ArrayMergeTests {

  beforeEach() { this.testData = sanitizeDataObject(testData) }

  plusNew() {
    let update = { '@+secondArr': ['A'] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, [...testData.secondArr, 'A']);
  }

  plusExisting() {
    let update = { '@+secondArr': [3] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, testData.secondArr);
  }

  plusNoBaseExists() {
    let update = { '@+unknownArr': ['A'] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.unknownArr, ['A']);
  }

  minusNew() {
    let update = { '@-secondArr': ['A'] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, testData.secondArr);
  }

  minusExisting() {
    let update = { '@-secondArr': [6] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, testData.secondArr.slice(0, testData.secondArr.length - 1));
  }

  minusNoBaseExists() {
    let update = { '@-unknownArr': ['A'] }
    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result, testData);
  }

  doBothPlusFirst() {
    let update = {
      '@+secondArr': ['A', 5, 7, 8],
      '@-secondArr': [3, 7]
    }

    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, [2, 4, 5, 6, 'A', 8]);
  }

  doBothMinusFirst() {
    let update = {
      '@-secondArr': [3, 7],
      '@+secondArr': ['A', 3, 7, 8]
    }

    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.secondArr, [2, 4, 5, 6, 'A', 3, 7, 8]);
  }

  /**
   * Important for the config import feature, where every simple data value is wrapped into an instance of PropValue.
   */
  basicTestWithPropValue() {
    const { PropValue } = require('parsing');
    
    this.testData.propValueArr = [
      new PropValue(3),
      new PropValue(4),
      4 //add basic to make sure that PropValue(4).valueOf() is used from the @- key 
    ]
    let update = {
      '@+propValueArr': [new PropValue(5)],
      '@-propValueArr': [new PropValue(4)]
    }
    let expected = [
      this.testData.propValueArr[0],
      update['@+propValueArr'][0]
    ]

    let result = utils.mergeObjects(this.testData, update);
    assert.deepEqual(result.propValueArr, expected);
  }
}

runTestClasses(
  'Data Utility Tests',
  HierarchicKeyTests,
  DataTransformationTests,
  ArrayMergeTests
);
