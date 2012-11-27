#!/usr/bin/python
import csv
import json
import sys

c = csv.reader(sys.stdin)
rows = list([[col.decode('latin1') for col in r] for r in c])
print 'jsonp('
json.dump(rows, sys.stdout, indent=2)
print ');'
