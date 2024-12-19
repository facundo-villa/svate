import { getContext } from "svelte";

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

const stable_key_from_object = (object: any): string => {
	return Object.entries(object).map(([key, value]) => {
		if (Array.isArray(value)) {
			return `${key}:${stable_key_from_array(value)}`;
		} else if (typeof value === "object") {
			return `${key}:${stable_key_from_object(value)}`;
		} else {
			return `${key}:${value}`;
		}
	}).join(",");
};

const stable_key_from_array = (array: any[]): string => {
	return array.map((value) => {
		if (Array.isArray(value)) {
			return stable_key_from_array(value);
		} else if (typeof value === "object") {
			return stable_key_from_object(value);
		} else {
			return value;
		}
	}).join(",");
};

class Query<T, S> {
	private _value: any = null;
	private _promise: Promise<T> = $state(new Promise(() => {}));
	private _hasValue: boolean = false;
	private _loading: boolean = $state(false);
	private _isDirty: boolean = true;
	depends: any[][] = [];
	update: "eager" | "lazy" = "lazy";
	resolver: () => Promise<QueryReturn<T, S>>;
	cache: Map<string, StoredQuery<any, S>[]>;

	constructor(cache: Map<string, StoredQuery<any, S>[]>, resolver: () => Promise<QueryReturn<T, S>>, update: "eager" | "lazy") {
		this.cache = cache;
		this.update = update;
		this.resolver = resolver;

		if (this.update == "eager") {
			this.set(); // Fire and forget
		}
	}

	set(): Promise<T> {
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
			this._value = value;
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
		return this.set();
	}

	get loading() {
		return this._loading;
	}

	flag() {
		this._isDirty = true;
	}

	private subscribe<R>(sq: StoredQuery<R, S>) {
		for (const queryKey of this.depends || []) {
			const stableKey = stable_key_from_array(queryKey);

			let slot = this.cache.get(stableKey);

			if (!slot) {
				slot = [];
				this.cache.set(stableKey, slot);
			}

			if (!slot.find(e => e.resolver == sq.resolver)) {
				slot.push(sq);
			}
		}
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
			this.config.defaults.update,
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
		const update = async (e: StoredQuery<any, S>) => {
			e.query.flag();

			await e.query.set();
		}

		if (key !== undefined) {
			const cacheEntry = this.cache.get(stable_key_from_array(key));
			await Promise.all(cacheEntry?.map(update) || []);
		} else {
			await Promise.all(this.cache.values().map(a => a.map(update)).reduce((a, b) => a.concat(b), []));
		}
	}
}

export const getSvate = (): Svate => {
	return getContext("svate");
}