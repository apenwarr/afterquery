/*
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var HeatGrid = function(el) {
  this.el = $(el);

  var rgb = function(r, g, b) {
    return 'rgb(' + parseInt(r) + ',' + parseInt(g) + ',' + parseInt(b) + ')';
  }

  var frac = function(minval, maxval, fraction) {
    return minval + fraction * (maxval - minval);
  }

  var gradient = function(mincolor, zerocolor, maxcolor,
                          ofs) {
    if (ofs == 0) {
      return [zerocolor[0], zerocolor[1], zerocolor[2], 0];
    } else if (ofs < 0) {
      return [frac(zerocolor[0], mincolor[0], -ofs/3),
              frac(zerocolor[1], mincolor[1], -ofs/3),
              frac(zerocolor[2], mincolor[2], -ofs/3)];
    } else if (ofs > 0) {
      return [frac(zerocolor[0], maxcolor[0], ofs/3),
              frac(zerocolor[1], maxcolor[1], ofs/3),
              frac(zerocolor[2], maxcolor[2], ofs/3)];
    }
  }

  this.draw = function(grid) {
    console.debug('heatgrid.draw', grid);
    this.el.html('<div id="heatgrid"><canvas></canvas>' +
                 '<div id="heatgrid-popover"></div></div>');
    var heatgrid = this.el.find('#heatgrid');
    heatgrid.css({
      position: 'relative',
      overflow: 'scroll',
      width: '100%',
      height: '100%',
    });
    var popover = this.el.find('#heatgrid-popover');
    popover.css({
      position: 'absolute',
      top: 0, left: 0,
      background: '#aaa',
      border: '1px dotted black',
      'white-space': 'pre'
    });
    var canvas = this.el.find('canvas');
    var xmult = parseInt(1000 / grid.headers.length);
    if (xmult < 1) xmult = 1;
    var xsize = grid.headers.length * xmult;
    var ysize = grid.data.length;
    canvas.attr({width: xsize, height: ysize});
    canvas.css({
      background: '#fff',
      width: '100%',
      height: ysize //'100%',
    });
    console.debug('heatgrid canvas size is: x y =', xsize, ysize);
    var ctx = canvas[0].getContext('2d');

    if (!grid.data.length || !grid.data[0].length) {
      return;
    }

    // TODO(apenwarr): offsetX/Y are flakey, use something else
    var movefunc = function(offX, offY) {
      var x = parseInt(offX / canvas.width() * grid.headers.length);
      var y = parseInt(offY / canvas.height() * grid.data.length);
      if (x > grid.headers.length || y > grid.data.length) return;
      var info = [];
      for (var i = 0; i < grid.headers.length; i++) {
        if (grid.types[i] != 'number') {
          info.push(grid.data[y][i]);
        } else {
          break;
        }
      }
      info.push(grid.headers[x]);
      info.push('value=' + grid.data[y][x]);

      popover.css({
        left: (x + 0.4) / grid.headers.length * canvas.width(),
        top: (y + 0.4) / grid.data.length * canvas.height(),
      });
      popover.text(info.join('\n'));
    };
    heatgrid.mousemove(function(ev) {
      var pos = canvas.position();
      movefunc(ev.pageX - pos.left, ev.pageY - pos.top);
    });
    heatgrid.mouseleave(function() {
      popover.hide();
    });
    heatgrid.mouseenter(function() {
      popover.show();
    });


    var total = 0, count = 0;
    for (var y = 0; y < grid.data.length; y++) {
      for (var x = 0; x < grid.data[y].length; x++) {
        if (grid.types[x] != 'number') continue;
        var cell = parseFloat(grid.data[y][x]);
        if (!isNaN(cell)) {
          total += cell;
          count++;
        }
      }
    }
    var avg = total / count;

    var tdiff = 0;
    for (var y = 0; y < grid.data.length; y++) {
      for (var x = 0; x < grid.data[y].length; x++) {
        if (grid.types[x] != 'number') continue;
        var cell = parseFloat(grid.data[y][x]);
        if (!isNaN(cell)) {
          tdiff += (cell - avg) * (cell - avg);
        }
      }
    }
    var stddev = Math.sqrt(tdiff / count);

    var img = ctx.createImageData(xsize, ysize);
    for (var y = 0; y < grid.data.length; y++) {
      for (var x = 0; x < grid.data[y].length; x++) {
        if (grid.types[x] != 'number') continue;
        var cell = parseFloat(grid.data[y][x]);
        if (isNaN(cell)) continue;
        var color = gradient(//[255,0,0], [192,192,192], [0,0,255],
                             [192,192,192], [192,192,255], [0,0,255],
                             (cell - avg) / stddev);
        var pix = (y * xsize + x*xmult) * 4;
        for (var i = 0; i < xmult; i++) {
          img.data[pix + 0] = color[0];
          img.data[pix + 1] = color[1];
          img.data[pix + 2] = color[2];
          img.data[pix + 3] = 255;
          pix += 4;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
};
