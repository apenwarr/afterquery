default: all

all: help.html

MACOS_JS_PATH=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Resources/jsc
jsshell:
	rm -f $@
	[ -e "${MACOS_JS_PATH}" ] && \
	ln -s "${MACOS_JS_PATH}" jsshell || \
	g++ -o $@ v8shell.cc -lv8

runtests: $(patsubst %.js,%.js.run,$(wildcard t/t*.js))

%.html: %.md
	markdown $< >$@.new
	mv $@.new $@

%.js.run: %.js jsshell
	./jsshell wvtest.js $*.js

test: jsshell
	./wvtestrun $(MAKE) runtests

clean:
	rm -f *~ .*~ */*~ */.*~ help.html v8shell jsshell
	find . -name '*~' -exec rm -f {} \;
