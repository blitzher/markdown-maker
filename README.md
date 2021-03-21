# markdown-maker

[![Mocha](https://github.com/blitzher/markdown-maker/actions/workflows/node.js.yml/badge.svg)](https://github.com/blitzher/markdown-maker/actions/workflows/node.js.yml)

## Features

A node parser for markdown variables and including of files.
It is intended as a simplistic replacement for TeX documents, primarily for writing stories, D&D campaigns or other similar text based works.

Currently supports the following features
* Defining variables with `#mddef<name=value>` and retrieving of values with `#mdvar<name>`, or simply `<name>`
* Including and parsing other files, preserving all defined variables, with `mdinclude<filename.md>`
* Automatic Table of Contents generation
* Easy extention of custom commands

## Usage
Download the [latest release](https://github.com/blitzher/markdown-maker/releases), and write your document.

When you want to compile your document, use `mdparse <file>` or `mdparse <dir>` to produce `dist/bundle.md`.
See below for options when compiling.

## Arguments

**--use-underscore (-uu)**: 
Change the id referencing in the Table of Contents to use "\_" instead of "-".
Depending on your Markdown renderer of choice, this may fix ToC linking.

**--verbose (-v)**:
Enable verbose output

**--watch (-w)**:
Watch the target file or directory for changes, and recompile whenever changed.

See `mdparse --help` for all arguments and their usage.


# Development

Run `npm test` to execute tests in `test/` directory.

To build binary files for different systems, install required packages with `npm install`,
change `pkg/targets` in `package.json`, and run `npm run build`.
