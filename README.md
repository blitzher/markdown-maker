# markdown-maker

[![Mocha](https://github.com/blitzher/markdown-maker/actions/workflows/node.js.yml/badge.svg)](https://github.com/blitzher/markdown-maker/actions/workflows/node.js.yml)

A node parser for markdown variables and including of files.
It is intended as a simplistic replacement for TeX documents, primarily for writing stories, D&D campaigns or other similar text based works.

## Features


Currently supports the following features
* Defining variables with `#mddef<name=value>` and retrieving of values with `#mdvar<name>`, or simply `<name>`
* Including and parsing other files, preserving all defined variables, with `mdinclude<filename.md>`
* Automatic Table of Contents generation with `#mdmaketoc`
* HTML emitting with custom styling
* Easy extention of custom commands, see `src/commands.js` for implementations
* Usage of templates with the `#mdtemplate<...>` command.

## Usage
Download the [latest release](https://github.com/blitzher/markdown-maker/releases), and write your document.


When you want to compile your document, use `mdparse <file>` or `mdparse <dir>` to produce `dist/bundle.md`.
See below for options when compiling.

## Command Line Arguments

**--use-underscore (-uu)**:

Change the id referencing in the Table of Contents to use "\_" instead of "-".
Depending on your Markdown renderer of choice, this may fix ToC linking.

**--verbose (-v) / --debug (-db)**:

Enable verbose output, which prints much more information about which tokens are found.
Debug mode also logs even more information, mostly useful for debugging the parser itself.


**--watch (-w)**:

Watch the target file or directory for changes, and recompile whenever changed.

**--html**:

Emit the compiled HTML to `dist/bundle.html`

To style the document, it is recommended to put `#mdinclude<style.html>` in the head of your `main.md`, and in `style.html`, put
```html
<!-- style.html -->

<style>
    /**
     * your styles here 
     */
</style>
```

**--allow-undef (-au)**:

Allow undefined variables. Instead of throwing an undefined variable error, put `<VarName>`.
Useful for allowing infile CSS, HTML, code snippets or other situations, where the `<` and `>` symbols are used.
However, this means that the variable with the same name *must* be undefined, so use only when needed.

---
See `mdparse --help` for all arguments and their usage.


# Development

Run `npm test` to execute tests in `test/` directory.

To build binary files for different systems, install required packages with `npm install`,
change `pkg/targets` in `package.json`, and run `npm run build`.
