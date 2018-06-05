/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict'

module.exports = function(file, api, options) {
  const j = api.jscodeshift
  const root = j(file.source)

  const MODULE_NAME = options['module-name'] || 'redux-modules-middleware'

  let localPropTypesName = 'middleware'

  // Find alpha-sorted import that would follow prop-types
  function findImportAfterPropTypes(j, root) {
    let target, targetName

    root.find(j.ImportDeclaration).forEach(path => {
      const name = path.value.source.value.toLowerCase()
      if (name !== MODULE_NAME && (!target || name < targetName)) {
        targetName = name
        target = path
      }
    })

    return target
  }

  // Find alpha-sorted require that would follow prop-types
  function findRequireAfterPropTypes(j, root) {
    let target, targetName

    root
      .find(j.CallExpression, { callee: { name: 'require' } })
      .forEach(path => {
        const name = path.node.arguments[0].value.toLowerCase()
        if (name > MODULE_NAME && (!target || name < targetName)) {
          targetName = name
          target = path
        }
      })

    return target
  }

  function hasPropTypesImport(j, root) {
    return (
      root.find(j.ImportDeclaration, {
        source: { value: 'redux-modules-middleware' },
      }).length > 0
    )
  }

  function hasPropTypesRequire(j, root) {
    return (
      root.find(j.CallExpression, {
        callee: { name: 'require' },
        arguments: { 0: { value: 'redux-modules-middleware' } },
      }).length > 0
    )
  }

  // Program uses ES import syntax
  function useImportSyntax(j, root) {
    return (
      root.find(j.ImportDeclaration, {
        importKind: 'value',
      }).length > 0
    )
  }

  // Program uses var keywords
  function useVar(j, root) {
    return root.find(j.VariableDeclaration, { kind: 'const' }).length === 0
  }

  // If any PropTypes references exist, add a 'redux-modules-middleware' import (or require)
  function addPropTypesImport(j, root) {
    if (useImportSyntax(j, root)) {
      // Handle cases where 'redux-modules-middleware' already exists;
      // eg the file has already been codemodded but more React.PropTypes were added.
      if (hasPropTypesImport(j, root)) {
        return
      }

      const path = findImportAfterPropTypes(j, root)
      if (path) {
        const importStatement = j.importDeclaration(
          [j.importDefaultSpecifier(j.identifier(localPropTypesName))],
          j.literal(MODULE_NAME)
        )

        // If there is a leading comment, retain it
        // https://github.com/facebook/jscodeshift/blob/master/recipes/retain-first-comment.md
        const firstNode = root.find(j.Program).get('body', 0).node
        const { comments } = firstNode
        if (comments) {
          delete firstNode.comments
          importStatement.comments = comments
        }

        j(path).insertBefore(importStatement)
        return
      }
    }

    // Handle cases where 'redux-modules-middleware' already exists;
    // eg the file has already been codemodded but more React.PropTypes were added.
    if (hasPropTypesRequire(j, root)) {
      return
    }

    const path = findRequireAfterPropTypes(j, root)
    if (path) {
      const requireStatement = useVar(j, root)
        ? j.template.statement([
            `var ${localPropTypesName} = require('${MODULE_NAME}');\n`,
          ])
        : j.template.statement([
            `const ${localPropTypesName} = require('${MODULE_NAME}');\n`,
          ])
      j(path.parent.parent).insertBefore(requireStatement)
      return
    }

    throw new Error('No PropTypes import found!')
  }

  // Remove PropTypes destructure statements, e.g.
  // const { PropTypes } = React;
  //   or
  // const { PropTypes } = require('redux-modules');
  function removeDestructuredPropTypeStatements(j, root) {
    let hasModifications = false

    root
      .find(j.ObjectPattern)
      .filter(path => {
        const init = path.parent.node.init
        if (!init) {
          return false
        }
        if (
          !(
            init.type === 'CallExpression' &&
            init.callee.name === 'require' &&
            init.arguments.length &&
            init.arguments[0].value === 'redux-modules'
          ) // const { PropTypes } = require('redux-modules')
        ) {
          return false
        }
        return path.node.properties.some(
          property => property.key.name === 'middleware'
        )
      })
      .forEach(path => {
        hasModifications = true

        // Find any nested destructures hanging off of the PropTypes node
        const nestedPropTypesChildren = path.node.properties.find(
          property =>
            property.key.name === 'middleware' &&
            property.value.type === 'ObjectPattern'
        )

        // Remove the PropTypes key
        path.node.properties = path.node.properties.filter(property => {
          if (property.key.name === 'middleware') {
            if (property.value && property.value.type === 'Identifier') {
              localPropTypesName = property.value.name
            }
            return false
          } else {
            return true
          }
        })

        // Add back any nested destructured children.
        if (nestedPropTypesChildren) {
          // TODO: This shouldn't just use a template string but the `ast-types` docs were too opaque for me to follow.
          const propTypeChildren = nestedPropTypesChildren.value.properties
            .map(property => property.key.name)
            .join(', ')
          const destructureStatement = j.template.statement([
            `const { ${propTypeChildren} } = ${localPropTypesName};`,
          ])

          j(path.parent.parent).insertBefore(destructureStatement)
        }

        // If this was the only property, remove the entire statement.
        if (path.node.properties.length === 0) {
          path.parent.parent.replace('')
        }
      })

    return hasModifications
  }

  // Remove old { PropTypes } imports
  function removePropTypesImport(j, root) {
    let hasModifications = false

    root
      .find(j.Identifier)
      .filter(
        path =>
          path.node.name === 'middleware' &&
          path.parent.node.type === 'ImportSpecifier'
      )
      .forEach(path => {
        hasModifications = true
        localPropTypesName = path.parent.node.local.name

        const importDeclaration = path.parent.parent.node
        importDeclaration.specifiers = importDeclaration.specifiers.filter(
          specifier =>
            !specifier.imported || specifier.imported.name !== 'middleware'
        )
      })

    return hasModifications
  }

  const isReactPropTypes = path => {
    // console.log(path)
    // if ( path.parent.node.type === 'ImportDefaultSpecifier') {
    //   console.log(path.parent.node)
    // }
    // if (path && path.node) {
    //   console.log(path.node.name)
    //   console.log(path.parent.node.type )
    // }
    return (
      (path.node.name === 'middleware' && path.parent.node.type === 'ImportDefaultSpecifier') 

    )
  }

  // Replace all React.PropTypes instances with PropTypes
  function replacePropTypesReferences(j, root) {
    let hasModifications = false

    root
      .find(j.Identifier)
      .filter(isReactPropTypes)
      .forEach(path => {
        hasModifications = true
        j(path).replaceWith(j.identifier(localPropTypesName))
      })

    return hasModifications
  }

  function removeEmptyReactImport(j, root) {
    root
      .find(j.ImportDeclaration)
      .filter(
        path =>
          path.node.specifiers.length === 0 &&
          path.node.source.value === 'redux-modules'
      )
      .replaceWith()
  }

  let hasModifications = false
  hasModifications = removePropTypesImport(j, root) || hasModifications
  hasModifications = replacePropTypesReferences(j, root) || hasModifications

  if (hasModifications) {
    addPropTypesImport(j, root)
    removeEmptyReactImport(j, root)
  }

  return hasModifications ? root.toSource({ quote: 'single' }) : null
}
