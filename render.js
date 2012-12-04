"use strict";


// Mostly for konqueror compatibility
if (!window.console) {
  var console = {};
  console.debug = function() {};
}


function err(s) {
  $('#vizlog').append('\n' + s);
}


function showstatus(s, s2) {
  $('#statustext').html(s);
  $('#statussub').text(s2 || '');
  if (s || s2) {
    console.debug('status message:', s, s2);
    $('#vizstatus').show();
  } else {
    $('#vizstatus').hide();
  }
}


function parseArgs(query) {
  var kvlist = query.substr(1).split('&');
  var out = {};
  var outlist = [];
  for (var i in kvlist) {
    var kv = kvlist[i].split('=');
    var key = decodeURIComponent(kv.shift());
    var value = decodeURIComponent(kv.join('='));
    out[key] = value;
    outlist.push([key, value]);
  }
  console.debug('query args:', out);
  console.debug('query arglist:', outlist);
  return {
    get: function(key) { return out[key]; },
    all: outlist
  };
}


function dataToGvizTable(grid, options) {
  if (!options) options = {};
  var headers = grid.headers, data = grid.data, types = grid.types;
  var dheaders = [];
  for (var i in headers) {
    dheaders.push({
      id: headers[i],
      label: headers[i],
      type: types[i]
    });
  }
  var ddata = [];
  for (var rowi in data) {
    var row = [];
    for (var coli in data[rowi]) {
      var col = { v: data[rowi][coli] };
      if (options.show_only_lastseg && col.v && col.v.split) {
	var lastseg = col.v.split('|').pop();
	if (lastseg != col.v) {
	  col.f = lastseg;
	}
      }
      row.push(col);
    }
    ddata.push({c: row});
  }
  return new google.visualization.DataTable({
    cols: dheaders,
    rows: ddata
  });
}


var CANT_NUM = 1;
var CANT_BOOL = 2;
var CANT_DATE = 4;
var CANT_DATETIME = 8;

var T_NUM = 'number';
var T_DATE = 'date';
var T_DATETIME = 'datetime';
var T_BOOL = 'boolean';
var T_STRING = 'string';


function guessTypes(data) {
  console.debug('guessTypes');
  var impossible = [];
  for (var rowi in data) {
    var row = data[rowi];
    for (var coli in row) {
      impossible[coli] += 0;
      var cell = row[coli];
      if (cell == '' || cell == null) continue;
      var d = myParseDate(cell);
      if (isNaN(d)) {
	impossible[coli] |= CANT_DATE | CANT_DATETIME;
      } else if (d.getHours() || d.getMinutes() || d.getSeconds()) {
	impossible[coli] |= CANT_DATE; // has time, so isn't a pure date
      }
      var f = cell * 1;
      if (isNaN(f)) impossible[coli] |= CANT_NUM;
      if (!(cell == 0 || cell == 1 ||
	    cell == 'true' || cell == 'false' ||
	    cell == true || cell == false ||
	    cell == 'True' || cell == 'False')) impossible[coli] |= CANT_BOOL;
    }
  }
  console.debug('guessTypes impossibility list:', impossible);
  var types = [];
  for (var coli in impossible) {
    var imp = impossible[coli];
    if (!(imp & CANT_BOOL)) {
      types[coli] = T_BOOL;
    } else if (!(imp & CANT_DATE)) {
      types[coli] = T_DATE;
    } else if (!(imp & CANT_DATETIME)) {
      types[coli] = T_DATETIME;
    } else if (!(imp & CANT_NUM)) {
      types[coli] = T_NUM;
    } else {
      types[coli] = T_STRING;
    }
  }
  return types;
}


var DATE_RE1 = RegExp('^(\\d{4})[-/](\\d{1,2})(?:[-/](\\d{1,2})(?:[T\\s](\\d{1,2}):(\\d\\d)(?::(\\d\\d))?)?)?$');
var DATE_RE2 = RegExp('^Date\\((\\d+),(\\d+),(\\d+)(?:,(\\d+),(\\d+)(?:,(\\d+)(?:,(\\d+))?)?)?\\)$');
function myParseDate(s) {
  if (s == null) return s;
  if (s && s.getDate) return s;
  var g = DATE_RE1.exec(s) || DATE_RE2.exec(s);
  if (g) {
    return new Date(g[1], g[2]-1, g[3] || 1,
		    g[4] || 0, g[5] || 0, g[6] || 0, g[7] || 0);
  }
  return NaN;
}


