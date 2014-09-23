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
  WVPASSEQ(x(1, 2, 3), [1, 2, 3]);
  WVPASSEQ(x(1, 2, 3).slice(1), [2, 3]);
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
      [1.5, '2012-11-15 01:23', '2013-12-16 01:24:25', false, 'hello'],
      [1.5, '2012-11-15 01:23', '1/2/2013 01:24:25 PDT', false, 'hello']
    ]
  };
  var dt = afterquery.internal.dataToGvizTable(grid, {});
  dump(dt);
  WVPASSEQ(dt.cols.length, 5);
  WVPASSEQ(dt.rows.length, 4);
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


wvtest('delta', function() {
  var grid = {
    headers: ['a', 'b'],
    types: ['number', 'number'],
    data: [
      [0, 1],
      [5, 7],
      [30, 1],
      [2, 1],
      [2, 1]
    ]
  };
  var dt = afterquery.internal.deltaBy(grid, 'a');
  dump(dt);
  WVPASSEQ(dt.data.length, 5);
  WVPASSEQ(dt.data[0][0], 0);
  WVPASSEQ(dt.data[0][1], 1);
  WVPASSEQ(dt.data[1][0], 5);
  WVPASSEQ(dt.data[1][1], 7);
  WVPASSEQ(dt.data[2][0], 25);
  WVPASSEQ(dt.data[2][1], 1);
  WVPASSEQ(dt.data[3][0], 2);
  WVPASSEQ(dt.data[3][1], 1);
  WVPASSEQ(dt.data[4][0], undefined);
  WVPASSEQ(dt.data[4][1], 1);
});


wvtest('unselect', function() {
  var grid = {
    headers: ['a', 'b', 'c'],
    types: ['number', 'number', 'number'],
    data: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
      [13, 14, 15]
    ]
  };
  var dt = afterquery.internal.unselectBy(grid, 'b');
  dump(dt);
  WVPASSEQ(dt.headers.length, 2);
  WVPASSEQ(dt.headers[0], 'a');
  WVPASSEQ(dt.headers[1], 'c');
  WVPASSEQ(dt.types.length, 2);
  WVPASSEQ(dt.types[0], 'number');
  WVPASSEQ(dt.types[1], 'number');
  WVPASSEQ(dt.data.length, 5);
  WVPASSEQ(dt.data[0].length, 2);
  WVPASSEQ(dt.data[0][0], 1);
  WVPASSEQ(dt.data[0][1], 3);
  WVPASSEQ(dt.data[1].length, 2);
  WVPASSEQ(dt.data[1][0], 4);
  WVPASSEQ(dt.data[1][1], 6);
  WVPASSEQ(dt.data[2].length, 2);
  WVPASSEQ(dt.data[2][0], 7);
  WVPASSEQ(dt.data[2][1], 9);
  WVPASSEQ(dt.data[3].length, 2);
  WVPASSEQ(dt.data[3][0], 10);
  WVPASSEQ(dt.data[3][1], 12);
  WVPASSEQ(dt.data[4].length, 2);
  WVPASSEQ(dt.data[4][0], 13);
  WVPASSEQ(dt.data[4][1], 15);
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
  WVPASSEQ(guessTypes([['2012/01/01 23:45:67.12']]), ['datetime']);
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
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    [1, "2", 3,
     '2012-1-1 2:03:04.6',
     '1/2/2012 2:03:04.56789 PDT',
     'Date(2013,0,2,3,4,5)',
     new Date(2014,0,3,4,5,6)]
  ];
  var otherdata = [
    ['a', 'b', 'c'],
    [1, "2", 4,
     '2012-1-1 2:03:04.6',
     'Date(2013,0,2,3,4,5)',
     new Date(2014,0,3,4,5,6)]
  ];
  var grid = {
    headers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    data: [["1", 2, 3,
            new Date(2012,0,1,2,3,4,600),
            new Date(2012,0,2,2,3,4,568),
            new Date(2013,0,2,3,4,5),
            new Date(2014,0,3,4,5,6)]],
    types: ['boolean', 'number', 'number',
            'datetime', 'datetime', 'datetime', 'datetime']
  };
  var gtext = _gridAsText(grid);

  var ggrid = afterquery.internal.gridFromData(grid);
  var grawdata = afterquery.internal.gridFromData(rawdata);
  var gotherdata = afterquery.internal.gridFromData(otherdata);
  WVPASSEQ(_gridAsText(ggrid), gtext);
  WVPASSEQ(_gridAsText(grawdata), gtext);
  WVPASSNE(_gridAsText(gotherdata), gtext);

  WVPASSEQ(ggrid.data, grawdata.data);
  WVPASSNE(ggrid.data, gotherdata.data)

  print(ggrid.types);
  WVPASSEQ(afterquery.internal.stringifiedCols(grawdata.data[0],
                                               grawdata.types),
           [1, 2, 3,
            '2012-01-01 02:03:04.600',
            '2012-01-02 02:03:04.568',
            '2013-01-02 03:04:05',
            '2014-01-03 04:05:06']);
  WVPASS(grawdata.data[0][1].toPrecision);  // check it's a "number"
});


