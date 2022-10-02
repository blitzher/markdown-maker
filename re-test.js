const s = "hello1, hello2, hello3";

const re = /hello(?<digit>\d)/g;

let m = s.replace(re, (match, ...args) => {
	console.log(args);
	return "world";
});

console.log({ s, m });
