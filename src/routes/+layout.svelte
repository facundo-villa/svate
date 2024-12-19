<script lang="ts">
	import { Svate } from "$lib/index.svelte.ts";

	import SvateContextProvider from "$lib/SvateContextProvider.svelte";

	const svate = new Svate({
		state: {
			headers: {
				"User": "Jason",
			},
		},
		// decorator: async (q) => {
		// 	q.depends?.forEach((key) => {
		// 		key.push(q.state.headers);
		// 	});
		// },
		defaults: {
			update: "lazy",
		}
	});

	let { children } = $props();
</script>

<SvateContextProvider {svate}>
	{@render children()}
</SvateContextProvider>