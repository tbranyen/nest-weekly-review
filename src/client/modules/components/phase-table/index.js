'use strict';
var Component = require('../../util/component');
var weekNumber = require('../../util/week-num');
var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = Component.extend({
  template: require('./template.html'),
  css: require('./style.css'),
  data: {
    firstWeek: new Date(),
    numWeeks: 0
  },
  components: {
    'bp-phase-table-row': require('../phase-table-row/index')
  },
  partials: {
    date: require('../../partials/date.html')
  },
  formatPhase: function(date) {
    return {
      date: date,
      url: '/year/' + date.getFullYear() + '/week/' + 3 + '/phase/' + 4 + '/',
    };
  },
  phaseUrl: function(date) {
    return '/year/' + date.getFullYear() + '/week/' + weekNumber.fromDate(date) + '/';
  },
  computed: {
    nextWeek: function() {
      var date = new Date(this.get('firstWeek').getTime() + WEEK_MS);
      return this.phaseUrl(date);
    },
    prevWeek: function() {
      var date = new Date(this.get('firstWeek').getTime() - WEEK_MS);
      return this.phaseUrl(date);
    },
    visiblePhases: function() {
      var first = this.get('firstWeek');
      var num = this.get('numWeeks');
      var projects = this.get('projects');
      var visible;

      if (!projects) {
        return;
      }

      visible = [];
      projects.forEach(function(project) {
        var phases = project.get('phases');

        if (phases) {
          phases.forEach(function(phase) {
            visible.push({ project: project, phase: phase });
          });
        }
      });

      return visible.filter(function(thing) {
        var phase = thing.phase;
        var projectStart = phase.get('date_start');
        var projectEnd = phase.get('date_end');
        var untilStart = Math.round(weekNumber.between(first, projectStart));
        var untilEnd = Math.round(weekNumber.between(first, projectEnd));

        return (untilStart >= 0 && untilStart < num) ||
          (untilEnd > 0 && untilEnd < num) ||
          (untilStart <= 0 && untilEnd > 0);
      });
    },
    weeks: function() {
      var first = this.get('firstWeek');
      var num = this.get('numWeeks');
      var weeks = [];
      var idx;


      for (idx = 0; idx < num; ++idx) {
        weeks.push(
          new Date(first.getTime() + idx * WEEK_MS)
        );
      }

      return weeks;
    }
  }
});