wvtest('filter', function() {
  var rawdata = [
    ['a', 'b', 'c'],
    ['2013/01/02', '2', 3],
    ['2013/04/14', '3.5', 1]
  ];
  afterquery.exec('filter=b=2', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[new Date(2013, 0, 2), 2, 3]]);
  });
  afterquery.exec('filter=a=2013-4-14', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[new Date(2013, 3, 14), 3.5, 1]]);
  });
  afterquery.exec('filter=a<2013-04-14', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[new Date(2013, 0, 2), 2, 3]]);
  });
  afterquery.exec('filter=a>2013-01-02', rawdata, function(grid) {
    WVPASSEQ(grid.data, [[new Date(2013, 3, 14), 3.5, 1]]);
  });
});


wvtest('extract_regexp', function() {
  var rawdata = [
    ['a', 'b', 'c', 'd', 'e'],
    ['2013/01/02', '2013/1/2 9:02:03', 'foofoo', 373.37, 4.9]
  ];
  afterquery.exec('extract_regexp=a=(....-..)&' +
                  'extract_regexp=b=....-..-(.. ..)&' +
                  'extract_regexp=c=(o+)(f*)&' +
                  'extract_regexp=d=\\.(.*)&' +
                  'extract_regexp=e=([\\d.]*)',
                  rawdata, function(grid) {
    WVPASSEQ(grid.data, [['2013-01', '02 09', 'oof', '37', '4.9']]);
  });
});


wvtest('quantize', function() {
  var rawdata = [
    ['a'],
    [-5],
    [936],
    ['1234'],
    [24],
    [36.9]
  ];
  afterquery.exec('quantize=a=10', rawdata, function(grid) {
    WVPASSEQ(grid.data,
             [[-10], [930], [1230], [20], [30]]);
  });
  afterquery.exec('quantize=a=10,100,1000', rawdata, function(grid) {
    WVPASSEQ(grid.data,
             [['<10'], ['100-1000'], ['1000+'], ['10-100'], ['10-100']]);
  });
});


wvtest('yspread', function() {
  var rawdata = [
    ['a', 'b', 'c'],
    [-1, 4, 5],
    [20, 10, 70]
  ];
  afterquery.exec('yspread', rawdata, function(grid) {
    WVPASSEQ(grid.data,
             [[-0.1, 0.4, 0.5], [0.2, 0.1, 0.7]]);
  });
});


wvtest('group', function() {
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


wvtest('pivot', function() {
  var rawdata = [
    ['a', 'b', 'c'],
    ['fred', 9, '2013/01/02'],
    ['bob', 7, '2013/01/01'],
    ['fred', 11, '2013/02/03']
  ];
  var mpd = afterquery.internal.myParseDate;
  var dlist = [mpd('2013/01/02'), mpd('2013/01/01'), mpd('2013/02/03')];
  afterquery.exec('group=a,b;only(c),count(c),sum(c),min(c),max(c),' +
                  'avg(c),median(c),stddev(c)', rawdata, function(grid) {
    WVPASSEQ(grid.headers, ['a', 'b', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c']);
    WVPASSEQ(grid.data, [
      ['fred', 9, dlist[0], 1, 0, dlist[0], dlist[0], 0, dlist[0], 0],
      ['bob', 7, dlist[1], 1, 0, dlist[1], dlist[1], 0, dlist[1], 0],
      ['fred', 11, dlist[2], 1, 0, dlist[2], dlist[2], 0, dlist[2], 0]
    ]);
  });
  afterquery.exec('group=;count(b),sum(b),min(b),max(b),' +
                  'avg(b),median(b),stddev(b)', rawdata, function(grid) {
    WVPASSEQ(grid.headers, ['b', 'b', 'b', 'b', 'b', 'b', 'b']);
    WVPASSEQ(grid.data, [[3, 27, 7, 11, 27.0 / 3.0, 9, Math.sqrt(8)]]);
  });
  afterquery.exec('pivot=a;b;only(c)', rawdata, function(grid) {
    WVPASSEQ(grid.headers, ['a', 9, 7, 11]);
    WVPASSEQ(grid.types, [
      afterquery.T_STRING,
      afterquery.T_DATE,
      afterquery.T_DATE,
      afterquery.T_DATE
    ]);
    WVPASSEQ(grid.data, [
      ['fred', dlist[0], null, dlist[2]],
      ['bob', null, dlist[1], null]
    ]);
  });
  afterquery.exec('pivot=a;b;c', rawdata, function(grid) {
    WVPASSEQ(grid.headers, ['a', 9, 7, 11]);
    WVPASSEQ(grid.types, [
      afterquery.T_STRING,
      afterquery.T_NUM,
      afterquery.T_NUM,
      afterquery.T_NUM
    ]);
    WVPASSEQ(grid.data, [
      ['fred', 1, null, 1],
      ['bob', null, 1, null]
    ]);
  });
  afterquery.exec('pivot=a;b;only(c),count(c)', rawdata, function(grid) {
    WVPASSEQ(grid.headers, [
      'a',
      '9 only(c)', '9 count(c)',
      '7 only(c)', '7 count(c)',
      '11 only(c)', '11 count(c)'
    ]);
    WVPASSEQ(grid.data, [
      ['fred', dlist[0], 1, null, null, dlist[2], 1],
      ['bob', null, null, dlist[1], 1, null, null]
    ]);
  });
  afterquery.exec('pivot=a;b,c;count(*)', rawdata, function(grid) {
    WVPASSEQ(grid.headers, [
      'a',
      '9 2013-01-02',
      '7 2013-01-01',
      '11 2013-02-03'
    ]);
    WVPASSEQ(grid.data, [
      ['fred', 1, null, 1],
      ['bob', null, 1, null]
    ]);
  });
});
