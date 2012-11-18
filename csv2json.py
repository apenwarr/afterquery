#!/usr/bin/python
import csv
import json
import sys

c = csv.reader(sys.stdin)
rows = list(c)
print 'jsonp('
json.dump(rows, sys.stdout, indent=2)
print ');'
