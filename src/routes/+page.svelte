<script lang="ts">
    import { getSvate } from "$lib/index.svelte.ts";

	const svate = getSvate();

	const fruits = svate.query(async () => {
		const value = ["🍉", "🍊", "🍋", "🍌", "🕶️"][Number(Math.random() * 5) | 0];

		await new Promise((resolve) => setTimeout(resolve, 1000));

		if (value === "🕶️") {
			throw new Error("🕶️ is not a fruit");
		}

		return {
			value,
			state: {
				headers: {
					"User": "Jason",
				},
			},
			depends: [
				["fruit"],
			],
		};
	});

	const objects = svate.query(async () => {
		const value = { a: Math.random() };

		await new Promise((resolve) => setTimeout(resolve, 250));

		return {
			value,
			state: {
				headers: {
					"User": "Jason",
				}
			},
			depends: [
				["object"],
			],
		};
	});

	const combo = svate.query(async () => {
		const fruit = ["🍉", "🍊", "🍋", "🍌", "🍍"][Number(Math.random() * 5) | 0];
		const object = { a: Math.random() };

		return {
			value: `${fruit} ${object}`,
			state: {
				headers: {
					"User": "Jason",
				},
			},
			depends: [
				["fruit"],
				["object"],
			],
		};
	})

	const change_fuits = svate.mutation(() => {
		return {
			invalidate: ["fruit"],
		};
	});

	const change_objects = svate.mutation(() => {
		return {
			invalidate: ["object"],
		};
	});
</script>

{fruits.loading}

{#await fruits.value}
	<p>Loading...</p>
{:then data}
	<p>{data}</p>
{:catch error}
	<p>{error.message}</p>
{/await}

{objects.loading}

{#await objects.value}
	<p>Loading...</p>
{:then data}
	<p>{JSON.stringify(data)}</p>
{:catch error}
	<p>{error.message}</p>
{/await}

{combo.loading}

{#await combo.value}
	<p>Loading...</p>
{:then data}
	<p>{data}</p>
{:catch error}
	<p>{error.message}</p>
{/await}

<button onclick={change_fuits}>
	Change fruits
</button>

<button onclick={change_objects}>
	Change objects
</button>

<button onclick={() => svate.invalidate()}>
	Invalidate all
</button>