'use strict';
var sinon = require('sinon');

var Utilizations = require(
  '../../../../src/client/modules/models/utilizations'
);

suite('Utilizations collection', function() {
  suite('#save', function() {
    var sync;

    function syncReport() {
      var report = {};

      sync.args.forEach(function(args) {
        var method = args[0];
        var id = args[1].id;
        if (!(method in report)) {
          report[method] = [];
        }

        report[method].push(id);
      });

      return report;
    }

    setup(function() {
      sync = Utilizations.prototype.model.prototype.sync =
        sinon.spy(function(operation, model, options) {
          if (options.success) {
            setTimeout(options.success, 0);
          }
        });
    });

    teardown(function() {
      delete Utilizations.prototype.model.prototype.sync;
    });

    test('updates previously-existing changed models', function() {
      var u = new Utilizations([{ id: 32 }]);

      u.at(0).set('id', 34);

      return u.save().then(function() {
        assert.sameMembers(syncReport().update, [34]);
      });
    });
    test('does not update previously-existing unchanged models', function() {
      var u = new Utilizations([{ id: 32 }]);

      return u.save().then(function() {
        assert.notOk(syncReport().update);
      });
    });
    test('creates new models', function() {
      var u = new Utilizations();

      u.add({});
      return u.save().then(function() {
        assert.equal(syncReport().create.length, 1);
      });
    });
    test('destroys removed models', function() {
      var u = new Utilizations([
        { id: 55 },
        { id: 56 },
        { id: 57 },
        { id: 58 },
        { id: 59 },
        { id: 60 }
      ]);

      // Removed as a single ID-specifying object literal
      u.remove({ id: 55 });
      // Removed as an array of ID-specifying object literals
      u.remove([{ id: 56 }, { id: 57 }]);
      // Removed as a single model instance
      u.remove(u.get(58));
      // Removed as an array of model instances
      u.remove([u.get(59), u.get(60)]);

      return u.save().then(function() {
        assert.sameMembers(syncReport().delete, [55, 56, 57, 58, 59, 60]);
      });
    });
    test('updates models that have been removed then re-inserted', function() {
      var u = new Utilizations([{ id: 23 }]);
      var model = u.get(23);
      var report;

      u.remove(model);
      u.add(model);
      model.set('id', 45);

      return u.save().then(function() {
        report = syncReport();
        assert.sameMembers(report.update, [45]);
        assert.notOk(report.delete);
      });
    });
  });

  suite('#atDate', function() {
    var u = new Utilizations([
      { first_day: new Date(2012, 2, 2), last_day: new Date(2012, 2, 3) },
      { first_day: new Date(2012, 2, 5), last_day: new Date(2012, 2, 7) },
      { first_day: new Date(2012, 2, 8), last_day: new Date(2012, 2, 9) }
    ]);

    test('no utilization', function() {
      assert.strictEqual(u.atDate(new Date(2012, 2, 1)), null);
      assert.strictEqual(u.atDate(new Date(2012, 2, 4)), null);
      assert.strictEqual(u.atDate(new Date(2012, 2, 10)), null);
    });

    test('utilized', function() {
      assert.equal(u.atDate(new Date(2012, 2, 2)), u.at(0));
      assert.equal(u.atDate(new Date(2012, 2, 3)), u.at(0));
      assert.equal(u.atDate(new Date(2012, 2, 5)), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 6)), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 7)), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 8)), u.at(2));
      assert.equal(u.atDate(new Date(2012, 2, 9)), u.at(2));
    });

    test('with offset', function() {
      assert.equal(u.atDate(new Date(2012, 2, 2), 2), null);
      assert.equal(u.atDate(new Date(2012, 2, 2), 3), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 2), 4), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 2), 5), u.at(1));
      assert.equal(u.atDate(new Date(2012, 2, 2), 6), u.at(2));
      assert.equal(u.atDate(new Date(2012, 2, 2), 7), u.at(2));
    });
  });

  suite('#setAtDate', function() {
    test('empty', function() {
      var u = new Utilizations();
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 3
      });

      models = u.toJSON();

      assert.equal(models.length, 1);
      assert.equal(current, u.at(0));
      assert.deepEqual(models, [{
        utilization_type_id: 3,
        type: {},
        first_day: +new Date(2013, 3, 4),
        last_day: +new Date(2013, 3, 4)
      }]);
    });

    test('two-sided split', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 5
      });

      models = u.toJSON();

      assert.equal(models.length, 3);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 5,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 4)
        }, {
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5)
        }
      ]);
    });

    test('two-sided join', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 23
      });

      models = u.toJSON();

      assert.equal(models.length, 1);
      assert.equal(current, u.at(0));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('one-sided join (left)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 23
      });

      models = u.toJSON();

      assert.equal(models.length, 2);
      assert.equal(current, u.at(0));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 4)
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('one-sided join (left with missing right)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 23
      });

      models = u.toJSON();

      assert.equal(models.length, 1);
      assert.equal(current, u.at(0));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 4)
        }]
      );
    });

    test('one-sided join (right)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 25
      });

      models = u.toJSON();

      assert.equal(models.length, 2);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('one-sided join (right with missing left)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 25
      });

      models = u.toJSON();

      assert.equal(models.length, 1);
      assert.equal(current, u.at(0));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('one-sided split (left)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 24
      });

      models = u.toJSON();

      assert.equal(models.length, 3);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 24,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 4),
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('one-sided split (right)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 24
      });

      models = u.toJSON();

      assert.equal(models.length, 3);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 24,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 4),
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5)
        }]
      );
    });

    test('join and split', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 23
      });

      models = u.toJSON();

      assert.equal(models.length, 2);
      assert.equal(current, u.at(0));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 4)
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5),
        }]
      );
    });

    test('split and join', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 25
      });

      models = u.toJSON();

      assert.equal(models.length, 2);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 5),
        }]
      );
    });

    test('direct update', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 21
      });

      models = u.toJSON();

      assert.equal(models.length, 3);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 21,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 4),
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5),
        }]
      );
    });

    test('equivalent value (no change)', function() {
      var u = new Utilizations([
        {
          utilization_type_id: 23,
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        },
        {
          utilization_type_id: 24,
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          utilization_type_id: 25,
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 5)
        }
      ]);
      var models, current;

      current = u.setAtDate(new Date(2013, 3, 4), {
        utilization_type_id: 24
      });

      models = u.toJSON();

      assert.equal(models.length, 3);
      assert.equal(current, u.at(1));
      assert.deepEqual(
        models,
        [{
          utilization_type_id: 23,
          type: {},
          first_day: +new Date(2013, 3, 3),
          last_day: +new Date(2013, 3, 3)
        }, {
          utilization_type_id: 24,
          type: {},
          first_day: +new Date(2013, 3, 4),
          last_day: +new Date(2013, 3, 4),
        }, {
          utilization_type_id: 25,
          type: {},
          first_day: +new Date(2013, 3, 5),
          last_day: +new Date(2013, 3, 5),
        }]
      );
    });

    suite('options', function() {
      var u, events;

      setup(function() {
        u = new Utilizations([
          {
            utilization_type_id: 23,
            first_day: new Date(2013, 3, 3),
            last_day: new Date(2013, 3, 5)
          }
        ]);

        events = [];

        u.on('all', function(eventName) {
          events.push(eventName);
        });
      });

      test('triggers events by default', function() {
        u.setAtDate(new Date(2013, 3, 4), {
          utilization_type_id: 45
        });

        assert.sameMembers(
          events, ['add', 'change', 'change:last_day']
        );
      });

      test('honors `silent` flag when present', function() {
        u.setAtDate(new Date(2013, 3, 4), {
          utilization_type_id: 45
        }, { silent: true });

        assert.deepEqual(events, []);
      });
    });
  });

  suite('#split', function() {
    test('splits utilization at given date', function() {
      var u = new Utilizations([{
        first_day: new Date(2013, 3, 1),
        last_day: new Date(2013, 3, 5)
      }]);
      var newUtilization;

      newUtilization = u.split(new Date(2013, 3, 3));

      assert.equal(u.length, 2);
      assert.equalDate(u.at(0).get('first_day'), new Date(2013, 3, 1));
      assert.equalDate(u.at(0).get('last_day'), new Date(2013, 3, 2));
      assert.equalDate(u.at(1).get('first_day'), new Date(2013, 3, 3));
      assert.equalDate(u.at(1).get('last_day'), new Date(2013, 3, 5));
      assert.equal(newUtilization, u.at(1));
    });

    suite('no splitting required', function() {
      test('no utilization preceeding', function() {
        var u = new Utilizations([{
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }]);
        var newUtilization;

        newUtilization = u.split(new Date(2013, 3, 4));

        assert.equal(u.length, 1);
        assert.strictEqual(newUtilization, null);
      });

      test('no utilization following', function() {
        var u = new Utilizations([{
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }]);
        var newUtilization;

        newUtilization = u.split(new Date(2013, 3, 6));

        assert.equal(u.length, 1);
        assert.strictEqual(newUtilization, null);
      });

      test('no utilization at specified date', function() {
        var u = new Utilizations([{
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }]);
        var newUtilization;

        newUtilization = u.split(new Date(2013, 3, 7));

        assert.equal(u.length, 1);
        assert.strictEqual(newUtilization, null);
      });

      test('distinct utilizations at split point', function() {
        var u = new Utilizations([
          {
            first_day: new Date(2013, 3, 4),
            last_day: new Date(2013, 3, 5)
          }, {
            first_day: new Date(2013, 3, 6),
            last_day: new Date(2013, 3, 7)
          }]);
        var newUtilization;

        newUtilization = u.split(new Date(2013, 3, 6));

        assert.equal(u.length, 2);
        assert.strictEqual(newUtilization, null);
      });
    });

    suite('events', function() {
      var u, events;

      setup(function() {
        u = new Utilizations([{
          first_day: new Date(2013, 3, 1),
          last_day: new Date(2013, 3, 5)
        }]);
        events = [];

        u.on('all', function(eventName) {
          events.push(eventName);
        });
      });
      test('triggers appropriate events by default', function() {
        u.split(new Date(2013, 3, 3));

        assert.sameMembers(events, ['add', 'change', 'change:last_day']);
      });
      test('honors `silent` flag when present', function() {
        u.split(new Date(2013, 3, 3), { silent: true });

        assert.deepEqual(events, []);
      });
    });
  });

  suite('#verify', function() {
    test('sets flag on specified utilization', function() {
      var u = new Utilizations([{
        first_day: new Date(2013, 3, 3),
        last_day: new Date(2013, 3, 3)
      }]);
      var model = u.at(0);

      u.verify(new Date(2013, 3, 3));

      assert.ok(model.get('verified'));
    });

    test('sets flag on all utilizations in specified interval', function() {
      var u = new Utilizations([
        {
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 3)
        }, {
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 5)
        }, {
          first_day: new Date(2013, 3, 6),
          last_day: new Date(2013, 3, 6)
        }
      ]);

      u.verify(new Date(2013, 3, 3), 4);

      assert.ok(u.at(0).get('verified'));
      assert.ok(u.at(1).get('verified'));
      assert.ok(u.at(2).get('verified'));
    });

    test('splits first utilization if it extends before the specified date', function() {
      var u = new Utilizations([
        {
          first_day: new Date(2013, 3, 3),
          last_day: new Date(2013, 3, 5)
        }
      ]);

      u.verify(new Date(2013, 3, 4), 2);

      assert.equal(u.length, 2);
      assert.notOk(u.at(0).get('verified'));
      assert.equalDate(u.at(0).get('first_day'), new Date(2013, 3, 3));
      assert.equalDate(u.at(0).get('last_day'), new Date(2013, 3, 3));
      assert.ok(u.at(1).get('verified'));
      assert.equalDate(u.at(1).get('first_day'), new Date(2013, 3, 4));
      assert.equalDate(u.at(1).get('last_day'), new Date(2013, 3, 5));
    });

    test('splits last utilization if it extends beyond the specified date', function() {
      var u = new Utilizations([
        {
          first_day: new Date(2013, 3, 4),
          last_day: new Date(2013, 3, 4)
        },
        {
          first_day: new Date(2013, 3, 5),
          last_day: new Date(2013, 3, 9)
        }
      ]);

      u.verify(new Date(2013, 3, 4), 2);

      assert.equal(u.length, 3);
      assert.ok(u.at(0).get('verified'));
      assert.equalDate(u.at(0).get('first_day'), new Date(2013, 3, 4));
      assert.equalDate(u.at(0).get('last_day'), new Date(2013, 3, 4));
      assert.ok(u.at(1).get('verified'));
      assert.equalDate(u.at(1).get('first_day'), new Date(2013, 3, 5));
      assert.equalDate(u.at(1).get('last_day'), new Date(2013, 3, 5));
      assert.notOk(u.at(2).get('verified'));
      assert.equalDate(u.at(2).get('first_day'), new Date(2013, 3, 6));
      assert.equalDate(u.at(2).get('last_day'), new Date(2013, 3, 9));
    });

    test('splits utilization on both sides of time period if it extends beyond the entire range', function() {
      var u = new Utilizations([
        {
          first_day: new Date(2013, 3, 1),
          last_day: new Date(2013, 3, 20)
        }
      ]);

      u.verify(new Date(2013, 3, 4), 3);

      assert.equal(u.length, 3);
      assert.notOk(u.at(0).get('verified'));
      assert.equalDate(u.at(0).get('first_day'), new Date(2013, 3, 1));
      assert.equalDate(u.at(0).get('last_day'), new Date(2013, 3, 3));
      assert.ok(u.at(1).get('verified'));
      assert.equalDate(u.at(1).get('first_day'), new Date(2013, 3, 4));
      assert.equalDate(u.at(1).get('last_day'), new Date(2013, 3, 6));
      assert.notOk(u.at(2).get('verified'));
      assert.equalDate(u.at(2).get('first_day'), new Date(2013, 3, 7));
      assert.equalDate(u.at(2).get('last_day'), new Date(2013, 3, 20));
    });

    suite('events', function() {
      var u, events;

      setup(function() {
        u = new Utilizations([{
          first_day: new Date(2013, 3, 1),
          last_day: new Date(2013, 3, 5)
        }]);
        events = [];

        u.on('all', function(eventName) {
          events.push(eventName);
        });
      });
      test('triggers appropriate events by default', function() {
        u.verify(new Date(2013, 3, 3));

        assert.sameMembers(
          events,
          ['add', 'change', 'change:last_day', 'change:verified']
        );
      });
      test('honors `silent` flag when present', function() {
        u.verify(new Date(2013, 3, 3), { silent: true });

        assert.deepEqual(events, []);
      });
      test('honors `silent` flag when present after a `through` parameter', function() {
        u.verify(new Date(2013, 3, 3), 2, { silent: true });

        assert.deepEqual(events, []);
      });
    });
  });
});
