const {
  merge,
  cloneDeep
} = require('lodash');
const applyReplace = require('../utils/text/applyReplace');
const {
  createDiff,
  formatDiff,
  getSnapshot,
  subjectToSnapshot,
  updateSnapshot,
} = require('../utils/tasks/textSnapshots');
const { updateInlineSnapshot } = require('../utils/tasks/inlineSnapshots');
const getSnapshotFilename = require('../utils/text/getSnapshotFilename');
const keepKeysFromExpected = require('../utils/text/keepKeysFromExpected');
const {
  getConfig
} = require('../config');
const { COMMAND_MATCH_INLINE_SNAPSHOT } = require('../commands/commandNames')

function matchTextSnapshot({
  commandName,
  dataType,
  options,
  snapshotTitle,
  subject,
  testFile,
  expected: expectedInline
} = {}) {
  const config = merge({}, cloneDeep(getConfig()), options);
  let expected;
  let snapshotFile;
  if (commandName === COMMAND_MATCH_INLINE_SNAPSHOT) {
    expected = expectedInline || false;
  } else {
    snapshotFile = getSnapshotFilename(testFile);
    expected = getSnapshot(snapshotFile, snapshotTitle, dataType);
    update = (actual) => updateSnapshot(snapshotFile, snapshotTitle, actual, dataType);
  }

  expected = applyReplace(expected, config.replace);
  const actual = keepKeysFromExpected(subjectToSnapshot(subject, dataType, config), expected, config);

  const exists = expected !== false;

  const autoPassed = (config.autopassNewSnapshots && expected === false);
  const passed = (expected && formatDiff(expected) === formatDiff(actual));
  const diff = createDiff(expected, actual, snapshotTitle);

  let updated = false;

  if ((config.updateSnapshots && !passed) || expected === false) {
    if (commandName === COMMAND_MATCH_INLINE_SNAPSHOT) {
      updateInlineSnapshot(testFile, actual, dataType);
    } else {
      updateSnapshot(snapshotFile, snapshotTitle, actual, dataType);
    }

    updated = true;
  }

  if (autoPassed) {
    expected = actual;
  }

  const result = {
    actual,
    commandName,
    dataType,
    diff,
    exists,
    expected,
    passed: passed || autoPassed,
    snapshotFile,
    snapshotTitle,
    subject,
    updated,
  };

  return result;
}

module.exports = matchTextSnapshot;
