import { presentHomeBody } from '@/features/home/home-body-copy';
import type { HomeBody } from '@/features/home/home-model';
import { type Language, translate } from '@/services/i18n/translate';

const ready: HomeBody = {
	kind: 'ready',
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	terms: { role: 'pending_sync', textKey: 'home.terms_pending_sync' },
	timeline: [
		{ id: 'terms_confirmed', status: 'done' },
		{ id: 'documents_submitted', status: 'saved_on_phone' },
		{ id: 'documents_approved', status: 'not_done' },
	],
};

const present = (body: HomeBody, language: Language) =>
	presentHomeBody(body, language, (key, params) =>
		translate(language, key, params),
	);

describe('presentHomeBody', () => {
	it('writes the order card in Spanish with dates for that language', () => {
		const content = present(ready, 'es');

		expect(content.kind).toBe('ready');
		if (content.kind !== 'ready') {
			return;
		}
		expect(content.orderRows.map((row) => row.label)).toEqual([
			'Empleador',
			'Lugar de trabajo',
			'Temporada',
		]);
		expect(content.orderRows[2]?.value).toContain('marzo');
		expect(content.orderRows[2]?.value).toContain('julio');
		expect(content.termsText).toBe(
			'Confirmados en este teléfono, falta enviarlos',
		);
	});

	it('writes the order card in English', () => {
		const content = present(ready, 'en');

		if (content.kind !== 'ready') {
			throw new Error('expected a ready body');
		}
		expect(content.orderRows[2]?.value).toBe(
			'From March 1, 2026 to July 31, 2026',
		);
		expect(content.termsText).toBe('Confirmed on this phone, not sent yet');
	});

	it('labels each timeline step with a word, not only a colour', () => {
		const content = present(ready, 'es');

		if (content.kind !== 'ready') {
			throw new Error('expected a ready body');
		}
		expect(
			content.timelineSteps.map((step) => [step.label, step.status, step.role]),
		).toEqual([
			['Términos confirmados', 'Hecho', 'approved'],
			[
				'Documentos enviados',
				'Guardado en este teléfono, falta enviar',
				'pending_sync',
			],
			['Documentos aprobados', 'Falta', 'neutral'],
		]);
		expect(content.timelineSteps[0]?.accessibilityLabel).toBe(
			'Términos confirmados: Hecho',
		);
	});

	it('says in English that a step is saved on the phone, not sent', () => {
		const content = present(ready, 'en');

		if (content.kind !== 'ready') {
			throw new Error('expected a ready body');
		}
		expect(content.timelineSteps[1]?.status).toBe(
			'Saved on this phone, not sent yet',
		);
	});

	it('explains that the first load needs a connection', () => {
		expect(present({ kind: 'needs_connection' }, 'es')).toEqual({
			body: 'La primera vez necesitas internet para cargar tu información. Conéctate e inténtalo otra vez.',
			kind: 'empty',
			retryTitle: 'Reintentar',
			title: 'Todavía no hay datos en este teléfono',
		});
		expect(present({ kind: 'needs_connection' }, 'en').kind).toBe('empty');
	});

	it('says the server is not answering instead of asking for internet', () => {
		expect(present({ kind: 'server_unavailable' }, 'es')).toEqual({
			body: translate('es', 'state.server_body'),
			kind: 'empty',
			retryTitle: 'Reintentar',
			title: 'El servidor no responde',
		});
		expect(present({ kind: 'server_unavailable' }, 'en').kind).toBe('empty');
	});

	it('has a quiet loading line', () => {
		expect(present({ kind: 'loading' }, 'es')).toEqual({
			kind: 'loading',
			text: 'Cargando tu información…',
		});
	});
});
