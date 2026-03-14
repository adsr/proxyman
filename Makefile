proxyman_files:=$(shell find . -maxdepth 1 -type f | sort -V | grep -Fv -e proxyman.zip -e Makefile -e README -e screenshot -e gitignore)

all: proxyman.zip

proxyman.zip: $(proxyman_files)
	zip $@ $^

clean:
	rm -f proxyman.zip

.PHONY: all clean