function parseDates(data, types) {
  for (var coli in types) {
    var type = types[coli];
    if (type === T_DATE || type === T_DATETIME) {
      for (var rowi in data) {
	data[rowi][coli] = myParseDate(data[rowi][coli]);
      }
    }
  }
}


function colNameToColNum(grid, colname) {
  var keycol = colname=='*' ? 0 : grid.headers.indexOf(colname);
  if (keycol < 0) {
    throw new Error('unknown column name "' + key + '"');
  }
  return keycol;
}


var FUNC_RE = /^(\w+)\((.*)\)$/;
function keyToColNum(grid, key) {
  var g = FUNC_RE.exec(key);
  if (g) {
    return colNameToColNum(grid, g[2]);
  } else {
    return colNameToColNum(grid, key);
  }
}


function _groupByLoop(ingrid, keys, initval, addcols_func, putvalues_func) {
  var outgrid = {headers: [], data: [], types: []};
  var keycols = [];
  for (var keyi in keys) {
    var colnum = keyToColNum(ingrid, keys[keyi]);
    keycols.push(colnum);
    outgrid.headers.push(ingrid.headers[colnum]);
    outgrid.types.push(ingrid.types[colnum]);
  }
  
  addcols_func(outgrid);

  var out = {};
  for (var rowi in ingrid.data) {
    var row = ingrid.data[rowi];
    var key = [];
    for (var kcoli in keycols) {
      key.push(row[keycols[kcoli]]);
    }
    var orow = out[key];
    if (!orow) {
      orow = [];
      for (var keyi in keys) {
	orow[keyi] = row[keycols[keyi]];
      }
      for (var i = keys.length; i < outgrid.headers.length; i++) {
	orow[i] = initval;
      }
      out[key] = orow;
      // deliberately preserve sequencing as much as possible.  The first
      // time we see a given key is when we add it to the outgrid.
      outgrid.data.push(orow);
    }
    putvalues_func(outgrid, key, orow, row);
  }
  return outgrid;
}


var agg_types = {
  count: T_NUM,
  sum: T_NUM
};


var agg_funcs = {
  first: function(l) {
    return l[0];
  },

  last: function(l) {
    return l.slice(l.length-1)[0];
  },
  
  only: function(l) {
    if (l.length == 1) {
      return l[0];
    } else if (l.length < 1) {
      return null;
    } else {
      throw new Error('cell has more than one value: only(' + l + ')')
    }
  },
  
  min: function(l) {
    var out = null;
    for (var i in l) {
      if (out == null || l[i] < out) {
	out = l[i];
      }
    }
    return out;
  },
  
  max: function(l) {
    var out = null;
    for (var i in l) {
      if (out == null || l[i] > out) {
	out = l[i];
      }
    }
    return out;
  },
  
  cat: function(l) {
    return l.join(' ');
  },
  
  count: function(l) {
    return l.length;
  },
  
  count_distinct: function(l) {
    var a = {};
    for (var i in l) {
      a[l[i]] = 1;
    }
    var acc = 0;
    for (var i in a) {
      acc += 1;
    }
    return acc;
  },

  sum: function(l) {
    var acc;
    if (l.length) acc = 0;
    for (var i in l) {
      acc += parseFloat(l[i]);
    }
    return acc;
  }
};
agg_funcs.count.return_type = T_NUM;
agg_funcs.sum.return_type = T_NUM;


