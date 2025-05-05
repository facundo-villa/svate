export const stable_key_from_object = (object: any): string => {
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

export const stable_key_from_array = (array: any[]): string => {
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