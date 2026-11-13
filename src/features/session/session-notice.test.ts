import { sessionNoticeFor } from '@/features/session/session-notice';
import { translate } from '@/services/i18n/translate';

const spanish = (key: Parameters<typeof translate>[1]) => translate('es', key);
const english = (key: Parameters<typeof translate>[1]) => translate('en', key);

describe('sessionNoticeFor', () => {
	it('says the saved actions are safe, in both languages', () => {
		expect(sessionNoticeFor('reauthenticate', spanish)?.body).toContain(
			'sigue guardado en este teléfono',
		);
		expect(sessionNoticeFor('reauthenticate', english)?.body).toContain(
			'still saved on this phone',
		);
	});

	it.each(['enter_phone', 'choose_worker', 'signed_in'] as const)(
		'shows nothing at %s',
		(step) => {
			expect(sessionNoticeFor(step, spanish)).toBeNull();
		},
	);
});
