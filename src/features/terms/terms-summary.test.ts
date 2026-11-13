import { summaryLines } from '@/features/terms/terms-summary';

describe('summaryLines', () => {
	it('splits "Label: value" lines into a label and a value', () => {
		expect(
			summaryLines(
				'Resumen de condiciones, versión 2.\nSalario: 16,50 USD por hora trabajada.',
			),
		).toEqual([
			{ kind: 'text', text: 'Resumen de condiciones, versión 2.' },
			{
				kind: 'term',
				label: 'Salario',
				value: '16,50 USD por hora trabajada.',
			},
		]);
	});

	it('starts a value with a capital, since it sits on its own line', () => {
		expect(
			summaryLines('Vivienda: el empleador la proporciona sin costo.'),
		).toEqual([
			{
				kind: 'term',
				label: 'Vivienda',
				value: 'El empleador la proporciona sin costo.',
			},
		]);
	});

	it('keeps a sentence with a late colon as plain text', () => {
		expect(
			summaryLines('The employer covers travel to the worksite: daily.'),
		).toEqual([
			{
				kind: 'text',
				text: 'The employer covers travel to the worksite: daily.',
			},
		]);
	});

	it('drops blank lines and surrounding spaces', () => {
		expect(summaryLines('  One line.  \n\n')).toEqual([
			{ kind: 'text', text: 'One line.' },
		]);
	});
});
