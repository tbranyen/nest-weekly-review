'use strict';
var Model = require('ampersand-model');

var Project = require('./project');
var Employees = require('./employees');
var PhaseReviews = require('./phase-reviews');
var setBearer = require('../ajax-config');
var weekNum = require('../util/week-num');

var API_ROOT = require('../api-root');

module.exports = Model.extend({
  url: function() {
    return API_ROOT + '/project-phases/' + this.get('id');
  },
  ajaxConfig: setBearer,

  props: {
    id: 'number',
    name: 'string',
    first_day: 'date',
    last_day: 'date',
    developer_weeks: 'number'
  },
  children: {
    project: Project
  },
  collections: {
    employees: Employees,
    reviews: PhaseReviews
  },

  contains: function(date) {
    return date >= this.get('first_day') && date < this.get('last_day');
  },

  weekOffset: function(date) {
    var thisOffsets = weekNum.fromDate(this.get('first_day'));
    var thatOffsets = weekNum.fromDate(date);
    return (thatOffsets.week - thisOffsets.week) +
      (thatOffsets.year - thisOffsets.year) * 52;
  },

  reviewAt: function(date) {
    return this.reviews.atWeek(this.weekOffset(date)) || null;
  }
});