function groupBy(ingrid, keys, values) {
  // add one value column for every column listed in values.
  var valuecols = [];
  var valuefuncs = [];
  var addcols_func = function(outgrid) {
    for (var valuei in values) {
      var g = FUNC_RE.exec(values[valuei]);
      var field, func;
      if (g) {
	func = agg_funcs[g[1]];
	if (!func) {
	  throw new Error('unknown aggregation function "' + g[1] + '"');
	}
	field = g[2];
      } else {
	func = null;
	field = values[valuei];
      }
      var colnum = keyToColNum(ingrid, field);
      console.debug('v', values[valuei], func, field);
      if (!func) {
	if (ingrid.types[colnum] === T_NUM) {
	  func = agg_funcs.sum;
	} else {
	  func = agg_funcs.count;
	}
      }
      valuecols.push(colnum);
      valuefuncs.push(func);
      outgrid.headers.push(field=='*' ? '_count' : ingrid.headers[colnum]);
      outgrid.types.push(func.return_type || ingrid.types[colnum]);
    }
  };
  
  // by default, we do a count(*) operation for non-numeric value
  // columns, and sum(*) otherwise.
  var putvalues_func = function(outgrid, key, orow, row) {
    for (var valuei in values) {
      var incoli = valuecols[valuei];
      var outcoli = key.length + parseInt(valuei);
      var cell = row[incoli];
      if (!orow[outcoli]) orow[outcoli] = [];
      if (cell != null) {
	orow[outcoli].push(cell);
      }
    }
  };

  var outgrid = _groupByLoop(ingrid, keys, 0,
			     addcols_func, putvalues_func);
  
  for (var rowi in outgrid.data) {
    var row = outgrid.data[rowi];
    for (var valuei in values) {
      var outcoli = keys.length + parseInt(valuei);
      var func = valuefuncs[valuei];
      row[outcoli] = func(row[outcoli]);
    }
  }
  
  return outgrid;
}


function pivotBy(ingrid, rowkeys, colkeys, valkeys) {
  // We generate a list of value columns based on all the unique combinations
  // of (values in colkeys)*(column names in valkeys)
  var valuecols = {};
  var colkey_outcols = {};
  var colkey_incols = [];
  for (var coli in colkeys) {
    colkey_incols.push(keyToColNum(ingrid, colkeys[coli]));
  }
  var addcols_func = function(outgrid) {
    for (var rowi in ingrid.data) {
      var row = ingrid.data[rowi];
      var colkey = [];
      for (var coli in colkey_incols) {
	var colnum = colkey_incols[coli];
	colkey.push(row[colnum]);
      }
      for (var coli in valkeys) {
	var xcolkey = colkey.concat([valkeys[coli]]);
	if (!(xcolkey in colkey_outcols)) {
	  // if there's only one valkey (the common case), don't include the
	  // name of the old value column in the new column names; it's
	  // just clutter.
	  var name = valkeys.length>1 ? xcolkey.join(' ') : colkey.join(' ');
	  var colnum = keyToColNum(ingrid, valkeys[coli]);
	  colkey_outcols[xcolkey] = outgrid.headers.length;
	  valuecols[xcolkey] = colnum;
	  outgrid.headers.push(name);
	  outgrid.types.push(ingrid.types[colnum]);
	}
      }
    }
    console.debug('pivot colkey_outcols', colkey_outcols);
    console.debug('pivot valuecols:', valuecols);
  };
  
  // by the time pivotBy is called, we're guaranteed that there's only one
  // row with a given (rowkeys+colkeys) key, so there is only one value
  // for each value cell.  Thus we don't need to worry about count/sum here;
  // we just assign the values directly as we see them.
  var putvalues_func = function(outgrid, rowkey, orow, row) {
    var colkey = [];
    for (var coli in colkey_incols) {
      var colnum = colkey_incols[coli];
      colkey.push(row[colnum]);
    }
    for (var coli in valkeys) { 
      var xcolkey = colkey.concat([valkeys[coli]]);
      var outcolnum = colkey_outcols[xcolkey];
      var valuecol = valuecols[xcolkey];
      orow[outcolnum] = row[valuecol];
    }
  };

  return _groupByLoop(ingrid, rowkeys, undefined,
		      addcols_func, putvalues_func);
}


