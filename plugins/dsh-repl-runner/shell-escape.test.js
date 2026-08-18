import { test } from "node:test";
import assert from "node:assert/strict";
import { isShellEscape, shellCommandBody } from "./shell-escape.js";

test("a line starting with ! is a shell escape", () => {
	assert.equal(isShellEscape("!ls -la"), true);
});

test("leading whitespace before ! still counts", () => {
	assert.equal(isShellEscape("   !ls"), true);
});

test("a plain chat line is not a shell escape", () => {
	assert.equal(isShellEscape("please ls the directory"), false);
});

test("shellCommandBody strips the leading ! and surrounding whitespace", () => {
	assert.equal(shellCommandBody("!ls -la"), "ls -la");
	assert.equal(shellCommandBody("   !  git status  "), "git status");
});

test("a bare ! has an empty command body", () => {
	assert.equal(isShellEscape("!"), true);
	assert.equal(shellCommandBody("!"), "");
});
