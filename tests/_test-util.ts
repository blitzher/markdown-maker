import fs from "fs";
import Parser from "../src/parser";
import path from "path";
import { expect, jest, test } from "@jest/globals";
import { TargetType } from "../src/types";

beforeAll(() => {
	return new Promise((res, rej) => {
		fs.mkdir(path.join("tests", "test-files"), res);
	});
});
// afterAll(() => {
// 	return new Promise((res, rej) => {
// 		fs.rm(path.join("tests", "test-files"), { recursive: true }, res);
// 	});
// });

function put(text: string | NodeJS.ArrayBufferView, file: string) {
	fs.writeFileSync(path.join("tests", "test-files", file), text);
}
function putDir(name: string) {
	fs.mkdirSync(path.join("tests", "test-files", name));
}

beforeEach(() => {
	return new Promise((res, rej) => {
		fs.mkdir("tests/test-files", res);
	});
});

afterEach(() => {
	return new Promise((res, rej) => {
		fs.rm("tests/test-files", { recursive: true }, res);
	});
});

export default {
	expect,
	path,
	Parser,
	put,
	putDir,
	TargetType,
};
