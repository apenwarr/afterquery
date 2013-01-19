'use strict';


function dump(arg) {
  function _dump(indent, obj) {
    var any = 0;
    if (typeof obj != 'string') {
      for (var i in obj) {
        _dump((indent ? indent + '.' : '') + i, obj[i]);
        any++;
      }
    }
    if (!any) {
      print(indent + ' = ' + obj);
    }
  }
  _dump('', arg);
}


// load the 'afterquery' object for testing
load('render.js');


// fake gviz library implementation
var google = {
  visualization: {
    DataTable: function(t) { return t; }
  }
};


wvtest('parseArgs', function() {
  var query = '?a=b&c=d&e==f&&g=h&g=i%25%31%31&a=&a=x';
  var args = afterquery.parseArgs(query);
  WVPASSEQ(args.all.join('|'), 'a,b|c,d|e,=f|,|g,h|g,i%11|a,|a,x');
  WVPASSEQ(args.get('a'), 'x');
  WVPASSEQ(args.get(''), '');
  WVPASSEQ(args.get('g'), 'i%11');

  WVPASSEQ(afterquery.parseArgs('').all.join('|'), ',');
  WVPASSEQ(afterquery.parseArgs('?').all.join('|'), ',');
  WVPASSEQ(afterquery.parseArgs('abc=def').all.join('|'), 'abc,def');
});


wvtest('argsToArray', function() {
  var x = function() {
    return afterquery.internal.argsToArray(arguments);
  };
  WVPASSEQ(x(1,2,3), [1,2,3]);
  WVPASSEQ(x(1,2,3).slice(1), [2,3]);
});


// Fake setTimeout function for testing runqueue().  Just execute the
// requested function immediately.
function setTimeout(func, when) {
  func();
}


wvtest('queue', function() {
  var queue = [];
  var vfinal = 'never-assigned';
  afterquery.internal.enqueue(queue, 'step1', function(v, done) {
    done(v + '1');
  });
  afterquery.internal.enqueue(queue, 'step2', function(v, done) {
    done(v + '2');
  });
  afterquery.internal.runqueue(queue, 'foo', function(v) {
    vfinal = v;
  });
  WVPASSEQ(vfinal, 'foo12');
});


wvtest('dataToGvizTable', function() {
  var grid = {
    headers: ['a', 'b', 'c', 'd', 'e'],
    types: ['number', 'date', 'datetime', 'bool', 'string'],
    data: [
      [null, null, null, null, null],
      [0, 1, 2, 3, 4],
      [1.5, '2012-11-15 01:23', '2013-12-16 01:24:25', false, 'hello']
    ]
  };
  var dt = afterquery.internal.dataToGvizTable(grid, {});
  dump(dt);
  WVPASSEQ(dt.cols.length, 5);
  WVPASSEQ(dt.rows.length, 3);
  for (var i in dt.cols) {
    WVPASSEQ(dt.cols[i].id, ['a', 'b', 'c', 'd', 'e'][i]);
    WVPASSEQ(dt.cols[i].label, dt.cols[i].id);
    WVPASSEQ(dt.cols[i].type,
             ['number', 'date', 'datetime', 'bool', 'string'][i]);
  }
  for (var coli in dt.rows[0]) {
    print('row', 0, 'col', coli);
    WVPASSEQ(dt.rows[0].c[coli], null);
  }
  for (var rowi = 1; rowi < dt.rows.length; rowi++) {
    for (var coli in dt.rows[rowi].c) {
      print('row', rowi, 'col', coli);
      WVPASSEQ(dt.rows[rowi].c[coli].v, grid.data[rowi][coli]);
    }
  }
});


