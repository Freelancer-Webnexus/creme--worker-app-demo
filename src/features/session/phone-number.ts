export type PhoneCheck =
	{ kind: 'valid'; phone: string } | { kind: 'empty' } | { kind: 'invalid' };

const MIN_DIGITS = 10;
const MAX_DIGITS = 15;
/** Workers are recruited in Mexico, so a bare ten-digit number is Mexican. */
const DEFAULT_COUNTRY_CODE = '52';
const NATIONAL_NUMBER_DIGITS = 10;

const digitsOf = (input: string): string => input.replace(/\D/g, '');

/**
 * Turns what the worker typed into the number sent to the server. The server
 * compares digits only (api-contract.md), so spaces, dashes and brackets never
 * matter. A number typed without a country code and with exactly ten digits
 * gets +52.
 */
export const checkPhone = (input: string): PhoneCheck => {
	const digits = digitsOf(input);
	if (digits === '') {
		return { kind: 'empty' };
	}
	if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
		return { kind: 'invalid' };
	}

	const hasPlus = input.trim().startsWith('+');
	if (!hasPlus && digits.length === NATIONAL_NUMBER_DIGITS) {
		return { kind: 'valid', phone: `+${DEFAULT_COUNTRY_CODE}${digits}` };
	}
	return { kind: 'valid', phone: `+${digits}` };
};

const MEXICAN_MOBILE = /^\+52(\d{2})(\d{4})(\d{4})$/;

/** A checked number for reading back to the worker: "+52 55 1000 0001". */
export const displayPhone = (phone: string): string =>
	phone.replace(MEXICAN_MOBILE, `+${DEFAULT_COUNTRY_CODE} $1 $2 $3`);
