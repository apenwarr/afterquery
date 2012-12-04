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
  var args = afterquery.internal.parseArgs(query);
  WVPASSEQ(args.all.join('|'), 'a,b|c,d|e,=f|,|g,h|g,i%11|a,|a,x');
  WVPASSEQ(args.get('a'), 'x');
  WVPASSEQ(args.get(''), '');
  WVPASSEQ(args.get('g'), 'i%11');

  WVPASSEQ(afterquery.internal.parseArgs('').all.join('|'), ',');
  WVPASSEQ(afterquery.internal.parseArgs('?').all.join('|'), ',');
  WVPASSEQ(afterquery.internal.parseArgs('abc=def').all.join('|'), 'bc,def');
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
