export const CODE_LENGTH = 6;

/** Digits only, at most six: a pasted "123 456" or a code with a dash still works. */
export const sanitizeCode = (input: string): string =>
	input.replace(/\D/g, '').slice(0, CODE_LENGTH);

export const isCompleteCode = (code: string): boolean =>
	code.length === CODE_LENGTH;
