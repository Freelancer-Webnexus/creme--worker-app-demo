import {
	resolveFocusedIndex,
	resolveTabItems,
	type TabRoute,
} from '@/uikit/navigation/tab-bar-model';

const routes: TabRoute[] = [
	{ key: 'home-1', label: 'Home' },
	{ accessibilityLabel: 'App settings', key: 'settings-1', label: 'Settings' },
];

describe('tab bar model', () => {
	it('marks the focused route and leaves the others alone', () => {
		const items = resolveTabItems({
			focusedKey: 'home-1',
			routes,
			visualKey: 'home-1',
		});
		expect(items.map((item) => item.isFocused)).toEqual([true, false]);
	});

	it('falls back to the visible label for screen readers', () => {
		const items = resolveTabItems({
			focusedKey: 'home-1',
			routes,
			visualKey: 'home-1',
		});
		expect(items[0]?.accessibilityLabel).toBe('Home');
		expect(items[1]?.accessibilityLabel).toBe('App settings');
	});

	it('lets the pill lead the navigator while a press settles', () => {
		const items = resolveTabItems({
			focusedKey: 'home-1',
			routes,
			visualKey: 'settings-1',
		});
		expect(items[1]?.isFocused).toBe(false);
		expect(items[1]?.isVisuallyFocused).toBe(true);
	});

	it('reports a missing focused route instead of snapping to the first tab', () => {
		expect(resolveFocusedIndex(routes, 'gone')).toBe(-1);
		expect(resolveFocusedIndex(routes, 'settings-1')).toBe(1);
	});

	it('returns no items for an empty navigator', () => {
		expect(
			resolveTabItems({ focusedKey: '', routes: [], visualKey: '' }),
		).toEqual([]);
	});
});