function stringifiedCols(row, types) {
  var out = []
  for (var coli in types) {
    if (types[coli] === T_DATE) {
      out.push(row[coli].strftime('%Y-%m-%d') || '');
    } else if (types[coli] === T_DATETIME) {
      out.push(row[coli].strftime('%Y-%m-%d %H:%M:%S') || '');
    } else {
      out.push((row[coli] + '') || '(none)');
    }
  }
  return out;
}


var KEY_ALL = ['ALL'];
function treeify(ingrid, nkeys) {
  var outgrid = {
      headers: ['_id', '_parent'].concat(ingrid.headers.slice(nkeys)),
      types: [T_STRING, T_STRING].concat(ingrid.types.slice(nkeys)),
      data: []
  };

  var seen = {};
  var missing = {};
  
  var add = function(key, values) {
    var pkey = key.slice(0, key.length - 1);
    if (!pkey.length && key != KEY_ALL) pkey = KEY_ALL;
    outgrid.data.push([key.join('|'), pkey.join('|')].concat(values));
    if (pkey.length && !(pkey in seen)) {
      missing[pkey] = pkey;
    }
    if (key in missing) {
      delete missing[key];
    }
    seen[key] = 1;
  }
  
  for (var rowi in ingrid.data) {
    var row = ingrid.data[rowi];
    var key = row.slice(0, nkeys);
    add(stringifiedCols(row.slice(0, nkeys),
			ingrid.types.slice(0, nkeys)),
	row.slice(nkeys));
  }
  var done = 0;
  for (var i = 0; i < ingrid.data.length * nkeys && !done; i++) {
    for (var missi in missing) {
      var miss = missing[missi];
      add(miss, []);
      done = 0;
      break;
    }
  }
  return outgrid;
}


function splitNoEmpty(s, splitter) {
  if (!s) return [];
  return s.split(splitter);
}


function keysOtherThan(grid, keys) {
  var out = [];
  var keynames = [];
  for (var keyi in keys) {
    // this converts func(x) notation to just 'x'
    keynames.push(grid.headers[keyToColNum(grid, keys[keyi])]);
  }
  for (var coli in grid.headers) {
    if (keynames.indexOf(grid.headers[coli]) < 0) {
      out.push(grid.headers[coli]);
    }
  }
  return out;
}


function doGroupBy(grid, argval) {
  console.debug('groupBy:', argval);
  var parts = argval.split(';', 2);
  var keys = splitNoEmpty(parts[0], ',');
  var values;
  if (parts.length >= 2) {
    // if there's a ';' separator, the names after it are the desired
    // value columns (and that list may be empty).
    var tmpvalues = splitNoEmpty(parts[1], ',');
    values = [];
    for (var tmpi in tmpvalues) {
      var tmpval = tmpvalues[tmpi];
      if (tmpval == '*') {
	values = values.concat(keysOtherThan(grid, keys.concat(values)));
      } else {
	values.push(tmpval);
      }
    }
  } else {
    // if there is no ';' at all, the default is to just pull in all the
    // remaining non-key columns as values.
    values = keysOtherThan(grid, keys);
  }
  console.debug('grouping by', keys, values);
  grid = groupBy(grid, keys, values);
  console.debug('grid:', grid);
  return grid;
}


function doTreeGroupBy(grid, argval) {
  console.debug('treeGroupBy:', argval);
  var parts = argval.split(';', 2);
  var keys = splitNoEmpty(parts[0], ',');
  var values;
  if (parts.length >= 2) {
    // if there's a ';' separator, the names after it are the desired
    // value columns (and that list may be empty).
    values = splitNoEmpty(parts[1], ',');
  } else {
    // if there is no ';' at all, the default is to just pull in all the
    // remaining non-key columns as values.
    values = keysOtherThan(grid, keys);
  }
  console.debug('treegrouping by', keys, values);
  grid = groupBy(grid, keys, values);
  grid = treeify(grid, keys.length);
  console.debug('grid:', grid);
  return grid;
}


