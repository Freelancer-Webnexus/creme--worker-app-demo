import { fireEvent, render } from '@testing-library/react-native';
import WorkerPickerView from '@/features/session/screens/worker-picker-view';
import { translate } from '@/services/i18n/translate';

const workers = [
	{ id: 'w-bruno', name: 'Bruno Díaz' },
	{ id: 'w-carla', name: 'Carla Díaz' },
];

describe('WorkerPickerView', () => {
	it.each(['es', 'en'] as const)(
		'shows a big button per person in %s and reports the choice',
		async (language) => {
			const onChoose = jest.fn();
			const view = await render(
				<WorkerPickerView
					onChoose={onChoose}
					subtitle={translate(language, 'picker.subtitle')}
					title={translate(language, 'picker.title')}
					workers={workers}
				/>,
			);

			expect(view.getByText(translate(language, 'picker.title'))).toBeTruthy();
			expect(
				view.getByText(translate(language, 'picker.subtitle')),
			).toBeTruthy();
			expect(view.getAllByRole('button')).toHaveLength(2);

			await fireEvent.press(view.getByText('Carla Díaz'));

			expect(onChoose).toHaveBeenCalledWith('w-carla');
		},
	);
});
