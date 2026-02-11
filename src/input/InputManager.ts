const SQRT2_INV = 1 / Math.sqrt(2);

export interface Movement {
	dx: number;
	dy: number;
}

export class InputManager {
	private readonly keysDown = new Set<string>();

	attach(): void {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("blur", this.onBlur);
	}

	detach(): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("blur", this.onBlur);
	}

	/** Poll current movement direction. Returns normalized vector. */
	getMovement(): Movement {
		let dx = 0;
		let dy = 0;

		if (this.keysDown.has("ArrowLeft") || this.keysDown.has("a")) dx -= 1;
		if (this.keysDown.has("ArrowRight") || this.keysDown.has("d")) dx += 1;
		if (this.keysDown.has("ArrowUp") || this.keysDown.has("w")) dy -= 1;
		if (this.keysDown.has("ArrowDown") || this.keysDown.has("s")) dy += 1;

		// Normalize diagonal movement
		if (dx !== 0 && dy !== 0) {
			dx *= SQRT2_INV;
			dy *= SQRT2_INV;
		}

		return { dx, dy };
	}

	/** Simulate a key press (for testing). */
	pressKey(key: string): void {
		this.keysDown.add(key);
	}

	/** Simulate a key release (for testing). */
	releaseKey(key: string): void {
		this.keysDown.delete(key);
	}

	private onKeyDown = (e: KeyboardEvent): void => {
		this.keysDown.add(e.key);
	};

	private onKeyUp = (e: KeyboardEvent): void => {
		this.keysDown.delete(e.key);
	};

	private onBlur = (): void => {
		this.keysDown.clear();
	};
}
