<script lang="ts" generics="S">
    import type { Svate } from "./index.svelte.ts";
	import { setContext, type Snippet } from "svelte";

	let { svate = $bindable(), children }: { svate: Svate<S>, children: Snippet } = $props();

	setContext("svate", svate);
</script>

{@render children()}