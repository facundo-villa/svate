import { describe, test, expect } from "vitest";
import { Svate } from "./index.svelte.ts";

test("Svate", () => {
	const svate = new Svate();
});

test("Create query", async () => {
	const svate = new Svate();

	const query = svate.query(async () => {
		return {
			value: 42,
		};
	});

	await expect(query.value).resolves.toBe(42);
});

test("Create mutation", async () => {
	const svate = new Svate();

	let state = 0;

	const mutation = svate.mutation(() => {
		state += 1;
	});

	expect(state).toBe(0);

	await mutation();

	expect(state).toBe(1);
});

test("Caching", async () => {
	const svate = new Svate();

	let state = 0;
	let queries = 0;

	const query = svate.query(async () => {
		queries += 1;

		return {
			value: state,
			depends: [["root"]],
		};
	});

	await expect(query.value).resolves.toBe(0);
	expect(state).toBe(0);
	expect(queries).toBe(1);

	const mutation = svate.mutation(() => {
		state += 1;
	});

	await expect(query.value).resolves.toBe(0);
	expect(state).toBe(0);
	expect(queries).toBe(1);

	await mutation();

	await expect(query.value).resolves.toBe(0);
	expect(state).toBe(1);
	expect(queries).toBe(1);
});

test("Multiple queries", async () => {
	const svate = new Svate();

	const queryA = svate.query(async () => {
		return {
			value: "a",
			depends: [["root"]],
		};
	});

	const queryB = svate.query(async () => {
		return {
			value: "b",
			depends: [["root"]],
		};
	});

	await expect(queryA.value).resolves.toBe("a");
	await expect(queryB.value).resolves.toBe("b");
});

test("Update dependencies", async () => {
	const svate = new Svate();

	let queries = 0;
	let depends = [["a"]];

	const query = svate.query(async () => {
		const val = queries;
		queries += 1;

		return {
			value: val,
			depends,
		};
	});

	expect(queries).toBe(0);

	await expect(query.value).resolves.toBe(0);
	expect(queries).toBe(1);

	await svate.invalidate(["a"]);

	await expect(query.value).resolves.toBe(1);
	expect(queries).toBe(2);

	depends = [["b"]];
	await svate.invalidate(["a"]);

	await expect(query.value).resolves.toBe(2);
	expect(queries).toBe(3);

	await svate.invalidate(["a"]);

	await expect(query.value).resolves.toBe(2);
	expect(queries).toBe(3);

	await svate.invalidate(["b"]);

	await expect(query.value).resolves.toBe(3);
	expect(queries).toBe(4);
});