function doPivotBy(grid, argval) {
  console.debug('pivotBy:', argval);
  
  // the parts are rowkeys;colkeys;values
  var parts = argval.split(';', 3);
  var rowkeys = splitNoEmpty(parts[0], ',');
  var colkeys = splitNoEmpty(parts[1], ',');
  var values;
  if (parts.length >= 3) {
    // if there's a second ';' separator, the names after it are the desired
    // value columns.
    values = splitNoEmpty(parts[2], ',');
  } else {
    // if there is no second ';' at all, the default is to just pull
    // in all the remaining non-key columns as values.
    values = keysOtherThan(grid, rowkeys.concat(colkeys));
  }

  // first group by the rowkeys+colkeys, so there is only one row for each
  // unique rowkeys+colkeys combination.
  grid = groupBy(grid, rowkeys.concat(colkeys), values);
  console.debug('tmpgrid:', grid);

  // now actually do the pivot.
  grid = pivotBy(grid, rowkeys, colkeys, values);

  return grid;
}


function filterBy(ingrid, key, op, values) {
  var outgrid = {headers: ingrid.headers, data: [], types: ingrid.types};
  var keycol = keyToColNum(ingrid, key);
  var wantvals = [];
  for (var valuei in values) {
    if (ingrid.types[keycol] === T_NUM) {
      wantvals.push(parseFloat(values[valuei]));
    } else if (ingrid.types[keycol] === T_DATE ||
	       ingrid.types[keycol] === T_DATETIME) {
      wantvals.push(myParseDate(values[valuei]));
    } else {
      wantvals.push(values[valuei]);
    }
  }

  for (var rowi in ingrid.data) {
    var row = ingrid.data[rowi];
    var cell = row[keycol];
    var found = 0;
    for (var valuei in wantvals) {
      if (op == '=' && cell == wantvals[valuei]) {
	found = 1;
      } else if (op == '==' && cell == wantvals[valuei]) {
	found = 1;
      } else if (op == '>=' && cell >= wantvals[valuei]) {
	found = 1;
      } else if (op == '<=' && cell <= wantvals[valuei]) {
	found = 1;
      } else if (op == '>' && cell > wantvals[valuei]) {
	found = 1;
      } else if (op == '<' && cell < wantvals[valuei]) {
	found = 1;
      } else if (op == '!=' && cell != wantvals[valuei]) {
	found = 1;
      } else if (op == '<>' && cell != wantvals[valuei]) {
	found = 1;
      }
      if (found) break;
    }
    if (found) outgrid.data.push(row);
  }
  return outgrid;
}


function trySplitOne(argval, splitstr) {
  var pos = argval.indexOf(splitstr);
  if (pos >= 0) {
    return [argval.substr(0, pos).trim(),
	    argval.substr(pos + splitstr.length).trim()];
  } else {
    return;
  }
}


function doFilterBy(grid, argval) {
  console.debug('filterBy:', argval);
  var ops = ['>=', '<=', '==', '!=', '<>', '>', '<', '='];
  var parts;
  for (var opi in ops) {
    var op = ops[opi];
    if ((parts = trySplitOne(argval, op))) {
      grid = filterBy(grid, parts[0], op, parts[1].split(','));
      console.debug('grid:', grid);
      return grid;
    }
  }
  throw new Error('unknown filter operation in "' + argval + '"');
  return grid;
}


function queryBy(ingrid, words) {
  var outgrid = {headers: ingrid.headers, data: [], types: ingrid.types};
  for (var rowi in ingrid.data) {
    var row = ingrid.data[rowi];
    var found = 0;
    for (var wordi in words) {
      for (var coli in row) {
	var cell = row[coli];
	if (cell.indexOf && cell.indexOf(words[wordi]) >= 0) {
	  found = 1;
	  break;
	}
      }
      if (found) break;
    }
    if (found) {
      outgrid.data.push(row);
    }
  }
  return outgrid;
}


function doQueryBy(grid, argval) {
  console.debug('queryBy:', argval);
  grid = queryBy(grid, argval.split(','));
  console.debug('grid:', grid);
  return grid;
}