wvtest('guessTypes', function() {
  var data1 = [['1999-01-01', '1999-02-02', 1, 2.5, false, 'foo']];
  var data2 = [['1999-01-01', '1999-02-02 12:34', 2, 'x', true, null]];
  var datanull = [[null, null, null, null]];
  var guessTypes = afterquery.internal.guessTypes;
  WVPASSEQ(guessTypes([]), []);
  WVPASSEQ(guessTypes([[5]]), ['number']);
  WVPASSEQ(guessTypes([[null]]), ['boolean']);
  WVPASSEQ(guessTypes([['2012']]), ['number']);
  WVPASSEQ(guessTypes([['2012-01']]), ['date']);
  WVPASSEQ(guessTypes([['2012/01']]), ['date']);
  WVPASSEQ(guessTypes([['2012/01-02']]), ['date']);
  WVPASSEQ(guessTypes([['2012/01/01 23:45']]), ['datetime']);
  WVPASSEQ(guessTypes([['2012-01/01 23:45:67']]), ['datetime']);
  WVPASSEQ(guessTypes([['2012/01/01T23:45:67']]), ['datetime']);
  WVPASSEQ(guessTypes([['2012-01-01T23:45:67']]), ['datetime']);
  WVPASSEQ(guessTypes([['2012/01/01 23:45:67.12']]), ['string']);
  WVPASSEQ(guessTypes([['Date(2012,2,3)']]), ['date']);
  WVPASSEQ(guessTypes([['Date(2012,2,3,4)']]), ['datetime']);
  WVPASSEQ(guessTypes([['Date(2012,2,3,4,5,6)']]), ['datetime']);
  WVPASSEQ(guessTypes([['Date(2012,2,3,4,5,6,7)']]), ['datetime']);
  WVPASSEQ(guessTypes([['Date(2012,2,3,4,5,6,7,8)']]), ['string']);
  WVPASSEQ(guessTypes([['Date(2012,x,1)']]), ['string']);
  WVPASSEQ(guessTypes(data1),
           ['date', 'date', 'boolean', 'number', 'boolean', 'string']);
  WVPASSEQ(guessTypes(data2),
           ['date', 'datetime', 'number', 'string', 'boolean', 'boolean']);
  WVPASSEQ(guessTypes(data1.concat(data2)),
           ['date', 'datetime', 'number', 'string', 'boolean', 'string']);
  WVPASSEQ(guessTypes(data2.concat(data1)),
           ['date', 'datetime', 'number', 'string', 'boolean', 'string']);
  WVPASSEQ(guessTypes(data2.concat(datanull)
                                          .concat(data1)),
           ['date', 'datetime', 'number', 'string', 'boolean', 'string']);
  WVPASSEQ(guessTypes(data2.concat(datanull)),
           ['date', 'datetime', 'number', 'string', 'boolean', 'boolean']);
});


wvtest('urlMinusPath', function() {
  WVPASSEQ(afterquery.internal.urlMinusPath('http://x/y/z'),
           'http://x');
  WVPASSEQ(afterquery.internal.urlMinusPath('https://u:p@host:port/y/z'),
           'https://u:p@host:port');
  WVPASSEQ(afterquery.internal.urlMinusPath('http:foo/blah//whatever'),
           'http:');
  WVPASSEQ(afterquery.internal.urlMinusPath('foo/blah//whatever'),
           'foo/blah//whatever');
  WVPASSEQ(afterquery.internal.urlMinusPath('//foo/blah//whatever'),
           '//foo');
});


function _gridAsText(grid) {
  return [].concat(grid.headers, grid.types, grid.data);
}


wvtest('gridFromData', function() {
  var rawdata = [
    ['a', 'b', 'c', 'd', 'e', 'f'],
    [1, 2, 3,
     '2012-1-1 2:03:04', 'Date(2013,0,2,3,4,5)', new Date(2014,0,3,4,5,6)]
  ];
  var otherdata = [
    ['a', 'b', 'c'],
    [1, 2, 4,
     '2012-1-1 2:03:04', 'Date(2013,0,2,3,4,5)', new Date(2014,0,3,4,5,6)]
  ];
  var grid = {
    headers: ['a', 'b', 'c', 'd', 'e', 'f'],
    data: [[1, 2, 3,
            new Date(2012,0,1,2,3,4),
            new Date(2013,0,2,3,4,5), new Date(2014,0,3,4,5,6)]],
    types: ['boolean', 'number', 'number', 'datetime', 'datetime', 'datetime']
  };
  var gtext = _gridAsText(grid);
  WVPASSEQ(_gridAsText(afterquery.internal.gridFromData(grid)), gtext);
  WVPASSEQ(_gridAsText(afterquery.internal.gridFromData(rawdata)), gtext);
  WVPASSNE(_gridAsText(afterquery.internal.gridFromData(otherdata)), gtext);
});


wvtest('exec', function() {
  var rawdata = [
    ['a', 'b', 'c'],
    [1, 2, 3],
    [1, 5, 6],
    [1, 5, 9]
  ];
  afterquery.exec('group=a;', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[1]]);
  });
  afterquery.exec('group=a,b;count(c)&group=a', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[1, 7, 3]]);
  });
  afterquery.exec(['group=a,b;count(c)', 'pivot=a;b;c'], rawdata,
		  function(grid) {
    WVPASSEQ(grid.data, [[1, 1, 2]]);
  });
});
