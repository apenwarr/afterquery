default: all

all: help.html v8shell

v8shell: v8shell.cc
	g++ -o $@ $< -lv8

runtests: $(patsubst %.js,%.js.run,$(wildcard t/t*.js))

%.html: %.md
	markdown $< >$@.new
	mv $@.new $@

%.js.run: %.js
	./v8shell wvtest.js $*.js

test: v8shell
	./wvtestrun $(MAKE) runtests

clean:
	rm -f *~ .*~ */*~ */.*~ v8shell
	find -name '*~' -exec rm -f {} \;
