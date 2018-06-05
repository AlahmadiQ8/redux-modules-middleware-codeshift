const tests = [
  'already-migrated-import',
  'default-and-named-import',

  // 'already-migrated-require',
  // 'assigned-from-react-var',
  // 'assigned-to-var-with-different-name',
  // 'default-import',
  // 'destructured-proptypes-import',
  // 'import-alias',
  // 'import-flow-type-with-require',
  // 'mixed-import-and-require',
  // 'mixed-import-and-require-2',
  // 'named-parameters',
  // 'nested-destructured-proptypes-import',
  // 'no-change-import',
  // 'no-change-require',
  // 'require-alias',
  // 'require-destructured-multi',
  // 'require-destructured-only',
  // 'require-destructured-direct',
  // 'require',
  // 'with-top-comment',
]

const defineTest = require('jscodeshift/dist/testUtils').defineTest

describe('to-redux-modules-middleware', () => {
  tests.forEach(test =>
    defineTest(__dirname, 'to-redux-modules-middleware', null, `${test}`)
  )
})
