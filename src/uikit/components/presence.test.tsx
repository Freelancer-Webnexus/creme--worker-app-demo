import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import Presence from '@/uikit/components/presence';

describe('Presence', () => {
	it('renders the child with the narrowed value', async () => {
		await render(
			<Presence when="hello">
				{(text) => <Text testID="child">{text}</Text>}
			</Presence>,
		);

		expect(screen.getByTestId('child')).toHaveTextContent('hello');
	});

	it.each([null, undefined, false] as const)(
		'renders nothing when the value is %s',
		async (value) => {
			await render(
				<Presence when={value}>
					{() => <Text testID="child">hello</Text>}
				</Presence>,
			);

			expect(screen.queryByTestId('child')).toBeNull();
		},
	);

	it('keeps an empty string visible', async () => {
		await render(
			<Presence when="">{() => <Text testID="child">empty</Text>}</Presence>,
		);

		expect(screen.getByTestId('child')).toBeTruthy();
	});

	it('keeps the child findable across a toggle', async () => {
		const { rerender } = await render(
			<Presence when={null as string | null}>
				{(text) => <Text testID="child">{text}</Text>}
			</Presence>,
		);
		await rerender(
			<Presence when={'shown'}>
				{(text) => <Text testID="child">{text}</Text>}
			</Presence>,
		);

		expect(screen.getByTestId('child')).toHaveTextContent('shown');
	});
});
