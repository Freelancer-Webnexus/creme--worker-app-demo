import { fireEvent, render } from '@testing-library/react-native';
import type { CodeScreenModel } from '@/features/session/code-screen-model';
import type { PhoneScreenModel } from '@/features/session/phone-screen-model';
import CodeScreenView from '@/features/session/screens/code-screen-view';
import PhoneScreenView from '@/features/session/screens/phone-screen-view';
import { sessionNoticeFor } from '@/features/session/session-notice';
import { translate } from '@/services/i18n/translate';

const spanish = (key: Parameters<typeof translate>[1]) => translate('es', key);

const phoneModel = (
	overrides: Partial<PhoneScreenModel> = {},
): PhoneScreenModel => ({
	buttonTitle: 'Continuar',
	error: undefined,
	hint: 'Con el código de país, por ejemplo +52 55 1000 0001',
	isBusy: false,
	label: 'Tu número de celular',
	language: 'es',
	languageLabel: 'Idioma',
	languageOptions: [
		{ label: 'Español', value: 'es' },
		{ label: 'English', value: 'en' },
	],
	notice: null,
	onChangeText: jest.fn(),
	onLanguageChange: jest.fn(),
	onSubmit: jest.fn(),
	title: 'Entra con tu celular',
	value: '+525510000001',
	...overrides,
});

const codeModel = (
	overrides: Partial<CodeScreenModel> = {},
): CodeScreenModel => ({
	buttonTitle: 'Entrar',
	changeNumberTitle: 'Cambiar de número',
	error: undefined,
	hint: 'Escribe los 6 números',
	intro: 'Enviamos un código por mensaje al +525510000001.',
	isBusy: false,
	label: 'Código que te enviamos',
	needsPhone: false,
	notice: null,
	onChangeNumber: jest.fn(),
	onChangeText: jest.fn(),
	onSubmit: jest.fn(),
	title: 'Escribe el código',
	value: '',
	...overrides,
});

describe('PhoneScreenView', () => {
	it('shows the prefilled number, the example format and a plain connection message', async () => {
		const view = await render(
			<PhoneScreenView
				{...phoneModel({ error: spanish('signin.no_connection') })}
			/>,
		);

		expect(view.getByTestId('phone-input').props.value).toBe('+525510000001');
		expect(view.getByTestId('phone-input').props.keyboardType).toBe(
			'phone-pad',
		);
		expect(view.getByText(/\+52 55 1000 0001/)).toBeTruthy();
		expect(view.getByText(/Para entrar necesitas internet/)).toBeTruthy();
	});

	it('reports typing and the continue tap', async () => {
		const model = phoneModel();
		const view = await render(<PhoneScreenView {...model} />);

		await fireEvent.changeText(view.getByTestId('phone-input'), '+5255');
		await fireEvent.press(view.getByTestId('phone-continue'));

		expect(model.onChangeText).toHaveBeenCalledWith('+5255');
		expect(model.onSubmit).toHaveBeenCalledTimes(1);
	});

	it('says the saved actions are safe when the worker signs in again', async () => {
		const view = await render(
			<PhoneScreenView
				{...phoneModel({ notice: sessionNoticeFor('reauthenticate', spanish) })}
			/>,
		);

		expect(view.getByTestId('session-notice')).toHaveTextContent(
			/sigue guardado en este teléfono/,
		);
	});
});

describe('CodeScreenView', () => {
	it('asks for a one-time code with a numeric keyboard and six digits at most', async () => {
		const view = await render(<CodeScreenView {...codeModel()} />);
		const input = view.getByTestId('code-input');

		expect(input.props.keyboardType).toBe('number-pad');
		expect(input.props.maxLength).toBe(6);
		expect(input.props.textContentType).toBe('oneTimeCode');
		expect(input.props.autoComplete).toBe('sms-otp');
	});

	it('shows the wrong-code message', async () => {
		const view = await render(
			<CodeScreenView
				{...codeModel({ error: spanish('signin.wrong_code') })}
			/>,
		);

		expect(view.getByText(/El código no es correcto/)).toBeTruthy();
	});

	it('locks the buttons while the code is being checked', async () => {
		const view = await render(
			<CodeScreenView
				{...codeModel({ buttonTitle: 'Revisando el código…', isBusy: true })}
			/>,
		);

		expect(view.getByTestId('code-verify').props.accessibilityState).toEqual({
			busy: true,
			disabled: true,
		});
		expect(
			view.getByTestId('code-change-number').props.accessibilityState,
		).toEqual({ busy: false, disabled: true });
		expect(view.getByTestId('code-input').props.editable).toBe(false);
	});
});
