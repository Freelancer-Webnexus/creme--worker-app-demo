import type {
	JobOrder,
	ServerDocument,
	TermsVersion,
} from '../src/services/api/api-types';

export const SEED_CODE = '123456';

export const SEED_ORDER: JobOrder = {
	id: 'JO-2026-0142',
	employer: 'Valle Verde Farms',
	worksite: 'Yuma, AZ',
	seasonStart: '2026-03-01',
	seasonEnd: '2026-07-31',
};

export const TERMS_V2: TermsVersion = {
	id: 'terms-v2',
	version: 2,
	publishedAt: '2026-02-10T09:00:00.000Z',
	summary: {
		es: [
			'Resumen de condiciones, versión 2.',
			'Salario: 16,50 USD por hora trabajada.',
			'Jornada: hasta 10 horas diarias, con un descanso de 30 minutos.',
			'Vivienda: el empleador la proporciona sin costo.',
			'Transporte: el empleador cubre el traslado al sitio de trabajo.',
		].join('\n'),
		en: [
			'Terms summary, version 2.',
			'Wage: 16.50 USD per hour worked.',
			'Shift: up to 10 hours a day, with a 30-minute break.',
			'Housing: the employer provides it at no cost.',
			'Transport: the employer covers travel to the worksite.',
		].join('\n'),
	},
};

export const TERMS_V3: TermsVersion = {
	id: 'terms-v3',
	version: 3,
	publishedAt: '2026-05-04T09:00:00.000Z',
	summary: {
		es: [
			'Resumen de condiciones, versión 3.',
			'Salario: 17,25 USD por hora trabajada.',
			'Jornada: hasta 9 horas diarias, con un descanso de 45 minutos.',
			'Vivienda: el empleador la proporciona sin costo.',
			'Transporte: el empleador cubre el traslado al sitio de trabajo.',
		].join('\n'),
		en: [
			'Terms summary, version 3.',
			'Wage: 17.25 USD per hour worked.',
			'Shift: up to 9 hours a day, with a 45-minute break.',
			'Housing: the employer provides it at no cost.',
			'Transport: the employer covers travel to the worksite.',
		].join('\n'),
	},
};

export const REQUIRED_DOCUMENTS: string[] = [
	'passport',
	'ds160_confirmation',
	'signed_contract',
];

export type SeedWorker = {
	id: string;
	name: string;
	phoneDigits: string;
	acceptedTermsVersionId: string | null;
	documents: ServerDocument[];
};

export const SEED_WORKERS: SeedWorker[] = [
	{
		id: 'worker-ana',
		name: 'Ana López',
		phoneDigits: '525510000001',
		acceptedTermsVersionId: null,
		documents: [],
	},
	{
		id: 'worker-bruno',
		name: 'Bruno Díaz',
		phoneDigits: '525510000002',
		acceptedTermsVersionId: TERMS_V2.id,
		documents: [{ documentType: 'passport', state: 'approved' }],
	},
	{
		id: 'worker-carla',
		name: 'Carla Díaz',
		phoneDigits: '525510000002',
		acceptedTermsVersionId: null,
		documents: [
			{
				documentType: 'passport',
				state: 'correction_requested',
				reason: 'Foto borrosa, vuelva a tomarla',
			},
		],
	},
];
