default: all

all: help.html

%.html: %.md
	markdown $< >$@.new
	mv $@.new $@
