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


function dataToGvizTable(grid) {
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
      row.push({v:data[rowi][coli]});
    }
    ddata.push({c: row});
  }
  return new google.visualization.DataTable({
    cols: dheaders,
    rows: ddata
  });
}


CANT_NUM = 1;
CANT_DATE = 2;
CANT_BOOL = 4;

T_NUM = 'number';
T_DATE = 'date';
T_BOOL = 'boolean';
T_STRING = 'string';


function guessTypes(data) {
  var impossible = [];
  for (var rowi in data) {
    var row = data[rowi];
    for (var coli in row) {
      impossible[coli] += 0;
      //impossible[coli] |= CANT_DATE; // fixme
      var cell = row[coli];
      if (isNaN(Date.parse(cell))) impossible[coli] |= CANT_DATE;
      var f = cell * 1;
      if (isNaN(f)) impossible[coli] |= CANT_NUM;
      if (!(cell == 0 || cell == 1 ||
	    cell == 'true' || cell == 'false' ||
	    cell == true || cell == false ||
	    cell == 'True' || cell == 'False')) impossible[coli] |= CANT_BOOL;
    }
  }
  var types = [];
  for (var coli in impossible) {
    var imp = impossible[coli];
    if (!(imp & CANT_BOOL)) {
      types[coli] = T_BOOL;
    } else if (!(imp & CANT_NUM)) {
      types[coli] = T_NUM;
    } else if (!(imp & CANT_DATE)) {
      types[coli] = T_DATE;
    } else {
      types[coli] = T_STRING;
    }
  }
  return types;
}


DATE_RE1 = RegExp('^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})(?:[T\\s](\\d{1,2}):(\\d\\d)(?::(\\d\\d))?)?$');
DATE_RE2 = RegExp('^Date\\((\\d+),(\\d+),(\\d+)(?:,(\\d+),(\\d+)(?:,(\\d+))?)?\\)$');
function myParseDate(s) {
  var g = DATE_RE1.exec(s);
  if (!g) g = DATE_RE2.exec(s);
  if (g) {
    return new Date(g[1], g[2]-1, g[3],
		    g[4] || 0, g[5] || 0, g[6] || 0);
  }
  return NaN;
}


function parseDates(data, types) {
  for (var coli in types) {
    var type = types[coli];
    if (type === T_DATE || type == T_DATE) {
      for (var rowi in data) {
	data[rowi][coli] = myParseDate(data[rowi][coli]);
      }
    }
  }
}


function keyToColNum(grid, key) {
  var keycol = grid.headers.indexOf(key);
  if (keycol < 0) {
    throw new Error('unknown column name "' + key + '"');
  }
  return keycol;
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


function groupBy(ingrid, keys, values) {
  // add one value column for every column listed in values.
  var valuecols = [];
  var addcols_func = function(outgrid) {
    for (var valuei in values) {
      var colnum = keyToColNum(ingrid, values[valuei]);
      valuecols.push(colnum);
      outgrid.headers.push(ingrid.headers[colnum]);
      outgrid.types.push(T_NUM);
    }
  };
  
  // we do a count(*) operation for non-numeric value columns, and
  // sum(*) otherwise.
  var putvalues_func = function(outgrid, key, orow, row) {
    for (var valuei in values) {
      var incoli = valuecols[valuei];
      var outcoli = key.length + parseInt(valuei);
      var cell = row[incoli];
      if (ingrid.types[incoli] === T_NUM) {
	orow[outcoli] += parseFloat(cell);
      } else {
	orow[outcoli] += 1;
      }
    }
  };

  return _groupByLoop(ingrid, keys, 0,
		      addcols_func, putvalues_func);
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


function splitNoEmpty(s, splitter) {
  if (!s) return [];
  return s.split(splitter);
}


function keysOtherThan(grid, keys) {
  var out = [];
  for (var coli in grid.headers) {
    if (keys.indexOf(grid.headers[coli]) < 0) {
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
    values = splitNoEmpty(parts[1], ',');
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
    } else if (ingrid.types[keycol] === T_DATE) {
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
  grid.data.sort(comparator);
  return grid;
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
    match = r.exec(row[colnum]);
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


function fillNullsWithZero(grid) {
  for (var rowi in grid.data) {
    row = grid.data[rowi];
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


function gotData(gotdata) {
  console.debug('gotdata:', gotdata);
  var grid = gridFromData(gotdata);
  console.debug('grid:',  grid);
  
  for (var argi in args.all) {
    var argkey = args.all[argi][0], argval = args.all[argi][1];
    if (argkey == 'group') {
      grid = doGroupBy(grid, argval);
    } else if (argkey == 'pivot') {
      grid = doPivotBy(grid, argval);
    } else if (argkey == 'filter') {
      grid = doFilterBy(grid, argval);
    } else if (argkey == 'q') {
      grid = doQueryBy(grid, argval);
    } else if (argkey == 'limit') {
      if (grid.data.length > argval) {
	grid.data.length = argval;
      }
    } else if (argkey == 'order') {
      grid = doOrderBy(grid, argval);
    } else if (argkey == 'extract_regexp') {
      grid = doExtractRegexp(grid, argval);
    }
  }
  var chartops = args.get('chart');
  var t;
  if (chartops) {
    grid = fillNullsWithZero(grid);
    var el = document.getElementById('vizchart');
    $(el).height(window.innerHeight).width(window.innerWidth);
    var options = {};
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
    } else if (chartops == 'pie') {
      t = new google.visualization.PieChart(el);
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
      // default to a line chart if unrecognized type
      t = new google.visualization.LineChart(el);
    }
  } else {
    var el = document.getElementById('viztable');
    t = new google.visualization.Table(el);
  }
  var datatable = dataToGvizTable(grid);
  t.draw(datatable, options);
}


function gotError(jqxhr, status) {
  throw new Error('error getting url "' + args.get('url') + '": ' + status)
}


function wrap(func, a, b, c, d) {
  try {
    return func(a, b, c, d);
  } catch (e) {
    document.write(e);
    document.write("<p><a href='/help'>here's the documentation</a>");
    throw e;
  }
}


function _run(query) {
  args = parseArgs(query);
  var url = args.get('url');
  if (!url) throw new Error("Missing url= in query parameter");
  var data = $.ajax({
    url: url,
    dataType: 'jsonp',
    jsonpCallback: 'jsonp',
    cache: true,
    success: function(data, status) { return wrap(gotData, data, status); },
    error: function(data, status) { return wrap(gotError, data, status); }
  });
  var editlink = args.get('editlink');
  if (editlink == 0) {
    $('#editmenu').hide();
  }
}


var afterquery = {
  render: function(data) { return wrap(_run, data); }
};
