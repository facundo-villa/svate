import { describe, test, expect } from "vitest";
import { stable_key_from_array, stable_key_from_object } from "./hash";

test("Hash empty object", () => {
	const hash = stable_key_from_object({});
	expect(hash).toBe("");
});

test("Hash empty array", () => {
	const hash = stable_key_from_array([]);
	expect(hash).toBe("");
});

test("Hash array with one element", () => {
	const hash = stable_key_from_array([1]);
	expect(hash).toBe("1");
});