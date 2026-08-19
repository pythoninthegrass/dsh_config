import { test } from "node:test";
import assert from "node:assert/strict";
import * as acp from "@agentclientprotocol/sdk";
import { buildInitializeResponse } from "./initialize.js";

test("advertises the protocol version the SDK was built against", () => {
	assert.equal(buildInitializeResponse().protocolVersion, acp.PROTOCOL_VERSION);
});

test("declares loadSession supported", () => {
	assert.equal(buildInitializeResponse().agentCapabilities.loadSession, true);
});

test("declares session/list supported", () => {
	assert.deepEqual(buildInitializeResponse().agentCapabilities.sessionCapabilities.list, {});
});
