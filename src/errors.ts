export class MDMNonParserError extends Error {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, MDMNonParserError.prototype);
	}
}

export class MDMError extends Error {
	match: RegExpMatchArray;
	constructor(message: string, match: RegExpMatchArray) {
		super(message);
		Object.setPrototypeOf(this, MDMError.prototype);

		this.match = match;
	}
}

export class MDMWarning extends Error {
	match?: RegExpMatchArray;
	constructor(message: string, match?: RegExpMatchArray) {
		super(message);
		Object.setPrototypeOf(this, MDMWarning.prototype);

		this.match = match;
	}
}
