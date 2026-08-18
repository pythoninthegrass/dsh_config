import { test } from "node:test";
import assert from "node:assert/strict";
import { needsContinuation } from "./continuation.js";

test("plain single-line input needs no continuation", () => {
	assert.equal(needsContinuation("hello there\n"), false);
});

test("a lone trailing backslash requests continuation", () => {
	assert.equal(needsContinuation("finish this thought\\\n"), true);
});

test("an escaped trailing backslash (double) does not", () => {
	assert.equal(needsContinuation("literal backslash\\\\\n"), false);
});

test("an unterminated fenced code block requests continuation", () => {
	assert.equal(needsContinuation("```js\nconst x = 1;\n"), true);
});

test("a terminated fenced code block does not", () => {
	assert.equal(needsContinuation("```js\nconst x = 1;\n```\n"), false);
});

test("two complete fences in one buffer do not", () => {
	assert.equal(needsContinuation("```\na\n```\n```\nb\n```\n"), false);
});

test("an odd number of fence markers requests continuation", () => {
	assert.equal(needsContinuation("```\na\n```\n```\nb\n"), true);
});

test("trailing newline is stripped before checking for a continuation backslash", () => {
	assert.equal(needsContinuation("no continuation here\n"), false);
});
