'use strict';

/*!
 * Module dependencies.
 */

var toString = Object.prototype.toString

/**
 * Find the exact type of an argument
 *
 * @param {Any} input
 * @return {String} arg type
 */

exports.getType = function(arg) {
  return toString.call(arg)
    .replace('[object ', '')
    .replace(']', '')
}

/**
 * Convert string into camel case
 *
 * @param {String} input
 * @return {String} output
 */

exports.camelCase = function(input) { 
  return input
    .replace('_', '-')
    .toLowerCase()
    .replace(/-(.)/g, function(match, group) {
      return group.toUpperCase()
    })
}