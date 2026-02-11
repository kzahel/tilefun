/** Load an image from the given URL. */
export function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
		img.src = url;
	});
}

/** Load and parse JSON from the given URL. */
export function loadJSON<T>(url: string): Promise<T> {
	return fetch(url).then((res) => {
		if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
		return res.json() as Promise<T>;
	});
}