function orderBy(grid, keys) {
  var keycols = [];
  for (var keyi in keys) {
    var key = keys[keyi];
    var invert = 1;
    if (key[0] == '-') {
      invert = -1;
      key = key.substr(1);
    }
    keycols.push([keyToColNum(grid, key), invert]);
  }
  console.debug('sort keycols', keycols);
  var comparator = function(a, b) {
    for (var keyi in keycols) {
      var keycol = keycols[keyi][0], invert = keycols[keyi][1];
      var av = a[keycol], bv = b[keycol];
      if (grid.types[keycol] === T_NUM) {
	av = parseFloat(av);
	bv = parseFloat(bv);
      }
      if (av < bv) {
	return -1 * invert;
      } else if (av > bv) {
	return 1 * invert;
      }
    }
    return 0;
  }
  var outdata = grid.data.concat();
  outdata.sort(comparator);
  return { headers: grid.headers, data: outdata, types: grid.types };
}


function doOrderBy(grid, argval) {
  console.debug('orderBy:', argval);
  grid = orderBy(grid, argval.split(','));
  console.debug('grid:', grid);
  return grid;
}


function extractRegexp(grid, colname, regexp) {
  var r = RegExp(regexp);
  var colnum = keyToColNum(grid, colname);
  for (var rowi in grid.data) {
    var row = grid.data[rowi];
    var match = r.exec(row[colnum]);
    if (match) {
      row[colnum] = match.slice(1).join('');
    } else {
      row[colnum] = '';
    }
  }
  return grid;
}


function doExtractRegexp(grid, argval) {
  console.debug('extractRegexp:', argval);
  var parts = trySplitOne(argval, '=');
  var colname = parts[0], regexp = parts[1];
  grid = extractRegexp(grid, colname, regexp);
  console.debug('grid:', grid);
  return grid;
}


function doLimit(ingrid, limit) {
  limit = parseInt(limit)
  if (ingrid.data.length > limit) {
    return {
        headers: ingrid.headers,
        data: ingrid.data.slice(0, limit),
        types: ingrid.types
    };
  } else {
    return ingrid;
  }
}


function fillNullsWithZero(grid) {
  for (var rowi in grid.data) {
    var row = grid.data[rowi];
    for (var coli in row) {
      if (grid.types[coli] === T_NUM && row[coli] == undefined) {
	row[coli] = 0;
      }
    }
  }
  return grid;
}


function gridFromData(gotdata) {
  var headers, data, types;

  var err;
  if (gotdata.errors && gotdata.errors.length) {
    err = gotdata.errors[0];
  } else if (gotdata.error) {
    err = gotdata.error;
  }
  if (err) {
    var msglist = [];
    if (err.message) msglist.push(err.message);
    if (err.detailed_message) msglist.push(err.detailed_message);
    throw new Error('Data provider returned an error: ' + msglist.join(': '));
  }

  if (gotdata.table) {
    // gviz format
    headers = [];
    for (var headeri in gotdata.table.cols) {
      headers.push(gotdata.table.cols[headeri].label ||
		   gotdata.table.cols[headeri].id);
    }
    data = [];
    for (var rowi in gotdata.table.rows) {
      var row = gotdata.table.rows[rowi];
      var orow = [];
      for (var coli in row.c) {
	var col = row.c[coli];
	var g;
	if (!col) {
	  orow.push(null);
	} else {
	  orow.push(col.v);
	}
      }
      data.push(orow);
    }
  } else if (gotdata.data && gotdata.cols) {
    // eqldata.com format
    headers = [];
    for (var coli in gotdata.cols) {
      var col = gotdata.cols[coli];
      headers.push(col.caption);
    }
    data = gotdata.data;
  } else {
    // assume simple [[cols...]...] (two-dimensional array) format, where
    // the first row is the headers.
    headers = gotdata.shift();
    data = gotdata;
  }
  types = guessTypes(data);
  parseDates(data, types);
  return {headers: headers, data: data, types: types};
}


var _queue = [];


function enqueue() {
  _queue.push([].slice.apply(arguments));
}


