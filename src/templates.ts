import { MDMError, MDMNonParserError } from "./errors";

const templates: { [key: string]: string } = {};

/**
 * Function to add a template to the templates object. Similar to definitions and variables, but reside as an extension.
 * @param name The name of the template
 * @param content The replacement string
 */
export function new_template(name: string, content: string) {
	if (name in templates)
		throw new MDMNonParserError(`Template "${name}" already exists`);
	templates[name] = content;
}

/* initialize default templates */
const presentation_template = require("../src/templates/presentation.js");
const mathjax_template = require("../src/templates/mathjax.js");
new_template("presentation", presentation_template);
new_template("mathjax", mathjax_template);

export default templates;
