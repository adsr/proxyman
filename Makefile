proxyman_files:=$(shell ls -1 | grep -Fv -e proxyman.zip -e Makefile -e README -e screenshot)

all: proxyman.zip

proxyman.zip: $(proxyman_files)
	zip $@ $^

clean:
	rm -f proxyman.zip

.PHONY: all clean