function runqueue(after_each) {
  var step = function(i) {
    if (i < _queue.length) {
      var el = _queue[i]
      var text = el[0], func = el[1], args = el.slice(2);
      showstatus('Running step ' + (+i+1) + ' of ' + _queue.length + '...',
		 text);
      setTimeout(function() {
	var start = Date.now();
	wrap(func).apply(null, args);
	var end = Date.now();
	if (after_each) {
	  after_each(i + 1, _queue.length, text, end-start);
	}
	step(i + 1);
      }, 0);
    } else {
      showstatus('');
    }
  }
  step(0);
}


function gotData(args, gotdata) {
  var grid;
  enqueue('parse', function() {
    console.debug('gotdata:', gotdata);
    grid = gridFromData(gotdata);
    console.debug('grid:',  grid);
  });
  
  var argi;
  var transform = function(f, arg) {
    enqueue(args.all[argi][0] + '=' + args.all[argi][1], function() {
      grid = f(grid, arg);
    });
  };
  
  for (var argi in args.all) {
    var argkey = args.all[argi][0], argval = args.all[argi][1];
    if (argkey == 'group') {
      transform(doGroupBy, argval);
    } else if (argkey == 'treegroup') {
      transform(doTreeGroupBy, argval);
    } else if (argkey == 'pivot') {
      transform(doPivotBy, argval);
    } else if (argkey == 'filter') {
      transform(doFilterBy, argval);
    } else if (argkey == 'q') {
      transform(doQueryBy, argval);
    } else if (argkey == 'limit') {
      transform(doLimit, argval);
    } else if (argkey == 'order') {
      transform(doOrderBy, argval);
    } else if (argkey == 'extract_regexp') {
      transform(doExtractRegexp, argval);
    }
  }
  
  var chartops = args.get('chart'), trace = args.get('trace');
  var t, datatable;
  var options = {};
  
  enqueue('gentable', function() {
    if (chartops) {
      if (chartops == 'stacked' || chartops == 'stackedarea') {
	// Some charts react badly to missing values, so fill them in.
	grid = fillNullsWithZero(grid);
      }
      var el = document.getElementById('vizchart');
      if (args.get('title')) {
	options.title = args.get('title');
      }
      if (chartops == 'stackedarea' || chartops == 'stacked') {
	t = new google.visualization.AreaChart(el);
	options.isStacked = true;
      } else if (chartops == 'column') {
	t = new google.visualization.ColumnChart(el);
      } else if (chartops == 'bar') {
	t = new google.visualization.BarChart(el);
      } else if (chartops == 'line') {
	t = new google.visualization.LineChart(el);
      } else if (chartops == 'spark') {
	// sparkline chart: get rid of everything but the data series.
	// Looks best when small.
	options.hAxis = {};
	options.hAxis.baselineColor = 'none';
	options.hAxis.textPosition = 'none';
	options.hAxis.gridlines = {};
	options.hAxis.gridlines.color = 'none';
	options.vAxis = {};
	options.vAxis.baselineColor = 'none';
	options.vAxis.textPosition = 'none';
	options.vAxis.gridlines = {};
	options.vAxis.gridlines.color = 'none';
	options.theme = 'maximized';
	options.legend = {};
	options.legend.position = 'none';
	t = new google.visualization.LineChart(el);
      } else if (chartops == 'pie') {
	t = new google.visualization.PieChart(el);
      } else if (chartops == 'tree') {
	options.maxDepth = 3;
	options.maxPostDepth = 1;
	options.showScale = 1;
	t = new google.visualization.TreeMap(el);
      } else if (chartops == 'candle' || chartops == 'candlestick') {
	t = new google.visualization.CandlestickChart(el);
      } else if (chartops == 'timeline') {
	t = new google.visualization.AnnotatedTimeLine(el);
      } else if (chartops == 'dygraph' || chartops == 'dygraph+errors') {
	t = new Dygraph.GVizChart(el);
	options.showRoller = true;
	if (chartops == 'dygraph+errors') {
	  options.errorBars = true;
	}
      } else {
	throw new Error('unknown chart type "' + chartops + '"');
      }
      $(el).height(window.innerHeight);
      datatable = dataToGvizTable(grid, { show_only_lastseg: true });
    } else {
      var el = document.getElementById('viztable');
      t = new google.visualization.Table(el);
      datatable = dataToGvizTable(grid);
    }

    var wantwidth = trace ? window.innerWidth - 40 : window.innerWidth;
    $(el).width(wantwidth);

    var dateformat = new google.visualization.DateFormat({
      pattern: 'yyyy-MM-dd'
    });
    var datetimeformat = new google.visualization.DateFormat({
      pattern: 'yyyy-MM-dd HH:mm:ss'
    });
    for (var coli = 0; coli < grid.types.length; coli++) {
      if (grid.types[coli] === T_DATE) {
	dateformat.format(datatable, coli);
      } else if (grid.types[coli] === T_DATETIME) {
	datetimeformat.format(datatable, coli);
      }
    }
  });
  
  enqueue(chartops ? 'chart=' + chartops : 'view', function() {
    t.draw(datatable, options);
  });
  
  
  if (trace) {
    var prevdata;
    var after_each = function(stepi, nsteps, text, msec_time) {
      $('#vizlog').append('<div class="vizstep" id="step' + stepi + '">' +
			  '  <div class="text"></div>' +
			  '  <div class="grid"></div>' +
			  '</div>');
      $('#step' + stepi + ' .text').text('Step ' + stepi + 
					 ' (' + msec_time + 'ms):  ' +
					 text);
      var viewel = $('#step' + stepi + ' .grid');
      if (prevdata != grid.data) {
	var t = new google.visualization.Table(viewel[0]);
	var datatable = dataToGvizTable({
	  headers: grid.headers,
	  data: grid.data.slice(0, 1000),
	  types: grid.types
	});
	t.draw(datatable);
	prevdata = grid.data;
      } else {
	viewel.text('(unchanged)');
      }
      if (stepi == nsteps) {
	$('.vizstep').show();
      }
    };
    runqueue(after_each);
  } else {
    runqueue();
  }
}


