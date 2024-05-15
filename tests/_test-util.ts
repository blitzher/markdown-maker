import fs from "fs";
import assert from "assert/strict";
import Parser from "../src/parser";
import path from "path";
import html from "node-html-parser";

beforeEach(() => {
	return new Promise((res, rej) => {
		fs.mkdir(path.join("tests", "test-files"), res);
	});
});
afterEach(() => {
	return new Promise((res, rej) => {
		fs.rm(path.join("tests", "test-files"), { recursive: true }, res);
	});
});

function put(text: string | NodeJS.ArrayBufferView, file: string) {
	fs.writeFileSync(path.join("tests", "test-files", file), text);
}
function putDir(name: string) {
	fs.mkdirSync(path.join("tests", "test-files", name));
}

const TargetType = {
	HTML: 0,
	MARKDOWN: 1,
};

beforeEach(() => {
	return new Promise((res, rej) => {
		fs.mkdir("tests/test-files", res);
	});
});

afterEach(() => {
	return new Promise((res, rej) => {
		fs.rmdir("tests/test-files", { recursive: true }, res);
	});
});

export default {
	assert,
	fs,
	html,
	path,
	Parser,
	put,
	putDir,
	TargetType,
};
