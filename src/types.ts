import { HTMLElement } from "node-html-parser";
import { Command } from "./commands";

export type CommandGroupType = {
	preparse: Command[];
	parse: Command[];
	postparse: Command[];
};

type TaggedElementArguments = {
	repeat?: number;
};

export type TaggedElement = {
	"html-tag": string;
	"var-tag": string;
	_raw: string;
	args: TaggedElementArguments;
	node: HTMLElement;
};

export enum CommandType {
	PREPARSE,
	PARSE,
	POSTPARSE,
}

export enum TargetType {
	HTML,
	MARKDOWN,
}

export type Checksum = string;