function gotError(url, jqxhr, status) {
  showstatus('');
  $('#vizraw').html('<a href="' + encodeURI(url) + '">' +
		    encodeURI(url) +
		    '</a>');
  throw new Error('error getting url "' + url + '": ' +
		  status + ': ' +
		  'visit the data page and ensure it\'s valid jsonp.');
}


function wrap(func) {
  var pre_args = [].slice.call(arguments, 1);
  var f = function() {
    try {
      return func.apply(null, pre_args.concat([].slice.call(arguments)));
    } catch (e) {
      $('#vizchart').hide();
      $('#viztable').hide();
      $('#vizstatus').css('position', 'relative');
      $('.vizstep').show();
      err(e);
      err("<p><a href='/help'>here's the documentation</a>");
      throw e;
    }
  }
  return f;
}


function getUrlData(url, success_func, error_func) {
  // some services expect callback=, some expect jsonp=, so supply both
  var plus = 'callback=jsonp&jsonp=jsonp';
  var nurl;
  if (url.indexOf('?') >= 0) {
    nurl = url + '&' + plus;
  } else {
    nurl = url + '?' + plus;
  }

  var iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.insertBefore(iframe, 0);

  // the default jsonp callback
  iframe.contentWindow.jsonp = success_func;

  // some services are hardcoded to use the gviz callback, so supply that too
  iframe.contentWindow.google = {
    visualization: {
      Query: {
	setResponse: success_func
      }
    }
  };

  iframe.contentWindow.onerror = function(message, xurl, lineno) {
    error(null, message + ' url=' + xurl + ' line=' + lineno);
  }

  iframe.contentWindow.loaded = function() {
    alert('loaded');
  }

  iframe.contentDocument.write(
      '<script async onerror="loaded" onload="loaded" src="' + encodeURI(url) + '"></script>');
}


function _run(query) {
  var args = parseArgs(query);
  var url = args.get('url');
  if (!url) throw new Error("Missing url= in query parameter");
  showstatus('Loading <a href="' + encodeURI(url) + '">data</a>...');
  getUrlData(url, wrap(gotData, args), wrap(gotError, url));
  var editlink = args.get('editlink');
  if (editlink == 0) {
    $('#editmenu').hide();
  }
}


var afterquery = {
  render: wrap(_run)
};