describe("Invalidate", () => {
	test("by mutation", async () => {
		const svate = new Svate();

		let state = 0;
		let queries = 0;

		const query = svate.query(async () => {
			queries += 1;

			return {
				value: state,
				depends: [["root"]],
			};
		});

		expect(queries).toBe(0);

		const mutation = svate.mutation(() => {
			state += 1;

			return {
				invalidate: ["root"],
			};
		});

		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(1);

		await mutation();

		expect(queries).toBe(2);
		await expect(query.value).resolves.toBe(1);
		expect(state).toBe(1);
		expect(queries).toBe(2);
	});

	test("some by mutation", async () => {
		const svate = new Svate();

		let queriesA = 0;
		let queriesB = 0;

		const queryA = svate.query(async () => {
			const state = queriesA;
			queriesA += 1;

			return {
				value: state,
				depends: [["a"]],
			};
		});

		const queryB = svate.query(async () => {
			const state = queriesB;
			queriesB += 1;

			return {
				value: state,
				depends: [["b"]],
			};
		});

		const mutationA = svate.mutation(() => {
			return {
				invalidate: ["a"],
			};
		});

		const mutationB = svate.mutation(() => {
			return {
				invalidate: ["b"],
			};
		});

		expect(queriesA).toBe(0);
		expect(queriesB).toBe(0);

		await expect(queryA.value).resolves.toBe(0);
		await expect(queryB.value).resolves.toBe(0);
		expect(queriesA).toBe(1);
		expect(queriesB).toBe(1);

		await mutationA();

		expect(queriesA).toBe(2);
		expect(queriesB).toBe(1);
		await expect(queryA.value).resolves.toBe(1);
		await expect(queryB.value).resolves.toBe(0);
		expect(queriesA).toBe(2);
		expect(queriesB).toBe(1);

		await mutationB();

		expect(queriesA).toBe(2);
		expect(queriesB).toBe(2);
		await expect(queryA.value).resolves.toBe(1);
		await expect(queryB.value).resolves.toBe(1);
		expect(queriesA).toBe(2);
		expect(queriesB).toBe(2);
	});

	test("with multiple keys", async () => {
		const svate = new Svate();

		let state = 0;
		let queries = 0;

		const query = svate.query(async () => {
			queries += 1;

			return {
				value: state,
				depends: [
					["a"],
					["b"],
				],
			};
		});

		expect(queries).toBe(0);

		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(1);

		await svate.invalidate(["a"]);

		expect(queries).toBe(2);
		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(2);

		await svate.invalidate(["b"]);

		expect(queries).toBe(3);
		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(3);
	});

	test("eager query", async () => {
		const svate = new Svate({
			defaults: {
				update: "eager",
			}
		});

		let state = 0;
		let queries = 0;

		const query = svate.query(async () => {
			queries += 1;

			return {
				value: state,
				depends: [["root"]],
			};
		});

		expect(queries).toBe(1);

		const mutation = svate.mutation(() => {
			state += 1;

			return {
				invalidate: ["root"],
			};
		});

		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(1);

		await mutation();

		expect(queries).toBe(2); // Should have queried
		await expect(query.value).resolves.toBe(1);
		expect(state).toBe(1);
		expect(queries).toBe(2);
	});

	test("multiple queries", async () => {
		const svate = new Svate();

		let queriesA = 0;
		let queriesB = 0;

		const queryA = svate.query(async () => {
			queriesA += 1;
			return {
				value: "a",
				depends: [["root"]],
			};
		});

		const queryB = svate.query(async () => {
			queriesB += 1;
			return {
				value: "b",
				depends: [["root"]],
			};
		});

		await expect(queryA.value).resolves.toBe("a");
		expect(queriesA).toBe(1);
		await expect(queryB.value).resolves.toBe("b");
		expect(queriesB).toBe(1);

		await svate.invalidate(["root"]);

		await expect(queryA.value).resolves.toBe("a");
		expect(queriesA).toBe(2);
		await expect(queryB.value).resolves.toBe("b");
		expect(queriesB).toBe(2);
	});

	test("non existant query key", async () => {
		const svate = new Svate();

		let state = 0;
		let queries = 0;

		const query = svate.query(async () => {
			queries += 1;

			return {
				value: state,
				depends: [["root"]],
			};
		});

		expect(queries).toBe(0);

		await svate.invalidate(["other"]);

		expect(queries).toBe(0);
		await expect(query.value).resolves.toBe(0);
		expect(state).toBe(0);
		expect(queries).toBe(1);
	});

	test("some by hand", async () => {
		const svate = new Svate();

		let queriesA = 0;
		let queriesB = 0;

		const queryA = svate.query(async () => {
			const state = queriesA;
			queriesA += 1;

			return {
				value: state,
				depends: [["a"]],
			};
		});

		const queryB = svate.query(async () => {
			const state = queriesB;
			queriesB += 1;

			return {
				value: state,
				depends: [["b"]],
			};
		});

		expect(queriesA).toBe(0);
		expect(queriesB).toBe(0);

		await expect(queryA.value).resolves.toBe(0);
		await expect(queryB.value).resolves.toBe(0);
		expect(queriesA).toBe(1);
		expect(queriesB).toBe(1);

		await svate.invalidate(["a"]);

		expect(queriesA).toBe(2);
		expect(queriesB).toBe(1);
		await expect(queryA.value).resolves.toBe(1);
		await expect(queryB.value).resolves.toBe(0);
		expect(queriesA).toBe(2);
		expect(queriesB).toBe(1);
	});

	test("all by hand", async () => {
		const svate = new Svate();

		let state = 0;
		let queriesA = 0;
		let queriesB = 0;

		const queryA = svate.query(async () => {
			queriesA += 1;

			return {
				value: state,
				depends: [["a"]],
			};
		});

		const queryB = svate.query(async () => {
			queriesB += 1;

			return {
				value: state,
				depends: [["b"]],
			};
		});

		expect(queriesA).toBe(0);
		expect(queriesB).toBe(0);

		await svate.invalidate();

		expect(queriesA).toBe(0);
		expect(queriesB).toBe(0);

		await expect(queryA.value).resolves.toBe(0);
		await expect(queryB.value).resolves.toBe(0);

		expect(state).toBe(0);
		expect(queriesA).toBe(1);
		expect(queriesB).toBe(1);

		await svate.invalidate();

		expect(queriesA).toBe(2);
		expect(queriesB).toBe(2);

		await expect(queryA.value).resolves.toBe(0);
		await expect(queryB.value).resolves.toBe(0);

		expect(state).toBe(0);
		expect(queriesA).toBe(2);
		expect(queriesB).toBe(2);
	});
});
