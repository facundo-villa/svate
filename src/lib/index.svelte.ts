import { getContext } from "svelte";
import { stable_key_from_array } from "./hash";

type StoredQuery<T, S> = {
	resolver: () => Promise<QueryReturn<T, S>>,
	query: Query<T, S>,
};

type MutationReturn = {
	invalidate?: any[],
};

type QueryReturn<T, S> = {
	depends?: any[][],
	value: T,
	state?: S,
};

class Query<T, S> {
	private _promise: Promise<T> = $state(new Promise(() => {}));
	private _hasValue: boolean = false;
	private _loading: boolean = $state(false);
	private _isDirty: boolean = true;
	depends: any[][] = [];
	resolver: () => Promise<QueryReturn<T, S>>;
	cache: Map<string, StoredQuery<any, S>[]>;

	constructor(cache: Map<string, StoredQuery<any, S>[]>, resolver: () => Promise<QueryReturn<T, S>>) {
		this.cache = cache;
		this.resolver = resolver;

		this.set(); // Fire and forget
	}

	set() {
		if (this._hasValue && !this._isDirty) {
			return this._promise;
		}

		if (!this._isDirty || this._loading) { return this._promise; }

		this._loading = true;
		const old_keys = (this.depends || []).map(stable_key_from_array);

		const r = this.resolver().then(r => {
			const new_keys = (r.depends || []).map(stable_key_from_array);
			this.depends = r.depends || [];
			const invalidated_keys = old_keys.filter(k => !new_keys.includes(k));
			const value = r.value;
			this._loading = false;
			this._isDirty = false;
			this._hasValue = true;

			// Remove previous dependencies
			for (const stableKey of invalidated_keys) {
				let cacheEntry = this.cache.get(stableKey);
				if (!cacheEntry) { continue; }
				this.cache.set(stableKey, cacheEntry.filter(e => e.resolver != this.resolver));
			}

			this.subscribe({
				resolver: this.resolver,
				query: this,
			});

			return value;
		}).catch(e => {
			this._loading = false;
			this._isDirty = false;
			return e;
		});

		this._promise = r;

		return this._promise;
	}

	get value(): Promise<T> {
		return this._promise;
	}

	get loading() {
		return this._loading;
	}

	flag() {
		this._isDirty = true;
	}

	private subscribe<R>(sq: StoredQuery<R, S>) {
		const subscribe_key = (key: string) => {
			let slot = this.cache.get(key);

			if (!slot) {
				slot = [];
				this.cache.set(key, slot);
			}

			if (!slot.find(e => e.resolver == sq.resolver)) {
				slot.push(sq);
			}
		};

		for (const queryKey of this.depends || []) {
			const stableKey = stable_key_from_array(queryKey);

			subscribe_key(stableKey);
		}

		subscribe_key("");
	}
}

export class Svate<S = undefined> {
	// Maps from query keys to stored queries
	// This map is used to invalidate queries
	private cache: Map<string, StoredQuery<any, S>[]> = new Map();
	private mutations: Map<() => (MutationReturn | void), {}> = new Map();

	private config: {
		decorator?: (qr: QueryReturn<any, S>) => Promise<void>,
		defaults: {
			update: "eager" | "lazy",
		};
	};

	constructor(config?: { state?: S, decorator?: (qr: QueryReturn<any, S>) => Promise<void>, defaults?: { update?: "eager" | "lazy" } },) {
		this.config = {
			decorator: config?.decorator,
			defaults: {
				update: config?.defaults?.update || "lazy",
			},
		};
	}

	query<R>(resolver: () => Promise<QueryReturn<R, S>>): Query<R, S> {
		const decorator = this.config.decorator;

		const query = new Query<R, S>(this.cache,
			decorator ? async () => {
				const qr = await resolver();
				await decorator(qr);
				return qr;
			} : resolver,
		);

		return query;
	}

	mutation(mutation: () => (MutationReturn | void)): () => Promise<void> {
		this.mutations.set(mutation, {});

		return async () => {
			const mutationReturn = mutation();

			if (mutationReturn && mutationReturn.invalidate) {
				await this.invalidate(mutationReturn.invalidate);
			}
		};
	}

	/*
	* Invalidate a query or all queries
	* @param key - The key of the query to invalidate. If not provided, all queries will be invalidated
	*/
	async invalidate(key?: any[]) {
		const update = (e: StoredQuery<any, S>) => {
			e.query.flag();

			return e.query.set();
		}

		if (key !== undefined) {
			const cacheEntry = this.cache.get(stable_key_from_array(key));
			await Promise.all(cacheEntry?.map(update) || []);
		} else {
			const cacheEntries = this.cache.values().reduce((a, b) => a.concat(b), []);
			await Promise.all(cacheEntries.map(update));
		}
	}
}

export const getSvate = (): Svate => {
	return getContext("svate");
}